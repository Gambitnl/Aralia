/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/07/2026, 21:54:48
 * Dependents: utils/visuals/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/visuals/spellVisuals.ts
 * Utilities for resolving spell visuals, handling fallbacks, and standardizing school colors.
 */
import { Spell, SpellSchool } from '../../types/spells';
import { VisualAsset } from '../../types/visuals';
/**
 * Standard color mappings for D&D 5e Spell Schools.
 * Colors chosen to be distinct and thematic.
 */
export declare const SCHOOL_COLORS: Record<SpellSchool, string>;
/**
 * Fallback emojis for spell schools when no specific icon is present.
 */
export declare const SCHOOL_ICONS: Record<SpellSchool, string>;
/**
 * Generates a full visual specification for a spell, handling all fallback logic.
 *
 * @param spell - The spell to resolve visuals for.
 * @returns A VisualAsset object ready for UI rendering.
 */
export declare function getSpellVisual(spell: Spell): VisualAsset;
/**
 * Creates a lighter/darker variant of a hex color for gradients.
 * (Simple implementation for now)
 */
export declare function getSchoolColor(school: SpellSchool): string;
