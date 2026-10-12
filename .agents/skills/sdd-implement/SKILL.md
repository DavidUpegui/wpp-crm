---
name: sdd-implement
description: Implement an APPROVED task list (tasks.md) one task at a time using the sdd-implementer agent, then review the result with the sdd-reviewer agent. Final step of this project's Spec-Driven Development flow.
argument-hint: "<NNN spec number> [Tnnn to run a single task]"
disable-model-invocation: true
---

# sdd-implement — build the feature from the approved tasks

Input: `$ARGUMENTS` — the spec number `NNN`, optionally followed by a task ID (`T005`) to run only that task.

## Gate (strict — do this first)

1. `specs/NNN-*/spec.md`, `plan.md` and `tasks.md` must all exist with `status: Approved` (tasks may also be `In Progress` when resuming).
2. If any is missing or not approved → **stop**, say which, and point to the right skill (`/sdd-spec`, `/sdd-plan`, `/sdd-tasks`).
3. Check the working tree (`git status`). If there are uncommitted changes unrelated to this spec, tell the user before continuing.

## Process

1. Set `tasks.md` frontmatter `status: In Progress` (if it was `Approved`).
2. Build the execution order: unchecked tasks whose `depends_on` are all checked.
3. **For each task, one at a time:**
   1. Delegate it to the **`sdd-implementer`** agent. Give it: the full task text, the paths to `spec.md`, `plan.md`, `tasks.md`, and any notes from previous tasks it needs.
   2. When the agent returns, verify yourself: the files it changed match the task's **Files**, and the **Done when** check really passes (run the command).
   3. If it passes: tick `- [x]` for the task in `tasks.md`; add `> Note: …` under it for any deviation the agent reported.
   4. If it fails: send the agent back once with the failure details. If it fails again, stop and ask the user.
   5. Give the user a one-line progress update (`T004 ✅ — <title>`).
4. **Stop and ask the user** whenever:
   - a task reveals that the spec or plan is wrong or incomplete → the documents are updated (and re-approved) **before** any more code is written;
   - a task needs something only the user can do (Meta dashboard, secrets in `.env.local`, manual test with the phone);
   - the agent wants to touch files outside the task's scope.
5. When all implementation tasks are done:
   - Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
   - Delegate to the **`sdd-reviewer`** agent with the spec number. Show its findings to the user.
   - Fix blocking findings through new tasks (`T0nn — Fix: …`) added to `tasks.md` and run them the same way.
   - Walk the user through the manual end-to-end check from spec §13.
6. When the user confirms the end-to-end check: set `status: Done` on `tasks.md` (and on `spec.md` and `plan.md`), and summarize what was built, test results, and any deviations.

## Rules

- Never implement more than the current task. Never "improve" unrelated code along the way.
- Out-of-scope bugs, tech debt or ideas reported by the agents (or noticed by you) go to `TODO.md` as one line each (`- <description> — found in spec NNN / Tnnn (YYYY-MM-DD)`), and are mentioned to the user. Non-blocking reviewer findings that are not fixed now also go there. If this spec solves an item already in `TODO.md`, delete that line.
- Never commit unless the user asks. Suggest a commit message per completed phase.
- Never edit the spec or plan silently — changes go through `/sdd-spec` / `/sdd-plan` and user approval.
