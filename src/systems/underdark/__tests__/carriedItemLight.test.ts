import {describe, expect, it} from 'vitest';
import {createMockGameState, createMockPlayerCharacter} from '../../../utils/core/factories';
import {GamePhase} from '../../../types/core';
import type {GameState, Item} from '../../../types';
import {ItemType} from '../../../types/items';
import {activeCarriedTorches, prepareCarriedTorch, remainingLightMinutes} from '../carriedItemLight';
import {UnderdarkMechanics} from '../UnderdarkMechanics';
import {inventoryWeight} from '../../travel/provisionEncumbrance';

const torch: Item = {id: 'torch', name: 'Torch', description: 'Bought from Roban', type: ItemType.Consumable, weight: 1, quantity: 2, acquiredAt: 123};
function fixture() {
  return createMockGameState({party: [createMockPlayerCharacter({id: 'sana', hp: 9})],
    inventory: [{...torch}, {id: 'tinderbox', name: 'Tinderbox', description: 'Fire starter', type: ItemType.Tool}],
    gameTime: new Date('0351-01-04T09:18:50Z')});
}
function light(state = fixture()) {
  const result = prepareCarriedTorch(state, {itemId: 'torch', characterId: 'sana', inventoryIndex: 0});
  if ('error' in result) throw new Error(result.error);
  return {...state, ...result.patch};
}

describe('owned carried torch fuel', () => {
  it('requires ignition rather than inferring a flame from an inventory entry or pack', () => {
    const state = fixture(); state.inventory = [torch];
    expect(activeCarriedTorches(state)).toEqual([]);
    expect(prepareCarriedTorch(state, {itemId: 'torch', characterId: 'sana'})).toHaveProperty('error');
    expect(state.inventory).toEqual([torch]);
  });
  it('consumes exactly one selected torch and preserves its source identity', () => {
    const state = light();
    expect(state.inventory[0].quantity).toBe(1);
    const [source] = activeCarriedTorches(state);
    expect(source.sourceItem).toEqual({...torch, quantity: 1});
    expect(source.durationRemaining).toBe(60);
    expect(source.brightRadius).toBe(20);
    expect(inventoryWeight([...state.inventory, ...activeCarriedTorches(state).map(light => light.sourceItem!)])).toBe(inventoryWeight(fixture().inventory));
    expect(prepareCarriedTorch(state, {itemId: 'torch', characterId: 'sana'})).toHaveProperty('error');
  });
  it.each(['foreign', 'downed', 'battle', 'stale index'] as const)('rejects %s without spending fuel or inventory', reason => {
    const state = fixture();
    if (reason === 'downed') state.party[0].hp = 0;
    if (reason === 'battle') state.phase = GamePhase.COMBAT;
    const before = JSON.stringify(state);
    expect(prepareCarriedTorch(state, {itemId: 'torch', characterId: reason === 'foreign' ? 'other' : 'sana',
      inventoryIndex: reason === 'stale index' ? 1 : 0})).toHaveProperty('error');
    expect(JSON.stringify(state)).toBe(before);
  });
  it('extinguishes once and relights the same remaining fuel after a serialized reload', () => {
    let state = light();
    state.gameTime = new Date(state.gameTime.getTime() + 17 * 60000);
    const source = activeCarriedTorches(state)[0];
    const request = {itemId: 'torch', characterId: 'sana', light: {action: 'extinguish' as const, sourceId: source.id}};
    const result = prepareCarriedTorch(state, request);
    if ('error' in result) throw new Error(result.error);
    state = {...state, ...result.patch};
    expect(state.inventory.at(-1)).toEqual({...torch, quantity: 1, lightFuelMinutes: 43});
    expect(prepareCarriedTorch(state, request)).toHaveProperty('error');
    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    restored.gameTime = new Date(state.gameTime);
    const relit = prepareCarriedTorch(restored, {itemId: 'torch', characterId: 'sana', inventoryIndex: restored.inventory.length - 1});
    if ('error' in relit) throw new Error(relit.error);
    expect(activeCarriedTorches({...restored, ...relit.patch})[0].durationRemaining).toBe(43);
  });
  it('uses the existing world-time consumer and cannot refund expired fuel', () => {
    const state = light();
    const consumed = UnderdarkMechanics.processTime(state, 3600);
    expect(consumed.underdark.activeLightSources).toEqual([]);
    expect(consumed.messages.some(message => message.text.includes('flickers and dies'))).toBe(true);
    const future = new Date(state.gameTime.getTime() + 3600000);
    expect(remainingLightMinutes(state.underdark.activeLightSources[0], future)).toBe(0);
    expect(activeCarriedTorches({...state, gameTime: future})).toEqual([]);
    const out = prepareCarriedTorch({...state, gameTime: future}, {itemId: 'torch', characterId: 'sana',
      light: {action: 'extinguish', sourceId: state.underdark.activeLightSources[0].id}});
    if ('error' in out) throw new Error(out.error);
    expect(out.patch.inventory).toEqual(state.inventory);
  });
});
