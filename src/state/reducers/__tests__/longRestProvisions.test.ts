/**
 * @file longRestProvisions.test.ts — PRV9 (recovery + starvation bite) on LONG_REST.
 * A long rest purges 'poisoned'. With enough provisions in inventory (1 ration +
 * 1 water per member) the party eats: the food is consumed and 'starving' /
 * 'fatigued' clear. Without food, a starving member's long rest restores NO HP —
 * you cannot recover while starving. Own file so the main characterReducer suite
 * stays untouched in the shared checkout.
 */
import { describe, it, expect } from 'vitest';
import { characterReducer } from '../characterReducer';
import { GameState, Item } from '../../../types';
import { AppAction } from '../../actionTypes';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/core';

const provisionItem = (id: string): Item => ({ id, name: id, description: '', type: 'food_drink' } as unknown as Item);

function restState(opts: {
  conditions?: string[];
  rations?: number;
  water?: number;
  members?: number;
}): GameState {
  const { conditions = [], rations = 0, water = 0, members = 2 } = opts;
  return {
    ...createMockGameState(),
    party: Array.from({ length: members }, (_, i) =>
      createMockPlayerCharacter({ id: `c${i}`, name: `Char${i}`, hp: 3, maxHp: 10, conditions: [...conditions] }),
    ),
    inventory: [
      ...Array.from({ length: rations }, () => provisionItem('rations')),
      ...Array.from({ length: water }, () => provisionItem('water-day')),
    ],
  };
}

const longRest = (state: GameState, deniedCharacterIds: string[] = []): Partial<GameState> =>
  characterReducer(state, { type: 'LONG_REST', payload: { deniedCharacterIds } } as AppAction);

describe('LONG_REST condition recovery (PRV9)', () => {
  it('removes one exhaustion level while retaining unrelated conditions', () => {
    const state = restState({conditions: ['Exhaustion-3', 'exhaustion', 'cursed'], members: 1});
    state.rulesEdition = '2024';
    expect(longRest(state).party![0].conditions).toEqual(['cursed', 'exhaustion_2']);
    state.party[0].conditions = ['exhaustion', 'cursed'];
    expect(longRest(state).party![0].conditions).toEqual(['cursed']);
  });

  it('preserves exhaustion for denied, downed and cooldown-blocked rests', () => {
    const state = restState({conditions: ['exhaustion'], members: 2});
    state.party[0].hp = 0;
    const result = longRest(state, ['c1']);
    expect(result.party!.map(c => c.conditions)).toEqual([['exhaustion'], ['exhaustion']]);
    state.lastLongRestAt = state.gameTime.toISOString();
    expect(longRest(state)).toBe(state);
  });

  it('retains older-edition exhaustion without a meal and reduces it with provisions', () => {
    const state = restState({conditions: ['exhaustion_2'], members: 1});
    state.rulesEdition = '2014';
    expect(longRest(state).party![0].conditions).toEqual(['exhaustion_2']);
    state.inventory = [provisionItem('rations'), provisionItem('water-day')];
    expect(longRest(state).party![0].conditions).toEqual(['exhaustion_1']);
  });

  it('starts the sixteen-hour cooldown at completion rather than bedtime', () => {
    const state = restState({members: 1});
    state.gameTime = new Date('2000-01-02T20:00:00Z');
    const after = longRest(state);
    expect(after.lastLongRestAt).toBe('2000-01-03T04:00:00.000Z');
    const waking = {...state, ...after, gameTime: new Date('2000-01-03T04:00:00Z')};
    expect(longRest(waking)).toBe(waking);
    const tooSoon = {...waking, gameTime: new Date('2000-01-03T19:59:59Z')};
    expect(longRest(tooSoon)).toBe(tooSoon);
    const eligible = {...waking, gameTime: new Date('2000-01-03T20:00:00Z')};
    expect(longRest(eligible).lastLongRestAt).toBe('2000-01-04T04:00:00.000Z');
  });

  it('clears poisoned for every resting member (no food required)', () => {
    const next = longRest(restState({ conditions: ['poisoned'] }));
    for (const pc of next.party!) expect(pc.conditions ?? []).not.toContain('poisoned');
  });

  it('with enough provisions for everyone, eats them and clears starving + fatigued', () => {
    const next = longRest(restState({ conditions: ['starving', 'fatigued'], rations: 3, water: 2, members: 2 }));
    for (const pc of next.party!) {
      expect(pc.conditions ?? []).not.toContain('starving');
      expect(pc.conditions ?? []).not.toContain('fatigued');
      expect(pc.hp).toBe(pc.maxHp);
    }
    // 2 members ate: 2 rations + 2 water consumed, 1 ration left.
    const inv = next.inventory!;
    expect(inv.filter((i) => i.id === 'rations')).toHaveLength(1);
    expect(inv.filter((i) => i.id === 'water-day')).toHaveLength(0);
  });

  it('without enough food, starving members stay starving and regain NO HP', () => {
    const next = longRest(restState({ conditions: ['starving'], rations: 1, water: 0, members: 2 }));
    for (const pc of next.party!) {
      expect(pc.conditions).toContain('starving');
      expect(pc.hp).toBe(3); // no recovery while starving
    }
    // The partial stock is NOT nibbled away — an honest all-or-nothing meal.
    // (Slice reducer: inventory is absent from the partial when untouched.)
    expect(next.inventory).toBeUndefined();
  });

  it('a non-starving party without food still rests normally', () => {
    const next = longRest(restState({ conditions: [] }));
    for (const pc of next.party!) expect(pc.hp).toBe(pc.maxHp);
  });

  it('a denied member gets no cures', () => {
    const next = longRest(restState({ conditions: ['poisoned'], rations: 2, water: 2 }), ['c1']);
    expect(next.party![0].conditions ?? []).not.toContain('poisoned');
    expect(next.party![1].conditions).toContain('poisoned');
  });

  describe('stacked provisions (GG-470)', () => {
    it('solo character with a stack of 5 rations and 5 water eats 1 and retains 4 of each', () => {
      const state: GameState = {
        ...createMockGameState(),
        party: [
          createMockPlayerCharacter({ id: 'c0', name: 'Solo', hp: 3, maxHp: 10, conditions: ['starving'] }),
        ],
        inventory: [
          { ...provisionItem('rations'), quantity: 5 },
          { ...provisionItem('water-day'), quantity: 5 },
        ],
      };

      const next = longRest(state);
      expect(next.party![0].conditions ?? []).not.toContain('starving');
      expect(next.party![0].hp).toBe(10);

      const inv = next.inventory!;
      expect(inv).toHaveLength(2);
      expect(inv.find((i) => i.id === 'rations')?.quantity).toBe(4);
      expect(inv.find((i) => i.id === 'water-day')?.quantity).toBe(4);
    });

    it('party of 4 with a 20-ration stack and 20-water stack eats 4 and retains 16 of each', () => {
      const state: GameState = {
        ...createMockGameState(),
        party: Array.from({ length: 4 }, (_, i) =>
          createMockPlayerCharacter({ id: `c${i}`, name: `Member${i}`, hp: 3, maxHp: 10, conditions: ['starving'] }),
        ),
        inventory: [
          { ...provisionItem('rations'), quantity: 20 },
          { ...provisionItem('water-day'), quantity: 20 },
        ],
      };

      const next = longRest(state);
      for (const pc of next.party!) {
        expect(pc.conditions ?? []).not.toContain('starving');
        expect(pc.hp).toBe(10);
      }

      const inv = next.inventory!;
      expect(inv).toHaveLength(2);
      expect(inv.find((i) => i.id === 'rations')?.quantity).toBe(16);
      expect(inv.find((i) => i.id === 'water-day')?.quantity).toBe(16);
    });

    it('split stacks across multiple inventory entries consume across stacks correctly', () => {
      const state: GameState = {
        ...createMockGameState(),
        party: Array.from({ length: 3 }, (_, i) =>
          createMockPlayerCharacter({ id: `c${i}`, name: `Member${i}`, hp: 3, maxHp: 10, conditions: [] }),
        ),
        inventory: [
          { ...provisionItem('rations'), id: 'rations', uniqueId: 'r1', quantity: 2 } as unknown as Item,
          { ...provisionItem('rations'), id: 'rations', uniqueId: 'r2', quantity: 5 } as unknown as Item,
          { ...provisionItem('water-day'), id: 'water-day', quantity: 3 },
        ],
      };

      const next = longRest(state);
      const inv = next.inventory!;
      // 3 rations eaten: 2 from stack 1 (wholly consumed and removed), 1 from stack 2 (leaving 4)
      const rationStacks = inv.filter((i) => i.id === 'rations');
      expect(rationStacks).toHaveLength(1);
      expect(rationStacks[0].quantity).toBe(4);

      // 3 water eaten: leaving 0 water-day items
      expect(inv.filter((i) => i.id === 'water-day')).toHaveLength(0);
    });
  });
});
