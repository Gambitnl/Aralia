import { AbilityScores } from './stats';

export type ArmorCategory = 'Light' | 'Medium' | 'Heavy' | 'Shield';

export interface Mastery {
  id: string;
  name: string;
  description: string;
}

export type EquipmentSlotType =
  | 'Head' | 'Neck' | 'Torso' | 'Cloak' | 'Belt'
  | 'MainHand' | 'OffHand' | 'Wrists' | 'Ring1' | 'Ring2' | 'Feet' | 'Legs' | 'Hands';

export type ItemEffect =
  | { type: 'heal'; value: number; dice?: string }
  | { type: 'buff'; stat: keyof AbilityScores; value: number; duration?: number }
  | { type: 'damage'; damageType: string; dice: string }
  | { type: 'restore_resource'; resource: string; amount: number }
  | { type: 'utility'; description: string }
  | string; // For backward compatibility temporarily

export interface Item {
  id: string;
  name: string;
  description: string;
  type: 'weapon' | 'armor' | 'accessory' | 'clothing' | 'consumable' | 'potion' | 'food_drink' | 'poison_toxin' | 'tool' | 'light_source' | 'ammunition' | 'trap' | 'note' | 'book' | 'map' | 'scroll' | 'key' | 'spell_component' | 'crafting_material' | 'treasure';
  icon?: string;
  slot?: EquipmentSlotType;
  effect?: ItemEffect;
  mastery?: string;
  category?: string;
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
  armorCategory?: ArmorCategory;
  baseArmorClass?: number;
  addsDexterityModifier?: boolean;
  maxDexterityBonus?: number;
  strengthRequirement?: number;
  stealthDisadvantage?: boolean;
  armorClassBonus?: number;
  damageDice?: string;
  damageType?: string;
  properties?: string[];
  isMartial?: boolean;
  donTime?: string;
  doffTime?: string;
  weight?: number;
  cost?: string;
  costInGp?: number;
  isConsumed?: boolean;
  substitutable?: boolean;
  shelfLife?: string;
  nutritionValue?: number;
  perishable?: boolean;
  statBonuses?: Partial<AbilityScores>;
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
