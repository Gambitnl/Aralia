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
| T5 | not_started | Implement the approved app-shell split (D7) | layout/providers owners | 2026-06-10 | `docs/projects/DECISION_BLITZ_2026-06-10.md` D7; `src/App.tsx`; `src/components/providers/AppProviders.tsx` | Move provider composition out of `App.tsx` into a dedicated app-shell module with preservation tests (provider order, `DataLoaderGate`, `GameProvider` boundaries) | Focused preservation tests pass and shell boundaries unchanged |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Update Rules

- Update this tracker before any feature-scoped implementation slice.
- Keep active row status and proof/checks current.
- Keep durable unresolved findings in `docs/projects/layout/GAPS.md`.
