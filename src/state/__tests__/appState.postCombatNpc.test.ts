import { describe, expect, it } from 'vitest';
import { appReducer } from '../appState';
import { GamePhase } from '../../types';
import { createMockGameState } from '../../utils/core/factories';
import type { GameEntryState } from '../../systems/gameEntry/types';
import type { OpeningSituation } from '../../systems/gameEntry/types';
import type { RichNPC } from '../../types/world';

/**
 * Post-combat NPC state: a battle that grew out of a HOSTILE opening situation
 * ends with those strangers beaten. END_BATTLE must (1) record their ids in
 * defeatedNpcIds so the talk path can gate them, (2) clear the lingering opening
 * conversation, and (3) retire the entry state machine so the standoff cannot
 * re-arm. A peaceful/absent opening (or a battle unrelated to the opening) must
 * NOT touch defeatedNpcIds.
 */

const HOSTILE_SITUATION: OpeningSituation = {
  setting: { place: 'the market', timeOfDay: 'dawn', weather: 'clear' },
  predicament: 'Two guards block your path.',
  npcs: [
    { id: 'situation-npc-guard', name: 'Corwin Dain', role: 'city guard', disposition: 'hostile', goal: 'seize the goods' },
    { id: 'situation-npc-bystander', name: 'Mira', role: 'onlooker', disposition: 'afraid', goal: 'flee' },
  ],
  openingLine: { speakerId: 'situation-npc-guard', text: 'Step away from the goods and come with us.' },
  threat: {
    hostile: true,
    enemies: [{ name: 'Guard', quantity: 2, cr: '1/8' }],
    deEscalationDC: 12,
    tension: 'accusation of theft',
  },
};

function inSituationEntry(situation: OpeningSituation): GameEntryState {
  return {
    status: 'in-situation',
    situation,
    error: null,
    sceneImage: { status: 'idle', url: null, error: null },
  };
}

function hostileOpeningState() {
  const guard = { id: 'situation-npc-guard', name: 'Corwin Dain' } as unknown as RichNPC;
  const bystander = { id: 'situation-npc-bystander', name: 'Mira' } as unknown as RichNPC;
  return createMockGameState({
    phase: GamePhase.COMBAT,
    gameEntry: inSituationEntry(HOSTILE_SITUATION),
    generatedNpcs: { 'situation-npc-guard': guard, 'situation-npc-bystander': bystander },
    activeConversation: {
      companionIds: ['situation-npc-guard'],
      messages: [
        { id: 'm1', speakerId: 'situation-npc-guard', text: 'Step away from the goods and come with us.', timestamp: 1 },
      ],
    } as never,
  });
}

describe('END_BATTLE post-combat NPC state', () => {
  it('defaults defeatedNpcIds to an empty array on a fresh state', () => {
    expect(createMockGameState().defeatedNpcIds).toEqual([]);
  });

  it('marks the hostile-opening strangers defeated when the battle ends', () => {
    const next = appReducer(hostileOpeningState(), { type: 'END_BATTLE', payload: { rewards: { gold: 5, items: [], xp: 50 } } });
    expect(next.defeatedNpcIds).toEqual(
      expect.arrayContaining(['situation-npc-guard', 'situation-npc-bystander']),
    );
  });

  it('clears the lingering opening conversation and retires the entry machine', () => {
    const next = appReducer(hostileOpeningState(), { type: 'END_BATTLE' });
    expect(next.activeConversation).toBeNull();
    expect(next.gameEntry?.status).toBe('idle');
    expect(next.gameEntry?.situation).toBeNull();
  });

  it('marks defeated even on a rewardless battle end', () => {
    const next = appReducer(hostileOpeningState(), { type: 'END_BATTLE' });
    expect(next.defeatedNpcIds).toContain('situation-npc-guard');
  });

  it('does NOT mark anyone defeated when the opening was peaceful (no threat)', () => {
    const peaceful: OpeningSituation = { ...HOSTILE_SITUATION, threat: undefined };
    const state = createMockGameState({
      phase: GamePhase.COMBAT,
      gameEntry: inSituationEntry(peaceful),
    });
    const next = appReducer(state, { type: 'END_BATTLE', payload: { rewards: { gold: 0, items: [], xp: 10 } } });
    expect(next.defeatedNpcIds).toEqual([]);
    // A peaceful entry is left alone for its own flow to resolve.
    expect(next.gameEntry?.situation).not.toBeNull();
  });

  it('does NOT touch defeatedNpcIds for a battle with no active opening situation', () => {
    const state = createMockGameState({ phase: GamePhase.COMBAT });
    const next = appReducer(state, { type: 'END_BATTLE', payload: { rewards: { gold: 3, items: [], xp: 20 } } });
    expect(next.defeatedNpcIds).toEqual([]);
  });

  it('preserves already-defeated ids (idempotent, no duplicates)', () => {
    const base = hostileOpeningState();
    base.defeatedNpcIds = ['situation-npc-guard'];
    const next = appReducer(base, { type: 'END_BATTLE' });
    const guardCount = next.defeatedNpcIds.filter((id) => id === 'situation-npc-guard').length;
    expect(guardCount).toBe(1);
    expect(next.defeatedNpcIds).toContain('situation-npc-bystander');
  });

  it('clears the stale pre-fight line so it cannot replay in the next dialogue', () => {
    const base = hostileOpeningState();
    base.lastNpcResponse = 'Step away from the goods and come with us.';
    base.lastInteractedNpcId = 'situation-npc-guard';
    const next = appReducer(base, { type: 'END_BATTLE' });
    expect(next.lastNpcResponse).toBeNull();
    expect(next.lastInteractedNpcId).toBeNull();
  });
});

// The scene's antagonist is a "city guard" (WATCH_ROLE), so beating them is
// fighting the town watch — a consequence-bearing crime.
describe('END_BATTLE watch reaction (item 1)', () => {
  it('marks the player wanted in this town via a witnessed crime keyed to currentLocationId', () => {
    const state = hostileOpeningState();
    state.currentLocationId = 'oakhaven';
    const next = appReducer(state, { type: 'END_BATTLE', payload: { rewards: { gold: 0, items: [], xp: 10 } } });
    const crimes = next.notoriety.knownCrimes;
    expect(crimes.length).toBeGreaterThan(0);
    const crime = crimes[crimes.length - 1];
    expect(crime.locationId).toBe('oakhaven');
    expect(crime.witnessed).toBe(true);
    // A bounty-worthy crime is issued for fighting the watch.
    expect(next.notoriety.bounties.length).toBeGreaterThan(0);
  });

  it('drops the disposition of every townsperson the player has met', () => {
    const state = hostileOpeningState();
    state.npcMemory = {
      villager_a: { disposition: 20, knownFacts: [], goals: [] } as never,
      villager_b: { disposition: 0, knownFacts: [], goals: [] } as never,
    };
    const next = appReducer(state, { type: 'END_BATTLE' });
    expect(next.npcMemory.villager_a.disposition).toBeLessThan(20);
    expect(next.npcMemory.villager_b.disposition).toBeLessThan(0);
  });

  it('records the fight in the adventure log', () => {
    const state = hostileOpeningState();
    const beforeLen = state.adventureLog?.length ?? 0;
    const next = appReducer(state, { type: 'END_BATTLE' });
    expect((next.adventureLog?.length ?? 0)).toBeGreaterThan(beforeLen);
    const last = next.adventureLog?.[next.adventureLog.length - 1];
    expect(last?.summary).toMatch(/watch|wanted/i);
  });

  it('does NOT flag wanted when the beaten strangers were not the watch (e.g. bandits)', () => {
    const banditSituation: OpeningSituation = {
      ...HOSTILE_SITUATION,
      npcs: [
        { id: 'situation-npc-bandit', name: 'Cutter', role: 'bandit', disposition: 'hostile', goal: 'rob you' },
      ],
    };
    const state = createMockGameState({
      phase: GamePhase.COMBAT,
      gameEntry: inSituationEntry(banditSituation),
      generatedNpcs: {},
    });
    const next = appReducer(state, { type: 'END_BATTLE' });
    expect(next.notoriety.knownCrimes).toEqual([]);
  });
});
