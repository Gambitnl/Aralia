/**
 * @file appState.lootRewards.test.ts — GG-460: Loot and reward item instantiation.
 * Verifies that battle loot and quest rewards instantiate independent item instances
 * with unique IDs and acquiredAt timestamps, so using one copy does not erase all copies.
 */
import { describe, it, expect } from 'vitest';
import { appReducer } from '../appState';
import { characterReducer } from '../reducers/characterReducer';
import { GameState, Item } from '../../types';
import { AppAction } from '../actionTypes';
import { createMockGameState, createMockPlayerCharacter } from '../../utils/core';
import { ITEMS } from '../../data/items';

describe('Battle Loot & Reward Item Instantiation (GG-460)', () => {
  it('instantiates battle reward items with unique IDs so using one copy leaves the other in inventory', () => {
    const pc = createMockPlayerCharacter({ id: 'hero', name: 'Hero', hp: 5, maxHp: 20 });
    const initialState: GameState = {
      ...createMockGameState(),
      party: [pc],
      inventory: [],
    };

    const potion1 = ITEMS['healing_potion'];
    const potion2 = ITEMS['healing_potion'];
    expect(potion1.id).toBe('healing_potion');

    // End battle with 2 looted healing potions
    const battleWonState = appReducer(initialState, {
      type: 'END_BATTLE',
      payload: {
        rewards: {
          gold: 10,
          xp: 50,
          items: [potion1, potion2],
        },
      },
    } as AppAction);

    expect(battleWonState.inventory).toHaveLength(2);
    const [looted1, looted2] = battleWonState.inventory;
    expect(looted1.id).not.toBe(looted2.id); // Unique IDs, not both 'healing_potion'
    expect(looted1.acquiredAt).toBeDefined();
    expect(looted2.acquiredAt).toBeDefined();

    // Use the first looted potion
    const afterUseState = characterReducer(battleWonState, {
      type: 'USE_ITEM',
      payload: { characterId: 'hero', itemId: looted1.id },
    } as AppAction);

    // One potion remains in inventory! (Pre-fix bug: both were removed because both had id: 'healing_potion')
    expect(afterUseState.inventory).toBeDefined();
    expect(afterUseState.inventory).toHaveLength(1);
    expect(afterUseState.inventory![0].id).toBe(looted2.id);
  });
});
