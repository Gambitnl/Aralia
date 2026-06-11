# Events System Decisions

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
- Project folder: `docs/projects/events`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Event-lane contract — keep split lanes, document the bridge (G3/G4)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
The Required Review Brief asked whether `CombatEvents`, movement/attack emitters, turn sequencing, and world-day scheduling should remain separate lanes with an explicit bridge, or converge on a shared scheduler/marker contract.

Decision made:
**Keep the split lanes; document the bridge.** Write an explicit compatibility envelope with documented `combat_turn` / `world_day` markers. No shared scheduler is built this cycle.

Rationale and evidence:
- The lanes have different lifecycles and consumers; converging on a shared scheduler now would encode a cross-system ordering policy with more risk than benefit this cycle.
- An explicit documented envelope plus markers gives the combined-timeline proof surface without a migration.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D8).
- Brief and gaps: `docs/projects/events/NORTH_STAR.md` Required Review Brief; `docs/projects/events/GAPS.md` G3/G4.

Follow-up:
Write the compatibility-envelope documentation (lane boundaries, ordering assumptions, `combat_turn` / `world_day` marker contract), then add the ordering and marker proof tests (including the `ADVANCE_TIME` day tick + turn advance proof named in G4).
