# Demo Area Decisions

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
- Project folder: `docs/projects/demo-area`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Retain `CombatMessagingDemo.tsx` as a reference artifact (G1)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
Should `src/components/demo/CombatMessagingDemo.tsx` (runtime-orphaned: no imports, actions, or phase wiring) be retained as reference, re-homed into an active demo entry, or removed?

Decision made:
Retain as a reference artifact. No re-home, no removal. The orphaned runtime state is accepted and documented; no mount path is required.

Rationale and evidence:
- Expansion-first repo policy: never delete historical artifacts that still carry reference value.
- The active demo flow already lives in `components/BattleMap` and `components/World3D`; re-homing would add churn without runtime benefit.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D19).

Follow-up:
G1/T3 close as decided. G2 (registry evidence path alignment in `docs/projects/PROJECT_TRACKER.md`) remains the open follow-up.
