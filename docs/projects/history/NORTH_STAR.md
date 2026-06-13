---
schema_version: 1
project: History System
slug: history
category: Feature / Simulation Systems
main_category: "Game & Simulation"
subcategory: "World, Travel & Maps"
status: active
last_updated: 2026-06-05
iteration: 2
confidence: medium
evidence: docs/projects/history/NORTH_STAR.md
gap_signal: "4 open gaps; T2 still needs a complete producer map"
protocol: living project doc set
next_step: Finish the T2 source map, then decide whether the unwired event types stay gaps or move out of scope.
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
  - source_audit
completed_verification:
  - docs_consistency
  - source_audit
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-05
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# History System North Star

Status: active
Last updated: 2026-06-05

## Dashboard Card Schema

Project: History System
Slug: history
Category: Feature / Simulation Systems
Status: active
Confidence: medium
Evidence: docs/projects/history/NORTH_STAR.md
Gap signal: 4 open gaps; T2 still needs a complete producer map
Protocol: living project doc set
Next step: Finish the T2 source map, then decide whether the unwired event types stay gaps or move out of scope.
Required verification: docs_consistency, source_audit
Completed verification: docs_consistency, source_audit
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Purpose
The History System is Aralia's long-term world memory layer. It stores immutable `WorldHistoryEvent` records that survive beyond ephemeral rumor life and is the intended source of canonical event memory for faction wars, political shifts, discoveries, and major battles.

## Status

- Active task: T2 still needs a complete producer-to-type map.
- Live runtime write path found in this pass: `WorldEventManager` -> `WorldHistoryService.createSkirmishEvent` -> `addHistoryEvent`.
- Factory coverage exists for `FACTION_WAR`, `POLITICAL_SHIFT`, `DISCOVERY`, and `CATASTROPHE`, but no gameplay call sites were found in this scan.
- `HEROIC_DEED` and `MYSTERY_SOLVED` are declared in `WorldHistoryEventType` but have no dedicated producer or factory found here.
- Resume path: keep the source map aligned with `TRACKER.md`, then classify the unwired event types as gaps or out of scope.

## Scope Boundaries

In scope:
- Types and contracts for world-history records.
- Event creation factories for permanent history.
- Utility functions that add, query, and sort historical records.
- State/action integration for write paths and initial world history seed.
- Evidence-backed test coverage of creation + add/filter behavior.

Out of scope for this pass:
- Player discovery log, NPC memory, and rumor lifecycle logic.
- Any UI timeline implementation or direct rendering surface.

## Project File Map

| File | Responsibility | Evidence-backed state |
|---|---|---|
| [src/types/history.ts](/F:/Repos/Aralia/src/types/history.ts) | Event contracts (`WorldHistoryEvent`, `WorldHistory`, enum types) | Implemented with a partial contract and explicit TODOs on missing recorder wiring |
| [src/systems/history/HistoryService.ts](/F:/Repos/Aralia/src/systems/history/HistoryService.ts) | `FACTION_WAR`, `POLITICAL_SHIFT`, `DISCOVERY`, `CATASTROPHE` event factories | Implemented factories; no gameplay producer call sites found in this scan |
| [src/services/WorldHistoryService.ts](/F:/Repos/Aralia/src/services/WorldHistoryService.ts) | Converts skirmish outcomes into `MAJOR_BATTLE` permanent events | Implemented and currently the only live runtime producer found |
| [src/utils/world/historyUtils.ts](/F:/Repos/Aralia/src/utils/world/historyUtils.ts) | `createEmptyHistory`, `addHistoryEvent`, `getRelevantHistory`, `findEventsByParticipant`, `findEventsByLocation` | Implemented; no retention/pruning hook yet |
| [src/utils/historyUtils.ts](/F:/Repos/Aralia/src/utils/historyUtils.ts) | Deprecated bridge export to `src/utils/world/historyUtils.ts` | Implemented as compatibility layer |
| [src/systems/world/WorldEventManager.ts](/F:/Repos/Aralia/src/systems/world/WorldEventManager.ts) | Persistent history write for skirmish resolution | Implemented through `WorldHistoryService.createSkirmishEvent`; no other history emitters found in this pass |
| [src/state/reducers/worldReducer.ts](/F:/Repos/Aralia/src/state/reducers/worldReducer.ts) | Handles `ADD_WORLD_HISTORY_EVENT` and persists updates | Implemented |
| [src/state/actionTypes.ts](/F:/Repos/Aralia/src/state/actionTypes.ts) | `ADD_WORLD_HISTORY_EVENT` action shape | Implemented |
| [src/types/state.ts](/F:/Repos/Aralia/src/types/state.ts) | `worldHistory?: WorldHistory` on `GameState` | Implemented |
| [src/state/initialState.ts](/F:/Repos/Aralia/src/state/initialState.ts) | Initializes `worldHistory: createEmptyHistory()` | Implemented |
| [src/state/appState.ts](/F:/Repos/Aralia/src/state/appState.ts) | Uses history init in flow assembly | Implemented; history touched via imports/flow setup |
| [src/systems/history/__tests__/HistoryService.test.ts](/F:/Repos/Aralia/src/systems/history/__tests__/HistoryService.test.ts) | Factory behavior test coverage | Implemented |
| [src/utils/world/__tests__/historyUtils.test.ts](/F:/Repos/Aralia/src/utils/world/__tests__/historyUtils.test.ts) | Utility behavior and duplicate-ID guard tests | Implemented |
| [src/systems/world/World_Ralph.md](/F:/Repos/Aralia/src/systems/world/World_Ralph.md) | Legacy note confirming skirmish history conversion work | Important historical context |

## Event Source Map

| WorldHistoryEventType | Current source | State |
|---|---|---|
| `MAJOR_BATTLE` | `WorldEventManager.handleFactionSkirmish` -> `WorldHistoryService.createSkirmishEvent` | Live runtime producer |
| `FACTION_WAR` | `HistoryService.createFactionConflictEvent` | Factory only; no gameplay producer found |
| `POLITICAL_SHIFT` | `HistoryService.createPoliticalShiftEvent` | Factory only; no gameplay producer found |
| `DISCOVERY` | `HistoryService.createDiscoveryEvent` | Factory only; no gameplay producer found |
| `CATASTROPHE` | `HistoryService.createCatastropheEvent` | Factory only; no gameplay producer found |
| `HEROIC_DEED` | None found in this scan | Declared in `WorldHistoryEventType`, but no producer/factory found here |
| `MYSTERY_SOLVED` | None found in this scan | Declared in `WorldHistoryEventType`, but no producer/factory found here |

## Implemented State
- State shape includes `worldHistory` and starts as an empty list.
- `ADD_WORLD_HISTORY_EVENT` can append a record through reducer logic with duplicate-id prevention.
- Faction skirmish is actively converted to permanent history in the world event loop.
- History query utilities support filtering by tag, minimum importance, participant, and location.

## Gaps and Uncertainties (Preserved)
- Permanent records are currently append-only; no explicit retention or archive policy exists.
- `WorldHistoryEventType` includes `HEROIC_DEED` and `MYSTERY_SOLVED`, but there are no dedicated emitters for these event types in the current scan.
- No timeline/replay consumer or UI contract is defined in this slice yet.
- `HistoryService.ts` and `types/history.ts` still contain TODO comments about planned recorder and integration paths.

## Next checks for a cold agent
- Confirm every producer of major world events and map each to a concrete history event type.
- Define and document a retention/pruning policy (or explicit no-prune policy) and add it to the same layer.
- Validate whether world-history records should feed a UI timeline and define the read contract.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
