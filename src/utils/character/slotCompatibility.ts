/**
 * This file defines the shared equipment-slot compatibility rules (weapons vs. armor vs. shields).
 *
 * It extracts the paper-doll slot-acceptance table out of `EquipmentMannequin.tsx` into a pure,
 * React-free utility so that both the UI (`EquipmentMannequin`, `InventoryList`) and the state
 * reducer (`characterReducer` case `EQUIP_ITEM`) enforce the exact same body-part rules.
 *
 * Called by: `src/state/reducers/characterReducer.ts` (`EQUIP_ITEM`), `src/components/CharacterSheet/Overview/EquipmentMannequin.tsx`, and `src/components/CharacterSheet/Overview/InventoryList.tsx`.
 * Depends on: `EquipmentSlotType` and `Item` from `../../types`, and `isTwoHandedWeapon` from `./defense`.
 */

import { EquipmentSlotType, Item } from '../../types';
import { isTwoHandedWeapon } from './defense';

// ============================================================================
// Slot Kind Tables & Human-Readable Labels
// ============================================================================
// Mirrors the 13 slots of the character mannequin without pulling in React icon
// components, keeping reducer and headless callers free of UI dependencies.
// ============================================================================

/** Slots that can hold a wielded weapon. */
export const WEAPON_SLOTS: readonly EquipmentSlotType[] = ['MainHand', 'OffHand'];

/** Slots that wear body armor (helm, breastplate, bracers, greaves, gauntlets, boots). */
export const ARMOR_SLOTS: readonly EquipmentSlotType[] = [
  'Head',
  'Torso',
  'Wrists',
  'Legs',
  'Hands',
  'Feet',
];

/** Slots that can strap a shield. */
export const SHIELD_SLOTS: readonly EquipmentSlotType[] = ['OffHand'];

/** Human-readable slot labels used by rejection tooltips. */
const SLOT_LABELS: Partial<Record<EquipmentSlotType, string>> = {
  Head: 'Head',
  Neck: 'Neck',
  Torso: 'Torso',
  Cloak: 'Cloak',
  Belt: 'Belt',
  MainHand: 'Main Hand',
  OffHand: 'Off Hand',
  Wrists: 'Wrists',
  Legs: 'Legs',
  Hands: 'Hands',
  Ring1: 'Ring 1',
  Ring2: 'Ring 2',
  Feet: 'Feet',
};

// ============================================================================
// Slot Compatibility Rules (weapon vs armor)
// ============================================================================
// Validates that weapons only occupy hand slots (with two-handed weapons restricted
// to MainHand), shields only occupy OffHand, and body armor only occupies armor slots.
// Accessories and wondrous items remain permissive across slots.
// ============================================================================

/**
 * Whether `item` is allowed to occupy `slot` under the weapon/armor rules.
 *
 * Why this exists: `canEquipItem` (`utils/character/defense.ts`) validates
 * proficiency, level, and ability requirements, while `slotAcceptsItem` checks
 * that the item kind matches the slot kind so data-authored or test gear with a
 * mismatched `slot` (e.g. a weapon slotted to `Torso` or armor slotted to `MainHand`)
 * cannot land on the wrong body part in either the UI or `EQUIP_ITEM`.
 *
 * Preserved: non-weapon, non-armor kinds (accessories, wondrous items, anything
 * added later) return `true` here. This guard deliberately does not attempt to
 * police accessory placement, which has no settled rule yet.
 */
export const slotAcceptsItem = (slot: EquipmentSlotType, item: Item): boolean => {
  if (item.type === 'weapon') {
    if (isTwoHandedWeapon(item)) {
      return slot === 'MainHand';
    }
    return WEAPON_SLOTS.includes(slot);
  }
  if (item.type === 'armor') {
    // A shield is armor by type but is strapped, not worn: it belongs in the
    // off hand rather than in any of the body-armor slots.
    return item.armorCategory === 'Shield'
      ? SHIELD_SLOTS.includes(slot)
      : ARMOR_SLOTS.includes(slot);
  }
  return true;
};

/**
 * Human-readable reason a slot rejects an item, or `undefined` when it accepts.
 * Used for the disabled Equip button's tooltip so a player sees why a piece of
 * gear cannot go where its data claims.
 */
export const slotRejectionReason = (slot: EquipmentSlotType, item: Item): string | undefined => {
  if (slotAcceptsItem(slot, item)) return undefined;
  const label = SLOT_LABELS[slot] ?? slot;
  if (item.type === 'weapon') {
    if (isTwoHandedWeapon(item) && slot === 'OffHand') {
      return 'Two-handed weapons cannot be equipped in the off-hand.';
    }
    return `Weapons cannot be equipped in the ${label} slot.`;
  }
  if (item.armorCategory === 'Shield') return `A shield cannot be equipped in the ${label} slot.`;
  return `Armor cannot be equipped in the ${label} slot.`;
};
