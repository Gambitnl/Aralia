/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:05
 * Dependents: character/index.ts, spellFilterUtils.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/spellFilterUtils.ts
 * Artisanal utilities for filtering and displaying spells in feat selection.
 * Provides school-aware filtering, attack spell detection, and visual helpers.
 */
import { Spell, SpellSchool, FeatSpellRequirement } from '../../types';
import { SpellDataRecord } from '../../context/SpellContext';
/**
 * Checks if a spell requires an attack roll.
 * Attack spells have a DAMAGE effect with condition.type === "hit".
 */
export declare function isAttackSpell(spell: Spell): boolean;
/**
 * Gets the spell ID list for a given class.
 */
export declare function getClassSpellList(classId: string): string[];
/**
 * Filters spells based on a FeatSpellRequirement configuration.
 * Returns spells sorted alphabetically by name.
 *
 * @param allSpells - Record of all available spells
 * @param requirement - The filtering requirements from the feat
 * @param selectedSpellSource - Optional class ID for Magic Initiate-style filtering
 */
export declare function filterSpellsForRequirement(allSpells: SpellDataRecord, requirement: FeatSpellRequirement, selectedSpellSource?: string): Spell[];
/**
 * Returns an emoji icon for a spell school.
 */
export declare function getSchoolIcon(school: SpellSchool | string): string;
/**
 * Returns a Tailwind text color class for a spell school.
 */
export declare function getSchoolColorClass(school: SpellSchool | string): string;
/**
 * Returns Tailwind background + border classes for a spell school badge.
 */
export declare function getSchoolBgClass(school: SpellSchool | string): string;
/**
 * Returns a human-readable label for a spell level.
 */
export declare function getSpellLevelLabel(level: number): string;
/**
 * Formats casting time for display.
 */
export declare function formatCastingTime(castingTime: Spell['castingTime']): string;
