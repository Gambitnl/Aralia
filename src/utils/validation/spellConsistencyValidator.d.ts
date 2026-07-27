/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:34:48
 * Dependents: audit_enchantment_consistency.ts, validation/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Spell } from '../../types/spells';
export interface ValidationIssue {
    spellId: string;
    level: 'error' | 'warning' | 'info';
    category: 'targeting' | 'mechanics' | 'description' | 'scaling';
    message: string;
}
/**
 * Validates consistency of Enchantment spells, focusing on:
 * 1. Creature type exclusions (Undead/Construct/Plants for some)
 * 2. Immunity handling (Charmed immunity)
 * 3. Break conditions (Damage breaks effect)
 */
export declare function validateEnchantmentConsistency(spell: Spell): ValidationIssue[];
