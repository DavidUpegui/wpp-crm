# Spec quality checklist

Run this against the draft before asking for approval. Report each item as ✅ / ❌ with a one-line reason. Every ❌ must be fixed (or turned into an Open Question) before approval.

## Content quality
- [ ] Describes WHAT and WHY only — no file names, libraries, tables, classes, endpoints-as-code or code snippets.
- [ ] A non-technical stakeholder could read the Summary and Goal and agree or disagree.
- [ ] Scope has an explicit **Out of scope** list.

## Completeness
- [ ] Every user story has at least one acceptance criterion in Given/When/Then form.
- [ ] Every acceptance criterion describes an **observable** result (testable, no "should work well").
- [ ] Every functional requirement (FR) traces to a user story; every story is covered by at least one FR.
- [ ] Roles are explicit: what an **admin** can do vs an **agent**.
- [ ] Data section lists every entity the feature creates, reads or changes, with its lifecycle/states.
- [ ] UI section defines **empty, loading and error** states for every screen.
- [ ] Edge cases and errors are listed (invalid input, duplicates, permissions, external API failures).
- [ ] Success criteria include an end-to-end check.

## WhatsApp / Meta (when the feature touches WhatsApp)
- [ ] Every Meta endpoint/webhook field involved is listed with an **official doc link and check date**.
- [ ] The 24-hour customer service window is addressed (free-form vs template-only).
- [ ] Duplicate and out-of-order webhooks are addressed (idempotency, status ordering).
- [ ] Template rules are addressed if templates are involved (approval status, variables, language).
- [ ] Test-number limits are noted (allowed recipient list).
- [ ] Privacy: no requirement exposes tokens, Meta media URLs or full phone numbers where they shouldn't be.

## Readiness
- [ ] IDs are unique and stable (US-n, AC-n.m, FR-nnn, BR-nnn).
- [ ] No `[NEEDS CLARIFICATION]` markers remain.
- [ ] Open Questions section is empty or only contains items explicitly deferred out of scope.
