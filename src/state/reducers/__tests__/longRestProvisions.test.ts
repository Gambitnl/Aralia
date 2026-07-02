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
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/factories';

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
});
