/**
 * @file src/types/loot.ts
 * Type definitions for the Loot and Treasure system.
 *
 * This module defines how loot tables are structured, how drops are calculated,
 * and the resulting loot bundles. It provides a robust foundation for
 * monster drops, chest contents, and quest rewards.
 */

import { Item } from './items';

/**
 * Represents the type of a loot entry.
 */
export type LootType = 'item' | 'currency' | 'table' | 'nothing';

/**
 * Base interface for all loot entries.
 */
export interface BaseLootEntry {
  type: LootType;
  /** Probability weight for weighted random selection */
  weight: number;
  /** Optional condition required for this entry to be droppable */
  condition?: LootCondition;
}

/**
 * A loot entry that drops a specific item.
 */
export interface ItemLootEntry extends BaseLootEntry {
  type: 'item';
  itemId: string;
  /**
   * Quantity to drop. Can be a fixed number or a dice string (e.g., "1d4").
   * Defaults to 1.
   */
  quantity?: number | string;
  /**
   * Chance (0.0 - 1.0) that this item drops if selected.
   * Useful for "rare drops" within a selected category.
   * Defaults to 1.0.
   */
  dropChance?: number;
}

/**
 * A loot entry that grants currency.
 */
export interface CurrencyLootEntry extends BaseLootEntry {
  type: 'currency';
  currencyType: 'gp' | 'sp' | 'cp' | 'pp' | 'ep';
  /** Amount to drop. Fixed number or dice string (e.g., "10d6"). */
  amount: number | string;
}

/**
 * A loot entry that rolls on another (nested) loot table.
 */
export interface TableLootEntry extends BaseLootEntry {
  type: 'table';
  /** ID of the nested loot table to roll on */
  tableId: string;
  /** How many times to roll on the nested table */
  rolls?: number | string;
}

/**
 * A loot entry that drops nothing.
 * Used in weighted tables to represent the chance of failure/empty loot.
 */
export interface NothingLootEntry extends BaseLootEntry {
  type: 'nothing';
}

/**
 * A discriminated union of all possible entries in a loot table.
 */
export type LootEntry =
  | ItemLootEntry
  | CurrencyLootEntry
  | TableLootEntry
  | NothingLootEntry;

/**
 * A collection of loot entries with rules for how to select them.
 */
export interface LootTable {
  id: string;
  name?: string;
  description?: string;
  /**
   * How selection works:
   * - 'weighted': Roll once (or `rolls` times) picking based on weight.
   * - 'all': Drop everything that passes its individual dropChance/condition.
   * - 'first': Drop the first entry that passes its check/condition (priority list).
   */
  selectionType: 'weighted' | 'all' | 'first';
  entries: LootEntry[];
  /** Number of rolls to make (only for 'weighted' tables). Defaults to 1. */
  rolls?: number | string;
  /** If true, this table ensures at least one item (not 'nothing') drops if possible. */
  preventEmpty?: boolean;
}

/**
 * The concrete result of generating loot.
 * This is the "bundle" given to the player.
 */
export interface LootResult {
  /** The actual item objects generated */
  items: Item[];
  /** Total currency generated */
  currencies: {
    gp: number;
    sp: number;
    cp: number;
    pp: number;
    ep: number;
  };
}

/**
 * Conditions that can gate a loot drop.
 * Checked against the context of the killer/looter.
 */
export interface LootCondition {
  minLevel?: number;
  maxLevel?: number;
  requiredClass?: string;
  requiredRace?: string;
  requiredQuestId?: string;
  requiredQuestStatus?: 'active' | 'completed';
  /** If defined, only drops in these specific biomes */
  allowedBiomes?: string[];
  /** If defined, only drops if the monster has one of these tags */
  requiredMonsterTags?: string[];
}
