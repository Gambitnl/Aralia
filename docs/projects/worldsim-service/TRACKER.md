# TRACKER: WorldSim Service

Status: active
Last updated: 2026-06-01

North Star: `docs/projects/worldsim-service/NORTH_STAR.md`
Scope (clarified 2026-06-01): world **generation + simulation** — the geometry pipeline
(`src/services/worldSim`, built) AND first-build world history/story/events
(`src/services/WorldHistoryService.ts`, growth area). Boundary: this surface owns world
**birth**; `docs/projects/world` owns ongoing world **runtime**.

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Build concise cold-start docs for simulation ownership, migration, world snapshots, and sync/perf boundaries | Codex | 2026-05-31 | `src/services/worldSim`, `src/state/migrations/worldDataMigration.ts`, `src/services/world3d` | Keep scope strictly to docs only under `docs/projects/worldsim-service/*` | `docs/projects/worldsim-service/NORTH_STAR.md`, `docs/projects/worldsim-service/GAPS.md`, `docs/projects/worldsim-service/TRACKER.md` |
| T2 | done | Add/refresh worldsim-specific gap records from source scan | Codex | 2026-05-31 | `worldDataMigration.ts`, `saveLoadService.ts`, `chunkStreamer.ts` | — | `GAPS.md` populated (WSS-001..003) |
| T3 | not_started | Grow first-build world history/story/events generation (the simulation half of this surface) | claude (claimed) | 2026-06-01 | `src/services/WorldHistoryService.ts` (early seed) | Define what "world story at first build" produces (seeded history, founding events, lore) and how it attaches to `WorldData`/save; then a slice plan | A `WorldData`/save carries generated world-history that the atlas/3D can surface |

## Gap Log

- World snapshot generation is synchronous and has no measured frame-time budget for large maps.
- WorldData version migration policy for v3+ is not yet documented.
- `WorldData` feature output (roads/rivers/sites) and 3D visual rendering are partially coupled; compatibility constraints are not fully codified.
