---
id: "NNN"
title: "<Feature title>"
spec: ./spec.md
status: Draft            # Draft | Approved | Done
created: YYYY-MM-DD
approved_at:
---

# Plan NNN — <Feature title>

> The plan explains **HOW** to implement the approved spec, following AGENTS.md
> (architecture §5, readability §6). It must not add behavior that is not in the spec.

## 1. Technical Summary

<!-- 3–6 sentences: the approach in plain words. -->

## 2. Modules & Layers Touched

| Module (`src/modules/…`) | domain | application | infrastructure | ui | app routes |
|---|---|---|---|---|---|
| | ✅/— | ✅/— | ✅/— | ✅/— | ✅/— |

## 3. Domain

<!-- Types, value objects, pure business rules and the interfaces (ports) use cases depend on.
     Each item: name, file path, one-line purpose, the BR/FR it implements. -->

| Item | Kind (type / rule / interface / error) | File | Implements |
|---|---|---|---|
| | | `src/modules/<feature>/domain/…` | BR-001 |

## 4. Application (use cases)

<!-- One use case per file. List its dependencies (interfaces only — Dependency Inversion). -->

| Use case | File | Depends on (interfaces) | Implements |
|---|---|---|---|
| | `src/modules/<feature>/application/…` | | FR-001 |

## 5. Infrastructure

<!-- Implementations of domain interfaces: Drizzle repositories, Meta adapters, realtime. -->

| Implementation | Implements interface | File |
|---|---|---|
| | | `src/modules/<feature>/infrastructure/…` |

**Composition root:** what is wired in `src/server/container.ts`.

## 6. Database Schema & Migrations

<!-- Tables/columns/indexes/constraints added or changed, in `src/shared/db/schema/…`.
     Note unique constraints used for idempotency. Migration name. "None" if not applicable. -->

## 7. Routes, Server Actions & UI

| Entry point | Type (page / route handler / server action / component) | File | Calls use case | Auth (admin / agent / public+signature) |
|---|---|---|---|---|
| | | `src/app/…` | | |

## 7b. Design (required if the spec touches UI — AGENTS.md §4.1, `frontend-design` skill)

- **Palette:** 4–6 named hex values (or the existing theme tokens being reused)
- **Typography:** typefaces, roles, type scale
- **Layout:** sketch of the main screens
- **Principles:** what makes this UI specific to the product; quality floor (responsive, focus, contrast)

## 8. Meta API Verification

<!-- Every Graph API call or webhook field used, verified against the official docs at planning time. -->

| Call / webhook field | Method & path | Key request/response fields | Doc link (checked YYYY-MM-DD) |
|---|---|---|---|
| | | | |

## 9. Testing Strategy

| Layer | What is tested | Test file | Fakes / fixtures |
|---|---|---|---|
| domain | | `…/domain/*.test.ts` | none |
| application | | `…/application/*.test.ts` | in-memory fakes |
| infrastructure | | | mocked `fetch` / Docker Postgres |

Manual end-to-end check (WhatsApp test number), if relevant:
1. 

## 10. Traceability Matrix

<!-- Every FR and AC from the spec must appear here. -->

| Spec item | Implemented by | Verified by (test or manual step) |
|---|---|---|
| FR-001 | | |
| AC-1.1 | | |

## 11. Risks & Decisions

| Decision / risk | Choice and why | Alternatives considered |
|---|---|---|
| | | |

## 12. Constitution Check (AGENTS.md)

- [ ] Layers respect the dependency rule (§5.1): domain imports nothing from Next/Drizzle/fetch.
- [ ] **S** — each listed file has one responsibility.
- [ ] **O** — new variants (message/event types) are added via registry, not by editing switches.
- [ ] **L** — fakes and real implementations share the same contract and error types.
- [ ] **I** — interfaces are small and specific to their consumers.
- [ ] **D** — use cases depend only on interfaces; concrete classes are created only in `container.ts`.
- [ ] No speculative abstractions (YAGNI): every interface has a real second implementation or a test fake.
- [ ] Readability rules (§6) can be met: names, small functions, typed errors.
- [ ] Next 16 rules (§11) respected (`connection()`, no `dynamic` segment config, `proxy.ts`).
- [ ] Security rules (§12) respected; secrets stay server-only.
- [ ] Every FR/AC is in the traceability matrix.

## 13. Approval

- [ ] Approved by the user on YYYY-MM-DD
