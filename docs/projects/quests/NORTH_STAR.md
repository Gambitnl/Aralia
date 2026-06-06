# Quests System North Star

Status: active
Last updated: 2026-06-05

## Purpose And Scope
- Own the quest feature lane for Aralia: runtime progression, state transitions, and UI surfaces.
- Own the integration layer used by movement, item, dialogue, and world time flows.
- Preserve what is currently implemented while marking migration gaps from the richer quest schema.

## Dashboard Card Schema

Project: Quests System
Slug: quests
Category: Feature Systems
Status: active
Confidence: medium
Evidence: docs/projects/quests
Gap signal: 5 open project gaps, 1 routed global candidate
Protocol: living project doc set
Next step: Decide the runtime migration path from legacy `Quest` state to the richer `QuestDefinition` schema.
Required verification: docs_consistency
Completed verification: not run
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

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
- The live gameplay contract still centers on the legacy `Quest` reducer shape, while the richer `QuestDefinition` / `QuestStage` types remain the migration target.
- Trigger coverage is intentionally narrow and currently hangs off a few hardcoded item and location IDs.
- The modal quest log and the journal/sidebar surfaces both render quest state, but they remain separate integration points that need a single source-of-truth decision.

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
- Runtime still uses legacy `Quest` shape and flat objectives in active gameplay, while type contracts define richer `QuestDefinition`, `QuestStage`, and typed objective systems.
- Trigger logic is mostly hardcoded by item/location IDs rather than metadata-driven quest hooks.
- No end-to-end evidence yet for stage branching, prerequisite graph checks, or advanced failure-condition states in play.
- Some advanced reward and consequence fields in types are not demonstrably applied in reducer flows.
- No single confirmed owner for source-of-truth beyond `src/types/quests.ts` versus current reducer shape (`Quest`).

## Next Checks
- Validate whether advanced schema should become runtime canonical in a planned migration and sequence of reducers.
- Validate if hardcoded quest triggers should be converted to data-driven quest metadata.
- Validate how quest status should sync across QuestLog modal and journal side panels under save/load and UI reopen.
- Validate consequence reporting for `fail_with_note` and `log_only` in UX and logs.

## Resume Path
1) Read this file.
2) Read `docs/projects/quests/TRACKER.md`.
3) Read `docs/projects/quests/GAPS.md`.
4) Continue with the active tracker task, starting from the legacy-versus-schema migration decision.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
