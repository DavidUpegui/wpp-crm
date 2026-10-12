<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — WhatsApp CRM

Guide for any coding agent (and human) working in this repo. Read this fully before making changes.

**Quality bar:** code must follow clean architecture and **SOLID**, and must be easy to read **for a junior developer**. When in doubt, choose the simpler, more explicit option. See §5 and §6.

## Project context: this is a DEMO (read first)

This CRM is an **internal demo / test**. It is **not used by clients** and is **not exposed to the public internet**. The goal is to build features **fast** while keeping the code clean and readable (§5–§6).

What this means for every spec, plan, task and review:
- **Keep the basics:** login and role checks on every page/action/route, no secrets in code or git, passwords hashed, Zod validation at the boundaries, the WhatsApp rules in §8 (they are Meta's rules, not hardening).
- **Do NOT spend effort on production hardening** unless the user explicitly asks: concurrency/race-condition handling and tests, advanced rate limiting, log redaction, CSRF/proxy/deployment hardening, load/performance work, exhaustive edge-case coverage. Prefer the simplest design that works for a demo.
- **Reviews:** production-hardening findings are never BLOCKER/MAJOR — they go to `TODO.md` under a "Production hardening" heading. Block only on: spec behavior not met, basic auth/role check missing, broken architecture rules (§5), or failing checks.
- **Tests:** cover business rules and the happy path + main error cases; skip concurrency and stress tests.
- Spec 001 (authentication) was built before this rule and already includes some hardening; keep it, but don't extend it.

## 0. Spec-Driven Development (mandatory)

**No feature code is written without an approved spec, plan and task list.** This applies to every feature and every bug fix (a bug fix gets a short spec).

```
/sdd-spec <description>  → specs/NNN-slug/spec.md   WHAT & WHY     — user approves
/sdd-plan NNN            → specs/NNN-slug/plan.md   HOW            — user approves
/sdd-tasks NNN           → specs/NNN-slug/tasks.md  STEP BY STEP   — user approves
/sdd-implement NNN       → sdd-implementer agent (one task at a time) → sdd-reviewer agent
```

- **Strict gates:** each step refuses to start unless the previous document has `status: Approved`. Only the user approves; agents ask and then record `status: Approved` + `approved_at`.
- An open `[NEEDS CLARIFICATION]` marker blocks approval.
- If implementation shows the spec or plan is wrong: **stop, update the document, get it re-approved**, then continue. Code never silently diverges from the spec.
- Exceptions (no spec needed): tooling/config/docs changes that don't change app behavior (e.g. editing this file, dependency bumps) — still ask the user first.
- **Out-of-scope findings go to [`TODO.md`](TODO.md)**, not into the current change: bugs, tasks, tech debt or ideas noticed while working on a spec are added there as one line and left alone. `TODO.md` is not a history — solved items are deleted; it stays short (~30 items max); anything that needs design becomes a spec.
- **"What is pending?"** = open items in `TODO.md` + specs whose documents are not `Done` (with their status and unchecked tasks in `tasks.md`).
- Details, folder and ID conventions: [`specs/README.md`](specs/README.md). Skills: `.agents/skills/sdd-*`. Agents: `.claude/agents/sdd-*.md`.

## 1. Project overview

A CRM for a single business with multiple agent users, built on the **Meta WhatsApp Cloud API**.

Core capabilities:
- **Inbox**: receive WhatsApp messages via webhooks, reply in realtime, track delivery/read status.
- **Templates**: list, create, sync and send WhatsApp message templates (required outside the 24h window).
- **CRM**: contacts, tags, notes, conversation assignment and status.

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components on), TypeScript `strict` |
| Package manager | **pnpm** (do not use npm/yarn; do not commit other lockfiles) |
| Database | PostgreSQL 16 via `docker-compose.yml` |
| ORM / migrations | Drizzle ORM + drizzle-kit |
| Validation | Zod at every boundary (env, webhooks, forms, API bodies) |
| Auth | Better Auth (email + password, Drizzle adapter), roles `admin` / `agent` |
| UI | Tailwind CSS + shadcn/ui; TanStack Query for client data |
| Realtime | Server-Sent Events (`/api/realtime`) backed by Postgres `LISTEN/NOTIFY` |
| Meta API | Thin typed `fetch` wrapper — **no third-party WhatsApp SDK** |
| Tests | Vitest (unit/integration), Playwright (e2e, later) |

## 3. Commands

```bash
corepack enable               # once — provides pnpm
pnpm install
pnpm db:up                    # docker compose up -d: Postgres (5432) + Adminer (8080)
pnpm db:generate              # generate migration from schema changes
pnpm db:migrate               # apply migrations
pnpm db:studio                # Drizzle Studio
pnpm dev                      # Next.js dev server on :3000 (health: /api/health)
pnpm typecheck                # next typegen && tsc --noEmit
pnpm lint
pnpm test                     # unit tests only (vitest run; *.test.ts, no database)
pnpm test:integration         # *.integration.test.ts against Postgres test DB (wpp_crm_test, auto-created + migrated)
pnpm build
pnpm auth:create-first-admin --name "Ana Pérez" --email ana@example.com   # one-off: first admin (asks password, hidden)
```

Regenerate the Better Auth tables after changing auth options that affect the schema (then `pnpm db:generate`):

```bash
pnpm dlx auth@1.7.6 generate --config src/modules/auth/infrastructure/better-auth-schema.config.ts --output src/shared/db/schema/auth.ts -y
```

Local webhook tunnel (Meta requires public HTTPS):

```bash
cloudflared tunnel --url http://localhost:3000
# Callback URL in Meta dashboard: https://<tunnel-host>/api/webhooks/whatsapp
```

## 4. Agent skills

- Skills live in `.agents/skills/` (symlinked into `.claude/skills/`) and are tracked in `skills-lock.json`.
- **Use the `find-skills` skill** before starting a new area of work (auth, forms, testing, WhatsApp integration, UI, deployment…) to check whether a well-maintained skill exists.
- Only consider reputable skills (official sources such as `vercel-labs`, `anthropics`, `microsoft`, or high install counts). **Read a skill's `SKILL.md` before installing or using it**, and ask the user before installing.
- Install per project (no `-g`) so the whole team gets the same skills.
- Skills give guidance; **this file wins** when they conflict.

### 4.1 UI work always uses the design skills (mandatory)

Every spec that creates or changes UI (pages, components, forms, dialogs, the app shell) must include **visual polish in the same spec**; there are no separate "UI polish" specs.
- **Plan (`/sdd-plan`):** use the `frontend-design` skill to write a "Design" section in `plan.md`: palette (4–6 named hex values), typefaces and type scale, layout sketch, principles. The first UI spec defines the app's visual system (Tailwind/shadcn theme tokens in `globals.css`); later specs reuse and extend it instead of reinventing it.
- **Implementation (`sdd-implementer`):** UI tasks follow that Design section and the `frontend-design` skill (no default/templated look, responsive, visible keyboard focus, accessible contrast, clear Spanish copy).
- **Review:** before a UI spec is Done, run the `web-design-guidelines` skill on the changed UI files; fix real issues, put the rest in `TODO.md`.
- Other installed UI-related skills: `better-auth-*` (auth only). Use `find-skills` if a UI need isn't covered.

## 5. Architecture

### 5.1 Layers and dependency rule

The code is organized by **feature module**, and each module is split into **layers**. Dependencies only point **inward**:

```
app (Next.js routes/pages)  ──►  application (use cases)  ──►  domain (rules + interfaces)
                                                                     ▲
                                 infrastructure (DB, Meta API) ──────┘  implements domain interfaces
```

| Layer | Contains | May import | Must NOT import |
|---|---|---|---|
| `domain/` | Entities, value types, business rules (pure functions), **repository/gateway interfaces**, domain errors | `shared/errors` only | Next.js, React, Drizzle, `fetch`, `env` |
| `application/` | **Use cases** — one business action each (`send-text-message.ts`) | `domain` | Drizzle, Next.js, concrete infrastructure classes |
| `infrastructure/` | Implementations of domain interfaces: Drizzle repositories, Meta API adapters | `domain`, `shared` | `app`, other modules' infrastructure |
| `ui/` | Feature React components | `domain` types | DB, Meta API, use-case internals |
| `src/app/` | Routes, pages, server actions — **thin**: validate input → call use case → respond/render | `server/container`, `ui`, `shared` | DB client, repositories, Meta client directly |

### 5.2 Directory map

```
src/
  app/                               # Next.js routes ONLY (thin)
    (auth)/login/, (auth)/change-password/   # public auth screens
    (app)/layout.tsx                 # app shell + optimistic guard (NOT enough on its own — see §12)
    (app)/inbox|contacts|templates/  # placeholders until their specs
    (app)/account/, (app)/users/     # "Mi cuenta", user management (page + actions.ts)
    api/session, api/account, api/users/   # REST API (spec 001)
    api/health/route.ts
    api/webhooks/whatsapp/route.ts   # GET verify + POST receive
    api/realtime/route.ts            # SSE stream
  modules/
    <feature>/                       # auth, users (spec 001); later: conversations, messaging, contacts, templates, webhooks
      domain/
      application/                   # use cases: `makeX(dependencies)` factories, one per file
        testing/                     # in-memory fakes + their contract tests (test-only)
      infrastructure/
      ui/                            # components + `*-state.ts` form state types + Spanish `messages.ts`
  shared/
    config/env.ts                    # zod-validated env — the ONLY place that reads process.env
    db/client.ts                     # drizzle client (server-only)
    db/schema/*.ts                   # one file per domain area, re-exported from index.ts
    errors/app-error.ts              # base class for all intentional errors
    http/                            # error→status table, body/query validation, same-origin check, client IP, safe redirects
    whatsapp/graph-client.ts         # low-level HTTP to the Graph API (auth, version, retries, error mapping)
    realtime/                        # NOTIFY helper + LISTEN subscriber
  server/
    container.ts                     # composition root: wires interfaces → implementations
    require-signed-in-user.ts        # page/action guard: session + pending password change + role
  proxy.ts                           # optimistic cookie check → /login?redirectTo=… (never the only protection)
  components/ui/                     # shadcn/ui generated components (do not hand-edit heavily)
  components/                        # shared app components (app-shell/, field-error, forbidden-view)
  lib/utils.ts                       # shadcn `cn()` helper (path required by components.json)
tests/
  fixtures/webhooks/                 # real webhook payloads captured from Meta
  integration/                       # global setup (creates/migrates the test DB) + test-database helper
  stubs/
scripts/                             # one-off CLI scripts (run with `tsx --conditions=react-server`)
drizzle/                             # generated migrations (committed)
specs/                               # SDD documents: NNN-slug/{spec,plan,tasks}.md (see §0)
.agents/skills/                      # project skills (find-skills, sdd-*), symlinked into .claude/skills/
.claude/agents/                      # Claude Code subagents (sdd-implementer, sdd-reviewer)
```

### 5.3 SOLID applied to this project

- **S — Single Responsibility.** Each file has one reason to change. A route handler deals with HTTP; a use case with one business action; a repository with persistence; `graph-client.ts` with HTTP to Meta. If you describe a file with "and", split it.
- **O — Open/Closed.** Extend by adding, not editing. Webhook events and message types are dispatched through a **handler registry** (`Record<EventType, Handler>`): supporting a new message type means adding a handler file and registering it — not growing a `switch` in a shared function.
- **L — Liskov Substitution.** Every implementation of an interface honors the same contract (inputs, outputs, thrown error types). A `FakeMessageSender` used in tests must behave like `MetaMessageSender` from the use case's point of view.
- **I — Interface Segregation.** Prefer small, focused interfaces (`MessageSender`, `ConversationRepository`, `TemplateCatalog`) over one big `WhatsAppService`. A use case depends only on the methods it calls.
- **D — Dependency Inversion.** Use cases depend on **interfaces** defined in `domain/`, received as arguments. Only `src/server/container.ts` creates concrete classes (manual DI — no DI framework). Tests pass in-memory fakes.

Example of the shape every use case follows:

```ts
// modules/messaging/application/send-text-message.ts

/** Sends a free-form text message, only allowed inside the 24h customer service window. */
export function makeSendTextMessage(dependencies: {
  conversationRepository: ConversationRepository;
  messageSender: MessageSender;
}) {
  return async function sendTextMessage(input: SendTextMessageInput): Promise<SentMessage> {
    const conversation = await dependencies.conversationRepository.getById(input.conversationId);

    if (!isWithinCustomerServiceWindow(conversation.lastInboundAt, new Date())) {
      throw new OutsideCustomerServiceWindowError();
    }

    return dependencies.messageSender.sendText(conversation.contactWaId, input.text);
  };
}
```

**Naming:** use-case factories are `makeX` (e.g. `makeCreateUser` → `createUser`). Writes that span several rows go through a `…TransactionRunner` dependency that hands the use case the repositories bound to one transaction.

**UI pattern:** the page passes Server Actions to client components as props; form state types live in `src/modules/<module>/ui/*-state.ts`. Components never import from `src/app/`.

**Avoid over-engineering (YAGNI):** create an interface only when there is a real second implementation or a test fake that needs it. Do not add layers, factories or generics "for the future".

## 6. Readability rules (junior-friendly code)

- **Names say what things are.** No abbreviations (`conversation`, not `conv`; `message`, not `msg`). Functions are verbs (`markMessageAsRead`), booleans are questions (`isWithinCustomerServiceWindow`, `hasValidSignature`).
- **Small functions** (aim for < 30 lines) that do one thing. Prefer **early returns** over nested `if`s. **No nested ternaries**, no clever one-liners.
- **Explicit types** on exported functions (parameters and return type). No `any` — use `unknown` + Zod.
- **No magic values.** Use named constants: `const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;`.
- **Comments explain _why_, not _what_.** Every exported use case, interface and non-obvious function has a short JSDoc saying what it is for. Link to Meta docs when a rule comes from Meta.
- **Errors are typed classes** extending `AppError` (`src/shared/errors/app-error.ts`) with a stable `code`. Never `throw "string"`, never swallow errors silently.
- **One exported use case / class per file.** File names are kebab-case and describe the content (`send-text-message.ts`, `drizzle-conversation-repository.ts`). No `utils2.ts`, `helpers.ts`, `misc.ts`.
- **Plain control flow.** `async/await` over promise chains; `for...of` over `reduce` when it is easier to read.
- **Consistent structure:** imports → constants → types → main export → private helpers.
- UI text: Spanish by default for end-user screens; code, identifiers and comments in English.

## 7. Environment variables

Defined and validated in `src/shared/config/env.ts`; documented in `.env.example`. Real values live in `.env.local` (gitignored). The app refuses to start if any value is missing or malformed.

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `DATABASE_URL_TEST` | Integration-test database (default `…/wpp_crm_test`); only read by the Vitest integration config |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Auth |
| `META_APP_ID` | Meta app |
| `META_APP_SECRET` | Verifies webhook `X-Hub-Signature-256` |
| `META_GRAPH_API_VERSION` | Pinned Graph API version, e.g. `v23.0` |
| `WHATSAPP_ACCESS_TOKEN` | **System User** permanent token (not the 24h temp token) |
| `WHATSAPP_PHONE_NUMBER_ID` | Sender phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA ID (templates API) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Random string, must match Meta dashboard |

Never read `process.env` directly outside `env.ts` (exceptions: `drizzle.config.ts` and the Vitest configs, which run outside Next.js). An invalid environment throws an error named `InvalidEnvironmentError` that lists variable names (never values).

## 8. WhatsApp Cloud API rules (critical)

**Verify against the official Meta docs before implementing any WhatsApp feature** — the API changes often. Build webhook parsing from **real captured payloads** saved as fixtures in `tests/fixtures/webhooks/`, not from memory.

1. **All Graph API calls go through `src/shared/whatsapp/graph-client.ts`.** Base URL: `https://graph.facebook.com/${META_GRAPH_API_VERSION}`. Never hardcode a version elsewhere. Feature modules wrap it in their own adapters (e.g. `MetaMessageSender`).
2. **24-hour customer service window.** Free-form messages (text, media, interactive) can only be sent if the contact's last inbound message is < 24h old (`conversations.last_inbound_at`). Outside the window, **only approved templates** may be sent. Enforce this in the use case, before calling Meta.
3. **Webhook signature.** Verify `X-Hub-Signature-256` = `sha256=` + HMAC-SHA256(raw body, `META_APP_SECRET`) using `crypto.timingSafeEqual`. Read the **raw body** (`await request.text()`) *before* parsing JSON. Reject invalid signatures with 401.
4. **Webhook verification (GET).** If `hub.mode === "subscribe"` and `hub.verify_token` matches, respond 200 with `hub.challenge` as plain text; otherwise 403.
5. **Store raw, then process.** Every POST is inserted into `webhook_events` (raw JSON, signature result) before processing. Processing errors are saved on the row (`error`, `processed_at` null) so events can be replayed. Always return 200 to Meta for valid-signature payloads, even if processing failed (otherwise Meta retries and floods).
6. **Idempotency.** Meta can deliver the same webhook multiple times. `messages.wa_message_id` is UNIQUE; use `ON CONFLICT DO NOTHING/UPDATE`. Handlers must be safe to run twice.
7. **Monotonic statuses.** Order: `queued < sent < delivered < read`; `failed` is terminal. Never downgrade (status webhooks can arrive out of order). This rule is a pure domain function with unit tests.
8. **Outbound flow.** Insert message as `queued` → call Meta → save returned `wamid` and set `sent` (or `failed` with the error payload) → `NOTIFY`.
9. **Phone numbers** are stored as `wa_id` (digits only, E.164 without `+`), as Meta sends them.
10. **Media URLs** returned by Meta are short-lived and require the `Authorization` header to download. Download and store media; never expose Meta URLs or the token to the browser.
11. **Templates.** Managed via `/{WABA_ID}/message_templates`. Template status changes arrive via the `message_template_status_update` webhook field; keep `templates.status` in sync. Template variables must be validated against the template's components before sending.
12. **Rate limits / errors.** Retry with backoff on 429 and 5xx only. Map Meta error codes into typed `AppError` subclasses; surface the user-facing reason in the UI (e.g. "outside 24h window", "recipient not in allowed list").
13. **Test number:** can only send to recipient numbers added to the allow-list in the Meta dashboard (max 5).

Webhook fields subscribed in Meta: `messages`, `message_template_status_update`.

## 9. Database rules

- Schema lives in `src/shared/db/schema/`. Changes only via `pnpm db:generate` → review SQL → `pnpm db:migrate`.
- **Never edit a migration that has been applied/committed**; create a new one.
- Do not use `drizzle-kit push` except on a throwaway local DB.
- Only `infrastructure/` code touches the DB client. Repositories return **domain types**, not raw Drizzle rows.
- Use transactions for multi-row writes (e.g. upsert contact + conversation + message).
- Core tables: `users`/`sessions` (Better Auth), `contacts`, `tags`, `contact_tags`, `notes`, `conversations`, `messages`, `templates`, `media`, `webhook_events`.
- Timestamps are `timestamptz`; store UTC. **Exception (accepted in spec 001):** the Better Auth tables (`user`, `session`, `account`, `verification`) are generator-owned and use `timestamp` without time zone; Drizzle reads/writes them consistently as UTC. Do not hand-edit `src/shared/db/schema/auth.ts` — regenerate it (§3).
- Better Auth is used as a **library only**: its HTTP handler is NOT mounted (no `/api/auth/*`) so its endpoints can't bypass our rules. Options live in `src/modules/auth/infrastructure/create-better-auth.ts`; the session cookie cache stays OFF so revocation is immediate.
- Repositories receive the database (or a transaction) in their constructor; they never import `@/shared/db/client`.

## 10. Realtime

- Server code calls `notify('inbox_events', payload)` after any change the inbox should see (new message, status change, assignment).
- Keep NOTIFY payloads small (ids + type); clients refetch via TanStack Query.
- `/api/realtime` holds a dedicated pg connection running `LISTEN inbox_events` and streams events as SSE. It must call `await connection()` first and clean up the listener on abort.

## 11. Next.js 16 specifics (Cache Components is ON)

- `cacheComponents: true` in `next.config.ts`. Route segment configs `dynamic`, `revalidate`, `fetchCache` are **not allowed**.
- Route handlers / server code that must run per request (webhooks, health, SSE, fresh DB reads) call `await connection()` from `next/server` before doing I/O.
- Cache deliberately with `"use cache"` + `cacheLife`/`cacheTag`; read `cookies()`/`headers()` inside `<Suspense>` boundaries.
- Node.js is the default runtime; do not use the edge runtime (deprecated, and `pg` needs Node).
- `middleware.ts` is now `proxy.ts`.
- When unsure, read `node_modules/next/dist/docs/` — do not rely on pre-16 knowledge.
- Server Components by default; `"use client"` only where interactivity is needed.

## 12. Security

- Tokens and secrets are **server-only**. Modules that touch them import `server-only`.
- Never log tokens, full webhook bodies with message content, or full phone numbers in production logs (redact to last 4 digits).
- Never commit `.env*` files except `.env.example`.
- All app routes and server actions require an authenticated session; `admin`-only for template creation/deletion and user management. The webhook route is the only unauthenticated POST endpoint (protected by signature).
- **Every page and every Server Action that touches real data calls `requireSignedInUser` (or `requireCurrentUser` in route handlers) ITSELF.** The `(app)` layout guard and `proxy.ts` are not enough: App Router pages render independently of layouts, and layouts don't re-run on client navigation.
- Mutating REST routes call `assertSameOrigin` (cross-site browser requests are rejected; clients without `Origin`, like curl, are allowed).
- **If this is ever deployed publicly** (not planned — see Project context): the failed-login limit (BR-004) uses the client IP from `X-Forwarded-For`/`X-Real-IP`. Production MUST run behind a reverse proxy that overwrites these headers; otherwise clients can forge them and bypass the limit.

## 13. Testing

Test each layer the way it is meant to be used:

| Layer | How | Example |
|---|---|---|
| `domain/` | Pure unit tests, no mocks needed | `is-within-customer-service-window.test.ts` |
| `application/` | Use case + **in-memory fakes** of its interfaces | `send-text-message.test.ts` with `FakeMessageSender` |
| `infrastructure/` | `*.integration.test.ts` against the Docker Postgres test DB (`pnpm test:integration`) / mocked `fetch` for Meta | `drizzle-user-repository.integration.test.ts` |

Required tests:
- Webhook signature verification (valid, invalid, missing header).
- Webhook payload parsing for text, media, status and template-status events (fixtures in `tests/fixtures/webhooks/`).
- Status monotonicity and idempotent message insert.
- 24h-window guard.

Test budget during SDD implementation: per task, run only the tests/lint of the files that task changed; run the full suites (typecheck, lint, unit, integration, build) once at the end of each phase.

Rules: test files sit next to the code (`*.test.ts`); test names describe behavior (`"rejects text messages outside the 24h window"`); **never call the real Meta API in tests**.

## 14. Definition of done

A change is done only when:
0. It was built from an approved spec, plan and task list (§0), every task is ticked, and the `sdd-reviewer` verdict is APPROVE.
1. `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` pass.
2. It respects the layer rules (§5.1) and the readability rules (§6). Self-review checklist:
   - Does every file have a single responsibility?
   - Do use cases depend on interfaces, not concrete classes?
   - Would a junior developer understand each function without asking? Are names explicit?
   - Are business rules covered by unit tests?
3. Migrations are generated and committed if the schema changed.
4. New env vars are added to `env.ts` **and** `.env.example`.
5. This file is updated if a rule, command or structure changed.
