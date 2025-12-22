/**
 * @file src/types/loot.ts
 * Defines the structure for Loot Tables and procedural item generation.
 *
 * This system allows for flexible loot generation including nested tables,
 * currency drops, and weighted probability pools.
 */

import { Item } from './items';

export type LootEntryType = 'item' | 'currency' | 'table_reference' | 'nothing';

/**
 * A single entry in a loot pool.
 * Can represent an item, a pile of gold, a call to another table, or nothing.
 */
export interface LootEntry {
  type: LootEntryType;

  /**
   * ID of the item, currency type (e.g. 'gold', 'silver'), or referenced table ID.
   * Required unless type is 'nothing'.
   */
  id?: string;

  /** Relative weight for weighted random selection within the pool. */
  weight: number;

  /** Minimum quantity (default 1). */
  minQuantity?: number;

  /** Maximum quantity (default 1). */
  maxQuantity?: number;

  /**
   * Independent chance (0.0 - 1.0) for this entry to trigger.
   * If used in a weighted pool, this check happens AFTER selection.
   */
  chance?: number;

  /**
   * Specific item data overrides (e.g. "Broken Sword" variant).
   * Useful for generating unique versions of standard items.
   */
  dataOverride?: Partial<Item>;
}

/**
 * A grouping of potential drops.
 * A LootTable can have multiple pools (e.g. one for Gold, one for Items).
 */
export interface LootPool {
  /** How many times to roll on this pool. */
  rolls: {
    min: number;
    max: number;
  };

  /** The entries to select from. */
  entries: LootEntry[];

  /** If true, distinct entries must be selected (no duplicates in a single roll batch). */
  unique?: boolean;
}

/**
 * The master definition for a loot source (Monster drop, Chest, Pickpocket).
 */
export interface LootTable {
  id: string;
  name?: string;
  description?: string;

  /**
   * The collection of pools to roll against.
   * All pools are processed independently.
   */
  pools: LootPool[];

  /** Optional requirements to roll on this table (e.g. high level chests). */
  conditions?: {
    minLevel?: number;
    playerClass?: string[];
  };
}
