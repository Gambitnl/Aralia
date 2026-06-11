# Scripts: Audits Decisions

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
- Project folder: `docs/projects/scripts-audits`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Audit policy — optional/manual, no CI gates this cycle (S4)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
S4 asked how much of `scripts/audits` should be mandatory in CI versus optional/manual workflows; forward automation work was blocked on the answer.

Decision made:
**Audits stay optional/manual; no CI gates this cycle.** Revisit gating when the audit suite stabilizes. This unblocks CMA-G19 (large spell-script modularization routing) under the manual policy.

Rationale and evidence:
- Over-broad automation can block normal contributor flow; the audit suite is not yet stable enough to justify mandatory gates.
- Evidence surfaces: `docs/guides/RACE_ENRICHMENT_WORKFLOW.md`, `docs/portraits/race_portrait_regen_handoff.md`, `docs/projects/scripts-audits/GAPS.md` S4.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D20).

Follow-up:
Forward automation work proceeds under the optional/manual policy. Re-open S4 only if a concrete gating proposal returns after the suite stabilizes; CMA-G19 acceptance/deferral can now be settled under the manual policy.
