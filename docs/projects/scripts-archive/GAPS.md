# Scripts: Archive Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Gap | Classification | Owner | Evidence | Next action | Next proof | Status |
|---|---|---|---|---|---|---|---|
| SARCH-001 | Retired archive scripts are not represented in active tooling registry metadata, so later reuse intent may still be unclear. | blocked_human_decision | Worker C | `docs/projects/scripts-archive/NORTH_STAR.md` and `docs/projects/scripts-archive/TRACKER.md` still leave the tombstone policy unresolved | Decide whether retired archive scripts need a tombstone bucket or an explicit no-registry policy. | A durable policy note is added in the project docs. | open |
| SARCH-002 | Temporary auth/session inputs for one-time retrieval runs still need a direct project-level cleanup check, even though the temp auth file was absent on the latest pass. | support_needed_now | Worker C | `Test-Path .agent/roadmap-local/spell-validation/dndbeyond-auth.json` returned `False` on 2026-06-05 | Keep the manual cleanup check in the tracker and note any reappearance of the auth artifact immediately. | Re-run the same `Test-Path` check during the next archive pass. | open |

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
