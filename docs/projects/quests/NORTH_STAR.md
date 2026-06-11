---
schema_version: 1
project: Quests System
slug: quests
category: Feature Systems
main_category: "Game & Simulation"
subcategory: "World, Travel & Maps"
status: active
last_updated: 2026-06-10
confidence: high
evidence: docs/projects/quests
gap_signal: 5 open project gaps (GQ-1 resolved, GQ-7 and GQ-8 added), 1 routed global candidate
protocol: living project doc set
next_step: Implement Phase 1 adapter layer — `adaptQuestDefinitionToQuest` in `src/systems/quests/questAdapter.ts` with a round-trip unit test (QTS-5).
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
last_proof: 2026-06-10
workflow_gaps_reviewed: 2026-06-10
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Quests System North Star

Status: active
Last updated: 2026-06-10

## Purpose And Scope
- Own the quest feature lane for Aralia: runtime progression, state transitions, and UI surfaces.
- Own the integration layer used by movement, item, dialogue, and world time flows.
- Preserve what is currently implemented while executing the phased migration from legacy `Quest` to `QuestDefinition`.

## Dashboard Card Schema

Project: Quests System
Slug: quests
Category: Feature Systems
Status: active
Confidence: high
Evidence: docs/projects/quests
Gap signal: 5 open project gaps (GQ-1 resolved, GQ-7 and GQ-8 added), 1 routed global candidate
Protocol: living project doc set
Next step: Implement Phase 1 adapter layer — `adaptQuestDefinitionToQuest` in `src/systems/quests/questAdapter.ts` with a round-trip unit test (QTS-5).
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-10
Workflow gaps reviewed: 2026-06-10

## Concrete File Map
- Data and templates
  - `src/data/quests/index.ts`
  - `src/types/quests.ts`
  - `src/types/quests.d.ts`
  - `src/types/index.ts`
- Runtime and tests
  - `src/systems/quests/QuestManager.ts`
  - `src/systems/quests/__tests__/QuestManager.test.ts`
  - `src/systems/quests/Quests_Ralph.md`
- State and reducer
  - `src/state/actionTypes.ts`
  - `src/state/actionTypes.d.ts`
  - `src/state/reducers/questReducer.ts`
  - `src/state/appState.ts`
  - `src/state/initialState.ts`
  - `src/state/reducers/logReducer.ts`
- Trigger and routing
  - `src/hooks/actions/actionHandlers.ts`
  - `src/hooks/actions/handleMovement.ts`
  - `src/hooks/actions/handleItemInteraction.ts`
  - `src/hooks/actions/handleNpcInteraction.ts`
- Integration surfaces
  - `src/services/dialogueService.ts`
  - `src/systems/world/WorldEventManager.ts`
- UI surfaces
  - `src/components/QuestLog/`
  - `src/components/layout/GameModals.tsx`
  - `src/components/ActionPane/SystemMenu.tsx`
  - `src/components/CharacterSheet/Journal/QuestLogSidebar.tsx`
  - `src/components/CharacterSheet/Journal/JournalTab.tsx`
- Verification
  - `src/components/QuestLog/__tests__/QuestLog.test.tsx`
  - `src/test/contracts/quests.contract.test.ts`

## Migration Decision (D2 — 2026-06-10)

The migration from legacy `Quest` to `QuestDefinition` will follow a **phased adapter-bridge** approach. See `DECISIONS.md` D2 for the full record.

- **Phase 1 (next)**: Introduce `adaptQuestDefinitionToQuest` adapter — quest authors can write in `QuestDefinition`, adapter flattens to legacy `Quest` for the reducer/UI.
- **Phase 2**: Add stage-aware reducer actions (`ADVANCE_QUEST_STAGE`).
- **Phase 3**: Migrate UI consumers to read stage-aware state.
- **Phase 4**: Retire legacy `Quest` type.

Compatibility boundary: all existing reducer actions, UI reads, and QuestManager deadline checks remain on `Quest` until their respective migration phase.

## Implemented State (Observed)
- `ACCEPT_QUEST`, `UPDATE_QUEST_OBJECTIVE`, and `COMPLETE_QUEST` are implemented in the reducer.
- Duplicate accepts are blocked by quest `id`.
- Objective updates auto-complete quests when all objectives are complete.
- Completed quests award rewards (gold, xp, and items) and add success notifications.
- Failed quests are preserved and do not advance on objective updates.
- `TOGGLE_QUEST_LOG` opens/closes the modal UI path and is wired into the main menu.
- Quest deadlines are checked from world event processing.
- Deadline handling supports consequence variants: `fail_quest`, `fail_with_note`, `log_only`.
- Dialogue topic prerequisites can check quest status from `gameState.questLog`.

## Current State Summary
- The migration decision is now documented (D2). Legacy `Quest` remains the runtime contract; `QuestDefinition` becomes the authoring contract bridged by an adapter.
- Trigger coverage is intentionally narrow and currently hangs off a few hardcoded item and location IDs.
- The modal quest log and the journal/sidebar surfaces both render quest state, but they remain separate integration points that need harmonization (GQ-5).

## Integration Points
- Movement flow
  - `ancient_ruins_entrance` and `ruins_courtyard` currently hardcode `explore_ruins` starts and progress objectives.
- Item flow
  - `old_map_fragment` currently hardcodes `lost_map` accept and objective progress.
- Npc/dialogue flow
  - `handleNpcInteraction.ts` has TODO notes for future quest-giver hooks, so NPC-based quest grants are not yet generalized.
- Log flow
  - `logReducer` supports `UPDATE_QUEST_IN_DISCOVERY_LOG`.
- World time flow
  - `processWorldEvents` invokes `checkQuestDeadlines` at batch end.

## Current Gaps And Uncertainties
- GQ-1 is resolved by D2 (migration decision). The adapter implementation (QTS-5) is the next concrete step.
- Trigger logic is mostly hardcoded by item/location IDs rather than metadata-driven quest hooks (GQ-2).
- No end-to-end evidence yet for stage branching, prerequisite graph checks, or advanced failure-condition states in play (GQ-4).
- UI truth is split across the modal and journal quest surfaces (GQ-5).
- Quest state save/load round-trip has not been verified against the legacy or future schema (GQ-7).
- No adapter-layer test exists yet for the `QuestDefinition` → `Quest` mapping (GQ-8).

## Next Checks
- Implement Phase 1 adapter and unit test (QTS-5).
- Validate if hardcoded quest triggers should be converted to data-driven quest metadata (QTS-4).
- Validate how quest status should sync across QuestLog modal and journal side panels under save/load and UI reopen.
- Validate consequence reporting for `fail_with_note` and `log_only` in UX and logs.

## Resume Path
1) Read this file.
2) Read `docs/projects/quests/TRACKER.md`.
3) Read `docs/projects/quests/GAPS.md`.
4) Read `docs/projects/quests/DECISIONS.md` D2 for the migration plan.
5) Continue with QTS-5: implement the Phase 1 adapter layer.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
