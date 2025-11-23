
/**
 * @file src/state/reducers/questReducer.ts
 * A slice reducer that handles Quest-related state changes.
 */
import { GameState, QuestStatus } from '../../types';
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
      };
    }

    case 'UPDATE_QUEST_OBJECTIVE': {
      const { questId, objectiveId, isCompleted } = action.payload;
      
      const updatedQuestLog = state.questLog.map(quest => {
        if (quest.id === questId) {
          const updatedObjectives = quest.objectives.map(obj => 
            obj.id === objectiveId ? { ...obj, isCompleted } : obj
          );
          return { ...quest, objectives: updatedObjectives };
        }
        return quest;
      });

      return { questLog: updatedQuestLog };
    }

    case 'COMPLETE_QUEST': {
      const { questId } = action.payload;

      const updatedQuestLog = state.questLog.map(quest => {
        if (quest.id === questId) {
          return { 
            ...quest, 
            status: QuestStatus.Completed, 
            dateCompleted: Date.now() 
          };
        }
        return quest;
      });
      
      // Logic to add rewards (gold, XP, items) could be handled here or dispatched as separate actions
      // For simplicity, let's handle basic gold reward here if present in the quest
      const completedQuest = state.questLog.find(q => q.id === questId);
      let goldUpdate = {};
      if (completedQuest && completedQuest.rewards?.gold) {
          goldUpdate = { gold: state.gold + completedQuest.rewards.gold };
      }

      return { questLog: updatedQuestLog, ...goldUpdate };
    }

    default:
      return {};
  }
}
