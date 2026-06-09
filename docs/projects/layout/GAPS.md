# Layout Gaps

Status: review-required
Last updated: 2026-06-08

Use this file for durable unresolved findings tied directly to Layout.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Worker B | `docs/projects/layout/TRACKER.md` | registry-to-docs uplift | Define app shell boundaries and interaction handoff | `docs/projects/PROJECT_TRACKER.md` | Historical registry gap that should survive handoff | keep as migration signal until final ownership decision | future tracker update |
| G2 | done | in_scope_now | Codex | `docs/projects/layout/TRACKER.md` | direct source scan | Clarify whether `ConversationPanel` is a persistent side panel, a shell overlay, or a modal-host sibling | `src/App.tsx:1181`, `src/components/ConversationPanel/ConversationPanel.tsx`, `src/components/layout/GameModals.tsx` | The contract is now explicit: `ConversationPanel` is a PLAYING-only floating shell sibling rendered directly by `App.tsx`, not modal-host content. | Preserve this ownership unless a future interaction/focus policy intentionally moves it. | `NORTH_STAR.md` ownership decision updated 2026-06-08 |
| G3 | review-required | blocked_human_decision | human/product owner | `docs/projects/layout/TRACKER.md` | direct source scan | Resolve unused `isUIInteractive` in `GameModalsProps` | `src/App.tsx:1196`, `src/components/layout/GameModals.tsx:100,138-141` | App already computes the interaction flag, but `GameModals` ignores it, so the current contract is compatibility-only until the owner decides otherwise. | Choose whether it should lock modal interactions or be retired as stale API. | Required Review Brief recorded in `NORTH_STAR.md`; then either wire the prop or remove the pass-through with focused tests. |
| G4 | blocked | blocked_human_decision | human/product owner + layout/providers owners | `docs/projects/code-modularization-audit` CMA-G4 | Code modularization audit routing | `App.tsx` is a high-risk app-shell modularization candidate tied to layout, providers, phase routing, and modal orchestration. | `src/App.tsx`; `src/components/layout/GameModals.tsx`; `src/components/providers/AppProviders.tsx`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G4 | App-shell splits can change phase rendering, modal order, provider nesting, and interaction locks. | Keep App modularization routing-only until `isUIInteractive`, provider order, and shell boundaries have owner-approved preservation notes. | Owner-approved split plan names phase/render invariants and focused App/layout regression tests. |

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
