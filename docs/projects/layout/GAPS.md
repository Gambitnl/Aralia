# Layout Project Gap Registry

Status: active (G3/G4 decided 2026-06-10; implementation lane open)
Last updated: 2026-06-10

Use this file for durable unresolved findings tied directly to Layout.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Worker B | `docs/projects/layout/TRACKER.md` | registry-to-docs uplift | Define app shell boundaries and interaction handoff | `docs/projects/PROJECT_TRACKER.md` | Historical registry gap that should survive handoff | keep as migration signal until final ownership decision | future tracker update |
| G2 | done | in_scope_now | Codex | `docs/projects/layout/TRACKER.md` | direct source scan | Clarify whether `ConversationPanel` is a persistent side panel, a shell overlay, or a modal-host sibling | `src/App.tsx:1181`, `src/components/ConversationPanel/ConversationPanel.tsx`, `src/components/layout/GameModals.tsx` | The contract is now explicit: `ConversationPanel` is a PLAYING-only floating shell sibling rendered directly by `App.tsx`, not modal-host content. | Preserve this ownership unless a future interaction/focus policy intentionally moves it. | `NORTH_STAR.md` ownership decision updated 2026-06-08 |
| G3 | done | blocked_human_decision | human/product owner | `docs/projects/layout/TRACKER.md` | direct source scan | Resolve unused `isUIInteractive` in `GameModalsProps` | `src/App.tsx:1196`, `src/components/layout/GameModals.tsx:100,138-141` | App already computes the interaction flag, but `GameModals` ignores it, so the current contract is compatibility-only until the owner decides otherwise. | Decided 2026-06-10 (Remy, D7): `isUIInteractive` stays as a documented compatibility pass-through (Option A); wire-or-retire is a later separate decision. See `docs/projects/DECISION_BLITZ_2026-06-10.md`. | `NORTH_STAR.md` ownership decision documents the pass-through contract (recorded 2026-06-10). |
| G4 | active | blocked_human_decision | human/product owner + layout/providers owners | `docs/projects/code-modularization-audit` CMA-G4 | Code modularization audit routing | `App.tsx` is a high-risk app-shell modularization candidate tied to layout, providers, phase routing, and modal orchestration. | `src/App.tsx`; `src/components/layout/GameModals.tsx`; `src/components/providers/AppProviders.tsx`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G4 | App-shell splits can change phase rendering, modal order, provider nesting, and interaction locks. | Decided 2026-06-10 (Remy, D7): app-shell split approved — move provider composition into a dedicated app-shell module with preservation tests (provider order, `DataLoaderGate`, `GameProvider` boundaries). Implementation lane open; see `docs/projects/DECISION_BLITZ_2026-06-10.md`. | Split lands with focused preservation tests proving provider order, `DataLoaderGate`, and `GameProvider` boundaries are unchanged. |
| CMA-G17 | not_started | adjacent_follow_up | layout owner | `docs/projects/code-modularization-audit/GAPS.md` CMA-G17 | Code modularization audit routing | `GameModals.tsx` (~721 lines) is the central modal orchestration file; it crosses many owners and lazy-load boundaries, making regressions easy to hide. | `src/components/layout/GameModals.tsx`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G17 | A split of the modal manager without open/close smoke proof and interaction-lock clarity can break overlays across many surfaces. Blocked on G3 (`isUIInteractive` decision) and G4 (App-shell split contract) — both decided 2026-06-10 (D7), so the precondition is cleared. | Accept or defer the inbound CMA-G17 route; G3/G4 are resolved (2026-06-10, D7), so if accepting, create a narrow modal-manager split plan with open/close coverage. | Owner gap row exists and CMA-G17 status is updated to reflect acceptance or deferral. |

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
