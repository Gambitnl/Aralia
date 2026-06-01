# Compass Pane Gaps

Status: active
Last updated: 2026-05-31

Use this file for durable unresolved findings that belong to Compass Pane.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/compass-pane/TRACKER.md` | Registry-to-implementation mapping | Define navigation affordances for map/submap/3D toggles in each context | `docs/projects/PROJECT_TRACKER.md`; `src/components/CompassPane/index.tsx`; `src/components/CompassPane/README.md` | Current behavior is implemented but intent is only partially documented in code/docs and differs between main layout and submap context | Define accepted rules for each UI state and lock them to tests | Acceptance criteria written and traceable to action/state checks |
| G2 | in_scope_now | in_scope_now | Worker B | `src/components/CompassPane/__tests__/CompassPane.test.tsx` | Test review + runtime logic review | No tests for direction disablement, movement dispatch, or pass-time confirm flow | `src/components/CompassPane/__tests__/CompassPane.test.tsx` | Missing coverage lets disabled-state regressions and action payload mismatches slip in without detection | Add focused tests for `move`, `look_around`, and `wait` action behavior | Unit test run plus failure case with `currentSubMapCoordinates` null and `disabled` true |
| G3 | support_needed_now | support_needed_now | Worker B | `src/hooks/actions/handleMovement.ts` and action router | State-handler scan | Confirm UI pre-check semantics match handler movement semantics on boundaries and map transitions | `src/components/CompassPane/index.tsx`; `src/hooks/actions/handleMovement.ts` | UI currently blocks some cases before handler runs, so edge behavior can be under-tested at handler level | Capture an explicit rule table for edge and impassable transitions | Add regression tests or acceptance comments in `NORTH_STAR.md` and `TRACKER.md` |
| G4 | support_needed_now | support_needed_now | Worker B | Docs scan | Documentation continuity | `src/components/CompassPane/README.md` appears partially stale and omits the wait/pass-time, submap context, and reducer toggle coupling details | `src/components/CompassPane/README.md` and implementation files | Mismatched docs can send future work down the wrong path and weaken cold-start accuracy | Sync README or move ownership note into `NORTH_STAR.md` if README remains intentionally stale | README diff against source behavior for one pass |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | Not in this slice but required for task progress. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is required. |
| `blocked_external_state` | Waiting on another actor, PR, environment, or service. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route cross-project or orphaned gaps to `docs/projects/GLOBAL_GAPS.md` when they do not belong here.
