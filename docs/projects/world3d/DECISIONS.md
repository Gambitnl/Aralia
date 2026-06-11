# World3d Decisions

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
- Project folder: `docs/projects/world3d`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: T7/W3D-G10 loader LOD contract + mixed-resolution seam strategy

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
T7/W3D-G10 was review-blocked: chunk loads request only `cx/cy` while `ChunkStreamer` records LOD after dispatch, and no seam/skirt contract existed for mixed-resolution chunks. Choose the loader LOD API and the mixed-LOD seam strategy.

Decision made:
Extend the chunk-loader request contract to carry the **requested LOD tier**, and use **skirt geometry** to hide mixed-resolution seams between neighboring chunks. The T7 lane reopens under this contract.

Rationale and evidence:
- A local sampler/mesh-density change without a loader-carried LOD would either ignore the computed LOD or risk visible cracks between chunks of different mesh densities (Required Review Brief, `NORTH_STAR.md`).
- Skirts avoid the combinatorial stitching cost of explicit edge-matching across every LOD pair.
- Evidence files: `src/components/World3D/createWorkerChunkLoader.ts`, `src/systems/world3d/chunkStreamer.ts`, `src/systems/world3d/chunkGeometry.ts`, `src/systems/world3d/lod.ts`.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D4).

Follow-up:
Implement the extended loader contract + skirt geometry; add mixed near/mid/low chunk regression tests before T7 closes. W3D-G16 (view-window widening) remains a separate follow-up decision.
