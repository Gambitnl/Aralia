---
schema_version: 1
project: Logbook
slug: logbook
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-25
iteration: 7
confidence: medium
evidence: docs/projects/logbook
gap_signal: 0 open gaps; G1, G2, G3, G4, G5, and G6 resolved
protocol: living project doc set
next_step: Run a fresh source-backed Logbook gap scan before starting more work.
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
  - scoped_tests: logReducer retention/unread/content cap tests (2026-06-25)
  - scoped_tests: Logbook discovery/dossier pagination tests and rendered proof (2026-06-25)
  - scoped_tests: logReducer discovery dedupe policy tests (2026-06-25)
  - docs_consistency: dossier retention ownership policy recorded (2026-06-25)
last_proof: 2026-06-25
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
Last updated: 2026-06-25

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
Gap signal: 0 open gaps; G1, G2, G3, G4, G5, and G6 resolved
Protocol: living project doc set
Next step: Run a fresh source-backed Logbook gap scan before starting more work.
Required verification: docs_consistency, scoped_tests
Completed verification: docs_consistency, scoped_tests: logReducer retention/unread/content cap tests (2026-06-25), scoped_tests: Logbook discovery/dossier pagination tests and rendered proof (2026-06-25), scoped_tests: logReducer discovery dedupe policy tests (2026-06-25), docs_consistency: dossier retention ownership policy recorded (2026-06-25)
Last proof: 2026-06-25
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
  - Pages long result sets in 25-item chunks.
- `src/components/Logbook/DossierPane.tsx` exists as the NPC dossier modal.
  - NPC list and detail view with status/traits/chronicle.
  - Pages long met-NPC lists in 25-item chunks.
  - Remains a view over `metNpcIds` and `npcMemory`; NPC memory owns fact aging and retention.
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
| Task | Fresh Logbook gap scan |
| Acceptance criteria | Any new Logbook work starts from current source and registers only evidence-backed gaps |
| Allowed boundaries | `src/components/Logbook`, `src/state/reducers`, `src/hooks/actions`, `docs/projects/logbook` |
| Stop condition | New work has a scoped implementation target or confirms no in-scope Logbook gaps remain |
| Verification | Depends on the selected future gap; use focused tests or rendered proof for UI changes |
| Owner | Future thread |
| Next action | Re-scan current Logbook source before starting another slice |

## Scope Boundaries

In scope:
- Project state and continuation docs for Logbook.
- Gap framing and evidence-backed notes.
- Follow-up implementation or planning for G4 dossier retention lifecycle.

Adjacent but not in this slice:
- Fresh source-backed gap discovery for any future Logbook work.

Out of scope:
- New gameplay mechanics not directly tied to Logbook continuity.

## What Must Not Be Lost

- The discovery/dossier dual pane model and existing modal hooks.
- Unread-count workflow and visibility toggles.
- Persistence of `discoveryLog` and `unreadDiscoveryCount`.
- The distinction between discovery-log retention and NPC-memory-driven dossier lifecycle.
- The pattern that other log systems in the same reducer already cap their arrays (`.slice(0, N)`).

## Gaps And Uncertainties

- G1 (done): Retention policy for `discoveryLog` is capped and load-pruned.
- G2 (done): Discovery and dossier lists page long result sets.
- G3 (done): Stable non-location discovery entries now have reducer-level dedupe rules.
- G4 (done): Dossier retention follows the NPC memory lifecycle; the dossier pane does not prune or archive independently.
- G5 (done): Quest updates recount unread discovery entries.
- G6 (done): Quest update content keeps the base entry plus the newest 10 appended notes.

## Evidence And Proof

- Implementation evidence: `src/components/Logbook/*`, `src/state/*`,
  `src/hooks/actions/*`, `src/useGameActions.ts`, `src/services/*`.
- Project registry evidence: `docs/projects/PROJECT_TRACKER.md`.

## Resume Path For A Cold Agent

1. Read `docs/projects/logbook/COLD_START_AGENT_PROMPT.md`.
2. Read `docs/projects/logbook/NORTH_STAR.md` (this file).
3. Read `docs/projects/logbook/TRACKER.md`.
4. Read `docs/projects/logbook/GAPS.md`.
5. Start with a fresh source-backed Logbook gap scan before selecting more work.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps in `GAPS.md` before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
