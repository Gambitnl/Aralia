/**
 * @file src/systems/character/buildStartingLoadout.ts
 * Builds a level-1 character's starting loadout — the inventory they carry, the
 * armor/shield/weapon they start EQUIPPED, and their starting gold — from their
 * class's 2024 PHB equipment package plus their background's equipment.
 *
 * Before this module, the character creator granted only the weapons a player
 * picked masteries for (plus rations/water) and equipped nothing, so every
 * character walked into the world unarmored at AC 10 and casters without a
 * mastery weapon started unarmed. This assembles the real kit.
 *
 * Pure and deterministic: same inputs → same loadout. The caller (character
 * assembly) applies `equippedItems`, recomputes AC via calculateArmorClass, and
 * threads `gold` into the new game.
 */
import { Item, EquipmentSlotType } from '../../types/index.js';
import { Background } from '../../data/backgrounds.js';
export interface StartingLoadout {
    inventory: Item[];
    equippedItems: Partial<Record<EquipmentSlotType, Item>>;
    /** Starting gold in gold pieces (class package + background coin). */
    gold: number;
}
export interface BuildLoadoutOptions {
    classId: string;
    /** Background object or id; supplies extra equipment and coin. */
    background?: Background | string | null;
    /** Weapon ids the player chose masteries for — always carried. */
    weaponMasteryIds?: string[];
}
export declare function buildStartingLoadout(opts: BuildLoadoutOptions): StartingLoadout;
