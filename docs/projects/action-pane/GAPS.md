# Action Pane Gaps

Status: active
Last updated: 2026-06-09

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | in_scope_now | Action Pane owner | docs/projects/action-pane/TRACKER.md | Bounded evidence scan | ActionPane emits several system actions not all validated in integration tests | `src/components/ActionPane/SystemMenu.tsx`, `src/components/ActionPane/index.tsx`, `src/components/ActionPane/__tests__/ActionPane.test.tsx` | Missing validation increases risk of silent non-handled actions during UI sessions | Keep the resolved proof in the focused contract test and only revisit if new action types are added | Passing test list and log output for each covered action path |
| G2 | resolved | in_scope_now | Action Pane owner | docs/projects/action-pane/TRACKER.md | Bounded evidence scan | `isDevDummyActive` was passed into ActionPane but did not affect dispatch behavior | `src/components/ActionPane/index.tsx`, `src/components/ActionPane/SystemMenu.tsx`, `src/components/layout/GameLayout.tsx`, `src/App.tsx`, `src/components/ActionPane/__tests__/ActionPane.test.tsx` | The dead prop could hide intended user flow changes | Keep the prop removed from the ActionPane path unless a new dev-entry requirement is recorded | Contract test and docs audit passed for the removed prop |
| G3 | resolved | in_scope_now | Action Pane owner | docs/projects/action-pane/TRACKER.md | Bounded evidence scan | Numeric and mixed-type `move` targets still required UI-side coercion in ActionButton | `src/components/ActionPane/ActionButton.tsx`, `src/components/ActionPane/useActionGeneration.ts`, `src/types/actions.ts`, `src/components/ActionPane/__tests__/ActionPane.test.tsx` | Runtime coercion could hide upstream type breakage and weakened contract clarity | Keep generator output string-only and leave the button path passive | Focused ActionPane test proves no click-time `String(...)` rewrite remains |
| G4 | not_started | adjacent_follow_up | Action Pane owner | docs/projects/action-pane/TRACKER.md | Bounded evidence scan | Town action ownership between ActionPane and village scene controls is not explicitly decided | `src/components/ActionPane/useActionGeneration.ts`, town scene action handlers (indirect) | Cross-view behavior drift if village action handling is split | Record ownership decision in tracker/protocol before broader refactor | Tracker entry updated with decision rationale |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not in the slice but the slice cannot progress without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is required. |
| `blocked_external_state` | Waiting on another actor, PR, vendor, service, or environment state. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md` instead of keeping them here.
- Keep `classification` aligned with current slice need and avoid using adjacent items to hide implementation blockers.
- Do not mark entries resolved without a final proof file path, test result, or explicit design decision.
