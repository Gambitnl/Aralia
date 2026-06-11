# Three D Modal Decisions

Status: merged-reference (merged into World 3D UI per D5, 2026-06-10)
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
- Project folder: `docs/projects/three-d-modal`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Merge into World 3D UI (whole project)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
Should ThreeD Modal remain a separate UX entrypoint owner, or merge with World 3D UI? (The question that held this project at `human-review-required`.)

Decision made:
Merge into World 3D UI. `docs/projects/world-3d-ui` becomes the single owner of all 3D entrypoints — modal launch, phase transition, and close/focus policy. The three-d-modal docs become merged-reference; all existing content is preserved, and forward work (including open gaps G1/G2/G4 and the CMA-G14 route) is scheduled through World 3D UI.

Rationale and evidence:
- The June 2026 campaign (unified procedural world pipeline with a 3D ground-level mode) needs one owner for 3D entry/exit semantics; split ownership between this project and World 3D UI duplicated the same contracts.
- The overlap was already flagged in this project's lifecycle fields (`possible_overlap_with_world_3d_ui_entrypoint_work`).
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D5).

Follow-up:
World 3D UI records the receiving side of the merge in its own DECISIONS/NORTH_STAR; this folder stays frozen as merged-reference except for pointer corrections.
