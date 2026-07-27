/**
 * @file src/data/items/adventuringGear.ts
 * Early-game adventuring gear: the spellcasting focuses, adventuring packs,
 * ammunition, kits, and starting clothes that the 2024 PHB class starting-
 * equipment packages (and several backgrounds) reference. Before this file,
 * none of these existed in the catalog, so class packages and background
 * equipment had nothing to resolve to and were silently dropped.
 *
 * Merged into ALL_ITEMS (see ./index.ts). Kept as its own module so the
 * starting-loadout system has one clearly-bounded source for "the basic kit."
 */
import { Item } from '../../types/index.js';
export declare const ADVENTURING_GEAR: Record<string, Item>;
