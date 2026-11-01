/**
 * @file InventoryList.encumbrance.test.tsx
 * Proof for agora-bf91 (GG-459 / GG-6): the backpack header now surfaces the
 * character's carrying capacity and 5e variant-encumbrance tier, computed by
 * REUSING the tested carrying-capacity helper (getCharacterEncumbrance) rather
 * than a second, divergent capacity formula.
 *
 * The default mock character is Medium with Strength 10, so carrying capacity is
 * 10 × 15 = 150 lbs and the variant thresholds are light 50 / medium 100 /
 * heavy 150. A Powerful Build character must read as one size larger (capacity
 * 300), which only the shared helper knows — that is the reuse assertion.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import InventoryList from '../InventoryList';
import { createMockPlayerCharacter } from '../../../../utils/core';
import { ItemType, Item, ItemContainer, PlayerCharacter } from '../../../../types';

/** A single stack of gear whose weight drives the encumbrance tier. */
const weightedGear = (weightLbs: number): Item =>
  ({
    id: `gear-${weightLbs}`,
    name: 'Packed Gear',
    type: ItemType.LightSource,
    description: 'A heavy bundle used only to exercise the weight total.',
    weight: weightLbs,
  }) as Item;

const renderList = (weightLbs: number, character: PlayerCharacter) =>
  render(
    <InventoryList
      inventory={[weightedGear(weightLbs)]}
      gold={0}
      character={character}
      onAction={() => {}}
      filterBySlot={null}
    />,
  );

const summary = () => screen.getByTestId('inventory-encumbrance');

describe('InventoryList encumbrance display (agora-bf91)', () => {
  it('shows the base carrying capacity and an unencumbered tier under the light threshold', () => {
    renderList(20, createMockPlayerCharacter());
    expect(summary().textContent).toContain('150');
    expect(screen.getByText('Unencumbered')).toBeInTheDocument();
  });

  it.each([
    [60, 'Light encumbered'],
    [120, 'Medium encumbered'],
    [160, 'Heavy encumbered'],
  ])('classifies %i lbs as %s', (weightLbs, label) => {
    renderList(weightLbs, createMockPlayerCharacter());
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('honors Powerful Build through the shared helper (capacity doubles to 300), not a duplicate formula', () => {
    const powerful = createMockPlayerCharacter({
      modifiers: { powerfulBuild: true },
    } as Partial<PlayerCharacter>);
    renderList(20, powerful);
    // 150 would mean a second, trait-blind calculation; 300 proves reuse.
    expect(summary().textContent).toContain('300');
    expect(summary().textContent).not.toMatch(/\b150\b/);
  });

  it('counts each stacked unit and updates burden when quantity falls', () => {
    const character = createMockPlayerCharacter();
    const stack = { ...weightedGear(20), quantity: 3 };
    const props = { gold: 0, character, onAction: () => {}, filterBySlot: null };
    const view = render(<InventoryList {...props} inventory={[stack]} />);
    expect(summary()).toHaveTextContent('60.00');
    expect(screen.getByText('Light encumbered')).toBeInTheDocument();
    view.rerender(<InventoryList {...props} inventory={[{ ...stack, quantity: 2 }]} />);
    expect(summary()).toHaveTextContent('40.00');
    expect(screen.getByText('Unencumbered')).toBeInTheDocument();
    expect(stack.quantity).toBe(3);
  });

  it('counts nested stacked contents once in the header and all units against container capacity', () => {
    const bag: ItemContainer = { ...weightedGear(2), id: 'bag', name: 'Bag', isContainer: true, capacityWeight: 10 };
    const supplies = { ...weightedGear(2), id: 'supply-stack', quantity: 6, containerId: 'bag' };
    render(<InventoryList inventory={[bag, supplies]} gold={0} character={createMockPlayerCharacter()} onAction={() => {}} filterBySlot={null} />);
    expect(summary()).toHaveTextContent('14.00');
    expect(screen.getByText('Weight: 12.00 / 10')).toHaveClass('text-red-300');
    expect(supplies).toMatchObject({ quantity: 6, containerId: 'bag' });
  });
});
