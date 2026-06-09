# TRACKER: WorldSim Service

Status: review-required
Last updated: 2026-06-08

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
| T3 | done | Grow first-build world history/story/events generation (the simulation half of this surface) | codex | 2026-06-08 | `src/services/WorldHistoryService.ts`; `src/services/__tests__/WorldHistoryService.test.ts` | Define a test-backed, deterministic first-build history contract that yields seeded founding/pact/discovery events without changing geometry source-of-truth | Next slice: attach returned history to initial game bootstrap/save flow and persist through save-load compatibility |
| T4 | done | WSS-004 remediation — replace the silent flat-world fallback with a real biome-derived heightfield (chose policy A over policy B: a biome→elevation map is cheap, deterministic, and ships relief instead of an error state, which is strictly better UX than refusing 3D entry) | claude | 2026-06-02 | `src/services/worldSim/heightFromBiomes.ts` (+`__tests__`), `src/state/migrations/worldDataMigration.ts`, `src/types/world.ts`/`world.d.ts`, `src/components/World3D/DebugHUD.tsx`, `src/services/__tests__/mapService.fallback.test.ts` | Follow-up WSS-007 (smooth derived heights) | Real `generateMap` legacy-fallback yields `distinct=38 min=25 max=88` heights (was constant 30); 21 unit/integration tests green; `tsc` clean on touched files |
| T5 | done | WSS-006 remediation — derive fallback temperatures/moisture from biome bands instead of flat constants | Codex | 2026-06-08 | `src/state/migrations/worldDataMigration.ts`, `src/services/worldSim/climateFromBiomes.ts`, `src/services/worldSim/__tests__/climateFromBiomes.test.ts`, `src/state/migrations/__tests__/worldDataMigration.test.ts` | Keep WSS-007 in view; do not widen into smoothing or story/history | `npm test -- --run src/services/worldSim/__tests__/climateFromBiomes.test.ts src/state/migrations/__tests__/worldDataMigration.test.ts` (14 tests passed); biome-derived climate now varies and stays deterministic |
| T6 | done | WSS-007 remediation — smooth biome-derived fallback heights to reduce border seams | Codex | 2026-06-08 | `src/services/worldSim/heightFromBiomes.ts`, `src/services/worldSim/__tests__/heightFromBiomes.test.ts`, `src/state/migrations/__tests__/worldDataMigration.test.ts` | Preserve seed determinism while reducing cliff seams and keeping broad band ordering | `npm test -- --run src/services/worldSim/__tests__/heightFromBiomes.test.ts src/state/migrations/__tests__/worldDataMigration.test.ts` (18 tests passed); focused worldSim suite still green |
| T7 | blocked | WSS-005 proof and review gate — 2D atlas and 3D WorldData feature sources diverge | Codex worker | 2026-06-08 | `src/services/worldSim/__tests__/featureSourceTruth.test.ts`, `src/services/azgaarDerivedMapService.ts`, `src/services/worldSim/index.ts` | Human/product decision required: consume Azgaar feature hints into `WorldData`, or make 2D consume `WorldData` | `npm test -- --run src/services/worldSim/__tests__/featureSourceTruth.test.ts` (1 test passed); WSS-005a added as the smaller bridge-spec follow-up |
| T8 | done | WSS-008 bootstrap/save bridge - attach first-build history to game start and preserve it through save/load | Codex | 2026-06-08 | `src/hooks/useGameInitialization.ts`, `src/state/actionTypes.ts`, `src/state/appState.ts`, `src/services/saveLoadService.ts`, `src/services/__tests__/saveLoadService.test.ts`, `src/state/__tests__/appState.worldHistory.test.ts` | Keep WSS-005 review gate separate; do not widen this bridge into the feature-source decision | `npm test -- --run src/services/__tests__/WorldHistoryService.test.ts src/services/__tests__/saveLoadService.test.ts src/state/__tests__/appState.worldHistory.test.ts` (24 tests passed); standard start, dummy start, and legacy load now keep worldHistory wired or backfilled |
## Gap Log

- World snapshot generation is synchronous and has no measured frame-time budget for large maps. (WSS-001)
- WorldData version migration policy for v3+ is not yet documented. (WSS-002)
- `WorldData` feature output (roads/rivers/sites) and 3D visual rendering are partially coupled; compatibility constraints are not fully codified. (WSS-003)
- ~~Silent flat-world fallback (WSS-004)~~ — REMEDIATED 2026-06-02 via biome-derived heightfield (T4).
- 2D-atlas vs 3D river/site/road divergence at the source (WSS-005) — review-required; source of truth undecided and proven by `featureSourceTruth.test.ts`.
- Biome-fallback climate fields (temp/moisture) were remediated (WSS-006).
- Biome-derived heightfield seam cliffs were remediated with deterministic smoothing (WSS-007).
