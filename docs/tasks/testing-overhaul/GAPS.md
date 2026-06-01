# Testing Overhaul Gaps

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | to assign | `docs/tasks/testing-overhaul/TRACKER.md` | this docs pass | No explicit owner map for each testing stream (core UI, complex interactions, map/gameplay, hooks/utils). | `docs/projects/PROJECT_TRACKER.md`; `00-MASTER-PLAN.md` | Cannot route testing work safely without owners and escalation path. | Add per-stream owners in `TRACKER.md`. | Active row includes explicit owner and next action. |
| G2 | not_started | in_scope_now | Worker D | `docs/tasks/testing-overhaul/TRACKER.md` | this docs pass | No concrete test matrix covering unit/integration/cross-system checks. | `00-MASTER-PLAN.md`; phase files | Risk of uneven sequencing and unstable progression. | Define matrix in first active execution slice. | Execution row includes matrix criteria and check points. |
| G3 | not_started | adjacent_follow_up | Worker D | `docs/tasks/testing-overhaul/TRACKER.md` | this docs pass | Duplicate phase structures and numbering overlap still exist across docs (`02` and `03` families). | `01-CORE-UI.md`; `02-CHARACTER-CREATOR.md`; `02-COMPLEX-INTERACTIVE.md`; `03-GAMEPLAY-SYSTEMS.md`; `03-CANVAS-MAP.md`; `04-MAP-SYSTEMS.md` | Can create duplicate test implementation planning and false positives/negatives on completion claims. | Add a single execution map in `TRACKER.md` and leave historical notes as archive references. | `NORTH_STAR.md` shows a single file map and a single canonical execution path. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The project cannot honestly complete without it. |
| `support_needed_now` | It is not the core product task, but the project cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, or another person. |

## Update Rules

- Keep every gap tied to evidence, owner, and a concrete next proof/check.
- Keep only project-relevant gaps in this file.
- Route out-of-scope or cross-project findings into `docs/projects/GLOBAL_GAPS.md`.
