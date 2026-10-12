---
id: "001"
title: "Authentication"
spec: ./spec.md
plan: ./plan.md
status: In Progress     # Draft | Approved | In Progress | Done
created: 2026-10-12
approved_at: 2026-10-12
---

# Tasks 001 — Authentication

## How to read this list

- Work top to bottom; a task starts only when everything in `depends_on` is checked.
- `[P]` = can run in parallel with other `[P]` tasks of the same phase (no shared files).
- Each task is small (≈ one commit) and has a **Done when** line that is objectively checkable.
- Tick `- [x]` only when **Done when** is satisfied. Write deviations under the task as `> Note:`.
- Paths: `users/` = `src/modules/users/`, `auth/` = `src/modules/auth/`.

## Phase 1 — Setup

- [x] **T001** — Install dependencies and verify CLI tooling with `server-only`
  - **Layer:** setup
  - **Files:** `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (if builds need approval)
  - **Depends on:** —
  - **Covers:** —
  - **Done when:** `better-auth` is pinned to exactly `1.7.6`, `tsx` is a dev dependency; a throwaway check confirms `tsx --conditions=react-server` can import a module that imports `server-only` (result recorded as a note; if it fails, note the fallback from plan §11); `pnpm typecheck` passes
  > Note: `tsx --conditions=react-server` imports `server-only` fine (fails without the flag, as expected) — plan §11 fallback not needed. No build-script approvals required.

- [x] **T002** — Test database and split unit/integration test runs
  - **Layer:** setup
  - **Files:** `docker/postgres/init-test-db.sql`, `docker-compose.yml`, `vitest.config.mts`, `vitest.integration.config.mts`, `tests/integration/global-setup.ts`, `package.json` (script `test:integration`), `.env.example` (`DATABASE_URL_TEST`)
  - **Depends on:** T001
  - **Covers:** plan §9
  - **Done when:** after recreating the Postgres container, database `wpp_crm_test` exists; `pnpm test` runs only unit tests (`*.test.ts`, excluding `*.integration.test.ts`); `pnpm test:integration` runs `*.integration.test.ts`, migrates the test DB in global setup, and exits 0 with no tests yet
  > Note: Deviation — no docker init script / no container recreation (init scripts only run on an empty volume; deleting it would destroy local data). Instead `tests/integration/global-setup.ts` creates `wpp_crm_test` if missing and runs migrations. The test DB URL is resolved once in `vitest.integration.config.mts` and given to workers as `DATABASE_URL`. Vitest skips global setup when there are no integration test files, so the first real migration of the test DB happens with T023.

- [x] **T003** [P] — Add shadcn/ui components
  - **Layer:** setup
  - **Files:** `src/components/ui/{input,label,table,dialog,alert-dialog,select,badge,dropdown-menu,skeleton,sonner,alert}.tsx` (generated)
  - **Depends on:** T001
  - **Covers:** spec §10
  - **Done when:** components exist; `pnpm typecheck && pnpm lint` pass
  > Note: 11 components generated, no manual edits. New deps: `sonner`, `next-themes` (sonner.tsx uses `useTheme`; works without a ThemeProvider, falls back to system theme). The `cn` dependency (from phase 1 shadcn init) is the official shadcn package.

## Phase 2 — Domain (tests first)

- [x] **T004** [P] — User types and email normalization
  - **Layer:** domain
  - **Files:** `users/domain/user.ts`, `users/domain/normalize-email.ts`, `users/domain/normalize-email.test.ts`
  - **Depends on:** T001
  - **Covers:** BR-001, AC-1.6, spec §8
  - **Done when:** tests cover trimming, lower-casing and mixed input; they pass

- [x] **T005** [P] — Password policy
  - **Layer:** domain
  - **Files:** `users/domain/password-policy.ts`, `users/domain/password-policy.test.ts`, `users/domain/errors.ts` (create with `PasswordPolicyError`)
  - **Depends on:** T001
  - **Covers:** BR-002, AC-4.3, AC-7.3
  - **Done when:** tests for 9, 10, 128 and 129 characters pass; limits are named constants

- [x] **T006** — Users domain errors, permissions and admin protections
  - **Layer:** domain
  - **Files:** `users/domain/errors.ts` (all errors from plan §3), `users/domain/permissions.ts`, `users/domain/permissions.test.ts`, `users/domain/admin-protections.ts`, `users/domain/admin-protections.test.ts`
  - **Depends on:** T004, T005
  - **Covers:** BR-008, BR-009, BR-012, AC-8.3, AC-8.4, AC-9.3, AC-9.4, AC-10.2
  - **Done when:** tests cover: admin acting on another user (allowed), on self (rejected), demoting/deactivating the last active admin (rejected), with 2 admins (allowed), agent is not admin; they pass

- [x] **T007** — Users domain interfaces
  - **Layer:** domain
  - **Files:** `users/domain/user-repository.ts`, `users/domain/user-transaction-runner.ts`, `users/domain/password-hasher.ts`, `users/domain/credential-repository.ts`, `users/domain/session-revoker.ts`
  - **Depends on:** T004
  - **Covers:** plan §3
  - **Done when:** interfaces have JSDoc explaining their purpose; `pnpm typecheck` passes
  > Note: `UserTransactionRunner.run` gives `{ users, credentials }` (plan §3 only listed `users`) so creating a user and its credential is atomic.

- [x] **T008** [P] — Auth domain errors and login-attempt policy
  - **Layer:** domain
  - **Files:** `auth/domain/errors.ts`, `auth/domain/login-attempt-policy.ts`, `auth/domain/login-attempt-policy.test.ts`
  - **Depends on:** T001
  - **Covers:** BR-004, AC-1.5
  - **Done when:** tests for 4 failures (not blocked) and 5 failures (blocked) pass; limits are named constants

- [x] **T009** — Auth domain interfaces and `CurrentUser`
  - **Layer:** domain
  - **Files:** `auth/domain/authenticator.ts`, `auth/domain/session-reader.ts`, `auth/domain/login-attempt-repository.ts`, `auth/domain/current-user.ts`
  - **Depends on:** T004, T008
  - **Covers:** plan §3
  - **Done when:** `pnpm typecheck` passes

## Phase 3 — Application (use cases with fakes)

- [x] **T010** — In-memory fakes for the users module
  - **Layer:** application (test support)
  - **Files:** `users/application/testing/in-memory-user-repository.ts` (also implements the transaction runner), `users/application/testing/in-memory-credential-repository.ts`, `users/application/testing/fake-password-hasher.ts`, `users/application/testing/spy-session-revoker.ts`
  - **Depends on:** T006, T007
  - **Covers:** AGENTS.md §13 (fakes honor the same contracts — Liskov)
  - **Done when:** `pnpm typecheck` passes; fakes throw the same domain errors as the real implementations will (e.g. duplicate email → `EmailAlreadyInUseError`)
  > Note: Extra files: `testing/build-user.ts` (test user factory) and `testing/in-memory-user-repository.test.ts` (proves the fakes honor the contract — AGENTS.md §5.3 L). Open point for T023: define `CredentialRepository` behavior for a duplicate `createForUser` and `setPasswordHash` on an unknown user, then align the fake.

- [x] **T011** [P] — `createFirstAdmin`
  - **Layer:** application
  - **Files:** `users/application/create-first-admin.ts`, `users/application/create-first-admin.test.ts`
  - **Depends on:** T010
  - **Covers:** FR-018, AC-11.1, AC-11.2, BR-014
  - **Done when:** tests pass: creates an active admin with `mustChangePassword = true` and hashed password; refuses with `FirstAdminAlreadyExistsError` when an admin exists; rejects a weak password
  > Note: Use-case convention set here for all use cases: factory `makeX(dependencies)` returning `async function x(input)` (AGENTS.md example to be updated in T040). Dependencies are `{ transactionRunner, passwordHasher }` so the admin check and both writes are atomic. Accepted risk: two setup commands run at the exact same moment could both pass the check (manual one-off command).

- [x] **T012** [P] — `createUser`
  - **Layer:** application
  - **Files:** `users/application/create-user.ts`, `users/application/create-user.test.ts`
  - **Depends on:** T010
  - **Covers:** FR-014, AC-7.1, AC-7.2, AC-7.3, AC-7.5, BR-001, BR-012
  - **Done when:** tests pass: success (normalized email, temporary password), duplicate email (case-insensitive), weak password, non-admin actor → `ForbiddenError`
  > Note: Extra file `users/domain/actor.ts` (`Actor = Pick<User, "id" | "role">`, reused by T013–T016). Dependencies `{ transactionRunner, passwordHasher }` for atomic user + credential creation.

- [x] **T013** [P] — `listUsers`
  - **Layer:** application
  - **Files:** `users/application/list-users.ts`, `users/application/list-users.test.ts`
  - **Depends on:** T010
  - **Covers:** FR-013, AC-6.1, AC-6.2, AC-6.3, AC-6.4, BR-012
  - **Done when:** tests pass: search by name/email (case-insensitive), role and status filters combined, empty result, non-admin → `ForbiddenError`

- [x] **T014** [P] — `updateUser`
  - **Layer:** application
  - **Files:** `users/application/update-user.ts`, `users/application/update-user.test.ts`
  - **Depends on:** T010
  - **Covers:** FR-015, AC-8.1, AC-8.3, AC-8.4, AC-8.5, BR-008, BR-009, BR-010
  - **Done when:** tests pass: rename + role change of another user; own role change rejected; demoting last active admin rejected; email cannot be changed (not part of the input); unknown user → `UserNotFoundError`

- [x] **T015** [P] — `deactivateUser` and `reactivateUser`
  - **Layer:** application
  - **Files:** `users/application/deactivate-user.ts`, `users/application/deactivate-user.test.ts`, `users/application/reactivate-user.ts`, `users/application/reactivate-user.test.ts`
  - **Depends on:** T010
  - **Covers:** FR-016, AC-9.1, AC-9.2, AC-9.3, AC-9.4, BR-006, BR-008, BR-009
  - **Done when:** tests pass: deactivation sets inactive **and** revokes all sessions (spy); self and last-admin rejected; reactivation sets active and keeps the password

- [x] **T016** [P] — `resetUserPassword`
  - **Layer:** application
  - **Files:** `users/application/reset-user-password.ts`, `users/application/reset-user-password.test.ts`
  - **Depends on:** T010
  - **Covers:** FR-017, AC-10.1, AC-10.2, BR-006
  - **Done when:** tests pass: new hash stored, `mustChangePassword = true`, all sessions revoked; self-reset rejected; weak password rejected

- [x] **T017** — In-memory fakes for the auth module
  - **Layer:** application (test support)
  - **Files:** `auth/application/testing/fake-authenticator.ts`, `auth/application/testing/fake-session-reader.ts`, `auth/application/testing/in-memory-login-attempt-repository.ts`
  - **Depends on:** T009, T010
  - **Covers:** AGENTS.md §13
  - **Done when:** `pnpm typecheck` passes
  > Note: Extra contract test `auth/application/testing/fake-authenticator.test.ts` (wrong password, unknown email and inactive+wrong password all give the same error; disabled only after a correct password; attempt counting per email+IP).

- [x] **T018** — `logIn`
  - **Layer:** application
  - **Files:** `auth/application/log-in.ts`, `auth/application/log-in.test.ts`
  - **Depends on:** T017
  - **Covers:** FR-001, FR-002, FR-003, FR-004, AC-1.1, AC-1.2, AC-1.3, AC-1.4, AC-1.5, AC-1.6, AC-1.7, BR-003, BR-004
  - **Done when:** tests pass: success clears failures and records last login and returns `mustChangePassword`; wrong password records a failure; disabled account does **not** record a failure; 6th attempt after 5 failures is blocked even with the correct password; email is normalized

- [x] **T019** — `logOut`, `getCurrentUser`, `requireCurrentUser`
  - **Layer:** application
  - **Files:** `auth/application/log-out.ts`, `auth/application/get-current-user.ts`, `auth/application/require-current-user.ts`, `auth/application/get-current-user.test.ts`, `auth/application/require-current-user.test.ts`, `auth/application/log-out.test.ts`
  - **Depends on:** T017
  - **Covers:** FR-005, FR-006, FR-007, FR-010, AC-2.1, AC-3.4, AC-3.5, AC-4.1, BR-007, BR-011, BR-012
  - **Done when:** tests pass: no session → null/`UnauthenticatedError`; inactive user → null; role read fresh from the repository; admin-only check → `ForbiddenError` for agents; `mustChangePassword` → `PasswordChangeRequiredError` unless `allowPendingPasswordChange`

- [x] **T020** — `changeOwnPassword`
  - **Layer:** application
  - **Files:** `auth/application/change-own-password.ts`, `auth/application/change-own-password.test.ts`
  - **Depends on:** T017
  - **Covers:** FR-010, FR-011, FR-012, AC-4.2, AC-4.3, AC-5.2, AC-5.3, AC-5.5, BR-002, BR-013
  - **Done when:** tests pass: "Mi cuenta" mode requires the correct current password; forced mode needs no current password; new = current rejected; policy enforced; `mustChangePassword` cleared; other sessions revoked, current kept
  > Note: Mode (forced vs "Mi cuenta") is decided by the stored `mustChangePassword`, never by whether `currentPassword` was sent (security). The stored hash is read in a short separate transaction so none stays open during slow hashing; dependencies are `{ transactionRunner, passwordHasher, sessionRevoker }`.

- [x] **T021** [P] — `updateOwnName`
  - **Layer:** application
  - **Files:** `auth/application/update-own-name.ts`, `auth/application/update-own-name.test.ts`
  - **Depends on:** T017
  - **Covers:** FR-011, AC-5.1
  - **Done when:** tests pass: name trimmed and saved; empty name rejected with a validation error
  > Note: Added `EmptyNameError` (`NAME_REQUIRED`) to `users/domain/errors.ts`.

## Phase 4 — Infrastructure

- [x] **T022** — Better Auth instance and database schema
  - **Layer:** infrastructure
  - **Files:** `auth/infrastructure/better-auth.ts`, `src/shared/db/schema/auth.ts` (generated), `src/shared/db/schema/login-attempts.ts`, `src/shared/db/schema/index.ts`, `drizzle/0000_authentication.sql` (+ hand-added constraints migration), `drizzle/meta/*`
  - **Depends on:** T002, T009
  - **Covers:** BR-001, BR-005, BR-006, AC-1.3, spec §8, §11
  - **Done when:** config matches plan §5 (sign-up disabled, 10/128, 30-day sliding session, cookie cache off, `session.create.before` disabled-account hook, `nextCookies()` last, **no HTTP route**); schema generated by `auth@1.7.6 generate`; migration reviewed and applied with `pnpm db:migrate` to the dev DB and by `pnpm test:integration` setup to the test DB; role CHECK and `lower(email)` unique index exist; `pnpm typecheck` passes
  > Note: Plan §11 fallback used — the Better Auth CLI ignores `--conditions=react-server`, so the schema is generated from `auth/infrastructure/better-auth-schema.config.ts` (schema-only, no `server-only`); shared options live in `better-auth-schema-options.ts`. Regenerate: `pnpm dlx auth@1.7.6 generate --config src/modules/auth/infrastructure/better-auth-schema.config.ts --output src/shared/db/schema/auth.ts -y`. Generated tables use `timestamp` (no tz) — accepted by the user as a documented exception (UTC by convention); our own tables use timestamptz. Document both in AGENTS.md §9 (T040). Migrations 0000_authentication + 0001_auth_constraints applied to dev and test DBs; smoke-tested disabled-account behavior.

- [x] **T023** — `DrizzleUserRepository` and `DrizzleCredentialRepository`
  - **Layer:** infrastructure
  - **Files:** `users/infrastructure/drizzle-user-repository.ts`, `users/infrastructure/drizzle-credential-repository.ts`, `users/infrastructure/drizzle-user-repository.integration.test.ts`
  - **Depends on:** T022, T010
  - **Covers:** FR-004, FR-013, FR-014, AC-6.2, AC-6.3, AC-7.2, BR-001
  - **Done when:** integration tests pass against `wpp_crm_test`: create + find, duplicate email (any case) → `EmailAlreadyInUseError`, list with search/filters, `recordLogin`, `countAdmins`
  > Note: Repositories receive the database in the constructor (type-only `src/shared/db/database.ts`); integration helper `tests/integration/test-database.ts` (create/reset/close). Credential contract settled: hash in `account` row with `provider_id='credential'` and `account_id=user_id` (as Better Auth 1.7.6 expects); second `createForUser` → Error; `setPasswordHash` without credential → `UserNotFoundError` — in-memory fake aligned. Search escapes `%`/`_`. Known gap: DB collation vs `localeCompare` sort order may differ for accents.

- [x] **T024** — `DrizzleUserTransactionRunner` (last-admin lock)
  - **Layer:** infrastructure
  - **Files:** `users/infrastructure/drizzle-user-transaction-runner.ts`, `users/infrastructure/drizzle-user-transaction-runner.integration.test.ts`
  - **Depends on:** T023
  - **Covers:** BR-008 under concurrency, spec §12
  - **Done when:** integration test runs two **parallel** `deactivateUser` calls where each of the only two admins deactivates the other → exactly one succeeds, one fails with `LastActiveAdminError`, one active admin remains
  > Note: Extra file `drizzle-locking-user-repository.ts` (`SELECT … FOR UPDATE ORDER BY id`); base repo field made `protected`. Race made real with a test-only runner that waits 200 ms after locking; mutation check (removing `FOR UPDATE`) makes both race tests fail. Also covers parallel demotions, rollback and atomic commit.

- [x] **T025** [P] — `DrizzleLoginAttemptRepository`
  - **Layer:** infrastructure
  - **Files:** `auth/infrastructure/drizzle-login-attempt-repository.ts`, `auth/infrastructure/drizzle-login-attempt-repository.integration.test.ts`
  - **Depends on:** T022
  - **Covers:** FR-003, BR-004
  - **Done when:** integration tests pass: failures counted per email+IP only inside the window; `clearFailures` resets only that pair

- [x] **T026** — Better Auth adapters
  - **Layer:** infrastructure
  - **Files:** `auth/infrastructure/better-auth-authenticator.ts`, `auth/infrastructure/better-auth-session-reader.ts`, `auth/infrastructure/better-auth-password-hasher.ts`, `auth/infrastructure/better-auth-session-revoker.ts`, `auth/infrastructure/better-auth-adapters.integration.test.ts`
  - **Depends on:** T023
  - **Covers:** FR-001, FR-002, FR-005, FR-012, FR-016, FR-017, AC-1.2, AC-1.3, BR-003, BR-006, BR-013
  - **Done when:** integration tests pass: sign-in OK returns userId and a session; wrong password → `InvalidCredentialsError`; inactive user + correct password → `AccountDisabledError` and no session row; `revokeAllForUser` → `getCurrentSession` returns null; `revokeAllForUserExcept` keeps only the given session; hasher verify(hash(x), x) is true
  > Note: Approved refactor — all Better Auth options moved to `create-better-auth.ts` (factory: database, secret, baseURL, plugins; no env/server-only); `better-auth.ts` now only builds the app instance with `nextCookies()`. Adapters take the instance in the constructor. `revokeAllForUserExcept` loops because Better Auth lists at most 100 sessions per call (tested with 105, mutation-checked). Better Auth's signOut only logs DB errors (library behavior). Tests prove Better Auth accepts credentials stored by our repositories.

- [x] **T027** — Composition root
  - **Layer:** infrastructure
  - **Files:** `src/server/container.ts`
  - **Depends on:** T011–T016, T018–T021, T024, T025, T026
  - **Covers:** AGENTS.md §5.3 (D)
  - **Done when:** every use case from plan §4 is exported ready-to-use; only this file instantiates Drizzle/Better Auth classes (`grep` confirms); `pnpm typecheck` passes
  > Note: 13 use cases exported; repositories/adapters stay private. No standalone `credentialRepository` (credentials are reached through the transaction runner). Plan §4 dependency column is outdated (use cases take `transactionRunner` instead of separate repositories) — to be reflected in the docs (T040).

- [x] **T028** — First-admin setup command
  - **Layer:** infrastructure (script)
  - **Files:** `scripts/create-first-admin.ts`, `package.json` (script `auth:create-first-admin`)
  - **Depends on:** T027
  - **Covers:** FR-018, AC-11.1, AC-11.2, AC-11.3
  - **Done when:** on the dev DB, running it with `--name --email` and a hidden password prompt creates an admin; running it again prints a refusal and exits non-zero; the password never appears in the terminal output
  > Note: Verified against the TEST database (the user creates their real first admin during T043). Password never appears in output (grep + pseudo-terminal check). Orchestrator follow-up: `env.ts` errors now carry the name `InvalidEnvironmentError`, and the script shows the missing variable NAMES (never values) instead of a generic error when `.env.local` is missing/incomplete.

## Phase 5 — HTTP, pages & UI

- [x] **T029** [P] — Shared HTTP helpers
  - **Layer:** app (shared)
  - **Files:** `src/shared/http/json-error-response.ts`, `src/shared/http/assert-same-origin.ts`, `src/shared/http/get-client-ip.ts`, `src/shared/http/safe-redirect-path.ts`, and a `*.test.ts` for each
  - **Depends on:** T006, T008
  - **Covers:** FR-008, FR-009, AC-3.4, AC-3.5, spec §11 (CSRF, open-redirect safety)
  - **Done when:** tests pass: each domain error code maps to the status in plan §7; unknown errors → 500 without details; cross-origin mutation rejected; `safeRedirectPath` accepts `/users` and rejects `//evil.com` and `https://…`
  > Note: Extra files `request-validation-error.ts` + `parse-json-body.ts` (Zod body validation → 422 with fieldErrors). Error→status table also covers NAME_REQUIRED and NEW_PASSWORD_SAME_AS_CURRENT (422); a test fails if a new error class has no row. CSRF: cross-site Origin/Sec-Fetch-Site rejected, no-Origin clients (curl) allowed. DEPLOYMENT REQUIREMENT (document in T040): `getClientIp` trusts X-Forwarded-For/X-Real-IP, so production must run behind a proxy that overwrites them, or the login limit (BR-004) can be bypassed.

- [x] **T030** — REST: `/api/session`
  - **Layer:** app
  - **Files:** `src/app/api/session/route.ts`
  - **Depends on:** T027, T029
  - **Covers:** FR-001–FR-005, FR-008, AC-1.1–AC-1.5, AC-2.1, AC-3.4
  - **Done when:** with curl against `pnpm dev`: POST with valid credentials returns 200 + session cookie; wrong password → 401 `INVALID_CREDENTIALS`; GET with cookie returns the user; DELETE ends the session (subsequent GET → 401)
  > Note: Better Auth's `nextCookies()` sets/clears the cookie in route handlers too (HttpOnly, SameSite=lax, 30 days), so the Authenticator interface stays unchanged. Verified with curl against the test DB: login, current user, logout, 401/422/403, and the 6th attempt → 429 even with the correct password afterwards.

- [x] **T031** [P] — REST: `/api/account` and `/api/account/password`
  - **Layer:** app
  - **Files:** `src/app/api/account/route.ts`, `src/app/api/account/password/route.ts`
  - **Depends on:** T030
  - **Covers:** FR-008, FR-010, FR-011, FR-012, AC-5.1–AC-5.3
  - **Done when:** curl: PATCH name → 200; password change with wrong current → 422 `WRONG_CURRENT_PASSWORD`; without cookie → 401
  > Note: Verified with curl against the test DB, including the forced change (pending change → 403 on other routes), NAME_REQUIRED, PASSWORD_POLICY reason, and BR-013 (other session logged out, current kept).

- [x] **T032** [P] — REST: `/api/users` and sub-routes
  - **Layer:** app
  - **Files:** `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts`, `src/app/api/users/[id]/deactivate/route.ts`, `src/app/api/users/[id]/reactivate/route.ts`, `src/app/api/users/[id]/reset-password/route.ts`
  - **Depends on:** T030
  - **Covers:** FR-007, FR-008, FR-013–FR-017, AC-3.5
  - **Done when:** curl: as admin, list/create/edit/deactivate/reactivate/reset succeed; as agent every route → 403 `FORBIDDEN`; without cookie → 401; demoting the last admin → 409 `LAST_ACTIVE_ADMIN`
  > Note: Extra files: `src/app/api/users/user-json.ts` (shared user JSON, no password data), `src/app/api/users/[id]/user-id-params.ts` (Next 16 params), `src/shared/http/parse-search-params.ts` (+ test); `toFieldErrors` exported from `parse-json-body.ts`. PATCH uses `.strict()` so sending `email` → 422 (BR-010). `LAST_ACTIVE_ADMIN` is unreachable with sequential requests (the caller is always an active admin); reproduced over HTTP with parallel requests (one admin always remains) and covered by the T024 integration test.

- [x] **T033** [P] — `proxy.ts` optimistic redirect
  - **Layer:** app
  - **Files:** `src/proxy.ts`
  - **Depends on:** T022
  - **Covers:** AC-3.1, FR-009
  - **Done when:** opening `/users` without a cookie redirects to `/login?redirectTo=%2Fusers`; `/login`, `/api/session` and static assets are not redirected
  > Note: Exclusions live in `config.matcher` (whole-path matches: `/loginx` is still protected). Uses `getSessionCookie` from `better-auth/cookies` (no server instance, no env). Optimistic only — the server guard is the real check.

- [x] **T034** — Login page
  - **Layer:** app / ui
  - **Files:** `auth/ui/messages.ts`, `auth/ui/login-form.tsx`, `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/actions.ts`
  - **Depends on:** T027, T029, T003
  - **Covers:** AC-1.1–AC-1.6, FR-009, spec §10 (Login)
  - **Done when:** in the browser: exact Spanish messages for wrong credentials, disabled account and too many attempts; button disabled while sending; successful login goes to `redirectTo` (if safe) or `/inbox`; temporary-password user goes to `/change-password`
  > Note: UI PATTERN for T035–T039: the page passes the Server Action to the form component as a prop; form state/action types live in `src/modules/<module>/ui/*-state.ts`, so `ui/` never imports from `src/app/`. Extra: root layout `lang="es"` + title "WPP CRM"; `ui/login-form-state.ts`. Spanish texts not given by the spec (password policy, same password, name required, confirmation mismatch) were written by us. Verified: build passes, HTML renders labels and the sanitized redirectTo; interactive behavior is checked by the user in T043.

- [x] **T035** — Forced change-password page
  - **Layer:** app / ui
  - **Files:** `auth/ui/change-password-form.tsx`, `src/app/(auth)/change-password/page.tsx`, `src/app/(auth)/change-password/actions.ts`
  - **Depends on:** T034
  - **Covers:** AC-4.2, AC-4.3, FR-010
  - **Done when:** in the browser: policy, mismatch and same-as-temporary messages appear; a valid change lands on `/inbox`
  > Note: Extra file `ui/change-password-form-state.ts` (UI pattern). Guards inside `<Suspense>` redirect via a streamed redirect (HTTP 200 + client redirect, as documented for Next 16 streaming) instead of a 307. Page only serves users with a pending change; others go to `/inbox`.

- [x] **T036** — App shell, guard, placeholders and logout
  - **Layer:** app / ui
  - **Files:** `src/components/app-shell/app-shell.tsx`, `src/components/app-shell/nav-links.tsx`, `src/components/app-shell/user-menu.tsx`, `src/components/forbidden-view.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/log-out-action.ts`, `src/app/(app)/{inbox,contacts,templates}/page.tsx`, `src/app/page.tsx`
  - **Depends on:** T034
  - **Covers:** FR-006, FR-019, AC-2.1, AC-2.2, AC-3.1, AC-3.2, AC-3.6, AC-4.1, BR-011
  - **Done when:** in the browser: shell shows name, role, "Mi cuenta", "Cerrar sesión"; agents don't see "Usuarios"; placeholders show "Próximamente"; logout returns to `/login` and back/refresh shows login; a temporary-password user is always sent to `/change-password`; `pnpm build` passes (no Cache Components errors)
  > Note: Extra: `proxy.ts` forwards `x-current-path` (overwriting any client value; re-sanitized) and `src/shared/http/current-path-header.ts`, so an expired session returns to the same page (AC-3.6). UserMenu is inline (not a dropdown) so logout works without JS. Protected pages send `Cache-Control: private, no-cache, no-store`. SECURITY RULE (add to AGENTS.md in T040): a layout guard is NOT enough in the App Router (pages render independently and layouts don't re-run on client navigation) — every page/action with real data must call `requireCurrentUser` itself. Logout + back button are checked manually in T043.

- [x] **T037** — "Mi cuenta" page
  - **Layer:** app / ui
  - **Files:** `auth/ui/account-name-form.tsx`, `auth/ui/account-password-form.tsx`, `src/app/(app)/account/page.tsx`, `src/app/(app)/account/actions.ts`
  - **Depends on:** T036
  - **Covers:** US-5, AC-5.1–AC-5.5
  - **Done when:** in the browser: name change visible after reload; wrong current password message; successful change keeps this session and logs out a second browser
  > Note: Page + both actions call `requireCurrentUser` themselves (security rule from T036). Extra: `auth/ui/account-form-state.ts`, `users/ui/role-labels.ts` (shared Spanish role labels; user-menu updated). Uses Next 16 `refresh()` after renaming. Server Action behavior (rename visible, wrong-password message, second browser logged out) is checked by the user in T043. Duplicated guard helpers and `FieldError` are extracted in T038.

- [x] **T038** — Users list page
  - **Layer:** app / ui
  - **Files:** `users/ui/messages.ts`, `users/ui/users-table.tsx`, `users/ui/users-filters.tsx`, `src/app/(app)/users/page.tsx`
  - **Depends on:** T036
  - **Covers:** US-6, AC-6.1–AC-6.4, AC-3.3
  - **Done when:** in the browser as admin: table columns and status labels as in AC-6.1, "Nunca" for no login; search and filters update the URL and combine; empty state with "clear filters"; as agent the page shows "No tienes permiso para ver esta página"
  > Note: Approved refactors: shared guard `src/server/require-signed-in-user.ts` (used by /account and /users) and shared `src/components/field-error.tsx`. Display-status precedence: inactive wins over pending change. Search runs on Enter/"Buscar" (no per-keystroke requests). Found a filter/label mismatch → fixed in T038b.

- [x] **T038b** — Fix: status filter must match the displayed status label
  - **Layer:** infrastructure + application testing
  - **Files:** `src/modules/users/infrastructure/drizzle-user-repository.ts` (+ its integration test), `src/modules/users/application/testing/in-memory-user-repository.ts` (+ its test), `src/modules/users/domain/user.ts` (JSDoc of the filter)
  - **Depends on:** T038
  - **Covers:** AC-6.1, AC-6.3
  - **Done when:** filter `active` = active AND no pending change; `must_change_password` = active AND pending change; `inactive` = every inactive user — same in the Drizzle repository and the in-memory fake, covered by their tests
  > Note: `list-users.test.ts` expectation updated to the new meaning (an active user with a pending change is no longer under `active`). JSDoc of `user-repository.ts` `list()` updated too.

- [x] **T039** — User management dialogs
  - **Layer:** app / ui
  - **Files:** `users/ui/create-user-dialog.tsx`, `users/ui/edit-user-dialog.tsx`, `users/ui/reset-password-dialog.tsx`, `users/ui/toggle-user-status-dialog.tsx`, `src/app/(app)/users/actions.ts`
  - **Depends on:** T038
  - **Covers:** US-7–US-10, AC-7.1–AC-7.4, AC-8.1–AC-8.5, AC-9.1–AC-9.5, AC-10.1, AC-10.2
  - **Done when:** in the browser: create (duplicate email message, double-click creates one user), edit (own role control disabled with explanation, email read-only, last-admin message), deactivate/reactivate with confirmation naming the user, reset password; no self-deactivate/self-reset actions offered
  > Note: Extra file `users/ui/user-dialogs-state.ts`; `RoleSelect`/`TemporaryPasswordField` exported from `create-user-dialog.tsx` and reused. Every action calls the admin guard first. Row actions are inline buttons (visible in server HTML; own row shows only "Editar"). Spanish validation texts not in the spec were written by us. Dialog submissions are checked by the user in T043.

## Phase 6 — Documentation & verification

- [x] **T040** — Update project documentation
  - **Layer:** docs
  - **Files:** `AGENTS.md` (§3 commands `auth:create-first-admin`, `test:integration`; §5.2 `auth`/`users` modules and `src/shared/http/`; §7 `DATABASE_URL_TEST`), `README.md`, `.env.example`
  - **Depends on:** T028, T039
  - **Covers:** AGENTS.md §14.4–14.5
  - **Done when:** the docs match the implemented commands, paths and env vars
  > Note: AGENTS.md updated (§3 commands + Better Auth regenerate command, §5.2 map, §5.3 `makeX` + UI pattern, §7 DATABASE_URL_TEST + InvalidEnvironmentError, §9 timestamp exception + Better Auth as library + repo DI, §12 page/action guard rule + same-origin + reverse-proxy deployment requirement, §13 integration tests + test budget). README rewritten (setup, first admin, REST API table).

- [x] **T041** — Full checks
  - **Depends on:** T040
  - **Done when:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration` and `pnpm build` all pass
  > Note: Full suite run at the end of Phase 5 (2026-10-12): typecheck ✅, lint ✅, 189 unit ✅, 44 integration ✅, build ✅ (18 routes). Only docs/comments changed afterwards — re-ran typecheck + lint ✅.

- [x] **T042** — Review
  - **Depends on:** T041
  - **Done when:** `sdd-reviewer` reports verdict APPROVE (blocking findings fixed through added `Fix:` tasks; non-blocking ones moved to `TODO.md`)
  > Note: Reviewer verdict CHANGES REQUIRED (2 MAJOR, 7 MINOR). The user then declared the project an internal demo (AGENTS.md "Project context"): hardening findings (concurrent login-limit bypass, session cookie not sliding in the browser, possible token/hash in error logs) moved to TODO.md "Production hardening"; placeholder pages without their own guard accepted (no data). Nav label "Bandeja" confirmed by the user (FR-019). Layer violations + small cleanups fixed in T042b.

- [x] **T042b** — Fix: review findings (layer rules + cleanups)
  - **Layer:** cross-cutting
  - **Files:** `src/modules/users/ui/messages.ts`, `src/modules/auth/ui/messages.ts`, `src/shared/http/assert-same-origin.ts`, `src/shared/http/json-error-response.ts`, `src/shared/errors/*`, `src/server/require-signed-in-user.ts`, `src/app/(app)/users/{page.tsx,actions.ts}`, `scripts/create-first-admin.ts`, `vitest.integration.config.mts`
  - **Depends on:** T042
  - **Covers:** AGENTS.md §5.1, §5.3, §7
  - **Done when:** `users` no longer imports `auth`; `shared/` no longer imports any module; one shared admin-or-null guard; script uses a `--debug` flag instead of `process.env.DEBUG`; stale comment fixed; targeted tests + typecheck + lint pass
  > Note: `ForbiddenError` moved to `src/shared/errors/` (re-exported from users domain); `AppError` gained optional public `details` (used for `reason`). Only a test file in `src/shared/http` imports modules (completeness check of the error→status table) — accepted. `passWithNoTests` removed from the integration config.

- [x] **T043** — Manual end-to-end check (with the user)
  - **Depends on:** T042
  - **Covers:** spec §13 (steps 1–9), FR-008 via curl
  - **Done when:** the user confirms every step of spec §13 on a fresh database, plus: curl login as agent → `GET /api/users` returns 403
  > Note: Marked done by the user on 2026-10-12. Visual polish was not part of this spec (the UI design-skill rule, AGENTS.md §4.1, was added afterwards) — recorded in TODO.md.

## Phase 7 — UI polish (addendum 2026-10-12, AGENTS.md §4.1)

All UI tasks follow plan §7b Design and the `frontend-design` skill. Behavior must not change.

- [x] **T044** — Visual system: theme tokens and typeface
  - **Layer:** ui
  - **Files:** `src/app/globals.css`, `src/app/layout.tsx`
  - **Depends on:** —
  - **Covers:** plan §7b
  - **Done when:** shadcn tokens (light theme) map to the §7b palette, radius tokens follow the role rules, Instrument Sans is loaded via `next/font` and used as `--font-sans`; typecheck + lint pass
  > Note: Status badge tokens added (`bg-status-active|pending|inactive` + foregrounds), `rounded-bubble` token, Geist removed. Lagoon darkened to `#0B7A6D` for 4.5:1 contrast (plan changelog). Dark theme untouched (out of scope).

- [x] **T045** [P] — Auth screens (login, change password)
  - **Layer:** ui
  - **Files:** `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/change-password/page.tsx`, `src/modules/auth/ui/login-form.tsx`, `src/modules/auth/ui/change-password-form.tsx`, new `src/components/auth-conversation-panel.tsx`
  - **Depends on:** T044
  - **Covers:** spec §10 (Login, Change password), plan §7b
  - **Done when:** split layout with the pine-ink conversation panel (stacks on mobile, form first); forms restyled; texts/behavior unchanged; build passes
  > Note: New `components/auth-conversation-panel.tsx` (bubbles `aria-hidden`, wordmark + sentence readable; collapses to a wordmark strip on mobile). Titles use `text-sidebar` for Pine ink → unify in the token consolidation. Build checked at phase end.

- [x] **T046** [P] — App shell (sidebar) and placeholders
  - **Layer:** ui
  - **Files:** `src/components/app-shell/{app-shell,nav-links,user-menu}.tsx`, `src/app/(app)/layout.tsx` (skeleton only), `src/app/(app)/{inbox,contacts,templates}/page.tsx`, `src/components/forbidden-view.tsx`
  - **Depends on:** T044
  - **Covers:** FR-019, AC-3.2, plan §7b
  - **Done when:** 240px pine-ink sidebar (app name, nav with mint active state, user name/role + "Cerrar sesión" at the bottom); top bar on < 768px; placeholders and forbidden view restyled; "Usuarios" still admin-only; build passes
  > Note: Sidebar actions use token classes (shadcn Button variants assume light backgrounds). Name/role hidden in the mobile top bar below 640px. Placeholder sentences added. Titles use `text-foreground` → unify in the token consolidation; repeated empty-state markup → shared `EmptyState` in the consolidation.

- [x] **T047** [P] — "Mi cuenta"
  - **Layer:** ui
  - **Files:** `src/app/(app)/account/page.tsx`, `src/modules/auth/ui/account-name-form.tsx`, `src/modules/auth/ui/account-password-form.tsx`
  - **Depends on:** T044
  - **Covers:** US-5 (visual), plan §7b
  - **Done when:** page restyled per §7b (title, read-only email/role, two form sections); behavior unchanged; build passes
  > Note: Two helper sentences added. Uses arbitrary 13/15/18px sizes and `text-secondary-foreground` for Pine ink titles → consolidated into named tokens after T045–T048.

- [x] **T048** [P] — Usuarios (header, filters, table, badges, dialogs)
  - **Layer:** ui
  - **Files:** `src/app/(app)/users/page.tsx`, `src/modules/users/ui/{users-table,users-filters,create-user-dialog,edit-user-dialog,reset-password-dialog,toggle-user-status-dialog}.tsx`, `src/components/ui/badge.tsx` (variants only, if needed)
  - **Depends on:** T044
  - **Covers:** US-6–US-10 (visual), plan §7b
  - **Done when:** page restyled per §7b; status badges use the three tints; dates tabular; row actions compact and keyboard-accessible; behavior unchanged; build passes
  > Note: Badge variants `statusActive|statusPending|statusInactive`; dialogs got a "Cancelar" button (closes only); confirm button destructive only for deactivation; exports `USERS_PANEL_CLASS`, `FIELD_LABEL_CLASS`.

- [x] **T048b** — Consolidate the visual system (tokens + shared empty state)
  - **Layer:** ui
  - **Files:** `src/app/globals.css`, new `src/components/empty-state.tsx`, `src/components/ui/dialog.tsx` (sr-only label only), and the T045–T048 files that use arbitrary sizes / title colors
  - **Depends on:** T045, T046, T047, T048
  - **Covers:** plan §7b
  - **Done when:** one `text-title` token (Pine ink) and named size tokens (`text-meta` 13 · `text-body` 15 · `text-section` 18 · `text-page` 24 · `text-display` 32) replace arbitrary `text-[NNpx]` values and the mixed title classes; placeholders/forbidden view use `EmptyState`; dialog close label reads "Cerrar"; grep finds no `text-[1`/`text-[2`/`text-[3` px values in src (outside components/ui); typecheck + lint pass
  > Note: `src/lib/utils.ts` `cn` configured (via `createCn`) so `text-meta|body|section|page|display` merge as font sizes, not colors — approved scope addition. Dialog titles also use `text-title`; visible DialogFooter "Close" → "Cerrar". Users-table empty/error states keep their own pattern.

- [x] **T049** — Web interface guidelines review
  - **Depends on:** T045–T048
  - **Done when:** `web-design-guidelines` skill run on the changed UI files; real issues fixed; the rest in TODO.md
  > Note: Findings: identical row-action names, iOS input zoom, `<aside>` landmark, missing skip link, focus lost after failed submits, plus small items (spellCheck, sidebar overflow, double success announcement). All fixed in T049b; only vendor `transition-all` and theme-color left (cosmetic).

- [x] **T049b** — Fix: web interface guidelines findings
  - **Layer:** ui
  - **Files:** `src/modules/users/ui/{users-table,edit-user-dialog,reset-password-dialog,toggle-user-status-dialog,create-user-dialog,users-filters}.tsx`, `src/modules/auth/ui/{login-form,change-password-form,account-name-form,account-password-form}.tsx`, `src/components/app-shell/app-shell.tsx`, new `src/components/use-focus-on-form-error.ts`
  - **Depends on:** T049
  - **Done when:** row action buttons include the user's name for screen readers; auth inputs 16px on mobile; shell uses `<header>` + skip link to `#main`; a shared hook moves focus to the first invalid field or the alert after a failed submit (all 7 forms); spellCheck off on email/search inputs; sidebar scrolls on short viewports; single success announcement; typecheck + lint pass
  > Note: New `components/use-focus-on-form-error.ts` used by all 7 forms + the deactivate dialog; form Alerts focusable (`tabIndex={-1}`); inline password-success Alert uses `role="none"` (toast announces).

- [x] **T050** — Visual check (with the user)
  - **Depends on:** T049
  - **Done when:** full checks pass once (typecheck, lint, unit, build) and the user confirms the new look in the browser
  > Note: User feedback: buttons showed the arrow cursor (Tailwind v4 default). Fixed with one base rule in `globals.css` (enabled `button` / `[role=button]` → pointer) and `cursor-pointer` on dropdown/select items.

## Coverage check

| Spec item | Tasks |
|---|---|
| FR-001 | T018, T026, T030, T034 |
| FR-002 | T018, T026, T030, T034 |
| FR-003 | T008, T018, T025 |
| FR-004 | T018, T023 |
| FR-005 | T019, T026, T030, T036 |
| FR-006 | T019, T033, T036 |
| FR-007 | T006, T019, T032 |
| FR-008 | T029, T030, T031, T032, T043 |
| FR-009 | T029, T033, T034 |
| FR-010 | T019, T020, T035 |
| FR-011 | T020, T021, T031, T037 |
| FR-012 | T020, T026 |
| FR-013 | T013, T023, T038 |
| FR-014 | T012, T023, T039 |
| FR-015 | T014, T039 |
| FR-016 | T015, T024, T039 |
| FR-017 | T016, T026, T039 |
| FR-018 | T011, T028 |
| FR-019 | T036 |
| BR-001 | T004, T012, T022, T023 |
| BR-002 | T005, T020 |
| BR-003 | T018, T026 |
| BR-004 | T008, T018, T025 |
| BR-005 | T022 |
| BR-006 | T015, T016, T022, T026 |
| BR-007 | T019 |
| BR-008 | T006, T014, T015, T024 |
| BR-009 | T006, T014, T015, T016 |
| BR-010 | T014, T039 |
| BR-011 | T019, T036 |
| BR-012 | T006, T012, T013, T019 |
| BR-013 | T020, T026 |
| BR-014 | T011, T028 |
| US-1 (AC-1.1–1.7) | T018, T030, T034 |
| US-2 (AC-2.1–2.2) | T019, T030, T036 |
| US-3 (AC-3.1–3.6) | T019, T029, T032, T033, T036, T038 |
| US-4 (AC-4.1–4.3) | T005, T019, T020, T035, T036 |
| US-5 (AC-5.1–5.5) | T020, T021, T031, T037 |
| US-6 (AC-6.1–6.4) | T013, T023, T038 |
| US-7 (AC-7.1–7.5) | T005, T012, T039 |
| US-8 (AC-8.1–8.5) | T006, T014, T039 |
| US-9 (AC-9.1–9.5) | T006, T015, T024, T039 |
| US-10 (AC-10.1–10.2) | T006, T016, T039 |
| US-11 (AC-11.1–11.3) | T011, T028 |
