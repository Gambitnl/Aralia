import { describe, it, expect } from 'vitest';
import { checkQuestDeadlines } from '../QuestManager';
import { GameState, Quest, QuestStatus } from '@/types';
import { createMockGameState } from '@/utils/factories';

describe('QuestManager', () => {
  it('should fail quests when deadline is passed', () => {
    const initialState = createMockGameState();
    const currentDay = 100; // Arbitrary day

    // Mock game time to day 101
    // epoch is day 1. So 100 days later.
    const gameTime = new Date(Date.UTC(351, 0, 101));
    initialState.gameTime = gameTime;

    const activeQuest: Quest = {
      id: 'q1',
      title: 'Urgent Delivery',
      description: 'Deliver the potion.',
      giverId: 'npc1',
      status: QuestStatus.Active,
      objectives: [],
      dateStarted: 90,
      deadline: 100, // Deadline matches current day (if inclusive) or is passed?
      // Logic: if currentDay > deadline.
      // If today is 101 and deadline is 100, it is passed.
      deadlineConsequence: {
        action: 'fail_quest',
        message: 'The recipient died waiting.'
      }
    };

    const safeQuest: Quest = {
        id: 'q2',
        title: 'Safe Quest',
        description: 'Take your time.',
        giverId: 'npc1',
        status: QuestStatus.Active,
        objectives: [],
        dateStarted: 90,
        deadline: 105
    };

    initialState.questLog = [activeQuest, safeQuest];

    // Current day calculation:
    // Epoch is usually Day 1.
    // getGameDay(epoch) = 1.
    // If we advance 100 days, it is Day 101.
    // 101 > 100 => Failed.

    const { state, logs } = checkQuestDeadlines(initialState);

    const updatedActive = state.questLog.find(q => q.id === 'q1');
    const updatedSafe = state.questLog.find(q => q.id === 'q2');

    expect(updatedActive?.status).toBe(QuestStatus.Failed);
    expect(updatedSafe?.status).toBe(QuestStatus.Active);
    expect(logs.length).toBe(1);
    expect(logs[0].text).toContain('The recipient died waiting');
  });

  it('should not fail quest on the deadline day exactly', () => {
     const initialState = createMockGameState();
     // Day 100
     const gameTime = new Date(Date.UTC(351, 0, 100));
     initialState.gameTime = gameTime;

     const activeQuest: Quest = {
       id: 'q1',
       title: 'Urgent Delivery',
       description: 'Deliver the potion.',
       giverId: 'npc1',
       status: QuestStatus.Active,
       objectives: [],
       dateStarted: 90,
       deadline: 100,
     };

     initialState.questLog = [activeQuest];

     const { state } = checkQuestDeadlines(initialState);
     const updatedActive = state.questLog.find(q => q.id === 'q1');

     expect(updatedActive?.status).toBe(QuestStatus.Active);
  });
});
