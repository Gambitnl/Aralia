# Environment System Living Tracker

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
| T1 | done | Create/refresh living-project documentation trio and capture required evidence paths. | Worker A | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`, `src/systems/environment/*` | Continue with implementation-facing backlog in `GAPS.md`. | Confirm docs now capture concrete gaps + file map + resume path. |
| T2 | active | Complete deterministic-enablement pass in handoff docs before runtime edits. | Worker A | 2026-05-31 | `src/systems/environment/WeatherSystem.ts`, `src/state/reducers/worldReducer.ts`, `src/systems/world/WorldEventManager.ts`, `src/state/reducers/navalReducer.ts` | Prioritize G1, G3 in `GAPS.md`; propose first implementation slice boundaries. | Evidence-backed decisions recorded in `docs/projects/environment/GAPS.md`. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | support_needed_now | Worker A | `docs/projects/environment/GAPS.md` | Source inspection | Environment weather simulation is not advancing during gameplay flow. | `src/systems/environment/WeatherSystem.ts` has TODO "integrate into useTurnManager"; `rg -n "updateWeather\\("` shows only tests and implementation file use. | Repeated weather snapshots reduce world reactivity and can make environmental effects stale. | Decide scheduler integration point (turn/day update) in next implementation slice. | Add proof by calling `updateWeather` from a real reducer/runner and asserting state change. |
| G2 | active | stability_risk | Worker A | `docs/projects/environment/GAPS.md` | Source inspection | RNG mix: `Math.random` in weather and naval daily logic breaks deterministic replay assumptions. | `src/systems/environment/WeatherSystem.ts` uses `Math.random`; `src/systems/naval/VoyageManager.ts` uses `Math.random` and unseeded event rolls. | Deterministic seeds are used in nearby world systems, so environment-driven outcomes can desync from saved/world seed runs. | Define and implement seeded weather/naval RNG strategy. | Create deterministic tests comparing saved-state replay across runs. |
| G3 | active | architecture_risk | Worker A | `docs/projects/environment/GAPS.md` | Source inspection | Duplicate terrain authority: `EnvironmentSystem.TERRAIN_RULES` and `TerrainSystem.TERRAIN_RULES` diverge by keys and shape. | `src/systems/environment/EnvironmentSystem.ts`, `src/systems/environment/TerrainSystem.ts` (both export `TERRAIN_RULES` and movement/cover data). | Divergent sources create inconsistent terrain behavior if both are eventually used. | Resolve canonical owner and migrate dependent callers to one map. | Add a migration checklist + alias compatibility map. |
| G4 | active | typing_gap | Worker A | `docs/projects/environment/GAPS.md` | Source inspection | Legacy `currentWeather` string and loose casting weaken cross-system typing. | `src/types/environment.ts` has `currentWeather?: string`; `src/systems/world/WorldEventManager.ts` casts `(state as any).weather`. | Hidden casts hide coupling bugs and widen runtime assumptions between weather systems. | Normalize a single environment read/write contract (`environment: WeatherState`) and remove temporary casts. | Add compile-time check proving all weather reads go through `GameState.environment`. |
| G5 | active | integration_gap | Worker A | `docs/projects/environment/GAPS.md` | Source inspection | Hazard and terrain helpers are currently test-validated but not obviously integrated into live movement/combat loops. | `rg` hits for `getTerrainMovementCost`, `getTerrainCover`, `evaluateHazard` are only in environment tests. | Gameplay effects are not yet reliably applied during core interactions. | Wire runtime paths (movement, travel, combat hazards) to helper outputs with explicit ownership. | Add at least one end-to-end integration test for terrain/hazard effects. |

## Notes

- All entries above are local to this project unless moved explicitly to another owning tracker.
- Keep updates documentation-first until execution approval; this file is evidence of the intended next slice.
