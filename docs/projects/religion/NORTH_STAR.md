# Religion System North Star

Status: active
Last updated: 2026-05-31

## Purpose
This project covers implemented religion systems in the current codebase:

- deity data and doctrine triggers
- temple generation and service handling
- favor changes from prayer, combat events, and temple actions
- ritual side effects where they currently intersect the ritual runtime

## Why this folder exists
Religion is already a registered project in `docs/projects/PROJECT_TRACKER.md`, but behavior is spread across system files, reducers, action types, and UI. This folder consolidates a practical cold-start map of what exists, how it is wired, and what is uncertain.

## Bounded Evidence Map

| Area | Files |
|---|---|
| Core data | `src/data/deities/index.ts`, `src/data/temples/index.ts`, `src/data/religion/blessings.ts` |
| Religion systems | `src/systems/religion/index.ts`, `src/systems/religion/TempleSystem.ts`, `src/systems/religion/CombatReligionAdapter.ts`, `src/systems/religion/__tests__/*` |
| Types/contracts | `src/types/religion.ts`, `src/types/state.ts`, `src/types/index.ts`, `src/types/actions.ts` |
| Reducers | `src/state/reducers/religionReducer.ts`, `src/state/reducers/townReducer.ts`, `src/state/reducers/worldReducer.ts`, `src/state/reducers/ritualReducer.ts`, `src/state/actionTypes.ts` |
| Utilities | `src/utils/religionUtils.ts`, `src/utils/world/religionUtils.ts`, `src/utils/world/templeUtils.ts`, `src/utils/world/__tests__/religionUtils.test.ts` |
| Ritual bridge | `src/systems/rituals/RitualManager.ts`, `src/systems/rituals/__tests__/*`, `src/types/rituals.ts` |
| UI/modal flow | `src/components/Religion/TempleModal.tsx`, `src/components/Religion/DivineFavorPanel.tsx`, `src/components/layout/GameModals.tsx`, `src/state/reducers/townReducer.ts` |
| Action entry | `src/hooks/actions/actionHandlers.ts`, `src/components/layout/GameModals.tsx` |

## Implemented state and flow

- `OPEN_TEMPLE` generates a village temple via `generateVillageTemple` and opens `state.templeModal` in `townReducer`.
- `TempleSystem` validates service affordability and applies side effects through `resolveServiceEffect`, including both string and limited object-based effects.
- `religionReducer` updates divine favor for `PRAY`, `TRIGGER_DEITY_ACTION`, and `USE_TEMPLE_SERVICE`, and writes updates into both `state.religion` and legacy `state.divineFavor`.
- `CombatReligionAdapter` maps combat log entries into religion triggers (`DESTROY_UNDEAD`, `KILL_ELF`, `HEAL_ALLY`, necromancy-related triggers).
- `worldReducer` runs ritual advancement on `ADVANCE_TIME`; `RitualManager` controls ritual progress and interruption.
- UI layer reads from `state.religion` in `DivineFavorPanel` and shows services in `TempleModal`, both surfaced by `GameModals`.

## Current gaps and next checks

- Most temple effects are still string-keyed and partially typed (`TempleService.effect` supports object forms but handler branches are narrow).
- A legacy dual-write path exists: `state.religion` plus `state.divineFavor` (and `state.temples`).
- Trigger coverage from combat is narrow and hard-coded; deities with broader trigger intent are likely underrepresented.
- Ritual interruption and backlash handling in `RitualManager`/`ritualReducer` is placeholder-first.
- Temple/action payload typing remains partly loose at action boundaries.

## Concrete next checks

1. Reconcile trigger and effect taxonomies (`DEITIES`, `TempleService.effect`, `CombatReligionAdapter`) against a single owned schema.
2. Decide migration sequence for legacy religion state duplication and remove cross-field drift risk.
3. Expand `TempleSystem` effect handling from string heuristics to typed service outcomes.
4. Validate ritual interrupt -> consequence behavior (especially UI and messaging expectations) in an explicit follow-up tracker.

## Cold-start resume path

1. Read this file.
2. Read `docs/projects/religion/TRACKER.md`.
3. Read `docs/projects/religion/GAPS.md`.
4. Resume from highest-priority open gap in the tracker.
