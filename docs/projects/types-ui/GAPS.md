# types UI Gaps

Status: active  
Last updated: 2026-05-31

Use this file for durable unresolved findings that belong to this project.

## Gap log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/types-ui/TRACKER.md` | this scan | No dedicated component-level type registry under `src/components/types` | `src/components/types/index.ts` only contains `export * from '../../types';` | It is unclear whether this thin shim is intentional long-term or should be expanded into a component registry | Decide whether a dedicated component props/type registry is needed | Tracker row `T3` updated with scope and decision |
| G2 | not_started | adjacent_follow_up | Worker B | `docs/projects/types-ui/TRACKER.md` | this scan | Potential drift risk between `src/types/ui.ts` and `src/types/ui.d.ts` | `src/types/ui.ts`, `src/types/ui.d.ts` | Unclear if declaration and source type shapes are expected to stay fully aligned for UI contracts | Verify expected parity model and lock a policy if needed | Add a policy note in this tracker or next implementation slice |

## Classification reference

- `in_scope_now`: required for current task completion.
- `support_needed_now`: required for task progress even if not directly in this slice.
- `adjacent_follow_up`: useful and related, but not required right now.
- `out_of_scope`: explicit exclusion.
- `blocked_human_decision`: owner decision required.
- `blocked_external_state`: waits on external actor or system.
