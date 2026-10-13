---
id: "002"
title: "Inbox: receive and reply to text messages"
status: Done             # Draft | Approved | Done
created: 2026-10-12
approved_at: 2026-10-12
---

# Spec 002 — Inbox: receive and reply to text messages

> A spec describes **WHAT** the system must do and **WHY**. It never says **HOW**.

## 1. Summary

Customers write to the business's WhatsApp number and their messages appear in the CRM's **Bandeja** (inbox) within seconds, grouped into one conversation per customer. Any signed-in team member can open a conversation, read the history and reply with text while WhatsApp's 24-hour customer service window is open. Every reply shows whether it was sent, delivered, read or failed (with the reason). Only text messages are fully supported in this spec; other message types are recorded and shown as "not supported yet".

## 2. Problem & Goal

- **Problem:** today the CRM has no connection to WhatsApp. The team cannot see customer messages or answer them from the CRM, so the product's core purpose is missing.
- **Goal:** a customer can write to the WhatsApp test number and a team member can see the message in the inbox, reply from the CRM, and see the reply's delivery status — all live, without reloading the page.

## 3. Users & Roles

| Role | What they need from this feature |
|---|---|
| Admin | Same as agent: see all conversations, read them and reply. |
| Agent | See all conversations, find one by name or number, read the history, reply with text inside the 24h window, see delivery status. |
| Customer (WhatsApp user, not a CRM user) | Write to the business number and receive the team's replies on WhatsApp. |
| Operator (person who installs the system) | Connect the CRM to the Meta app (webhook URL and verify token in the Meta dashboard). |

Admins and agents have the **same** permissions in this spec.

## 4. Scope

**In scope**
- Receiving WhatsApp webhooks: the verification handshake, checking that each notification really comes from Meta, and keeping a raw copy of every notification.
- Inbound messages: creating the contact (WhatsApp number + profile name) and its conversation on the first message; adding later messages to the same conversation.
- Text messages fully supported; any other type recorded and shown as a placeholder.
- Delivery status updates for messages sent by the CRM (sent, delivered, read, failed).
- Inbox screen: conversation list (search by name or number, unread badge, latest message preview) and conversation thread (latest 50 messages, load older on demand).
- Replying with free text inside the 24h customer service window; showing the reason when sending is not possible or fails.
- Live updates: new messages, status changes and list order update without reloading.

**Out of scope** (explicitly not done now)
- Templates (sending, listing, syncing) — a later spec. Outside the 24h window the composer is disabled.
- Starting a new conversation with a number that has not written first (needs templates).
- Media: downloading or displaying images, audio, video, documents, stickers; sending media.
- Reactions, replies-to-a-message (quoting), editing or deleting messages, interactive messages, location, contacts cards.
- Sending read receipts to WhatsApp (blue ticks for the customer) and the "typing…" indicator.
- Conversation assignment, conversation status (open/closed), tags, notes, editing contacts — the CRM spec.
- Search inside message text; filters other than the search box.
- A screen to view or replay stored webhook notifications.
- Retry button for failed replies (the user can type the message again).
- Multiple WhatsApp business numbers.
- Notifications outside the CRM (sound, browser/desktop notifications, email).

## 5. User Stories & Acceptance Criteria

### US-1 — Connect the CRM to WhatsApp

As the **operator**, I want **Meta to be able to verify and call the CRM's webhook**, so that **customer messages reach the CRM**.

- **AC-1.1** — Given the verify token configured in the CRM, when Meta sends the verification request with mode "subscribe" and that same token, then the CRM answers successfully with Meta's challenge value and Meta shows the webhook as verified.
- **AC-1.2** — Given a verification request with a wrong token or a mode other than "subscribe", when it arrives, then the CRM rejects it and does not echo the challenge.
- **AC-1.3** — Given a notification whose signature does not match the app secret (or has no signature), when it arrives, then the CRM rejects it as unauthorized, processes nothing, and no message appears in the inbox.
- **AC-1.4** — Given a notification with a valid signature, when it arrives, then a raw copy is kept with the time received, and the CRM answers successfully even if processing it later fails.

### US-2 — Receive customer messages

As an **agent**, I want **customer messages to appear in the inbox**, so that **I can answer them**.

- **AC-2.1** — Given a number that has never written before, when the customer sends a text message, then a new conversation appears at the top of the list showing the customer's WhatsApp profile name, their number, the message preview and an unread badge of 1.
- **AC-2.2** — Given an existing conversation, when the customer sends another text, then it is added to the same conversation (no second conversation for the same number), the conversation moves to the top and its unread count increases by 1.
- **AC-2.3** — Given the customer changed their WhatsApp profile name, when their next message arrives, then the conversation shows the new name.
- **AC-2.4** — Given a customer sends a non-text message (image, audio, sticker, location, reaction, unknown type…), when it arrives, then the thread shows a placeholder "Mensaje de tipo <tipo> no soportado aún" in the right position, and the list preview shows the same text.
- **AC-2.5** — Given Meta delivers the same message notification twice, when both are processed, then the message appears only once and the unread count increases only once.
- **AC-2.6** — Given a valid notification from Meta for a different business phone number, when it arrives, then it is kept raw but nothing appears in the inbox.

### US-3 — Browse and find conversations

As an **agent**, I want **to see all conversations and find one quickly**, so that **I can attend to customers in order**.

- **AC-3.1** — Given several conversations, when I open the inbox, then they are listed newest activity first (latest inbound or outbound message), each with name, number, preview of the latest message, its time and the unread badge if > 0.
- **AC-3.2** — Given I type part of a name or of a number in the search box, when the list updates, then only conversations whose contact name or number contains that text (ignoring case and accents in names; ignoring spaces, "+" and dashes in numbers) are shown.
- **AC-3.3** — Given a conversation with unread messages, when any user opens it, then its unread count becomes 0 for everyone.
- **AC-3.4** — Given a conversation is open, when the customer sends a new message, then it appears in the thread and the conversation stays at 0 unread for that open view.

### US-4 — Read a conversation

As an **agent**, I want **to read the conversation history**, so that **I understand the context before replying**.

- **AC-4.1** — Given a conversation with more than 50 messages, when I open it, then I see the latest 50 in chronological order, scrolled to the newest, and a "Cargar anteriores" control.
- **AC-4.2** — Given I click "Cargar anteriores", when older messages load, then the previous 50 appear above without moving what I was looking at; the control disappears when there are no older messages.
- **AC-4.3** — Given messages in the thread, then customer messages and team messages are visually distinct; each shows its time; team messages also show the sending user's name and a delivery status.
- **AC-4.4** — Given a conversation address (link) that does not exist, when opened, then the inbox shows "Esta conversación no existe" instead of a thread.

### US-5 — Reply with text

As an **agent**, I want **to reply with a text message inside the 24h window**, so that **I can help the customer from the CRM**.

- **AC-5.1** — Given the customer's last message is less than 24 hours old, when I type a text and send it, then the message appears immediately in the thread as "Enviando", and then shows "Enviado" once WhatsApp accepts it, and the customer receives it on WhatsApp.
- **AC-5.2** — Given the customer's last message is 24 hours old or older (or the customer never wrote), when I open the conversation, then the composer is disabled and shows "La ventana de 24 h está cerrada. Solo se pueden enviar plantillas (próximamente)."
- **AC-5.3** — Given the window closes while the conversation is open, when I try to send, then the message is not sent to WhatsApp and I see the same 24h-window reason.
- **AC-5.4** — Given an empty or whitespace-only text, then it cannot be sent. Given a text longer than 4096 characters, then it cannot be sent and the composer shows the limit.
- **AC-5.5** — Given WhatsApp rejects the reply (e.g. recipient not in the test number's allowed list, number cannot receive messages, too many messages, expired access token), when the result comes back, then the message stays in the thread marked "No enviado" with the reason in Spanish (see §12).
- **AC-5.6** — Given the window is open, then the conversation shows how long it remains open (e.g. "Ventana abierta · cierra en 5 h").

### US-6 — See delivery status

As an **agent**, I want **to see whether my replies were delivered and read**, so that **I know the customer got them**.

- **AC-6.1** — Given a sent reply, when WhatsApp reports it delivered and later read, then its status changes to "Entregado" and then "Leído" without reloading.
- **AC-6.2** — Given status reports arrive out of order (e.g. "read" before "delivered"), when both are processed, then the status ends as "Leído" and never goes back.
- **AC-6.3** — Given WhatsApp reports a reply as failed after it was sent, when the report arrives, then the reply shows "No enviado" with the reason; later reports for that message do not change it.

### US-7 — Live updates

As an **agent**, I want **the inbox to update by itself**, so that **I don't miss messages or have to reload**.

- **AC-7.1** — Given two users have the inbox open, when a customer message arrives or one user sends a reply, then both users see it in the list and (if open) in the thread within a few seconds, without reloading.
- **AC-7.2** — Given the live connection drops (e.g. network change), when it comes back, then the inbox catches up with anything that happened in between, without reloading.

## 6. Functional Requirements

| ID | Requirement | From story |
|---|---|---|
| FR-001 | The system must answer Meta's webhook verification request with the challenge only when mode is "subscribe" and the verify token matches; otherwise reject it. | US-1 |
| FR-002 | The system must reject webhook notifications whose signature is missing or does not match the app secret, without processing them. | US-1 |
| FR-003 | The system must keep a raw copy of every validly signed notification (content, time received) before processing it, and record whether processing succeeded or the error if it failed. | US-1 |
| FR-004 | The system must answer successfully to Meta for every validly signed notification, even when processing fails. | US-1 |
| FR-005 | The system must create a contact (WhatsApp number, profile name) and one conversation for it on the first inbound message from a new number, and reuse them afterwards. | US-2 |
| FR-006 | The system must update the contact's profile name when an inbound message carries a different one. | US-2 |
| FR-007 | The system must store each inbound message once (identified by WhatsApp's message id), with its type, text (for text messages), and WhatsApp's timestamp. | US-2 |
| FR-008 | The system must show non-text inbound messages as a placeholder naming the type. | US-2 |
| FR-009 | The system must ignore (after keeping the raw copy) notifications for a business phone number other than the configured one. | US-2 |
| FR-010 | The system must keep a per-conversation unread count shared by all users: +1 per new inbound message, reset to 0 when any user opens the conversation or has it open when the message arrives. | US-2, US-3 |
| FR-011 | The system must list all conversations to every signed-in user, newest activity first, with name, number, latest message preview and time, and unread count. | US-3 |
| FR-012 | The system must filter the list by a search text matching the contact name (case- and accent-insensitive) or number (ignoring spaces, "+" and dashes). | US-3 |
| FR-013 | The system must show a conversation's latest 50 messages and load older ones in pages of 50 on demand. | US-4 |
| FR-014 | The system must show, for each team message, the sending user's name, the time and the delivery status. | US-4, US-6 |
| FR-015 | The system must send a free-text reply only when the conversation's last inbound message is less than 24 hours old; otherwise refuse with the 24h-window reason without contacting WhatsApp. | US-5 |
| FR-016 | The system must validate a reply text: not empty after trimming, at most 4096 characters. | US-5 |
| FR-017 | The system must record a reply before sending it ("Enviando"), then mark it "Enviado" with WhatsApp's message id, or "No enviado" with a Spanish reason when WhatsApp refuses it. | US-5 |
| FR-018 | The system must show whether the 24h window is open and when it closes, and disable the composer when it is closed. | US-5 |
| FR-019 | The system must apply WhatsApp status reports to the matching sent message following BR-003, ignoring reports for unknown messages. | US-6 |
| FR-020 | The system must push new messages, status changes and unread-count changes to every open inbox within a few seconds, and catch up after a dropped connection. | US-7 |
| FR-021 | Every inbox page and action must require a signed-in, active user (admin or agent), as defined in spec 001. | all |

## 7. Business Rules

| ID | Rule | Source |
|---|---|---|
| BR-001 | Free-form messages can only be sent if the customer's last inbound message is less than 24 hours old. A new inbound message restarts the 24 hours. Outside the window only approved templates may be sent (not in this spec). | Meta — [Send messages / customer service window](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages) |
| BR-002 | A WhatsApp message id is unique: the same inbound message or status report received more than once has the effect of receiving it once. | Meta — webhooks can be delivered more than once ([Set up webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks)) |
| BR-003 | Delivery status only moves forward: Enviando < Enviado < Entregado < Leído. "No enviado" (failed) is final. A report that would move the status backwards is ignored. Meta's "played" (voice messages) is treated as "Leído". | Meta — [Status webhook](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status); AGENTS.md §8.7 |
| BR-004 | A reply text has 1 to 4096 characters after trimming leading/trailing whitespace. | Meta — [Text messages](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages) |
| BR-005 | One business phone number, one conversation per customer number. | Product decision (2026-10-12) |
| BR-006 | Customer numbers are kept as WhatsApp sends them: digits only, international format without "+". | Meta webhook format; AGENTS.md §8.9 |
| BR-007 | Messages in a thread are ordered by their time: WhatsApp's timestamp for customer messages, the moment the reply was created for team messages. | Product decision (2026-10-12) |
| BR-008 | While the CRM uses the WhatsApp test number, replies can only reach numbers in the test number's allowed list (max 5). | Meta test-number limit; AGENTS.md §8.13 |

## 8. Data (conceptual)

| Entity | Key information | Lifecycle / states |
|---|---|---|
| Webhook notification | Raw content as received, time received, whether the signature was valid, processing result (processed time or error) | Received → processed, or received → failed (kept for a later replay) |
| Contact | WhatsApp number, WhatsApp profile name, first seen | Created on the first inbound message; name updated on later messages. Never deleted in this spec. |
| Conversation | Contact, time of last inbound message (drives the 24h window), time of latest activity, latest message preview, unread count | Created with the contact; updated on every inbound or outbound message; unread reset on open |
| Message | Conversation, direction (inbound / outbound), WhatsApp message id, type, text, time, delivery status (outbound), failure reason (outbound), sending user (outbound) | Inbound: stored once. Outbound: Enviando → Enviado → Entregado → Leído, or → No enviado (final) |

## 9. External Integrations

All checked on **2026-10-12**. The Graph API version is pinned in configuration; v23.0 is supported until 2027-10-08 (latest is v26.0).

| Integration | Purpose | Official doc (checked on 2026-10-12) |
|---|---|---|
| Webhook verification request (GET with `hub.mode`, `hub.verify_token`, `hub.challenge`) | Meta verifies the callback URL | [Create a webhook endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint) |
| Webhook signature `X-Hub-Signature-256` (HMAC-SHA256 of the body with the app secret) | Prove notifications come from Meta | [Create a webhook endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint) |
| Webhook field `messages` — inbound messages (`contacts[]`, `messages[]`, `metadata.phone_number_id`) | Receive customer messages | [Messages webhook reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages), [Unsupported type](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/unsupported) |
| Webhook field `messages` — `statuses[]` (sent, delivered, read, failed, played; `errors[]` on failure) | Delivery status of replies | [Status webhook reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status) |
| Send message (`/{phone-number-id}/messages`, type text, body ≤ 4096 chars) | Send replies | [Text messages](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages), [Send messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages) |
| Error codes (131047 outside window, 131026 undeliverable, 131056 pair rate limit, 130429 throughput, 190 expired token, 131000 unknown) | Translate failures into user-facing reasons | [Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes) |
| Webhook retries (up to 7 days; duplicates possible) | Reliability rules BR-002 | [Set up webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks) |

Note: the "recipient not in allowed list" error of the test number is not listed on the current error-codes page; its exact code is confirmed during planning/implementation against the real test number. The behavior (AC-5.5, §12) does not depend on the code.

## 10. UI / UX

Follows the visual system of spec 001 (plan 001 §7b); the inbox is the app's main screen. Copy in Spanish.

| Screen | Purpose | Empty state | Loading state | Error state |
|---|---|---|---|---|
| Bandeja — conversation list (left pane; full screen on mobile) | Search box; conversations with avatar initials, name, number, preview, time, unread badge; selected one highlighted | No conversations: "Aún no hay conversaciones. Cuando un cliente escriba al número de WhatsApp aparecerá aquí." No search results: "Ninguna conversación coincide con «…»." | Placeholder rows | "No se pudieron cargar las conversaciones." + "Reintentar" |
| Bandeja — nothing selected (right pane, desktop) | Invite to pick a conversation | "Selecciona una conversación para verla." | — | — |
| Conversation thread (right pane; full screen on mobile with "Volver") | Header (name, number, 24h window indicator); messages (customer left, team right with user name, time and status); "Cargar anteriores"; composer | Conversation with only placeholders still shows them; composer as per window | Placeholder bubbles; "Cargando…" on "Cargar anteriores" | Not found: "Esta conversación no existe". Load failure: "No se pudo cargar la conversación." + "Reintentar" |
| Composer | Multi-line text box, "Enviar" button; Enter sends, Shift+Enter new line; character counter near the limit | Disabled outside the window with the 24h reason | "Enviar" disabled while the text is empty | Validation messages inline (empty / over 4096) |
| Status marks on team messages | Enviando · Enviado · Entregado · Leído · No enviado (+ reason) | — | — | "No enviado" in the error colour with the Spanish reason |
| Live connection | Reconnects silently | — | — | If disconnected for a while: discreet "Reconectando…" notice |

## 11. Non-functional Requirements

- **Security / permissions:** every inbox page and action requires a signed-in active user (spec 001). The webhook is the only unauthenticated entry point and is protected by Meta's signature. The access token and app secret never reach the browser.
- **Privacy (phone numbers, message content):** full numbers and message text are visible to signed-in users (needed to work). Logs never contain tokens, full message text or full phone numbers (last 4 digits at most).
- **Performance / limits:** demo scale (a handful of users, hundreds of conversations). New messages and status changes visible in other open inboxes within ~5 seconds.
- **Reliability (retries, duplicates, ordering):** duplicate notifications have no extra effect (BR-002); statuses never go backwards (BR-003); failed processing is recorded on the raw notification so it can be replayed later; Meta always gets a successful answer for validly signed notifications.

## 12. Edge Cases & Errors

| Case | Expected behavior |
|---|---|
| Wrong verify token / wrong mode | Verification rejected; challenge not echoed |
| Missing or invalid signature | Rejected as unauthorized; nothing stored as processed, nothing shown |
| Validly signed but malformed or unexpected content | Raw copy kept with the processing error; Meta gets a successful answer; nothing shown |
| Same message or status delivered twice | Effect once (BR-002) |
| Status report for an unknown message id | Ignored (raw copy kept) |
| Status reports out of order | Never moves backwards (BR-003) |
| Notification for another business number | Raw copy kept; ignored |
| Non-text inbound message | Placeholder "Mensaje de tipo <tipo> no soportado aún" |
| Reply outside the 24h window (incl. window closing while typing) | Not sent to WhatsApp; "La ventana de 24 h está cerrada. Solo se pueden enviar plantillas (próximamente)." |
| WhatsApp says outside window (131047) despite our check | "No enviado — La ventana de 24 h está cerrada." |
| Recipient not in the test number's allowed list | "No enviado — Este número no está en la lista de destinatarios permitidos del número de prueba." |
| Number cannot receive WhatsApp messages (131026) | "No enviado — WhatsApp no pudo entregar el mensaje a este número." |
| Too many messages (131056, 130429) | "No enviado — Se enviaron demasiados mensajes seguidos. Espera un momento e inténtalo de nuevo." |
| Access token expired/invalid (190) | "No enviado — Hay un problema con la conexión a WhatsApp. Contacta a un administrador." |
| Any other WhatsApp error or WhatsApp unreachable | "No enviado — WhatsApp no aceptó el mensaje. Inténtalo de nuevo más tarde." |
| Empty / whitespace-only reply | Cannot be sent |
| Reply > 4096 characters | Cannot be sent; limit shown |
| Conversation link that does not exist | "Esta conversación no existe" |
| Signed-out or deactivated user | Redirected to login (spec 001 rules) |
| Live connection lost | Reconnects and catches up (AC-7.2) |

## 13. Success Criteria

- With the Meta dashboard pointing at the CRM through the tunnel: the webhook is verified (AC-1.1).
- From a phone in the test number's allowed list: send "Hola" → within a few seconds it appears in the inbox of two signed-in users (an admin and an agent) without reloading, as a new conversation with the phone's WhatsApp name and unread 1.
- Open it → unread goes to 0 for both users; reply "¿En qué te puedo ayudar?" → the phone receives it; the reply goes Enviando → Enviado → Entregado → Leído (when read on the phone) without reloading.
- Send an image from the phone → the placeholder appears.
- Reply to a number that is not in the allowed list (e.g. via a conversation whose contact was removed from the list) → "No enviado" with the allowed-list reason.
- A conversation whose last customer message is > 24 h old shows the disabled composer with the 24h reason.
- Automated tests cover: signature check (valid / invalid / missing), parsing of real captured text, non-text and status notifications, duplicate handling, status ordering, and the 24h-window rule.

## 14. Open Questions

None.

## 15. Approval

- [x] Quality checklist passed (`.agents/skills/sdd-spec/checklist.md`)
- [x] No `[NEEDS CLARIFICATION]` markers left
- [x] Approved by the user on 2026-10-12
