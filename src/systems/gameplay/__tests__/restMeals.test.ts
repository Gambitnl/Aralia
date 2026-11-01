import { describe, expect, it } from 'vitest';
import { COMPANIONS } from '@/data/companions';
import { createMockGameState, createMockItem, createMockPlayerCharacter } from '@/utils/core/factories';
import { characterReducer } from '@/state/reducers/characterReducer';
import { planRestMeals } from '../restMeals';

function ready(food = 2, water = 2) {
  const elara = structuredClone(COMPANIONS.elara_vance);
  elara.inParty = true;
  elara.inventory = [createMockItem({ id: 'rations', quantity: food, description: 'Her sealed provisions' }), createMockItem({ id: 'water-day', quantity: water })];
  return createMockGameState({ inventory: [], companions: { [elara.id]: elara }, party: [
    createMockPlayerCharacter({ id: 'bram', name: 'Bram', hp: 3, conditions: ['starving', 'exhaustion'] }),
    createMockPlayerCharacter({ id: elara.id, name: 'Elara', hp: 3, conditions: ['starving', 'exhaustion'] }),
  ], rulesEdition: '2014' });
}
describe('owned rest meals', () => {
  it('feeds Elara from her private bag without feeding Bram, changing identity or mutating input', () => {
    const state = ready(), before = structuredClone(state), plan = planRestMeals(state);
    expect(plan.fedIds).toEqual(['elara_vance']);
    expect(plan.patch.inventory).toBeUndefined();
    expect(plan.companions.elara_vance.inventory).toEqual(state.companions.elara_vance.inventory!.map(item => ({ ...item, quantity: 1 })));
    expect(plan.companions.elara_vance.memories).toBe(state.companions.elara_vance.memories);
    expect(plan.summary).toContain('Without a meal: Bram');
    expect(state).toEqual(before);
    const result = characterReducer(state, { type: 'LONG_REST', payload: {} });
    expect(result.party![0].hp).toBe(3);
    expect(result.party![0].conditions).toContain('exhaustion');
    expect(result.party![1].hp).toBe(result.party![1].maxHp);
    expect(result.party![1].conditions).not.toContain('starving');
    expect(result.party![1].conditions).not.toContain('exhaustion');
    expect(result.companions).toEqual(plan.companions);
  });
  it('uses a complete personal meal and shared supplies for the remaining traveler', () => {
    const state = ready();
    state.inventory = [createMockItem({ id: 'rations', quantity: 1 }), createMockItem({ id: 'water-day', quantity: 1 })];
    const plan = planRestMeals(state);
    expect(plan.fedIds).toEqual(['elara_vance', 'bram']);
    expect(plan.inventory).toEqual([]);
    expect(plan.companions.elara_vance.inventory!.map(item => item.quantity)).toEqual([1, 1]);
  });
  it('does not nibble an incomplete private meal or transfer it to somebody else', () => {
    const state = ready(2, 0), plan = planRestMeals(state);
    expect(plan.fedIds).toEqual([]);
    expect(plan.patch).toEqual({});
  });
  it('combines fractional own supplies and shared shortfalls only when everyone remaining can eat', () => {
    const state = ready(0.5, 0.5);
    state.inventory = [createMockItem({ id: 'rations', quantity: 1.5 }), createMockItem({ id: 'water-day', quantity: 1.5 })];
    expect(planRestMeals(state).fedIds).toEqual(['bram', 'elara_vance']);
    state.inventory[1].quantity = 1;
    expect(planRestMeals(state).patch).toEqual({});
  });
  it('ignores absent owners and preserves denied or downed personal bags', () => {
    const state = ready();
    expect(planRestMeals(state, ['elara_vance']).patch).toEqual({});
    state.party[1].hp = 0;
    expect(planRestMeals(state).patch).toEqual({});
    state.party[1].hp = 3;
    state.companions.elara_vance.inParty = false;
    expect(planRestMeals(state).patch).toEqual({});
  });
  it('rejects nonfinite stacks and leaves shared-only partial pantries untouched', () => {
    const state = ready(Infinity, NaN);
    state.inventory = [createMockItem({ id: 'rations', quantity: 1 }), createMockItem({ id: 'water-day', quantity: 1 })];
    expect(planRestMeals(state).patch).toEqual({});
  });
});
