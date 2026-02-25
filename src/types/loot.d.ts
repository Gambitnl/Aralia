/**
 * @file src/types/loot.ts
 * Defines the structure for Loot Tables and procedural item generation.
 *
 * This system allows for flexible loot generation including nested tables,
 * currency drops, and weighted probability pools.
 */
import { Item } from './items';
/**
 * Common properties shared by all loot entry types.
 */
interface BaseLootEntry {
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
}
/**
 * Represents a specific item drop.
 */
export interface ItemLootEntry extends BaseLootEntry {
    type: 'item';
    /** ID of the item to drop. */
    id: string;
    /**
     * Specific item data overrides (e.g. "Broken Sword" variant).
     * Useful for generating unique versions of standard items.
     */
    dataOverride?: Partial<Item>;
}
/**
 * Represents a currency drop (e.g. Gold, Silver).
 */
export interface CurrencyLootEntry extends BaseLootEntry {
    type: 'currency';
    /** Currency type ID (e.g. 'gold', 'silver'). */
    id: string;
}
/**
 * Represents a reference to another loot table (nested loot).
 */
export interface TableReferenceLootEntry extends BaseLootEntry {
    type: 'table_reference';
    /** ID of the referenced loot table. */
    id: string;
}
/**
 * Represents a "no drop" result in the weighted pool.
 */
export interface NothingLootEntry extends BaseLootEntry {
    type: 'nothing';
    /** No ID is needed for a "nothing" result. */
    id?: never;
}
/**
 * A single entry in a loot pool.
 * Can represent an item, a pile of gold, a call to another table, or nothing.
 */
export type LootEntry = ItemLootEntry | CurrencyLootEntry | TableReferenceLootEntry | NothingLootEntry;
export type LootEntryType = LootEntry['type'];
/**
 * A grouping of potential drops.
 * A LootTable can have multiple pools (e.g. one for Gold, one for Items).
 */
export interface LootPool {
    /**
     * How many times to roll on this pool.
     * @note `min` must be less than or equal to `max`.
     */
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
export {};
