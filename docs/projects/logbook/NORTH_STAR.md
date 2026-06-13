---
schema_version: 1
project: Logbook
slug: logbook
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-10
iteration: 3
confidence: medium
evidence: docs/projects/logbook
gap_signal: 6 open gaps (G1-G6)
protocol: living project doc set
next_step: Implement G1 retention policy in logReducer and fix G5 unread count drift, then revisit G2 as the follow-up UI task.
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs_consistency
  - scoped_tests
completed_verification:
  - docs_consistency
last_proof: 2026-06-10
workflow_gaps_reviewed: 2026-06-10
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Logbook Project

Status: active
Last updated: 2026-06-05

## Why This Project Exists

Logbook is the discovery and dossier memory surface for the player.
This project doc preserves that current behavior and future options remain
explicit for handoffs.

## Intended Outcome

Keep one cold-start checkpoint for all active Logbook work: what is implemented,
how it integrates, and what must still be decided.

## Dashboard Card Schema

Project: Logbook
Slug: logbook
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: docs/projects/logbook
Gap signal: 6 open gaps (G1-G6)
Protocol: living project doc set
Next step: Implement G1 retention policy in logReducer and fix G5 unread count drift, then revisit G2 as the follow-up UI task.
Required verification: docs_consistency, scoped_tests
Completed verification: docs_consistency
Last proof: 2026-06-10
Workflow gaps reviewed: 2026-06-10

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
- `docs/projects/logbook/COLD_START_AGENT_PROMPT.md`: current handoff packet
  for the next cold-start agent.

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
| Task | Implement discovery log retention policy (G1) and fix unread count drift (G5) |
| Acceptance criteria | `logReducer.ts` has a MAX_DISCOVERY_LOG_ENTRIES cap with correct unread count adjustment on prune; UPDATE_QUEST_IN_DISCOVERY_LOG correctly tracks unread transitions; saveLoadService prunes oversized logs on load |
| Allowed boundaries | `src/state/reducers/logReducer.ts`, `src/services/saveLoadService.ts`, unit tests |
| Stop condition | Retention cap and unread fix pass unit tests; no UI changes required in this slice |
| Verification | Unit tests for cap behavior, unread count accuracy after quest updates, and save/load round-trip |
| Owner | Current thread |
| Next action | Add MAX_DISCOVERY_LOG_ENTRIES, implement slice + unread adjustment in ADD_DISCOVERY_ENTRY, fix UPDATE_QUEST_IN_DISCOVERY_LOG unread logic |

## Scope Boundaries

In scope:
- Project state and continuation docs for Logbook.
- Gap framing and evidence-backed notes.
- Implementation of retention policy (G1) and unread count fix (G5) in `logReducer.ts` and `saveLoadService.ts`.

Adjacent but not in this slice:
- Pagination UI (G2).
- Dedupe policy expansion (G3).
- Dossier retention lifecycle (G4).
- Quest content accumulation cap (G6).

Out of scope:
- New gameplay mechanics not directly tied to Logbook continuity.

## What Must Not Be Lost

- The discovery/dossier dual pane model and existing modal hooks.
- Unread-count workflow and visibility toggles.
- Persistence of `discoveryLog` and `unreadDiscoveryCount`.
- The existing unresolved signal that pagination and retention are not yet defined.
- The pattern that other log systems in the same reducer already cap their arrays (`.slice(0, N)`).

## Gaps And Uncertainties

- G1 (active): Retention policy for `discoveryLog` â€” implementation slice defined.
- G2: No pagination for discovery or dossier lists.
- G3: Dedupe only covers `LOCATION_DISCOVERY`; other entry types can duplicate.
- G4: Dossier data has no defined retention lifecycle.
- G5 (new, bug): `unreadDiscoveryCount` drifts on quest updates â€” marks all matching entries unread but only increments count by 0 or 1.
- G6 (new): Quest update content appends without bound, growing entry strings indefinitely.

## Evidence And Proof

- Implementation evidence: `src/components/Logbook/*`, `src/state/*`,
  `src/hooks/actions/*`, `src/useGameActions.ts`, `src/services/*`.
- Project registry evidence: `docs/projects/PROJECT_TRACKER.md`.

## Resume Path For A Cold Agent

1. Read `docs/projects/logbook/COLD_START_AGENT_PROMPT.md`.
2. Read `docs/projects/logbook/NORTH_STAR.md` (this file).
3. Read `docs/projects/logbook/TRACKER.md`.
4. Read `docs/projects/logbook/GAPS.md`.
5. Continue from T3 in `TRACKER.md`: implement G1 retention policy and G5 unread count fix in `logReducer.ts` and `saveLoadService.ts`.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps in `GAPS.md` before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
