# Providers Tracker

Status: review-required
Last updated: 2026-06-08

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
| T1 | done | Create initial living-project scaffold from registry evidence | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Keep files in `docs/projects/providers/` and confirm all three protocol files exist | `Get-ChildItem docs/projects/providers/NORTH_STAR.md,docs/projects/providers/TRACKER.md,docs/projects/providers/GAPS.md` |
| T2 | done | Document current provider dependency graph and failure-order behavior | Worker B | 2026-05-31 | `src/App.tsx`,`src/components/providers/AppProviders.tsx`,`src/components/providers/DataLoaderGate.tsx`,`src/context/SpellContext.tsx`,`src/context/GlossaryContext.tsx`,`src/contexts/DiceContext.tsx`,`src/state/GameContext.tsx` | Keep docs updated with explicit provider order and gating behavior | `Review dependency map section in docs/projects/NORTH_STAR.md` |
| T3 | done | Close the `G2`/`G3` docs slice and hand off the next provider gap | Worker B | 2026-06-08 | `docs/projects/providers/GAPS.md`,`docs/projects/providers/NORTH_STAR.md`,`src/App.tsx`,`src/components/providers/AppProviders.tsx`,`src/components/providers/DataLoaderGate.tsx`,`src/context/SpellContext.tsx`,`src/context/GlossaryContext.tsx` | `G2` is now documented as non-blocking degraded behavior and `G3` is now the explicit provider boundary note | Next safe slice is `G4` source-doc sync for `GlossaryContext.README.md` |
| T4 | waiting | Sync `GlossaryContext.README.md` to the current provider implementation | Worker B | 2026-06-08 | `src/context/GlossaryContext.tsx`,`src/context/GlossaryContext.README.md` | Wait for the provider-boundary decision, then refresh the README in a separate source-doc sync pass if still needed | Compare README wording against current fetch path and empty-list fallback |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/providers/GAPS.md` | registry-to-scaffold upgrade | Specify provider dependency graph | `docs/projects/PROJECT_TRACKER.md` | Registry already flagged this as unresolved scope and it should be preserved | Move to active planning when implementation begins | evidence added to feature-level planning |
| G2 | done | in_scope_now | Worker B | `docs/projects/providers/GAPS.md` | docs pass | Degraded provider states now resolve as non-blocking startup behavior with visible overlays and empty fallbacks | `src/context/SpellContext.tsx`,`src/context/GlossaryContext.tsx`,`src/components/providers/DataLoaderGate.tsx` | The gate only checks for null today, so warning/error payloads can slip through without a clear startup policy | Keep the startup-state matrix current if provider fallback behavior changes | docs matrix covers null, degraded, and error states |
| G3 | done | in_scope_now | Worker B | `docs/projects/providers/GAPS.md` | docs pass | The `GameProvider` boundary and provider nesting order are now explicit in the project docs | `src/App.tsx`,`src/components/providers/AppProviders.tsx`,`src/state/GameContext.tsx` | Future refactors can break assumptions if the provider stack is only implied by source code | Keep the boundary note aligned with `App.tsx` if the stack changes | cross-check against `App.tsx` render tree |
| G5 | blocked | blocked_human_decision | human/product owner + providers/layout owners | `docs/projects/providers/GAPS.md` | code modularization audit route | App/provider modularization is high risk until provider order and degraded-state policy are explicit. | `src/App.tsx`,`src/components/providers/AppProviders.tsx`,`src/components/providers/DataLoaderGate.tsx`,`src/state/GameContext.tsx` | App shell/provider movement could change data loading and game-state boundaries. | Required Review Brief added in `NORTH_STAR.md`; do not assign forward Providers work until the decision is recorded. | owner-approved split plan or defer note |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/providers/GAPS.md`.
