# Environment System Gap Registry

Status: active
Last updated: 2026-06-09

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | integration_gap | Worker A | `docs/projects/environment/TRACKER.md` | Source inspection | Weather update was not connected to runtime progression. | `src/systems/environment/WeatherSystem.ts` includes `updateWeather`; `src/systems/environment/EnvironmentSystem.ts` exports `DEFAULT_WEATHER`; `src/state/reducers/worldReducer.ts` now calls `updateWeather`. | Without progression wiring, weather never changes over rounds, making time/day systems and climate rules inert in play. | Production call is live on day-boundary `ADVANCE_TIME`; next action now moves to `G2` determinism work. | Verified via `src/state/reducers/__tests__/worldReducer.test.ts` and runtime-callpoint proof updates. |
| G2 | not_started | determinism_gap | Worker A | `docs/projects/environment/TRACKER.md` | Source inspection | Environment and naval daily logic relies on `Math.random` in production paths, conflicting with seeded replay expectations elsewhere. | `src/systems/environment/WeatherSystem.ts` (`Math.random`, `weightedRandom`), `src/systems/naval/VoyageManager.ts` (`Math.random` event/roll paths), `src/systems/naval/CrewManager.ts` date-seeded RNG. | Replays tied to `state.worldSeed` can diverge when weather and voyage outcomes drift. | Define a seeded RNG policy for weather progression and voyage events or explicitly separate non-replay features. | Add seed-stability test comparing outcomes from same seed over repeated runs. |
| G3 | not_started | architecture_gap | Worker A | `docs/projects/environment/TRACKER.md` | Source inspection | `EnvironmentSystem.ts` and `TerrainSystem.ts` each export overlapping terrain rule definitions. | `TERRAIN_RULES` exists in both files with different key sets and terrain coverage. | Ambiguity creates maintenance risk and potentially inconsistent movement/cover outcomes. | Consolidate one canonical rule source and keep legacy map compatibility in a controlled adapter. | Add documentation + code review proving all terrain consumers use one canonical source. |
| G4 | not_started | typing_gap | Worker A | `docs/projects/environment/TRACKER.md` | Source inspection | Legacy `currentWeather` and any-cast paths cause schema drift between producers/consumers. | `src/types/environment.ts` includes `currentWeather?: string`; `src/systems/world/WorldEventManager.ts` uses `(state as any).weather`. | Loose typing can hide missing weather updates and break when migrating from legacy save structures. | Replace loose access with typed `state.environment` reads and normalize `currentWeather` derivation. | Add type-level enforcement test (or compile check) that disallows loose weather reads. |
| G5 | not_started | integration_gap | Worker A | `docs/projects/environment/TRACKER.md` | Source inspection | Hazards and terrain effects are not visibly attached to combat/movement execution pathways in production code. | `rg -n "getTerrainMovementCost|getTerrainCover|evaluateHazard"` hits tests in `src/systems/environment/__tests__`, but no direct core gameplay caller sites were found. | If helpers remain test-only, users won't see expected terrain/weather impact in live loops. | Add dedicated integration points and wire callsites in movement/combat generators where appropriate. | Add end-to-end test(s) validating terrain/hazard impacts in game flow. |

## Local context notes

- The above gaps are aligned with `docs/projects/environment/TRACKER.md` and should be treated as the local default scope unless re-routed by a stricter domain owner.
- No cross-project or orphaned gaps were added to `docs/projects/GLOBAL_GAPS.md` yet.
- This pass removed the `G1` blocking runtime wiring gap; this registry now points `G3` forward for architecture decisions while runtime weather progression is live.

### Runtime progression proof (2026-06-09)

- Implemented `resolveBiomeId` + daily `updateWeather` progression in `src/state/reducers/worldReducer.ts`.
- Wired `daysPassed` cadence through `ADVANCE_TIME`, with `TimeOfDay` derived from progressive day timestamps.
- Added reducer tests in `src/state/reducers/__tests__/worldReducer.test.ts` to verify:
  - day-advance triggers weather update,
  - non-day advance does not trigger weather update,
  - `coord_x_y` biome lookup is used for map-tile locations.
