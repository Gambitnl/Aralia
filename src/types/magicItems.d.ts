/**
 * @file src/types/magicItems.ts
 * Definitions for magical properties, rarity, and attunement.
 *
 * This module defines the specialized properties for magic items, including
 * rarity tiers, attunement requirements, charge management, and curses.
 */
import type { AbilityScoreName } from './core';
/**
 * The standard rarity tiers for magic items.
 * Used to determine value, availability, and power level.
 */
export type MagicItemRarity = 'Common' | 'Uncommon' | 'Rare' | 'Very Rare' | 'Legendary' | 'Artifact';
/**
 * Categories of magic items, distinct from base item types.
 */
export type MagicItemCategory = 'Armor' | 'Potion' | 'Ring' | 'Rod' | 'Scroll' | 'Staff' | 'Wand' | 'Weapon' | 'Wondrous Item';
/**
 * Defines the attunement requirements for a magic item.
 */
export interface Attunement {
    /** Whether the item requires attunement to function fully. */
    required: boolean;
    /**
     * Specific requirements for attunement.
     * e.g., "requires attunement by a wizard", "requires attunement by a creature of good alignment"
     * If undefined, any creature can attune.
     */
    requirements?: string;
    /**
     * If true, the item cannot be voluntarily un-attuned (often due to a curse).
     */
    isCursedLink?: boolean;
}
/**
 * Represents a curse affecting a magic item.
 */
export interface Curse {
    /** Unique identifier for the curse logic. */
    id: string;
    /** Display name of the curse (e.g., "Curse of Vulnerability"). */
    name: string;
    /** Narrative description of the curse's effects. */
    description: string;
    /**
     * The mechanical effect ID or description.
     * Can link to a status effect or be a custom script ID.
     */
    effect: string;
    /**
     * Whether the player has identified that the item is cursed.
     * If false, the item appears normal until the curse is triggered.
     */
    isRevealed: boolean;
    /**
     * How the curse can be broken.
     * e.g., "Remove Curse spell", "Redemption", "Wish"
     */
    removalCondition?: string;
}
/**
 * Tracking for items with limited uses or charges.
 */
export interface ItemCharges {
    /** Current number of charges remaining. */
    current: number;
    /** Maximum number of charges. */
    max: number;
    /**
     * When the charges replenish.
     */
    resetCondition: 'dawn' | 'dusk' | 'short_rest' | 'long_rest' | 'never';
    /**
     * Dice formula for how many charges are regained.
     * e.g., "1d6+4", "1d4"
     * If undefined, it fully restores.
     */
    resetDice?: string;
    /**
     * If true, the item might be destroyed when the last charge is used.
     * (e.g., "On a 1 on a d20, the wand crumbles to ash.")
     */
    canDestroyOnDepletion?: boolean;
}
/**
 * Comprehensive properties for a magic item.
 * Intended to be attached to the base `Item` interface.
 */
export interface MagicItemProperties {
    /** The rarity tier of the item. */
    rarity: MagicItemRarity;
    /** The broad category of the magic item. */
    category: MagicItemCategory;
    /** Attunement details. */
    attunement?: Attunement;
    /** Charge management for wands, staves, etc. */
    charges?: ItemCharges;
    /** Cursed properties, if any. */
    curse?: Curse;
    /**
     * Whether the item's magical properties have been identified by the player.
     * If false, the player may only see the base item description.
     */
    isIdentified: boolean;
    /**
     * Bonus to attack and damage rolls (e.g., +1, +2, +3).
     * Applicable primarily to weapons and ammunition.
     */
    magicalBonus?: number;
    /**
     * Bonus to Armor Class (e.g., +1, +2).
     * Applicable to armor, shields, and some protective items.
     */
    acBonus?: number;
    /**
     * Ability score override or bonus.
     * e.g., Belt of Giant Strength sets Strength to a specific value.
     */
    abilityModifier?: {
        ability: AbilityScoreName;
        type: 'set' | 'add';
        value: number;
    };
}
