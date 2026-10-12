---
id: "001"
title: "Authentication"
spec: ./spec.md
status: Done            # Draft | Approved | Done
created: 2026-10-12
approved_at: 2026-10-12
---

# Plan 001 — Authentication

> The plan explains **HOW** to implement the approved spec, following AGENTS.md
> (architecture §5, readability §6). It must not add behavior that is not in the spec.

## 1. Technical Summary

We use **Better Auth 1.7.6** as a library only. It does three things for us: password hashing (scrypt), session creation and validation, and the session cookie. **We do not mount Better Auth's HTTP handler**, so none of its endpoints are exposed. That removes the risk of its built-in admin/sign-in endpoints bypassing our business rules or our rate limit.

Every operation lives in our own **use cases**, and two thin delivery layers call them:
1. a **REST API** (`/api/session`, `/api/account/*`, `/api/users/*`) for the spec's programmatic interface (FR-008);
2. **Server Actions** used by the Spanish UI.

Business rules are pure domain functions:
- password policy
- email normalization
- last-admin and self-change protections
- the login attempt limit

The last-admin rule is enforced inside a database transaction that locks the active admins, so concurrent changes can't leave the system without an admin. Failed logins are counted per email + IP in our own table.

Users are **never cached**. Every request reads the session and user from the database, so deactivation, password resets and role changes take effect on the next request (BR-006, BR-007).

## 2. Modules & Layers Touched

| Module | domain | application | infrastructure | ui | app routes |
|---|---|---|---|---|---|
| `src/modules/auth` (log in/out, session, own account, attempt limiting) | ✅ | ✅ | ✅ (Better Auth adapter, attempts repo) | ✅ (login, change-password, account forms) | ✅ |
| `src/modules/users` (user model + admin management + first admin) | ✅ | ✅ | ✅ (Drizzle user repo, transactions) | ✅ (users table, dialogs) | ✅ |
| `src/shared` | — | — | ✅ (`db/schema`, `http/` helpers) | — | — |
| App shell | — | — | — | ✅ (`src/components/app-shell/`) | ✅ (`(app)/layout.tsx`, placeholders) |

**Why two modules:** `users` owns *who exists and what they may do* (the user entity and admin rules). `auth` owns *proving who you are* (credentials, sessions, attempts). `auth` may import `users/domain` types. `users` never imports `auth`.

## 3. Domain

All files are pure TypeScript. They import nothing from Next, Drizzle, Better Auth or `env`.

| Item | Kind | File | Implements |
|---|---|---|---|
| `User`, `UserRole` (`"admin" \| "agent"`), `UserStatus` (`"active" \| "inactive"`), `UserListFilters` | types | `src/modules/users/domain/user.ts` | §8 data |
| `normalizeEmail(email): string` (trim + lower case) | rule | `src/modules/users/domain/normalize-email.ts` | BR-001, AC-1.6 |
| `assertPasswordMeetsPolicy(password)`; `MIN_PASSWORD_LENGTH = 10`, `MAX_PASSWORD_LENGTH = 128` | rule | `src/modules/users/domain/password-policy.ts` | BR-002 |
| `assertAdminCanChangeRole({ actorId, target, newRole, activeAdminCount })` | rule | `src/modules/users/domain/admin-protections.ts` | BR-008, BR-009 |
| `assertAdminCanDeactivate({ actorId, target, activeAdminCount })` | rule | same file | BR-008, BR-009 |
| `assertAdminCanResetPassword({ actorId, target })` | rule | same file | BR-009, AC-10.2 |
| `assertIsAdmin(user)` | rule | `src/modules/users/domain/permissions.ts` | BR-012 |
| `UserRepository` (findById, findByEmail, list(filters), create, updateNameAndRole, updateName, setStatus, setMustChangePassword, recordLogin, countAdmins) | interface | `src/modules/users/domain/user-repository.ts` | — |
| `UserTransactionRunner`: `run(work: (users: LockingUserRepository) => Promise<T>)`, with `lockActiveAdmins(): Promise<number>` | interface | `src/modules/users/domain/user-transaction-runner.ts` | BR-008 under concurrency |
| `PasswordHasher` (hash, verify) | interface | `src/modules/users/domain/password-hasher.ts` | §11 |
| `CredentialRepository` (getPasswordHash, setPasswordHash, createForUser) | interface | `src/modules/users/domain/credential-repository.ts` | — |
| `SessionRevoker` (revokeAllForUser, revokeAllForUserExcept(sessionId)) | interface | `src/modules/users/domain/session-revoker.ts` | BR-006, BR-013 |
| Errors: `EmailAlreadyInUseError`, `PasswordPolicyError`, `LastActiveAdminError`, `CannotModifyOwnAccountError`, `UserNotFoundError`, `ForbiddenError`, `NewPasswordSameAsCurrentError`, `FirstAdminAlreadyExistsError` | errors (extend `AppError`) | `src/modules/users/domain/errors.ts` | AC messages |
| `isLoginBlocked(recentFailures): boolean`; `MAX_FAILED_LOGIN_ATTEMPTS = 5`, `FAILED_LOGIN_WINDOW_MS = 15 min` | rule | `src/modules/auth/domain/login-attempt-policy.ts` | BR-004 |
| `LoginAttemptRepository` (countRecentFailures(email, ip, since), recordFailure, clearFailures(email, ip)) | interface | `src/modules/auth/domain/login-attempt-repository.ts` | BR-004 |
| `Authenticator` (signIn(email, password, requestHeaders) → `{ userId }`; signOut(requestHeaders)) | interface | `src/modules/auth/domain/authenticator.ts` | FR-001, FR-005 |
| `SessionReader` (getCurrentSession(requestHeaders) → `{ userId, sessionId } \| null`) | interface | `src/modules/auth/domain/session-reader.ts` | FR-006 |
| `CurrentUser` type (`{ id, name, email, role, mustChangePassword, sessionId }`) | type | `src/modules/auth/domain/current-user.ts` | — |
| Errors: `InvalidCredentialsError`, `AccountDisabledError`, `TooManyLoginAttemptsError`, `UnauthenticatedError`, `PasswordChangeRequiredError`, `WrongCurrentPasswordError` | errors | `src/modules/auth/domain/errors.ts` | AC-1.2/1.3/1.5, AC-3.4, AC-5.3 |

## 4. Application (use cases)

Each use case is a factory, `createX(dependencies) → function`, with one exported use case per file.

| Use case | File | Depends on (interfaces) | Implements |
|---|---|---|---|
| `logIn({ email, password, ipAddress, requestHeaders })` | `src/modules/auth/application/log-in.ts` | LoginAttemptRepository, Authenticator, UserRepository | FR-001–004, AC-1.1–1.7 |
| `logOut(requestHeaders)` | `…/auth/application/log-out.ts` | Authenticator | FR-005 |
| `getCurrentUser(requestHeaders) → CurrentUser \| null` (reads the session, loads a **fresh** user, returns null if inactive) | `…/auth/application/get-current-user.ts` | SessionReader, UserRepository | FR-006, BR-007 |
| `requireCurrentUser(headers, { role?, allowPendingPasswordChange? })` (throws Unauthenticated/Forbidden/PasswordChangeRequired) | `…/auth/application/require-current-user.ts` | getCurrentUser | FR-006, FR-007, FR-010, BR-011 |
| `changeOwnPassword({ currentUser, currentPassword?, newPassword })`. The current password is required in "Mi cuenta"; for the forced change, the stored temporary hash is checked against the new password. It then sets the hash, clears `mustChangePassword` and revokes other sessions. | `…/auth/application/change-own-password.ts` | CredentialRepository, PasswordHasher, UserRepository, SessionRevoker | FR-010–012, AC-4.2/4.3, AC-5.2/5.3/5.5, BR-002, BR-013 |
| `updateOwnName({ currentUser, name })` | `…/auth/application/update-own-name.ts` | UserRepository | FR-011, AC-5.1 |
| `listUsers({ actor, filters })` | `src/modules/users/application/list-users.ts` | UserRepository | FR-013, AC-6.1–6.4 |
| `createUser({ actor, name, email, role, temporaryPassword })` | `…/users/application/create-user.ts` | UserRepository, CredentialRepository, PasswordHasher | FR-014, AC-7.1–7.5 |
| `updateUser({ actor, userId, name, role })` (inside a transaction: lock admins → check rules → update) | `…/users/application/update-user.ts` | UserTransactionRunner | FR-015, AC-8.1–8.5 |
| `deactivateUser({ actor, userId })` (transaction + rules + revoke sessions) | `…/users/application/deactivate-user.ts` | UserTransactionRunner, SessionRevoker | FR-016, AC-9.1/9.3/9.4 |
| `reactivateUser({ actor, userId })` | `…/users/application/reactivate-user.ts` | UserRepository | FR-016, AC-9.2 |
| `resetUserPassword({ actor, userId, temporaryPassword })` (sets hash, `mustChangePassword = true`, revokes all sessions) | `…/users/application/reset-user-password.ts` | UserRepository, CredentialRepository, PasswordHasher, SessionRevoker | FR-017, AC-10.1/10.2 |
| `createFirstAdmin({ name, email, password })` (refuses if any admin exists) | `…/users/application/create-first-admin.ts` | UserRepository, CredentialRepository, PasswordHasher | FR-018, AC-11.1–11.3, BR-014 |

`logIn` flow:
1. Normalize the email.
2. If `isLoginBlocked(countRecentFailures)`, throw `TooManyLoginAttemptsError`.
3. Call `authenticator.signIn`.
4. If that throws `InvalidCredentialsError`, record a failure and rethrow. If it throws `AccountDisabledError`, rethrow without recording a failure, because the password was correct.
5. On success, clear the failures and call `recordLogin(userId)`.
6. Return `{ mustChangePassword }`.

## 5. Infrastructure

| Implementation | Implements | File |
|---|---|---|
| Better Auth instance (config below) | — | `src/modules/auth/infrastructure/better-auth.ts` |
| `BetterAuthAuthenticator`: calls `auth.api.signInEmail` / `signOut` and maps `APIError` → domain errors (`INVALID_EMAIL_OR_PASSWORD` → InvalidCredentials, `ACCOUNT_DISABLED` → AccountDisabled) | Authenticator | `…/auth/infrastructure/better-auth-authenticator.ts` |
| `BetterAuthSessionReader`: `auth.api.getSession({ headers })` | SessionReader | `…/auth/infrastructure/better-auth-session-reader.ts` |
| `BetterAuthPasswordHasher`: `(await auth.$context).password.hash/verify` | PasswordHasher | `…/auth/infrastructure/better-auth-password-hasher.ts` |
| `BetterAuthSessionRevoker`: `internalAdapter.deleteUserSessions(userId)`; "all except" deletes by userId where id ≠ current | SessionRevoker | `…/auth/infrastructure/better-auth-session-revoker.ts` |
| `DrizzleLoginAttemptRepository` | LoginAttemptRepository | `…/auth/infrastructure/drizzle-login-attempt-repository.ts` |
| `DrizzleUserRepository` (maps rows → `User`; email stored normalized) | UserRepository | `src/modules/users/infrastructure/drizzle-user-repository.ts` |
| `DrizzleCredentialRepository` (the `account` row with `providerId = "credential"`) | CredentialRepository | `…/users/infrastructure/drizzle-credential-repository.ts` |
| `DrizzleUserTransactionRunner` (`db.transaction`; `lockActiveAdmins` = `SELECT id … WHERE role='admin' AND is_active FOR UPDATE`, returns the count) | UserTransactionRunner | `…/users/infrastructure/drizzle-user-transaction-runner.ts` |

**Better Auth configuration** (`better-auth.ts`):
- `database: drizzleAdapter(db, { provider: "pg", schema })`
- `emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10, maxPasswordLength: 128 }`. The domain still validates first.
- `user.additionalFields`: `role` (string, default `"agent"`, `input: false`), `isActive` (boolean, default true, `input: false`), `mustChangePassword` (boolean, default true, `input: false`), `lastLoginAt` (date, optional, `input: false`)
- `session: { expiresIn: 30 days, updateAge: 1 day, cookieCache: { enabled: false } }`. This is the 30-day sliding session (BR-005). The cookie cache stays explicitly off so revocation is immediate (BR-006). **We deliberately deviate from the skill's example, which turns it on.**
- `databaseHooks.session.create.before`: load the user; if `!isActive`, throw `APIError("FORBIDDEN", { code: "ACCOUNT_DISABLED" })`. This runs **after** password verification, so the disabled message only appears with the correct password (BR-003, AC-1.3).
- `advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for", "x-real-ip"]`; cookies keep Better Auth's defaults (httpOnly, sameSite lax, secure over https).
- `plugins: [nextCookies()]` (last), so Server Actions set and clear the cookie.
- **No `/api/auth/[...all]` route**, so there's no Better Auth HTTP surface.

**Composition root:** `src/server/container.ts` builds every repository and adapter and exports the ready-to-use use cases (`logIn`, `createUser`, …). Routes and actions import from there only.

## 6. Database Schema & Migrations

1. `src/shared/db/schema/auth.ts` is **generated** with `pnpm dlx auth@1.7.6 generate --config src/modules/auth/infrastructure/better-auth.ts --output src/shared/db/schema/auth.ts`. Don't edit it by hand; regenerate it when the auth config changes.
   - `user`: id, name, email (unique), email_verified, image, created_at, updated_at, **role**, **is_active**, **must_change_password**, **last_login_at**
   - `session`: id, token (unique), user_id → user (cascade), expires_at, ip_address, user_agent, created_at, updated_at
   - `account` (holds the password hash for `provider_id = 'credential'`), and `verification` (required by Better Auth core, unused for now)
2. `src/shared/db/schema/login-attempts.ts` (ours): `login_attempt(id, email text, ip_address text, attempted_at timestamptz default now())`, index `(email, ip_address, attempted_at)`. It stores failures only.
3. A hand-added SQL migration for constraints the generator doesn't produce: `CHECK (role IN ('admin','agent'))` and a unique index on `lower(email)` (defense in depth for BR-001).
4. `pnpm db:generate` → review the SQL → `pnpm db:migrate`, with the migration named `0000_authentication`.

## 7. Routes, Server Actions & UI

**REST API**. JSON in and out. Errors use `{ error: { code, message } }` with these statuses:
- 401 `UNAUTHENTICATED`
- 403 `FORBIDDEN` / `ACCOUNT_DISABLED` / `PASSWORD_CHANGE_REQUIRED`
- 404 `USER_NOT_FOUND`
- 409 `EMAIL_ALREADY_IN_USE` / `LAST_ACTIVE_ADMIN` / `CANNOT_MODIFY_OWN_ACCOUNT` / `FIRST_ADMIN_EXISTS`
- 422 `VALIDATION_ERROR` / `PASSWORD_POLICY` / `WRONG_CURRENT_PASSWORD`
- 429 `TOO_MANY_LOGIN_ATTEMPTS`
- 500 generic

Every handler calls `await connection()` first. Mutating handlers check the `Origin` header against `BETTER_AUTH_URL` for CSRF protection.

| Entry point | Type | File | Use case | Auth |
|---|---|---|---|---|
| `POST /api/session` (login) | route | `src/app/api/session/route.ts` | logIn | public (rate-limited) |
| `DELETE /api/session` (logout) | route | same | logOut | session |
| `GET /api/session` (current user) | route | same | getCurrentUser | session |
| `PATCH /api/account` (name) | route | `src/app/api/account/route.ts` | updateOwnName | session |
| `POST /api/account/password` | route | `src/app/api/account/password/route.ts` | changeOwnPassword | session (pending change allowed) |
| `GET /api/users`, `POST /api/users` | route | `src/app/api/users/route.ts` | listUsers, createUser | admin |
| `PATCH /api/users/:id` | route | `src/app/api/users/[id]/route.ts` | updateUser | admin |
| `POST /api/users/:id/deactivate` / `reactivate` / `reset-password` | routes | `src/app/api/users/[id]/{deactivate,reactivate,reset-password}/route.ts` | … | admin |

Shared HTTP helpers in `src/shared/http/`:
- `json-error-response.ts` maps `AppError` → status + body
- `assert-same-origin.ts`
- `get-client-ip.ts`

**Pages** (English URLs, Spanish text). Session reads sit inside `<Suspense>`, and there's **no `"use cache: private"`** for the user, so changes apply immediately.

| Path | File | Notes |
|---|---|---|
| `/login` | `src/app/(auth)/login/page.tsx` | Login form (`useActionState`); `?redirectTo=` param, with only internal paths accepted (no open redirect) |
| `/change-password` | `src/app/(auth)/change-password/page.tsx` | Forced change |
| `(app)` layout | `src/app/(app)/layout.tsx` | Guard: no user → `/login?redirectTo=…`; `mustChangePassword` → `/change-password`; renders `AppShell` |
| `/inbox`, `/contacts`, `/templates` | `src/app/(app)/{inbox,contacts,templates}/page.tsx` | "Próximamente" placeholder |
| `/` | `src/app/page.tsx` | Redirects to `/inbox` |
| `/account` | `src/app/(app)/account/page.tsx` | Name form + password form; email/role read-only |
| `/users` | `src/app/(app)/users/page.tsx` | Admin only (otherwise the "No tienes permiso" view); search and filters live in URL `searchParams` |
| `src/proxy.ts` | proxy | **Optimistic** redirect to `/login?redirectTo=` when no session cookie exists on protected paths. The real check is always on the server. |

**Server Actions**, which call the same use cases through `container.ts`:
- `src/app/(auth)/login/actions.ts`
- `src/app/(auth)/change-password/actions.ts`
- `src/app/(app)/account/actions.ts`
- `src/app/(app)/users/actions.ts`
- `src/app/(app)/log-out-action.ts`

Each returns `{ ok: true } | { ok: false, code, message, fieldErrors? }`.

**UI components:**
- `src/modules/auth/ui/`: `login-form.tsx`, `change-password-form.tsx`, `account-name-form.tsx`, `account-password-form.tsx`
- `src/modules/users/ui/`: `users-table.tsx`, `users-filters.tsx`, `create-user-dialog.tsx`, `edit-user-dialog.tsx`, `reset-password-dialog.tsx`, `toggle-user-status-dialog.tsx`
- `src/components/app-shell/`: `app-shell.tsx`, `nav-links.tsx`, `user-menu.tsx`
- shadcn components to add: input, label, table, dialog, alert-dialog, select, badge, dropdown-menu, skeleton, sonner, alert

**Spanish messages** live in one file per module (`…/ui/messages.ts`), keyed by error code, so domain errors map to exact spec texts (e.g. `INVALID_CREDENTIALS → "Correo o contraseña incorrectos"`).

**First-admin command:** `scripts/create-first-admin.ts`, run as `pnpm auth:create-first-admin --name "…" --email "…"`.
- It prompts for the password with hidden input (`node:readline`), never prints it, and calls `createFirstAdmin`.
- It runs with `tsx --conditions=react-server` so `server-only` imports resolve, and `dotenv` loads `.env.local`.

## 8. Meta API Verification

Not applicable. Spec 001 has no Meta integration.

Better Auth was verified against the 1.7.6 source and docs on 2026-10-12:
- [Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [CLI `auth generate`](https://www.better-auth.com/docs/concepts/cli)
- [email & password](https://www.better-auth.com/docs/authentication/email-password)
- [sessions](https://www.better-auth.com/docs/concepts/session-management)
- [database hooks](https://www.better-auth.com/docs/concepts/database#database-hooks)
- [Next.js integration](https://www.better-auth.com/docs/integrations/next)
- Next 16 guide: `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`

## 9. Testing Strategy

| Layer | What is tested | Test file | Fakes / fixtures |
|---|---|---|---|
| domain | email normalization; password policy (9/10/128/129 chars); admin protections (self, last admin, normal case); login-attempt policy (4 vs 5 failures) | `src/modules/*/domain/*.test.ts` | none |
| application | every use case: happy path + each error in its ACs (e.g. logIn: blocked, wrong password records a failure, disabled does not record one, success clears and records last login; deactivateUser revokes sessions; changeOwnPassword revokes others but keeps current) | `src/modules/*/application/*.test.ts` | in-memory fakes in `src/modules/*/application/testing/` (`InMemoryUserRepository`, `FakePasswordHasher`, `FakeAuthenticator`, `SpySessionRevoker`, …) |
| infrastructure (integration) | Drizzle repositories against real Postgres; **concurrency**: two parallel demotions of the only two admins → exactly one succeeds; Better Auth adapters: sign-in OK / wrong password / disabled user / session revoked → `getSession` returns null | `src/modules/*/infrastructure/*.integration.test.ts` | Docker Postgres test DB `wpp_crm_test`, migrated before the run |
| http | `json-error-response` status mapping; `assert-same-origin`; `redirectTo` sanitization | `src/shared/http/*.test.ts` | none |

New scripts:
- `pnpm test` runs unit tests (domain, application, http) with no DB.
- `pnpm test:integration` runs `*.integration.test.ts` against `DATABASE_URL_TEST`. The test database is created by a docker-compose init script, `docker/postgres/init-test-db.sql`.

**Manual end-to-end check:** spec §13, steps 1–9, plus a curl check of the REST API (login → cookie → `GET /api/users` as agent → 403).

## 10. Traceability Matrix

| Spec item | Implemented by | Verified by |
|---|---|---|
| FR-001 / AC-1.1 | logIn, BetterAuthAuthenticator, login page/action, `POST /api/session` | log-in.test, authenticator integration test, manual §13.2 |
| FR-002 / AC-1.2, AC-1.3 | Authenticator error mapping, `session.create.before` hook | log-in.test, authenticator integration test, manual §13.6 |
| FR-003 / AC-1.5 / BR-004 | login-attempt-policy, DrizzleLoginAttemptRepository, logIn | login-attempt-policy.test, log-in.test, repo integration test, manual §13.8 |
| FR-004 / AC-1.7 | logIn → `recordLogin` | log-in.test |
| AC-1.4, AC-4.1 / FR-010 / BR-011 | requireCurrentUser, `(app)` layout guard, `/change-password` | require-current-user.test, manual §13.2 |
| AC-1.6 / BR-001 | normalizeEmail, `lower(email)` unique index | normalize-email.test, repo integration test |
| FR-005 / AC-2.1, AC-2.2 | logOut, log-out action, `DELETE /api/session` | log-out.test, manual |
| FR-006 / AC-3.1, AC-3.6 | proxy.ts, `(app)` layout guard, redirectTo | redirect-to.test, manual |
| FR-007 / AC-3.2–3.5 / BR-012 | assertIsAdmin, requireCurrentUser({ role: "admin" }), nav-links, users page | permissions.test, require-current-user.test, manual §13.4 |
| FR-008 | REST routes in §7 + json-error-response | json-error-response.test, manual curl check |
| FR-009 | redirectTo handling in login action/page | redirect-to.test, manual |
| FR-011 / AC-5.1, AC-5.4 | updateOwnName, account page | update-own-name.test |
| AC-4.2, AC-4.3, AC-5.2, AC-5.3 / BR-002 | changeOwnPassword, password-policy | change-own-password.test, password-policy.test |
| FR-012 / AC-5.5 / BR-013 | changeOwnPassword → `revokeAllForUserExcept` | change-own-password.test, session-revoker integration test |
| FR-013 / AC-6.1–6.4 | listUsers, DrizzleUserRepository.list, users page/table/filters | list-users.test, repo integration test |
| FR-014 / AC-7.1–7.5 | createUser, create-user-dialog (submit disabled while pending) + unique index | create-user.test, repo integration test |
| FR-015 / AC-8.1–8.5 / BR-007, BR-009, BR-010 | updateUser, admin-protections, fresh user read per request | update-user.test, admin-protections.test |
| FR-016 / AC-9.1–9.5 / BR-006, BR-008 | deactivateUser, reactivateUser, transaction runner lock | deactivate-user.test, reactivate-user.test, concurrency integration test, manual §13.6 |
| FR-017 / AC-10.1, AC-10.2 | resetUserPassword | reset-user-password.test, manual §13.5 |
| FR-018 / AC-11.1–11.3 / BR-014 | createFirstAdmin, `scripts/create-first-admin.ts` | create-first-admin.test, manual §13.1 |
| FR-019 | AppShell, placeholder pages | manual §13.2/§13.4 |
| BR-005 | Better Auth session config | manual (cookie expiry visible in browser), documented config |
| §11 security | scrypt hashing, cookie defaults, origin check, no caching, no logging of secrets | assert-same-origin.test, sdd-reviewer |

## 11. Risks & Decisions

| Decision / risk | Choice and why | Alternatives considered |
|---|---|---|
| Better Auth's HTTP handler | **Not mounted.** Its endpoints (sign-in, admin/*) would bypass our rate limit and admin rules. `auth.api.*` works without it. | Mount it with `disabledPaths` (easy to miss a path when upgrading) |
| Admin plugin | **Not used.** Our own `role`/`isActive` fields and use cases keep all rules in one readable place. | Admin plugin (big unused surface: impersonation, ban expiry…) |
| Deactivated check | `session.create.before` hook, which runs after password verification | Checking before sign-in (would reveal account state with a wrong password) |
| Rate limit | Own `login_attempt` table counting failures per email+IP (Better Auth's limiter is per IP, counts all requests, and only runs on HTTP) | Better Auth `customRules` |
| Last-admin under concurrency | Transaction + `FOR UPDATE` lock on active admin rows | Re-checking after the update (racy) |
| Session caching | Cookie cache off; no `use cache: private` for the user. Each request costs one DB read, which is fine for a small team. | Short cache (would violate "immediately") |
| `server-only` in CLI contexts (`auth generate`, first-admin script) | Run with `--conditions=react-server`. **Verify in T001.** Fallback: a minimal schema-only config file for `auth generate`. | — |
| Version pin | `better-auth@1.7.6` exact (1.7.7 is under 2 weeks old) | latest |
| Forced change without the current password | The user just authenticated with the temporary password; we verify the new one differs from the stored hash | Asking for the temporary password again (the spec doesn't require it) |

## 12. Constitution Check (AGENTS.md)

- [x] Layers respect the dependency rule (§5.1): domain imports nothing from Next/Drizzle/Better Auth/env.
- [x] **S**: each file has one responsibility (one use case per file; one adapter per interface).
- [x] **O**: new user-management actions are new use-case files; error→HTTP mapping is a table keyed by error code.
- [x] **L**: fakes implement the same interfaces and throw the same domain errors as the real adapters.
- [x] **I**: small interfaces (`PasswordHasher`, `SessionRevoker`, `SessionReader`, `Authenticator`) instead of one "AuthService".
- [x] **D**: use cases receive interfaces; only `src/server/container.ts` builds Better Auth/Drizzle classes.
- [x] No speculative abstractions: every interface has a real implementation and a test fake.
- [x] Readability (§6): named constants for limits, typed errors, a JSDoc on each use case.
- [x] Next 16 (§11): `connection()` in route handlers, session reads inside Suspense, `proxy.ts`, no segment configs.
- [x] Security (§12): secrets server-only, no Better Auth HTTP surface, origin check, no password or token logging.
- [x] Every FR/AC is in the traceability matrix.

**Documentation updates included in this plan:**
- AGENTS.md §3 (new commands `auth:create-first-admin`, `test:integration`), §5.2 (the `auth`/`users` modules, `src/shared/http/`), §7 (`DATABASE_URL_TEST`)
- `.env.example` (`DATABASE_URL_TEST`)

## 13. Approval

- [x] Approved by the user on 2026-10-12
