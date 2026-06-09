# Environment System North Star

Status: active
Last updated: 2026-06-09

## Why this project exists
The Environment System is a partial gameplay domain with a defined file surface but incomplete runtime integration. This doc set preserves the current evidence, names the live blockers, and gives the next agent a direct resume path instead of forcing another cold re-discovery pass.

## Current state (evidence-backed)
- Registered and claimed by `docs/projects/PROJECT_TRACKER.md` under Gameplay & World Systems.
- `GameState` carries `environment?: WeatherState`, and initial state still seeds `DEFAULT_WEATHER`.
- Weather, terrain, and hazard helpers are implemented and tested, with runtime coupling now partially closed:
  - weather progression is now called from `worldReducer.ts` on day-boundary `ADVANCE_TIME`;
  - terrain/hazard helpers are covered by tests but not clearly wired into live movement/combat flow;
  - legacy or mixed reads still appear in world/naval/commentary paths.
- The remaining work is an implementation slice, not a redesign. The project is still intentionally expanding, with deterministic enablement unresolved.

## File map

### Core system surface
- `src/systems/environment/EnvironmentSystem.ts` - weather modifiers, terrain rules, `DEFAULT_WEATHER`.
- `src/systems/environment/WeatherSystem.ts` - biome climate profiles, visibility rules, `updateWeather`.
- `src/systems/environment/TerrainSystem.ts` - terrain registry and helpers.
- `src/systems/environment/hazards.ts` - `NATURAL_HAZARDS` and `evaluateHazard`.
- `src/systems/environment/__tests__/*` - coverage for weather, terrain rules, and hazards.

### Type/state integration
- `src/types/environment.ts` - `WeatherState`, terrain/hazard interfaces, legacy `currentWeather?: string`.
- `src/types/state.ts` - `environment?: WeatherState` in `GameState`.
- `src/state/initialState.ts` - initial environment default.

### Runtime coupling lanes
- `src/state/reducers/worldReducer.ts` - advances environment progression on day-boundary `ADVANCE_TIME` via `updateWeather`.
- `src/state/reducers/navalReducer.ts` - passes `state.environment` into voyage progression.
- `src/systems/naval/VoyageManager.ts` - uses `weather.wind` and `weather.precipitation`.
- `src/systems/world/WorldEventManager.ts` - still applies weather checks through `(state as any).weather`.
- `src/hooks/useConversation.ts`, `src/hooks/useCompanionCommentary.ts`, `src/hooks/useCompanionBanter.ts` - still read `currentWeather` bridges.

## Partial / uncertain areas
- Which terrain registry is canonical: `EnvironmentSystem.TERRAIN_RULES` or `TerrainSystem.TERRAIN_RULES`.
- Whether `currentWeather` should stay as a compatibility bridge or be formally retired.
- Whether weather progression belongs in turn updates, daily clock updates, or explicit event triggers.
- Whether naval weather state should remain narrative or use full `WeatherState`.

## Determinism status
- Deterministic surfaces:
  - terrain lookups and hazard definitions are pure map data;
  - adjacent world systems already use seeded RNG for repeatable simulation.
- Non-deterministic surfaces:
  - `src/systems/environment/WeatherSystem.ts` uses `Math.random`;
  - `src/systems/naval/VoyageManager.ts` uses `Math.random`;
  - `src/systems/naval/CrewManager.ts` mixes Date-seeded RNG with runtime randomness.
- Result: environment outcomes are not yet guaranteed to replay cleanly from `worldSeed`.

## Dashboard Card Schema

Project: Environment System
Slug: environment
Category: Gameplay & World Systems
Status: partial
Confidence: medium
Evidence: docs/projects/environment
Gap signal: 4 open project gaps
Protocol: living project doc set
Next step: Start `T4` and define deterministic weather/naval randomness policy for `G2`.
Required verification: scoped_tests, deterministic_replay_or_state_change
Completed verification: docs_consistency, scoped_tests
Last proof: 2026-06-09
Workflow gaps reviewed: 2026-06-09

## Active task (current resume)

| Field | Value |
|---|---|
| Task | Runtime wiring for `G1` completed: `ADVANCE_TIME` now calls weather progression and reducer tests cover biome resolution and call-path behavior. |
| Scope boundaries | Source edits were limited to `src/state/reducers/worldReducer.ts`, `src/state/reducers/__tests__/worldReducer.test.ts`, and environment docs; no game-system architectural scope was expanded. |
| Acceptance criteria | Weather is updated on day-boundary time advancement, biome selection resolves coordinate tiles, and tests prove state changes through reducer output. |
| Owner | Worker A |
| Next action | Start `G2` from `TRACKER.md`: resolve deterministic policy for weather/naval `Math.random` usage. |

## Cold-start resume path
1. Read this file.
2. Read `docs/projects/environment/TRACKER.md`.
3. Read `docs/projects/environment/GAPS.md`.
4. Re-check `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md` if the next slice needs scope validation.
5. Re-open source evidence in `src/systems/environment/*`, `src/types/environment.ts`, `src/state/initialState.ts`, `src/state/reducers/worldReducer.ts`, `src/state/reducers/navalReducer.ts`, `src/systems/world/WorldEventManager.ts`, and `src/systems/naval/VoyageManager.ts`.
6. Continue with implementation starting from `G2` if approved.
