# Layout Tracker

Status: active
Last updated: 2026-05-31

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Capture registry evidence for Layout docs | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Keep three protocol files under `docs/projects/layout/` | All three files exist and include scope/evidence |
| T2 | done | Convert Layout docs to source-grounded cold-start snapshot | Worker B | 2026-05-31 | `src/components/layout`, `src/App.tsx`, `src/styles/uiIds.ts`, `src/styles/zIndex.ts` | Replace placeholder scaffold prose with real boundary and integration mapping | `docs/projects/layout/NORTH_STAR.md` and `docs/projects/layout/GAPS.md` now include concrete state |
| T3 | active | Resolve app-shell boundary ambiguity | Worker B | 2026-05-31 | `src/App.tsx`, `src/components/layout/GameModals.tsx`, `src/components/ConversationPanel/ConversationPanel.tsx` | Confirm where overlays belong: layout shell, modal host, or persistent side panels | Finalize boundary decision and update `NORTH_STAR.md` |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Worker B | `docs/projects/layout/GAPS.md` | registry-to-docs uplift | Define application shell boundaries | `docs/projects/PROJECT_TRACKER.md` | Preserves historical follow-up signal and prevents scope drift | keep as in-scope history until ownership decision is finalized | verify in next review |
| G2 | active | in_scope_now | Worker B | `docs/projects/layout/GAPS.md` | source scan | Confirm ownership of `ConversationPanel` relative to layout shell and modal host | `src/App.tsx`, `src/components/ConversationPanel/ConversationPanel.tsx`, `src/components/layout/GameModals.tsx` | overlay placement currently straddles shell boundary and can create interaction ambiguity | decide boundary rule and lock test ids around it | update handoff docs and acceptance checks |
| G3 | active | in_scope_now | Worker B | `docs/projects/layout/GAPS.md` | source scan | Handle unused `isUIInteractive` prop in `GameModals` | `src/components/layout/GameModals.tsx` | Suggests either stale API or missing interaction lock wiring | align prop usage or remove from contract | update modal prop contract and call sites |

## Update Rules

- Update this tracker before any feature-scoped implementation slice.
- Keep active row status and proof/checks current.
- Keep durable unresolved findings in `docs/projects/layout/GAPS.md`.
