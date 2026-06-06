# Demo Area North Star

Status: reference-only-due-to-orphaned-component
Last updated: 2026-06-05

Project classification for this cycle: Reference-only, with retention/removal decision pending.

## Purpose And Scope

This project gives a cold-start handoff point for Demo Area decisions and keeps intentional scope visible.
It is not a code-change request. We only document what is currently implemented and unresolved.

## File Map

Core files in this folder:
- `NORTH_STAR.md`: why, scope, and status context
- `TRACKER.md`: active/queued actions
- `GAPS.md`: durable unresolved items

Runtime references checked for this update:
- `src/components/demo/CombatMessagingDemo.tsx`
- `src/components/BattleMap/BattleMapDemo.tsx`
- `src/components/World3D/World3DDemo.tsx`
- `src/components/debug/DevMenu.tsx`
- `src/App.tsx`
- `src/state/appState.ts`
- `src/types/core.ts`
- `docs/projects/PROJECT_TRACKER.md`

## Implemented State

- `CombatMessagingDemo` exists in `src/components/demo` and currently has no import path or route usage in production code.
- Demo/test dev flow is active through `App.tsx` and action/state wiring.
- `battle_map_demo` from `DevMenu` triggers `SETUP_BATTLE_MAP_DEMO` in `App.tsx` and `appState.ts`.
- In `App.tsx`, `GamePhase.BATTLE_MAP_DEMO` renders `components/BattleMap/BattleMapDemo`.
- In `App.tsx`, `GamePhase.WORLD3D_DEMO` renders `components/World3D/World3DDemo`.
- In `App.tsx`, `GamePhase.VILLAGE_VIEW` is used by the `test_village` action and renders `TownCanvas`.

## Integrations

- Dev action surface: `src/components/debug/DevMenu.tsx` (`battle_map_demo`, `test_village`, `test_lockpicking`, `test_temple`, `test_dice_roller`, etc.).
- Dev action handling: `src/App.tsx` switch case for the above actions.
- State transition point: `src/state/appState.ts` case `SETUP_BATTLE_MAP_DEMO`.
- Phase model: `src/types/core.ts` includes `BATTLE_MAP_DEMO`, `WORLD3D_DEMO`, and `VILLAGE_VIEW`.
- Registry anchor: `docs/projects/PROJECT_TRACKER.md` row "Demo Area" still points to `src/components/demo`.

## Gaps And Uncertainties

- Is the `src/components/demo` family intended to be shipped, removed, or migrated into active demo/test namespaces?
- Why does registry evidence path remain `src/components/demo` while active demo flow now renders from `components/BattleMap` and `components/World3D`?
- Does the demo area include `Design Preview` as a scoped sample surface, given the code comment about `/Aralia/misc/design.html`?

## Current State

- T3 is still active: decide whether `src/components/demo/CombatMessagingDemo.tsx` should be retained, moved, or removed.
- The component is still orphaned in runtime terms; no import path or route points to it.
- The registry row in `docs/projects/PROJECT_TRACKER.md` still points at `src/components/demo`, so registry evidence and runtime evidence remain out of sync.
- This pass refreshed the handoff docs only. No runtime files were changed.

## Resume Path

1. Re-read `TRACKER.md` and `GAPS.md`.
2. Decide keep, move, or remove for `src/components/demo/CombatMessagingDemo.tsx`.
3. If keeping, add a mount path so it is no longer orphaned.
4. If removing, record the decision in `GAPS.md` before deletion or re-homing.
5. If registry alignment becomes in-scope, update `docs/projects/PROJECT_TRACKER.md`; otherwise keep the mismatch visible here.

## Dashboard Card Schema

Project: Demo Area
Slug: demo-area
Category: Feature/UI Projects
Status: partial
Confidence: medium
Evidence: `docs/projects/demo-area`
Gap signal: 2 open gaps, 1 blocker
Protocol: living project doc set
Next step: Decide keep, move, or remove for `src/components/demo/CombatMessagingDemo.tsx`.
Required verification: docs_consistency
Completed verification: not run
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05



## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
