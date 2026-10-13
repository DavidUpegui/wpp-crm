---
id: "002"
title: "Inbox: receive and reply to text messages"
spec: ./spec.md
status: Done             # Draft | Approved | Done
created: 2026-10-12
approved_at: 2026-10-12
---

# Plan 002 — Inbox: receive and reply to text messages

> The plan explains **HOW** to implement the approved spec, following AGENTS.md
> (architecture §5, readability §6). It must not add behavior that is not in the spec.

## 1. Technical Summary

Two new feature modules:
- **`webhooks`** handles Meta's format. It verifies the GET handshake and the POST signature, stores every POST raw in `webhook_events`, then parses the payload with Zod and sends each `field` to a **handler registry**. The `messages` handler turns Meta's `messages[]` and `statuses[]` into plain domain inputs and calls the conversations use cases.
- **`conversations`** holds the business rules: contacts, conversations, messages, unread counts, the 24h window, monotonic delivery status, and sending text replies through a `MessageSender` (Meta adapter over `shared/whatsapp/graph-client.ts`).

Every change runs `NOTIFY inbox_events` with `{ type, conversationId }`. `/api/realtime` streams it as SSE to the browser. The inbox is one client screen (TanStack Query) at `/inbox/[[...conversationId]]`: it reads through three small authenticated GET routes, writes through two Server Actions, and refetches what changed when an SSE event arrives or the stream reconnects (catch-up).

## 2. Modules & Layers Touched

| Module | domain | application | infrastructure | ui | app routes |
|---|---|---|---|---|---|
| `src/modules/webhooks` (new) | ✅ | ✅ | ✅ | — | ✅ `api/webhooks/whatsapp` |
| `src/modules/conversations` (new) | ✅ | ✅ | ✅ | ✅ | ✅ `(app)/inbox`, `api/conversations/*` |
| `src/shared` | — | — | ✅ `whatsapp/graph-client.ts`, `realtime/*`, `db/schema/*` | — | ✅ `api/realtime` |
| `src/components` | — | — | — | ✅ `page-container.tsx`, `query-client-provider.tsx`, `app-shell.tsx` (edit) | — |

## 3. Domain

### 3.1 `conversations/domain`

| Item | Kind | File | Implements |
|---|---|---|---|
| `Contact`, `Conversation`, `Message` (+ `MessageDirection`, `DeliveryStatus = "queued" \| "sent" \| "delivered" \| "read" \| "failed"`) | types | `conversation.ts`, `message.ts`, `contact.ts` | §8 data |
| `ConversationSummary` (list row: contact, last message preview, unread, lastActivityAt), `ConversationDetail` (contact, lastInboundAt), `ThreadMessage` (+ sender name), `MessagePage` (`messages`, `hasOlder`) | read-model types | `inbox-views.ts` | FR-011, FR-013, FR-014 |
| `InboundMessageInput` (waMessageId, from waId, profileName, type, text, sentAt) and `MessageStatusReport` (waMessageId, status, failureCode?) | input types (what webhooks hands over) | `inbound-message-input.ts`, `message-status-report.ts` | FR-005–FR-007, FR-019 |
| `isWithinCustomerServiceWindow(lastInboundAt, now)`, `customerServiceWindowClosesAt(lastInboundAt)`; `CUSTOMER_SERVICE_WINDOW_MS` | rule | `customer-service-window.ts` | BR-001, FR-015, FR-018 |
| `nextDeliveryStatus(current, reported)`: forward-only, `failed` is final, `played` → `read` | rule | `delivery-status.ts` | BR-003 |
| `validateReplyText(text)` → trimmed text, or throws `EmptyReplyTextError` / `ReplyTextTooLongError`; `MAX_REPLY_TEXT_LENGTH = 4096` | rule | `reply-text.ts` | BR-004, FR-016 |
| `toDeliveryFailureReason(metaErrorCode)` → `outside_window \| recipient_not_allowed \| undeliverable \| rate_limited \| access_token_invalid \| unknown` (131047, 131030, 131026, 131056/130429, 190, other) | rule | `delivery-failure-reason.ts` | AC-5.5, §12 |
| `normalizeSearchText(text)` (lower case, strip accents, trim) and `extractDigits(text)` | rule | `search-text.ts` | FR-012 |
| `isNewerActivity(candidate, current)`: an out-of-order old inbound message does not replace the latest preview | rule | `conversation-activity.ts` | AC-3.1 |
| `ContactRepository`, `ConversationRepository`, `MessageRepository` (writes) | interfaces | `contact-repository.ts`, `conversation-repository.ts`, `message-repository.ts` | — |
| `ConversationTransactionRunner` → `run(work({ contacts, conversations, messages }))` | interface | `conversation-transaction-runner.ts` | multi-row writes (§9) |
| `InboxQueries` (`listConversations(search)`, `getConversationDetail(id)`, `listMessages(conversationId, beforeMessageId?)`) | interface (read side) | `inbox-queries.ts` | FR-011–FR-014 |
| `MessageSender` → `sendText(toWaId, text): Promise<{ waMessageId }>`; throws `MessageSendFailedError(metaErrorCode \| null)` | interface | `message-sender.ts` | FR-017 |
| `InboxEventPublisher` → `publish({ type: "conversation_updated", conversationId })` | interface | `inbox-event-publisher.ts` | FR-020 |
| `ConversationNotFoundError`, `OutsideCustomerServiceWindowError`, `EmptyReplyTextError`, `ReplyTextTooLongError`, `MessageSendFailedError` | errors (`AppError`) | `errors.ts` | AC-4.4, AC-5.3, AC-5.4 |

### 3.2 `webhooks/domain`

| Item | Kind | File | Implements |
|---|---|---|---|
| `hasValidWebhookSignature(rawBody, signatureHeader, appSecret)`: HMAC-SHA256 + `timingSafeEqual` (`node:crypto`, pure) | rule | `webhook-signature.ts` | FR-002, §8.3 |
| `getVerificationChallenge(query, expectedVerifyToken)` → challenge or `null` | rule | `webhook-verification.ts` | FR-001, §8.4 |
| Zod schemas of Meta's envelope (`object`, `entry[].changes[].{field,value}`) and the `messages` change value (`metadata`, `contacts[]`, `messages[]`, `statuses[]`, `errors[]`) | schemas | `meta-webhook-payload.ts` | FR-007, FR-019 |
| `INBOUND_CONTENT_READERS: Record<string, reader>` — `text` → `text.body`; any other type → `{ type, text: null }` (placeholder) | registry | `inbound-message-content.ts` | FR-008, §5.3 O |
| `WebhookEventRepository` → `save({ rawBody, signatureValid }) → id`, `markProcessed(id)`, `markFailed(id, error)` | interface | `webhook-event-repository.ts` | FR-003 |
| `WebhookChangeHandler = (value: unknown) => Promise<void>` | type | `webhook-change-handler.ts` | §5.3 O |
| `InvalidWebhookSignatureError` (401), `WebhookVerificationFailedError` (403) | errors | `errors.ts` | AC-1.2, AC-1.3 |

## 4. Application (use cases)

| Use case | File | Depends on (interfaces) | Implements |
|---|---|---|---|
| `recordInboundMessage(input)`: in one transaction, upsert the contact by `wa_id` (update the name if it changed), get or create its conversation, then insert the message `ON CONFLICT DO NOTHING`. Only if it was new: set `lastInboundAt = max`, update the latest activity/preview (`isNewerActivity`) and `unread + 1`. Then publish. | `conversations/application/record-inbound-message.ts` | `ConversationTransactionRunner`, `InboxEventPublisher` | FR-005–FR-007, FR-010, BR-002, AC-2.1–2.5 |
| `applyMessageStatus(report)`: find the outbound message by `wa_message_id`, ignore it if unknown, otherwise apply `nextDeliveryStatus` (and the failure reason on `failed`), save only if it changed, then publish. | `conversations/application/apply-message-status.ts` | `MessageRepository`, `InboxEventPublisher` | FR-019, BR-003, AC-6.1–6.3 |
| `sendTextReply({ conversationId, text, senderUserId })`: validate the text, load the conversation (404), check the window with `now` (throw if closed, without calling Meta). Insert as `queued` + update activity and publish. Then call `MessageSender`: on success mark `sent` + `wamid`, on error mark `failed` + reason. Publish again and return the `ThreadMessage`. | `conversations/application/send-text-reply.ts` | `ConversationTransactionRunner`, `MessageSender`, `InboxEventPublisher`, `now` | FR-015–FR-017, BR-001, BR-004, AC-5.1, 5.3–5.5 |
| `markConversationRead(conversationId)`: set unread to 0 (only if > 0), then publish. | `conversations/application/mark-conversation-read.ts` | `ConversationRepository`, `InboxEventPublisher` | FR-010, AC-3.3, AC-3.4 |
| `listConversations(search?)` | `conversations/application/list-conversations.ts` | `InboxQueries` | FR-011, FR-012 |
| `getConversation(id)` → detail or `ConversationNotFoundError` | `conversations/application/get-conversation.ts` | `InboxQueries` | AC-4.4, FR-018 |
| `listConversationMessages(id, beforeMessageId?)` → page of 50 | `conversations/application/list-conversation-messages.ts` | `InboxQueries` | FR-013, FR-014 |
| `verifyWebhookSubscription(query)` → challenge, or `WebhookVerificationFailedError` | `webhooks/application/verify-webhook-subscription.ts` | `verifyToken` (string) | FR-001 |
| `receiveWebhook({ rawBody, signatureHeader })`: check the signature and store the row. Invalid → saved with `signature_valid = false`, then throw 401. Valid → `processWebhookPayload`, then `markProcessed`, or `markFailed` (never rethrows). | `webhooks/application/receive-webhook.ts` | `WebhookEventRepository`, `processWebhookPayload`, `appSecret` | FR-002–FR-004 |
| `processWebhookPayload(json)`: parse the envelope and call `handlersByField[change.field]` for each change. Unknown fields (e.g. `message_template_status_update`) are skipped. | `webhooks/application/process-webhook-payload.ts` | `Record<string, WebhookChangeHandler>` | §5.3 O |
| `makeHandleMessagesChange`: parse the value. If `metadata.phone_number_id` ≠ the configured number, return (FR-009). For each message, `recordInboundMessage(...)` (profile name from `contacts[]`, content from the registry). For each status, `applyMessageStatus(...)`. | `webhooks/application/handle-messages-change.ts` | `recordInboundMessage`, `applyMessageStatus` (function types from `conversations/domain` inputs), `businessPhoneNumberId` | FR-007–FR-009, FR-019 |

Test fakes (`conversations/application/testing/`): `InMemoryConversationStore` (implements the three repositories + transaction runner over shared arrays), `FakeMessageSender` (succeeds with a wamid or throws `MessageSendFailedError(code)`), `RecordingInboxEventPublisher`, plus a contract test for the in-memory store. `webhooks/application/testing/in-memory-webhook-event-repository.ts`.

## 5. Infrastructure

| Implementation | Implements interface | File |
|---|---|---|
| `GraphClient` (class: `{ accessToken, apiVersion, fetchFunction }`): `post(path, body)`, base URL `https://graph.facebook.com/${version}`, bearer token, retry with backoff on 429/5xx (max 2 retries), Meta error → `GraphApiError` with `metaErrorCode`; network error → `GraphApiError(null)` | — (shared low-level client) | `src/shared/whatsapp/graph-client.ts`, `graph-api-error.ts` |
| `MetaMessageSender` — `POST /{phone-number-id}/messages` text body, `preview_url: false`; `GraphApiError` → `MessageSendFailedError(code)` | `MessageSender` | `conversations/infrastructure/meta-message-sender.ts` |
| `DrizzleContactRepository`, `DrizzleConversationRepository`, `DrizzleMessageRepository` (receive a `DatabaseExecutor`) | the three repositories | `conversations/infrastructure/drizzle-*-repository.ts` |
| `DrizzleConversationTransactionRunner` | `ConversationTransactionRunner` | `conversations/infrastructure/drizzle-conversation-transaction-runner.ts` |
| `DrizzleInboxQueries` — list (join contact + last message, `ORDER BY last_activity_at DESC`, search: `profile_name_search ILIKE %q%` OR `wa_id LIKE %digits%`, wildcards escaped); detail; messages keyset page `(sent_at, id) < cursor`, `LIMIT 51`, left join `user.name` | `InboxQueries` | `conversations/infrastructure/drizzle-inbox-queries.ts` |
| `PostgresInboxEventPublisher` — `notify(INBOX_EVENTS_CHANNEL, payload)` | `InboxEventPublisher` | `conversations/infrastructure/postgres-inbox-event-publisher.ts` |
| `notify(database, channel, payload)` (`select pg_notify(...)`) and `subscribeToChannel(connectionString, channel, onPayload) → unsubscribe` (own `pg.Client` per subscriber, `LISTEN`, closes on unsubscribe) | — (shared helpers) | `src/shared/realtime/notify.ts`, `src/shared/realtime/subscribe-to-channel.ts`, `inbox-events-channel.ts` |
| `DrizzleWebhookEventRepository` | `WebhookEventRepository` | `webhooks/infrastructure/drizzle-webhook-event-repository.ts` |

**Composition root (`src/server/container.ts`)** adds: `graphClient` (env token + version, global `fetch`), `MetaMessageSender(graphClient, env.WHATSAPP_PHONE_NUMBER_ID)`, the Drizzle repositories/queries/runner, `PostgresInboxEventPublisher(db)`, and the exported use cases (`recordInboundMessage`, `applyMessageStatus`, `sendTextReply`, `markConversationRead`, `listConversations`, `getConversation`, `listConversationMessages`, `verifyWebhookSubscription`, `receiveWebhook`). `receiveWebhook` gets `processWebhookPayload` built with `{ messages: makeHandleMessagesChange(...) }`. Also exported: `subscribeToInboxEvents(listener)`, which wraps `subscribeToChannel(env.DATABASE_URL, INBOX_EVENTS_CHANNEL, …)` for the SSE route.

No new environment variables. Existing ones used: `META_APP_SECRET`, `META_GRAPH_API_VERSION`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `DATABASE_URL`.

## 6. Database Schema & Migrations

New files in `src/shared/db/schema/` (re-exported from `index.ts`). All timestamps are `timestamptz`. All ids are `uuid` with `defaultRandom()`, except the FK to Better Auth's `user.id` (`text`).

**`webhook-events.ts` → `webhook_event`**
- `id`, `received_at` (not null, default now), `raw_body text not null`, `signature_valid boolean not null`, `processed_at` (null), `processing_error text` (null).
- Rows with `processed_at IS NULL AND processing_error IS NOT NULL` are the ones to replay later (no replay screen in this spec).

**`contacts.ts` → `contact`**
- `id`, `wa_id text not null UNIQUE` (BR-006), `profile_name text` (null), `profile_name_search text` (null; `normalizeSearchText(profile_name)`), `created_at`, `updated_at`.

**`conversations.ts` → `conversation`**
- `id`, `contact_id uuid not null UNIQUE → contact.id` (BR-005), `last_inbound_at` (null; drives the window), `last_activity_at not null`, `last_message_id uuid` (null, no FK constraint to avoid a circular FK; always written by our code), `unread_count integer not null default 0`, `created_at`, `updated_at`.
- Index `conversation_last_activity_at_idx (last_activity_at DESC)`.

**`messages.ts` → `message`**
- `id`, `conversation_id uuid not null → conversation.id`, `direction text not null` (`inbound` | `outbound`), `wa_message_id text UNIQUE` (null while `queued`; Postgres allows many NULLs — the idempotency key, BR-002).
- `type text not null`, `text_body text` (null), `sent_at not null` (BR-007: WhatsApp timestamp for inbound, creation time for outbound), `status text` (outbound only), `failure_reason text`, `sent_by_user_id text → user.id ON DELETE SET NULL`, `created_at`, `updated_at`.
- Index `message_conversation_id_sent_at_id_idx (conversation_id, sent_at DESC, id DESC)` for the keyset pages.

Enum-like columns are `text` typed with `$type<…>()` (same as `user.role` in spec 001).

Migration: `pnpm db:generate --name inbox_text_messaging` → `drizzle/0002_inbox_text_messaging.sql`. Review the SQL, then `pnpm db:migrate`.

## 7. Routes, Server Actions & UI

| Entry point | Type | File | Calls use case | Auth |
|---|---|---|---|---|
| `GET /api/webhooks/whatsapp` | route handler | `src/app/api/webhooks/whatsapp/route.ts` | `verifyWebhookSubscription` → 200 `text/plain` challenge / 403 | public (verify token) |
| `POST /api/webhooks/whatsapp` | route handler (same file); `await request.text()` before anything else | same | `receiveWebhook` → 200 / 401 | public + signature |
| `GET /api/conversations?search=` | route handler | `src/app/api/conversations/route.ts` | `listConversations` → `{ conversations: [...] }` | signed-in (admin/agent) |
| `GET /api/conversations/[id]` | route handler | `src/app/api/conversations/[id]/route.ts` | `getConversation` → 200 / 404 `CONVERSATION_NOT_FOUND` | signed-in |
| `GET /api/conversations/[id]/messages?before=<messageId>` | route handler | `src/app/api/conversations/[id]/messages/route.ts` | `listConversationMessages` → `{ messages, hasOlder }` | signed-in |
| `GET /api/realtime` | route handler (SSE): `await connection()`, `requireCurrentUser`, `ReadableStream` that writes `data: {json}\n\n` per event + `: ping` every 25 s, unsubscribes on `request.signal` abort | `src/app/api/realtime/route.ts` | `subscribeToInboxEvents` | signed-in |
| `/inbox` and `/inbox/<id>` | page (optional catch-all, one screen): `requireSignedInUser` in `<Suspense>`, renders `<InboxScreen selectedConversationId currentUserId actions />` | `src/app/(app)/inbox/[[...conversationId]]/page.tsx` (replaces `inbox/page.tsx`) | — | signed-in |
| `sendReplyAction(conversationId, text)` → `{ ok: true, message } \| { ok: false, error: code }` | server action | `src/app/(app)/inbox/actions.ts` | `sendTextReply` | signed-in |
| `markConversationReadAction(conversationId)` | server action | same | `markConversationRead` | signed-in |

New `ERROR_STATUS_BY_CODE` rows: `CONVERSATION_NOT_FOUND: 404`, `INVALID_WEBHOOK_SIGNATURE: 401`, `WEBHOOK_VERIFICATION_FAILED: 403`, `OUTSIDE_CUSTOMER_SERVICE_WINDOW: 409`, `EMPTY_REPLY_TEXT: 422`, `REPLY_TEXT_TOO_LONG: 422`. Route ids are validated as UUIDs with Zod: an invalid id → 404, the same as a missing one (AC-4.4).

**UI components (`src/modules/conversations/ui/`)**, all client components except where noted:
- `inbox-screen.tsx`: two panes, chooses the mobile view (list or thread) from `selectedConversationId`, mounts `useInboxLiveUpdates`.
- `conversation-list.tsx`, `conversation-list-item.tsx`, `conversation-search.tsx`: search debounced ~250 ms, kept in `?q=`.
- `conversation-thread.tsx`, `thread-header.tsx` (name, number, window indicator + meter), `message-bubble.tsx`, `delivery-status-mark.tsx`, `load-older-button.tsx`.
- `reply-composer.tsx`: Enter sends, Shift+Enter adds a new line, counter from 3,900 characters, disabled outside the window.
- `inbox-queries.ts`: TanStack query keys and fetchers — `useConversations(search)`, `useConversation(id)`, `useConversationMessages(id)` (`useInfiniteQuery`, `before` cursor).
- `use-inbox-live-updates.ts`: `EventSource('/api/realtime')`. On each event: invalidate `['conversations']`, `['conversation', id]` and `['messages', id]`. On `open` after an error: invalidate everything (catch-up, AC-7.2). After 5 s disconnected: show "Reconectando…". If the stream is closed (e.g. 401), recreate it every 5 s.
- `use-window-countdown.ts`: re-evaluates the window every 60 s.
- `message-content-label.ts`: placeholder text with Spanish type names (`image` → "imagen", `audio`, `video`, `document` → "documento", `sticker`, `location` → "ubicación", `contacts` → "contacto", `reaction` → "reacción"; unknown → raw type).
- `failure-reason-messages.ts` (§12 copy), `messages.ts` (rest of the copy), `inbox-actions.ts` (Server Action prop types).
- **Unread while open (AC-3.4):** when the list data shows `unreadCount > 0` for the selected conversation, the screen calls `markConversationReadAction`, so it goes back to 0 for everyone. In the list, the selected row never shows a badge.
- **Optimistic "Enviando" (AC-5.1):** the `useMutation` `variables` render a pending bubble until the action returns. The SSE refetch then shows the saved row.
- **Keep scroll position on "Cargar anteriores" (AC-4.2):** save `scrollHeight` before prepending, then restore `scrollTop += delta` in `useLayoutEffect`.

**Shared components:**
- `src/components/query-client-provider.tsx`: one `QueryClient` per browser tab (`staleTime` 30 s, `refetchOnWindowFocus` on), used by the inbox screen.
- `src/components/page-container.tsx`: the 1100 px width + padding wrapper moves here from `AppShell`, so the inbox can use the full width and height. The account, users, contacts and templates pages wrap their content in it. This also solves the TODO item "drop duplicate 1100px wrapper in users page".

New dependency: `@tanstack/react-query@5` (already in the AGENTS.md stack). `find-skills` found only small community TanStack Query skills (< 300 installs, none from TanStack or Vercel), so none is recommended.

## 7b. Design (AGENTS.md §4.1, `frontend-design` skill)

Reuses the visual system of plan 001 §7b (Instrument Sans, Pine ink / Mineral / Paper / Lagoon / Mint wash / Signal tokens in `globals.css`, `rounded-bubble` 16 px). The inbox is a **work surface**: quiet, dense, legible all day. It has one specific moment, the 24h window meter.

**Palette (existing tokens, roles in the inbox):**

| Name | Hex | Inbox use |
|---|---|---|
| Mineral | `#F5F7F6` | thread background |
| Paper | `#FFFFFF` | conversation list pane, customer bubbles (with a `#DCE3E1` hairline), composer |
| Mint wash | `#DDF2EB` | team bubbles, selected list row, "Ventana abierta" pill |
| Lagoon | `#0B7A6D` | unread badge (white `tabular-nums` text), window meter, focus ring |
| Receipt blue | `#1B64C4` | "Leído" ticks and label (WhatsApp convention; 5.3:1 on Mineral, where the status line sits). Changed from Lagoon on 2026-10-12 at the user's request: grey vs. Lagoon looked the same |
| Signal | `#C2412D` | "No enviado" mark and reason |
| Amber (support) | `#B45309` on `#FEF3C7` | window meter and pill in the last 2 h before closing |
| Slate (support) | `#475569` on `#E2E8F0` | "Ventana cerrada" pill, times, numbers, placeholders |

New tokens in `globals.css`: `--bubble-team` (Mint wash) and `--bubble-customer` (Paper), so bubbles do not borrow `accent`, plus `--window-closing` (Amber).

**Typography:** Instrument Sans only, on the existing scale.
- 15 px: message text and contact names (names 600).
- 13 px: previews, times, phone numbers, status marks, window pill. Numbers and times use `tabular-nums`.
- 18 px: thread header name.
- No new sizes or weights.

**Layout:**
```
Desktop (≥ 768px)
+---------+----------------------+---------------------------------------------+
| sidebar | Bandeja              | Ana Gómez            [Ventana abierta ·     |
| 240px   | [Buscar nombre o nº] | +57 300 123 4567      cierra en 5 h]        |
|         |----------------------|=============================== meter 2px ===|
|         | (AG) Ana Gómez  10:42|            [ Cargar anteriores ]            |
|         | Hola, quería…     (2)|  ( Hola, quería saber… )         10:40      |
|         | (JP) Juan Pérez  Ayer|                 ( ¿En qué te ayudo? )       |
|         | Mensaje de tipo …    |                  Laura · 10:41 · ✓✓ Leído   |
|         |                      |---------------------------------------------|
|         |  list 340px, Paper   | [Escribe una respuesta…            ] [Enviar]|
+---------+----------------------+---------------------------------------------+
Mobile (< 768px): /inbox = list full screen; /inbox/<id> = thread full screen with "← Volver".
```
- The inbox fills the viewport height. The list and the thread scroll on their own. The composer stays at the bottom of the thread.
- Text is left aligned. Customer bubbles are on the left and team bubbles on the right, max width 70 ch.
- Bubbles have a 16 px radius with the tail corner (4 px) on the sender's side. Consecutive messages from the same side group with 4 px gaps; a change of side gets 12 px.
- Under each team bubble: user name, time and status mark (lucide `Clock` Enviando, `Check` Enviado, `CheckCheck` Entregado, `CheckCheck` in Receipt blue Leído, `CircleAlert` in Signal No enviado + reason). The icon always comes with its text label, not colour alone.
- Avatars are initials on a `#E8EDEB` circle in Pine ink. No photos.

**Principles:**
- **The window meter is the signature.** A 2 px line under the thread header shows how much of the 24 h is left (width = remaining / 24 h): Lagoon, Amber in the last 2 h, absent when closed. It is static (updates each minute), so it respects reduced motion with no extra code.
- Everything else is quiet: no shadows on bubbles or rows, no entrance animations. A new message simply appears; the list reorders without animation.
- Unsupported messages are a dashed-outline bubble in Slate italic, so they read as "something is here" and not as text from the customer.
- Quality floor: works down to 360 px, visible Lagoon focus ring on rows, buttons and composer, list rows are links (keyboard and middle-click), `aria-live="polite"` on the thread for new messages, text contrast ≥ 4.5:1, Spanish copy taken from spec §10/§12.

## 8. Meta API Verification

| Call / webhook field | Method & path | Key request/response fields | Doc link (checked 2026-10-12) |
|---|---|---|---|
| Webhook verification | `GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…` | 200 + challenge as plain text, otherwise 403 | [Create a webhook endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint) |
| Webhook signature | header `X-Hub-Signature-256: sha256=<hex>` | HMAC-SHA256(raw body, app secret) | same |
| `messages` — inbound | `POST` webhook | `object: "whatsapp_business_account"`; `entry[].changes[].field = "messages"`; `value.metadata.phone_number_id`; `value.contacts[].{profile.name, wa_id}`; `value.messages[].{from, id, timestamp (unix string), type, text.body}`; `type: "unsupported"` for unsupported content | [Messages webhook](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages), [Unsupported](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/unsupported) |
| `messages` — statuses | `POST` webhook | `value.statuses[].{id, status: sent\|delivered\|read\|played\|failed, timestamp, recipient_id, errors[].{code, title, message, error_data.details}}` (`errors` only on `failed`) | [Status webhook](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status) |
| Send text | `POST /{phone-number-id}/messages` | Request `{ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body (≤ 4096), preview_url: false } }`; response `{ messaging_product, contacts: [{ input, wa_id }], messages: [{ id }] }` | [Text messages](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages) |
| Error response | any Graph call | `{ error: { message, type, code, error_data: { messaging_product, details }, fbtrace_id } }`; handle by `code` (titles are being deprecated) | [Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes) |
| Error codes used | — | 131047 (window), 131026 (undeliverable), 131056 (pair rate), 130429 (throughput), 190 (token), 131000 (unknown) are on the page. **131030** (recipient not in allowed list) is not listed: provisional, confirmed with the real test number (T-manual) | same |

Real payloads are captured with the tunnel and copied from `webhook_event.raw_body` into `tests/fixtures/webhooks/`: text, image, reaction, unsupported, and statuses sent/delivered/read/failed. Phone numbers, names and wamids are replaced with fake values before committing. Parsers are written from these fixtures, not from memory (§8).

## 9. Testing Strategy

| Layer | What is tested | Test file | Fakes / fixtures |
|---|---|---|---|
| domain | 24h window (< 24h open, = 24h closed, null closed; closes-at); delivery status order (out of order, failed final, played → read); reply text (empty, spaces, 4096 ok, 4097 rejected); failure reason mapping; search normalization (accents, case, digits); activity ordering | `conversations/domain/*.test.ts` | none |
| domain | signature valid / invalid / missing / wrong prefix; verification challenge (ok, wrong token, wrong mode); envelope + messages value schemas against every fixture; content registry (text, image → placeholder, unknown type) | `webhooks/domain/*.test.ts` | `tests/fixtures/webhooks/*.json` |
| application | `recordInboundMessage`: new contact + conversation + unread 1; second message same conversation, unread 2; name update; duplicate wamid → no change, no second unread; older message does not replace preview; publishes event | `record-inbound-message.test.ts` | in-memory store, recording publisher |
| application | `applyMessageStatus`: forward moves, out of order, failed final + reason, unknown wamid ignored, duplicate no-op | `apply-message-status.test.ts` | same |
| application | `sendTextReply`: happy path queued → sent with wamid; outside window → error and sender NOT called; empty/too long → error; Meta error 131030/131047/190 → failed with reason; not found | `send-text-reply.test.ts` | + `FakeMessageSender`, fixed `now` |
| application | `markConversationRead`; `receiveWebhook` (invalid → stored + 401 error; valid → processed; handler throws → marked failed, no throw); `processWebhookPayload` (dispatch by field, unknown field skipped); `handleMessagesChange` (other phone number ignored; text/status/unsupported fixtures call the right use case) | `*.test.ts` | in-memory webhook repo, spies |
| infrastructure | `GraphClient` (auth header, version in URL, retry on 429/5xx then success, no retry on 400, error mapping, network error); `MetaMessageSender` request body + response mapping | `graph-client.test.ts`, `meta-message-sender.test.ts` | mocked `fetch` |
| infrastructure | Drizzle repositories + runner: contact upsert, `ON CONFLICT` idempotent insert, rollback; `DrizzleInboxQueries`: order, search by accented name / partial number with "+" and spaces, keyset pages of 50 + `hasOlder`, sender name; webhook event repository; `notify` + `subscribeToChannel` round trip | `*.integration.test.ts` | Docker Postgres test DB |

No route-level/e2e tests (production hardening, TODO). No concurrency tests (demo rule).

Manual end-to-end check (WhatsApp test number, through `cloudflared`) = spec §13:
1. Configure the callback URL + verify token in the Meta dashboard → verified (AC-1.1).
2. Send "Hola" from an allowed phone → appears live for an admin and an agent in two browsers, with name and unread 1.
3. Open it → unread 0 in both. Reply → phone receives it; Enviando → Enviado → Entregado → Leído live.
4. Send an image → placeholder.
5. Remove the phone from the allowed list and reply → "No enviado" + allowed-list reason; record the real error code (confirms 131030).
6. Set `last_inbound_at` of a conversation to 25 h ago in Adminer → composer disabled with the 24h reason.
7. Turn off the network for ~20 s while a message arrives → "Reconectando…", then it catches up.
8. Capture the fixtures (§8) during steps 2–5.

## 10. Traceability Matrix

| Spec item | Implemented by | Verified by |
|---|---|---|
| FR-001 | `getVerificationChallenge`, `verifyWebhookSubscription`, GET webhook route | `webhook-verification.test.ts`; manual 1 |
| FR-002 | `hasValidWebhookSignature`, `receiveWebhook` | `webhook-signature.test.ts`, `receive-webhook.test.ts` |
| FR-003 | `webhook_event` table, `DrizzleWebhookEventRepository`, `receiveWebhook` | `receive-webhook.test.ts`, repo integration test |
| FR-004 | `receiveWebhook` never rethrows processing errors; route returns 200 | `receive-webhook.test.ts` |
| FR-005 | `recordInboundMessage`, contact `wa_id` UNIQUE, conversation `contact_id` UNIQUE | `record-inbound-message.test.ts`, repo integration |
| FR-006 | `recordInboundMessage` (contact upsert updates name + search name) | `record-inbound-message.test.ts` |
| FR-007 | `handleMessagesChange`, `INBOUND_CONTENT_READERS`, `message.wa_message_id` UNIQUE | `handle-messages-change.test.ts`, fixtures |
| FR-008 | `INBOUND_CONTENT_READERS` fallback, `message-content-label.ts`, unsupported bubble | `inbound-message-content.test.ts`; manual 4 |
| FR-009 | `handleMessagesChange` phone-number check | `handle-messages-change.test.ts` |
| FR-010 | `recordInboundMessage` (+1 only if new), `markConversationRead`, auto-mark while open | use-case tests; manual 3 |
| FR-011 | `listConversations`, `DrizzleInboxQueries.listConversations`, `GET /api/conversations`, `conversation-list.tsx` | `drizzle-inbox-queries.integration.test.ts`; manual 2 |
| FR-012 | `normalizeSearchText`, `extractDigits`, search query | `search-text.test.ts`, inbox-queries integration |
| FR-013 | `listConversationMessages`, keyset page, `useInfiniteQuery`, `load-older-button.tsx` | inbox-queries integration |
| FR-014 | `ThreadMessage.senderName`, `message-bubble.tsx`, `delivery-status-mark.tsx` | inbox-queries integration; manual 3 |
| FR-015 | `isWithinCustomerServiceWindow` in `sendTextReply` | `customer-service-window.test.ts`, `send-text-reply.test.ts` |
| FR-016 | `validateReplyText`, composer validation | `reply-text.test.ts`, `send-text-reply.test.ts` |
| FR-017 | `sendTextReply` queued → sent/failed, `toDeliveryFailureReason`, `MetaMessageSender` | `send-text-reply.test.ts`, `meta-message-sender.test.ts` |
| FR-018 | `customerServiceWindowClosesAt`, `thread-header.tsx`, `use-window-countdown.ts`, composer disabled | `customer-service-window.test.ts`; manual 6 |
| FR-019 | `applyMessageStatus`, `nextDeliveryStatus` | `apply-message-status.test.ts`, `delivery-status.test.ts` |
| FR-020 | publisher in every write use case, `notify`, `/api/realtime`, `use-inbox-live-updates.ts` | notify/subscribe integration test; manual 2, 3, 7 |
| FR-021 | `requireSignedInUser` in page + actions, `requireCurrentUser` in all 4 GET routes | review checklist; manual (logged-out redirect) |
| AC-1.1 / AC-1.2 | FR-001 | `webhook-verification.test.ts`; manual 1 |
| AC-1.3 | FR-002 (stored flagged invalid, never processed) | `receive-webhook.test.ts` |
| AC-1.4 | FR-003, FR-004 | `receive-webhook.test.ts` |
| AC-2.1 / AC-2.2 | `recordInboundMessage`, list order | use-case test; manual 2 |
| AC-2.3 | FR-006 | `record-inbound-message.test.ts` |
| AC-2.4 | FR-008 (preview uses the same label) | `inbound-message-content.test.ts`; manual 4 |
| AC-2.5 | BR-002 idempotent insert | use-case test + repo integration |
| AC-2.6 | FR-009 | `handle-messages-change.test.ts` |
| AC-3.1 | `ORDER BY last_activity_at DESC`, `isNewerActivity` | inbox-queries integration, `conversation-activity.test.ts` |
| AC-3.2 | FR-012 | `search-text.test.ts`, inbox-queries integration |
| AC-3.3 / AC-3.4 | `markConversationRead` + auto-mark while open + SSE | `mark-conversation-read.test.ts`; manual 3 |
| AC-4.1 / AC-4.2 | FR-013, scroll anchoring | inbox-queries integration; manual |
| AC-4.3 | bubbles by direction, sender name, time, status mark | manual 3; design review |
| AC-4.4 | `getConversation` 404 + uuid validation → "Esta conversación no existe" | `get-conversation.test.ts` |
| AC-5.1 | optimistic bubble + `sendTextReply` | `send-text-reply.test.ts`; manual 3 |
| AC-5.2 | composer disabled from `isWithinCustomerServiceWindow` | manual 6 |
| AC-5.3 | server-side window check | `send-text-reply.test.ts` |
| AC-5.4 | `validateReplyText` + composer counter | `reply-text.test.ts` |
| AC-5.5 | `toDeliveryFailureReason`, `failure-reason-messages.ts` | `delivery-failure-reason.test.ts`, `send-text-reply.test.ts`; manual 5 |
| AC-5.6 | window pill + meter | `customer-service-window.test.ts`; manual |
| AC-6.1 / AC-6.2 / AC-6.3 | FR-019 + SSE | `delivery-status.test.ts`, `apply-message-status.test.ts`; manual 3 |
| AC-7.1 / AC-7.2 | FR-020, catch-up on reconnect | manual 2, 7 |

## 11. Risks & Decisions

| Decision / risk | Choice and why | Alternatives considered |
|---|---|---|
| Module split | `webhooks` (Meta format) + `conversations` (all inbox rules, incl. sending). Fewest modules with clear responsibilities; a separate `contacts` module comes with the CRM spec. | `conversations` + `messaging` + `contacts` modules (as AGENTS.md hints): more cross-module wiring for no gain now |
| Zod and `node:crypto` in `webhooks/domain` | Both are pure (no I/O, no framework), and the Meta payload schema *is* the domain of that module. | Put them in infrastructure behind a parser interface: an extra interface with no second implementation (YAGNI) |
| Store invalid-signature POSTs too (`signature_valid = false`) | Follows AGENTS.md §8.5 ("every POST … signature result") and spec §8 ("whether the signature was valid"). They are never processed (AC-1.3). | Store only valid ones (also allowed by FR-003) |
| Webhook processed synchronously before answering 200 | Simplest; demo volume is tiny and Meta's timeout is generous. | Queue/worker |
| Client reads via REST GET + TanStack Query, writes via Server Actions | Live updates, search and "load older" need client-side cache and refetching. Server Actions follow the project UI pattern. | Server Components + `router.refresh()` on every SSE event: refetches the whole page, loses scroll/optimistic state |
| SSE: one `pg.Client` per open stream | Simplest correct LISTEN; a handful of users. | One shared listener with in-process fan-out (more code) |
| One event type `conversation_updated` with `conversationId` | The client only needs to know what to refetch; small payloads (§10). | Many event types with data |
| Search on a stored normalized name column | Accent-insensitive search without the `unaccent` extension; the rule is a pure tested function. | `CREATE EXTENSION unaccent` in a migration |
| `last_message_id` without an FK constraint | Avoids a circular FK between `conversation` and `message`; only our code writes it. | FK + deferrable constraint |
| Unread "stays 0 while open" (AC-3.4) | The open screen marks the conversation read when the refetch shows unread > 0. Other users may see "1" for a moment. | Server tracks who has which conversation open (presence) |
| Status updates are read → compute → write (not atomic) | Demo rule: no concurrency handling. A race between two status webhooks for the same message is possible → added to `TODO.md` "Production hardening". | Conditional `UPDATE … WHERE rank < new` |
| Retry on 429/5xx when sending can, in rare cases, duplicate a message that Meta did accept | Required by AGENTS.md §8.12; acceptable for a demo. | No retries for sends |
| Allowed-list error code is not documented | Map 131030 provisionally; the manual step 5 confirms it. If it differs, it is a one-line change in `toDeliveryFailureReason`. | — |
| Users with WhatsApp usernames may come without `wa_id` (recent Meta change) | The test number uses phone numbers; a payload without `from`/`wa_id` fails Zod and is stored with the error (replayable). Added to `TODO.md` if seen. | Support business-scoped user ids now (not in spec) |
| `AppShell` stops imposing width/padding (`PageContainer`) | The inbox needs full width and height. A small change to the 4 existing pages; removes the duplicate wrapper (TODO line deleted). | Negative margins in the inbox (fragile) |

## 12. Constitution Check (AGENTS.md)

- [x] Layers respect the dependency rule (§5.1): domain imports nothing from Next/Drizzle/fetch (Zod/`node:crypto` only in `webhooks/domain`, see §11).
- [x] **S** — each listed file has one responsibility.
- [x] **O** — webhook fields and inbound message types are added via registries (`handlersByField`, `INBOUND_CONTENT_READERS`).
- [x] **L** — in-memory store / fake sender share the contracts and error types (contract test for the store).
- [x] **I** — write repositories, read queries, sender and publisher are separate small interfaces.
- [x] **D** — use cases depend only on interfaces; concrete classes are created only in `container.ts`.
- [x] No speculative abstractions: every interface has a Drizzle/Meta/Postgres implementation and a test fake.
- [x] Readability rules (§6) can be met: named constants (`CUSTOMER_SERVICE_WINDOW_MS`, `MAX_REPLY_TEXT_LENGTH`, `MESSAGE_PAGE_SIZE = 50`), typed errors.
- [x] Next 16 rules (§11): `connection()` in webhook/realtime/API routes, no segment config, `proxy.ts` already skips `/api/*`.
- [x] Security rules (§12): token and app secret only in `env`/container (server-only); webhook is the only public POST, protected by signature; every page/action/route checks the session itself; logs never print bodies or full numbers.
- [x] Every FR/AC is in the traceability matrix.

## 13. Approval

- [x] Approved by the user on 2026-10-12
