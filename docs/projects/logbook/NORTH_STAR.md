# Logbook Project

Status: active
Last updated: 2026-05-31

## Why This Project Exists

Logbook is the discovery and dossier memory surface for the player.
This project doc preserves that current behavior and future options remain
explicit for handoffs.

## Intended Outcome

Keep one cold-start checkpoint for all active Logbook work: what is implemented,
how it integrates, and what must still be decided.

## Purpose and Scope

- Scope this task as docs-only for `docs/projects/logbook/`.
- Capture current implementation state and the next project-level open questions.
- Preserve registry intent and avoid shrinking existing Logbook design.

## File Map

- `docs/projects/logbook/NORTH_STAR.md`: cold-start summary, scope boundaries,
  resume path.
- `docs/projects/logbook/TRACKER.md`: task queue, active status, and evidence
  checkpoints.
- `docs/projects/logbook/GAPS.md`: durable unresolved Logbook decisions.

## Implemented State

- `src/components/Logbook/DiscoveryLogPane.tsx` exists as the discovery log modal.
  - Supports search and type filtering.
  - Supports sort (newest, oldest, title).
  - Supports read actions (`MARK_DISCOVERY_READ`, `MARK_ALL_DISCOVERIES_READ`).
  - Includes consequence panel and detail rendering.
  - No pagination controls.
- `src/components/Logbook/DossierPane.tsx` exists as the NPC dossier modal.
  - NPC list and detail view with status/traits/chronicle.
  - No pagination controls.
- Visibility wiring:
  - `GameModals.tsx` renders both panes from game-state booleans.
  - `SystemMenu.tsx`, action handlers, and reducers toggle them.
- State model:
  - `discoveryLog`, `unreadDiscoveryCount`, `isDiscoveryLogVisible` exist in
    `GameState`.
  - `discoveryLog` actions: add, mark read, mark all, clear, update quest.
  - Quest updates are separate from clear/read controls.
- Persistence:
  - `saveLoadService` includes both `discoveryLog` and unread count.
- Discovery entry creation paths include movement, item interactions, world
  events, and dialogue topic gates.

## Integrations

- UI toggles: `SystemMenu`, `handleSystemAndUi`.
- Action dispatch: `handleSystemAndUi`, `actionHandlers`.
- Reducers: `uiReducer` and `logReducer`.
- State restore/load: `appState` and `saveLoadService`.
- Gameplay triggers: `handleMovement`, `useGameActions`, `handleItemInteraction`,
  `handleWorldEvents`, `dialogueService`.

## Active Task

| Field | Value |
|---|---|
| Task | Refresh Logbook project docs for implementation continuity |
| Acceptance criteria | Three project docs in `docs/projects/logbook/` describe file map, scope, integration points, current state, and unresolved items |
| Allowed boundaries | `docs/projects/logbook/NORTH_STAR.md`, `docs/projects/logbook/TRACKER.md`, `docs/projects/logbook/GAPS.md` |
| Stop condition | No code edits requested by this pass; only docs are updated |
| Verification | Read all three docs and confirm each references current implementation evidence |
| Owner | Current thread |
| Next action | Carry documented gaps into planning before implementation |

## Scope Boundaries

In scope:
- Project state and continuation docs for Logbook.
- Gap framing and evidence-backed notes.

Adjacent but not in this slice:
- Implementing retention and pagination in code.
- UX or state refactors.

Out of scope:
- Editing outside `docs/projects/logbook/`.
- New gameplay mechanics not directly tied to Logbook continuity.

## What Must Not Be Lost

- The discovery/dossier dual pane model and existing modal hooks.
- Unread-count workflow and visibility toggles.
- Persistence of `discoveryLog` and `unreadDiscoveryCount`.
- The existing unresolved signal that pagination and retention are not yet defined.

## Gaps And Uncertainties

- Retention policy is undefined (max entries, age policy, auto-truncation timing).
- No pagination for potentially long discovery logs or dossier lists.
- Dossier content and discovery log share no explicit global history retention policy.
- Dedupe is currently location-specific (`locationId`) and may allow duplicate
  entries across other discovery sources.
- No visual verification was performed in this docs-only pass.

## Evidence And Proof

- Implementation evidence: `src/components/Logbook/*`, `src/state/*`,
  `src/hooks/actions/*`, `src/useGameActions.ts`, `src/services/*`.
- Project registry evidence: `docs/projects/PROJECT_TRACKER.md`.

## Resume Path For A Cold Agent

1. Read `docs/projects/logbook/NORTH_STAR.md` (this file).
2. Read `docs/projects/logbook/TRACKER.md`.
3. Read `docs/projects/logbook/GAPS.md`.
4. Continue from gap G1 in `GAPS.md` and confirm retention/pagination before
   implementation planning.
