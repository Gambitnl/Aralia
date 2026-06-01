# Investigation Task Cluster Gaps

Status: active
Last updated: 2026-05-31

No durable project-specific gaps have been closed yet.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker D | `docs/tasks/investigations/TRACKER.md` | T1 | No formal expected-output schema for new inquiry packets. | `docs/projects/PROJECT_TRACKER.md`; `docs/tasks/investigations` | Without a common packet shape, future investigators may produce incompatible records and lose continuity. | Add a short output contract in `NORTH_STAR.md` and apply it when the next inquiry is added. | Confirm next packet includes purpose, evidence, integration points, and next checks. |
| G2 | not_started | adjacent_follow_up | Worker D | `docs/projects/GLOBAL_GAPS.md` | T1 | No explicit packet index for non-dice investigations in this folder. | `docs/tasks/investigations` | As packet count grows, discoverability and handoff quality degrade. | Route this to global routing unless this folder receives sustained packet volume. | If this project gains more than three packets, add an index or packet list file and record in this gap as done. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Import Rules

- Route cross-project or unrelated findings to `docs/projects/GLOBAL_GAPS.md`.
- Keep this file for unresolved findings that are specific to investigation-cluster continuity.
