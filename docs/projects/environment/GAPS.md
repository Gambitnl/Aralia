# Environment System Gap Registry

Status: active
Last updated: 2026-06-09

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | integration_gap | Worker A | `docs/projects/environment/TRACKER.md` | Source inspection | Weather update was not connected to runtime progression. | `src/systems/environment/WeatherSystem.ts` includes `updateWeather`; `src/systems/environment/EnvironmentSystem.ts` exports `DEFAULT_WEATHER`; `src/state/reducers/worldReducer.ts` now calls `updateWeather`. | Without progression wiring, weather never changes over rounds, making time/day systems and climate rules inert in play. | Production call is live on day-boundary `ADVANCE_TIME`; next action now moves to `G2` determinism work. | Verified via `src/state/reducers/__tests__/worldReducer.test.ts` and runtime-callpoint proof updates. |
| G2 | resolved | determinism_gap | Worker A | `docs/projects/environment/TRACKER.md` | Source inspection | Environment and naval daily logic previously relied on ambient or date-seeded randomness in production paths, conflicting with seeded replay expectations elsewhere. | `src/systems/environment/WeatherSystem.ts`, `src/systems/naval/VoyageManager.ts`, `src/systems/naval/CrewManager.ts`, `src/data/naval/voyageEvents.ts`, and `src/types/naval.ts` now use seeded reducer inputs, event-effect random callbacks, or deterministic fallback seeds instead of `Math.random`/`Date.now` sources on the active replay path. | Replays tied to `state.worldSeed` now hold steady when weather, voyage event effects, and crew outcomes repeat. | Seeded weather/naval replay policy implemented and documented; move to the next open lane. | Added seed-stability tests comparing identical seed/state runs in weather, world reducer, voyage manager, and naval reducer paths. |
| G3 | resolved | architecture_gap | Worker A | `docs/projects/environment/TRACKER.md` | Source inspection | `EnvironmentSystem.ts` and `TerrainSystem.ts` each export overlapping terrain rule definitions. | `src/systems/environment/EnvironmentSystem.ts` now uses a battle-map compatibility overlay, while `src/systems/environment/TerrainSystem.ts` remains the canonical shared registry. | The split is now intentional instead of ambiguous, and the compatibility overlay preserves battle-map behavior while shared terrain rules have one read path. | TerrainSystem is the canonical shared terrain registry; EnvironmentSystem keeps a local adapter for battle-map callers. | Focused terrain regression tests verify canonical `mud` stays at movement cost 3 while EnvironmentSystem compatibility `mud` stays at 2. |
| G4 | resolved | typing_gap | Worker A | `docs/projects/environment/TRACKER.md` | Source inspection and focused verification | Legacy `currentWeather` and any-cast paths caused schema drift between producers/consumers, but the bridge is now derived from canonical weather state. | `src/types/environment.ts`, `src/state/initialState.ts`, `src/state/reducers/worldReducer.ts`, `src/systems/world/WorldEventManager.ts`, `src/hooks/useConversation.ts`, `src/hooks/useCompanionCommentary.ts`, `src/hooks/useCompanionBanter.ts`, `src/hooks/actions/handleNpcInteraction.ts`, and `src/types/__tests__/environment.test.ts`. | Loose typing no longer hides missing weather updates in the direct read path, and legacy consumers still receive a compatibility label. | Keep `currentWeather` only as a derived bridge while `GameState.environment` remains the canonical read/write surface. | Focused helper, hook, and world-manager tests passed on 2026-06-09. |
| G5 | resolved | integration_gap | Worker A | `docs/projects/environment/TRACKER.md` | Source inspection and focused verification | Hazards and terrain effects were not visibly attached to combat/movement execution pathways in production code. | `src/commands/effects/MovementCommand.ts`, `src/systems/environment/EnvironmentSystem.ts`, `src/systems/environment/TerrainSystem.ts`, `src/commands/effects/__tests__/MovementCommand.test.ts`, `src/systems/environment/__tests__/EnvironmentSystem.test.ts`, `src/systems/environment/__tests__/TerrainSystem.test.ts` | Battle-map movement now resolves landing terrain through the compatibility overlay and applies the mud/quicksand hazard status on landing. | Keep the combat landing proof archived; if travel-path parity becomes the next scope, open a fresh gap instead of widening this one. | MovementCommand terrain/hazard landing test passed on 2026-06-09. |

## Local context notes

- The above gaps are aligned with `docs/projects/environment/TRACKER.md` and should be treated as the local default scope unless re-routed by a stricter domain owner.
- No cross-project or orphaned gaps were added to `docs/projects/GLOBAL_GAPS.md` yet.
- This pass removed the `G1` blocking runtime wiring gap and resolved `G2`; `G3`, `G4`, and `G5` are now resolved as well, while runtime weather progression and seeded replay remain live and the legacy weather bridge remains in place for compatibility.

### Runtime progression proof (2026-06-09)

- Implemented `resolveBiomeId` + daily `updateWeather` progression in `src/state/reducers/worldReducer.ts`.
- Wired `daysPassed` cadence through `ADVANCE_TIME`, with `TimeOfDay` derived from progressive day timestamps.
- Added reducer tests in `src/state/reducers/__tests__/worldReducer.test.ts` to verify:
  - day-advance triggers weather update,
  - non-day advance does not trigger weather update,
  - `coord_x_y` biome lookup is used for map-tile locations.

### Seeded replay proof (2026-06-09)

- Added explicit seeded RNG plumbing for weather progression in `src/state/reducers/worldReducer.ts` and seeded voyage/crew plumbing in `src/state/reducers/navalReducer.ts`.
- Updated `src/systems/environment/WeatherSystem.ts`, `src/systems/naval/VoyageManager.ts`, `src/systems/naval/CrewManager.ts`, `src/data/naval/voyageEvents.ts`, and `src/types/naval.ts` to avoid ambient/random-date sources on the active replay path.
- Added replay-stability tests in:
  - `src/systems/environment/__tests__/WeatherSystem.test.ts`
  - `src/systems/naval/__tests__/VoyageManager.test.ts`
  - `src/state/reducers/__tests__/worldReducer.test.ts`
  - `src/state/reducers/__tests__/navalReducer.test.ts`
