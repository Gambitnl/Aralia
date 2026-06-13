# Providers Living Tracker

Status: active (G5 decided 2026-06-10; implementation lane open)
Last updated: 2026-06-10

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
| T4 | not_started | Sync `GlossaryContext.README.md` to the current provider implementation | Worker B | 2026-06-10 | `src/context/GlossaryContext.tsx`,`src/context/GlossaryContext.README.md` | Provider-boundary decision recorded 2026-06-10 (D7); refresh the README in a source-doc sync pass | Compare README wording against current fetch path and empty-list fallback |
| T5 | not_started | Implement the approved app-shell/provider split (D7, Option B) | providers/layout owners | 2026-06-10 | `docs/projects/DECISION_BLITZ_2026-06-10.md` D7; `src/App.tsx`,`src/components/providers/AppProviders.tsx`,`src/components/providers/DataLoaderGate.tsx`,`src/state/GameContext.tsx` | Move provider composition into a dedicated app-shell module with preservation tests for provider order, `DataLoaderGate`, and `GameProvider` boundaries | Preservation tests pass; provider order and gate behavior unchanged |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/providers/GAPS.md` | registry-to-scaffold upgrade | Specify provider dependency graph | `docs/projects/PROJECT_TRACKER.md` | Registry already flagged this as unresolved scope and it should be preserved | Move to active planning when implementation begins | evidence added to feature-level planning |
| G5 | active | blocked_human_decision | human/product owner + providers/layout owners | `docs/projects/providers/GAPS.md` | code modularization audit route | App/provider modularization is high risk until provider order and degraded-state policy are explicit. | `src/App.tsx`,`src/components/providers/AppProviders.tsx`,`src/components/providers/DataLoaderGate.tsx`,`src/state/GameContext.tsx` | App shell/provider movement could change data loading and game-state boundaries. | Decided 2026-06-10 (Remy, D7, Option B): split approved with preservation tests; implementation lane open (tracker T5). | split lands with preservation tests for provider order, `DataLoaderGate`, and `GameProvider` boundaries |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/providers/GAPS.md`.
