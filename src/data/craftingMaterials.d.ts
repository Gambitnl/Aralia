/**
 * @file src/data/craftingMaterials.ts
 * Item definitions for the Refining & Enchanting loop (crafting G5).
 *
 * Refining turns raw materials (ores, hides, gems) into refined components
 * (ingots, leather, arcane dust); Enchanting consumes those components plus a
 * base item. Every id referenced by REFINING_RECIPES / ENCHANTING_RECIPES must
 * exist here or elsewhere in ALL_ITEMS, or ADD_ITEM will drop the output.
 *
 * 'iron_ore' and 'silver_ore' were already granted by travel mining events
 * (src/data/travelEvents.ts) without a backing item definition — defining them
 * here also makes those event rewards real.
 */
import { Item } from '../types/index.js';
export declare const CRAFTING_MATERIALS: Record<string, Item>;
