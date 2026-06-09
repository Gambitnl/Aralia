# Providers North Star

Status: review-required
Last updated: 2026-06-08

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
- Spell and glossary failures now degrade visibly instead of blocking startup: the spell provider shows an error overlay and falls back to an empty record, while glossary falls back to an empty list.
- `GameProvider` is a separate global-state context in `src/state/GameContext.tsx`.
- The provider boundary is now explicit in the docs, not just implied by the source tree.
- The dashboard card schema is kept in this file so the project card can stay in sync with the tracked provider state.

## Dashboard Card Schema

Project: Providers
Slug: providers
Category: Feature/UI Projects
Status: review-required
Confidence: medium
Evidence: docs/projects/providers
Gap signal: G2/G3 resolved; G4 waiting; G5 provider modularization review required
Protocol: living project doc set
Next step: Await provider modularization boundary decision before assigning further Providers work.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-08 docs-only review of `App.tsx`, `AppProviders.tsx`, `DataLoaderGate.tsx`, `SpellContext.tsx`, and `GlossaryContext.tsx`
Workflow gaps reviewed: 2026-06-08
Agent comments: G2/G3 provider startup and boundary docs are resolved; G4 is safe only after the review-required G5 decision is recorded.

## Required Review Brief

Title: Provider modularization boundary
Question: Should `App.tsx` provider and phase composition be split now, and if so which owner controls the provider boundary and degraded-startup policy?
Issue: `App.tsx` is a large orchestration surface that includes provider nesting, phase/render composition, and global state boundaries. The current docs now preserve the provider order and degraded-state behavior, but moving provider composition still needs an owner-approved boundary.
Current behavior: `AppProviders` wraps `GameProvider` in `App.tsx`; `DataLoaderGate` blocks only null spell/glossary contexts outside the main menu, while degraded spell/glossary loads remain visible with overlays and empty fallbacks.
Why blocked: A forward modularization agent could move provider composition and accidentally change data loading, game-state context availability, or phase gating without an explicit owner decision.
Option A: Keep provider composition in `App.tsx` for now and limit Providers work to docs/source-doc sync until a broader app-shell split is approved.
Option B: Move provider composition into a dedicated app-shell/provider module with explicit tests preserving provider order, `DataLoaderGate`, and `GameProvider` boundaries.
Option C: Split only source documentation now, then revisit app-shell/provider movement through the code-modularization project.
Evidence: `src/App.tsx`, `src/components/providers/AppProviders.tsx`, `src/components/providers/DataLoaderGate.tsx`, `src/state/GameContext.tsx`, and `docs/projects/code-modularization-audit/GAPS.md` CMA-G4.
Decision owner: human/product owner plus providers/layout owners.
Proof after decision: owner-approved split plan or defer note, plus focused tests or source-doc sync preserving provider order and degraded-startup behavior.

## Active Task

| Field | Value |
|---|---|
| Task | G2/G3 docs slice complete; hand off the next provider docs slice |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` stay aligned on the resolved `G2`/`G3` state, provider order, and current gap signal |
| Allowed boundaries | `docs/projects/providers/` only |
| Stop condition | The provider doc set is refreshed and ready for the `G4` source-doc sync |
| Verification | docs consistency review against the current provider order, startup matrix, and gate behavior |
| Owner | Worker B |
| Next action | Await the G5 provider-boundary decision before assigning further Providers work |

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
- Ownership boundary for `GameProvider` relative to provider wrappers is documented in this file, and the startup matrix now reflects the current non-blocking degraded-state behavior.
- `G4` remains a useful source-doc sync slice, but this project is review-required until the G5 provider-boundary decision is recorded.

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

## Deferred Follow-Ups

| Follow-up | Why it matters | Owner | Needed by |
|---|---|---|---|
| `G4` GlossaryContext README sync | The current README still needs to reflect the live fetch path and empty-list fallback behavior. | Worker B | after review gate clears |
| `G5` app-shell/provider modularization decision | The split stays blocked until a human decision is recorded. | human/product owner + providers/layout owners | decision gate |

## Resume Path For A Cold Agent

1. Read this file.
2. Read docs/projects/providers/TRACKER.md.
3. Read docs/projects/providers/GAPS.md.
4. Check `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md`.
5. Continue only after the provider-boundary decision is recorded; then run the `G4` source-doc sync for `GlossaryContext.README.md` if still needed.



## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- keep the current startup matrix and provider boundary note intact
- do not assign forward Providers work while the project is review-required
- after the decision, tackle the `G4` source-doc sync if still needed
- do not invent gaps just to satisfy a count
