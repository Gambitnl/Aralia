import { describe, it, expect } from 'vitest';
import { characterReducer } from '../characterReducer';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';
import { createMockGameState } from '../../../utils/factories';
import { daysOfFood, daysOfWater } from '../../../systems/travel/provisioning';

/**
 * Integration: the provisioning math (daysOfFood/daysOfWater) reads rations and
 * water out of the live inventory, so ADD_ITEM must preserve their canonical ids
 * (unlike ordinary gear, which gets a fresh unique id) and REMOVE_ITEM must find
 * them by that id. This proves the reducer ↔ provisioning contract end-to-end.
 */
const baseState: GameState = { ...createMockGameState(), inventory: [], gold: 0 };

describe('provision items round-trip through the reducer', () => {
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
