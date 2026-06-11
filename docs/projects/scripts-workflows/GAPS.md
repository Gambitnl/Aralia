# Scripts: Workflows Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Summary

The open docs gaps are G1 and G2. They are mirrored in `TRACKER.md` as T3/T4 so the next agent has one queue surface instead of hunting across the packet.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker C | [docs/projects/scripts-workflows/TRACKER.md](docs/projects/scripts-workflows/TRACKER.md) | docs refresh | Workflow command examples are distributed across `package.json`, `run` .cmd files, handoff docs, and this project surface, with no single canonical table. | package scripts, `scripts/run-image-regen.cmd`, `scripts/run-portrait-regen.cmd`, `docs/portraits/race_portrait_regen_handoff.md` | Operators can use stale or duplicate launch patterns and hit avoidable runtime confusion. | Create one canonical command matrix entry point in project-owned docs and point legacy docs to it. | `Get-Content` check across project docs and `package.json` |
| G2 | not_started | support_needed_now | Worker C | [docs/projects/scripts-workflows/TRACKER.md](docs/projects/scripts-workflows/TRACKER.md) | docs refresh | Runtime env-var tuning for image generation/research (timeouts, CDP flags, cooldown, strict chat mode) is not normalized into one list. | `scripts/workflows/gemini/image-gen/*.ts`, `scripts/workflows/gemini/core/image-gen-mcp.ts` | Small env mistakes can cause brittle CDP runs and silent fallback behavior. | Add one environment-variable matrix in project doc and include defaults from runbooks. | `Get-Content` check against latest header comments + package scripts |

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
