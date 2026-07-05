import { describe, it, expect } from 'vitest';
import { buildOraclePrompt, describePlayer, activeQuests, knownPeople } from '../oraclePrompt';
import { createMockGameState } from '../../../utils/core/factories';
import { QuestStatus } from '../../../types/quests';
import type { AdventureLogEntry } from '../../../types/state';
import type { Quest } from '../../../types/quests';

function strenState() {
  const openingEntries: AdventureLogEntry[] = [
    { id: 'a1', day: 1, time: '09:00', timestamp: 1, kind: 'opening', summary: 'Completed the quest "A Situation in Stren".', npcIds: ['npc-mira'] },
    { id: 'a2', day: 1, time: '10:30', timestamp: 2, kind: 'met-npc', summary: 'Met Mira the merchant.', npcIds: ['npc-mira'] },
    { id: 'a3', day: 1, time: '12:00', timestamp: 3, kind: 'combat', summary: 'Won a battle, gaining 50 XP.' },
  ];
  const openingQuest: Quest = {
    id: 'q-open',
    title: 'A Situation in Stren',
    description: 'Deal with the mercenaries.',
    status: QuestStatus.Completed,
    objectives: [],
    questType: 'Main',
  };
  const activeQuest: Quest = {
    id: 'q-2',
    title: 'Find the missing caravan',
    description: 'A caravan vanished on the north road.',
    status: QuestStatus.Active,
    objectives: [],
  };
  return createMockGameState({
    startTownName: 'Stren',
    gameTime: new Date(2024, 0, 1, 12, 0, 0),
    adventureLog: openingEntries,
    questLog: [openingQuest, activeQuest],
    metNpcIds: [],
  });
}

describe('buildOraclePrompt', () => {
  it('describes the player from party[0]', () => {
    const base = strenState();
    const state = {
      ...base,
      party: [
        {
          ...(base.party[0] ?? ({} as any)),
          name: 'Thistle',
          race: { id: 'gnome', name: 'Gnome' } as any,
          class: { id: 'wizard', name: 'Wizard' } as any,
          level: 3,
        } as any,
      ],
    };
    const line = describePlayer(state);
    expect(line).toContain('Thistle');
    expect(line).toContain('Gnome');
    expect(line).toContain('Wizard');
  });

  it('degrades to an unknown-traveler line when no party exists', () => {
    const state = createMockGameState({ party: [] });
    expect(describePlayer(state)).toContain('unknown traveler');
  });

  it('lists only active/available quests', () => {
    const state = strenState();
    const quests = activeQuests(state);
    expect(quests).toContain('Find the missing caravan');
    expect(quests).not.toContain('A Situation in Stren'); // completed
  });

  it('embeds the Stren opening events in the story-so-far section', () => {
    const state = strenState();
    const prompt = buildOraclePrompt(state, 'what am I supposed to do?');

    // The DM system framing is present.
    expect(prompt).toContain('You are the Oracle');
    expect(prompt).toContain('Dungeon Master');

    // The current town is named from real state.
    expect(prompt).toContain('Currently in Stren.');

    // The recorded opening events (the "story so far") appear verbatim.
    expect(prompt).toContain('THE STORY SO FAR');
    expect(prompt).toContain('Completed the quest "A Situation in Stren".');
    expect(prompt).toContain('Met Mira the merchant.');
    expect(prompt).toContain('Won a battle, gaining 50 XP.');

    // The active quest is offered as grounded next-step material.
    expect(prompt).toContain('Find the missing caravan');

    // The player's actual question is included.
    expect(prompt).toContain('what am I supposed to do?');

    // Anti-hallucination instruction is present.
    expect(prompt.toLowerCase()).toContain('do not invent');
  });

  it('degrades gracefully with an empty adventure log', () => {
    const state = createMockGameState({ adventureLog: [], questLog: [], metNpcIds: [] });
    const prompt = buildOraclePrompt(state, 'hello?');
    expect(prompt).toContain('No notable events recorded yet');
    expect(prompt).toContain('hello?');
  });

  it('two different queries produce prompts carrying their respective question texts', () => {
    const state = strenState();
    const q1 = 'what am I supposed to do?';
    const q2 = 'who have I met, and what happened with the guards?';
    const p1 = buildOraclePrompt(state, q1);
    const p2 = buildOraclePrompt(state, q2);

    expect(p1).toContain(q1);
    expect(p1).not.toContain(q2);
    expect(p2).toContain(q2);
    expect(p2).not.toContain(q1);
    expect(p1).not.toEqual(p2);
  });

  it('puts the player question prominently before the briefing and instructs answering it first', () => {
    const state = strenState();
    const prompt = buildOraclePrompt(state, 'where is the caravan?');

    // Question header appears before the story-so-far briefing.
    const qIdx = prompt.indexOf("THE PLAYER'S QUESTION");
    const storyIdx = prompt.indexOf('THE STORY SO FAR');
    expect(qIdx).toBeGreaterThan(-1);
    expect(storyIdx).toBeGreaterThan(-1);
    expect(qIdx).toBeLessThan(storyIdx);
    expect(prompt.indexOf('"where is the caravan?"')).toBeLessThan(storyIdx);

    // The system instruction demands answering the question first.
    expect(prompt).toContain("directly answer THE PLAYER'S QUESTION");
  });

  it('knownPeople resolves generated-NPC names by met id', () => {
    const base = createMockGameState({ metNpcIds: ['gen-1'] });
    const state = {
      ...base,
      generatedNpcs: { 'gen-1': { ...(base.generatedNpcs?.['gen-1'] ?? {}), id: 'gen-1', name: 'Old Wexley' } as any },
    };
    expect(knownPeople(state)).toContain('Old Wexley');
  });
});
