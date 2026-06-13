# Types Ui Gap Registry

Status: active  
Last updated: 2026-06-12

Use this file for durable unresolved findings that belong to this project.

## Gap log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/types-ui/TRACKER.md` | this scan | No dedicated component-level type registry under `src/components/types` | `src/components/types/index.ts` only contains `export * from '../../types';` | It is unclear whether this thin shim is intentional long-term or should be expanded into a component registry | Decide whether a dedicated component props/type registry is needed | Tracker row `T3` updated with scope and decision |
| G2 | not_started | adjacent_follow_up | Worker B | `docs/projects/types-ui/TRACKER.md` | this scan | Potential drift risk between `src/types/ui.ts` and `src/types/ui.d.ts` | `src/types/ui.ts`, `src/types/ui.d.ts` | Unclear if declaration and source type shapes are expected to stay fully aligned for UI contracts | Verify expected parity model and lock a policy if needed | Add a policy note in this tracker or next implementation slice |

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
