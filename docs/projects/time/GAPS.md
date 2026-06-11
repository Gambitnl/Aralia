# Time Gap Registry

Last updated: 2026-06-05  
Status: active

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Evidence/source | Why it matters | Next action | Next check |
|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Time project | `src/utils/core/timeUtils.ts`, `src/systems/time/Time_Ralph.md` | Long-term world-time semantics are only `Date`-based and implicitly Gregorian, which can misalign future calendar/era rules. | Define a bounded in-world time contract note before new calendar/timing rules are expanded. | Add a short design note and map any new time assumptions to tests. |
| G2 | active | support_needed_now | Time project | `src/state/reducers/worldReducer.ts`, `src/state/reducers/ritualReducer.ts` | Mixed pre/post-advance timestamp usage can make edge-case ordering harder to reason about. | Add explicit invariants and a regression test for boundary transition plus ritual handling. | Extend `src/state/reducers/__tests__/worldReducer.test.ts` and `src/state/reducers/__tests__/ritualReducer.test.ts` (or equivalent) with boundary assertions. |
| G3 | active | adjacent_follow_up | Time project | `src/systems/time/SeasonalSystem.ts`, `src/hooks/actions/handleMovement.ts` | Seasonal modifiers are implemented but not yet a universal simulation contract across all systems. | Decide whether seasonal effects are a hard global contract or a movement-only subsystem. | Add owner-level acceptance criteria before seasonal balance work in other systems. |
| G4 | waiting | support_needed_now | Time project | `src/hooks/actions/handleResourceActions.ts`, `src/state/reducers/worldReducer.ts`, `src/types/state.ts` | Rest state is implemented, but transition details across ticks/rest boundaries are still fragile. | Add targeted tests around short/long rest and day-boundary interaction. | Re-run resource action tests after every time-related code change. |

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
