# Environment System Decisions

Status: active
Last updated: 2026-06-09

This file records the stable environment-system decisions that matter to the
next agent. It stays short so the current policy is easy to recover.

## Decisions

| ID | Decision | Status | Evidence | Notes |
|---|---|---|---|---|
| D-01 | Active weather progression should remain on the day-boundary `ADVANCE_TIME` lane in `worldReducer.ts`. | recorded | `src/state/reducers/worldReducer.ts`, `src/state/reducers/__tests__/worldReducer.test.ts`, `docs/projects/environment/GAPS.md` | Preserves the existing runtime scheduler boundary while still advancing weather in play. |
| D-02 | Weather, voyage, and crew RNG on the active replay lane should use seeded inputs from `worldSeed` or deterministic fallback seeds instead of ambient `Math.random` / date-seeded randomness. | recorded | `src/systems/environment/WeatherSystem.ts`, `src/systems/naval/VoyageManager.ts`, `src/systems/naval/CrewManager.ts`, `src/state/reducers/navalReducer.ts` | Keeps replay behavior stable without deleting the legacy helper lane. |
| D-03 | The seeded replay proof was kept separate from terrain ownership while that split was still unresolved. | recorded | `docs/projects/environment/TRACKER.md`, `docs/projects/environment/GAPS.md` | Historical boundary for the replay pass; superseded once G3 resolved. |
| D-04 | TerrainSystem is the canonical shared terrain registry, and EnvironmentSystem keeps a battle-map compatibility overlay for legacy callers. | recorded | `src/systems/environment/EnvironmentSystem.ts`, `src/systems/environment/TerrainSystem.ts`, `src/systems/environment/__tests__/EnvironmentSystem.test.ts` | Preserves both surfaces while naming one read path for shared terrain data. |
| D-05 | `currentWeather` stays as a derived compatibility label on `WeatherState`, but new reads should go through `GameState.environment`. | recorded | `src/types/environment.ts`, `src/state/initialState.ts`, `src/state/reducers/worldReducer.ts`, `src/systems/world/WorldEventManager.ts`, `src/hooks/useConversation.ts`, `src/hooks/useCompanionCommentary.ts`, `src/hooks/useCompanionBanter.ts`, `src/hooks/actions/handleNpcInteraction.ts` | Keeps legacy prompts and save consumers working without preserving the old loose read path. |

## Open Follow-Ups

None. `G3`, `G4`, and `G5` are resolved in source and docs; open a fresh gap before assigning another Environment pass.
