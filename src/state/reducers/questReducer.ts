// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 21/02/2026, 02:40:51
 * Dependents: appState.ts
 * Imports: 4 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/state/reducers/questReducer.ts
 * Reducer for managing quest state.
 *
 * Quest state machine (all transitions are idempotent and safe to re-run):
 *  - Pending/unknown quests become Active when ACCEPT_QUEST is dispatched.
 *  - Active quests move to Completed automatically when every objective is
 *    marked complete, or explicitly via COMPLETE_QUEST.
 *  - Failed status is preserved if external systems ever flag it, and
 *    objective updates will not resurrect a failed quest.
 */
import { GameState, QuestStatus, Quest } from '../../types';
import { AppAction } from '../actionTypes';
import { ITEMS } from '../../constants';
import { generateId } from '../../utils/core/idGenerator';

// TODO(Schemer): Migrate questReducer to use the new `src/types/quests.ts` structure (QuestDefinition, QuestStage, QuestObjectiveType).
// Currently, it relies on the legacy flat `objectives` array from `src/types/world.ts`.

type NotificationTuple = Pick<GameState, 'notifications'>;

/**
 * Deep-clone and normalize a quest payload to avoid mutating the blueprint
 * imported from src/data/quests. This keeps runtime copies isolated.
 */
const hydrateQuestPayload = (quest: Quest): Quest => ({
  ...quest,
  status: quest.status ?? QuestStatus.Active,
  dateStarted: quest.dateStarted ?? Date.now(),
  objectives: quest.objectives.map(obj => ({ ...obj })),
});

const pushNotification = (
  state: GameState,
  message: string,
  type: NotificationTuple['notifications'][number]['type'] = 'info',
  duration = 4000
): NotificationTuple => ({
  notifications: [
    ...state.notifications,
    {
      id: generateId(),
      type,
      message,
      duration,
    },
  ],
});

const applyQuestCompletion = (
  state: GameState,
  questIndex: number,
  quest: Quest
): Partial<GameState> => {
  const completedQuest: Quest = {
    ...quest,
    status: QuestStatus.Completed,
    dateCompleted: quest.dateCompleted ?? Date.now(),
    objectives: quest.objectives.map(obj => ({ ...obj, isCompleted: true })),
  };

  const newQuestLog = [...state.questLog];
  newQuestLog[questIndex] = completedQuest;

  let updatedParty = state.party;
  let updatedInventory = state.inventory;
  let updatedGold = state.gold;

  if (completedQuest.rewards) {
    const { gold, xp, items } = completedQuest.rewards;
    if (gold) {
      updatedGold = (state.gold || 0) + gold;
    }
    if (items?.length) {
      const rewardItems = items
        .map(id => ITEMS[id])
        .filter(Boolean);
      if (rewardItems.length) {
        updatedInventory = [...state.inventory, ...rewardItems];
      }
    }
    if (xp) {
      updatedParty = state.party.map(member => ({ ...member, xp: (member.xp || 0) + xp }));
    }
  }

  return {
    questLog: newQuestLog,
    gold: updatedGold,
    inventory: updatedInventory,
    party: updatedParty,
    ...pushNotification(state, `Quest Completed: ${completedQuest.title}`, 'success', 5000),
  };
};

export function questReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'ACCEPT_QUEST': {
      const incomingQuest = hydrateQuestPayload(action.payload);
      // Prevent duplicate quests by ID
      if (state.questLog.some(q => q.id === incomingQuest.id)) {
        return {};
      }

      return {
        questLog: [...state.questLog, incomingQuest],
        ...pushNotification(state, `Quest Accepted: ${incomingQuest.title}`, 'info'),
      };
    }

    case 'UPDATE_QUEST_OBJECTIVE': {
      const { questId, objectiveId, isCompleted } = action.payload;

      const questIndex = state.questLog.findIndex(q => q.id === questId);
      if (questIndex === -1) return {};

      const quest = state.questLog[questIndex];
      const objectiveIndex = quest.objectives.findIndex(o => o.id === objectiveId);

      if (objectiveIndex === -1) return {};
      if (quest.objectives[objectiveIndex].isCompleted === isCompleted) return {};
      if (quest.status === QuestStatus.Failed) return {};

      const updatedObjectives = [...quest.objectives];
      updatedObjectives[objectiveIndex] = {
        ...updatedObjectives[objectiveIndex],
        isCompleted,
      };

      const updatedQuest = {
        ...quest,
        objectives: updatedObjectives,
      };

      const allObjectivesDone = updatedObjectives.length > 0 && updatedObjectives.every(obj => obj.isCompleted);

      if (allObjectivesDone && quest.status !== QuestStatus.Completed) {
        // Promote to completion and award rewards.
        return applyQuestCompletion(state, questIndex, updatedQuest);
      }

      const newQuestLog = [...state.questLog];
      newQuestLog[questIndex] = updatedQuest;

      return {
        questLog: newQuestLog,
        ...pushNotification(state, `Quest Updated: ${quest.title}`, 'success', 3000),
      };
    }

    case 'COMPLETE_QUEST': {
      const { questId } = action.payload;
      const questIndex = state.questLog.findIndex(q => q.id === questId);
      if (questIndex === -1) return {};

      const quest = state.questLog[questIndex];
      if (quest.status === QuestStatus.Completed) return {};

      return applyQuestCompletion(state, questIndex, quest);
    }

    default:
      return {};
  }
}
