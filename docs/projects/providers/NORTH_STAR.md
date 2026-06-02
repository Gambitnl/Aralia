# Providers North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

This project keeps the app-wide provider architecture and data-loading guard behavior explicit and handoff-ready.

## Intended Outcome

Document provider scope, current composition, and cross-cutting integration points so future work can continue without guesswork.

## Current State

- Provider entry points are in `src/components/providers`.
- App root mounts providers via `AppProviders` in `src/App.tsx`.
- In runtime order today: `AppProviders -> GameProvider -> App UI tree`.
- `AppProviders` currently composes `GlossaryProvider`, `SpellProvider`, and `DiceProvider`.
- `DataLoaderGate` blocks non-main-menu UI until spell and glossary contexts are non-null.
- `GameProvider` is a separate global-state context in `src/state/GameContext.tsx`.

## Active Task

| Field | Value |
|---|---|
| Task | Publish a providers project cold-start document set with current state and dependency map |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` describe provider composition, file map, runtime integration points, and current gaps |
| Allowed boundaries | `docs/projects/providers/` only |
| Stop condition | Docs are complete and no further source edits are required in this pass |
| Verification | `Get-ChildItem docs/projects/providers/NORTH_STAR.md,docs/projects/providers/TRACKER.md,docs/projects/providers/GAPS.md` |
| Owner | Worker B |
| Next action | Update Tracker and Gaps with the provider dependency graph status and follow-up checks |

## Scope Boundaries

In scope:
- `docs/projects/providers/NORTH_STAR.md`
- `docs/projects/providers/TRACKER.md`
- `docs/projects/providers/GAPS.md`
- Accurate references to: `src/components/providers`, `src/context`, `src/contexts`, `src/state`, and `src/App.tsx`

Adjacent but not in scope:
- Runtime refactors of provider internals (`src/context/*`, `src/contexts/*`, `src/state/*`)
- New provider additions not already referenced in this project

Out of scope:
- Editing behavior outside the providers architecture boundary
- Modifying provider internals in this docs-only pass

## File Map

- `src/components/providers/AppProviders.tsx` -- central provider wrapper used in `App.tsx`
- `src/components/providers/DataLoaderGate.tsx` -- UI gate for non-null spell/glossary state
- `src/context/SpellContext.tsx` -- provides `SpellContext`
- `src/context/GlossaryContext.tsx` -- provides `GlossaryContext`
- `src/contexts/DiceContext.tsx` -- provides `DiceContext` and `useDice`
- `src/state/GameContext.tsx` -- provides global `state`/`dispatch` via `GameProvider`
- `src/App.tsx` -- composition point for `AppProviders`, `GameProvider`, and `DataLoaderGate`
- `src/App.tsx` uses `DataLoaderGate` only outside `GamePhase.MAIN_MENU`

## Implemented State

- `AppProviders` composition is active and mounted at app root.
- `DataLoaderGate` is active for all phases except main menu.
- `Dice` functionality is exposed via `useDice` and used by `DiceOverlay` and `LockpickingModal`.
- `SpellContext` and `GlossaryContext` consumers exist across Character Creator, Combat, and glossary UI.
- Ownership boundary for `GameProvider` relative to provider wrappers is documented in this file, with one behavior question still marked for follow-up.

## Global Gap Imports

Check the global gap tracker before expanding scope:
[docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md)

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| GG-XXX | no | none | No imported global gaps at this time |

## Integrations

- App-level composition: `src/App.tsx` imports and mounts `AppProviders` and `GameProvider`.
- Lifecycle guard: `DataLoaderGate` is bypassed for `MAIN_MENU` and wraps all other phases inside `<Suspense>`.
- Error states:
  - `SpellContext` renders `ErrorOverlay` and sets local issues on fetch failure.
  - `GlossaryContext` renders `ErrorOverlay` and degrades to empty data array.
  - `DataLoaderGate` only waits for non-null values.
- State access:
  - Global app state and dispatch through `GameContext` (`useGameState`).
  - Dice actions through `useDice`.
  - Spell and glossary reads through direct context usage in many UI surfaces.

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Provider wrapper import | Root composition point | `src/App.tsx` |
| Provider order | Runtime provider nesting | `src/components/providers/AppProviders.tsx` |
| Context dependencies | Consumers and shared state | `src/context`, `src/contexts`, `src/state` |
| Existing tracker signal | Project was pre-registered with unresolved dependency-graph gap | `docs/projects/PROJECT_TRACKER.md` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Registry anchor | active |
| [docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md) | Cross-project gap routing | active |
| `docs/projects/providers/TRACKER.md` | Active tasks and queue | active |
| `docs/projects/providers/GAPS.md` | Durable unresolved items | active |

## Artifact Boundary

Keep this project scope in these files and direct code evidence references.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| What is the desired error strategy when one provider fails while the others load successfully? | This affects whether main menu should block or continue | Worker B | dependency-graph follow-up |
| Should `DataLoaderGate` also block on context issue arrays (for example spell load warnings), not only null? | Current gate allows degraded spell payloads | Worker B | implementation follow-up |

## Resume Path For A Cold Agent

1. Read this file.
2. Read docs/projects/providers/TRACKER.md.
3. Read docs/projects/providers/GAPS.md.
4. Check `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md`.
5. Continue from: map provider dependency edges and failure-order implications.



## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
