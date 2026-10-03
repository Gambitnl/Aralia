// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 19/06/2026, 00:48:21
 * Dependents: components/Crime/ThievesGuild/FenceInterface.tsx, components/puzzles/LockpickingModal.tsx, services/travelService.ts, systems/crafting/alchemySystem.ts, systems/crafting/craftingService.ts, systems/crime/BlackMarketSystem.ts, systems/puzzles/lockSystem.ts, systems/puzzles/mechanism.ts, systems/puzzles/pressurePlateSystem.ts, systems/spells/targeting/ObjectTargetRegistry.ts, systems/travel/TravelCalculations.ts, types/index.ts, utils/world/provenanceUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { AbilityScoreName, AbilityScores } from './core.js';
import type { MagicItemProperties } from './magicItems.js';
import type { ItemProvenance } from './provenance.js';
import type { ItemVisualSpec } from './visuals.js';
import type { CanonicalDamageType } from './spellDamageMetadata.js';

/**
 * Equipment and inventory focused types.
 */
export type EquipmentSlotType =
  | 'Head'
  | 'Neck'
  | 'Torso'
  | 'Cloak'
  | 'Belt'
  | 'MainHand'
  | 'OffHand'
  | 'Wrists'
  | 'Ring'
  | 'Ring1'
  | 'Ring2'
  | 'Feet'
  | 'Legs'
  | 'Hands';

export type ArmorCategory = 'Light' | 'Medium' | 'Heavy' | 'Shield';

export interface Mastery {
  id: string;
  name: string;
  description: string;
}

/**
 * The standard rarity tiers for items.
 * Used to determine value, availability, and power level.
 * Source: DMG
 */
export enum ItemRarity {
  Common = 'Common',
  Uncommon = 'Uncommon',
  Rare = 'Rare',
  VeryRare = 'Very Rare',
  Legendary = 'Legendary',
  Artifact = 'Artifact',
}

export interface ItemRarityTraits {
  /** Color code associated with the rarity (Hex). */
  color: string;
  /** Minimum gold piece value (approximate guide). */
  minPrice: number;
  /** Maximum gold piece value (approximate guide). */
  maxPrice: number;
}

/**
 * Trait definitions for ItemRarity.
 * Value ranges based on D&D 5e DMG.
 * Colors based on standard RPG conventions.
 */
export const ItemRarityDefinitions: Record<ItemRarity, ItemRarityTraits> = {
  [ItemRarity.Common]: {
    color: "#ffffff", // White
    minPrice: 50,
    maxPrice: 100,
  },
  [ItemRarity.Uncommon]: {
    color: "#1eff00", // Green
    minPrice: 101,
    maxPrice: 500,
  },
  [ItemRarity.Rare]: {
    color: "#0070dd", // Blue
    minPrice: 501,
    maxPrice: 5000,
  },
  [ItemRarity.VeryRare]: {
    color: "#a335ee", // Purple
    minPrice: 5001,
    maxPrice: 50000,
  },
  [ItemRarity.Legendary]: {
    color: "#ff8000", // Orange
    minPrice: 50001,
    maxPrice: 200000, // Arbitrary cap
  },
  [ItemRarity.Artifact]: {
    color: "#e6cc80", // Heirloom/Gold/Red? Using a distinct gold/pale yellow.
    minPrice: 0, // Priceless
    maxPrice: 0,
  },
};

/**
 * Classification of items in the game world.
 * Each type carries inherent properties like equippability or stackability.
 */
export enum ItemType {
  Weapon = 'weapon',
  Armor = 'armor',
  Accessory = 'accessory',
  Clothing = 'clothing',
  Consumable = 'consumable',
  Potion = 'potion',
  FoodDrink = 'food_drink',
  PoisonToxin = 'poison_toxin',
  Tool = 'tool',
  LightSource = 'light_source',
  Ammunition = 'ammunition',
  Trap = 'trap',
  Note = 'note',
  Book = 'book',
  Map = 'map',
  Scroll = 'scroll',
  Key = 'key',
  SpellComponent = 'spell_component',
  CraftingMaterial = 'crafting_material',
  Treasure = 'treasure',
  /** Raw alchemical and crafting ingredients consumed by recipes. */
  Reagent = 'reagent',
  /** Purchased intangibles: information, passage, lodging. Carries no physical form. */
  Service = 'service',
}

export interface ItemTypeTraits {
  isEquippable?: boolean;
  isStackable?: boolean;
  isConsumable?: boolean;
  description: string;
}

/**
 * Trait definitions for ItemTypes.
 */
export const ItemTypeDefinitions: Record<ItemType, ItemTypeTraits> = {
  [ItemType.Weapon]: {
    isEquippable: true,
    description: "Instruments of combat, ranging from simple clubs to magical blades.",
  },
  [ItemType.Armor]: {
    isEquippable: true,
    description: "Protective gear worn to defend against attacks.",
  },
  [ItemType.Accessory]: {
    isEquippable: true,
    description: "Jewelry or trinkets that may provide magical benefits.",
  },
  [ItemType.Clothing]: {
    isEquippable: true,
    description: "Standard apparel with no significant defensive properties.",
  },
  [ItemType.Consumable]: {
    isStackable: true,
    isConsumable: true,
    description: "General items intended to be used up.",
  },
  [ItemType.Potion]: {
    isStackable: true,
    isConsumable: true,
    description: "Magical liquids that grant effects when imbibed.",
  },
  [ItemType.FoodDrink]: {
    isStackable: true,
    isConsumable: true,
    description: "Sustenance for survival and comfort.",
  },
  [ItemType.PoisonToxin]: {
    isStackable: true,
    isConsumable: true,
    description: "Harmful substances used to coat weapons or ingest.",
  },
  [ItemType.Tool]: {
    isStackable: false,
    description: "Instruments used for crafting, picking locks, or specialized tasks.",
  },
  [ItemType.LightSource]: {
    isStackable: false,
    description: "Items that illuminate dark areas, like torches or lanterns.",
  },
  [ItemType.Ammunition]: {
    isStackable: true,
    description: "Projectiles for ranged weapons.",
  },
  [ItemType.Trap]: {
    isStackable: true,
    description: "Devices set to ensnare or harm intruders.",
  },
  [ItemType.Note]: {
    isStackable: true,
    description: "Scraps of paper containing short messages.",
  },
  [ItemType.Book]: {
    description: "Bound collections of pages containing lore or spells.",
  },
  [ItemType.Map]: {
    description: "Cartographic representations of the world.",
  },
  [ItemType.Scroll]: {
    isStackable: true,
    isConsumable: true,
    description: "Parchments inscribed with magical spells or information.",
  },
  [ItemType.Key]: {
    description: "Objects used to open locks.",
  },
  [ItemType.SpellComponent]: {
    isStackable: true,
    description: "Materials required for casting specific spells.",
  },
  [ItemType.CraftingMaterial]: {
    isStackable: true,
    description: "Raw resources used to create other items.",
  },
  [ItemType.Treasure]: {
    isStackable: true,
    description: "Valuables primarily intended for sale or collection.",
  },
  [ItemType.Reagent]: {
    isStackable: true,
    description: "Ingredients consumed by alchemy, refining, and enchanting recipes.",
  },
  [ItemType.Service]: {
    isStackable: false,
    description: "Intangible goods bought rather than carried, such as information, passage, or lodging.",
  },
};

export type ItemEffect =
  | { type: 'heal'; value: number; dice?: string }
  | { type: 'buff'; stat?: AbilityScoreName; value: number; duration?: number }
  | { type: 'damage'; damageType: string; dice: string; value?: number }
  | { type: 'restore_resource'; resource: string; amount: number }
  | { type: 'utility'; description: string }
  | string; // Legacy compatibility while migration completes

export interface Item {
  id: string;
  name: string;
  description: string;
  /** Legacy price field used by some data sources. Prefer cost for new items. */
  value?: number | string;
  /** Optional stack size for legacy inventory math; kept flexible for encumbrance tests. */
  quantity?: number;
  /** The classification of the item. */
  type: ItemType;

  /**
   * The rarity of the item.
   * Controls value, color coding, and availability.
   * Defaults to ItemRarity.Common if undefined.
   */
  rarity?: ItemRarity;

  icon?: string;
  visual?: ItemVisualSpec;
  slot?: EquipmentSlotType;
  effect?: ItemEffect;
  mastery?: string;
  category?: string;

  /**
   * Id of the world object this item was created from, when the item is a record
   * of something rather than a thing in its own right. A Service receipt bought
   * from the Rumor Mill carries the id of the rumor it records.
   */
  sourceId?: string;

  /**
   * Quests this item starts, so the trigger lives in item data instead of a
   * hardcoded branch in the interaction handler. Each field names a quest id in
   * the quest registry; the handler dispatches ACCEPT_QUEST for it when that
   * interaction happens. The quest reducer ignores a quest already in the log,
   * so a hook is safe to fire more than once.
   */
  questHooks?: {
    /** Quest accepted when the item is used from the inventory. */
    onUse?: string;
    /** Quest accepted when the item is picked up off a location. */
    onPickup?: string;
    /**
     * Objective on the hooked quest that the interaction itself satisfies, marked
     * complete alongside the accept (picking the map fragment up IS finding it).
     */
    completesObjective?: string;
  };

  /** homeId of the household this item was stolen from; set when taken from an owned container. */
  stolenFrom?: string;
  /** Optional pointer to the container/bag this item currently resides in. */
  containerId?: string;
  /** When true, this item behaves like a container capable of holding other items. */
  isContainer?: boolean;
  /** Slot capacity limit if the item is a container. */
  capacitySlots?: number;
  /** Weight capacity limit if the item is a container. */
  capacityWeight?: number;
  /** Restrict what item types can be placed in this container. */
  allowedItemTypes?: Item['type'][];
  /** Reference to a Lock (see mechanics.ts) */
  lockId?: string;

  armorCategory?: ArmorCategory;
  baseArmorClass?: number;
  addsDexterityModifier?: boolean;
  maxDexterityBonus?: number;
  strengthRequirement?: number;
  stealthDisadvantage?: boolean;
  armorClassBonus?: number;
  damageDice?: string;
  damageType?: CanonicalDamageType;
  properties?: string[];
  isMartial?: boolean;
  donTime?: string;
  doffTime?: string;
  weight?: number;
  cost?: string;
  costInGp?: number;
  isConsumed?: boolean;
  /**
   * Uses left on a limited-use kit or tool (a Healer's Kit has ten). Absent
   * means the item has never been used, so systems read it as the item's full
   * allotment rather than zero. The item is discarded once this reaches 0.
   */
  usesRemaining?: number;
  substitutable?: boolean;
  /**
   * Real-world epoch milliseconds for when this item entered the inventory.
   * Optional keeps older saves and template data valid while new item instances
   * can carry durable freshness timing for perishable food.
   */
  acquiredAt?: number;
  shelfLife?: string;
  nutritionValue?: number;
  perishable?: boolean;
  statBonuses?: Partial<AbilityScores>;
  /**
   * For items that set an ability score to a fixed value (e.g., Gauntlets of Ogre Power setting Strength to 19).
   * D&D 5e Rules: The score becomes X unless it is already higher.
   */
  statOverrides?: Partial<AbilityScores>;
  requirements?: {
    minLevel?: number;
    classId?: string[];
    minStrength?: number;
    minDexterity?: number;
    minConstitution?: number;
    minIntelligence?: number;
    minWisdom?: number;
    minCharisma?: number;
  };

  /**
   * Magical properties for the item.
   * Defined in src/types/magicItems.ts
   */
  magicProperties?: MagicItemProperties;

  /** Optional history and origin tracking for the item. */
  provenance?: ItemProvenance;

  /** If true, this item is stolen and can only be sold to a Fence. */
  isStolen?: boolean;

  /** If true, this item requires attunement before its magic properties/bonuses function. */
  requiresAttunement?: boolean;

  /** If true, this item is actively attuned by a character. */
  isAttuned?: boolean;

  /** The ID of the character who has attuned this item. */
  attunedCharacterId?: string;

  /** If true, the item is marked as junk for quick merchant selling. */
  isJunk?: boolean;

  /**
   * Frozen, readable text carried by an in-world readable item (e.g. a Book).
   * Currently a JSON-serialized snapshot for the takeable town broadsheet; when
   * present on a Book item, the inventory UI offers a "Read" affordance that
   * opens the relevant reader (the broadsheet modal) showing this snapshot.
   * Non-breaking: optional, so existing items and saves remain valid.
   */
  readableContent?: string;
}

/**
 * ItemContainer is a specialization of Item that can hold other items.
 * It keeps the base Item contract intact so existing inventory logic can
 * treat containers as regular items while UI-specific code can read the
 * additional metadata to build hierarchies.
 */
export interface ItemContainer extends Item {
  isContainer: true;
  capacitySlots?: number;
  capacityWeight?: number;
  allowedItemTypes?: Item['type'][];
  contents?: Item[];
}

/** Helper discriminated union for any inventory entry (bag or loose item). */
export type InventoryEntry = Item | ItemContainer;

export interface CanEquipResult {
  can: boolean;
  reason?: string;
}
