# World 3D System Living Tracker

Status: active
Last updated: 2026-06-02

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
| T10 | not_started | Seat site/town boxes on the terrain surface — they currently render at `Y=radius*0.5` and are **buried** under the now-exaggerated terrain, so towns are invisible (W3D-G15) — **highest visual-value next task** | unassigned | 2026-06-02 | `World3DScene` `SitePieces` line ~108; `ChunkSite` has no surface Y | Carry a sampled surface Y on `ChunkSite` (via sampler + `heightToMeters`) and seat the box on it | A town box sits on the ground in a town-containing chunk |
| T11 | not_started | De-dupe / chunk-scope site React keys — live console spams duplicate-key warnings; towns may flicker/double-render (W3D-G18) | unassigned | 2026-06-02 | console during `?phase=world3d`; `SitePieces` keys on `s.id` | Key by `${cx}|${cy}|${s.id}` and/or de-dupe sites per chunk | No duplicate-key warning with multiple chunks loaded |
| T9 | not_started | Blend biome colors across boundaries (W3D-G12) | unassigned | 2026-06-01 | `chunkSampler.sampleBiomeNearest` + per-vertex `biomeColor` → hard seams | Feather biome color across a band | Adjacent biomes show a gradient, not a hard line |
| T6 | not_started | Mesh `WorldData.lakes` polygons (only river ribbons today) | unassigned | 2026-06-01 | `waterGeometry.ts` builds ribbons only | Add lake-fill geometry behind the bundle | Lake renders in a lake-containing chunk |
| T7 | not_started | Per-LOD geometry detail (lower mesh resolution for mid/low tiers) | unassigned | 2026-06-01 | `lod.ts` tier unused by sampler resolution | Lower `resolution` for distant tiers | Perf delta + visible LOD falloff |
| — | routed | Cold-load `?phase=world3d` entry bounce | world-3d-ui | 2026-06-01 | routed from world3d | Owned by `world-3d-ui` (entry) | see `docs/projects/world-3d-ui/GAPS.md` W3DUI-5 |
| — | routed | Plan 4: 2D↔3D transition + marker sync + gameplay routing | world-3d-ui | 2026-06-01 | routed from world3d | Owned by `world-3d-ui` (transition) | see `docs/projects/world-3d-ui/` |

## Completed / Superseded

| ID | Status | Task | Evidence |
|---|---|---|---|
| T8 | done | Add vertical exaggeration so terrain relief is legible (W3D-G11) | `config.VERTICAL_EXAGGERATION=12` + single pure `heightToMeters()` source consumed in lockstep by terrain/water/road/vegetation Y-mappers; camera + relief-aware demo spawn lift to ground; live screenshot shows a clear peaked ridge (was a flat plane). Uncovered+fixed W3D-G17 (StrictMode-killed streamer → blank live scene; now 81 chunks load). 76 world3d tests pass (added StrictMode regression + exaggeration assertions); tsc clean for world3d. Residual flatness → W3D-G16 (sub-cell view window) |
| T4 | done | Point the demo at a varied biome world (real `generateMap` pipeline) so content renders, not uniform plains | World3DDemo uses `generateMap(...).worldData` + town spawn; live screenshot shows ocean+landmass biome variety; 81 chunks; tsc clean; 70 tests (W3D-G8). Full river/road/town legibility gated by T8/W3D-G11 |
| T1 | done | Convert scaffold into concrete state map + integration notes + gap list | This North Star refresh (2026-06-01) |
| T2 | superseded | Expand GAPS into execution-ready chunk-bundle-rendering gaps | Plan 3 landed the chunk-bundle rendering; superseded by the as-built docs |
| P1 | done | WorldSim rich `WorldData` (rivers/sites/roads/polygons) | Plan 1 commits; `worldsim-service` surface |
| P2 | done | Streaming infra (coords/streamer/worker/scene) | Plan 2 commits; 81-chunk window verified |
| P3 | done | Real per-chunk meshes via `ChunkMeshBundle` | Plan 3 commits `0fe92629…67502a29`; 61 tests |
| H1 | done | Rendering hardening (floating origin, vegetation cap, shadows off, context recovery, canvas height) | Hardening commits `1f7eeb42…c134077e`; live render verified |
