# World3d Living Tracker

Status: active â€” T7/W3D-G10 decision recorded 2026-06-10; implementation lane open
Last updated: 2026-06-12

North Star: `docs/projects/world3d/NORTH_STAR.md`
Gap registry: `docs/projects/world3d/GAPS.md`

## Status Vocabulary
- `not_started` â€” known work, not active yet
- `active` â€” being handled now
- `waiting` â€” waiting on external check/actor (include next-check condition)
- `blocked` â€” next action known but blocked (include owner + unblock condition)
- `done` â€” complete, evidence linked
- `superseded` â€” replaced (link replacement)
- `out_of_scope` â€” recorded for awareness only

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| T7 | not_started | Per-LOD geometry detail (lower mesh resolution for mid/low tiers, W3D-G10) | unassigned | 2026-06-10 | Worker review found the current loader request only carries `cx/cy`; `ChunkStreamer` computes/stores `lod` after load dispatch, and `chunkGeometry.ts` has no mixed-resolution seam/skirt contract. **Decision recorded 2026-06-10 (Remy, `docs/projects/DECISION_BLITZ_2026-06-10.md` D4):** extend the chunk-loader request contract to carry the requested LOD tier; skirt geometry hides mixed-resolution seams. Lane reopened. | Implement the extended loader contract (requested LOD tier on chunk loads) + skirt geometry per the decided contract. | Mixed near/mid/low chunk regression tests land with the implementation. |
| â€” | routed | Cold-load `?phase=world3d` entry bounce | world-3d-ui | 2026-06-01 | routed from world3d | Owned by `world-3d-ui` (entry) | see `docs/projects/world-3d-ui/GAPS.md` W3DUI-5 |
| â€” | routed | Plan 4: 2Dâ†”3D transition + marker sync + gameplay routing | world-3d-ui | 2026-06-01 | routed from world3d | Owned by `world-3d-ui` (transition) | see `docs/projects/world-3d-ui/` |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
