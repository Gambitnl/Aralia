import { describe, it, expect } from 'vitest';
import { questReducer } from '../questReducer';
import { createMockQuest, createMockGameState } from '@/utils/factories';
import { QuestStatus } from '@/types/index';

describe('questReducer', () => {
  const initialState = createMockGameState();

  it('ACCEPT_QUEST should add a new quest to the log', () => {
    const newQuest = createMockQuest({ id: 'quest-1', title: 'New Adventure' });
    const action: any = {
      type: 'ACCEPT_QUEST',
      payload: newQuest
    };

    const newState = questReducer(initialState, action);

    expect(newState.questLog).toHaveLength(1);
    expect(newState.questLog![0].id).toBe('quest-1');
    expect(newState.questLog![0].status).toBe(QuestStatus.Active);
    expect(newState.notifications).toBeDefined();
    expect(newState.notifications![0].message).toContain('Quest Accepted: New Adventure');
  });

  it('ACCEPT_QUEST should not duplicate existing quests', () => {
    const existingQuest = createMockQuest({ id: 'quest-1' });
    const stateWithQuest = {
      ...initialState,
      questLog: [existingQuest]
    };

    const action: any = {
      type: 'ACCEPT_QUEST',
      payload: createMockQuest({ id: 'quest-1' })
    };

    const newState = questReducer(stateWithQuest, action);

    expect(newState.questLog).toBeUndefined(); // Reducer returns partial state, empty if no change
  });

  it('UPDATE_QUEST_OBJECTIVE should update objective status', () => {
    const quest = createMockQuest({
      id: 'quest-1',
      objectives: [{ id: 'obj-1', description: 'Test', isCompleted: false }]
    });
    const stateWithQuest = { ...initialState, questLog: [quest] };

    const action: any = {
      type: 'UPDATE_QUEST_OBJECTIVE',
      payload: { questId: 'quest-1', objectiveId: 'obj-1', isCompleted: true }
    };

    const newState = questReducer(stateWithQuest, action);

    expect(newState.questLog![0].objectives[0].isCompleted).toBe(true);
  });

  it('UPDATE_QUEST_OBJECTIVE should auto-complete quest if all objectives are done', () => {
    const quest = createMockQuest({
      id: 'quest-1',
      objectives: [{ id: 'obj-1', description: 'Test', isCompleted: false }]
    });
    const stateWithQuest = { ...initialState, questLog: [quest] };

    const action: any = {
      type: 'UPDATE_QUEST_OBJECTIVE',
      payload: { questId: 'quest-1', objectiveId: 'obj-1', isCompleted: true }
    };

    const newState = questReducer(stateWithQuest, action);

    expect(newState.questLog![0].status).toBe(QuestStatus.Completed);
    expect(newState.notifications).toBeDefined();
    expect(newState.notifications!.some(n => n.message.includes('Quest Completed'))).toBe(true);
  });

  it('COMPLETE_QUEST should manually complete a quest', () => {
    const quest = createMockQuest({ id: 'quest-1', status: QuestStatus.Active });
    const stateWithQuest = { ...initialState, questLog: [quest] };

    const action: any = {
      type: 'COMPLETE_QUEST',
      payload: { questId: 'quest-1' }
    };

    const newState = questReducer(stateWithQuest, action);

    expect(newState.questLog![0].status).toBe(QuestStatus.Completed);
  });
});
