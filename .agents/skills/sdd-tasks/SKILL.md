---
name: sdd-tasks
description: Break an APPROVED plan into a small, ordered, test-first task list (tasks.md) for this project's Spec-Driven Development flow. Use after /sdd-plan when the user asks to create the tasks for a spec.
argument-hint: "<NNN spec number>"
---

# sdd-tasks — turn an approved plan into a task list

Input: `$ARGUMENTS` — the spec number `NNN`.

## Gate (strict — do this first)

1. Find `specs/NNN-*/spec.md` and `specs/NNN-*/plan.md`.
2. Both must have `status: Approved` in their frontmatter. If not → **stop**, say which one is missing approval, and point to `/sdd-spec NNN` or `/sdd-plan NNN`.

Do not write any tasks if the gate fails.

## Rules for good tasks

- **Small**: about one commit; touches a handful of files in one layer. If a task needs "and" to describe it, split it.
- **Ordered by dependencies** following the layers: setup → domain → application → infrastructure → routes/UI → verification.
- **Test-first** for domain and application: the task that creates a rule or use case also creates its test, and "Done when" names that test.
- **Objective "Done when"**: a command that passes or a behavior a person can observe. Never "works correctly".
- **Cheap "Done when"** (AGENTS.md §13 test budget): name the task's own test files, `eslint` on its files or `tsc --noEmit` — never `pnpm build`, the whole suite or `pnpm test:integration` without a file. Full suites appear only in the 2 checkpoint tasks: one after the last backend (non-UI) phase and one in Verification.
- **Traceable**: every task lists the FR/AC/BR IDs it covers; every FR and AC is covered by at least one task.
- **Exact files** taken from the plan. A task must not invent files the plan does not mention — if needed, update the plan first.
- Mark `[P]` only when tasks of the same phase share no files and don't depend on each other.
- If the spec touches UI: UI tasks must reference the plan's **Design** section, and the Verification phase includes a task "Run the `web-design-guidelines` skill on the changed UI files" (AGENTS.md §4.1).
- Always end with the Verification phase (full checks, `sdd-reviewer` review, manual end-to-end check from spec §13).

## Process

1. Read spec, plan and `AGENTS.md`.
2. Create `specs/NNN-<slug>/tasks.md` from [template.md](template.md). Number tasks `T001`, `T002`, … in execution order.
3. Fill the **Coverage check** table. Any FR/AC without a task is a gap — add a task.
4. Show the user: number of tasks per phase, the coverage table, and anything notable (risky tasks, manual steps that need them, e.g. Meta dashboard configuration).
5. Ask explicitly: "Approve tasks NNN?" Only on an explicit yes: set `status: Approved`, `approved_at: <today>`.
6. Tell the user the next step: `/sdd-implement NNN`.
