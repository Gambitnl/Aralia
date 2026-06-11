# World Decisions

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
- Project folder: `docs/projects/world`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-09`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Tile-grid phase-out contract — new canonical world-geography contract + adapters (G3)

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
The G3 Required Review Brief asked whether tile-grid `MapData` stays the canonical gameplay compatibility layer with new renderers adapting around it (Option A), or whether a new canonical world-geography contract is promoted with an explicit migration/adapter layer before old fields are retired (Option B).

Decision made:
Option B — **promote a new canonical world-geography contract and create explicit adapters for every tile-grid dependency before retiring old fields.** The new contract aligns with the Azgaar-based proc-gen pipeline (Azgaar is canonical per WorldSim Service decision D1 of the same session). Required adapter coverage: movement, passability, discovery/current-tile markers, save/load/migration compatibility, and 3D marker anchors. No tile-grid field is removed until its dependency has a verified adapter.

Rationale and evidence:
- Decided in the June 2026 proc-gen campaign context (Azgaar-based generation replacing the Submap and feeding 3D); keeping tile-grid canonical would anchor the new pipeline to the legacy renderer's data shape.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D2; campaign context in the Context section).
- Brief and gap: `docs/projects/world/NORTH_STAR.md` Required Review Brief; `docs/projects/world/GAPS.md` G3.

Follow-up:
Write the contract preservation table (every tile-grid dependency mapped to its adapter), define the new canonical world-geography contract, build the adapters, then run the focused startup/load/movement verification (passability, current/discovered markers, migration, 3D marker anchors) before retiring any old field. T2/T4 in `TRACKER.md` carry this lane.
