---
id: "001"
title: "Authentication"
status: Done            # Draft | Approved | Done
created: 2026-10-12
approved_at: 2026-10-12
---

# Spec 001 — Authentication

> A spec describes **WHAT** the system must do and **WHY**. It never says **HOW**.

## 1. Summary

Only people from the business can use the CRM. Administrators create accounts for their team (no public sign-up), and every person logs in with their email and password. There are two roles: **admin** (manages users and, later, everything else) and **agent** (works the inbox). This spec covers logging in and out, protecting every page and action, forced password changes for temporary passwords, a "My account" page, and an admin screen to manage users. It contains nothing about contacts, conversations, messages or templates.

## 2. Problem & Goal

- **Problem:** the CRM will hold customer conversations and phone numbers. Without authentication anyone with the URL could read them or send messages as the business, and there would be no way to tell admins from agents.
- **Goal:** every page and action is available only to an authenticated, active user with the right role; admins can onboard, change and offboard team members on their own, without developer help and without an email provider.

## 3. Users & Roles

| Role | What they need from this feature |
|---|---|
| Admin | Log in; manage users (create, edit name/role, deactivate/reactivate, reset password); manage their own account. |
| Agent | Log in; change their temporary password; manage their own name and password. No access to user management. |
| Operator (person who installs the system) | Create the very first admin, since nobody can log in yet. |

## 4. Scope

**In scope**
- Login with email + password, logout.
- Protection of every page and action (authentication + role check), including the programmatic interface the screens use.
- Forced password change for temporary passwords.
- "My account": change own display name and own password.
- User management for admins: list (search + filters), create, edit name/role, deactivate/reactivate, reset password.
- Login rate limiting, password policy, last-admin and self-change protections.
- Bootstrap of the first admin by the operator.
- App shell after login with navigation and "Coming soon" placeholders for not-yet-built sections.
- Storing the information needed for the above (users, credentials, sessions) — and nothing else.

**Out of scope** (explicitly not done now)
- Email invitations and self-service "forgot password" (no email provider).
- Login with Google, magic links or any other method; two-factor authentication.
- Audit log of user-management actions.
- A screen to view or revoke one's active sessions.
- Deleting users (deactivation is used instead).
- Changing a user's email.
- Any data or screens for contacts, conversations, messages, templates or WhatsApp.

## 5. User Stories & Acceptance Criteria

### US-1 — Log in

As a **team member**, I want to **log in with my email and password**, so that **I can use the CRM**.

- **AC-1.1** — Given an active user with a permanent password, when they submit the correct email and password, then they land on the page they originally requested, or on the app home if none.
- **AC-1.2** — Given any email/password pair that does not match an account (unknown email or wrong password), when submitted, then the same generic message "Correo o contraseña incorrectos" is shown and no information reveals whether the email exists.
- **AC-1.3** — Given a deactivated user, when they submit the **correct** password, then they see "Tu cuenta está desactivada. Contacta a un administrador." and no session is created.
- **AC-1.4** — Given a user whose password is temporary, when they log in successfully, then they are taken to the change-password screen (US-4).
- **AC-1.5** — Given 5 failed attempts for the same email from the same IP within 15 minutes, when a 6th attempt is made in that window, then it is rejected with "Demasiados intentos. Inténtalo de nuevo en unos minutos." even if the password is correct.
- **AC-1.6** — Given the email is typed with different upper/lower case or surrounding spaces, when submitted, then it is treated as the same email.
- **AC-1.7** — Given a successful login, then the user's "last login" date is updated.

### US-2 — Log out

As a **logged-in user**, I want to **log out**, so that **nobody else can use my session on this device**.

- **AC-2.1** — Given a logged-in user, when they choose "Cerrar sesión", then their session ends and they are taken to the login screen.
- **AC-2.2** — Given a user who has logged out, when they press the browser's back button or refresh a protected page, then they see the login screen, not protected content.

### US-3 — Protected access

As the **business**, I want **every page and action to require an authenticated, active user with the right role**, so that **customer data is only seen by the team**.

- **AC-3.1** — Given a visitor without a session, when they open any protected page, then they are sent to the login screen, and after logging in they are returned to the page they requested.
- **AC-3.2** — Given an agent, when they look at the navigation, then the "Usuarios" entry is not shown.
- **AC-3.3** — Given an agent, when they open a user-management page directly by its address, then they see a "No tienes permiso para ver esta página" screen.
- **AC-3.4** — Given a request to the system's programmatic interface without a valid session, then it is rejected as "unauthenticated" and no data is returned.
- **AC-3.5** — Given a request to an admin-only action from an agent's session, then it is rejected as "forbidden" and nothing changes.
- **AC-3.6** — Given a session that has expired, when the user performs any action, then they are sent to the login screen and returned to the same page after logging in.

### US-4 — Forced password change

As an **admin**, I want **users with a temporary password to choose their own password before using the CRM**, so that **only they know it**.

- **AC-4.1** — Given a user with a temporary password, when they try to open any page other than the change-password screen (or log out), then they are redirected to the change-password screen.
- **AC-4.2** — Given the change-password screen, when the user submits a new password that meets the policy (BR-002) and differs from the temporary one, then the password is saved, it is no longer temporary, and they land on the app home.
- **AC-4.3** — Given the change-password screen, when the new password is shorter than 10 characters, equal to the temporary one, or the confirmation does not match, then a specific validation message is shown and nothing is saved.

### US-5 — My account

As a **logged-in user**, I want to **change my display name and my password**, so that **my account stays accurate and secure**.

- **AC-5.1** — Given "Mi cuenta", when the user saves a new non-empty display name, then it is shown everywhere their name appears from the next page load.
- **AC-5.2** — Given "Mi cuenta", when the user enters their correct current password and a valid new password (BR-002), then the password is changed and a success message is shown.
- **AC-5.3** — Given "Mi cuenta", when the current password is wrong, then "La contraseña actual no es correcta" is shown and nothing changes.
- **AC-5.4** — Given "Mi cuenta", then email and role are shown read-only.
- **AC-5.5** — Given a user changed their own password, then their sessions on **other** devices end; the current session stays active. (BR-013)

### US-6 — Admin lists users

As an **admin**, I want to **see and find all users**, so that **I know who has access**.

- **AC-6.1** — Given an admin on "Usuarios", then they see a table with name, email, role, status ("Activo", "Inactivo", "Debe cambiar contraseña") and last login ("Nunca" if never).
- **AC-6.2** — Given text typed in the search box, then only users whose name or email contains it (case-insensitive) are listed.
- **AC-6.3** — Given role and/or status filters, then only matching users are listed; filters combine with the search.
- **AC-6.4** — Given no user matches, then an empty state "No se encontraron usuarios" is shown with a way to clear the filters.

### US-7 — Admin creates a user

As an **admin**, I want to **create an account for a new team member**, so that **they can start working**.

- **AC-7.1** — Given the create form with name, email, role and a temporary password that meets BR-002, when submitted, then the user is created as active with a temporary password and appears in the list.
- **AC-7.2** — Given an email that already exists (case-insensitive, BR-001), when submitted, then "Ya existe un usuario con este correo" is shown and nothing is created.
- **AC-7.3** — Given a missing name, invalid email format, missing role or a password that breaks BR-002, then a field-specific validation message is shown and nothing is created.
- **AC-7.4** — Given the admin clicks "Crear" twice quickly, then only one user is created.
- **AC-7.5** — Given the new user logs in for the first time, then AC-1.4 applies.

### US-8 — Admin edits a user's name or role

As an **admin**, I want to **change a user's name or role**, so that **permissions follow responsibilities**.

- **AC-8.1** — Given an admin editing another user, when they change the name and/or role and save, then the change is saved and the list reflects it.
- **AC-8.2** — Given a user whose role was changed, when they make their next request, then the new permissions apply (no new login needed).
- **AC-8.3** — Given an admin editing **themselves**, then the role cannot be changed (control disabled with an explanation), and any such request is rejected.
- **AC-8.4** — Given the target is the last active admin, when anyone tries to change their role to agent, then it is rejected with "Debe existir al menos un administrador activo".
- **AC-8.5** — Given the edit form, then the email is shown read-only.

### US-9 — Admin deactivates or reactivates a user

As an **admin**, I want to **block or restore a user's access without deleting them**, so that **former team members lose access but their history is kept**.

- **AC-9.1** — Given an active user, when an admin confirms "Desactivar", then the user's status becomes inactive and **all their sessions end immediately**: their next action sends them to the login screen.
- **AC-9.2** — Given an inactive user, when an admin confirms "Reactivar", then the status becomes active and the user can log in again with their existing password.
- **AC-9.3** — Given an admin, then they cannot deactivate themselves (action not offered, and rejected if requested).
- **AC-9.4** — Given the target is the last active admin, when deactivation is attempted, then it is rejected with "Debe existir al menos un administrador activo".
- **AC-9.5** — Given deactivation or reactivation, then a confirmation dialog naming the user is shown before the change.

### US-10 — Admin resets a user's password

As an **admin**, I want to **set a new temporary password for a user**, so that **they can recover access when they forget it**.

- **AC-10.1** — Given an admin resetting another user's password with a value that meets BR-002, when confirmed, then the user's password is replaced by this temporary one, **all their sessions end**, and at next login AC-1.4 applies.
- **AC-10.2** — Given an admin, then they cannot reset their own password this way (they use "Mi cuenta").

### US-11 — Operator creates the first admin

As the **operator installing the system**, I want to **create the first admin from a setup command**, so that **someone can log in and create the rest of the team**.

- **AC-11.1** — Given no admin exists, when the operator runs the setup command with a name, email and password that meets BR-002, then an active admin is created with a temporary password (must change at first login).
- **AC-11.2** — Given an admin already exists, when the setup command is run, then it refuses with a clear message and changes nothing. (BR-014)
- **AC-11.3** — Given the setup command, then the password is never printed back or written to logs.

## 6. Functional Requirements

| ID | Requirement | From story |
|---|---|---|
| FR-001 | The system must authenticate users by email and password and create a session on success. | US-1 |
| FR-002 | The system must reject login for unknown emails, wrong passwords and deactivated accounts, with the messages defined in AC-1.2/AC-1.3. | US-1 |
| FR-003 | The system must limit failed login attempts per email + IP (BR-004). | US-1 |
| FR-004 | The system must record the date of each user's last successful login. | US-1, US-6 |
| FR-005 | The system must end the current session on logout. | US-2 |
| FR-006 | The system must require an authenticated, active session for every page and action except the login screen. | US-3 |
| FR-007 | The system must enforce role permissions on the server for every admin-only page and action, regardless of what the UI shows. | US-3 |
| FR-008 | The system must expose a programmatic interface (used by the screens) for: login, logout, current session, change own password, update own name, and admin user management (list, create, edit, deactivate, reactivate, reset password). Every operation applies FR-006/FR-007 and returns "unauthenticated" or "forbidden" errors as appropriate. | US-1–US-10 |
| FR-009 | The system must return users to their originally requested page after login. | US-1, US-3 |
| FR-010 | The system must restrict users with a temporary password to the change-password screen and logout until they set a new password. | US-4 |
| FR-011 | The system must let any user change their display name and their password (current password required). | US-5 |
| FR-012 | The system must end a user's other sessions when they change their own password. | US-5 |
| FR-013 | The system must let admins list users with search by name/email and filters by role and status. | US-6 |
| FR-014 | The system must let admins create users with name, email, role and temporary password. | US-7 |
| FR-015 | The system must let admins change another user's name and role. | US-8 |
| FR-016 | The system must let admins deactivate and reactivate other users, ending all sessions of a deactivated user immediately. | US-9 |
| FR-017 | The system must let admins set a temporary password for another user, ending all that user's sessions. | US-10 |
| FR-018 | The system must provide a setup command to create the first admin, only when no admin exists. | US-11 |
| FR-019 | The system must show, after login, an app shell with navigation (Inbox, Contactos, Plantillas, and Usuarios for admins), the user's name and role, links to "Mi cuenta" and "Cerrar sesión", and "Próximamente" placeholders for sections not yet built. | US-3 |

## 7. Business Rules

| ID | Rule | Source |
|---|---|---|
| BR-001 | Emails are unique and case-insensitive; they are stored trimmed and in lower case. | Product decision |
| BR-002 | Passwords have at least 10 characters (max 128). A new password cannot equal the user's current password. | Security decision |
| BR-003 | Login errors never reveal whether an email exists. Only a **correct** password on a deactivated account reveals the deactivated state. | Security decision |
| BR-004 | After 5 failed login attempts for the same email from the same IP within 15 minutes, further attempts in that window are rejected. | Security decision |
| BR-005 | A session lasts 30 days and is extended with activity (expires after 30 days without use). | Product decision |
| BR-006 | Deactivating a user or resetting their password ends all of that user's sessions immediately. | Security decision |
| BR-007 | Role and status changes take effect on the user's next request. | Security decision |
| BR-008 | At least one active admin must exist at all times. | Product decision |
| BR-009 | Admins cannot deactivate themselves, change their own role, or reset their own password through user management. | Product decision |
| BR-010 | A user's email cannot be changed after creation. | Product decision |
| BR-011 | A user with a temporary password can only change their password or log out. | Security decision |
| BR-012 | Only admins can see and use user management. | Product decision |
| BR-013 | Changing one's own password (in "Mi cuenta" or the forced change) ends one's sessions on other devices; the current session continues. | Security decision |
| BR-014 | The first-admin setup command only works when no admin exists. | Security decision |

## 8. Data (conceptual)

| Entity | Key information | Lifecycle / states |
|---|---|---|
| User | Display name, email, role (admin / agent), status, whether the password is temporary, last login date, creation and update dates | Created (active, temporary password) → active ⇄ inactive. Never deleted. |
| Credential | The user's password, stored only in a non-reversible secure form | Replaced on password change or admin reset. |
| Session | Owner user, creation date, last activity, expiry date, IP address and device/browser description | Created at login → ended at logout, expiry, deactivation, password reset, or own password change (other sessions). |
| Login attempt counter | Email + IP, number of recent failures, time window | Resets after 15 minutes. |

## 9. External Integrations

None. This spec does not involve the Meta WhatsApp Cloud API or any email provider.

## 10. UI / UX

All screens in Spanish. Forms show field-level validation messages and disable the submit button while sending.

| Screen | Purpose | Empty state | Loading state | Error state |
|---|---|---|---|---|
| Login | Email + password form | — | Button shows progress; form disabled | Generic credentials error; deactivated message; too-many-attempts message; "Algo salió mal, inténtalo de nuevo" for unexpected errors |
| Change password (forced) | Set own password after a temporary one | — | Button shows progress | Policy, mismatch and same-as-temporary messages |
| App shell | Navigation, user name + role, "Mi cuenta", "Cerrar sesión" | "Próximamente" placeholder in Inbox, Contactos, Plantillas | Skeleton while loading the user | Session expired → login (AC-3.6) |
| Mi cuenta | Change display name; change password | — | Per-form progress | Wrong current password; policy messages |
| Usuarios (admin) | Table + search + role/status filters + "Crear usuario" | "No se encontraron usuarios" + clear filters | Table skeleton | "No se pudieron cargar los usuarios" + retry |
| Create user (dialog) | Name, email, role, temporary password | — | Button shows progress; double submit prevented | Duplicate email; field validation |
| Edit user (dialog) | Name, role; email read-only | — | Button shows progress | Last-admin / self-change rejections |
| Reset password (dialog) | New temporary password for the user | — | Button shows progress | Policy messages |
| Deactivate / reactivate (confirmation) | Confirm naming the user | — | Button shows progress | Last-admin / self rejections |
| No permission | Shown when an agent opens an admin page | — | — | — |

## 11. Non-functional Requirements

- **Security / permissions:** every permission check happens on the server; the UI only hides what the user cannot use. Passwords are stored only in a strong, salted, non-reversible form and are never logged, displayed or returned by the system. Session cookies are not readable by page scripts and are only sent over HTTPS in production. State-changing actions are protected against cross-site request forgery.
- **Privacy:** user emails and names are visible only to authenticated users; the full user list only to admins. Logs never contain passwords or session identifiers.
- **Performance / limits:** login and page-protection checks should not add noticeable delay (< 200 ms server time for a session check under normal load). The user list is designed for a small team (up to ~100 users) without pagination.
- **Reliability:** two simultaneous admin changes can never leave the system without an active admin (BR-008 holds under concurrency). Double submissions do not create duplicate users.

## 12. Edge Cases & Errors

| Case | Expected behavior |
|---|---|
| Admin clicks "Crear" twice quickly | Exactly one user is created (AC-7.4). |
| Two admins deactivate/demote each other at the same time, and they are the only admins | At most one change succeeds; one active admin always remains (BR-008). |
| A user is deactivated while using the app | Their next action sends them to the login screen; logging in shows the deactivated message (AC-1.3). |
| A user's role is lowered to agent while they are on an admin page | Their next action shows the no-permission screen (BR-007). |
| Session expires while the user is working | Next action → login → back to the same page (AC-3.6). |
| Rate limit reached | AC-1.5 message; attempts allowed again after the window. |
| Setup command run when an admin exists | Refuses, nothing changes (AC-11.2). |
| Login with email in different case / with spaces | Treated as the same email (AC-1.6). |
| Password longer than 128 characters | Rejected with a validation message. |
| Unexpected server error | Generic "Algo salió mal, inténtalo de nuevo"; no technical details shown. |

## 13. Success Criteria

Manual end-to-end check on a fresh database:
1. Run the setup command → an admin is created; running it again is refused.
2. Log in as that admin → forced to change the password → land on the app shell with "Usuarios" visible.
3. Create an agent with a temporary password → it appears in the list as "Debe cambiar contraseña".
4. In another browser, log in as the agent → forced password change → app shell **without** "Usuarios"; opening the Usuarios address shows the no-permission screen.
5. As admin, reset the agent's password → the agent's next action goes to login; logging in forces a password change.
6. As admin, deactivate the agent → the agent's next action goes to login; logging in shows the deactivated message. Reactivate → the agent can log in again.
7. As the only admin, try to change your own role / deactivate yourself → not possible.
8. Six wrong passwords in a row for one email → the 6th is rejected with the too-many-attempts message.
9. All automated checks pass.

## 14. Open Questions

- None. Resolved with the user on 2026-10-12:
  - Changing one's own password (in "Mi cuenta" or the forced change) ends the user's sessions on other devices — BR-013.
  - The first-admin setup command refuses when an admin already exists — BR-014.

## 15. Approval

- [x] Quality checklist passed (`.agents/skills/sdd-spec/checklist.md`)
- [x] No `[NEEDS CLARIFICATION]` markers left
- [x] Approved by the user on 2026-10-12
