# TODO

Pending items that are **not part of the current spec**: bugs, small tasks, tech debt, ideas.

**Rules:** this is not a history — when an item is solved, **delete its line**. Keep it short (max ~30 items). One line per item. If an item grows into a feature or needs design, move it to a spec (`/sdd-spec`) and delete it here.

Format: `- <description> — <origin: who/where found it> (YYYY-MM-DD)`

## Bugs

## Tasks

- Confirm the real Meta error code for "recipient not in allowed list" (assumed `131030` in `toDeliveryFailureReason`) the first time it happens; fix the mapping if it differs — spec 002 / T050 (2026-10-12)

- Periodic cleanup of old `login_attempt` rows (older than the 15-min window; harmless but they accumulate) — found in spec 001 / T025 (2026-10-12)

## Tech debt

- Respect `prefers-reduced-motion` for dialog animations (plan §7b) — spec 001 review (2026-10-12)
- Apply the 15px `text-body` token on `<body>`; replace remaining `text-sm` in `user-menu.tsx` — spec 001 review (2026-10-12)
- Move shared users UI style constants (`FIELD_LABEL_CLASS`, `USERS_PANEL_CLASS`) out of feature files or inline them — spec 001 review (2026-10-12)
- UI nice-to-haves from the guidelines review: vendor `button.tsx` uses `transition-all`; add `themeColor` / `color-scheme: light` — spec 001 / T049 (2026-10-12)
- Remove unused Next.js starter assets in `public/` (next.svg, vercel.svg, …) — found in spec 001 / T036 (2026-10-12)
- `/api/health` imports the db client directly (AGENTS.md §5.1 says app code calls use cases) — route it through a tiny health-check use case — found in spec 001 / T027 (2026-10-12)
- Bump `@types/node` from ^20 to ^22+ (vitest 5 peer requirement mismatch) — found in spec 001 / T001 (2026-10-12)
- Enforce AGENTS.md §5.1 layer rules with ESLint (`no-restricted-imports` or a boundaries plugin) so lint fails if `domain/` imports Next/Drizzle — found during setup (2026-10-12)
- `escapeLikePattern` is duplicated in users and conversations Drizzle code; move it to a shared db helper — found in spec 002 / T031 (2026-10-12)
- `json-error-response.test.ts` does not check that the webhooks errors have status rows (they do) — found in spec 002 / T033 (2026-10-12)
- Thread `aria-live` on the whole list may read out older messages after "Cargar anteriores"; announce only new messages in a separate status region — found in spec 002 / T043 (2026-10-12)
- Inbox mobile: with a thread open the page has no h1 (thread title is an h2), and the "Reconectando…" pill overlaps the thread header — found in spec 002 / T046 (2026-10-12)
- Inbox: an open conversation hidden by the current search is not auto-marked read — found in spec 002 / T046 (2026-10-12)
- Inbox UI nice-to-haves (guidelines review T048): times from earlier years show dd/MM without year and no date separators; 16px inputs on mobile (iOS zoom); `name` on inputs, "…" placeholder with example, Enter/Shift+Enter hint; warn before discarding a draft; `title` on truncated contact name; bigger "Volver" touch target; thread pane as labelled `<section>`; loading text + `motion-reduce` on thread skeletons; `--input` border contrast (1.5:1); `translate="no"` on brand — spec 002 / T048 (2026-10-12)
- AGENTS.md §5.1: say domain may use `zod` (and `node:crypto`) for pure boundary schemas/rules, as plan 002 §11 decided — found in spec 002 / T025 (2026-10-12)

## Production hardening (only if this demo is ever exposed publicly)

- Login limit can be bypassed with simultaneous requests (count → verify → record is not atomic); make it atomic per email+IP — spec 001 review (2026-10-12)
- 30-day sliding session only slides in the DB, not the browser cookie (`nextCookies` can't write cookies in Server Components); renew the cookie where it can be written — spec 001 review (2026-10-12)
- Unexpected-error logs may include Drizzle query params (session token / password hash); log only name/code/cause — spec 001 review (2026-10-12)
- Per-IP login limit across all emails (credential stuffing) — spec 001 review (2026-10-12)
- Route-level / e2e smoke tests (Playwright) for REST routes, Server Actions, proxy and guard redirects — spec 001 review (2026-10-12)
- Status webhooks: read → compute → write is not atomic (two webhooks for one message can race; use `UPDATE … WHERE rank < new`); a status that arrives before the wamid is saved is ignored — spec 002 plan §11 / review (2026-10-12)
- Outbound send: if Meta accepts but saving `sent` + wamid fails, the reply stays "Enviando" and later statuses are ignored; retries on 5xx can duplicate a send — spec 002 review (2026-10-12)
- `unread_count` is read-modify-write in `recordInboundMessage` / `markConversationRead`; use `unread_count = unread_count + 1` — spec 002 review (2026-10-12)
- `/api/realtime`: if the LISTEN connection drops (Postgres restart) the SSE stream stays open and never catches up; `subscribeToChannel` doesn't `end()` the client when connect/LISTEN fails; one pg connection per tab — spec 002 review (2026-10-12)
- Webhooks are processed synchronously before answering 200; use a queue if volume grows — spec 002 plan §11 (2026-10-12)

## Ideas

- Light/dark theme toggle (would need a `next-themes` ThemeProvider; `sonner` already reads the theme) — found in spec 001 / T003 (2026-10-12)
- Audit log of user-management actions (who created/edited/deactivated/reset whom, when) — left out of spec 001 (2026-10-12)
- Self-service password recovery by email (needs an email provider) — left out of spec 001 (2026-10-12)
