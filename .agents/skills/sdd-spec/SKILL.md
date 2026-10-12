---
name: sdd-spec
description: Write a feature specification (spec.md) for Spec-Driven Development in this project. Interviews the user, then drafts WHAT/WHY with user stories, acceptance criteria, requirements and business rules. Use when the user wants to start a new feature, change or bug fix, or asks to write/refine a spec. No code is written before a spec is approved.
argument-hint: "<feature description> | <NNN to refine an existing spec>"
---

# sdd-spec — write a specification

You are helping the user write a **specification**: the single source of truth for WHAT a feature must do and WHY. Code, plans and tasks come later and are derived from it.

Input: `$ARGUMENTS` — either a feature description (new spec) or an existing spec number `NNN` (refine it).

## Golden rules

1. **WHAT and WHY, never HOW.** No file names, libraries, tables, classes, code or architecture. Those belong in the plan (`/sdd-plan`).
2. **Never invent requirements.** Anything you are not sure about is either asked or marked inline as `[NEEDS CLARIFICATION: <question>]`.
3. **Everything is testable.** Acceptance criteria use Given/When/Then with an observable result.
4. **IDs are stable**: `US-n`, `AC-n.m`, `FR-nnn`, `BR-nnn`. Never renumber after approval; strike removed items through.
5. **Only the user approves.** You never set `status: Approved` without their explicit "yes".
6. Write the spec in **English**.

## Process

### Step 1 — Orient

- Read `TODO.md`: if items there relate to this feature, ask the user whether to include them in the spec (they are deleted from `TODO.md` once the spec covering them is Done).
- List `specs/` to find the next free number (`001`, `002`, …) and any related specs. If `$ARGUMENTS` is a number, open that spec and go to Step 4.
- Read `AGENTS.md` §1 (overview) and §8 (WhatsApp rules), and skim the code the feature touches so your questions are concrete.
- Restate the feature in 2–3 sentences and confirm you understood it.

### Step 2 — Interview (rounds of 3–5 questions)

Use the AskUserQuestion tool with concrete options (put a recommended option first when you have one). Cover these topics; skip what is clearly not applicable:

| Round | Topics |
|---|---|
| 1. Purpose | Problem, goal, who uses it (admin / agent), what "done" looks like |
| 2. Behavior | Main flows step by step, business rules, permissions |
| 3. Data | What information is created/read/changed, states and transitions |
| 4. WhatsApp | Meta endpoints/webhooks involved, 24h window, templates, duplicates/ordering, test-number limits |
| 5. UI | Screens, what the user sees, empty/loading/error states |
| 6. Edges | Invalid input, failures of external services, limits, what is explicitly **out of scope** |

Ask follow-ups when an answer is vague. Stop interviewing when you could write every section without guessing — or when the user prefers to leave items open (mark them `[NEEDS CLARIFICATION]`).

### Step 3 — Verify external facts (WhatsApp features)

If the feature touches the Meta WhatsApp Cloud API, check the **official Meta documentation** (developers.facebook.com) for every endpoint and webhook field involved. Record the doc link and today's date in the spec's §9. Do not rely on memory — the API changes often. If you cannot verify something, mark it `[NEEDS CLARIFICATION]`.

### Step 4 — Draft

- Create `specs/NNN-<kebab-slug>/spec.md` from [template.md](template.md). Fill every section; write "None" or "Not applicable" instead of deleting a section.
- Keep `status: Draft` and `created: <today>`.

### Step 5 — Self-check

Run [checklist.md](checklist.md) against the draft. Show the user the result as a short ✅/❌ list. Fix what you can; turn the rest into Open Questions with `[NEEDS CLARIFICATION]` markers.

### Step 6 — Review with the user

- Summarize: number of stories, ACs, FRs, BRs and open questions. Point to the file.
- Resolve open questions with the user (more AskUserQuestion rounds), updating the spec.
- When **no** `[NEEDS CLARIFICATION]` markers remain and the checklist passes, ask explicitly: "Approve spec NNN?"
- Only on an explicit yes: set `status: Approved`, `approved_at: <today>`, tick the Approval section.
- Then tell the user the next step: `/sdd-plan NNN`.

## Refining an approved spec

If an approved spec must change (e.g. implementation revealed a gap): set `status: Draft`, make the change, add a line to a `## Changelog` section at the bottom (`YYYY-MM-DD — what changed and why`), and get approval again. Any existing plan/tasks must then be re-checked by `/sdd-plan` and `/sdd-tasks`.
