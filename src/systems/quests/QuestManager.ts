/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/quests/QuestManager.ts
 * Manages quest states, including deadline checks and updates.
 */

import { GameState, GameMessage, Quest, QuestStatus } from '../../types';
import { getGameDay } from '../../utils/timeUtils';

export interface QuestUpdateResult {
  state: GameState;
  logs: GameMessage[];
}

/**
 * Checks all active quests for missed deadlines based on the current game time.
 * @param state Current game state
 * @returns Updated state and any logs generated from missed deadlines
 */
export const checkQuestDeadlines = (state: GameState): QuestUpdateResult => {
  const currentDay = getGameDay(state.gameTime);
  let hasChanges = false;
  const logs: GameMessage[] = [];

  const updatedQuestLog = state.questLog.map((quest) => {
    // Only check active quests that have deadlines
    if (quest.status !== QuestStatus.Active || !quest.deadline) {
      return quest;
    }

    // Check if deadline is passed (deadline is inclusive? Let's say deadline is the day it MUST be done by. So if currentDay > deadline, it's failed.)
    if (currentDay > quest.deadline) {
      hasChanges = true;
      const consequence = quest.deadlineConsequence || { action: 'fail_quest', message: 'Time has run out.' };

      // Generate log
      // Use a simpler ID generation for logs to avoid Math.random() reliance
      logs.push({
        id: Date.now(),
        text: `Quest Update: ${quest.title} - ${consequence.message}`,
        sender: 'system',
        timestamp: state.gameTime
      });

      // Apply consequence
      switch (consequence.action) {
        case 'fail_quest':
          return { ...quest, status: QuestStatus.Failed };
        case 'remove_quest':
          // We'll mark it as null here and filter it out later if we want to remove,
          // but typically we keep history. Let's just fail it but add a tag?
          // Actually, 'remove_quest' implies deleting it.
          // For now, let's map it to Failed but maybe add a note.
          return { ...quest, status: QuestStatus.Failed, description: quest.description + " [REMOVED due to time]" };
        case 'log_only':
          return quest; // Do nothing to status
        default:
          return { ...quest, status: QuestStatus.Failed };
      }
    }

    return quest;
  });

  if (!hasChanges) {
    return { state, logs: [] };
  }

  return {
    state: {
      ...state,
      questLog: updatedQuestLog
    },
    logs
  };
};
