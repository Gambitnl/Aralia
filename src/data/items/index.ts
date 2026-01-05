
/**
 * @file src/data/items/index.ts
 * Defines all item data (gear, consumables, etc.) for the Aralia RPG.
 */
import { Item } from '../../types';

export const WEAPONS_DATA: Record<string, Item> = {
  // --- Simple Melee Weapons ---
  'club': { id: 'club', name: 'Club', icon: '🪵', description: 'A simple wooden club.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d4', damageType: 'Bludgeoning', properties: ['Light'], weight: 2, cost: '1 SP', mastery: 'Slow' },
  'dagger': { id: 'dagger', name: 'Dagger', icon: '🗡️', description: 'A standard dagger.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d4', damageType: 'Piercing', properties: ['Finesse', 'Light', 'Thrown'], weight: 1, cost: '2 GP', mastery: 'Nick' },
  'greatclub': { id: 'greatclub', name: 'Greatclub', icon: '🪵', description: 'A heavy, two-handed club.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d8', damageType: 'Bludgeoning', properties: ['Two-Handed'], weight: 10, cost: '2 SP', mastery: 'Push' },
  'handaxe': { id: 'handaxe', name: 'Handaxe', icon: '🪓', description: 'A small axe that can be wielded with one hand or thrown.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d6', damageType: 'Slashing', properties: ['Light', 'Thrown'], weight: 2, cost: '5 GP', mastery: 'Vex' },
  'javelin': { id: 'javelin', name: 'Javelin', icon: '➹', description: 'A light spear designed to be thrown.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d6', damageType: 'Piercing', properties: ['Thrown'], weight: 2, cost: '5 SP', mastery: 'Slow' },
  'light_hammer': { id: 'light_hammer', name: 'Light Hammer', icon: '🔨', description: 'A small hammer that can be used as a melee weapon or thrown.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d4', damageType: 'Bludgeoning', properties: ['Light', 'Thrown'], weight: 2, cost: '2 GP', mastery: 'Nick' },
  'mace': { id: 'mace', name: 'Mace', icon: '🔨', description: 'A blunt weapon with a heavy head.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d6', damageType: 'Bludgeoning', properties: [], weight: 4, cost: '5 GP', mastery: 'Sap' },
  'quarterstaff': { id: 'quarterstaff', name: 'Quarterstaff', icon: ' Staff', description: 'A long staff of wood.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d6', damageType: 'Bludgeoning', properties: ['Versatile'], weight: 4, cost: '2 SP', mastery: 'Topple' },
  'sickle': { id: 'sickle', name: 'Sickle', icon: '낫', description: 'A curved blade used as a tool or weapon.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d4', damageType: 'Slashing', properties: ['Light'], weight: 2, cost: '1 GP', mastery: 'Nick' },
  'spear': { id: 'spear', name: 'Spear', icon: '⚰', description: 'A long weapon with a pointed tip.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d6', damageType: 'Piercing', properties: ['Thrown', 'Versatile'], weight: 3, cost: '1 GP', mastery: 'Sap' },

  // --- Simple Ranged Weapons ---
  // REVIEW Q20: After removing isMartial flag, all weapons now rely solely on `category` field.
  // Should we validate that all entries have a valid category? Missing categories would default to Simple.
  // ANSWER: Good practice. Consider adding a build-time validation script to catch data issues.
  'dart': { id: 'dart', name: 'Dart', icon: '🎯', description: 'A small, pointed missile.', type: 'weapon', category: 'Simple Ranged', slot: 'MainHand', damageDice: '1d4', damageType: 'Piercing', properties: ['Finesse', 'Thrown'], weight: 0.25, cost: '5 CP', mastery: 'Vex' },
  'light_crossbow': { id: 'light_crossbow', name: 'Light Crossbow', icon: '🏹', description: 'A lighter, easier-to-load crossbow.', type: 'weapon', category: 'Simple Ranged', slot: 'MainHand', damageDice: '1d8', damageType: 'Piercing', properties: ['Ammunition', 'Loading', 'Two-Handed'], weight: 5, cost: '25 GP', mastery: 'Slow' },
  'shortbow': { id: 'shortbow', name: 'Shortbow', icon: '🏹', description: 'A small bow.', type: 'weapon', category: 'Simple Ranged', slot: 'MainHand', damageDice: '1d6', damageType: 'Piercing', properties: ['Ammunition', 'Two-Handed'], weight: 2, cost: '25 GP', mastery: 'Vex' },
  'sling': { id: 'sling', name: 'Sling', icon: '🪢', description: 'A leather strap for hurling stones.', type: 'weapon', category: 'Simple Ranged', slot: 'MainHand', damageDice: '1d4', damageType: 'Bludgeoning', properties: ['Ammunition'], weight: 0, cost: '1 SP', mastery: 'Slow' },

  // --- Martial Melee Weapons ---
  'battleaxe': { id: 'battleaxe', name: 'Battleaxe', icon: '🪓', description: 'A versatile axe.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d8', damageType: 'Slashing', properties: ['Versatile'], weight: 4, cost: '10 GP', mastery: 'Topple' },
  'flail': { id: 'flail', name: 'Flail', icon: '⛓️', description: 'A striking head attached to a handle by a flexible chain.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d8', damageType: 'Bludgeoning', properties: [], weight: 2, cost: '10 GP', mastery: 'Sap' },
  'glaive': { id: 'glaive', name: 'Glaive', icon: '⚰', description: 'A long pole weapon with a blade on the end.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d10', damageType: 'Slashing', properties: ['Heavy', 'Reach', 'Two-Handed'], weight: 6, cost: '20 GP', mastery: 'Graze' },
  'greataxe': { id: 'greataxe', name: 'Greataxe', icon: '🪓', description: 'A large, two-handed axe.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d12', damageType: 'Slashing', properties: ['Heavy', 'Two-Handed'], weight: 7, cost: '30 GP', mastery: 'Cleave' },
  'greatsword': { id: 'greatsword', name: 'Greatsword', icon: '🗡️', description: 'A large, two-handed sword.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '2d6', damageType: 'Slashing', properties: ['Heavy', 'Two-Handed'], weight: 6, cost: '50 GP', mastery: 'Graze' },
  'halberd': { id: 'halberd', name: 'Halberd', icon: '⚰', description: 'An axe blade topped with a spike mounted on a long shaft.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d10', damageType: 'Slashing', properties: ['Heavy', 'Reach', 'Two-Handed'], weight: 6, cost: '20 GP', mastery: 'Cleave' },
  'lance': { id: 'lance', name: 'Lance', icon: '⚰', description: 'A long weapon for use on horseback.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d12', damageType: 'Piercing', properties: ['Reach', 'Special'], weight: 6, cost: '10 GP', mastery: 'Topple' },
  'longsword': { id: 'longsword', name: 'Longsword', icon: '🗡️', description: 'A classic versatile sword.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d8', damageType: 'Slashing', properties: ['Versatile'], weight: 3, cost: '15 GP', mastery: 'Sap' },
  'maul': { id: 'maul', name: 'Maul', icon: '🔨', description: 'A massive two-handed hammer.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '2d6', damageType: 'Bludgeoning', properties: ['Heavy', 'Two-Handed'], weight: 10, cost: '10 GP', mastery: 'Topple' },
  'morningstar': { id: 'morningstar', name: 'Morningstar', icon: '⭐', description: 'A spiked club.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d8', damageType: 'Piercing', properties: [], weight: 4, cost: '15 GP', mastery: 'Sap' },
  'pike': { id: 'pike', name: 'Pike', icon: '⚰', description: 'A very long spear.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d10', damageType: 'Piercing', properties: ['Heavy', 'Reach', 'Two-Handed'], weight: 18, cost: '5 GP', mastery: 'Push' },
  'rapier': { id: 'rapier', name: 'Rapier', icon: '🗡️', description: 'A thin, sharp-pointed sword.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d8', damageType: 'Piercing', properties: ['Finesse'], weight: 2, cost: '25 GP', mastery: 'Vex' },
  'scimitar': { id: 'scimitar', name: 'Scimitar', icon: '🗡️', description: 'A short, curved sword.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d6', damageType: 'Slashing', properties: ['Finesse', 'Light'], weight: 3, cost: '25 GP', mastery: 'Nick' },
  'shortsword': { id: 'shortsword', name: 'Shortsword', icon: '🗡️', description: 'A light, double-edged sword.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d6', damageType: 'Piercing', properties: ['Finesse', 'Light'], weight: 2, cost: '10 GP', mastery: 'Vex' },
  'trident': { id: 'trident', name: 'Trident', icon: '🔱', description: 'A three-pronged spear.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d6', damageType: 'Piercing', properties: ['Thrown', 'Versatile'], weight: 4, cost: '5 GP', mastery: 'Topple' },
  'warhammer': { id: 'warhammer', name: 'Warhammer', icon: '🔨', description: 'A versatile war hammer.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d8', damageType: 'Bludgeoning', properties: ['Versatile'], weight: 2, cost: '15 GP', mastery: 'Push' },
  'war_pick': { id: 'war_pick', name: 'War Pick', icon: '⛏️', description: 'A pointed weapon for piercing armor.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d8', damageType: 'Piercing', properties: [], weight: 2, cost: '5 GP', mastery: 'Sap' },
  'whip': { id: 'whip', name: 'Whip', icon: '〰️', description: 'A long, flexible whip.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: '1d4', damageType: 'Slashing', properties: ['Finesse', 'Reach'], weight: 3, cost: '2 GP', mastery: 'Slow' },

  // --- Martial Ranged Weapons ---
  'blowgun': { id: 'blowgun', name: 'Blowgun', icon: '🪈', description: 'A long tube for firing darts.', type: 'weapon', category: 'Martial Ranged', slot: 'MainHand', damageDice: '1', damageType: 'Piercing', properties: ['Ammunition', 'Loading'], weight: 1, cost: '10 GP', mastery: 'Vex' },
  'longbow': { id: 'longbow', name: 'Longbow', icon: '🏹', description: 'A large, powerful bow.', type: 'weapon', category: 'Martial Ranged', slot: 'MainHand', damageDice: '1d8', damageType: 'Piercing', properties: ['Ammunition', 'Heavy', 'Two-Handed'], weight: 2, cost: '50 GP', mastery: 'Slow' },
  'hand_crossbow': { id: 'hand_crossbow', name: 'Hand Crossbow', icon: '🏹', description: 'A crossbow small enough to be used with one hand.', type: 'weapon', category: 'Martial Ranged', slot: 'MainHand', damageDice: '1d6', damageType: 'Piercing', properties: ['Ammunition', 'Light', 'Loading'], weight: 3, cost: '75 GP', mastery: 'Vex' },
  'heavy_crossbow': { id: 'heavy_crossbow', name: 'Heavy Crossbow', icon: '🏹', description: 'A powerful, heavy crossbow.', type: 'weapon', category: 'Martial Ranged', slot: 'MainHand', damageDice: '1d10', damageType: 'Piercing', properties: ['Ammunition', 'Heavy', 'Loading', 'Two-Handed'], weight: 18, cost: '50 GP', mastery: 'Push' },

  // --- Legacy "Rusty Sword" as a Scimitar for consistency ---
  'rusty_sword': {
    id: 'rusty_sword', name: 'Rusty Sword', icon: '🗡️', description: 'One-Handed. An old, pitted scimitar. It has seen better days.', type: 'weapon', category: 'Martial Melee', slot: 'MainHand', damageDice: "1d6", damageType: "Slashing", properties: ['Finesse', 'Light'], weight: 3, cost: "25 GP", mastery: 'Nick'
  },
};

export const ITEMS: Record<string, Item> = {
  // --- Consumables & Other Items ---
  'healing_potion': {
    id: 'healing_potion', name: 'Healing Potion', icon: '🧪', description: 'A vial of glowing red liquid. Looks restorative.', type: 'consumable', effect: { type: 'heal', value: 25, dice: '4d4+4' }, weight: 0.5, cost: "50 GP"
  },
  'old_map_fragment': {
    id: 'old_map_fragment', name: 'Old Map Fragment', icon: '📜', description: 'A piece of parchment with faded markings. It seems to show a path leading east.', type: 'note', weight: 0.1,
  },
  'shiny_coin': {
    id: 'shiny_coin', name: 'Shiny Coin', icon: '🪙', description: 'A gold coin, surprisingly clean.', type: 'treasure', weight: 0.02, cost: "1 GP"
  },

  // --- Light Sources ---
  'torch': { id: 'torch', name: 'Torch', icon: '🔥', description: 'A wooden torch wrapped in cloth and pitch. Burns for 1 hour, providing bright light for 20 feet and dim light for another 20 feet.', type: 'consumable', weight: 1, cost: '1 CP' },
  // TODO(preserve-lint): confirm whether lanterns should be consumable (fuel) or a dedicated light_source type.
  'hooded_lantern': { id: 'hooded_lantern', name: 'Hooded Lantern', icon: '🏮', description: 'A metal lantern with shutters. Burns oil for 6 hours. Can be shuttered to reduce light.', type: 'light_source', weight: 2, cost: '5 GP' },
  'oil_flask': { id: 'oil_flask', name: 'Oil (flask)', icon: '🍶', description: 'A flask of oil. Can be used to fuel a lantern or as a weapon.', type: 'consumable', weight: 1, cost: '1 SP' },

  // --- Tools ---
  'thieves-tools': { id: 'thieves-tools', name: "Thieves' Tools", icon: '🔓', description: 'A set of lock picks, a small file, a mirror on a handle, scissors, and pliers. Used for picking locks and disarming traps.', type: 'tool', weight: 1, cost: '25 GP' },

  // --- Coins ---
  'platinum_piece': { id: 'platinum_piece', name: 'Platinum Piece', icon: '🪙', description: 'A heavy, shimmering platinum coin. Worth 10 GP.', type: 'treasure', weight: 0.02, cost: '1 PP', costInGp: 10 },
  'gold_piece': { id: 'gold_piece', name: 'Gold Piece', icon: '🪙', description: 'A standard gold coin.', type: 'treasure', weight: 0.02, cost: '1 GP', costInGp: 1 },
  'electrum_piece': { id: 'electrum_piece', name: 'Electrum Piece', icon: '🪙', description: 'A coin made of an electrum alloy. Worth 5 SP.', type: 'treasure', weight: 0.02, cost: '1 EP', costInGp: 0.5 },
  'silver_piece': { id: 'silver_piece', name: 'Silver Piece', icon: '🪙', description: 'A standard silver coin. Worth 1/10th of a GP.', type: 'treasure', weight: 0.02, cost: '1 SP', costInGp: 0.1 },
  'copper_piece': { id: 'copper_piece', name: 'Copper Piece', icon: '🪙', description: 'A standard copper coin. Worth 1/100th of a GP.', type: 'treasure', weight: 0.02, cost: '1 CP', costInGp: 0.01 },

  // --- Spell Components ---
  'lodestone_pair': { id: 'lodestone_pair', name: 'Lodestone Pair', icon: '🧲', description: 'Two small, naturally magnetic stones.', type: 'spell_component', weight: 0.2, cost: "1 SP" },
  'diamond_300gp': { id: 'diamond_300gp', name: 'Diamond (300 GP)', icon: '💎', description: 'A large, clear diamond.', type: 'spell_component', weight: 0.1, cost: "300 GP", costInGp: 300, isConsumed: true, substitutable: false },

  // --- Armor: Head ---
  'leather_cap': { id: 'leather_cap', name: 'Leather Cap', icon: '🎓', description: 'A simple leather cap.', type: 'armor', slot: 'Head', armorCategory: 'Light', baseArmorClass: 0, weight: 1, cost: '2 GP' },
  'chainmail_coif': { id: 'chainmail_coif', name: 'Chainmail Coif', icon: '⛓️', description: 'A hood of interlocking metal rings.', type: 'armor', slot: 'Head', armorCategory: 'Medium', baseArmorClass: 0, weight: 3, cost: '15 GP' },
  'steel_helmet': { id: 'steel_helmet', name: 'Steel Helmet', icon: '⛑️', description: 'A solid steel helmet.', type: 'armor', slot: 'Head', armorCategory: 'Heavy', baseArmorClass: 0, weight: 5, cost: '30 GP' },

  // --- Armor: Hands ---
  'leather_gloves': { id: 'leather_gloves', name: 'Leather Gloves', icon: '🧤', description: 'Supple leather gloves.', type: 'armor', slot: 'Hands', armorCategory: 'Light', baseArmorClass: 0, weight: 0.5, cost: '1 GP' },
  'chainmail_gauntlets': { id: 'chainmail_gauntlets', name: 'Chainmail Gauntlets', icon: '🥊', description: 'Metal mesh gloves.', type: 'armor', slot: 'Hands', armorCategory: 'Medium', baseArmorClass: 0, weight: 2, cost: '10 GP' },
  'plate_gauntlets': { id: 'plate_gauntlets', name: 'Plate Gauntlets', icon: '🥊', description: 'Heavy plated gloves.', type: 'armor', slot: 'Hands', armorCategory: 'Heavy', baseArmorClass: 0, weight: 4, cost: '50 GP' },

  // --- Armor: Legs ---
  'cloth_pants': { id: 'cloth_pants', name: 'Cloth Pants', icon: '👖', description: 'Simple cloth trousers.', type: 'armor', slot: 'Legs', armorCategory: 'Light', baseArmorClass: 0, weight: 2, cost: '5 SP' },
  'leather_greaves': { id: 'leather_greaves', name: 'Leather Greaves', icon: '🦵', description: 'Leather leg protection.', type: 'armor', slot: 'Legs', armorCategory: 'Medium', baseArmorClass: 0, weight: 4, cost: '15 GP' },
  'plate_greaves': { id: 'plate_greaves', name: 'Plate Greaves', icon: '🦵', description: 'Full plate leg armor.', type: 'armor', slot: 'Legs', armorCategory: 'Heavy', baseArmorClass: 0, weight: 8, cost: '75 GP' },

  // --- Armor: Feet ---
  'soft_boots': { id: 'soft_boots', name: 'Soft Boots', icon: '👢', description: 'Comfortable leather boots.', type: 'armor', slot: 'Feet', armorCategory: 'Light', baseArmorClass: 0, weight: 1, cost: '2 GP' },
  'studded_boots': { id: 'studded_boots', name: 'Studded Boots', icon: '🥾', description: 'Reinforced leather boots.', type: 'armor', slot: 'Feet', armorCategory: 'Medium', baseArmorClass: 0, weight: 3, cost: '12 GP' },
  'steel_boots': { id: 'steel_boots', name: 'Steel Boots', icon: '🥾', description: 'Heavy metal boots.', type: 'armor', slot: 'Feet', armorCategory: 'Heavy', baseArmorClass: 0, weight: 6, cost: '40 GP' },

  // --- Armor: Wrists ---
  'leather_bracers': { id: 'leather_bracers', name: 'Leather Bracers', icon: '💪', description: 'Protective leather wrist guards.', type: 'armor', slot: 'Wrists', armorCategory: 'Light', baseArmorClass: 0, weight: 0.5, cost: '3 GP' },
  'reinforced_bracers': { id: 'reinforced_bracers', name: 'Reinforced Bracers', icon: '💪', description: 'Metal-studded bracers.', type: 'armor', slot: 'Wrists', armorCategory: 'Medium', baseArmorClass: 0, weight: 2, cost: '15 GP' },

  // --- Accessories: Neck ---
  'silver_necklace': { id: 'silver_necklace', name: 'Silver Necklace', icon: '📿', description: 'A simple silver chain.', type: 'accessory', slot: 'Neck', weight: 0.1, cost: '10 GP' },
  'amulet_of_health': { id: 'amulet_of_health', name: 'Amulet of Health', icon: '🔮', description: 'A magical amulet that grants vitality. (Placeholder)', type: 'accessory', slot: 'Neck', weight: 0.2, cost: '500 GP' },

  // --- Accessories: Cloak ---
  'travelers_cloak': { id: 'travelers_cloak', name: "Traveler's Cloak", icon: '🧥', description: 'A warm, weatherproof cloak.', type: 'accessory', slot: 'Cloak', weight: 3, cost: '5 GP' },
  'cloak_of_protection': { id: 'cloak_of_protection', name: 'Cloak of Protection', icon: '✨', description: 'A magical cloak that wards against harm. (Placeholder)', type: 'accessory', slot: 'Cloak', weight: 2, cost: '1000 GP' },

  // --- Accessories: Belt ---
  'leather_belt': { id: 'leather_belt', name: 'Leather Belt', icon: '🔗', description: 'A sturdy leather belt.', type: 'accessory', slot: 'Belt', weight: 0.5, cost: '1 GP' },
  'belt_of_giant_strength': { id: 'belt_of_giant_strength', name: 'Belt of Giant Strength', icon: '💪', description: 'A magical belt that enhances strength. (Placeholder)', type: 'accessory', slot: 'Belt', weight: 1, cost: '2000 GP' },

  // --- Accessories: Rings ---
  // REVIEW Q21: Lint shows 'Ring' is not assignable to EquipmentSlotType.
  // But 'Ring' IS in the type definition (line 222 of types/index.ts).
  // This might be a TypeScript server caching issue. Try restarting TS server.
  // If it persists, check if Item interface correctly references EquipmentSlotType for slot field.
  // ANSWER: Needs investigation - the type definition appears correct but TS doesn't recognize it.
  'silver_ring': { id: 'silver_ring', name: 'Silver Ring', icon: '💍', description: 'A plain silver band.', type: 'accessory', slot: 'Ring', weight: 0.01, cost: '5 GP' },
  'gold_ring': { id: 'gold_ring', name: 'Gold Ring', icon: '💍', description: 'A polished gold ring.', type: 'accessory', slot: 'Ring', weight: 0.01, cost: '25 GP' },
  'ring_of_protection': { id: 'ring_of_protection', name: 'Ring of Protection', icon: '✨', description: 'A magical ring that provides protection. (Placeholder)', type: 'accessory', slot: 'Ring', weight: 0.01, cost: '1500 GP' },

  // Armor and Shield (Torso)
  'padded_armor': { id: 'padded_armor', name: 'Padded Armor', icon: '🧥', description: 'Quilted layers of cloth and batting.', type: 'armor', slot: 'Torso', armorCategory: 'Light', baseArmorClass: 11, addsDexterityModifier: true, stealthDisadvantage: true, weight: 8, cost: '5 GP' },
  'leather_armor': { id: 'leather_armor', name: 'Leather Armor', icon: '👕', description: 'Stiffened leather plates.', type: 'armor', slot: 'Torso', armorCategory: 'Light', baseArmorClass: 11, addsDexterityModifier: true, weight: 10, cost: '10 GP' },
  'studded_leather_armor': { id: 'studded_leather_armor', name: 'Studded Leather Armor', icon: '👘', description: 'Leather reinforced with rivets.', type: 'armor', slot: 'Torso', armorCategory: 'Light', baseArmorClass: 12, addsDexterityModifier: true, weight: 13, cost: '45 GP' },
  'hide_armor': { id: 'hide_armor', name: 'Hide Armor', icon: '👚', description: 'Thick furs and pelts.', type: 'armor', slot: 'Torso', armorCategory: 'Medium', baseArmorClass: 12, addsDexterityModifier: true, maxDexterityBonus: 2, weight: 12, cost: '10 GP' },
  'chain_shirt': { id: 'chain_shirt', name: 'Chain Shirt', icon: '⛓️', description: 'Interlocking metal rings.', type: 'armor', slot: 'Torso', armorCategory: 'Medium', baseArmorClass: 13, addsDexterityModifier: true, maxDexterityBonus: 2, weight: 20, cost: '50 GP' },
  'scale_mail': { id: 'scale_mail', name: 'Scale Mail', icon: '🛡️', description: 'Overlapping metal scales.', type: 'armor', slot: 'Torso', armorCategory: 'Medium', baseArmorClass: 14, addsDexterityModifier: true, maxDexterityBonus: 2, stealthDisadvantage: true, weight: 45, cost: '50 GP' },
  'breastplate': { id: 'breastplate', name: 'Breastplate', icon: '🛡️', description: 'Fitted metal chest piece.', type: 'armor', slot: 'Torso', armorCategory: 'Medium', baseArmorClass: 14, addsDexterityModifier: true, maxDexterityBonus: 2, weight: 20, cost: '400 GP' },
  'half_plate_armor': { id: 'half_plate_armor', name: 'Half Plate Armor', icon: '🛡️', description: 'Shaped metal plates.', type: 'armor', slot: 'Torso', armorCategory: 'Medium', baseArmorClass: 15, addsDexterityModifier: true, maxDexterityBonus: 2, stealthDisadvantage: true, weight: 40, cost: '750 GP' },
  'ring_mail': { id: 'ring_mail', name: 'Ring Mail', icon: '🛡️', description: 'Leather with heavy rings sewn in.', type: 'armor', slot: 'Torso', armorCategory: 'Heavy', baseArmorClass: 14, addsDexterityModifier: false, stealthDisadvantage: true, weight: 40, cost: '30 GP' },
  'chain_mail': { id: 'chain_mail', name: 'Chain Mail', icon: '⛓️', description: 'Interlocking metal rings, full suit.', type: 'armor', slot: 'Torso', armorCategory: 'Heavy', baseArmorClass: 16, addsDexterityModifier: false, strengthRequirement: 13, stealthDisadvantage: true, weight: 55, cost: '75 GP' },
  'splint_armor': { id: 'splint_armor', name: 'Splint Armor', icon: '🛡️', description: 'Vertical metal strips.', type: 'armor', slot: 'Torso', armorCategory: 'Heavy', baseArmorClass: 17, addsDexterityModifier: false, strengthRequirement: 15, stealthDisadvantage: true, weight: 60, cost: '200 GP' },
  'plate_armor': { id: 'plate_armor', name: 'Plate Armor', icon: '🛡️', description: 'Full interlocking metal plates.', type: 'armor', slot: 'Torso', armorCategory: 'Heavy', baseArmorClass: 18, addsDexterityModifier: false, strengthRequirement: 15, stealthDisadvantage: true, weight: 65, cost: '1,500 GP' },
  'shield_std': { id: 'shield_std', name: 'Shield', icon: '🛡️', description: 'A standard shield.', type: 'armor', slot: 'OffHand', armorCategory: 'Shield', armorClassBonus: 2, weight: 6, cost: '10 GP' },
};

// Import gatherable items and merge them
import { GATHERABLE_ITEMS } from '../gatherableItems';

// Combined ITEMS export including all gatherable ingredients
export const ALL_ITEMS: Record<string, Item> = {
  ...ITEMS,
  ...WEAPONS_DATA,
  ...GATHERABLE_ITEMS
};
