# TODO

Pending items that are **not part of the current spec**: bugs, small tasks, tech debt, ideas.

**Rules:** this is not a history — when an item is solved, **delete its line**. Keep it short (max ~30 items). One line per item. If an item grows into a feature or needs design, move it to a spec (`/sdd-spec`) and delete it here.

Format: `- <description> — <origin: who/where found it> (YYYY-MM-DD)`

## Bugs

## Tasks

- Apply a visual system to the spec 001 screens (login, change password, shell, Mi cuenta, Usuarios) with the `frontend-design` skill — they predate AGENTS.md §4.1; fold into the next UI spec — found after spec 001 (2026-10-12)
- Periodic cleanup of old `login_attempt` rows (older than the 15-min window; harmless but they accumulate) — found in spec 001 / T025 (2026-10-12)

## Tech debt

- Respect `prefers-reduced-motion` for dialog animations (plan §7b) — spec 001 review (2026-10-12)
- Apply the 15px `text-body` token on `<body>`; replace remaining `text-sm` in `user-menu.tsx` — spec 001 review (2026-10-12)
- Move shared users UI style constants (`FIELD_LABEL_CLASS`, `USERS_PANEL_CLASS`) out of feature files or inline them; drop duplicate 1100px wrapper in users page — spec 001 review (2026-10-12)
- UI nice-to-haves from the guidelines review: vendor `button.tsx` uses `transition-all`; add `themeColor` / `color-scheme: light` — spec 001 / T049 (2026-10-12)
- Remove unused Next.js starter assets in `public/` (next.svg, vercel.svg, …) — found in spec 001 / T036 (2026-10-12)
- `/api/health` imports the db client directly (AGENTS.md §5.1 says app code calls use cases) — route it through a tiny health-check use case — found in spec 001 / T027 (2026-10-12)
- Bump `@types/node` from ^20 to ^22+ (vitest 5 peer requirement mismatch) — found in spec 001 / T001 (2026-10-12)
- Enforce AGENTS.md §5.1 layer rules with ESLint (`no-restricted-imports` or a boundaries plugin) so lint fails if `domain/` imports Next/Drizzle — found during setup (2026-10-12)

## Production hardening (only if this demo is ever exposed publicly)

- Login limit can be bypassed with simultaneous requests (count → verify → record is not atomic); make it atomic per email+IP — spec 001 review (2026-10-12)
- 30-day sliding session only slides in the DB, not the browser cookie (`nextCookies` can't write cookies in Server Components); renew the cookie where it can be written — spec 001 review (2026-10-12)
- Unexpected-error logs may include Drizzle query params (session token / password hash); log only name/code/cause — spec 001 review (2026-10-12)
- Per-IP login limit across all emails (credential stuffing) — spec 001 review (2026-10-12)
- Route-level / e2e smoke tests (Playwright) for REST routes, Server Actions, proxy and guard redirects — spec 001 review (2026-10-12)

## Ideas

- Light/dark theme toggle (would need a `next-themes` ThemeProvider; `sonner` already reads the theme) — found in spec 001 / T003 (2026-10-12)
- Audit log of user-management actions (who created/edited/deactivated/reset whom, when) — left out of spec 001 (2026-10-12)
- Self-service password recovery by email (needs an email provider) — left out of spec 001 (2026-10-12)
