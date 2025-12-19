
/**
 * @file src/systems/time/DeadlineManager.ts
 * Manages game deadlines, ensuring time-sensitive events are processed correctly.
 */

import { GameState, Deadline, GameMessage, Action } from '../../types';
import { getGameDay, formatGameTime } from '../../utils/timeUtils';

export interface DeadlineCheckResult {
  deadlines: Deadline[]; // Updated list of deadlines
  logs: GameMessage[]; // New messages generated
  actions: Action[]; // Actions to trigger (e.g. quest failure, reputation change)
}

/**
 * Creates a new deadline.
 */
export const createDeadline = (
  title: string,
  description: string,
  dueDate: number,
  consequences: Deadline['consequences'],
  warningThresholds: number[] = [24, 1] // Warn at 24 hours and 1 hour
): Deadline => {
  return {
    id: `deadline_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    title,
    description,
    dueDate,
    consequences,
    warningThresholds,
    warningsTriggered: [],
    isCompleted: false,
    isExpired: false,
  };
};

/**
 * Checks all active deadlines against the current time.
 */
export const checkDeadlines = (
  gameState: GameState,
  newTime: Date
): DeadlineCheckResult => {
  const currentTimestamp = newTime.getTime();
  const logs: GameMessage[] = [];
  const actions: Action[] = [];

  if (!gameState.deadlines) {
      return { deadlines: [], logs: [], actions: [] };
  }

  const updatedDeadlines = gameState.deadlines.map(deadline => {
    // Skip if already handled
    if (deadline.isCompleted || deadline.isExpired) {
      return deadline;
    }

    const timeRemainingMs = deadline.dueDate - currentTimestamp;
    const timeRemainingHours = timeRemainingMs / (1000 * 60 * 60);

    // Check for Warnings
    const newWarningsTriggered = [...deadline.warningsTriggered];
    let warningMessage = '';

    deadline.warningThresholds.forEach(threshold => {
      if (timeRemainingHours <= threshold && !deadline.warningsTriggered.includes(threshold)) {
        newWarningsTriggered.push(threshold);
        warningMessage = `⚠️ Urgent: "${deadline.title}" expires in less than ${threshold} hours.`;
      }
    });

    if (warningMessage) {
       logs.push({
         id: Date.now() + Math.random(),
         text: warningMessage,
         sender: 'system',
         timestamp: newTime
       });
    }

    // Check for Expiration
    if (currentTimestamp >= deadline.dueDate) {
      logs.push({
        id: Date.now() + Math.random(),
        text: `❌ Deadline Missed: ${deadline.title} has expired! ${deadline.description}`,
        sender: 'system',
        timestamp: newTime
      });

      // Trigger Consequences
      deadline.consequences.forEach(consequence => {
        if (consequence.type === 'QUEST_FAILURE' && consequence.payload?.questId) {
          actions.push({
            type: 'UPDATE_QUEST_OBJECTIVE', // Or COMPLETE_QUEST with failed status if supported
            label: 'Fail Quest',
            payload: {
              questId: consequence.payload.questId,
              isCompleted: false, // Implicit failure handling needed in reducer or dedicated action
              // TODO: Add strict QUEST_FAIL action if needed
            }
          });
          // Also explicitly set quest status to failed if possible
           actions.push({
            type: 'custom',
            label: 'Fail Quest Status',
            payload: {
                 type: 'FAIL_QUEST', // Needs to be handled by appReducer or questReducer
                 questId: consequence.payload.questId
            }
          });
        }

        if (consequence.type === 'REPUTATION_PENALTY' && consequence.payload?.factionId) {
             // Dispatch a custom action that the reducer can pick up,
             // or rely on worldEventManager. But reducers are pure.
             // We return actions to be dispatched by the caller or handled in the reducer.
        }

        if (consequence.type === 'LOG_MESSAGE' && consequence.payload?.message) {
            logs.push({
                id: Date.now() + Math.random(),
                text: consequence.payload.message,
                sender: 'system',
                timestamp: newTime
            });
        }
      });

      return {
        ...deadline,
        warningsTriggered: newWarningsTriggered,
        isExpired: true
      };
    }

    return {
      ...deadline,
      warningsTriggered: newWarningsTriggered
    };
  });

  return {
    deadlines: updatedDeadlines,
    logs,
    actions
  };
};
