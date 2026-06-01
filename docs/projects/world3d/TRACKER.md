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
| T3 | not_started | Make `?phase=world3d` reliably enter the scene on first cold navigation (kill intermittent main_menu bounce) | unassigned | 2026-06-01 | live debugging this session; server logs show no Vite re-optimize, so race is app-level | Instrument mount-time phase dispatch order (useHistorySync initial-mount vs App game-init) | 3 consecutive clean cold loads land on world3d with terrain |
| T4 | not_started | Point the demo at a varied biome map so water/roads/towns are visible (currently all-`plains`) | unassigned | 2026-06-01 | `World3DDemo.tsx` builds `new Array(cells).fill('plains')` | Feed a multi-biome `WorldData` (or real generated world) into the demo loader | Screenshot shows blue rivers + tan roads + town boxes |
| T5 | not_started | Plan 4: wire 3D world into real gameplay (2D↔3D transition, Azgaar marker sync, playerWorldPos, submap/grid removal) | unassigned | 2026-06-01 | spec §13; not started | Write Plan 4 then implement | per Plan 4 acceptance |

## Completed / Superseded

| ID | Status | Task | Evidence |
|---|---|---|---|
| T1 | done | Convert scaffold into concrete state map + integration notes + gap list | This North Star refresh (2026-06-01) |
| T2 | superseded | Expand GAPS into execution-ready chunk-bundle-rendering gaps | Plan 3 landed the chunk-bundle rendering; superseded by the as-built docs |
| P1 | done | WorldSim rich `WorldData` (rivers/sites/roads/polygons) | Plan 1 commits; `worldsim-service` surface |
| P2 | done | Streaming infra (coords/streamer/worker/scene) | Plan 2 commits; 81-chunk window verified |
| P3 | done | Real per-chunk meshes via `ChunkMeshBundle` | Plan 3 commits `0fe92629…67502a29`; 61 tests |
| H1 | done | Rendering hardening (floating origin, vegetation cap, shadows off, context recovery, canvas height) | Hardening commits `1f7eeb42…c134077e`; live render verified |
