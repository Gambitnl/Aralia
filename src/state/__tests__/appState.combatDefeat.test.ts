/** Earned defeat must retain attrition and its own review across the save/load boundary. */
import { describe, expect, it } from 'vitest';
import { appReducer } from '../appState';
import { GamePhase } from '../../types';
import { createMockGameState, createMockPlayerCharacter, createMockSpellSlots } from '../../utils/core/factories';
import { createBattleEndActions } from '../../utils/combat/battleEndActions';

const makeReview = () => ({
  result: 'defeat' as const,
  party: [{ id: 'hero', name: 'Hero', currentHP: 0, maxHP: 10,
    deathSaves: { successes: 0, failures: 3 } }],
  enemies: [{ id: 'ghoul', name: 'Ghoul', currentHP: 22, maxHP: 22 }],
  events: [{ id: 'last-hit', timestamp: 100, type: 'damage' as const,
    message: 'Ghoul deals 14 damage. Massive damage kills Hero at 0 HP.' }],
});

describe('defeat continuity', () => {
  it('carries a non-dungeon defeat through the real action bridge without restoring health or slots', () => {
    const hero = createMockPlayerCharacter({ id: 'hero', hp: 10, maxHp: 10 });
    const state = createMockGameState({ phase: GamePhase.COMBAT, party: [hero], gold: 22 });
    const spentSlots = createMockSpellSlots({ level_1: { current: 0, max: 2 } });
    const actions = createBattleEndActions('defeat', undefined,
      [{ id: hero.id, currentHP: 0, spellSlots: spentSlots }],
      [{ id: 'ghoul', currentHP: 22, position: { x: 2, y: 1 } }]);
    const next = actions.reduce(appReducer, state);
    expect(next.phase).toBe(GamePhase.GAME_OVER);
    expect(next.party[0].hp).toBe(0);
    expect(next.party[0].spellSlots?.level_1.current).toBe(0);
    expect(next.gold).toBe(22);
    expect(next.party[0].xp).toBe(hero.xp);
  });

  it('freezes this battle’s visible events and death result before combat is torn down', () => {
    const review = makeReview();
    const state = createMockGameState({ phase: GamePhase.COMBAT,
      party: [createMockPlayerCharacter({ id: 'hero', hp: 10, maxHp: 10 })], worldSeed: 42 });
    const actions = createBattleEndActions('defeat', undefined,
      [{ id: 'hero', currentHP: 0 }], [], undefined, review);
    const next = actions.reduce(appReducer, state);
    expect(next).toHaveProperty('lastCombatOutcome', expect.objectContaining({
      result: 'defeat', worldSeed: 42, currentLocationId: state.currentLocationId,
      party: review.party, enemies: review.enemies, events: review.events,
    }));
    review.party[0].deathSaves.failures = 0;
    review.events[0].message = 'A later fight must not change this record.';
    expect(next.lastCombatOutcome?.party[0].deathSaves?.failures).toBe(3);
    expect(next.lastCombatOutcome?.events[0].message).toContain('Massive damage');
    expect(next.extractedBattleMap).toBeNull();
  });

  it('restores a saved terminal state without routing a zero-HP party through exploration', () => {
    const saved = createMockGameState({ phase: GamePhase.GAME_OVER,
      party: [createMockPlayerCharacter({ id: 'hero', hp: 0, maxHp: 10 })], gold: 22 });
    const next = appReducer(createMockGameState(), { type: 'LOAD_GAME_SUCCESS', payload: saved });
    expect(next.phase).toBe(GamePhase.GAME_OVER);
    expect(next.party[0].hp).toBe(0);
    expect(next.gold).toBe(22);
  });

  it.each(['defeat', 'flee'] as const)('does not declare source NPCs beaten after an explicit %s', result => {
    const state = createMockGameState({ phase: GamePhase.COMBAT,
      party: [createMockPlayerCharacter({ id: 'hero', hp: 10, maxHp: 10 })],
      gameEntry: { status: 'in-situation', error: null,
        sceneImage: { status: 'idle', url: null, error: null },
        situation: { setting: { place: 'market', timeOfDay: 'dawn', weather: 'clear' },
          predicament: 'A guard blocks the road.',
          npcs: [{ id: 'guard', name: 'Guard', role: 'city guard', disposition: 'hostile', goal: 'hold the road' }],
          openingLine: { speakerId: 'guard', text: 'Halt.' },
          threat: { hostile: true, enemies: [{ name: 'Guard', quantity: 1, cr: '1/8' }],
            deEscalationDC: 12, tension: 'blocked passage' },
        },
      },
    });
    const review = { ...makeReview(), result,
      party: makeReview().party.map(member => result === 'flee'
        ? { ...member, currentHP: 4, deathSaves: { successes: 0, failures: 0 } } : member) };
    const actions = createBattleEndActions(result, undefined,
      [{ id: 'hero', currentHP: result === 'defeat' ? 0 : 4 }], [], undefined, review);
    const next = actions.reduce(appReducer, state);
    expect(next.defeatedNpcIds).toEqual([]);
    expect(next.gameEntry?.situation).toEqual(state.gameEntry?.situation);
    expect(next.gold).toBe(state.gold);
    expect(next.lastCombatOutcome?.party[0].currentHP).toBe(next.party[0].hp);
  });
});
