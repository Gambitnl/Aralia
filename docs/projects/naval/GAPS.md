# Naval System Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | support_needed_now | Worker A | `docs/projects/naval/TRACKER.md` | Baseline scan | `NAVAL_REPAIR_SHIP` is declared but not handled by `navalReducer`. | `src/state/actionTypes.ts`, `src/state/reducers/navalReducer.ts` | UI/logic can dispatch an action that produces no state change, masking feature gaps as implemented behavior. | Add reducer case or remove/rename action contract if no repair flow exists. | Update action coverage and add reducer test asserting state change. |
| G2 | active | support_needed_now | Worker A | `docs/projects/naval/TRACKER.md` | Baseline scan | Water movement is blocked in movement action flow, so voyage start is not naturally reachable from travel UX. | `src/hooks/actions/handleMovement.ts`, `src/systems/naval/VoyageManager.ts`, `src/state/actionTypes.ts` | Naval content can run only through direct actions; world travel flow does not produce consistent voyage states. | Add a supported sea-transition path from movement/port selection into `NAVAL_START_VOYAGE`. | Create an end-to-end test that moves into water/sea travel and receives a voyage state update. |
| G3 | active | support_needed_now | Worker A | `docs/projects/naval/TRACKER.md` | Baseline scan | Voyage events can set voyage status to `Combat`, but no downstream combat handoff consumes this status. | `src/data/naval/voyageEvents/index.ts`, `src/systems/naval/VoyageManager.ts`, `src/state/reducers/navalReducer.ts` | Player can enter a non-terminal combat state with no next action, producing dead-end simulation. | Define a handoff contract to an encounter or naval-combat pipeline. | Trigger a combat-class voyage event in test and verify next reducer/system transition. |
| G4 | active | support_needed_now | Worker A | `docs/projects/naval/TRACKER.md` | Bounded scan | Two voyage event catalogs exist with divergent definitions. | `src/data/naval/voyageEvents.ts`, `src/data/naval/voyageEvents/index.ts` | Import path differences can alter behavior across callers and break event balancing. | Consolidate to one canonical catalog and migration-safe source file. | Confirm no remaining callers to the deprecated catalog and single-source test fixture exists. |
| G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/naval/TRACKER.md` | UI scan | `NavalCombatSystem` is implemented and tested but not invoked by encounter or action selectors. | `src/systems/naval/NavalCombatSystem.ts`, `src/state`, `src/hooks` | Combat path exists as an islanded module and is not usable in gameplay flow. | Decide if naval combat uses generic encounter state or dedicated naval reducer path. | Add route-level verification that combat status emits into one authoritative battle flow. |
| G6 | not_started | adjacent_follow_up | Worker A | `docs/projects/naval/TRACKER.md` | Baseline scan | `ShipPane` mostly reads state and has limited action controls despite available reducer actions. | `src/components/Naval/ShipPane.tsx`, `src/state/reducers/navalReducer.ts`, `src/state/actionTypes.ts` | Players can observe state but cannot initiate key naval operations consistently from dashboard. | Either add command controls or route operations through a dedicated naval action surface. | Add UI acceptance test for one crew/recruit or repair control path. |
| G7 | not_started | adjacent_follow_up | Worker A | `docs/projects/naval/TRACKER.md` | Baseline scan | Legacy `NavalLogic.ts` overlaps modern voyage/combat helpers; ownership boundaries are still unclear. | `src/systems/naval/NavalLogic.ts`, `src/systems/naval/VoyageManager.ts`, `src/systems/naval/CrewManager.ts` | Duplicate logic increases risk of forked behavior if both paths are invoked in future refactors. | Document the intended owner for legacy functions and retire or isolate unused exports. | Static import map check for calls into `NavalLogic.ts` outside explicit compatibility needs. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
