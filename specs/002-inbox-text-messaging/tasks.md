---
id: "002"
title: "Inbox: receive and reply to text messages"
spec: ./spec.md
plan: ./plan.md
status: Done             # Draft | Approved | In Progress | Done
created: 2026-10-12
approved_at: 2026-10-12
---

# Tasks 002 — Inbox: receive and reply to text messages

## How to read this list

- Work top to bottom; a task starts only when everything in `depends_on` is checked.
- `[P]` = can run in parallel with other `[P]` tasks of the same phase (no shared files).
- Each task is small (≈ one commit) and has a **Done when** line that is objectively checkable.
- Tick `- [x]` only when **Done when** is satisfied. Write deviations under the task as `> Note:`.
- Paths: `webhooks/` = `src/modules/webhooks/`, `conversations/` = `src/modules/conversations/`.
- **Why phase 2 is a vertical slice:** AGENTS.md §8 requires webhook parsers built from **real captured payloads**. So webhook intake (verify + signature + store raw) ships first, the user captures fixtures with the real test number (T010), and the parsers come later (phase 5).
- Test budget (AGENTS.md §13): per task run only the tests/lint of the files it changed (`tsc --noEmit` when types changed). Full suites only at the 2 checkpoints: **T033b** (backend done) and **T047** (end).
- Small same-phase tasks may be implemented in one agent batch (e.g. T003–T004, T012–T017, T021–T024, T028–T032); each task is still ticked on its own.

## Phase 1 — Setup

- [x] **T001** — Install TanStack Query
  - **Layer:** setup
  - **Files:** `package.json`, `pnpm-lock.yaml`
  - **Depends on:** —
  - **Covers:** plan §7
  - **Done when:** `@tanstack/react-query` 5.x is a dependency; `pnpm exec tsc --noEmit` passes
  > Note: 2026-10-13: typecheck ✅, lint ✅, unit 50 files / 333 tests ✅, integration 8 files / 75 tests ✅.

- [x] **T002** — Database schema and migration for the inbox
  - **Layer:** setup (schema)
  - **Files:** `src/shared/db/schema/webhook-events.ts`, `contacts.ts`, `conversations.ts`, `messages.ts`, `src/shared/db/schema/index.ts`, `drizzle/0002_inbox_text_messaging.sql` (+ `drizzle/meta/*`, generated)
  - **Depends on:** —
  - **Covers:** plan §6, BR-002, BR-005, BR-006, BR-007, FR-003
  - **Done when:** the generated SQL has `contact.wa_id` UNIQUE, `conversation.contact_id` UNIQUE, `message.wa_message_id` UNIQUE, `message.sent_by_user_id → user.id ON DELETE SET NULL`, the two indexes from plan §6, and every timestamp is `timestamptz`; `pnpm db:migrate` succeeds on the dev DB; `pnpm exec tsc --noEmit` passes
  > Note: indexes use `.desc().nullsFirst()` so they match Postgres' default `ORDER BY … DESC` (all indexed columns are NOT NULL, so results are the same). Status/direction/failure-reason unions are defined locally in `schema/messages.ts`. `@tanstack/react-query` ^5.104.2.

## Phase 2 — Webhook intake (vertical slice, to capture real payloads)

- [x] **T003** [P] — Webhook signature rule
  - **Layer:** domain
  - **Files:** `webhooks/domain/webhook-signature.ts`, `webhooks/domain/webhook-signature.test.ts`
  - **Depends on:** —
  - **Covers:** FR-002, AC-1.3
  - **Done when:** tests for valid, invalid, missing header, missing `sha256=` prefix and different-length signature pass (uses `timingSafeEqual`)

- [x] **T004** [P] — Webhook verification rule and webhook errors
  - **Layer:** domain
  - **Files:** `webhooks/domain/webhook-verification.ts`, `webhooks/domain/webhook-verification.test.ts`, `webhooks/domain/errors.ts` (`InvalidWebhookSignatureError`, `WebhookVerificationFailedError`)
  - **Depends on:** —
  - **Covers:** FR-001, AC-1.1, AC-1.2
  - **Done when:** tests pass: correct mode + token returns the challenge; wrong token, wrong mode, missing challenge return `null`

- [x] **T005** — `verifyWebhookSubscription` use case
  - **Layer:** application
  - **Files:** `webhooks/application/verify-webhook-subscription.ts`, `webhooks/application/verify-webhook-subscription.test.ts`
  - **Depends on:** T004
  - **Covers:** FR-001, AC-1.1, AC-1.2
  - **Done when:** tests pass: returns the challenge, or throws `WebhookVerificationFailedError`

- [x] **T006** — Webhook event port, change-handler type and `processWebhookPayload`
  - **Layer:** domain + application
  - **Files:** `webhooks/domain/webhook-event-repository.ts`, `webhooks/domain/webhook-change-handler.ts`, `webhooks/application/process-webhook-payload.ts`, `webhooks/application/process-webhook-payload.test.ts`, `webhooks/application/testing/in-memory-webhook-event-repository.ts`
  - **Depends on:** T004
  - **Covers:** FR-003, plan §5.3 O
  - **Done when:** tests pass: each change is dispatched to `handlersByField[field]`; an unknown field (e.g. `message_template_status_update`) is skipped; a payload that is not a Meta envelope throws. Envelope parsing here uses a minimal schema (`object`, `entry[].changes[].{field,value}`) that T025 moves into `meta-webhook-payload.ts`

- [x] **T007** — `receiveWebhook` use case
  - **Layer:** application
  - **Files:** `webhooks/application/receive-webhook.ts`, `webhooks/application/receive-webhook.test.ts`
  - **Depends on:** T003, T006
  - **Covers:** FR-002, FR-003, FR-004, AC-1.3, AC-1.4
  - **Done when:** tests pass: invalid/missing signature → row saved with `signatureValid: false`, processor NOT called, `InvalidWebhookSignatureError` thrown; valid → saved, processed, `markProcessed`; processor throws → `markFailed` with the error and the use case does NOT throw; invalid JSON with a valid signature → `markFailed`, no throw

- [x] **T008** — Drizzle webhook event repository
  - **Layer:** infrastructure
  - **Files:** `webhooks/infrastructure/drizzle-webhook-event-repository.ts`, `webhooks/infrastructure/drizzle-webhook-event-repository.integration.test.ts`
  - **Depends on:** T002, T006
  - **Covers:** FR-003
  - **Done when:** the integration test (save → markProcessed; save → markFailed keeps `processed_at` null and stores the error) passes with `pnpm exec vitest run -c vitest.integration.config.mts <that file>`

- [x] **T009** — Webhook route and container wiring
  - **Layer:** app
  - **Files:** `src/app/api/webhooks/whatsapp/route.ts`, `src/server/container.ts`, `src/shared/http/json-error-response.ts` (rows `INVALID_WEBHOOK_SIGNATURE: 401`, `WEBHOOK_VERIFICATION_FAILED: 403`)
  - **Depends on:** T005, T007, T008
  - **Covers:** FR-001–FR-004, AC-1.1–AC-1.4
  - **Done when:** with `pnpm dev`: `curl "localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=123"` → 200 `123` (wrong token → 403); unsigned `POST` → 401 and a row with `signature_valid = false`; `json-error-response.test.ts` passes. POST reads `await request.text()` first and calls `await connection()`. The handler map is empty for now (`messages` arrives in T033)

- [x] **T010** — 👤 **User:** connect Meta and capture real webhook fixtures
  - **Layer:** manual (needs the user: Meta dashboard + phone in the allowed list)
  - **Files:** `tests/fixtures/webhooks/text-message.json`, `image-message.json`, `reaction-message.json`, `status-sent.json`, `status-delivered.json`, `status-read.json`, `status-failed.json` (+ `unsupported-message.json` if one can be produced)
  - **Depends on:** T009
  - **Covers:** AC-1.1, AGENTS.md §8 (fixtures from real payloads)
  - **Done when:** `cloudflared tunnel --url http://localhost:3000` is running; the Meta dashboard shows the callback URL as verified; the user sends a text, an image and a reaction from their phone, and sends the `hello_world` template to themselves from the Meta dashboard (gives sent/delivered/read statuses); the rows' `raw_body` are copied into the files above with phone numbers, names and wamids replaced by fake values. If a `failed` or `unsupported` payload cannot be produced, it is built from the official doc example and marked with a `> Note:`
  > Note: webhook verified by Meta. Real deliveries started only after linking the WABA to the app (`POST /{WABA_ID}/subscribed_apps`); add this to the setup docs. Captured for real: `text-message`, `image-message`, `reaction-message`, all with fake numbers, names and ids. Real payloads also carry `contacts[].user_id` and `messages[].from_user_id` (Meta's business-scoped user id). `status-*` and `unsupported-message` are built from the documented shapes (Meta status/unsupported references, checked 2026-10-12) because none arrived. Replace them with real ones during T050 if possible. The verify token was rotated after it showed up in a log.

## Phase 3 — Conversations domain (tests first)

- [x] **T011** — Conversation domain types and read models
  - **Layer:** domain
  - **Files:** `conversations/domain/contact.ts`, `conversation.ts`, `message.ts`, `inbox-views.ts`, `inbound-message-input.ts`, `message-status-report.ts`
  - **Depends on:** —
  - **Covers:** spec §8, FR-014
  - **Done when:** `pnpm exec tsc --noEmit` passes; every exported type has a short JSDoc

- [x] **T012** [P] — 24h customer service window rule
  - **Layer:** domain
  - **Files:** `conversations/domain/customer-service-window.ts`, `customer-service-window.test.ts`
  - **Depends on:** T011
  - **Covers:** BR-001, FR-015, FR-018, AC-5.2, AC-5.6
  - **Done when:** tests pass: 23h59m open; exactly 24h closed; `null` closed; `customerServiceWindowClosesAt` = last inbound + 24h

- [x] **T013** [P] — Monotonic delivery status rule
  - **Layer:** domain
  - **Files:** `conversations/domain/delivery-status.ts`, `delivery-status.test.ts`
  - **Depends on:** T011
  - **Covers:** BR-003, AC-6.2, AC-6.3
  - **Done when:** tests pass: forward moves; `read` then `delivered` stays `read`; `failed` is final; `played` → `read`; same status → unchanged

- [x] **T014** [P] — Reply text rule and conversation errors
  - **Layer:** domain
  - **Files:** `conversations/domain/reply-text.ts`, `reply-text.test.ts`, `conversations/domain/errors.ts` (all five errors of plan §3.1)
  - **Depends on:** T011
  - **Covers:** BR-004, FR-016, AC-5.4
  - **Done when:** tests pass: empty and whitespace-only rejected; text trimmed; 4096 characters accepted; 4097 rejected with `ReplyTextTooLongError`

- [x] **T015** [P] — Delivery failure reason mapping
  - **Layer:** domain
  - **Files:** `conversations/domain/delivery-failure-reason.ts`, `delivery-failure-reason.test.ts`
  - **Depends on:** T011
  - **Covers:** AC-5.5, spec §12
  - **Done when:** tests pass for 131047, 131030, 131026, 131056, 130429, 190, an unknown code and `null`

- [x] **T016** [P] — Search text normalization
  - **Layer:** domain
  - **Files:** `conversations/domain/search-text.ts`, `search-text.test.ts`
  - **Depends on:** T011
  - **Covers:** FR-012, AC-3.2
  - **Done when:** tests pass: "José" ≡ "jose", case-insensitive, trimmed; `extractDigits("+57 300-123")` = `"57300123"`

- [x] **T017** [P] — Conversation activity ordering rule
  - **Layer:** domain
  - **Files:** `conversations/domain/conversation-activity.ts`, `conversation-activity.test.ts`
  - **Depends on:** T011
  - **Covers:** AC-3.1, BR-007
  - **Done when:** tests pass: a newer message replaces the latest activity; an older (late-arriving) one does not

- [x] **T018** — Conversation ports (interfaces)
  - **Layer:** domain
  - **Files:** `conversations/domain/contact-repository.ts`, `conversation-repository.ts`, `message-repository.ts`, `conversation-transaction-runner.ts`, `inbox-queries.ts`, `message-sender.ts`, `inbox-event-publisher.ts`
  - **Depends on:** T011, T014
  - **Covers:** plan §3.1 (D, I)
  - **Done when:** `pnpm exec tsc --noEmit` passes; each interface has a JSDoc saying what it is for and which errors it throws
  > Note: `MESSAGE_PAGE_SIZE = 50` lives in `inbox-queries.ts`. `upsertByWaId` never erases a stored name with `null`. `sendTextReply` input also carries `senderName` (plan §4 only listed `senderUserId`) so it can return a `ThreadMessage`. Ports return `null` for missing rows; use cases throw `ConversationNotFoundError`.

## Phase 4 — Conversations application (use cases with fakes)

- [x] **T019** — Test fakes for the conversations module
  - **Layer:** application (testing)
  - **Files:** `conversations/application/testing/in-memory-conversation-store.ts`, `in-memory-conversation-store.test.ts`, `fake-message-sender.ts`, `recording-inbox-event-publisher.ts`
  - **Depends on:** T018
  - **Covers:** plan §4 (L)
  - **Done when:** the contract test passes: contact upsert by `waId`, one conversation per contact, duplicate `waMessageId` insert reports "not inserted", a transaction that throws leaves no changes

- [x] **T020** — `recordInboundMessage` use case
  - **Layer:** application
  - **Files:** `conversations/application/record-inbound-message.ts`, `record-inbound-message.test.ts`
  - **Depends on:** T016, T017, T019
  - **Covers:** FR-005, FR-006, FR-007, FR-010, BR-002, AC-2.1, AC-2.2, AC-2.3, AC-2.5
  - **Done when:** tests pass: first message creates contact + conversation with unread 1 and `lastInboundAt`; second message reuses them, unread 2; new profile name updates the name; same `waMessageId` twice → unread stays 1 and only one event published; an older late message does not replace the preview; one `conversation_updated` event per new message

- [x] **T021** [P] — `applyMessageStatus` use case
  - **Layer:** application
  - **Files:** `conversations/application/apply-message-status.ts`, `apply-message-status.test.ts`
  - **Depends on:** T013, T015, T019
  - **Covers:** FR-019, BR-003, AC-6.1, AC-6.2, AC-6.3
  - **Done when:** tests pass: sent → delivered → read; read then delivered stays read; failed stores the reason and later reports change nothing; unknown wamid is ignored with no event; no event when nothing changed

- [x] **T022** [P] — `sendTextReply` use case
  - **Layer:** application
  - **Files:** `conversations/application/send-text-reply.ts`, `send-text-reply.test.ts`
  - **Depends on:** T012, T014, T015, T019
  - **Covers:** FR-015, FR-016, FR-017, BR-001, BR-004, AC-5.1, AC-5.3, AC-5.4, AC-5.5
  - **Done when:** tests pass with a fixed `now`: happy path stores `queued` then `sent` with the wamid and the sender's user id, two events; window closed → `OutsideCustomerServiceWindowError` and the fake sender was NOT called; empty / too long → errors, nothing stored; sender throws with 131030 / 131047 / 190 → message `failed` with the matching reason (returned, not thrown); unknown conversation → `ConversationNotFoundError`
  > Note: added `ContactRepository.findById` (port + in-memory fake + contract test) to get the customer's `wa_id` inside the transaction; the Drizzle contact repository (T030) implements it. Any sender error becomes `failed` (`unknown` unless it is a `MessageSendFailedError`).

- [x] **T023** [P] — `markConversationRead` use case
  - **Layer:** application
  - **Files:** `conversations/application/mark-conversation-read.ts`, `mark-conversation-read.test.ts`
  - **Depends on:** T019
  - **Covers:** FR-010, AC-3.3
  - **Done when:** tests pass: unread > 0 → 0 + one event; already 0 → no write, no event; unknown id → `ConversationNotFoundError`

- [x] **T024** [P] — Read use cases
  - **Layer:** application
  - **Files:** `conversations/application/list-conversations.ts`, `get-conversation.ts`, `get-conversation.test.ts`, `list-conversation-messages.ts`
  - **Depends on:** T018
  - **Covers:** FR-011, FR-013, AC-4.4
  - **Done when:** `get-conversation.test.ts` passes (missing id → `ConversationNotFoundError`); `pnpm exec tsc --noEmit` passes

## Phase 5 — Webhook parsing (from the real fixtures)

- [x] **T025** — Meta webhook payload schemas
  - **Layer:** domain
  - **Files:** `webhooks/domain/meta-webhook-payload.ts`, `meta-webhook-payload.test.ts`, `webhooks/application/process-webhook-payload.ts` (use the envelope schema from here)
  - **Depends on:** T006, T010
  - **Covers:** FR-007, FR-019
  - **Done when:** every fixture in `tests/fixtures/webhooks/` parses; a `messages` value without `metadata.phone_number_id` is rejected; `process-webhook-payload.test.ts` still passes

- [x] **T026** — Inbound message content registry
  - **Layer:** domain
  - **Files:** `webhooks/domain/inbound-message-content.ts`, `inbound-message-content.test.ts`
  - **Depends on:** T025
  - **Covers:** FR-007, FR-008, AC-2.4
  - **Done when:** tests pass: text fixture → its body; image and reaction fixtures → `{ type, text: null }`; an unknown type → `{ type: <that type>, text: null }`

- [x] **T027** — `handleMessagesChange` handler
  - **Layer:** application
  - **Files:** `webhooks/application/handle-messages-change.ts`, `handle-messages-change.test.ts`
  - **Depends on:** T020, T021, T026
  - **Covers:** FR-007, FR-008, FR-009, FR-019, AC-2.4, AC-2.6
  - **Done when:** tests with spies pass: the text fixture calls `recordInboundMessage` with wa_id, profile name, text and the `timestamp` as a Date; the image fixture calls it with `text: null`; status fixtures call `applyMessageStatus` (failed carries the error code); a payload for another `phone_number_id` calls nothing

## Phase 6 — Infrastructure

- [x] **T028** [P] — Graph API client
  - **Layer:** infrastructure (shared)
  - **Files:** `src/shared/whatsapp/graph-client.ts`, `src/shared/whatsapp/graph-api-error.ts`, `src/shared/whatsapp/graph-client.test.ts`
  - **Depends on:** —
  - **Covers:** AGENTS.md §8.1, §8.12
  - **Done when:** tests with a mocked `fetch` pass: URL contains the configured version, `Authorization: Bearer`, JSON body; 429/500 retried then success; 400 not retried; Meta error body → `GraphApiError` with `metaErrorCode`; network failure → `GraphApiError(null)`

- [x] **T029** — Meta message sender
  - **Layer:** infrastructure
  - **Files:** `conversations/infrastructure/meta-message-sender.ts`, `meta-message-sender.test.ts`
  - **Depends on:** T018, T028
  - **Covers:** FR-017
  - **Done when:** tests pass: request body matches plan §8 (`preview_url: false`, path `/{phone-number-id}/messages`); `messages[0].id` returned as `waMessageId`; `GraphApiError(131030)` → `MessageSendFailedError(131030)`

- [x] **T030** [P] — Drizzle conversation repositories and transaction runner
  - **Layer:** infrastructure
  - **Files:** `conversations/infrastructure/drizzle-contact-repository.ts`, `drizzle-conversation-repository.ts`, `drizzle-message-repository.ts`, `drizzle-conversation-transaction-runner.ts`, `drizzle-conversation-repositories.integration.test.ts`
  - **Depends on:** T002, T018
  - **Covers:** FR-005, FR-006, FR-007, BR-002
  - **Done when:** integration tests pass: contact upsert updates name + search name; one conversation per contact; duplicate `wa_message_id` insert returns "not inserted" (`ON CONFLICT DO NOTHING`); outbound status/wamid update; a throwing transaction rolls everything back

- [x] **T031** [P] — Drizzle inbox queries
  - **Layer:** infrastructure
  - **Files:** `conversations/infrastructure/drizzle-inbox-queries.ts`, `drizzle-inbox-queries.integration.test.ts`
  - **Depends on:** T002, T016, T018
  - **Covers:** FR-011, FR-012, FR-013, FR-014, AC-3.1, AC-3.2, AC-4.1, AC-4.2
  - **Done when:** integration tests pass: newest activity first; search "jose" finds "José", "300 123" and "+57300" find by number, `%` is matched literally; 120 messages → page of 50 newest in chronological order with `hasOlder: true`, next pages via `before`, last page `hasOlder: false`; outbound rows include the sender's name

- [x] **T032** [P] — Realtime NOTIFY/LISTEN and the inbox event publisher
  - **Layer:** infrastructure
  - **Files:** `src/shared/realtime/notify.ts`, `src/shared/realtime/subscribe-to-channel.ts`, `src/shared/realtime/inbox-events-channel.ts`, `conversations/infrastructure/postgres-inbox-event-publisher.ts`, `src/shared/realtime/realtime.integration.test.ts`
  - **Depends on:** T018
  - **Covers:** FR-020
  - **Done when:** the integration test passes: a subscriber receives the JSON published by `PostgresInboxEventPublisher`; after `unsubscribe()` the pg client is closed and no more events arrive

- [x] **T033** — Wire the conversations module in the container
  - **Layer:** composition root
  - **Files:** `src/server/container.ts`, `src/shared/http/json-error-response.ts` (rows from plan §7)
  - **Depends on:** T022, T023, T024, T027, T029, T030, T031, T032
  - **Covers:** plan §5 composition root, FR-020
  - **Done when:** `pnpm exec tsc --noEmit` passes; `json-error-response.test.ts` passes; with the tunnel running, a WhatsApp text from the user's phone creates `contact`, `conversation` and `message` rows and its `webhook_event` row has `processed_at` set
  > Note: every conversations use case, `subscribeToInboxEvents` and the error rows are wired (`MessageSendFailedError` has no row on purpose; it never reaches HTTP). Part 2: `messages` handler registered in the container after T027. Real-phone check done 2026-10-12: texts from the user's phone created contact, conversation and message rows; their `webhook_event` rows have `processed_at` set.

- [x] **T033b** — Checkpoint 1: full checks (backend done)
  - **Depends on:** T033
  - **Done when:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration` pass (no `pnpm build` yet; failures fixed and only the failing command re-run)

## Phase 7 — Routes, Server Actions & UI

UI tasks follow plan §7b (Design) and the `frontend-design` skill: no default/templated look, responsive to 360 px, visible focus, accessible contrast, Spanish copy from spec §10/§12.

- [x] **T034** — Conversations REST routes
  - **Layer:** app
  - **Files:** `src/app/api/conversations/route.ts`, `src/app/api/conversations/[id]/route.ts`, `src/app/api/conversations/[id]/messages/route.ts`
  - **Depends on:** T033
  - **Covers:** FR-011, FR-012, FR-013, FR-021, AC-4.4
  - **Done when:** each route calls `await connection()` and `requireCurrentUser` and has a header doc comment like `api/users/route.ts`; logged-out `curl` → 401 JSON; in a signed-in browser `/api/conversations` returns the list, an unknown or non-UUID id returns 404 `CONVERSATION_NOT_FOUND`
  > Note: added helpers `api/conversations/conversation-json.ts` and `[id]/conversation-id-params.ts`. Invalid `search`/`before` → 422 `VALIDATION_ERROR`. `/messages` for an unknown UUID returns an empty page (the 404 comes from `GET /[id]`). Logged-out → 401 verified on all routes; signed-in checks in T046.

- [x] **T035** — Realtime SSE route
  - **Layer:** app
  - **Files:** `src/app/api/realtime/route.ts`
  - **Depends on:** T033
  - **Covers:** FR-020, FR-021, AC-7.1
  - **Done when:** logged-out → 401; in a signed-in browser tab, opening `/api/realtime` shows `: ping` lines every ~25 s and a `data: {"type":"conversation_updated",…}` line when a WhatsApp message arrives; closing the tab ends the subscription (no growth in `pg_stat_activity` LISTEN connections after closing)
  > Note: logged-out → 401 verified. The signed-in checks (ping every 25 s, `data:` line on a new message, LISTEN connections released after closing the tab) need a session and move to T046 with the user.

- [x] **T036** — Inbox Server Actions
  - **Layer:** app
  - **Files:** `src/app/(app)/inbox/actions.ts`, `conversations/ui/inbox-actions.ts` (prop types)
  - **Depends on:** T033
  - **Covers:** FR-010, FR-015, FR-016, FR-017, FR-021
  - **Done when:** both actions call `requireSignedInUser` first and validate input with Zod; `sendReplyAction` returns `{ ok: true, message }` or `{ ok: false, error: <code> }` for the domain errors; `tsc --noEmit` and `eslint` on the changed files pass

- [x] **T037** [P] — `PageContainer`: let pages choose their width
  - **Layer:** ui (shared)
  - **Files:** `src/components/page-container.tsx`, `src/components/app-shell/app-shell.tsx`, `src/app/(app)/account/page.tsx`, `src/app/(app)/users/page.tsx`, `src/app/(app)/contacts/page.tsx`, `src/app/(app)/templates/page.tsx`, `TODO.md` (delete the "duplicate 1100px wrapper" part)
  - **Depends on:** —
  - **Covers:** plan §7, §7b
  - **Done when:** Mi cuenta, Usuarios, Contactos and Plantillas look exactly as before at 360 px and 1280 px; `AppShell` no longer sets max width/padding; `tsc --noEmit` and `eslint` on the changed files pass
  > Note: the old `inbox/page.tsx` placeholder was also wrapped in `PageContainer` until T046 replaces it. Class lists checked: identical for every page except the removed duplicate `max-w-[1100px]` in Usuarios (it never applied).

- [x] **T038** [P] — Inbox design tokens
  - **Layer:** ui
  - **Files:** `src/app/globals.css`
  - **Depends on:** —
  - **Covers:** plan §7b
  - **Done when:** `--bubble-team`, `--bubble-customer`, `--window-closing` exist in `:root` and as Tailwind colours in `@theme inline`, with name comments matching plan §7b; a `bg-bubble-team` element renders Mint wash in `pnpm dev`
  > Note: visual check of `bg-bubble-team` moves to T042 (first bubble). No `--window-closing-surface`: the closing pill reuses `bg-status-pending`.

- [x] **T039** [P] — Inbox copy and labels
  - **Layer:** ui
  - **Files:** `conversations/ui/messages.ts`, `conversations/ui/failure-reason-messages.ts`, `conversations/ui/message-content-label.ts`
  - **Depends on:** T011, T015
  - **Covers:** FR-008, AC-2.4, AC-5.2, AC-5.5, spec §10, §12
  - **Done when:** every Spanish text of spec §10 and §12 is in these files, word for word; each failure reason has a message (`Record<DeliveryFailureReason, string>` so a missing one fails typecheck); `pnpm exec tsc --noEmit` passes
  > Note: also added `formatCharacterCounter` and `REPLY_ERROR_MESSAGES` (server error code → same Spanish text) for T044.

- [x] **T040** — Query provider and inbox data hooks
  - **Layer:** ui
  - **Files:** `src/components/query-client-provider.tsx`, `conversations/ui/inbox-queries.ts`
  - **Depends on:** T001, T034
  - **Covers:** FR-011, FR-013
  - **Done when:** `useConversations(search)`, `useConversation(id)` and `useConversationMessages(id)` (infinite, `before` cursor) are typed against the route JSON; `tsc --noEmit` and `eslint` on the changed files pass

- [x] **T041** — Conversation list pane
  - **Layer:** ui
  - **Files:** `conversations/ui/conversation-list.tsx`, `conversation-list-item.tsx`, `conversation-search.tsx`
  - **Depends on:** T038, T039, T040
  - **Covers:** FR-011, FR-012, AC-2.1, AC-2.2, AC-3.1, AC-3.2
  - **Done when:** in the browser (data from the real number or rows inserted in Adminer): rows show initials, name, number, preview (placeholder text for non-text), time and unread badge, newest first; rows are links; search filters by accented name and partial number and is kept in `?q=`; empty, no-results, loading (placeholder rows) and error + "Reintentar" states match spec §10
  > Note: written and type/lint-clean; the browser check of every state moves to T046 (the page that mounts it). The 340 px width, divider and the "Bandeja" h1 are set by the inbox screen (T046).

- [x] **T042** — Message bubble and delivery status mark
  - **Layer:** ui
  - **Files:** `conversations/ui/message-bubble.tsx`, `conversations/ui/delivery-status-mark.tsx`
  - **Depends on:** T038, T039
  - **Covers:** FR-014, AC-4.3, AC-2.4, AC-5.5, AC-6.1
  - **Done when:** customer bubbles left (Paper + hairline), team bubbles right (Mint wash) with user name, time and status mark (icon + text); unsupported = dashed Slate italic placeholder; "No enviado" in Signal with the reason; `tsc --noEmit` and `eslint` on the changed files pass
  > Note: spacing between bubbles (4px grouped / 12px on change of side) is done by the thread (T043). Tail radius is `[4px]` (the `sm` token is 4.8px). Visual check (incl. `bg-bubble-team`) happens in T043/T046. `sentAt` must be a `Date` (revive it from JSON in T040).

- [x] **T043** — Conversation thread with header, window meter and "Cargar anteriores"
  - **Layer:** ui
  - **Files:** `conversations/ui/conversation-thread.tsx`, `thread-header.tsx`, `load-older-button.tsx`, `use-window-countdown.ts`
  - **Depends on:** T012, T040, T042
  - **Covers:** FR-013, FR-018, AC-4.1, AC-4.2, AC-4.4, AC-5.6
  - **Done when:** in the browser: opens scrolled to the newest message; "Cargar anteriores" prepends without moving the visible message and disappears on the last page; header shows the window pill ("Ventana abierta · cierra en N h" / closed) and the 2 px meter (Amber in the last 2 h); unknown id shows "Esta conversación no existe"; loading and error + "Reintentar" states as in spec §10; thread has `aria-live="polite"`
  > Note: code done and type/lint-clean; the browser check of states, scroll and the meter moves to T046. `thread-header.tsx` also exports `BackToListLink`.

- [x] **T044** — Reply composer with optimistic sending
  - **Layer:** ui
  - **Files:** `conversations/ui/reply-composer.tsx`
  - **Depends on:** T036, T039, T043
  - **Covers:** FR-015, FR-016, FR-017, FR-018, AC-5.1, AC-5.2, AC-5.3, AC-5.4, AC-5.5
  - **Done when:** in the browser: Enter sends, Shift+Enter adds a line; "Enviar" disabled when empty; counter appears from 3,900 characters and blocks over 4096; a sent text appears at once as "Enviando" then "Enviado"; outside the window the composer is disabled with the 24h reason; a server error (window closed meanwhile) shows that reason

- [x] **T045** — Live updates hook
  - **Layer:** ui
  - **Files:** `conversations/ui/use-inbox-live-updates.ts`
  - **Depends on:** T035, T040
  - **Covers:** FR-020, AC-7.1, AC-7.2
  - **Done when:** `tsc --noEmit` and `eslint` on the changed files pass; behavior verified in T046 (events invalidate the matching queries; reconnect invalidates all; "Reconectando…" after 5 s disconnected; closed stream recreated every 5 s)

- [x] **T046** — Inbox screen and page
  - **Layer:** ui + app
  - **Files:** `conversations/ui/inbox-screen.tsx`, `src/app/(app)/inbox/[[...conversationId]]/page.tsx`, delete `src/app/(app)/inbox/page.tsx`
  - **Depends on:** T037, T041, T043, T044, T045
  - **Covers:** FR-010, FR-020, FR-021, AC-3.3, AC-3.4, AC-4.4, AC-7.1, AC-7.2
  - **Done when:** the page calls `requireSignedInUser` inside `<Suspense>`; desktop shows list + thread (or "Selecciona una conversación para verla."); mobile shows list at `/inbox` and thread with "Volver" at `/inbox/<id>`; opening a conversation sets unread 0 in a second browser live; a new message in the open conversation keeps it at 0; with two browsers (admin + agent) a message from the phone appears in both within ~5 s; after toggling the network off/on, "Reconectando…" shows and the inbox catches up
  > Note: verified by the user 2026-10-12 (two browsers admin + agent live; "Reconectando…" shown with the dev server stopped ~20 s). Fixes found during the manual test: the sender saw its reply twice while "Enviando" (`removeSavedPendingReplies`); shadcn components used the unconfigured `cn` package, which dropped `text-primary-foreground` next to `text-body` (black text on the Send button); "Leído" moved to Receipt blue (plan §7b, user's choice); duplicate React key between the message list and the composer. The dev reload loop was a stale `.next` Turbopack cache, not app code.

- [x] **T046b** — Fix: keep the inbox data cache across conversation clicks
  - **Layer:** ui + app
  - **Files:** `src/app/(app)/inbox/layout.tsx` (new), `src/app/(app)/inbox/[[...conversationId]]/page.tsx`, `conversations/ui/inbox-screen.tsx`
  - **Depends on:** T046
  - **Covers:** FR-020, AC-7.1 (smooth live inbox); approved by the user 2026-10-12
  - **Done when:** `AppQueryClientProvider` lives in the inbox layout so going from `/inbox/A` to `/inbox/B` keeps the list cache and the single live connection (no placeholder rows flash, no SSE reconnect); the page still calls `requireSignedInUser` itself; `pnpm typecheck` and eslint on the changed files pass; logged-out `/inbox` and `/inbox/<uuid>` still redirect to login
  > Note: the whole `InboxScreen` (not only the provider) moved into the inbox layout. Otherwise the page's Suspense skeleton would still flash on every click. The screen reads the id with `useParams()`. The page only runs `requireSignedInUser` and renders nothing. The `(app)` layout guard still renders children only after the session check. Browser check (no placeholder flash, one `/api/realtime` request) happens with T046.

## Phase 8 — Verification

- [x] **T047** — Checkpoint 2: full checks (the only final run)
  - **Done when:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm build` pass; results are passed to the reviewer in T049 (it does not re-run them)
  > Note: 2026-10-12 — `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm test` ✓ (51 files, 337 tests), `pnpm test:integration` ✓ (8 files, 75 tests), `pnpm build` ✓. Re-run 2026-10-13 after the T048/T049 fixes: all ✓ (unit 52 files / 345 tests, integration 8 / 75, build ✓).

- [x] **T048** — UI guidelines review
  - **Done when:** the `web-design-guidelines` skill was run on the changed UI files (`conversations/ui/*`, `src/components/page-container.tsx`, `query-client-provider.tsx`, `app-shell.tsx`, inbox page, `globals.css`); real issues fixed, the rest added to `TODO.md`
  > Note: 2026-10-13 — fixed: "Cargar anteriores" keeps focus while loading (`aria-disabled`) and hands focus to the thread when it disappears; the message scroller is a focusable labelled region; sr-only "Cliente:" / "Equipo:" before each bubble; `aria-describedby` on the reply box includes the send error and the too-long message; long URLs wrap (`wrap-anywhere`); visible offset focus ring on "Enviar". The rest is one line in `TODO.md` (Tech debt).

- [x] **T049** — Review
  - **Done when:** `sdd-reviewer` reports no blocking findings (or they are fixed); production-hardening findings, including "status updates are read → compute → write (race between two status webhooks)" from plan §11, are in `TODO.md` under "Production hardening"
  > Note: 2026-10-13 — verdict APPROVE (21/21 FR, 28/29 AC; the missing one is the unverifiable 131030 case of T050). Minor findings fixed: pending bubble also cancelled by a saved reply already "Enviado"; `toThreadMessage` comment/visibility; typed `WebhookEventNotFoundError`; tests for `describeMessageContent`; AGENTS.md §3 (WABA `subscribed_apps` step) and §5.2 map. Production-hardening findings are in `TODO.md`. Out-of-task tooling change made at the user's request: `docker-compose.yml` ports bound to 127.0.0.1.

- [x] **T050** — 👤 **User:** manual end-to-end check
  - **Done when:** the user confirms spec §13 (plan §9 steps 1–7) with the WhatsApp test number; the real error code for "recipient not in allowed list" is recorded as a note (and `toDeliveryFailureReason` fixed if it is not 131030); if a payload without `wa_id` appears, it is added to `TODO.md`
  > Note: 2026-10-12 — the user ran the spec §13 flow with the test number (receive, reply, statuses, live updates, reconnect). Not verifiable: the "recipient not in allowed list" error (no second number available), so the `131030` mapping in `toDeliveryFailureReason` stays an unverified assumption (tracked in `TODO.md`). "Leído" was not seen because the user's phone has read receipts off (Meta never sent `read`). Accepted by the user as done with this gap on 2026-10-13.

## Coverage check

| Spec item | Tasks |
|---|---|
| FR-001 | T004, T005, T009, T010 |
| FR-002 | T003, T007, T009 |
| FR-003 | T002, T006, T007, T008, T009 |
| FR-004 | T007, T009 |
| FR-005 | T020, T030 |
| FR-006 | T020, T030 |
| FR-007 | T020, T025, T026, T027, T030 |
| FR-008 | T026, T027, T039, T042 |
| FR-009 | T027 |
| FR-010 | T020, T023, T036, T046 |
| FR-011 | T024, T031, T034, T040, T041 |
| FR-012 | T016, T031, T034, T041 |
| FR-013 | T024, T031, T034, T040, T043 |
| FR-014 | T011, T031, T042 |
| FR-015 | T012, T022, T036, T044 |
| FR-016 | T014, T022, T036, T044 |
| FR-017 | T022, T029, T036, T044 |
| FR-018 | T012, T043, T044 |
| FR-019 | T013, T021, T025, T027 |
| FR-020 | T032, T033, T035, T045, T046 |
| FR-021 | T034, T035, T036, T046 |
| AC-1.1 | T004, T005, T009, T010 |
| AC-1.2 | T004, T005, T009 |
| AC-1.3 | T003, T007, T009 |
| AC-1.4 | T007, T009 |
| AC-2.1 | T020, T041 |
| AC-2.2 | T020, T041 |
| AC-2.3 | T020 |
| AC-2.4 | T026, T027, T039, T042 |
| AC-2.5 | T020, T030 |
| AC-2.6 | T027 |
| AC-3.1 | T017, T031, T041 |
| AC-3.2 | T016, T031, T041 |
| AC-3.3 | T023, T046 |
| AC-3.4 | T046 |
| AC-4.1 | T031, T043 |
| AC-4.2 | T031, T043 |
| AC-4.3 | T042 |
| AC-4.4 | T024, T034, T043, T046 |
| AC-5.1 | T022, T044 |
| AC-5.2 | T012, T039, T044 |
| AC-5.3 | T022, T044 |
| AC-5.4 | T014, T022, T044 |
| AC-5.5 | T015, T022, T039, T042, T044 |
| AC-5.6 | T012, T043 |
| AC-6.1 | T021, T042 |
| AC-6.2 | T013, T021 |
| AC-6.3 | T013, T021 |
| AC-7.1 | T035, T045, T046 |
| AC-7.2 | T045, T046 |
