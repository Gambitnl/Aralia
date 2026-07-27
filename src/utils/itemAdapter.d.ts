import { GlossaryEntry } from '../types/ui.js';
import { Item } from '../types/items.js';
/**
 * Converts a 5etools ingested glossary entry into a fully functional
 * engine Item, complete with mechanical stats.
 */
export declare function convertGlossaryEntryToItem(entry: GlossaryEntry): Item | null;
