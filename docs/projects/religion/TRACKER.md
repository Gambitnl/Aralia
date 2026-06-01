# Religion System Living Tracker

Status: active
Last updated: 2026-05-31

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
| T1 | done | Create the religion living-project folder and seed documentation files. | Spark Worker | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Completed. | Folder contains NORTH_STAR, TRACKER, GAPS with focused evidence. |
| T2 | done | Capture concrete implementation map and runtime wiring for religion systems. | Spark Worker | 2026-05-31 | `src/systems/religion`, `src/state/reducers/religionReducer.ts`, `src/components/layout/GameModals.tsx`, `src/utils/world/templeUtils.ts` | Completed. | NORTH_STAR file points to concrete file map and flow list. |
| T3 | done | Record prioritized implementation gaps with evidence and follow-up checks. | Spark Worker | 2026-05-31 | `src/systems/religion/TempleSystem.ts`, `src/systems/religion/CombatReligionAdapter.ts`, `src/systems/rituals/RitualManager.ts` | Completed. | GAPS rows include evidence and next proof checks. |
| T4 | active | Prepare a cold-start pass checklist for follow-up implementation. | Spark Worker | 2026-05-31 | `docs/projects/religion/NORTH_STAR.md` | Keep this tracker and gap list aligned with immediate follow-up owner decisions. | Validate next worker starts from row G1 and G2 in order. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | support_needed_now | Spark Worker | `src/state/reducers/religionReducer.ts`, `src/types/state.ts` | NORTH_STAR rewrite | Dual write for favor/state still active: `state.religion` and legacy `state.divineFavor`/`state.temples` are updated together in reducer paths. | Existing behavior can drift between canonical and legacy slices as handlers evolve. | Keep update semantics as-is for compatibility, then choose a migration order and deprecation fence. | Verify reducer tests (`src/state/reducers/__tests__/religionReducer.test.ts`) still pass after planned migration. |
| G2 | active | support_needed_now | Spark Worker | `src/systems/religion/TempleSystem.ts`, `src/systems/religion/__tests__/TempleSystem.test.ts` | NORTH_STAR rewrite | Temple effect handling is still primarily string-driven, with partial typed-object support only for heal. | New service types can be silently mishandled or treated as unknown-effects. | Define a concrete service-effect union and enforce it in `TempleService.effect` handling. | Add regression tests for one structured heal and one non-heal structured outcome. |
| G3 | active | support_needed_now | Spark Worker | `src/systems/religion/CombatReligionAdapter.ts` | NORTH_STAR rewrite | Combat-to-religion trigger translation is minimal (`DESTROY_UNDEAD`, `KILL_ELF`, `HEAL_ALLY`, necromancy labels). | Faith response coverage may miss intended doctrine interactions. | Expand trigger matrix and add edge-case tests for case normalization, missing tags, and mixed labels. | Compare logs produced by adapter with deity trigger coverage in `src/data/deities/index.ts`. |
| G4 | active | support_needed_now | Spark Worker | `src/state/reducers/ritualReducer.ts`, `src/systems/rituals/RitualManager.ts` | NORTH_STAR rewrite | Ritual interruption failure path returns placeholder/empty backlash and TODO-heavy branches. | Religion-linked ritual outcomes can remain silent or misleading. | Convert backlash/interrupt consequences to explicit effect outputs and route outcomes to messaging/UI. | Confirm by adding expected-backlash assertions in ritual tests if this project owns the contract. |
| G5 | active | support_needed_now | Spark Worker | `src/hooks/actions/actionHandlers.ts`, `src/components/Religion/TempleModal.tsx` | NORTH_STAR rewrite | Action and UI boundaries still contain loose payload casts (`as any`) for faith actions and fallback reads from legacy state fields. | Small contract drift here can cause runtime breakage without compile errors. | Tighten shared action/service interfaces and remove unnecessary legacy fallbacks where project boundaries are set. | Compile-relevant type checks over `src/components/Religion/*` and `src/hooks/actions/actionHandlers.ts` after cleanup. |
