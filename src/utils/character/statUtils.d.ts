/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 01/06/2026, 17:38:35
 * Dependents: components/CharacterCreator/SkillSelection.tsx, components/DesignPreview/steps/PreviewCombatSandbox.tsx, components/Party/PartyPane/PartyMemberCard.tsx, utils/character/characterUtils.ts, utils/character/checkUtils.ts, utils/character/index.ts, utils/character/savingThrowUtils.ts, utils/character/skillModifierUtils.ts, utils/combat/combatUtils.ts, utils/sandbox/quickCharacterGenerator.ts, utils/statUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { AbilityScores, Race, PlayerCharacter, Item, EquipmentSlotType } from '../../types/index.js';
import { ActiveEffect } from '../../types/effects.js';
/**
 * Calculates the D&D ability score modifier as a number.
 * @param {number} score - The ability score.
 * @returns {number} The numerical modifier (e.g., 2, -1, 0).
 */
export declare const getAbilityModifierValue: (score: number) => number;
/**
 * Calculates the D&D ability score modifier and returns it as a string.
 * @param {number} score - The ability score.
 * @returns {string} The modifier string (e.g., "+2", "-1", "0").
 */
export declare const getAbilityModifierString: (score: number) => string;
/**
 * Applies fixed racial bonuses to a set of base ability scores.
 * @param {AbilityScores} baseScores - The base scores before racial bonuses.
 * @param {Race | null} race - The character's race.
 * @returns {AbilityScores} The final scores after fixed bonuses are applied.
 */
export declare const calculateFixedRacialBonuses: (baseScores: AbilityScores, race: Race | null) => AbilityScores;
/**
 * Calculates the final ability scores for a character, including racial bonuses and equipment bonuses.
 * @param {AbilityScores} baseScores - The character's base ability scores.
 * @param {Race} race - The character's race.
 * @param {Partial<Record<EquipmentSlotType, Item>>} equippedItems - The character's equipped items.
 * @returns {AbilityScores} The final calculated ability scores.
 */
export declare const calculateFinalAbilityScores: (baseScores: AbilityScores, race: Race, equippedItems: Partial<Record<EquipmentSlotType, Item>>) => AbilityScores;
/**
 * Calculates a character's Armor Class based on their equipped items and stats.
 * @param {PlayerCharacter} character - The character object.
 * @returns {number} The calculated Armor Class.
 */
/**
 * Components required to calculate final AC.
 * This interface allows both PlayerCharacter (detailed items) and CombatCharacter (simplified stats) to use the same logic.
 */
export interface ACComponents {
    baseAC: number;
    dexMod: number;
    maxDexBonus?: number;
    unarmoredBonus?: number;
    shieldBonus?: number;
    activeEffects?: ACRelevantActiveEffect[];
    stdBaseIncludesDex?: boolean;
}
/**
 * This is the small AC-facing view of an active effect.
 *
 * Aralia currently has two active-effect shapes: older character effects store
 * AC values directly on the effect, while combat spell commands store richer
 * spell mechanics under `mechanics`. This view lets AC calculation read both
 * shapes while the broader active-effect model is still being unified.
 */
export interface ACRelevantActiveEffect {
    type: string;
    value?: number;
    acBonus?: number;
    acMinimum?: number;
    mechanics?: Record<string, unknown>;
}
/**
 * Core function to calculate AC from components.
 * Centralizes rules for Base AC overrides, stacking, and limits.
 */
export declare const calculateFinalAC: (components: ACComponents) => number;
/**
 * Calculates a character's Armor Class based on their equipped items, stats, and active effects.
 * @param {PlayerCharacter} character - The character object.
 * @param {ActiveEffect[]} [activeEffects] - Optional list of active effects on the character.
 * @returns {number} The calculated Armor Class.
 */
export declare const calculateArmorClass: (character: PlayerCharacter, activeEffects?: ActiveEffect[]) => number;
/**
 * Calculates a passive score (e.g., Passive Perception) based on modifiers.
 * Formula: 10 + Modifier + Proficiency + Advantage/Disadvantage (+/- 5).
 * D&D 5e / 2024 PHB Rules.
 *
 * @param modifier - The ability modifier (e.g., Wisdom modifier).
 * @param proficiencyBonus - The proficiency bonus (if applicable). Default 0.
 * @param advantageState - 'none' | 'advantage' | 'disadvantage'. Default 'none'.
 * @returns The calculated passive score.
 */
export declare const calculatePassiveScore: (modifier: number, proficiencyBonus?: number, advantageState?: "none" | "advantage" | "disadvantage") => number;
