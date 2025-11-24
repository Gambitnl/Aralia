/**
 * @file src/state/reducers/questReducer.ts
 * Reducer for managing quest state.
 */
import { GameState, QuestStatus, Quest } from '../../types';
import { AppAction } from '../actionTypes';

export function questReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'ACCEPT_QUEST': {
      const newQuest = action.payload;
      // Prevent duplicate quests
      if (state.questLog.some(q => q.id === newQuest.id)) {
        return {};
      }
      return {
        questLog: [...state.questLog, newQuest],
        notifications: [...state.notifications, {
             id: crypto.randomUUID(),
             type: 'info',
             message: `Quest Accepted: ${newQuest.title}`,
             duration: 4000
        }]
      };
    }

    case 'UPDATE_QUEST_OBJECTIVE': {
      const { questId, objectiveId, isCompleted } = action.payload;
      
      const questIndex = state.questLog.findIndex(q => q.id === questId);
      if (questIndex === -1) return {};

      const quest = state.questLog[questIndex];
      const objectiveIndex = quest.objectives.findIndex(o => o.id === objectiveId);

      if (objectiveIndex === -1) return {};

      // If no change, return
      if (quest.objectives[objectiveIndex].isCompleted === isCompleted) return {};

      const updatedObjectives = [...quest.objectives];
      updatedObjectives[objectiveIndex] = {
        ...updatedObjectives[objectiveIndex],
        isCompleted
      };

      const updatedQuest = {
        ...quest,
        objectives: updatedObjectives
      };

      const newQuestLog = [...state.questLog];
      newQuestLog[questIndex] = updatedQuest;

      return {
        questLog: newQuestLog,
         notifications: [...state.notifications, {
             id: crypto.randomUUID(),
             type: 'success',
             message: `Quest Updated: ${quest.title}`,
             duration: 3000
        }]
      };
    }

    case 'COMPLETE_QUEST': {
      const { questId } = action.payload;
      const questIndex = state.questLog.findIndex(q => q.id === questId);
      if (questIndex === -1) return {};

      const quest = state.questLog[questIndex];
      if (quest.status === QuestStatus.Completed) return {};

      const updatedQuest = {
        ...quest,
        status: QuestStatus.Completed,
        dateCompleted: Date.now()
      };

      const newQuestLog = [...state.questLog];
      newQuestLog[questIndex] = updatedQuest;
      
      let newState: Partial<GameState> = {
          questLog: newQuestLog,
          notifications: [...state.notifications, {
             id: crypto.randomUUID(),
             type: 'success',
             message: `Quest Completed: ${quest.title}`,
             duration: 5000
        }]
      };

      // Apply rewards
      if (quest.rewards) {
          if (quest.rewards.gold) {
              newState.gold = (state.gold || 0) + quest.rewards.gold;
          }
          if (quest.rewards.xp) {
             // TODO: Add XP to characters
             // For now just notify
          }
          // Items handling would go here, needing item lookup
      }

      return newState;
    }

    default:
      return {};
  }
}
