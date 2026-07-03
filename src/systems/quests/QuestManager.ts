// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 02:06:39
 * Dependents: systems/world/WorldEventManager.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/quests/QuestManager.ts
 * Manages quest states, including deadline checks and updates.
 */
import { GameState, GameMessage, QuestStatus } from '../../types';
import { getGameDay } from '../../utils/core';
import { appendQuestJournalEvents, createQuestJournalEvent } from './questJournal';

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
  const journalEvents: Array<ReturnType<typeof createQuestJournalEvent>> = [];

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

      // Only failed deadlines create a journal event; log-only deadlines keep
      // their current status and remain a system-message-only breadcrumb.
      if (consequence.action !== 'log_only') {
        journalEvents.push(createQuestJournalEvent(state, {
          type: 'quest_failed',
          quest,
          title: `Quest Failed: ${quest.title}`,
          description: `Missed the deadline for "${quest.title}". ${consequence.message}`,
        }));
      }

      // Apply consequence
      switch (consequence.action) {
        case 'fail_quest':
          return { ...quest, status: QuestStatus.Failed };
        case 'fail_with_note':
          return {
            ...quest,
            status: QuestStatus.Failed,
            // Preserve the legacy note trail, but include the deadline message so
            // the quest log can show why this failure happened without re-reading
            // the system log.
            notes: (quest.notes ? quest.notes + "\n" : "") + `Failed: Deadline missed.\n${consequence.message}`
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
      questLog: updatedQuestLog,
      ...appendQuestJournalEvents(state, journalEvents),
    },
    logs
  };
};
