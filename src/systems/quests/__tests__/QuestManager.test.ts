/**
 * This file keeps the deadline checker honest.
 *
 * The quest system uses this path when world time advances, so the test needs
 * to prove both the failure result and the journal handoff that should follow
 * a missed deadline.
 */

import { describe, it, expect } from 'vitest';
import { checkQuestDeadlines } from '../QuestManager';
import { Quest, QuestStatus } from '@/types';
import { createInitialJournalState } from '@/types/journal';
import { createMockGameState } from '@/utils/factories';

describe('QuestManager', () => {
  it('should fail quests when deadline is passed', () => {
    const initialState = createMockGameState();

    // Mock game time to day 101
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
      deadline: 100,
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

    const { state, logs } = checkQuestDeadlines(initialState);

    const updatedActive = state.questLog.find(q => q.id === 'q1');
    const updatedSafe = state.questLog.find(q => q.id === 'q2');

    expect(updatedActive?.status).toBe(QuestStatus.Failed);
    expect(updatedSafe?.status).toBe(QuestStatus.Active);
    expect(logs.length).toBe(1);
    expect(logs[0].text).toContain('The recipient died waiting');
  });

  it('should queue a failed quest journal event when a deadline misses with a note', () => {
    // The journal queue should capture the transition so the quest history can
    // be reconciled later without scraping the system log.
    const initialState = createMockGameState({
      journal: createInitialJournalState(),
    });

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
      deadline: 100,
      deadlineConsequence: {
        action: 'fail_with_note',
        message: 'The recipient died waiting.'
      }
    };

    initialState.questLog = [activeQuest];

    const { state, logs } = checkQuestDeadlines(initialState);

    expect(state.questLog[0]?.status).toBe(QuestStatus.Failed);
    expect(state.questLog[0]?.notes).toContain('Failed: Deadline missed.');
    expect(state.questLog[0]?.notes).toContain('The recipient died waiting.');
    expect(state.journal?.pendingEvents).toHaveLength(1);
    expect(state.journal?.pendingEvents[0]).toMatchObject({
      type: 'quest_failed',
      questId: 'q1',
      title: 'Quest Failed: Urgent Delivery',
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].text).toContain('The recipient died waiting');
  });

  it('should keep the quest active when the deadline only logs the miss', () => {
    // This path keeps the current behavior intact: the system log records the
    // miss, but the quest status does not flip to failed.
    const initialState = createMockGameState({
      journal: createInitialJournalState(),
    });

    const gameTime = new Date(Date.UTC(351, 0, 101));
    initialState.gameTime = gameTime;

    const activeQuest: Quest = {
      id: 'q2',
      title: 'Safe Quest',
      description: 'Take your time.',
      giverId: 'npc1',
      status: QuestStatus.Active,
      objectives: [],
      dateStarted: 90,
      deadline: 100,
      deadlineConsequence: {
        action: 'log_only',
        message: 'The deadline was noted but does not fail the quest.'
      }
    };

    initialState.questLog = [activeQuest];

    const { state, logs } = checkQuestDeadlines(initialState);

    expect(state.questLog[0]?.status).toBe(QuestStatus.Active);
    expect(state.journal?.pendingEvents).toHaveLength(0);
    expect(logs).toHaveLength(1);
    expect(logs[0].text).toContain('The deadline was noted but does not fail the quest.');
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
