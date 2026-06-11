# Environment System Living Tracker

Status: active
Last updated: 2026-06-09

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
| T1 | done | Create/refresh living-project documentation trio and capture required evidence paths. | Worker A | 2026-06-05 | `docs/projects/PROJECT_TRACKER.md`, `src/systems/environment/*` | Continue with implementation-facing backlog in `GAPS.md`. | Confirm docs now capture concrete gaps + file map + resume path. |
| T2 | done | Complete deterministic-enablement pass in handoff docs before runtime edits. | Worker A | 2026-06-05 | `docs/projects/environment/NORTH_STAR.md`, `docs/projects/environment/TRACKER.md`, `docs/projects/environment/GAPS.md` | Route the next agent into `G1` from `GAPS.md`. | Dashboard schema present; resume path and gap ordering are explicit. |
| T3 | done | Begin the first runtime slice by wiring weather progression from `G1` into a real runtime call path. | Worker A | 2026-06-09 | `src/systems/environment/EnvironmentSystem.ts`, `src/state/reducers/worldReducer.ts`, `src/state/reducers/__tests__/worldReducer.test.ts`, `docs/projects/environment/GAPS.md` | Start `G2` on RNG determinism policy for weather/naval systems. | `updateWeather` called on day-boundary `ADVANCE_TIME` and environment assertions are in reducer tests. |
| T4 | done | Define deterministic/randomness policy for weather and naval environment-linked RNG paths. | Worker A | 2026-06-09 | `src/systems/environment/WeatherSystem.ts`, `src/systems/naval/VoyageManager.ts`, `src/systems/naval/CrewManager.ts`, `src/data/naval/voyageEvents.ts`, `src/types/naval.ts`, `src/state/reducers/worldReducer.ts`, `src/state/reducers/navalReducer.ts`, `src/systems/environment/__tests__/WeatherSystem.test.ts`, `src/systems/naval/__tests__/VoyageManager.test.ts`, `src/state/reducers/__tests__/worldReducer.test.ts`, `src/state/reducers/__tests__/navalReducer.test.ts` | Split deterministic weather/naval reducer paths from fallback helpers and document the replay policy in docs. | Replay stability test for identical seed and repeated day advancement / voyage paths passed. |
| T5 | done | Resolve the terrain-rule ownership split by making TerrainSystem canonical and keeping EnvironmentSystem as a compatibility overlay. | Worker A | 2026-06-09 | `src/systems/environment/EnvironmentSystem.ts`, `src/systems/environment/TerrainSystem.ts`, `src/systems/environment/__tests__/EnvironmentSystem.test.ts`, `src/systems/environment/__tests__/TerrainSystem.test.ts` | Start `G4` on legacy `currentWeather` typing and loose weather reads. | Focused terrain regression test shows canonical `mud` movement cost stays at 3 while EnvironmentSystem compatibility `mud` stays at 2. |
| T6 | done | Wire the next Environment slice into live hazard and terrain consumers. | Worker A | 2026-06-09 | `src/commands/effects/MovementCommand.ts`, `src/systems/environment/EnvironmentSystem.ts`, `src/systems/environment/TerrainSystem.ts`, `src/commands/effects/__tests__/MovementCommand.test.ts`, `src/systems/environment/__tests__/EnvironmentSystem.test.ts`, `src/systems/environment/__tests__/TerrainSystem.test.ts` | G5 is now resolved in the combat movement landing path; keep the weather bridge intact while the next Environment slice is chosen. | MovementCommand terrain/hazard landing test now proves the helper output matters in live flow. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | support_needed_now | Worker A | `docs/projects/environment/GAPS.md` | Source inspection | Environment weather simulation is not advancing during gameplay flow. | `src/systems/environment/WeatherSystem.ts` has TODO "integrate into useTurnManager"; `rg -n "updateWeather\\("` previously showed only tests and implementation file use. | Repeated weather snapshots reduce world reactivity and can make environmental effects stale. | Added day-boundary production call from `ADVANCE_TIME` in `worldReducer.ts`; proof in `src/state/reducers/__tests__/worldReducer.test.ts`. | Verified by reducer integration test asserting `environment` mutation and biome-based `updateWeather` calls. |
| G2 | resolved | stability_risk | Worker A | `docs/projects/environment/GAPS.md` | Source inspection | RNG mix in weather and naval daily logic previously broke deterministic replay assumptions. | `src/systems/environment/WeatherSystem.ts`, `src/systems/naval/VoyageManager.ts`, and `src/systems/naval/CrewManager.ts` now use seeded reducer inputs or deterministic fallback seeds instead of ambient/random-date sources. | Deterministic seeds are now threaded through the active world/naval replay lane, so environment-driven outcomes can replay from `worldSeed`. | Seeded weather/naval replay policy implemented and documented; move to the next open lane. | Replay-stability tests now compare identical seed/state runs in world and naval reducer tests. |
| G3 | resolved | architecture_risk | Worker A | `docs/projects/environment/GAPS.md` | Source inspection | Duplicate terrain authority: `EnvironmentSystem.TERRAIN_RULES` and `TerrainSystem.TERRAIN_RULES` diverged by keys and shape. | `src/systems/environment/EnvironmentSystem.ts`, `src/systems/environment/TerrainSystem.ts`, `src/systems/environment/__tests__/EnvironmentSystem.test.ts` (compatibility overlay plus canonical registry proof). | Divergent sources would create inconsistent terrain behavior if both remained equally authoritative. | TerrainSystem is now the canonical shared registry; EnvironmentSystem keeps a battle-map compatibility overlay for legacy callers. | Focused terrain regression tests now verify canonical `mud` stays at movement cost 3 while EnvironmentSystem compatibility `mud` stays at 2. |
| G4 | done | typing_gap | Worker A | `docs/projects/environment/GAPS.md` | Source inspection and focused verification | Legacy `currentWeather` string and loose casting weakened cross-system typing, but the bridge is now derived from canonical weather state. | `src/types/environment.ts`, `src/state/initialState.ts`, `src/state/reducers/worldReducer.ts`, `src/systems/world/WorldEventManager.ts`, `src/hooks/useConversation.ts`, `src/hooks/useCompanionCommentary.ts`, `src/hooks/useCompanionBanter.ts`, `src/hooks/actions/handleNpcInteraction.ts`, and `src/types/__tests__/environment.test.ts`. | Hidden casts no longer hide coupling bugs in the direct weather read path, and the compatibility bridge still survives for older consumers. | Move to `G5` and keep the bridge helper in place unless a product/schema change later retires it. | Focused helper, hook, and world-manager tests passed on 2026-06-09. |
| G5 | resolved | integration_gap | Worker A | `docs/projects/environment/GAPS.md` | Source inspection and focused verification | Hazard and terrain helpers were test-validated but not obviously integrated into live movement/combat loops. | `src/commands/effects/MovementCommand.ts`, `src/systems/environment/EnvironmentSystem.ts`, `src/systems/environment/TerrainSystem.ts`, `src/commands/effects/__tests__/MovementCommand.test.ts`, `src/systems/environment/__tests__/EnvironmentSystem.test.ts`, `src/systems/environment/__tests__/TerrainSystem.test.ts` | The combat movement landing path now applies the environment terrain overlay and hazard status effect when a creature lands on mud. | Keep the combat landing proof archived; open a new gap only if a future slice needs travel-path parity or additional terrain cases. | MovementCommand terrain/hazard landing test passed on 2026-06-09. |

## Notes

- All entries above are local to this project unless moved explicitly to another owning tracker.
- `T3` now names the first runtime slice directly so the next cold start can move from docs to implementation without guesswork.
- `T4` is complete and `G2` is resolved; `G3`, `G4`, and `G5` are now resolved as well, so the next safe environment slice will come from the next tracker gap.
- Keep updates documentation-first until execution approval; this file is evidence of the intended next slice.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
