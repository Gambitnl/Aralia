# TRACKER: WorldSim Service

Status: active
Last updated: 2026-06-05

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
| T4 | done | WSS-004 remediation — replace the silent flat-world fallback with a real biome-derived heightfield (chose policy A over policy B: a biome→elevation map is cheap, deterministic, and ships relief instead of an error state, which is strictly better UX than refusing 3D entry) | claude | 2026-06-02 | `src/services/worldSim/heightFromBiomes.ts` (+`__tests__`), `src/state/migrations/worldDataMigration.ts`, `src/types/world.ts`/`world.d.ts`, `src/components/World3D/DebugHUD.tsx`, `src/services/__tests__/mapService.fallback.test.ts` | Follow-ups WSS-006 (derive fallback temp/moisture) and WSS-007 (smooth derived heights) | Real `generateMap` legacy-fallback yields `distinct=38 min=25 max=88` heights (was constant 30); 21 unit/integration tests green; `tsc` clean on touched files |

## Gap Log

- World snapshot generation is synchronous and has no measured frame-time budget for large maps. (WSS-001)
- WorldData version migration policy for v3+ is not yet documented. (WSS-002)
- `WorldData` feature output (roads/rivers/sites) and 3D visual rendering are partially coupled; compatibility constraints are not fully codified. (WSS-003)
- ~~Silent flat-world fallback (WSS-004)~~ — REMEDIATED 2026-06-02 via biome-derived heightfield (T4).
- 2D-atlas vs 3D river/site/road divergence at the source (WSS-005) — source of truth undecided.
- Biome-fallback climate fields (temp/moisture) are still flat constants (WSS-006).
- Biome-derived heightfield has no spatial smoothing → cliff seams at biome borders (WSS-007).
