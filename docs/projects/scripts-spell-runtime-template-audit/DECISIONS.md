# Scripts: Spell Runtime Template Audit Decisions

Status: active
Last updated: 2026-06-10

Use this file for durable choices that affect project scope, required documentation, or protocol interpretation. Keep operational notes in `AUDIT_OR_PROOF.md` and re-openable workflow deltas in `TRACKER.md` or `GAPS.md`.

## Decision Log

### D1: Required-doc surface initialized

Date: 2026-06-10

Owner: schema migration pass

Decision point:
`NORTH_STAR.md` declares `DECISIONS.md` as part of the required living-project surface.

Decision made:
Create this concise decisions file so the project folder matches the declared schema contract.

Rationale and evidence:
- Project folder: `docs/projects/scripts-spell-runtime-template-audit`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: SRTA-001 — register recurring-mechanics labels in the strict vocabulary

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
SRTA-001 asked whether `Recurring Mechanics` and `Recurring Mechanic Timing` belong in the strict template vocabulary now, or should be routed to a separate schema-migration follow-up. The labels were producing 28 `structured-unregistered-label` warnings (14 spells each).

Decision made:
**Register both `Recurring Mechanics` and `Recurring Mechanic Timing` in the strict template vocabulary, with migration notes.** No deferred migration lane.

Rationale and evidence:
- Registration with migration notes closes the warning family at its source while keeping the migration trail explicit for spell-system-overhaul follow-through (SRTA-002).
- Evidence: `docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md` (baseline 2026-05-31: 459 spells, 28 warnings, 0 errors); `scripts/spellRuntimeTemplateAudit/vocabulary.ts`.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D22).

Follow-up:
Implement the vocabulary entries plus migration notes, rerun `npm run audit:spell-template`, and prove the warning family clears; then add the SRTA-002 handoff note in the spell-system-overhaul lane. The project's standalone-vs-routing review question is separate and remains open.
