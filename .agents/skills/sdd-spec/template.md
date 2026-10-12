---
id: "NNN"
title: "<Feature title>"
status: Draft            # Draft | Approved | Done
created: YYYY-MM-DD
approved_at:             # set only when the user approves
---

# Spec NNN — <Feature title>

> A spec describes **WHAT** the system must do and **WHY**. It never says **HOW**
> (no file names, libraries, tables, classes or code). The plan covers the how.

## 1. Summary

<!-- 2–4 sentences a non-technical person understands. -->

## 2. Problem & Goal

- **Problem:** <!-- What hurts today, and for whom? -->
- **Goal:** <!-- What is true when this feature is done? -->

## 3. Users & Roles

| Role | What they need from this feature |
|---|---|
| Admin | |
| Agent | |

## 4. Scope

**In scope**
- 

**Out of scope** (explicitly not done now)
- 

## 5. User Stories & Acceptance Criteria

### US-1 — <short title>

As a **<role>**, I want **<capability>**, so that **<benefit>**.

- **AC-1.1** — Given <context>, when <action>, then <observable result>.
- **AC-1.2** — Given …, when …, then ….

<!-- Repeat for US-2, US-3… Every AC must be testable (observable result). -->

## 6. Functional Requirements

| ID | Requirement | From story |
|---|---|---|
| FR-001 | The system must … | US-1 |

## 7. Business Rules

| ID | Rule | Source |
|---|---|---|
| BR-001 | <e.g. Free-form messages can only be sent within 24h of the customer's last message.> | Meta policy (link) |

## 8. Data (conceptual)

<!-- Entities and the information they hold, in business language. No SQL, no column types. -->

| Entity | Key information | Lifecycle / states |
|---|---|---|
| | | |

## 9. External Integrations

<!-- For WhatsApp/Meta: every endpoint and webhook field involved, each with a link to the official
     doc page checked while writing this spec, and the date it was checked. Write "None" if not applicable. -->

| Integration | Purpose | Official doc (checked on YYYY-MM-DD) |
|---|---|---|
| | | |

## 10. UI / UX

<!-- Screens or components involved, what the user sees and can do. Always describe the states. -->

| Screen | Purpose | Empty state | Loading state | Error state |
|---|---|---|---|---|
| | | | | |

## 11. Non-functional Requirements

- **Security / permissions:** 
- **Privacy (phone numbers, message content):** 
- **Performance / limits:** 
- **Reliability (retries, duplicates, ordering):** 

## 12. Edge Cases & Errors

| Case | Expected behavior |
|---|---|
| | |

## 13. Success Criteria

<!-- How we know the feature works end-to-end, including the manual check with the WhatsApp test number if relevant. -->
- 

## 14. Open Questions

<!-- Every unknown is also marked inline as [NEEDS CLARIFICATION: …]. The spec cannot be approved while any remain. -->
- 

## 15. Approval

- [ ] Quality checklist passed (`.agents/skills/sdd-spec/checklist.md`)
- [ ] No `[NEEDS CLARIFICATION]` markers left
- [ ] Approved by the user on YYYY-MM-DD
