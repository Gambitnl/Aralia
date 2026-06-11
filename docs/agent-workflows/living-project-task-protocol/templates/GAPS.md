# <Project Or Task> Gap Registry

Status: active
Last updated: <YYYY-MM-DD>

Use this file for durable unresolved findings that are too important or too
large to live only in the tracker and that genuinely belong to this project.
Put cross-project, orphaned, or out-of-current-scope gaps in the global gap
tracker instead. Use it for source-backed expansion opportunities too when
they belong to this project but should not widen the current slice yet.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | <owner> | <tracker> | <task> | <gap> | <source> | <why> | <next> | <proof> |

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
- Record real expansion opportunities as gaps or tracker follow-ups when they
  are source-backed and belong to this project.
- Link back to a global gap ID when this project imports one.
- Link back to the source gap ID and source tracker when this project receives
  an inbound routed gap from another project.
- If the current project should not own a gap, add or update the global gap
  tracker instead of keeping the gap here. If routing directly to another
  owner project, add a minimal stub row to that owner's `GAPS.md` in the same
  pass.
- Do not mark a gap done unless completion evidence is linked or summarized.
