# Action System Refactor North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

Preserve one clean handoff for the action runtime boundary after the modularization work.

## Purpose and Scope

This folder should keep future agents aligned on:

- what the action dispatcher currently does
- how handlers are structured
- where to continue implementation or policy work
- what risks remain unresolved

## Implemented vs Planned

Implemented:

- `useGameActions` now orchestrates action execution in `src/hooks/useGameActions.ts`.
- `buildActionHandlers` in `src/hooks/actions/actionHandlers.ts` is the central action registry.
- Action handlers are split into:
  - `handleMovement.ts`
  - `handleObservation.ts`
  - `handleNpcInteraction.ts`
  - `handleItemInteraction.ts`
  - `handleOracle.ts`
  - `handleGeminiCustom.ts`
  - `handleEncounter.ts`
  - `handleResourceActions.ts`
  - `handleMerchantInteraction.ts`
  - `handleSystemAndUi.ts`
  - `handleWorldEvents.ts`
- Shared action types and metadata exist in `src/types/actions.ts`.
- Shared handler dependency types are in `src/hooks/actions/actionHandlerTypes.ts`.
- `src/App.tsx` passes `processAction` into `GameLayout`, `GameModals`, and `TownCanvas`.

Planned:

- Define and enforce a consistent action loading/error policy using existing metadata.
- Capture current validation and schema checks for registry completeness as tracker tasks.
- Keep command-runtime adjacency notes current and re-verified.

## File Map

- `NORTH_STAR.md`: purpose, scope, state snapshot, dependencies.
- `TRACKER.md`: active queue, ownership, checks.
- `GAPS.md`: unresolved findings that should be preserved for next workers.

## Integrations

- Action bus: `src/hooks/actions/actionHandlers.ts` -> `buildActionHandlers` -> `action.type` dispatch map.
- Orchestrator: `src/hooks/useGameActions.ts` calls the registry and executes per-action handlers.
- Source-level actions: `src/hooks/actions/*`.
- Command runtime neighbors:
  - `docs/projects/command-base-runtime/NORTH_STAR.md`
  - `docs/projects/command-factory-runtime/NORTH_STAR.md`
  - `docs/architecture/domains/commands.md`

## Scope Boundaries

In scope:

- Action dispatch boundary and its immediate handler/runtime evidence.
- Registry-driven handoff and gap tracking.
- Linkage to project/global tracker files.

Out of scope:

- Source code behavior changes in this docs-only pass.
- Broad command-base refactors unless they directly own action bus behavior.

## Resume Path

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Continue from the next active row in `TRACKER.md`.

## Supporting References

- `docs/projects/PROJECT_TRACKER.md`
- `docs/projects/GLOBAL_GAPS.md`
- `src/hooks/useGameActions.ts`
- `src/hooks/actions/actionHandlers.ts`
- `src/hooks/actions/actionHandlerTypes.ts`
- `src/types/actions.ts`
- `src/App.tsx`
- `docs/projects/command-base-runtime/NORTH_STAR.md`
- `docs/projects/command-factory-runtime/NORTH_STAR.md`
- `docs/architecture/domains/commands.md`
