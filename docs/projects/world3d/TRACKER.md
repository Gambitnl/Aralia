# World 3D System Living Tracker

Status: active
Last updated: 2026-06-01

North Star: `docs/projects/world3d/NORTH_STAR.md`
Gap registry: `docs/projects/world3d/GAPS.md`

## Status Vocabulary
- `not_started` — known work, not active yet
- `active` — being handled now
- `waiting` — waiting on external check/actor (include next-check condition)
- `blocked` — next action known but blocked (include owner + unblock condition)
- `done` — complete, evidence linked
- `superseded` — replaced (link replacement)
- `out_of_scope` — recorded for awareness only

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| T8 | not_started | Add vertical exaggeration so terrain relief (and thus rivers/roads/towns) is legible — **highest visual-value next task** (W3D-G11) | unassigned | 2026-06-01 | T4 screenshot: flat land/ocean plane; `MAX_TERRAIN_HEIGHT_M=150` over 1024m cells | Add an exaggeration factor in `chunkGeometry`/`config`; re-verify content reads | Screenshot shows hills + visible river/road ribbons |
| T9 | not_started | Blend biome colors across boundaries (W3D-G12) | unassigned | 2026-06-01 | `chunkSampler.sampleBiomeNearest` + per-vertex `biomeColor` → hard seams | Feather biome color across a band | Adjacent biomes show a gradient, not a hard line |
| T6 | not_started | Mesh `WorldData.lakes` polygons (only river ribbons today) | unassigned | 2026-06-01 | `waterGeometry.ts` builds ribbons only | Add lake-fill geometry behind the bundle | Lake renders in a lake-containing chunk |
| T7 | not_started | Per-LOD geometry detail (lower mesh resolution for mid/low tiers) | unassigned | 2026-06-01 | `lod.ts` tier unused by sampler resolution | Lower `resolution` for distant tiers | Perf delta + visible LOD falloff |
| — | routed | Cold-load `?phase=world3d` entry bounce | world-3d-ui | 2026-06-01 | routed from world3d | Owned by `world-3d-ui` (entry) | see `docs/projects/world-3d-ui/GAPS.md` W3DUI-5 |
| — | routed | Plan 4: 2D↔3D transition + marker sync + gameplay routing | world-3d-ui | 2026-06-01 | routed from world3d | Owned by `world-3d-ui` (transition) | see `docs/projects/world-3d-ui/` |

## Completed / Superseded

| ID | Status | Task | Evidence |
|---|---|---|---|
| T4 | done | Point the demo at a varied biome world (real `generateMap` pipeline) so content renders, not uniform plains | World3DDemo uses `generateMap(...).worldData` + town spawn; live screenshot shows ocean+landmass biome variety; 81 chunks; tsc clean; 70 tests (W3D-G8). Full river/road/town legibility gated by T8/W3D-G11 |
| T1 | done | Convert scaffold into concrete state map + integration notes + gap list | This North Star refresh (2026-06-01) |
| T2 | superseded | Expand GAPS into execution-ready chunk-bundle-rendering gaps | Plan 3 landed the chunk-bundle rendering; superseded by the as-built docs |
| P1 | done | WorldSim rich `WorldData` (rivers/sites/roads/polygons) | Plan 1 commits; `worldsim-service` surface |
| P2 | done | Streaming infra (coords/streamer/worker/scene) | Plan 2 commits; 81-chunk window verified |
| P3 | done | Real per-chunk meshes via `ChunkMeshBundle` | Plan 3 commits `0fe92629…67502a29`; 61 tests |
| H1 | done | Rendering hardening (floating origin, vegetation cap, shadows off, context recovery, canvas height) | Hardening commits `1f7eeb42…c134077e`; live render verified |
