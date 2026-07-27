import { AbilityScoreName } from '../../../types/core';
import { AbilityEffect, AreaOfEffect } from '../../../types/combat';
/**
 * Recursively extracts plain text from a 5eTools entries value.
 * `entries` can be a string, an array of strings/objects, or a single object.
 * Handles the common nested node types: list, item, entries, inset, table.
 */
export declare function extractEntryText(entries: any): string;
export declare function strip5eToolsMarkup(text: string): string;
/** Capitalizes the first letter, lowercases the rest. */
export declare function capitalize(s: string): string;
/**
 * 5etools stores senses as an array of strings like "darkvision 60 ft.".
 * Returns the numeric distance for the requested sense type, or 0.
 */
export declare function parseSense(senses: string[] | undefined, type: string): number;
export declare function parseArmorClass(ac: any): number | undefined;
export declare function parseArmorSource(ac: any): string | undefined;
/** Maps 5eTools size codes (T, S, M, L, H, G) to Aralia's full labels. */
export declare function parseSize(size: string[] | undefined): 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan' | undefined;
/** Maps a 5etools lowercase damage type string to Aralia's capitalized DamageType. */
export declare function mapDamageType(raw: string): string | undefined;
/**
 * Extracts simple string damage types from a 5etools defense array.
 * Skips conditional objects — only keeps entries that map to known D&D damage types.
 */
export declare function parseDamageDefenses(defenses: any[] | undefined): string[];
/**
 * Extracts damage types from conditional defense entries that apply to nonmagical attacks.
 * These are objects like: { resist: [...], note: "from nonmagical attacks", cond: true }
 */
export declare function parseNonMagicalDefenses(defenses: any[] | undefined): string[];
/** Extracts save DC and save ability from an action text string. */
export declare function parseSaveDC(text: string): {
    saveDC?: number;
    saveAbility?: AbilityScoreName;
};
/** Parses AoE shape/size from an action text string.
 *  Handles both MM 2014 ("60-foot cone") and XMM 2024 format where the shape
 *  keyword may be wrapped in a {@variantrule Cone [Area of Effect]|XPHB|Cone} tag.
 */
export declare function parseAreaOfEffect(text: string): AreaOfEffect | undefined;
/**
 * Parses a dice formula string (e.g. "2d6 + 3", "1d10+8", "3d8") and returns
 * the expected average value. Used to populate `value` on AbilityEffects so the
 * combat AI can score damage without rolling dice at evaluation time.
 */
export declare function diceAverage(formula: string): number;
/** Parses all {@damage ...} tags and infers damage types from surrounding text. */
export declare function parseDamageEffects(text: string): AbilityEffect[];
/** Parses condition effects from {@condition ...} tags and plain-text fallbacks. */
export declare function parseConditionEffects(text: string): AbilityEffect[];
/**
 * Harmonized icon assignment logic for all ability types.
 */
/**
 * Converts a 5eTools `conditionImmune` array (e.g. ["exhaustion","poisoned"]) into
 * Aralia `ConditionName` values (Title-Case). Unknown conditions are kept as-is so
 * downstream immunity checks (which allow string comparison) still work.
 */
export declare function parseConditionImmunities(conditionImmune: any[] | undefined): string[];
export declare function getAbilityIcon(type: string, costType: string, name?: string, maxUses?: number): string;
