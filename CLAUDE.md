@AGENTS.md

## Claude Code specifics

- `AGENTS.md` is the single source of truth — update it (not this file) when project rules change.
- Follow the architecture (§5) and readability rules (§6) of `AGENTS.md` on every change: SOLID, clean layers, code a junior developer can read.
- **Spec-Driven Development is mandatory** (AGENTS.md §0): `/sdd-spec` → `/sdd-plan` → `/sdd-tasks` → `/sdd-implement`. Never write feature code without an approved spec, plan and tasks; never mark a document Approved without the user's explicit yes.
- **`TODO.md`**: when you notice a bug, task or idea outside the current spec, add one line there instead of fixing it now. Delete lines when solved — it is not a history. When the user asks "what is pending?", read `TODO.md` and every `specs/*/` document whose status is not `Done` (including unchecked tasks), and answer with a short grouped list.
- Use the `find-skills` skill (`.claude/skills/find-skills`) when starting a new area of work; review any skill before installing it and ask the user first.
- Before implementing any WhatsApp feature, check the official Meta docs (the API changes often).
- Per task: run only the tests and lint of the files you changed (plus `pnpm exec tsc --noEmit` if types changed). Full suites (`pnpm typecheck && pnpm lint && pnpm test`, plus integration/build) run only at the checkpoints of AGENTS.md §13.
- Never print, read aloud, or commit `.env.local` or any token. Use `.env.example` for reference.
- Do not run `docker compose down -v` or drop the database without asking — it deletes local data.
- Work one roadmap phase (= one spec) at a time; verify against the WhatsApp test number before moving on.
