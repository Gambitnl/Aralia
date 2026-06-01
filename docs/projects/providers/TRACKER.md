# Providers Tracker

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
| T1 | done | Create initial living-project scaffold from registry evidence | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Keep files in `docs/projects/providers/` and confirm all three protocol files exist | `Get-ChildItem docs/projects/providers/NORTH_STAR.md,docs/projects/providers/TRACKER.md,docs/projects/providers/GAPS.md` |
| T2 | done | Document current provider dependency graph and failure-order behavior | Worker B | 2026-05-31 | `src/App.tsx`,`src/components/providers/AppProviders.tsx`,`src/components/providers/DataLoaderGate.tsx`,`src/context/SpellContext.tsx`,`src/context/GlossaryContext.tsx`,`src/contexts/DiceContext.tsx`,`src/state/GameContext.tsx` | Keep docs updated with explicit provider order and gating behavior | `Review dependency map section in docs/projects/NORTH_STAR.md` |
| T3 | not_started | Carry follow-up gap into implementation planning | Worker B | 2026-05-31 | `docs/projects/providers/GAPS.md` | Review unresolved gaps with feature owner when implementation starts | verify project owner accepts scope |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/providers/GAPS.md` | registry-to-scaffold upgrade | Specify provider dependency graph | `docs/projects/PROJECT_TRACKER.md` | Registry already flagged this as unresolved scope and it should be preserved | Move to active planning when implementation begins | evidence added to feature-level planning |
| G2 | active | in_scope_now | Worker B | `docs/projects/providers/GAPS.md` | docs pass | Decide and document handling when one provider has non-null degraded data and another has errors/warnings | `src/context/SpellContext.tsx`,`src/context/GlossaryContext.tsx`,`src/components/providers/DataLoaderGate.tsx` | Current gate checks only null and can allow warning/error payloads through, affecting startup stability clarity | Draft explicit failure behavior and test expectation in NORTH_STAR/Tracker | verify with a short startup-state matrix in docs |
| G3 | active | in_scope_now | Worker B | `docs/projects/providers/GAPS.md` | docs pass | Keep a documented provider dependency graph that includes `GameProvider` relative order | `src/App.tsx`,`src/components/providers/AppProviders.tsx`,`src/state/GameContext.tsx` | Without this, future refactors risk breaking provider assumptions | Add a dependency section in NORTH_STAR with explicit nesting and ownership | docs review against source |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/providers/GAPS.md`.
