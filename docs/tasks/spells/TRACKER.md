# Spells Task Living Tracker

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
| T1 | done | Preserve and update this task-folder living docs as a cold-start continuity layer | Worker D | 2026-05-31 | `docs/tasks/spells/NORTH_STAR.md`; `docs/tasks/spells/GAPS.md`; `docs/projects/PROJECT_TRACKER.md` | Keep this tracker aligned with package and validation state | `SPELL_PHASE_1_TASK_TRACKER.md` and `SPELL_DATA_VALIDATION_PLAN.md` read as evidence |
| T2 | active | Maintain a stable resume map while Package 18 is in progress, and record cross-project handoff state | Worker D | 2026-05-31 | `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`; `docs/tasks/spells/ATLAS_GAPS_REGISTRY.md` | Refresh the package state and lane counts when queue/jules boundary changes | One queue refresh with a stable state proof (session status, PR or plan-approval outcome) |
| T3 | waiting | Await Package 18 execution output for closure transition | Worker D | 2026-05-31 | `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md` | Wait for Package 18 completion proof, then update this tracker and this folder's scope state | `PACKAGE_18_*` task + prompt + Jules session boundary evidence |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G101 | waiting | in_scope_now | Worker D | `docs/tasks/spells` + `docs/tasks/spell-system-overhaul` | this pass | Package 18 remains wait-state and should not be marked done in this task-folder until close proof arrives | `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`; `docs/tasks/spells/PACKAGE_18_REACTION_OPPORTUNITY_CONTINUATION_JULES_TASK.md` | A premature close on this folder can lose branch/Jules progress context for the next agent | Hold `T3` as waiting and refresh on next proof event | Check `SPELL_PHASE_1_TASK_TRACKER.md` and linked package/session evidence |
| G102 | active | support_needed_now | Worker D | `docs/tasks/spells` + `docs/projects/GLOBAL_GAPS.md` | this pass | Atlas row counts are not automatically drift-checked against tracker totals | `docs/tasks/spells/ATLAS_GAPS_REGISTRY.md` | Docs and Atlas can diverge without runtime warning, causing bad resume state | Add and keep one manual reconciliation row per package transition | Manual count check when package state changes |
| G103 | out_of_scope | adjacent_follow_up | Worker D | `docs/tasks/spell-system-overhaul` | this pass | Runtime schema engine questions live in spell-system-overhaul, not this docs folder | `docs/tasks/spell-system-overhaul/NORTH_STAR.md` and `docs/tasks/spell-system-overhaul/TRACKER.md` | Prevent duplicated ownership across living projects | Route new engine-level findings there | Add only if a cross-over issue reaches this folder as a handoff summary |

## Update Rules

- Update this tracker when each package boundary state changes.
- Keep one `active` or one `waiting` queue row for the current task slice.
- Active `waiting` rows must name owner, next proof, and external state dependency.
- Keep durable proof checks in `Next check/proof`, not raw command output only.
