import { describe, it, expect, beforeEach } from 'vitest';
import { craftingReducer } from '../craftingReducer';
import { GameState } from '../../../types';
import { initialGameState } from '../../appState';
import { createInitialCraftingState, CraftingQuality } from '../../../types/crafting';
import { CraftingCategory } from '../../actionTypes';

/**
 * Contract proof for `UPDATE_CRAFTING_STATS` (crafting-ui:G5).
 * Verifies the quality/category branching, nat20 tracking, and category
 * count increment that the reducer performs, plus the no-op guard when no
 * crafting state exists yet.
 */
describe('craftingReducer — UPDATE_CRAFTING_STATS', () => {
  let baseState: GameState;

  beforeEach(() => {
    baseState = {
      ...initialGameState,
      crafting: createInitialCraftingState(['alchemist']),
    };
  });

  const dispatchStats = (
    state: GameState,
    payload: { quality: CraftingQuality; category: CraftingCategory; isNat20: boolean }
  ) => {
    const result = craftingReducer(state, {
      type: 'UPDATE_CRAFTING_STATS' as const,
      payload,
    });
    return result.crafting!.stats;
  };

  it('counts a ruined craft as a failure and a ruined material', () => {
    const stats = dispatchStats(baseState, { quality: 'ruined', category: 'potion', isNat20: false });

    expect(stats.totalCrafted).toBe(1);
    expect(stats.failedCrafts).toBe(1);
    expect(stats.ruinedMaterials).toBe(1);
    expect(stats.successfulCrafts).toBe(0);
    expect(stats.masterworkCrafts).toBe(0);
    expect(stats.legendaryRolls).toBe(0);
  });

  it('counts a standard craft as a success without special counters', () => {
    const stats = dispatchStats(baseState, { quality: 'standard', category: 'oil', isNat20: false });

    expect(stats.totalCrafted).toBe(1);
    expect(stats.successfulCrafts).toBe(1);
    expect(stats.failedCrafts).toBe(0);
    expect(stats.masterworkCrafts).toBe(0);
    expect(stats.legendaryRolls).toBe(0);
  });

  it('counts a masterwork craft as both a success and a masterwork', () => {
    const stats = dispatchStats(baseState, { quality: 'masterwork', category: 'bomb', isNat20: false });

    expect(stats.successfulCrafts).toBe(1);
    expect(stats.masterworkCrafts).toBe(1);
    expect(stats.legendaryRolls).toBe(0);
  });

  it('counts a legendary craft as both a success and a legendary roll', () => {
    const stats = dispatchStats(baseState, { quality: 'legendary', category: 'poison', isNat20: false });

    expect(stats.successfulCrafts).toBe(1);
    expect(stats.legendaryRolls).toBe(1);
    expect(stats.masterworkCrafts).toBe(0);
  });

  it('tracks natural 20 rolls independently of quality', () => {
    const stats = dispatchStats(baseState, { quality: 'standard', category: 'utility', isNat20: true });

    expect(stats.nat20Count).toBe(1);
    expect(stats.successfulCrafts).toBe(1);
  });

  it('increments the per-category count for the crafted category', () => {
    const stats = dispatchStats(baseState, { quality: 'standard', category: 'ink', isNat20: false });

    expect(stats.categoryCounts.ink).toBe(1);
  });

  it('accumulates counters across multiple crafts', () => {
    let state = baseState;
    state = { ...state, crafting: craftingReducer(state, { type: 'UPDATE_CRAFTING_STATS' as const, payload: { quality: 'standard', category: 'potion', isNat20: false } }).crafting! };
    state = { ...state, crafting: craftingReducer(state, { type: 'UPDATE_CRAFTING_STATS' as const, payload: { quality: 'ruined', category: 'potion', isNat20: false } }).crafting! };
    const stats = craftingReducer(state, { type: 'UPDATE_CRAFTING_STATS' as const, payload: { quality: 'masterwork', category: 'oil', isNat20: true } }).crafting!.stats;

    expect(stats.totalCrafted).toBe(3);
    expect(stats.successfulCrafts).toBe(2);
    expect(stats.failedCrafts).toBe(1);
    expect(stats.masterworkCrafts).toBe(1);
    expect(stats.nat20Count).toBe(1);
    expect(stats.categoryCounts.potion).toBe(2);
    expect(stats.categoryCounts.oil).toBe(1);
  });

  it('does not mutate the previous state stats object', () => {
    const before = baseState.crafting!.stats;
    dispatchStats(baseState, { quality: 'masterwork', category: 'potion', isNat20: true });

    expect(before.totalCrafted).toBe(0);
    expect(before.masterworkCrafts).toBe(0);
    expect(before.categoryCounts.potion).toBeUndefined();
  });

  it('is a no-op when no crafting state is present', () => {
    const stateWithoutCrafting = { ...initialGameState, crafting: undefined } as unknown as GameState;
    const result = craftingReducer(stateWithoutCrafting, {
      type: 'UPDATE_CRAFTING_STATS' as const,
      payload: { quality: 'standard', category: 'potion', isNat20: false },
    });

    expect(result).toEqual({});
  });
});
