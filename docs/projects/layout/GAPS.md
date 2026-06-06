# Layout Gaps

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings tied directly to Layout.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Worker B | `docs/projects/layout/TRACKER.md` | registry-to-docs uplift | Define app shell boundaries and interaction handoff | `docs/projects/PROJECT_TRACKER.md` | Historical registry gap that should survive handoff | keep as migration signal until final ownership decision | future tracker update |
| G2 | active | in_scope_now | Worker B | `docs/projects/layout/TRACKER.md` | direct source scan | Clarify whether `ConversationPanel` is a persistent side panel, a shell overlay, or a modal-host sibling | `src/App.tsx`, `src/components/ConversationPanel/ConversationPanel.tsx`, `src/components/layout/GameModals.tsx` | the contract is still implicit, so interaction locks and focus flow can drift between layers | decide the ownership rule and document it explicitly in `NORTH_STAR.md` | add the explicit statement in `NORTH_STAR.md` and verify the next boundary pass against it |
| G3 | active | in_scope_now | Worker B | `docs/projects/layout/TRACKER.md` | direct source scan | Resolve unused `isUIInteractive` in `GameModalsProps` | `src/components/layout/GameModals.tsx` | likely stale contract; either remove or wire to modal behavior | confirm intent and make contract consistent | update props and call site comments |

## Classification Reference

- `in_scope_now`: Required to avoid broken behavior or ambiguous handoff.
- `support_needed_now`: Not required today but must be resolved before broader rollout.
- `adjacent_follow_up`: Useful next-slice item that should be preserved but does not block this docs pass.
- `out_of_scope`: Outside Layout boundaries.
- `blocked_human_decision`: Needs owner choice.
- `blocked_external_state`: Waiting on another team or environment.

## Update Rules

- Keep every entry in evidence-backed form with a concrete next proof/check.
- Move cross-project items to `docs/projects/GLOBAL_GAPS.md` when they are not Layout-owned.
