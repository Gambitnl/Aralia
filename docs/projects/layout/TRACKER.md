# Layout Project Living Tracker

Status: active (G3/G4 decided 2026-06-10; implementation lane open)
Last updated: 2026-06-10

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `review-required`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Capture registry evidence for Layout docs | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Keep three protocol files under `docs/projects/layout/` | All three files exist and include scope/evidence |
| T2 | done | Convert Layout docs to source-grounded cold-start snapshot | Worker B | 2026-05-31 | `src/components/layout`, `src/App.tsx`, `src/styles/uiIds.ts`, `src/styles/zIndex.ts` | Replace placeholder scaffold prose with real boundary and integration mapping | `docs/projects/layout/NORTH_STAR.md` and `docs/projects/layout/GAPS.md` now include concrete state |
| T3 | done | Resolve app-shell boundary ambiguity | Codex | 2026-06-08 | `src/App.tsx:1181`, `src/components/ConversationPanel/ConversationPanel.tsx`, `src/components/layout/GameModals.tsx` | `ConversationPanel` documented as a PLAYING-only floating shell sibling rendered by `App.tsx`, not by `GameModals` | `NORTH_STAR.md` ownership decision updated |
| T4 | done | Resolve `GameModals.isUIInteractive` contract | human/product owner | 2026-06-10 | `src/App.tsx:1196`; `src/components/layout/GameModals.tsx:100,138-141`; `docs/projects/DECISION_BLITZ_2026-06-10.md` D7 | Decided 2026-06-10 (Remy, D7): keep `isUIInteractive` as a documented compatibility pass-through; wire-or-retire is a later separate decision | `NORTH_STAR.md` Decision (2026-06-10) subsection records the outcome |
| T5 | not_started | Implement the approved app-shell split (D7) | layout/providers owners | 2026-06-10 | `docs/projects/DECISION_BLITZ_2026-06-10.md` D7; `src/App.tsx`; `src/components/providers/AppProviders.tsx` | Move provider composition out of `App.tsx` into a dedicated app-shell module with preservation tests (provider order, `DataLoaderGate`, `GameProvider` boundaries) | Focused preservation tests pass and shell boundaries unchanged |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Worker B | `docs/projects/layout/GAPS.md` | registry-to-docs uplift | Define application shell boundaries | `docs/projects/PROJECT_TRACKER.md` | Preserves historical follow-up signal and prevents scope drift | keep as in-scope history until ownership decision is finalized | verify in next review |
| G2 | done | in_scope_now | Codex | `docs/projects/layout/GAPS.md` | source scan | Confirm whether `ConversationPanel` belongs to the shell, a modal host, or a persistent side panel | `src/App.tsx:1181`, `src/components/ConversationPanel/ConversationPanel.tsx`, `src/components/layout/GameModals.tsx` | the ownership rule is now explicit: PLAYING-only floating shell sibling rendered by `App.tsx`, not modal-host content | keep this rule unless a future interaction/focus policy intentionally changes it | `NORTH_STAR.md` records the ownership decision |
| G3 | done | blocked_human_decision | human/product owner | `docs/projects/layout/GAPS.md` | source scan | Handle unused `isUIInteractive` prop in `GameModals` | `src/App.tsx:1196`, `src/components/layout/GameModals.tsx:100,138-141` | App already computes the interaction flag, but `GameModals` currently ignores it, so the intended contract remains undecided | decided 2026-06-10 (Remy, D7): keep as documented compatibility pass-through; wire-or-retire later as a separate decision | `NORTH_STAR.md` and `GAPS.md` record the decision (2026-06-10) |

## Update Rules

- Update this tracker before any feature-scoped implementation slice.
- Keep active row status and proof/checks current.
- Keep durable unresolved findings in `docs/projects/layout/GAPS.md`.
