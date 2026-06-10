---
schema_version: 1
project: Environment System
slug: environment
category: "Gameplay & World Systems"
main_category: "Game & Simulation"
subcategory: "World, Travel & Maps"
status: partial
last_updated: 2026-06-09
confidence: medium
evidence: docs/projects/environment
gap_signal: 0 open project gaps
protocol: living project doc set
next_step: Wait for the next Environment gap or re-route an adjacent slice if product asks for more terrain coverage.
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - scoped_tests
  - deterministic_replay_or_state_change
  - docs_consistency
completed_verification:
  - docs_consistency
  - scoped_tests
  - deterministic_replay_or_state_change
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Environment System North Star

Status: partial
Last updated: 2026-06-09

## Why this project exists
The Environment System is a partial gameplay domain with a defined file surface but incomplete runtime integration. This doc set preserves the current evidence, names the live blockers, and gives the next agent a direct resume path instead of forcing another cold re-discovery pass.

## Current state (evidence-backed)
- Registered and claimed by `docs/projects/PROJECT_TRACKER.md` under Gameplay & World Systems.
- `GameState` carries `environment?: WeatherState`, and initial state still seeds `DEFAULT_WEATHER` with the legacy `currentWeather` label derived as a compatibility bridge.
- Weather, terrain, and hazard helpers are implemented and tested, with runtime coupling now partially closed:
  - weather progression is now called from `worldReducer.ts` on day-boundary `ADVANCE_TIME` with a seeded RNG derived from `worldSeed`, day, and biome;
  - the direct weather read path now flows through `GameState.environment`, while the legacy `currentWeather` label stays available as a derived compatibility bridge for older prompts and saves;
  - naval reducer paths now seed voyage event selection, event-effect dice, and crew recruitment instead of relying on ambient randomness;
  - terrain ownership is now resolved: `TerrainSystem.TERRAIN_RULES` is the canonical shared registry, and `EnvironmentSystem.TERRAIN_RULES` is a battle-map compatibility overlay that preserves legacy movement costs;
  - terrain/hazard helpers now flow through the battle-map combat movement landing path, where mud tiles can trigger quicksand on entry;
  - the world-event and companion commentary paths now read the canonical environment object instead of any-casting weather state;
- The remaining work is now adjacent expansion rather than the original G5 slice. The project is still intentionally expanding, with the seeded-replay lane now defined for active weather and naval progression paths and combat movement landing proofs now in place.

## File map

### Core system surface
- `src/systems/environment/EnvironmentSystem.ts` - weather modifiers, compatibility terrain overlay, `DEFAULT_WEATHER`.
- `src/systems/environment/WeatherSystem.ts` - biome climate profiles, visibility rules, `updateWeather`.
- `src/systems/environment/TerrainSystem.ts` - terrain registry and helpers.
- `src/systems/environment/hazards.ts` - `NATURAL_HAZARDS` and `evaluateHazard`.
- `src/systems/environment/__tests__/*` - coverage for weather, terrain rules, and hazards.

### Type/state integration
- `src/types/environment.ts` - `WeatherState`, terrain/hazard interfaces, derived `currentWeather?: string` compatibility bridge, and weather-summary helpers.
- `src/types/state.ts` - `environment?: WeatherState` in `GameState`.
- `src/state/initialState.ts` - initial environment default.

### Runtime coupling lanes
- `src/state/reducers/worldReducer.ts` - advances environment progression on day-boundary `ADVANCE_TIME` via `updateWeather`.
- `src/state/reducers/navalReducer.ts` - passes `state.environment` into voyage progression.
- `src/systems/naval/VoyageManager.ts` - uses `weather.wind` and `weather.precipitation`.
- `src/systems/world/WorldEventManager.ts` - weather checks now read `state.environment` with `DEFAULT_WEATHER` as the safe fallback.
- `src/hooks/useConversation.ts`, `src/hooks/useCompanionCommentary.ts`, `src/hooks/useCompanionBanter.ts`, `src/hooks/actions/handleNpcInteraction.ts` - read the shared weather summary helper instead of loose `currentWeather` access.

## Partial / uncertain areas
- Terrain registry ownership is now resolved: `TerrainSystem.TERRAIN_RULES` is canonical, and `EnvironmentSystem.TERRAIN_RULES` is the compatibility overlay.
- Whether weather progression belongs in turn updates, daily clock updates, or explicit event triggers.
- Whether naval weather state should remain narrative or use full `WeatherState`.

## Determinism status
- Deterministic surfaces:
  - terrain lookups and hazard definitions are pure map data;
  - `src/state/reducers/worldReducer.ts` now threads seeded weather progression from `worldSeed` through the active daily advance lane;
  - `src/state/reducers/navalReducer.ts` now threads seeded voyage, event-effect, and crew rolls through the active naval lane.
- Fallback surfaces:
  - `src/systems/environment/WeatherSystem.ts`, `src/systems/naval/VoyageManager.ts`, and `src/systems/naval/CrewManager.ts` now derive deterministic fallback seeds when called directly without an injected RNG.
- Result: the active reducer-backed environment/naval path now replays cleanly from `worldSeed`; the older `src/systems/naval/NavalLogic.ts` helper still exists as a separate legacy lane and was left untouched in this pass.

## Dashboard Card Schema

Project: Environment System
Slug: environment
Category: Gameplay & World Systems
Status: partial
Confidence: medium
Evidence: docs/projects/environment
Gap signal: 0 open project gaps
Protocol: living project doc set
Next step: Wait for the next Environment gap or re-route an adjacent slice if product asks for more terrain coverage.
Required verification: scoped_tests, deterministic_replay_or_state_change
Completed verification: docs_consistency, scoped_tests, deterministic_replay_or_state_change
Last proof: 2026-06-09
Workflow gaps reviewed: 2026-06-09

## Active task (current resume)

| Field | Value |
|---|---|
| Task | `G5` combat movement landing integration is resolved: battle-map landing tiles now flow through the environment terrain/hazard helpers. |
| Scope boundaries | Source edits were limited to `src/commands/effects/MovementCommand.ts`, `src/systems/environment/EnvironmentSystem.ts`, `src/systems/environment/TerrainSystem.ts`, `src/commands/effects/__tests__/MovementCommand.test.ts`, `src/systems/environment/__tests__/EnvironmentSystem.test.ts`, `src/systems/environment/__tests__/TerrainSystem.test.ts`, and `src/systems/environment/__tests__/hazards.test.ts`, plus the environment docs that record the combat landing proof. |
| Acceptance criteria | The live combat movement landing path now consumes terrain/hazard helper output, mud can trigger quicksand on entry, and the weather bridge policy from G4 remains intact. |
| Owner | Worker A |
| Next action | Wait for the next Environment tracker gap or a re-routed adjacent slice. |

## Cold-start resume path
1. Read this file.
2. Read `docs/projects/environment/TRACKER.md`.
3. Read `docs/projects/environment/GAPS.md`.
4. Re-check `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md` if the next slice needs scope validation.
5. Re-open source evidence in `src/systems/environment/*`, `src/types/environment.ts`, `src/state/initialState.ts`, `src/state/reducers/worldReducer.ts`, `src/state/reducers/navalReducer.ts`, `src/systems/world/WorldEventManager.ts`, and `src/systems/naval/VoyageManager.ts`.
6. Continue only after a fresh Environment gap is opened or an adjacent slice is explicitly re-routed here.
