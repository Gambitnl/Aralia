/**
 * @file healingPotion.test.ts — GG-462: Healing Potion 2d4+2 restoration test suite.
 * Verifies that the standard 5e Potion of Healing restores 2d4+2 (range 4–10) HP,
 * instead of the old broken 33–45 HP calculation.
 */
import { describe, it, expect } from 'vitest';
import { characterReducer } from '../characterReducer';
import { GameState, Item } from '../../../types';
import { AppAction } from '../../actionTypes';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/core';
import { ITEMS } from '../../../data/items';
import { CRAFTED_ITEMS } from '../../../data/craftedItems';

describe('Healing Potion Restoration (GG-462)', () => {
  it('every heal from healing_potion over 100 uses is between 4 and 10 HP', () => {
    const potion = ITEMS['healing_potion'];
    expect(potion).toBeDefined();
    expect(potion.effect).toEqual({ type: 'heal', value: 0, dice: '2d4+2' });

    for (let i = 0; i < 100; i++) {
      const char = createMockPlayerCharacter({ id: 'c1', hp: 1, maxHp: 100 });
      const potionItem: Item = { ...potion, id: 'healing_potion_1' };
      const state: GameState = {
        ...createMockGameState(),
        party: [char],
        inventory: [potionItem],
      };

      const result = characterReducer(state, {
        type: 'USE_ITEM',
        payload: { characterId: 'c1', itemId: 'healing_potion_1' },
      } as AppAction);

      const healedHp = result.party![0].hp;
      const amount = healedHp - 1;
      expect(amount).toBeGreaterThanOrEqual(4);
      expect(amount).toBeLessThanOrEqual(10);
    }
  });

  it('caps healing at character maxHp', () => {
    const potion = ITEMS['healing_potion'];
    const char = createMockPlayerCharacter({ id: 'c1', hp: 9, maxHp: 10 });
    const potionItem: Item = { ...potion, id: 'potion_cap' };
    const state: GameState = {
      ...createMockGameState(),
      party: [char],
      inventory: [potionItem],
    };

    const result = characterReducer(state, {
      type: 'USE_ITEM',
      payload: { characterId: 'c1', itemId: 'potion_cap' },
    } as AppAction);

    expect(result.party![0].hp).toBe(10);
  });

  it('handles item effect with undefined value without producing NaN', () => {
    const itemWithoutValue: Item = {
      id: 'custom_pot',
      name: 'Custom Pot',
      description: 'Heals without value property',
      type: 'consumable' as any,
      effect: { type: 'heal', dice: '1d4' } as any,
    };
    const char = createMockPlayerCharacter({ id: 'c1', hp: 5, maxHp: 20 });
    const state: GameState = {
      ...createMockGameState(),
      party: [char],
      inventory: [itemWithoutValue],
    };

    const result = characterReducer(state, {
      type: 'USE_ITEM',
      payload: { characterId: 'c1', itemId: 'custom_pot' },
    } as AppAction);

    const healed = result.party![0].hp;
    expect(healed).toBeGreaterThanOrEqual(6);
    expect(healed).toBeLessThanOrEqual(9);
    expect(Number.isNaN(healed)).toBe(false);
  });

  it('crafted potion effects have value 0 and roll their specified dice formulas', () => {
    expect(CRAFTED_ITEMS.healing_salve.effect).toEqual({ type: 'heal', value: 0, dice: '2d4+2' });
    expect(CRAFTED_ITEMS.potion_of_healing_greater.effect).toEqual({ type: 'heal', value: 0, dice: '4d4+4' });
    expect(CRAFTED_ITEMS.potion_of_healing_superior.effect).toEqual({ type: 'heal', value: 0, dice: '8d4+8' });
    expect(CRAFTED_ITEMS.potion_of_healing_supreme.effect).toEqual({ type: 'heal', value: 0, dice: '10d4+20' });
  });
});
