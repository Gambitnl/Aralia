import type { AbilityScoreName, AbilityScores } from './core';
import type { MagicItemProperties } from './magicItems';
import type { ItemProvenance } from './provenance';
import type { ItemVisualSpec } from './visuals';
/**
 * Equipment and inventory focused types.
 */
export type EquipmentSlotType = 'Head' | 'Neck' | 'Torso' | 'Cloak' | 'Belt' | 'MainHand' | 'OffHand' | 'Wrists' | 'Ring' | 'Ring1' | 'Ring2' | 'Feet' | 'Legs' | 'Hands';
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
export declare enum ItemRarity {
    Common = "Common",
    Uncommon = "Uncommon",
    Rare = "Rare",
    VeryRare = "Very Rare",
    Legendary = "Legendary",
    Artifact = "Artifact"
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
export declare const ItemRarityDefinitions: Record<ItemRarity, ItemRarityTraits>;
/**
 * Classification of items in the game world.
 * Each type carries inherent properties like equippability or stackability.
 */
export declare enum ItemType {
    Weapon = "weapon",
    Armor = "armor",
    Accessory = "accessory",
    Clothing = "clothing",
    Consumable = "consumable",
    Potion = "potion",
    FoodDrink = "food_drink",
    PoisonToxin = "poison_toxin",
    Tool = "tool",
    LightSource = "light_source",
    Ammunition = "ammunition",
    Trap = "trap",
    Note = "note",
    Book = "book",
    Map = "map",
    Scroll = "scroll",
    Key = "key",
    SpellComponent = "spell_component",
    CraftingMaterial = "crafting_material",
    Treasure = "treasure"
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
export declare const ItemTypeDefinitions: Record<ItemType, ItemTypeTraits>;
export type ItemEffect = {
    type: 'heal';
    value: number;
    dice?: string;
} | {
    type: 'buff';
    stat?: AbilityScoreName;
    value: number;
    duration?: number;
} | {
    type: 'damage';
    damageType: string;
    dice: string;
    value?: number;
} | {
    type: 'restore_resource';
    resource: string;
    amount: number;
} | {
    type: 'utility';
    description: string;
} | string;
export interface Item {
    id: string;
    name: string;
    description: string;
    /** Legacy price field used by some data sources. Prefer cost for new items. */
    value?: number | string;
    /** Optional stack size for legacy inventory math; kept flexible for encumbrance tests. */
    quantity?: number;
    /**
     * The classification of the item.
     * Prefer using ItemType enum values.
     *
     * // TODO(Taxonomist): Refactor codebase to strictly use ItemType enum and remove magic strings
     */
    type: ItemType | 'weapon' | 'armor' | 'accessory' | 'clothing' | 'consumable' | 'potion' | 'food_drink' | 'poison_toxin' | 'tool' | 'light_source' | 'ammunition' | 'trap' | 'note' | 'book' | 'map' | 'scroll' | 'key' | 'spell_component' | 'reagent' | 'crafting_material' | 'treasure';
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
