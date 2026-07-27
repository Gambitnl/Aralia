/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/05/2026, 10:33:59
 * Dependents: types/spells.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file defines small core spell metadata types.
 *
 * These types are shared by the broad spell contract but do not need direct
 * access to the full spell model. Keeping them here reduces pressure on
 * `spells.ts` while preserving its public re-export surface.
 *
 * Called by: `spells.ts`.
 * Depends on: no runtime data; this is a type-only metadata module.
 */
/**
 * The eight schools of magic in D&D 5e.
 *
 * Why this lives here:
 * the school enum and its display traits are core metadata, not effect logic.
 * Keeping them in this small helper prevents the broad `spells.ts` barrel from
 * carrying every school description directly.
 */
export declare enum SpellSchool {
    Abjuration = "Abjuration",
    Conjuration = "Conjuration",
    Divination = "Divination",
    Enchantment = "Enchantment",
    Evocation = "Evocation",
    Illusion = "Illusion",
    Necromancy = "Necromancy",
    Transmutation = "Transmutation"
}
/** Legacy alias for older callers that still use the MagicSchool name. */
export type MagicSchool = SpellSchool;
export declare const MagicSchool: typeof SpellSchool;
/** Human-readable descriptive traits associated with one school of magic. */
export interface SpellSchoolTraits {
    /** A brief description of what the school encompasses. */
    description: string;
    /** Thematic keywords associated with the school. */
    themes: string[];
}
/** The rarity of a spell. */
export type SpellRarity = "common" | "uncommon" | "rare" | "very_rare" | "legendary";
/** Defines the type of attack roll required, if any. */
export type SpellAttackType = "melee" | "ranged" | "none";
/** Standard traits associated with each school of magic. */
export declare const SpellSchoolDefinitions: Record<SpellSchool, SpellSchoolTraits>;
