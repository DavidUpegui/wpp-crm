# wpp-crm

WhatsApp CRM on the Meta WhatsApp Cloud API — Next.js 16, Postgres (Docker), Drizzle, Better Auth.

## First-time setup

```bash
corepack enable                   # once, provides pnpm
pnpm install
cp .env.example .env.local        # fill in every value (BETTER_AUTH_SECRET: `openssl rand -base64 32`)
pnpm db:up                        # Postgres :5432, Adminer :8080
pnpm db:migrate                   # create the tables
pnpm auth:create-first-admin --name "Your Name" --email you@example.com   # asks the password (hidden)
pnpm dev                          # http://localhost:3000 → log in, then change the temporary password
```

## Everyday commands

```bash
pnpm dev                 # app on :3000 (health: /api/health)
pnpm typecheck && pnpm lint
pnpm test                # unit tests (no database)
pnpm test:integration    # integration tests against the wpp_crm_test database (created automatically)
pnpm build
```

## REST API (spec 001)

Session cookie based (`POST /api/session` to log in). Errors are `{ "error": { "code", "message" } }`.

| Method & path | Who | What |
|---|---|---|
| `POST /api/session` · `GET` · `DELETE` | public · user · user | log in · current user · log out |
| `PATCH /api/account` · `POST /api/account/password` | user | own name · own password |
| `GET /api/users` · `POST /api/users` | admin | list (search, role, status) · create |
| `PATCH /api/users/:id` | admin | name / role |
| `POST /api/users/:id/{deactivate,reactivate,reset-password}` | admin | account status · temporary password |

Production note: run behind a reverse proxy that overwrites `X-Forwarded-For` (the failed-login limit uses the client IP).

Project rules, architecture and the Spec-Driven Development workflow: see [AGENTS.md](./AGENTS.md) and [specs/](./specs/).
