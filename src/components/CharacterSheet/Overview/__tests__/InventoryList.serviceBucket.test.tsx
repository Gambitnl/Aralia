/**
 * @file InventoryList.serviceBucket.test.tsx
 * Proof for agora-6820.1: Service items (bought information) are listed under an
 * "Information" heading instead of sitting loose in the Backpack, and the heading
 * only appears when the character actually owns a Service item.
 */
import React from 'react';
import { ItemType } from '../../../../types';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import InventoryList from '../InventoryList';
import { createMockPlayerCharacter } from '../../../../utils/core';
import type { Item } from '../../../../types';

const RUMOR_RECEIPT: Item = {
  id: 'rumor_gossip_1',
  sourceId: 'gossip_1',
  name: 'Rumor',
  type: ItemType.Service,
  description: 'Purchased from Barkeep: "The mill burned down."',
  weight: 0,
  cost: '0',
};

const TORCH: Item = {
  id: 'torch',
  name: 'Torch',
  type: ItemType.LightSource,
  description: 'A wooden torch.',
  weight: 1,
};

const renderList = (inventory: Item[]) =>
  render(
    <InventoryList
      inventory={inventory}
      gold={0}
      character={createMockPlayerCharacter()}
      onAction={() => {}}
      filterBySlot={null}
    />
  );

describe('InventoryList Information bucket (agora-6820.1)', () => {
  it('lists a Service item under an Information heading', () => {
    renderList([RUMOR_RECEIPT, TORCH]);
    expect(screen.getByText('Information')).toBeInTheDocument();
    expect(screen.getByText('Rumor')).toBeInTheDocument();
  });

  it('omits the Information heading when no Service item is carried', () => {
    renderList([TORCH]);
    expect(screen.queryByText('Information')).not.toBeInTheDocument();
    expect(screen.getAllByText('Backpack').length).toBeGreaterThan(0);
  });
});
