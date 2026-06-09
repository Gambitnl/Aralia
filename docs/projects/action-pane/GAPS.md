# Action Pane Gaps

Status: active
Last updated: 2026-06-08

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | in_scope_now | Action Pane owner | docs/projects/action-pane/TRACKER.md | Bounded evidence scan | ActionPane emits several system actions not all validated in integration tests | `src/components/ActionPane/SystemMenu.tsx`, `src/components/ActionPane/index.tsx`, `src/components/ActionPane/__tests__/ActionPane.test.tsx` | Missing validation increases risk of silent non-handled actions during UI sessions | Keep the resolved proof in the focused contract test and only revisit if new action types are added | Passing test list and log output for each covered action path |
| G2 | active | in_scope_now | Action Pane owner | docs/projects/action-pane/TRACKER.md | Bounded evidence scan | `isDevDummyActive` is passed into ActionPane but not used for dispatch behavior | `src/components/ActionPane/index.tsx` | Leaves an unclear contract for developer-mode entry behavior | Decide and document final behavior; remove dead prop if no longer required | Update docs + code references and rerun tests |
| G3 | active | support_needed_now | Action Pane owner | docs/projects/action-pane/TRACKER.md | Bounded evidence scan | Numeric and mixed-type `move` targets still require UI-side coercion in ActionButton | `src/components/ActionPane/ActionButton.tsx`, `src/components/ActionPane/useActionGeneration.ts`, `src/types/actions.ts` | Runtime coercion can hide upstream type breakage and weakens contract clarity | Tighten generation/handlers to ensure `Action['move'].targetId` is string from the source | Test: no `String(...)` coercion path triggered in ActionButton |
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
