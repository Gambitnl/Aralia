# Quest Log North Star

Status: active
Last updated: 2026-06-05

## Purpose and Scope

This project documents the Quest Log implementation as currently shipped, not a planned placeholder.

What is in scope:
- Quest Log modal UI and rendering.
- Quest log visibility and dispatch wiring.
- Quest accept/update/complete and reward state transitions.
- Existing direct integrations with movement/item triggers and journal surfaces.

What is out of scope:
- Full quest-schema migration from legacy `Quest` to staged/braided quest definitions.
- New quest trigger architecture beyond current code.
- Debt cleanup that is not needed to preserve behavior and handoff context.

## Why This Project Exists

- The source already has Quest Log code spread across UI, actions, reducers, and quest systems.
- This folder captures the project boundary and keeps future work from re-inventing or shrinking the feature.
- It also preserves explicit links to `docs/projects/quests` so domain-wide decisions stay centralized.

## Dashboard Card Schema

Project: Quest Log
Slug: quest-log
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: docs/projects/quest-log/AUDIT_OR_PROOF.md
Gap signal: 5 open gaps; current focus is journal/event coupling and deadline UX
Protocol: living project doc set
Next step: Verify quest/journal transitions and deadline handling in source before code edits.
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Implemented State Snapshot

- Quest Log modal exists and is rendered from `src/components/QuestLog/`:
  - `QuestLog.tsx`: shows active, completed, and failed sections.
  - `QuestCard.tsx`: progress, status badge, rewards, and objective list.
  - `QuestHistoryRow.tsx`: failed/completed history rows.
  - `questUtils.ts`: date formatting helper.
  - `__tests__/QuestLog.test.tsx`: open/close/render assertions.
- Modal is launched via:
  - `src/components/layout/GameModals.tsx`
  - `src/components/ActionPane/SystemMenu.tsx` and `handleSystemAndUi.ts`.
- `ACCEPT_QUEST`, `UPDATE_QUEST_OBJECTIVE`, `COMPLETE_QUEST` actions are handled by `src/state/reducers/questReducer.ts`.
- Visibility is handled by `isQuestLogVisible` in state and `TOGGLE_QUEST_LOG` in `src/state/reducers/uiReducer.ts`.
- Root reducer pipeline includes `questReducer`, `uiReducer`, and `journalReducer` in `src/state/appState.ts`.
- Trigger flow includes:
  - item pickup: `old_map_fragment` in `src/hooks/actions/handleItemInteraction.ts`.
  - movement locations: `ancient_ruins_entrance`, `ruins_courtyard` in `src/hooks/actions/handleMovement.ts`.
- Deadline handling exists in `src/systems/quests/QuestManager.ts` and is checked by `processWorldEvents`.

## File Map (project-relevant)

- UI surface:
  - `src/components/QuestLog/QuestLog.tsx`
  - `src/components/QuestLog/QuestCard.tsx`
  - `src/components/QuestLog/QuestHistoryRow.tsx`
  - `src/components/QuestLog/questUtils.ts`
  - `src/components/QuestLog/__tests__/QuestLog.test.tsx`
  - `src/components/layout/GameModals.tsx`
  - `src/components/ActionPane/SystemMenu.tsx`
  - `src/components/CharacterSheet/Journal/QuestLogSidebar.tsx`
  - `src/components/CharacterSheet/Journal/JournalTab.tsx`
  - `src/components/CharacterSheet/CharacterSheetModal.tsx`
- Action/state flow:
  - `src/hooks/actions/actionHandlers.ts`
  - `src/hooks/actions/handleSystemAndUi.ts`
  - `src/hooks/actions/handleItemInteraction.ts`
  - `src/hooks/actions/handleMovement.ts`
  - `src/state/reducers/questReducer.ts`
  - `src/state/reducers/uiReducer.ts`
  - `src/state/reducers/journalReducer.ts`
  - `src/state/appState.ts`
  - `src/types/actions.ts`
  - `src/types/state.ts`
- Quest data and system:
  - `src/data/quests/index.ts`
  - `src/systems/quests/QuestManager.ts`
  - `src/types/quests.ts`
  - `src/types/journal.ts`

## Integrations and Cross-System Behavior

- Character sheet journal tab reuses `QuestLogSidebar` for quest browsing (`QuestLog`, `JournalTab`).
- World day progression can mark quests failed via `checkQuestDeadlines`.
- Quest reducer rewards update party gold, xp, and inventory and post notifications.
- `SystemMenu` can open the modal alongside other overlay toggles.

## Relationship to `docs/projects/quests`

`docs/projects/quests` remains the owner for broader quest-system intent, design direction, and future schema migration.
`docs/projects/quest-log` is the implementation-owned slice for:
- concrete UI behavior,
- action routes currently in play,
- known implementation gaps in that surface.

## Known Gaps / Uncertainties

- Legacy `Quest` shape is active in runtime; richer staged `QuestDefinition` types are not yet wired through reducer/runtime flow.
- Quest acceptance and objective updates are hardcoded by IDs, not metadata-driven hooks.
- Quest log history and journal event models both exist, but event logging is not fully unified.
- NPC dialogue-based quest starts are incomplete and still marked as TODO in handler code.
- Some TODOs still point at richer typing cleanup and dead imports across touched files.

## Next Checks

- Confirm quest-log behavior after any quest-state schema migration.
- Confirm deadline handling and notifications in long time-advance flows.
- Confirm how journal auto-events should consume quest status transitions for UI consistency.

## Resume Path

1. Read this file.
2. Read `docs/projects/quest-log/TRACKER.md`.
3. Read `docs/projects/quest-log/GAPS.md`.
4. Read `docs/projects/quest-log/AUDIT_OR_PROOF.md` for the last durable proof note.
5. Read `docs/projects/quests/NORTH_STAR.md` for domain context before scope decisions.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
