/**
 * @file InventoryList.equipSlots.test.tsx
 * Focused proof for UI-4 (agora-a95f.4): equip-slot validation in the backpack.
 *
 * Two rules, one describe block each:
 *  1. Slotless equippable items are handled the way the reducer would actually
 *     treat them (a slotless one-handed weapon is equippable; slotless armor and
 *     slotless two-handed weapons are not, and say why) and are surfaced only
 *     under a slot filter that could receive them.
 *  2. The equip action respects weapon vs armor slot rules: an item whose
 *     resolved target slot cannot hold its kind is blocked and filtered out,
 *     regardless of proficiency.
 */
import React from 'react';
import { ItemType } from '../../../../types';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
// Registers the jest-dom matcher types for the scoped typecheck; the runtime
// registration already happens in src/test/setup.ts.
import '@testing-library/jest-dom/vitest';
import InventoryList from '../InventoryList';
import { slotAcceptsItem, slotRejectionReason } from '../EquipmentMannequin';
import { createMockPlayerCharacter } from '../../../../utils/core';
import type { Item, PlayerCharacter } from '../../../../types';

/** Fighter with full martial/armor proficiency so proficiency never masks a slot-rule result. */
const makeCharacter = (overrides: Partial<PlayerCharacter> = {}): PlayerCharacter => {
  const character = createMockPlayerCharacter(overrides);
  character.class = {
    ...character.class,
    armorProficiencies: ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields'],
    weaponProficiencies: ['Simple Weapons', 'Martial Weapons'],
  };
  return character;
};

const item = (partial: Partial<Item> & Pick<Item, 'id' | 'name' | 'type'>): Item =>
  ({ description: `${partial.name} description`, weight: 1, ...partial } as Item);

const SLOTLESS_DAGGER = item({
  id: 'slotless-dagger',
  name: 'Slotless Dagger',
  type: ItemType.Weapon,
  damageDice: '1d4',
  properties: ['Finesse', 'Light'],
});

const SLOTLESS_BREASTPLATE = item({
  id: 'slotless-breastplate',
  name: 'Slotless Breastplate',
  type: ItemType.Armor,
  armorCategory: 'Medium',
  baseArmorClass: 14,
});

const MISSLOTTED_BREASTPLATE = item({
  id: 'misslotted-breastplate',
  name: 'Misslotted Breastplate',
  type: ItemType.Armor,
  slot: 'MainHand',
  armorCategory: 'Medium',
  baseArmorClass: 14,
});

const MISSLOTTED_GREATSWORD = item({
  id: 'misslotted-greatsword',
  name: 'Misslotted Greatsword',
  type: ItemType.Weapon,
  slot: 'Torso',
  damageDice: '2d6',
  properties: ['Two-Handed', 'Heavy'],
});

const TORSO_ARMOR = item({
  id: 'chain-shirt',
  name: 'Chain Shirt',
  type: ItemType.Armor,
  slot: 'Torso',
  armorCategory: 'Medium',
  baseArmorClass: 13,
});

const renderList = (inventory: Item[], filterBySlot?: Parameters<typeof slotAcceptsItem>[0] | null) =>
  render(
    <InventoryList
      inventory={inventory}
      gold={0}
      character={makeCharacter()}
      onAction={() => {}}
      filterBySlot={filterBySlot ?? null}
    />
  );

const equipButton = (name: string) => screen.queryByRole('button', { name: `Equip ${name}` });

describe('InventoryList slotless equippables (agora-a95f.4 rule 1)', () => {
  it('enables Equip for a slotless one-handed weapon, which the reducer routes to a free hand', () => {
    renderList([SLOTLESS_DAGGER]);
    const button = equipButton('Slotless Dagger');
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('blocks Equip for slotless armor, which the reducer would silently drop', () => {
    renderList([SLOTLESS_BREASTPLATE]);
    const button = equipButton('Slotless Breastplate');
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('surfaces a slotless weapon under a hand filter but not under an armor-slot filter', () => {
    const { unmount } = renderList([SLOTLESS_DAGGER], 'MainHand');
    expect(screen.getByText('Slotless Dagger')).toBeInTheDocument();
    unmount();

    renderList([SLOTLESS_DAGGER], 'Head');
    expect(screen.queryByText('Slotless Dagger')).not.toBeInTheDocument();
  });
});

describe('InventoryList weapon vs armor slot rules (agora-a95f.4 rule 2)', () => {
  it('blocks Equip for armor whose authored slot is a weapon slot', () => {
    renderList([MISSLOTTED_BREASTPLATE]);
    const button = equipButton('Misslotted Breastplate');
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('hides a Torso-slotted two-handed weapon from the Torso filter while keeping real Torso armor', () => {
    renderList([MISSLOTTED_GREATSWORD, TORSO_ARMOR], 'Torso');
    expect(screen.queryByText('Misslotted Greatsword')).not.toBeInTheDocument();
    expect(screen.getByText('Chain Shirt')).toBeInTheDocument();
  });

  it('states the slot rule table used by both the mannequin and the backpack', () => {
    expect(slotAcceptsItem('MainHand', SLOTLESS_DAGGER)).toBe(true);
    expect(slotAcceptsItem('Torso', SLOTLESS_DAGGER)).toBe(false);
    expect(slotAcceptsItem('Torso', TORSO_ARMOR)).toBe(true);
    expect(slotAcceptsItem('MainHand', TORSO_ARMOR)).toBe(false);
    // A shield is armor by type but belongs in the off hand, not a body slot.
    const shield = item({ id: 'shield', name: 'Shield', type: ItemType.Armor, slot: 'OffHand', armorCategory: 'Shield' });
    expect(slotAcceptsItem('OffHand', shield)).toBe(true);
    expect(slotAcceptsItem('Torso', shield)).toBe(false);
    // Accessories stay permissive: no settled placement rule to enforce yet.
    const amulet = item({ id: 'amulet', name: 'Amulet', type: ItemType.Accessory, slot: 'Neck' });
    expect(slotAcceptsItem('Neck', amulet)).toBe(true);
    expect(slotAcceptsItem('MainHand', amulet)).toBe(true);

    expect(slotRejectionReason('Torso', SLOTLESS_DAGGER)).toBe('Weapons cannot be equipped in the Torso slot.');
    expect(slotRejectionReason('MainHand', TORSO_ARMOR)).toBe('Armor cannot be equipped in the Main Hand slot.');
    expect(slotRejectionReason('MainHand', SLOTLESS_DAGGER)).toBeUndefined();
  });
});
