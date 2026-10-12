# Specs — Spec-Driven Development (SDD)

Every feature (and every bug fix) in this project starts here, **before any code is written**.

## The pipeline

```
1. /sdd-spec <feature description>   → specs/NNN-slug/spec.md    WHAT & WHY      (you approve)
2. /sdd-plan NNN                     → specs/NNN-slug/plan.md    HOW             (you approve)
3. /sdd-tasks NNN                    → specs/NNN-slug/tasks.md   STEP BY STEP    (you approve)
4. /sdd-implement NNN                → code + tests, one task at a time, then an automated review
```

**Gates are strict:** each step refuses to start unless the previous document has `status: Approved`. Only you approve — the assistant asks, you answer, and then it writes `status: Approved` and the date.

## Folder convention

```
specs/
  001-auth-and-schema/
    spec.md
    plan.md
    tasks.md
  002-webhook-receiver/
    …
```

- `NNN` is a 3-digit sequential number; `slug` is short kebab-case.
- A small bug fix still gets a folder, with a short spec.

## Status lifecycle

`Draft` → `Approved` → (`In Progress`, tasks only) → `Done`

If implementation shows that the spec or plan is wrong, **stop, update the document, and re-approve it** — the code never silently diverges from the spec.

## ID conventions

| Prefix | Meaning | Example |
|---|---|---|
| `US-n` | User story | `US-2` |
| `AC-n.m` | Acceptance criterion of story *n* | `AC-2.1` |
| `FR-nnn` | Functional requirement | `FR-004` |
| `BR-nnn` | Business rule | `BR-001` |
| `Tnnn` | Task | `T007` |

IDs never change once a document is approved; removed items are struck through, not renumbered.

## Who does what

| Step | Tool | Lives in |
|---|---|---|
| Write spec | `sdd-spec` skill | `.agents/skills/sdd-spec/` |
| Write plan | `sdd-plan` skill | `.agents/skills/sdd-plan/` |
| Write tasks | `sdd-tasks` skill | `.agents/skills/sdd-tasks/` |
| Orchestrate implementation | `sdd-implement` skill | `.agents/skills/sdd-implement/` |
| Implement one task | `sdd-implementer` agent | `.claude/agents/sdd-implementer.md` |
| Review against spec + AGENTS.md | `sdd-reviewer` agent | `.claude/agents/sdd-reviewer.md` |
