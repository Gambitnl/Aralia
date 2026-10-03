import { describe, it, expect } from 'vitest';
import { ItemType } from '../../../types';
import type { GameState, Item } from '../../../types';
import { characterReducer } from '../characterReducer';
import type { AppAction } from '../../actionTypes';

/**
 * agora-17eb: container assignments used to live only in InventoryList's local
 * component state, so stowing a torch in a pouch was forgotten the moment the
 * character sheet unmounted and never reached a save. MOVE_ITEM_TO_CONTAINER
 * writes the assignment onto the item itself (`Item.containerId`), which is
 * what the sheet reads back.
 */

const POUCH: Item = {
  id: 'pouch-instance-1',
  name: 'Belt Pouch',
  type: ItemType.Tool,
  description: 'A small leather pouch.',
  weight: 0.5,
  isContainer: true,
  capacitySlots: 4,
};

const SACK: Item = {
  id: 'sack-instance-1',
  name: 'Sack',
  type: ItemType.Tool,
  description: 'A rough sack.',
  weight: 0.5,
  isContainer: true,
};

const TORCH: Item = {
  id: 'torch-instance-1',
  name: 'Torch',
  type: ItemType.LightSource,
  description: 'A wooden torch.',
  weight: 1,
};

const stateWith = (inventory: Item[]): GameState =>
  ({
    party: [],
    inventory,
    gold: 0,
    characterSheetModal: { isOpen: false, character: null },
  }) as unknown as GameState;

const move = (itemId: string, containerId: string | null): AppAction => ({
  type: 'MOVE_ITEM_TO_CONTAINER',
  payload: { itemId, containerId },
});

describe('characterReducer MOVE_ITEM_TO_CONTAINER (agora-17eb)', () => {
  it('stows an item in a carried container', () => {
    const next = characterReducer(stateWith([POUCH, TORCH]), move(TORCH.id, POUCH.id));
    expect(next.inventory?.find(i => i.id === TORCH.id)?.containerId).toBe(POUCH.id);
  });

  it('leaves every other item untouched', () => {
    const next = characterReducer(stateWith([POUCH, SACK, TORCH]), move(TORCH.id, POUCH.id));
    expect(next.inventory?.find(i => i.id === POUCH.id)?.containerId).toBeUndefined();
    expect(next.inventory?.find(i => i.id === SACK.id)?.containerId).toBeUndefined();
  });

  it('moves an already-stowed item to a different container', () => {
    const stowed = { ...TORCH, containerId: POUCH.id };
    const next = characterReducer(stateWith([POUCH, SACK, stowed]), move(TORCH.id, SACK.id));
    expect(next.inventory?.find(i => i.id === TORCH.id)?.containerId).toBe(SACK.id);
  });

  it('drops the pointer entirely when returning an item to the root backpack', () => {
    const stowed = { ...TORCH, containerId: POUCH.id };
    const next = characterReducer(stateWith([POUCH, stowed]), move(TORCH.id, null));
    const moved = next.inventory?.find(i => i.id === TORCH.id);
    expect(moved?.containerId).toBeUndefined();
    expect('containerId' in (moved as object)).toBe(false);
  });

  it('nests one container inside another', () => {
    const next = characterReducer(stateWith([POUCH, SACK]), move(POUCH.id, SACK.id));
    expect(next.inventory?.find(i => i.id === POUCH.id)?.containerId).toBe(SACK.id);
  });

  it('refuses to stow an item inside itself', () => {
    expect(characterReducer(stateWith([POUCH]), move(POUCH.id, POUCH.id))).toEqual({});
  });

  it('refuses a target that is not a carried container', () => {
    expect(characterReducer(stateWith([POUCH, TORCH]), move(POUCH.id, TORCH.id))).toEqual({});
  });

  it('refuses a container the party does not carry', () => {
    expect(characterReducer(stateWith([POUCH, TORCH]), move(TORCH.id, 'chest-back-home'))).toEqual({});
  });

  it('is a no-op when the item is already in that container', () => {
    const stowed = { ...TORCH, containerId: POUCH.id };
    expect(characterReducer(stateWith([POUCH, stowed]), move(TORCH.id, POUCH.id))).toEqual({});
  });

  it('is a no-op for an item the party does not carry', () => {
    expect(characterReducer(stateWith([POUCH]), move('ghost-item', POUCH.id))).toEqual({});
  });

  it('accepts a weight-capped container that never set isContainer', () => {
    const basket: Item = { ...SACK, id: 'basket-1', isContainer: undefined, capacityWeight: 10 };
    const next = characterReducer(stateWith([basket, TORCH]), move(TORCH.id, basket.id));
    expect(next.inventory?.find(i => i.id === TORCH.id)?.containerId).toBe(basket.id);
  });
});
