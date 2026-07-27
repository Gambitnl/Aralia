/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/05/2026, 19:21:27
 * Dependents: utils/character/characterUtils.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { AbilityScoreName, RacialSpellGrant, RacialSpell, Race } from '../../types';
/**
 * This file manages the definition and parsing of racial traits.
 *
 * It parses trait strings from race configurations and extracts mechanical benefits
 * such as spell grants, defensive features (resistance/immunity), and modifier buckets
 * (ability score increases, custom Armor Class formulas, skill proficiencies, and speeds).
 *
 * Called by: characterUtils.ts (character assembly pipeline)
 * Depends on: types/index.ts, types/spells.ts for character/combat data definitions
 */
type RacialTraitResetCondition = 'short_rest' | 'long_rest';
type RacialResourceMax = number | 'proficiency_bonus';
export interface RacialResourceMechanic {
    id: string;
    maxUses: RacialResourceMax;
    resetOn: RacialTraitResetCondition;
    sourceLabel?: string;
}
export interface RacialTraitActivationWindow {
    fromLevel: number;
    toLevel?: number;
}
export interface RacialTraitSummary {
    id: string;
    sourceRaceId: string;
    sourceRaceName: string;
    traitName: string;
    traitType: RacialTraitType;
    minLevel: number;
    maxLevel?: number;
    featureGroup?: 'racialChoice' | 'mechanical' | 'informational';
    hasChoiceDefaults: boolean;
    resourceIds: string[];
    spellIds: string[];
    sourceText: string;
}
export type RacialTraitType = 'spell' | 'feature' | 'resource' | 'resistance' | 'movement' | 'combat' | 'other';
export interface RacialTraitBase {
    type: RacialTraitType;
    sourceRaceId: string;
    sourceRaceName: string;
    traitName: string;
    traitDescription: string;
    minLevel: number;
    maxLevel?: number;
}
export interface RacialSpellTrait extends RacialTraitBase, Omit<RacialSpellGrant, 'sourceRaceName' | 'traitName'> {
    type: 'spell';
}
export interface RacialFeatureTrait extends RacialTraitBase {
    type: Exclude<RacialTraitType, 'spell'>;
    featureGroup: 'racialChoice' | 'mechanical' | 'informational';
    sourceText?: string;
    sourceChoiceId?: string;
    minLevel: number;
    maxLevel?: number;
    defensiveTraits?: RacialDefenseBuckets;
    modifierBuckets?: RacialModifierBuckets;
    metadata?: {
        source?: string;
        note?: string;
        defaultsFromChoice?: boolean;
    };
    resources?: RacialResourceMechanic[];
}
export type RacialChoiceRequirementType = 'spellAbility' | 'spellChoice' | 'skillChoice' | 'featChoice';
export interface RacialChoiceRequirement {
    type: RacialChoiceRequirementType;
    id: string;
    sourceRaceId: string;
    sourceRaceName: string;
    sourceTraitName: string;
    sourceTraitDescription: string;
    sourceText: string;
    requiredSpellIds?: string[];
    availableSpellIds?: string[];
    availableAbilities?: AbilityScoreName[];
    skillCount?: number;
    availableSkillIds?: string[];
    featId?: string;
}
export type RacialTrait = RacialSpellTrait | RacialFeatureTrait;
export interface RacialTraitLibrary {
    byRaceId: Record<string, RacialTrait[]>;
    bySpellId: Record<string, RacialSpellTrait[]>;
    byChoiceRaceId: Record<string, RacialChoiceRequirement[]>;
    allSpells: RacialSpellTrait[];
    allTraits: RacialTrait[];
    byType: Record<RacialTraitType, RacialTrait[]>;
    byActivationWindow: Record<string, RacialTraitSummary[]>;
    raceTraitSummaries: Record<string, RacialTraitSummary[]>;
    allTraitSummaries: RacialTraitSummary[];
}
export interface RacialBreathWeapon {
    areaShape: 'cone' | 'line';
    areaSize: number;
    saveAbility: AbilityScoreName;
    damageDice: string;
    damageType: string;
    scaling: {
        level: number;
        dice: string;
    }[];
}
export interface RacialModifierBuckets {
    advantage: string[];
    disadvantage: string[];
    bonuses: string[];
    baseArmorClass?: number;
    acBonus?: number;
    reachBonus?: number;
    powerfulBuild?: boolean;
    unendingBreath?: boolean;
    languages?: string[];
    skillProficiencies?: string[];
    weaponProficiencies?: string[];
    armorProficiencies?: string[];
    initiativeBonus?: number;
    initiativeProficiency?: boolean;
    ignoreDifficultTerrain?: boolean;
    breathWeapon?: RacialBreathWeapon;
    reactions?: RacialReaction[];
    savageAttacks?: boolean;
}
export interface RacialReaction {
    id: string;
    name: string;
    description: string;
    trigger: any;
    condition: any;
    effect: any;
}
export interface RacialDefenseBuckets {
    resistances: string[];
    immunities: string[];
    vulnerabilities: string[];
}
export declare const getRacialDefenseBucketsFromTraitText: (traitText: string) => RacialDefenseBuckets;
export declare const getRacialModifierBucketsFromTraitText: (traitText: string) => RacialModifierBuckets;
export declare const buildRacialSpellTraitFromRacialSpell: (race: Race, racialTraitName: string, racialTraitDescription: string, spell: RacialSpell) => RacialSpellTrait;
export declare const buildRacialTraitLibrary: (races: Record<string, Race>) => RacialTraitLibrary;
export declare const getRacialChoiceRequirementsForRace: (raceId: string) => RacialChoiceRequirement[];
export declare const getRacialSpellCastingAbilityChoicesForRace: (raceId: string) => RacialChoiceRequirement[];
export declare const getRacialSpellCastingAbilityChoiceForRace: (raceId: string) => RacialChoiceRequirement | undefined;
export declare const hasRacialSpellCastingAbilityChoiceForRace: (raceId: string) => boolean;
/**
 * RACIAL TRAIT SUMMARIZATION & ACCESSORS:
 *
 * These helper functions provide high-level, flattened accessors to the active
 * racial trait library instance, shielding consumer components from manual checks
 * against the global RACE_TRAIT_LIBRARY_INSTANCE singleton.
 *
 * PRESERVED LOGIC:
 * - Direct lookup in the cached raceTraitSummaries map.
 * - Flat summaries retrieval for all traits in the system.
 * - Grouped lookup by level-based activation windows.
 *
 * FIX HISTORY:
 * - Removed an accidental duplicate copy-paste block at the end of this file
 *   that was introducing duplicate exports and syntax errors (broken trailing expression).
 */
export declare const getRacialTraitSummariesByRace: (raceId: string) => RacialTraitSummary[];
export declare const getAllRacialTraitSummaries: () => RacialTraitSummary[];
export declare const getRacialTraitSummariesByActivationWindow: () => Record<string, RacialTraitSummary[]>;
export declare const setRacialTraitLibraryInstance: (library: RacialTraitLibrary) => void;
export {};
