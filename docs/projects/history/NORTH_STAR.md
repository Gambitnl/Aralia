---
schema_version: 1
project: History System
slug: history
category: Feature / Simulation Systems
main_category: "Game & Simulation"
subcategory: "World, Travel & Maps"
status: active
last_updated: 2026-06-17
iteration: 3
confidence: medium
evidence: docs/projects/history/NORTH_STAR.md
gap_signal: "5 open gaps; T3 policy documented; G5/G6 added"
protocol: living project doc set
next_step: Implement retention policy (T5) and continue T4 read-contract validation.
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
last_proof: 2026-06-15
workflow_gaps_reviewed: 2026-06-15
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# History System North Star

Status: active
Last updated: 2026-06-17

## Dashboard Card Schema

Project: History System
Slug: history
Category: Feature / Simulation Systems
Status: active
Confidence: medium
Evidence: docs/projects/history/NORTH_STAR.md
Gap signal: 5 open gaps; T3 policy documented; G5/G6 added
Protocol: living project doc set
Next step: Implement retention policy (T5) and continue T4 read-contract validation.
Required verification: docs_consistency, source_audit
Completed verification: docs_consistency, source_audit
Last proof: 2026-06-17
Workflow gaps reviewed: 2026-06-17

## Purpose
The History System is Aralia's long-term world memory layer. It stores immutable `WorldHistoryEvent` records that survive beyond ephemeral rumor life and is the intended source of canonical event memory for faction wars, political shifts, discoveries, and major battles.

## Status

- Active task: T3 defined retention policy; next work is T5 implementation and T4 read-contract validation.
- Live runtime write path: `WorldEventManager` -> `WorldHistoryService.createSkirmishEvent` -> `addHistoryEvent`.
- Bootstrap write path: `createBootstrapWorldHistory` -> `WorldHistoryService.createFirstBuildHistory` seeds `DISCOVERY`, `POLITICAL_SHIFT`, and `HEROIC_DEED` (and `MAJOR_BATTLE` when factions > 1) during world bootstrap in `src/hooks/useGameInitialization.ts`.
- Factory coverage exists for `FACTION_WAR`, `POLITICAL_SHIFT`, `DISCOVERY`, and `CATASTROPHE`; no gameplay call sites found outside bootstrap/tests.
- `HEROIC_DEED` is emitted during first-build history but has no real-time gameplay producer call site found this scan.
- `MYSTERY_SOLVED` is declared in `WorldHistoryEventType` but still has no producer or factory found here.
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
| `DISCOVERY` | `WorldHistoryService.createFirstBuildHistory` and `HistoryService.createDiscoveryEvent` | Seed/build producer found; factory also exists; no runtime gameplay producer outside bootstrap found |
| `CATASTROPHE` | `HistoryService.createCatastropheEvent` | Factory only; no gameplay producer found |
| `HEROIC_DEED` | `WorldHistoryService.createFirstBuildHistory` emits `HEROIC_DEED`; no gameplay runtime producer call site found this scan | Declared in `WorldHistoryEventType`; bootstrap seed found; real-time producer still missing |
| `MYSTERY_SOLVED` | None found in this scan | Declared in `WorldHistoryEventType`, but no producer/factory found here |

## Implemented State
- State shape includes `worldHistory` and starts as an empty list.
- `ADD_WORLD_HISTORY_EVENT` can append a record through reducer logic with duplicate-id prevention.
- Faction skirmish is actively converted to permanent history in the world event loop.
- History query utilities support filtering by tag, minimum importance, participant, and location.

## Gaps and Uncertainties (Preserved)
- D2 defines a "Bounded Importance-Aware Retention" policy, but it is not yet implemented in `historyUtils.ts`. Unbounded growth risks remain until T5 is complete.
- `WorldHistoryEventType` includes `HEROIC_DEED` and `MYSTERY_SOLVED`, but no runtime gameplay producer call sites were found for these types in the current scan.
- No timeline/replay consumer or UI contract is defined in this slice yet.
- `HistoryService.ts` and `types/history.ts` still contain TODO comments about planned recorder and integration paths.

## Next checks for a cold agent
- Implement the bounded retention/pruning policy (T5) and add acceptance proof in `historyUtils.test.ts`.
- Validate whether world-history records should feed a UI timeline and define the read contract.
- Decide whether the unwired event types stay gaps or move out of scope.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
