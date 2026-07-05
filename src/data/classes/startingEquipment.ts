/**
 * @file src/data/classes/startingEquipment.ts
 * 2024 Player's Handbook class starting-equipment packages (the "Option A" gear
 * bundle each class begins with, rather than the roll-for-gold alternative).
 *
 * Each entry lists item ids (resolved against ALL_ITEMS by buildStartingLoadout),
 * their quantities, and whether the item should start EQUIPPED. Exactly one melee/
 * ranged weapon and, where relevant, one body armor + one shield are marked
 * `equip: true` so a fresh character walks out of creation ready to fight rather
 * than naked at AC 10.
 *
 * `gold` is the coin the package includes on top of the gear.
 *
 * Item ids must exist in ALL_ITEMS (weapons in WEAPONS_DATA, armor/gear in
 * data/items). buildStartingLoadout warns in dev if one fails to resolve.
 */

export interface StartingEquipmentEntry {
  id: string;
  quantity?: number;
  /** Start this item equipped (armor → its slot, weapon → MainHand). */
  equip?: boolean;
}

export interface ClassStartingEquipment {
  items: StartingEquipmentEntry[];
  /** Coin the package grants, in gold pieces. */
  gold: number;
}

export const CLASS_STARTING_EQUIPMENT: Record<string, ClassStartingEquipment> = {
  barbarian: {
    items: [
      { id: 'greataxe', equip: true },
      { id: 'handaxe', quantity: 4 },
      { id: 'explorers_pack' },
    ],
    gold: 15,
  },
  bard: {
    items: [
      { id: 'leather_armor', equip: true },
      { id: 'rapier', equip: true },
      { id: 'dagger', quantity: 2 },
      { id: 'musical_instrument' },
      { id: 'entertainers_pack' },
    ],
    gold: 19,
  },
  cleric: {
    items: [
      { id: 'chain_shirt', equip: true },
      { id: 'shield_std', equip: true },
      { id: 'mace', equip: true },
      { id: 'holy_symbol' },
      { id: 'priests_pack' },
    ],
    gold: 7,
  },
  druid: {
    items: [
      { id: 'leather_armor', equip: true },
      { id: 'shield_std', equip: true },
      { id: 'sickle', equip: true },
      { id: 'quarterstaff' },
      { id: 'druidic_focus' },
      { id: 'herbalism_kit' },
      { id: 'explorers_pack' },
    ],
    gold: 9,
  },
  fighter: {
    items: [
      { id: 'chain_mail', equip: true },
      { id: 'greatsword', equip: true },
      { id: 'flail' },
      { id: 'javelin', quantity: 8 },
      { id: 'dungeoneers_pack' },
    ],
    gold: 4,
  },
  monk: {
    // No armor — Unarmored Defense (10 + Dex + Wis).
    items: [
      { id: 'spear', equip: true },
      { id: 'dagger', quantity: 5 },
      { id: 'explorers_pack' },
    ],
    gold: 11,
  },
  paladin: {
    items: [
      { id: 'chain_mail', equip: true },
      { id: 'shield_std', equip: true },
      { id: 'longsword', equip: true },
      { id: 'javelin', quantity: 6 },
      { id: 'holy_symbol' },
      { id: 'priests_pack' },
    ],
    gold: 9,
  },
  ranger: {
    items: [
      { id: 'studded_leather_armor', equip: true },
      { id: 'scimitar', equip: true },
      { id: 'shortsword' },
      { id: 'longbow' },
      { id: 'arrows', quantity: 20 },
      { id: 'explorers_pack' },
    ],
    gold: 7,
  },
  rogue: {
    items: [
      { id: 'leather_armor', equip: true },
      { id: 'shortsword', equip: true },
      { id: 'shortbow' },
      { id: 'arrows', quantity: 20 },
      { id: 'dagger', quantity: 2 },
      { id: 'thieves-tools' },
      { id: 'burglars_pack' },
    ],
    gold: 8,
  },
  sorcerer: {
    // No armor — sorcerers gain none from their class.
    items: [
      { id: 'spear', equip: true },
      { id: 'dagger', quantity: 2 },
      { id: 'arcane_focus' },
      { id: 'dungeoneers_pack' },
    ],
    gold: 28,
  },
  warlock: {
    items: [
      { id: 'leather_armor', equip: true },
      { id: 'sickle', equip: true },
      { id: 'dagger', quantity: 2 },
      { id: 'arcane_focus' },
      { id: 'scholars_pack' },
    ],
    gold: 15,
  },
  wizard: {
    // No armor — wizards gain none from their class.
    items: [
      { id: 'quarterstaff', equip: true },
      { id: 'dagger' },
      { id: 'arcane_focus' },
      { id: 'spellbook' },
      { id: 'scholars_pack' },
    ],
    gold: 5,
  },
  artificer: {
    items: [
      { id: 'leather_armor', equip: true },
      { id: 'light_crossbow', equip: true },
      { id: 'crossbow_bolts', quantity: 20 },
      { id: 'dagger' },
      { id: 'thieves-tools' },
      { id: 'dungeoneers_pack' },
    ],
    gold: 15,
  },
};
