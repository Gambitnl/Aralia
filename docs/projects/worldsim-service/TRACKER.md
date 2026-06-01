# TRACKER: WorldSim Service

Status: active
Last updated: 2026-05-31

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
| T2 | active | Add/refresh worldsim-specific gap records from source scan | Codex | 2026-05-31 | `src/state/migrations/worldDataMigration.ts`, `src/services/saveLoadService.ts`, `src/systems/world3d/chunkStreamer.ts` | Confirm no accidental scope drift into `docs/projects/world` or `worldsim` runtime changes | `docs/projects/worldsim-service/GAPS.md` |

## Gap Log

- World snapshot generation is synchronous and has no measured frame-time budget for large maps.
- WorldData version migration policy for v3+ is not yet documented.
- `WorldData` feature output (roads/rivers/sites) and 3D visual rendering are partially coupled; compatibility constraints are not fully codified.
