---
id: "NNN"
title: "<Feature title>"
spec: ./spec.md
plan: ./plan.md
status: Draft            # Draft | Approved | In Progress | Done
created: YYYY-MM-DD
approved_at:
---

# Tasks NNN — <Feature title>

## How to read this list

- Work top to bottom; a task starts only when everything in `depends_on` is checked.
- `[P]` = can run in parallel with other `[P]` tasks of the same phase (no shared files).
- Each task is small (≈ one commit) and has a **Done when** line that is objectively checkable.
- Tick `- [x]` only when **Done when** is satisfied. Write deviations under the task as `> Note:`.

## Phase 1 — Setup

- [ ] **T001** — <title>
  - **Layer:** setup
  - **Files:** `…`
  - **Depends on:** —
  - **Covers:** —
  - **Done when:** <e.g. `pnpm typecheck` passes>

## Phase 2 — Domain (tests first)

- [ ] **T002** [P] — <title>
  - **Layer:** domain
  - **Files:** `src/modules/<feature>/domain/<name>.ts`, `…/<name>.test.ts`
  - **Depends on:** T001
  - **Covers:** BR-001, AC-1.1
  - **Done when:** tests in `<name>.test.ts` describe the rule and pass

## Phase 3 — Application (use cases with fakes)

- [ ] **T00n** — <title>
  - **Layer:** application
  - **Files:** 
  - **Depends on:** 
  - **Covers:** FR-…
  - **Done when:** use-case tests with in-memory fakes pass

## Phase 4 — Infrastructure

- [ ] **T00n** — <title>
  - **Layer:** infrastructure
  - **Files:** 
  - **Depends on:** 
  - **Covers:** 
  - **Done when:** 

## Phase 5 — Routes, Server Actions & UI

- [ ] **T00n** — <title>
  - **Layer:** app / ui
  - **Files:** 
  - **Depends on:** 
  - **Covers:** 
  - **Done when:** 

## Phase 6 — Verification

- [ ] **T0nn** — Full checks
  - **Done when:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass
- [ ] **T0nn** — Review
  - **Done when:** `sdd-reviewer` reports no blocking findings (or they are fixed)
- [ ] **T0nn** — Manual end-to-end check
  - **Done when:** the success criteria from spec §13 are confirmed by the user

## Coverage check

<!-- Every FR and AC from the spec must be covered by at least one task. -->

| Spec item | Tasks |
|---|---|
| FR-001 | |
| AC-1.1 | |
