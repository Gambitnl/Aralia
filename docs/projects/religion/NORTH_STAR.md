# Religion System North Star

Status: active
Last updated: 2026-06-05

## Purpose
This project covers implemented religion systems in the current codebase:

- deity data and doctrine triggers
- temple generation and service handling
- favor changes from prayer, combat events, and temple actions
- ritual side effects where they currently intersect the ritual runtime

## Dashboard Card Schema

Project: Religion System
Slug: religion
Category: Gameplay Systems
Status: active
Confidence: medium
Evidence: docs/projects/religion
Gap signal: 5 open gaps
Protocol: living project doc set
Next step: Resume implementation from G1, then G2, in order.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

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

- Highest-risk seam: dual writes still hit `state.religion` and legacy `state.divineFavor`/`state.temples`.
- Temple effects still depend on string keys with only partial typed-object handling.
- Combat trigger coverage is narrow and hard-coded compared with deity doctrine intent.
- Ritual interruption and backlash handling in `RitualManager`/`ritualReducer` is still placeholder-first.
- Faith action payload typing remains loose at UI and handler boundaries.

## Concrete next checks

1. Resolve the migration order for G1 and keep compatibility writes fenced until the canonical state path is clear.
2. Define the G2 service-effect union and add at least one structured non-heal regression test.
3. Expand the combat trigger taxonomy after G1/G2 are stable enough to make the trigger map reliable.
4. Keep ritual consequence and UI typing follow-ups queued behind the state/effect contracts instead of widening now.

## Cold-start resume path

1. Read this file.
2. Read `docs/projects/religion/TRACKER.md`.
3. Read `docs/projects/religion/GAPS.md`.
4. Resume from G1, then G2, and only widen after those seams are stable.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
