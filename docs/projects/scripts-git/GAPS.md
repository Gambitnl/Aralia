# Scripts: Git Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Current State

- No new project gaps were discovered in this docs-only pass.
- `G1` remains the first in-scope follow-up.
- `G2` remains a follow-up unless the next slice needs a single policy runbook.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker C | docs/projects/scripts-git/TRACKER.md | This docs refresh | No automated checks validate hook script behavior end-to-end | `scripts/git/pre-push-aralia.sh`, `scripts/git/*.cjs` | Uncovered policy drift is hard to detect without a reproducible check | add a narrow verification checklist or test in scripts or docs next slice | run `npm run sync-check`, `npm run git:hygiene`, and `npm run intent-gate -- --strict` together with a documented sample run |
| G2 | not_started | adjacent_follow_up | Worker C | docs/projects/scripts-git/TRACKER.md | This docs refresh | No local runbook file for Scripts: Git policy execution flow | `scripts/git`, `docs/DEVELOPMENT_GUIDE.md` | Operators use multiple partial docs instead of one command map | decide whether to add `RUNBOOK.md` in this folder or route this to task-level docs | confirm preferred handoff format with caller and add docs if needed |

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
