# Environment System Audit Or Proof

Status: active
Last updated: 2026-06-25

This file stores concise proof summaries for the Environment System living
project.

## Proof Log

| Date | Proof | Result | Evidence |
|---|---|---|---|
| 2026-06-09 | Legacy `currentWeather` bridge normalized onto canonical `GameState.environment` reads | Passed | `src/types/environment.ts`, `src/state/initialState.ts`, `src/state/reducers/worldReducer.ts`, `src/systems/world/WorldEventManager.ts`, `src/hooks/useConversation.ts`, `src/hooks/useCompanionCommentary.ts`, `src/hooks/useCompanionBanter.ts`, `src/hooks/actions/handleNpcInteraction.ts`, `src/types/__tests__/environment.test.ts`, `src/hooks/__tests__/useCompanionBanter.test.ts`, `src/hooks/__tests__/useCompanionCommentary.test.ts`, `src/systems/world/__tests__/WorldEventManager.test.ts` |
| 2026-06-09 | Seeded replay policy for weather and naval RNG paths | Passed | `src/systems/environment/WeatherSystem.ts`, `src/systems/naval/VoyageManager.ts`, `src/systems/naval/CrewManager.ts`, `src/state/reducers/worldReducer.ts`, `src/state/reducers/navalReducer.ts`, `src/systems/environment/__tests__/WeatherSystem.test.ts`, `src/systems/naval/__tests__/VoyageManager.test.ts`, `src/state/reducers/__tests__/worldReducer.test.ts`, `src/state/reducers/__tests__/navalReducer.test.ts` |
| 2026-06-09 | Living-project docs audit follow-up | Passed after adding the missing support docs and prompt needle | `docs/projects/environment/DECISIONS.md`, `docs/projects/environment/RUNBOOK.md`, `docs/projects/environment/AUDIT_OR_PROOF.md`, `docs/projects/environment/COLD_START_AGENT_PROMPT.md` |
| 2026-06-09 | Terrain-rule ownership split resolved with TerrainSystem canonical and EnvironmentSystem compatibility overlay | Passed | `src/systems/environment/EnvironmentSystem.ts`, `src/systems/environment/TerrainSystem.ts`, `src/systems/environment/__tests__/EnvironmentSystem.test.ts`, `src/systems/environment/__tests__/TerrainSystem.test.ts` |
| 2026-06-09 | Combat movement landing now resolves battle-map terrain cost and mud/quicksand hazard status | Passed | `src/commands/effects/MovementCommand.ts`, `src/systems/environment/EnvironmentSystem.ts`, `src/systems/environment/TerrainSystem.ts`, `src/commands/effects/__tests__/MovementCommand.test.ts`, `src/systems/environment/__tests__/EnvironmentSystem.test.ts`, `src/systems/environment/__tests__/TerrainSystem.test.ts`, `src/systems/environment/__tests__/hazards.test.ts` |
| 2026-06-25 | Base URL consumer migration completed and old config-refactor proposal retired | Passed | `src/config/env.ts`, `src/components/ThreeDModal/Experimental/VoxelTerrain.tsx`, `src/components/ThreeDModal/Experimental/DeformableTerrain.tsx`, `src/components/DesignPreview/steps/PreviewIcons.tsx`, `src/components/DesignPreview/steps/PreviewRaceTraits.tsx`, `src/components/DesignPreview/steps/PreviewMissingIcons.tsx` |

## What The Proof Covers

- Weather progression on the active reducer lane uses a seeded RNG path.
- Voyage event rolls and crew recruitment replay from the same stable state.
- The legacy `currentWeather` label remains available as a derived compatibility bridge, but direct reads now go through `GameState.environment`.
- Identical seed/state runs now produce matching weather and naval outputs in focused tests.

## What Remains Open

- `G3`, `G4`, and `G5` are resolved in source and docs. No Environment project gap remains open on this slice.
