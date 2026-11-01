import { describe, it, expect } from 'vitest';
import { characterReducer, instantiateItem } from '../characterReducer';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';
import { createMockGameState } from '../../../utils/core';
import { daysOfFood, daysOfWater } from '../../../systems/travel/provisioning';
import { CURRENCY_COPPER_VALUES } from '../../../utils/character/coinPurseUtils';
import { getPartyFundsGp } from '../../../systems/economy/partyFunds';
import { ALL_ITEMS } from '../../../data/items';

/**
 * Integration: the provisioning math (daysOfFood/daysOfWater) reads rations and
 * water out of the live inventory, so ADD_ITEM must preserve their canonical ids
 * (unlike ordinary gear, which gets a fresh unique id) and REMOVE_ITEM must find
 * them by that id. This proves the reducer ↔ provisioning contract end-to-end.
 */
const baseState: GameState = { ...createMockGameState(), inventory: [], gold: 0 };

describe('provision items round-trip through the reducer', () => {
  it.each(Object.entries(CURRENCY_COPPER_VALUES))('ADD_ITEM keeps %s recognizable at its face value', (itemId, copper) => {
    const after = characterReducer(baseState, {type: 'ADD_ITEM', payload: {itemId, count: 3}});
    expect(after.inventory).toHaveLength(3);
    expect(after.inventory!.every(item => item.id === itemId && item.acquiredAt != null)).toBe(true);
    expect(getPartyFundsGp({...baseState, inventory: after.inventory!})).toBe(copper * 3 / 100);
  });

  it('keeps a source coin stack while ordinary gear still receives independent identity', () => {
    const earned = {...ALL_ITEMS.shiny_coin, quantity: 6, acquiredAt: 42, sourceId: 'landmark-cache', containerId: 'pouch'};
    expect(instantiateItem(earned, 99)).toEqual(earned);
    const gear = instantiateItem(ALL_ITEMS.healing_potion, 99);
    expect(gear.id).not.toBe(ALL_ITEMS.healing_potion.id);
    expect(gear.acquiredAt).toBe(99);
  });

  it('ADD_ITEM keeps the canonical "rations" id so daysOfFood can count them', () => {
    const add: AppAction = { type: 'ADD_ITEM', payload: { itemId: 'rations', count: 5 } };
    const next = characterReducer(baseState, add);

    expect(next.inventory).toHaveLength(5);
    expect(next.inventory!.every((i) => i.id === 'rations')).toBe(true);
    expect(daysOfFood(next.inventory!)).toBe(5);
  });

  it('ADD_ITEM keeps the canonical "water-day" id so daysOfWater can count them', () => {
    const add: AppAction = { type: 'ADD_ITEM', payload: { itemId: 'water-day', count: 3 } };
    const next = characterReducer(baseState, add);

    expect(daysOfWater(next.inventory!)).toBe(3);
  });

  it('REMOVE_ITEM spends rations by their canonical id', () => {
    const withFood = characterReducer(baseState, { type: 'ADD_ITEM', payload: { itemId: 'rations', count: 5 } });
    const spent = characterReducer(
      { ...baseState, inventory: withFood.inventory! },
      { type: 'REMOVE_ITEM', payload: { itemId: 'rations', count: 2 } },
    );

    expect(daysOfFood(spent.inventory!)).toBe(3);
  });
});
