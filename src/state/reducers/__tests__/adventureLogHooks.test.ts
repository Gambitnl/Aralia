/**
 * Proves the reducer append points feed the runtime adventure log (the Oracle
 * DM substrate). Pure-reducer level: dispatch the event, assert an entry lands.
 */
import { describe, expect, it } from 'vitest';
import { questReducer } from '../questReducer';
import { worldReducer } from '../worldReducer';
import { Quest, QuestStatus } from '../../../types';
import { createMockGameState } from '../../../utils/factories';

describe('adventure log append hooks', () => {
  it('records an "opening" entry when the Main opening quest completes', () => {
    const openingQuest: Quest = {
      id: 'q-open',
      title: 'A Situation in Stren',
      description: 'Defuse the standoff at the market.',
      giverId: 'npc-mira',
      status: QuestStatus.Active,
      questType: 'Main',
      objectives: [{ id: 'o1', description: 'Resolve it', isCompleted: false }],
    };
    const state = createMockGameState({ adventureLog: [], questLog: [openingQuest] });

    const next = questReducer(state, { type: 'COMPLETE_QUEST', payload: { questId: 'q-open' } });

    expect(next.adventureLog).toBeDefined();
    const entry = next.adventureLog![next.adventureLog!.length - 1];
    expect(entry.kind).toBe('opening');
    expect(entry.summary).toBe('Completed the quest "A Situation in Stren".');
    expect(entry.npcIds).toEqual(['npc-mira']);
  });

  it('records a plain "quest" entry for a non-main quest', () => {
    const sideQuest: Quest = {
      id: 'q-side',
      title: 'Rat Cellar',
      description: 'Clear the cellar.',
      status: QuestStatus.Active,
      questType: 'Side',
      objectives: [{ id: 'o1', description: 'Clear it', isCompleted: false }],
    };
    const state = createMockGameState({ adventureLog: [], questLog: [sideQuest] });
    const next = questReducer(state, { type: 'COMPLETE_QUEST', payload: { questId: 'q-side' } });
    const entry = next.adventureLog![next.adventureLog!.length - 1];
    expect(entry.kind).toBe('quest');
  });

  it('records a "met-npc" entry the first time an NPC is met', () => {
    const state = createMockGameState({ adventureLog: [], metNpcIds: [] });
    const next = worldReducer(state, { type: 'ADD_MET_NPC', payload: { npcId: 'npc-xyz' } });
    expect(next.metNpcIds).toContain('npc-xyz');
    const entry = next.adventureLog![next.adventureLog!.length - 1];
    expect(entry.kind).toBe('met-npc');
    expect(entry.npcIds).toEqual(['npc-xyz']);
  });

  it('does not double-log an already-met NPC', () => {
    const state = createMockGameState({ adventureLog: [], metNpcIds: ['npc-xyz'] });
    const next = worldReducer(state, { type: 'ADD_MET_NPC', payload: { npcId: 'npc-xyz' } });
    // No state change → no adventureLog key returned.
    expect(next.adventureLog).toBeUndefined();
  });
});
