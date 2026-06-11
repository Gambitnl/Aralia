# Companions System Decisions

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
- Project folder: `docs/projects/companions`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Romance downgrade policy — hysteresis exit (G6)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
The G6 Required Review Brief asked whether a companion in `romance` should automatically downgrade when approval collapses (Option A), wait for an event-driven breakup (Option B), or use hysteresis before leaving romance state (Option C).

Decision made:
Option C — **hysteresis romance exit**. Romance survives temporary approval dips but exits after sustained low approval. The specific threshold and sustained-duration values are to be specified as the first step of the implementation slice.

Rationale and evidence:
- Hysteresis preserves story continuity through short-term conflict while still honoring a collapsed relationship over time.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D10).
- Brief and gap: `docs/projects/companions/NORTH_STAR.md` Required Review Brief; `docs/projects/companions/GAPS.md` G6.

Follow-up:
Encode the policy in `src/systems/companions/RelationshipManager.ts` and add a focused regression that drops approval from romance to hostile and verifies the exit fires only after the sustained-low-approval condition.
