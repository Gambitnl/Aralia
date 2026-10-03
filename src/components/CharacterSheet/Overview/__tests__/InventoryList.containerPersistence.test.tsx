/**
 * @file InventoryList.containerPersistence.test.tsx
 * Proof for agora-17eb: stowing an item is a game action that reaches the
 * reducer, and the sheet renders the assignment the reducer persisted on the
 * item rather than a local copy that dies with the component.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import InventoryList from '../InventoryList';
import { ItemType } from '../../../../types';
import type { Item } from '../../../../types';
import { createMockPlayerCharacter } from '../../../../utils/core';

const POUCH: Item = {
  id: 'pouch-instance-1',
  name: 'Belt Pouch',
  type: ItemType.Tool,
  description: 'A small leather pouch.',
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

const renderList = (inventory: Item[], onAction = vi.fn()) => {
  render(
    <InventoryList
      inventory={inventory}
      gold={0}
      character={createMockPlayerCharacter()}
      onAction={onAction}
      filterBySlot={null}
    />,
  );
  return onAction;
};

const torchSelect = () =>
  screen.getByLabelText('Move Torch to container') as HTMLSelectElement;

describe('InventoryList container persistence (agora-17eb)', () => {
  it('dispatches MOVE_ITEM_TO_CONTAINER naming the container item id', () => {
    const onAction = renderList([POUCH, TORCH]);

    fireEvent.change(torchSelect(), { target: { value: POUCH.id } });

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MOVE_ITEM_TO_CONTAINER',
        payload: { itemId: TORCH.id, containerId: POUCH.id },
      }),
    );
  });

  it('shows the assignment the reducer persisted on the item', () => {
    renderList([POUCH, { ...TORCH, containerId: POUCH.id }]);

    expect(torchSelect().value).toBe(POUCH.id);
  });

  it('sends null for the root backpack, which is a heading rather than an item', () => {
    const onAction = renderList([POUCH, { ...TORCH, containerId: POUCH.id }]);

    fireEvent.change(torchSelect(), { target: { value: 'root-backpack' } });

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MOVE_ITEM_TO_CONTAINER',
        payload: { itemId: TORCH.id, containerId: null },
      }),
    );
  });

  it('never offers a container as a home for itself', () => {
    renderList([POUCH, TORCH]);

    const pouchSelect = screen.getByLabelText(
      'Move Belt Pouch to container',
    ) as HTMLSelectElement;
    const selfOption = Array.from(pouchSelect.options).find(
      o => o.value === POUCH.id,
    );

    expect(selfOption?.disabled).toBe(true);
  });
});
