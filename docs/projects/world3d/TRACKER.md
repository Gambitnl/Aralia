# World 3D System Living Tracker

Status: active
Last updated: 2026-06-05 (T13)

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
| T10 | done | Seat site/town boxes on the terrain surface (W3D-G15) | claude | 2026-06-02 | Live screenshot: golden town box sitting on terrain. `surfaceY` carried on `ChunkSite` via sampler bilinear sample + `heightToMeters`; box at `surfaceY + radius*0.5`; chunk-scoped React key; `MAX_RADIUS_M=80` cap to prevent camera-inside-box back-face culling. 76 tests pass. Also folded T11/W3D-G18 (chunk-scoped key). | — | — |
| T11 | done | Chunk-scope site React keys (W3D-G18) — folded into T10 | claude | 2026-06-02 | `key={``${chunk.cx}\|${chunk.cy}\|${s.id}``}` in `SitePieces`. Remaining warnings from boundary sites appearing in multiple chunks → W3D-G20. | — | — |
| T12 | done | Fix chunkSampler half-open boundary interval so boundary sites appear in exactly one chunk (W3D-G20) | claude | 2026-06-02 | Site filter changed to half-open `[min, max)` (`< aabb.maxGX`/`< aabb.maxGY`). Resolves W3D-G20 **and** W3D-G18 (the residual dup-key cause). Discovery: all 58 demo sites are integer-grid → on a chunk boundary, so the old `<=` duplicated essentially every site. 2 new boundary unit tests; 9 chunkSampler tests pass; tsc clean for world3d. Verified by deterministic in-page replay (seed 2026): `sitesInMultipleChunks: []`, `duplicateGeneratorIds: []`. New gaps: W3D-G21 (polyline clip still inclusive on both edges → boundary rivers/roads double-drawn), W3D-G22 (sites quantized to integer grid → always seat at chunk NW corner). | — | — |
| T13 | done | Make river/road polyline clip half-open on max edges so boundary-coincident segments are owned by one chunk (W3D-G21) | claude | 2026-06-02 | `clipSegment` max-edge tests are now half-open: parallel-coincident segments are rejected with `q <= 0` on the two max edges (`x < maxX`, `y < maxY`) while min edges stay inclusive (`q < 0`) — mirrors the W3D-G20 site rule. 2 new unit tests (boundary-coincident polyline → upper chunk only; min-edge-coincident → still admitted); 67 world3d tests pass; tsc clean. Verified by deterministic in-page replay (seed 2026): 116 boundary-coincident road segments exist; old inclusive clipper double-counted 31/34 roads (length ratio up to 2.0×), half-open clipper yields 1.0× for all 34. Live `?phase=world3d` re-verified: terrain + site render intact (no regression). New gaps: W3D-G23 (roads drawn at hardcoded uniform width, `type` ignored), W3D-G24 (no spatial pre-filter — every polyline clipped against every chunk). | — | — |
| T9 | not_started | Blend biome colors across boundaries (W3D-G12) | unassigned | 2026-06-01 | `chunkSampler.sampleBiomeNearest` + per-vertex `biomeColor` → hard seams | Feather biome color across a band | Adjacent biomes show a gradient, not a hard line |
| T6 | not_started | Mesh `WorldData.lakes` polygons (only river ribbons today) | unassigned | 2026-06-01 | `waterGeometry.ts` builds ribbons only | Add lake-fill geometry behind the bundle | Lake renders in a lake-containing chunk |
| T7 | not_started | Per-LOD geometry detail (lower mesh resolution for mid/low tiers) | unassigned | 2026-06-01 | `lod.ts` tier unused by sampler resolution | Lower `resolution` for distant tiers | Perf delta + visible LOD falloff |
| T14 | not_started | Fix town footprint radius formula (W3D-G19) | unassigned | 2026-06-02 | Voronoi-footprint radius → ~785m cubes, capped at 80m stopgap in T10; town boxes bear no relation to settlement size | Replace with a fixed visual scale or population-based formula in `siteGeometry.ts` | Box diameter visually plausible (<100m), no back-face culling, scales with site importance |
| T15 | not_started | Width-by-road-type for road ribbons (W3D-G23) | unassigned | 2026-06-02 | `chunkSampler` hardcodes road width `0.04`, ignoring `road.type`; all roads identical | Map `road.type`→width (lookup) in the sampler | Different road `type`s render at visibly different widths |
| T16 | not_started | Spatial pre-filter for polyline clipping (W3D-G24) | unassigned | 2026-06-02 | Every river/road clipped against every chunk; no bbox reject | Add polyline-bbox vs chunk-AABB overlap test before `clipPolylineToChunk` | Clip work proportional to nearby polylines; perf delta measured |
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
