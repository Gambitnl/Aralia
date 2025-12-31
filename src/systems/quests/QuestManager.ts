/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/quests/QuestManager.ts
 * Manages quest states, including deadline checks and updates.
 */
// TODO(lint-intent): 'Quest' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { GameState, GameMessage, Quest as _Quest, QuestStatus } from '../../types';
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

    // Check if the current day has surpassed the deadline (deadline is the last valid day).
    if (currentDay > quest.deadline) {
      hasChanges = true;
      const consequence = quest.deadlineConsequence || { action: 'fail_quest', message: 'Time has run out.' };

      // Generate log
      logs.push({
        id: Date.now() + Math.random(),
        text: `Quest Update: ${quest.title} - ${consequence.message}`,
        sender: 'system',
        timestamp: state.gameTime
      });

      // Apply consequence
      switch (consequence.action) {
        case 'fail_quest':
          return { ...quest, status: QuestStatus.Failed };
        case 'fail_with_note':
          return {
            ...quest,
            status: QuestStatus.Failed,
            notes: (quest.notes ? quest.notes + "\n" : "") + "Failed: Deadline missed."
          };
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
