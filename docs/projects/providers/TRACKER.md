# Providers Tracker

Status: active
Last updated: 2026-06-05

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
| T3 | active | Carry `G2` startup behavior and `G3` provider-order boundary into the next implementation slice | Worker B | 2026-06-05 | `docs/projects/providers/GAPS.md`,`docs/projects/providers/NORTH_STAR.md` | Use `G2` as the first implementation question, keep `G3` paired, and avoid widening to source docs unless the decision requires it | docs review against `App.tsx` render path and provider order |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/providers/GAPS.md` | registry-to-scaffold upgrade | Specify provider dependency graph | `docs/projects/PROJECT_TRACKER.md` | Registry already flagged this as unresolved scope and it should be preserved | Move to active planning when implementation begins | evidence added to feature-level planning |
| G2 | active | in_scope_now | Worker B | `docs/projects/providers/GAPS.md` | docs pass | Decide how degraded provider states should behave when some providers load and others fail | `src/context/SpellContext.tsx`,`src/context/GlossaryContext.tsx`,`src/components/providers/DataLoaderGate.tsx` | The gate only checks for null today, so warning/error payloads can slip through without a clear startup policy | Write the startup-state matrix in `NORTH_STAR.md` before changing runtime behavior | docs matrix covers null, degraded, and error states |
| G3 | active | in_scope_now | Worker B | `docs/projects/providers/GAPS.md` | docs pass | Keep the `GameProvider` boundary and provider nesting order explicit in the project docs | `src/App.tsx`,`src/components/providers/AppProviders.tsx`,`src/state/GameContext.tsx` | Future refactors can break assumptions if the provider stack is only implied by source code | Add an explicit boundary note in `NORTH_STAR.md` and freeze the nesting order | cross-check against `App.tsx` render tree |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/providers/GAPS.md`.
