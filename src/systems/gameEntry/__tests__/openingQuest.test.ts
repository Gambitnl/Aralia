import { describe, it, expect } from 'vitest';
import { buildOpeningQuest, OPENING_QUEST_ID, OPENING_QUEST_OBJECTIVE_ID } from '../openingQuest';
import { QuestStatus } from '../../../types';
import type { OpeningSituation } from '../types';

const SITUATION: OpeningSituation = {
  setting: { place: 'Kwaiwo, Linshing League', timeOfDay: 'day', weather: 'biting cold' },
  predicament: 'Armed mercenaries have taken over a market stall and are shaking down a merchant.',
  npcs: [
    { id: 'a', name: 'Kael', role: 'mercenary', disposition: 'hostile', goal: 'extort coin' },
    { id: 'b', name: 'Mira', role: 'merchant', disposition: 'frightened', goal: 'be left alone' },
  ],
  openingLine: { speakerId: 'a', text: 'Move along, gnome.' },
};

describe('buildOpeningQuest', () => {
  it('mints an active quest grounded in the predicament', () => {
    const q = buildOpeningQuest(SITUATION, 'Kwaiwo, Linshing League');
    expect(q.id).toBe(OPENING_QUEST_ID);
    expect(q.status).toBe(QuestStatus.Active);
    expect(q.description).toBe(SITUATION.predicament);
    // Title uses just the place, not the region.
    expect(q.title).toBe('A Situation in Kwaiwo');
  });

  it('has a single, uncompleted objective naming those involved', () => {
    const q = buildOpeningQuest(SITUATION);
    expect(q.objectives).toHaveLength(1);
    expect(q.objectives[0].id).toBe(OPENING_QUEST_OBJECTIVE_ID);
    expect(q.objectives[0].isCompleted).toBe(false);
    expect(q.objectives[0].description).toMatch(/Kael and Mira/);
  });

  it('handles a single NPC and a missing place gracefully', () => {
    const q = buildOpeningQuest({
      ...SITUATION,
      npcs: [SITUATION.npcs[0]],
      setting: { ...SITUATION.setting, place: '' },
    }, undefined);
    expect(q.objectives[0].description).toMatch(/Kael/);
    expect(q.title).toMatch(/A Situation in/);
  });
});
