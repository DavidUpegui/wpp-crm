---
name: sdd-plan
description: Write the technical implementation plan (plan.md) for an APPROVED spec in this project's Spec-Driven Development flow. Maps every requirement to modules, layers, files and tests following AGENTS.md (clean architecture, SOLID). Use after /sdd-spec when the user asks to plan a spec.
argument-hint: "<NNN spec number>"
---

# sdd-plan — turn an approved spec into a technical plan

Input: `$ARGUMENTS` — the spec number `NNN`.

## Gate (strict — do this first)

1. Find `specs/NNN-*/spec.md`. If it does not exist → stop and suggest `/sdd-spec`.
2. Read its frontmatter. If `status` is not `Approved` → **stop**. Tell the user the spec must be approved first and offer to continue with `/sdd-spec NNN`.
3. If the spec still contains `[NEEDS CLARIFICATION` → stop for the same reason.

Do not write any plan content if the gate fails.

## Golden rules

1. **The plan implements the spec — nothing more, nothing less.** If you think something is missing from the spec, stop and propose a spec change; do not add behavior silently.
2. **Follow AGENTS.md**: layers and dependency rule (§5.1), directory map (§5.2), SOLID (§5.3), readability (§6), WhatsApp rules (§8), DB rules (§9), Next 16 rules (§11), security (§12), testing (§13).
3. **Prefer the simplest design that satisfies the spec** (YAGNI). An interface needs a real second implementation or a test fake.
4. Never write production code in this step. Short type signatures are fine to clarify an interface.

## Process

### Step 1 — Research

- Read the whole spec, `AGENTS.md`, and the existing code in the modules involved (reuse what exists).
- For Next.js specifics, read the relevant guide in `node_modules/next/dist/docs/`.
- For every Meta API call or webhook field, verify request/response shape in the **official Meta docs** and record link + date in plan §8.
- For a new area (e.g. auth library, form handling, testing tool), use the `find-skills` skill to look for a reputable skill; mention any you would recommend and ask before installing.

### Step 2 — Draft

Create `specs/NNN-<slug>/plan.md` from [template.md](template.md). Fill every section:

- Name **real file paths** following §5.2 (`src/modules/<feature>/<layer>/<kebab-name>.ts`).
- List each use case with the **interfaces** it depends on.
- Describe schema changes precisely (tables, columns, unique constraints, indexes) and the migration.
- Fill the **traceability matrix**: every FR and AC of the spec → component → test. A spec item with no row is a bug in the plan.
- Record important decisions with the alternatives you rejected and why.

### Step 3 — Constitution check

Go through plan §12 honestly. Any unchecked item must be fixed or explained in §11 (Risks & Decisions).

### Step 4 — Review with the user

- Summarize the approach in a few bullets: modules touched, new tables, new routes, key decisions, risks.
- Ask explicitly: "Approve plan NNN?"
- Only on an explicit yes: set `status: Approved`, `approved_at: <today>`.
- Then tell the user the next step: `/sdd-tasks NNN`.

If the plan reveals the spec is wrong or incomplete, stop and send the user back to `/sdd-spec NNN` to update it first.
