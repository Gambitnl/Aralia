---
schema_version: 1
project: Logbook
slug: logbook
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-05
confidence: medium
evidence: docs/projects/logbook
gap_signal: 4 open gaps (G1-G4)
protocol: living project doc set
next_step: Start implementation planning from G1 and keep G2 as the follow-up UI question.
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
completed_verification:
  - docs_consistency
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-05
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
Gap signal: 4 open gaps (G1-G4)
Protocol: living project doc set
Next step: Start implementation planning from G1 and keep G2 as the follow-up UI question.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

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

1. Read `docs/projects/logbook/COLD_START_AGENT_PROMPT.md`.
2. Read `docs/projects/logbook/NORTH_STAR.md` (this file).
3. Read `docs/projects/logbook/TRACKER.md`.
4. Read `docs/projects/logbook/GAPS.md`.
5. Continue from gap G1 in `GAPS.md` and confirm retention/pagination before
   implementation planning.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps in `GAPS.md` before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
