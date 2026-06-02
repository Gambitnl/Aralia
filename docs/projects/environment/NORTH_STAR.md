# Environment System North Star

Status: active
Last updated: 2026-05-31

## Why this project exists
The Environment System is a partial gameplay domain with a defined file surface but incomplete runtime integration. This project doc set preserves intent and enables the next agent to continue with a verified starting point instead of re-discovering split ownership.

## Current state (evidence-backed)
- Registered and claimed by `docs/projects/PROJECT_TRACKER.md` under Gameplay & World Systems.
- Environment state exists in `GameState` as `environment?: WeatherState` and is initialized to `DEFAULT_WEATHER`.
- Weather and terrain surfaces are implemented, with tests, but production call paths are incomplete:
  - Weather update logic exists and is tested, yet has no production caller.
  - Terrain and hazard helpers exist and are tested, but are not visibly wired from runtime movement/combat loops.
  - World and naval systems consume weather in partial ways, often through legacy or mixed surfaces.
- This pass found explicit "unfinished integration" TODOs in source indicating known gaps, not accidental omissions.

## File map

### Core system surface
- `src/systems/environment/EnvironmentSystem.ts`
  - Weather modifiers for spells, terrain rules, and `DEFAULT_WEATHER`.
- `src/systems/environment/WeatherSystem.ts`
  - Biome-specific climate profiles, base visibility rules, and `updateWeather`.
- `src/systems/environment/TerrainSystem.ts`
  - Terrain registry and helpers (`getTerrainMovementCost`, `getTerrainCover`, `terrainGrantsStealth`).
- `src/systems/environment/hazards.ts`
  - `NATURAL_HAZARDS` and `evaluateHazard`.
- `src/systems/environment/__tests__/*`
  - Test coverage for weather, terrain rules, and hazard evaluation.

### Type/state integration
- `src/types/environment.ts`
  - `WeatherState`, terrain and hazard interfaces, and legacy `currentWeather?: string`.
- `src/types/state.ts`
  - `environment?: WeatherState` in `GameState`.
- `src/state/initialState.ts`
  - Initial environment default (`DEFAULT_WEATHER`).

### Runtime coupling lanes
- `src/state/reducers/worldReducer.ts`
  - Processes daily world events but does not currently call environment progression.
- `src/state/reducers/navalReducer.ts`
  - Passes `state.environment` into voyage progression.
- `src/systems/naval/VoyageManager.ts`
  - Uses `weather.wind` and `weather.precipitation` to adjust movement.
- `src/systems/world/WorldEventManager.ts`
  - Applies weather checks using `(state as any).weather`.
- `src/hooks/useConversation.ts`
  - Uses `state.environment?.currentWeather`.
- `src/hooks/useCompanionCommentary.ts`
  - Uses `gameState.environment?.currentWeather`.
- `src/hooks/useCompanionBanter.ts`
  - Uses `state.environment?.currentWeather`.

## Partial / uncertain areas
- Which terrain registry is authoritative:
  - `EnvironmentSystem.TERRAIN_RULES` and
  - `TerrainSystem.TERRAIN_RULES`.
- Whether legacy `currentWeather` should remain a string bridge or become deprecated.
- Whether weather progression should be seeded in turn updates, daily clock updates, or explicit event triggers.
- Whether naval weather state should remain narrative (`'Calm'`, `'Stormy'`) or use full `WeatherState`.

## Determinism status
- Deterministic surfaces:
  - Terrain lookups and hazard definitions are pure map data.
  - Many nearby world systems use seeded RNG (`SeededRandom`) for repeatable simulation.
- Non-deterministic surfaces:
  - `src/systems/environment/WeatherSystem.ts` uses `Math.random`.
  - `src/systems/naval/VoyageManager.ts` uses `Math.random`.
  - `src/systems/naval/CrewManager.ts` uses a Date-seeded RNG instance and random runtime flow.
- Result: environment outcomes are not guaranteed to be fully replay-compatible with `worldSeed` today.

## Active task (this pass)

| Field | Value |
|---|---|
| Task | Enrich the Environment project docs with evidence-backed state, file map, partial/uncertain areas, concrete gaps, and a continuation path. |
| Scope boundaries | Documentation-only updates under `docs/projects/environment/*`; no source edits. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` now include evidence-backed integration status and testable next actions. |
| Owner | Worker A |
| Next action | Move from doc state to implementation slice planning in `TRACKER.md` and `GAPS.md`. |

## Cold-start resume path
1. Read this file.
2. Read `docs/projects/environment/TRACKER.md`.
3. Read `docs/projects/environment/GAPS.md`.
4. Re-check:
   - `docs/projects/PROJECT_TRACKER.md`
   - `docs/projects/GLOBAL_GAPS.md`
5. Re-open source evidence in:
   - `src/systems/environment/*`
   - `src/types/environment.ts`
   - `src/state/initialState.ts`
   - `src/state/reducers/worldReducer.ts`
   - `src/state/reducers/navalReducer.ts`
   - `src/systems/world/WorldEventManager.ts`
   - `src/systems/naval/VoyageManager.ts`
6. Continue with implementation if approved.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
