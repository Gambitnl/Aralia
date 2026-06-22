# World3d Living Tracker

Status: active â€” T7/W3D-G10 implemented 2026-06-21
Last updated: 2026-06-21

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
| T7 | done | Per-LOD geometry detail (lower mesh resolution for mid/low tiers, W3D-G10) | iteration-agent | 2026-06-21 | Implemented the decided D4 contract. `ChunkLoader` now carries the requested `lod` tier (`types.ts`); `ChunkStreamer.pump` computes the tier from chunk distance at request time and passes it (`chunkStreamer.ts`). `config.LOD_RESOLUTION` maps full=16/mid=9/low=5 with `resolutionForLod()`; all loaders honor it (`createWorkerChunkLoader.ts`, `groundChunkLoader.ts`, `World3DDemo` inline). `chunkGeometry.ts` adds an opt-in perimeter **skirt** (adaptive depth = max(SKIRT_MIN_DEPTH_M, chunk relief)) on `buildTerrainMesh`; `buildPlaceholderHeightfield` stays skirtless. Tests: 91 world3d + 30 World3D-component pass, incl. new mixed near/mid/low regression (`chunkSkirt.test.ts`), loader-tier (`createWorkerChunkLoader.test.ts`), streamer-passes-tier (`chunkStreamer.test.ts`), `resolutionForLod` (`config.test.ts`). Visual: `?phase=world3d` renders seam-free, no console errors (`.agent/3d-visual-quality/captures/lod-after.png`). | Done. Follow-up W3D-G16 (view-window widening) is a separate decision; W3D-G13 `culled`-tier dead branch remains. | â€” |
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
