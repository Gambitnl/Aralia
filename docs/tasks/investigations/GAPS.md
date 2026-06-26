# Investigation Task Cluster Gaps

Status: active
Last updated: 2026-06-25

One investigation-cluster continuity gap has been closed.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Codex | `docs/tasks/investigations/TRACKER.md` | T1 | No formal expected-output schema for new inquiry packets. | `docs/projects/PROJECT_TRACKER.md`; `docs/tasks/investigations`; `NORTH_STAR.md` Inquiry Packet Output Contract | Without a common packet shape, future investigators may produce incompatible records and lose continuity. | Added the output contract to `NORTH_STAR.md`; apply it when the next inquiry is added. | Next packet should include purpose, evidence scope, findings, routing, next checks, and retirement note. |
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

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/investigations/GAPS.md","sha256WithoutMarker":"9e1cd5c178a64553a74ca8f4e9c37236cc3c5c1b7c101f10095b387cb269ae17","markedAtUtc":"2026-06-25T22:29:38.635Z"} -->
