/**
 * @file src/types/loot.ts
 * Defines the structure for loot tables, drop rates, and rewards.
 * Used by Monster, Location, and Quest systems to determine random rewards.
 *
 * This module allows for:
 * - Weighted probability drops
 * - Nested loot tables (rolling on Table A triggers Table B)
 * - Conditional drops (e.g., specific player level)
 * - Dice-based quantities (e.g., "1d6 gold")
 */

/**
 * Represents the rarity of an item or loot tier.
 */
export type LootRarity = 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'artifact';

/**
 * A condition that must be met for a loot entry to be considered.
 * Strings are used for flexibility (e.g., "level > 5", "quest_active:123").
 * Parsing logic is handled by the loot resolver system.
 */
export type LootCondition = string;

/**
 * The type of reward a loot entry provides.
 */
export type LootEntryType = 'item' | 'currency' | 'table' | 'nothing';

/**
 * A single entry in a loot table.
 * Can be a specific item, a nested table, currency, or an empty slot (nothing).
 */
export interface LootEntry {
  /**
   * Probability weight.
   * The chance of this entry being picked is (weight / total_valid_weights).
   * Standard integer weights (e.g., 1, 10, 100).
   */
  weight: number;

  /**
   * The type of reward this entry provides.
   */
  type: LootEntryType;

  /**
   * The ID of the item (if type is 'item') or the ID of the nested loot table (if type is 'table').
   * Not required for 'currency' (uses currencyType) or 'nothing'.
   */
  id?: string;

  /**
   * Quantity to drop. Can be a fixed number or a dice string (e.g., "1d6", "2d4+1").
   * Defaults to "1".
   */
  quantity?: string | number;

  /**
   * Optional conditions that must be met for this entry to even be part of the pool.
   * If any condition fails, this entry is treated as if it has weight 0.
   */
  conditions?: LootCondition[];

  /**
   * For 'currency' type, the currency name (e.g., 'gold', 'silver', 'copper').
   */
  currencyType?: string;

  /**
   * Optional minimum level required to see this drop.
   * Shortcut for a common condition.
   */
  minLevel?: number;

  /**
   * Optional maximum level allowed to see this drop.
   */
  maxLevel?: number;
}

/**
 * A structured collection of loot entries.
 * Represents a "chest", a "monster pocket", or a "shop inventory".
 */
export interface LootTable {
  /**
   * Unique ID for referencing this table (e.g., "goblin_pockets_tier1").
   */
  id: string;

  /**
   * A human-readable description for debugging or GM tools.
   */
  description?: string;

  /**
   * How many times to roll on this table.
   * Can be a fixed number or dice string (e.g., "1", "1d3").
   * Defaults to "1".
   */
  rolls?: string | number;

  /**
   * The list of potential drops.
   */
  entries: LootEntry[];

  /**
   * If true, prevents duplicate results from the same roll session.
   * E.g., if you roll 3 times, you can't get the same unique sword twice.
   * Logic handles this by temporarily removing picked entries.
   */
  preventDuplicates?: boolean;
}

/**
 * Result of a resolved loot roll.
 */
export interface LootResult {
  /** The items generated */
  items: Array<{ itemId: string; quantity: number }>;
  /** The currency generated */
  currency: Record<string, number>;
}
