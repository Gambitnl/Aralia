/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 25/07/2026, 01:18:53
 * Dependents: components/CharacterSheet/Spellbook/SpellbookOverlay.tsx, components/CharacterSheet/Spellbook/SpellbookTab.tsx, components/Party/PartyPane/PartyMemberCard.tsx, services/premadeCharacterService.ts, systems/party/npcToPartyMember.ts, utils/character/characterValidation.ts, utils/character/index.ts, utils/character/spellAbilityFactory.ts, utils/character/spellUtils.ts, utils/characterUtils.ts, utils/combat/actionEconomyUtils.ts, utils/combat/combatUtils.ts, utils/sandbox/quickCharacterGenerator.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * ARCHITECTURAL CONTEXT:
 * This file is the 'Character Lifecycle' utility engine. It handles
 * complex stat derivations, equipment validation, and 'Feat Application'.
 *
 * Recent updates implement '2024 Rulebook' feat logic. The `applyFeatToCharacter`
 * function has been updated to support dynamic scaling for feats like
 * Alert (Initiative = Proficiency Bonus) and Lucky (Luck Points pool =
 * Proficiency Bonus).
 *
 * It also handles 'Party Template' creation: `createPlayerCharacterFromTemp`
 * now supports custom names from the Party Editor, ensuring that when a
 * player renames a character in the build phase, that name persists into
 * the fully realized character object.
 *
 * @file src/utils/characterUtils.ts
 */
import { PlayerCharacter, Item, ArmorCategory, ArmorProficiencyLevel, TempPartyMember, Feat, FeatPrerequisiteContext, LevelUpChoices, AbilityScoreName, MagicInitiateSource, FeatChoice, HitPointDicePool, RacialSpellGrant } from '../../types';
/**
 * Calculates the D&D ability score modifier as a number.
 * @param {number} score - The ability score.
 * @returns {number} The numerical modifier (e.g., 2, -1, 0).
 */
export { getAbilityModifierValue, calculateFinalAbilityScores, getAbilityModifierString } from './statUtils';
export { getMaxPreparedSpells } from './getMaxPreparedSpells';
import { calculateFixedRacialBonuses, calculateArmorClass } from './statUtils';
/**
 * Generates a descriptive race display string for a character.
 * e.g., "Drow Elf", "Black Dragonborn", "Stone Goliath", "Human".
 * @param {PlayerCharacter} character - The player character object.
 * @returns {string} The formatted race display string.
 */
export declare function getCharacterRaceDisplayString(character: PlayerCharacter): string;
export declare const getRacialSpellAbilityFromSelection: (sourceRaceId: string, racialSelections?: PlayerCharacter["racialSelections"]) => AbilityScoreName | undefined;
export declare const getRacialSpellGrantsForCharacter: (character: PlayerCharacter, targetLevel?: number) => RacialSpellGrant[];
export declare const getRacialSpellGrantForSpell: (character: PlayerCharacter, spellId: string, targetLevel?: number) => RacialSpellGrant | undefined;
export declare const isRacialSpellCastLevelAllowed: (character: PlayerCharacter, spellId: string, castLevel: number) => boolean;
export declare const getPreparedSpellsAffectingLimit: (character: PlayerCharacter) => Set<string>;
export declare const isRacialSpellLockedForPreparation: (character: PlayerCharacter, spellId: string) => boolean;
export declare const resolveRacialSpellCastingAbility: (character: PlayerCharacter, spellId: string) => AbilityScoreName | undefined;
/**
 * Unified generator for racial resource / limited-use IDs (RM-045).
 *
 * All racial resource-key generation routes through this single helper so the
 * naming conventions stay consistent and lookups can't silently diverge:
 *  - 'feature': trait-granted resources, keyed `racial_feature_<resourceId>`.
 *  - 'spell':   racial spell limited uses, keyed `racial_<raceId>_<spellId>`.
 *
 * The output strings are unchanged from the previous ad-hoc call sites so that
 * persisted save data and existing lookups remain valid.
 */
export declare function resolveRacialResourceId(kind: 'feature', resourceId: string): string;
export declare function resolveRacialResourceId(kind: 'spell', sourceRaceId: string, spellId: string): string;
export declare const resolveRacialSpellLimitedUseId: (sourceRaceId: string, spellId: string) => string;
export declare const normalizeClassLevels: (character: PlayerCharacter) => Record<string, number>;
export declare const buildHitPointDicePools: (character: PlayerCharacter, overrides?: {
    classLevels?: Record<string, number>;
    previousPools?: PlayerCharacter["hitPointDice"] | {
        current?: number;
        max?: number;
    } | null;
}) => HitPointDicePool[];
export declare const getHitPointDiceTotal: (pools?: HitPointDicePool[]) => number;
/**
 * Returns a numerical value for armor categories to allow for comparisons.
 * @param {ArmorCategory} [category] - The armor category.
 * @returns {number} A numerical representation of the proficiency level.
 */
export declare const getArmorCategoryHierarchy: (category?: ArmorCategory) => number;
/**
 * Determines the highest level of armor a character is proficient with.
 * @param {PlayerCharacter} character - The character object.
 * @returns {ArmorProficiencyLevel} The highest level of armor proficiency.
 */
export declare const getCharacterMaxArmorProficiency: (character: PlayerCharacter) => ArmorProficiencyLevel;
export { calculateArmorClass };
/**
 * Checks if a character can equip a given item based on proficiencies and requirements.
 * @param {PlayerCharacter} character - The character attempting to equip the item.
 * @param {Item} item - The item to be equipped.
 * @returns {{can: boolean, reason?: string}} An object indicating if the item can be equipped and why not if applicable.
 */
export declare const canEquipItem: (character: PlayerCharacter, item: Item) => {
    can: boolean;
    reason?: string;
};
/**
 * Calculates the AC change if an item were equipped in place of the current gear.
 * Used to display upgrade indicators in the inventory UI.
 * @param character - The character to evaluate
 * @param item - The item to check
 * @returns The AC change (positive = upgrade, negative = downgrade, 0 = no change)
 */
export declare const calculatePotentialAcChange: (character: PlayerCharacter, item: Item) => number;
export { calculateFixedRacialBonuses };
/**
 * Creates a full PlayerCharacter object from a simplified TempPartyMember object.
 * @param {TempPartyMember} tempMember - The temporary member data.
 * @returns {PlayerCharacter} A complete PlayerCharacter object.
 */
export declare const createPlayerCharacterFromTemp: (tempMember: TempPartyMember) => PlayerCharacter;
/**
 * Returns the XP required to reach the next level.
 * @param {number} currentLevel - The character's current level.
 * @returns {number | null} The XP required, or null if max level.
 */
export declare const getXpRequiredForNextLevel: (currentLevel: number) => number | null;
/**
 * Checks if a character has enough XP to level up.
 * @param {PlayerCharacter} character - The character.
 * @returns {boolean} True if eligible for level up.
 */
export declare const canLevelUp: (character: PlayerCharacter) => boolean;
/**
 * Evaluates whether a feat meets the provided prerequisite context.
 * Returns both a boolean flag and a human-readable list of unmet reasons
 * to surface in the UI.
 */
export declare const evaluateFeatPrerequisites: (feat: Feat, context: FeatPrerequisiteContext) => {
    isEligible: boolean;
    unmet: string[];
};
export declare const applyRacialSpellGrantsByLevel: (character: PlayerCharacter, targetLevel: number) => PlayerCharacter;
/**
 * Applies a single feat to the character and returns a cloned, updated object.
 * This helper centralizes stat mutations so the creator and level-up paths
 * stay consistent.
 */
export declare const applyFeatToCharacter: (character: PlayerCharacter, feat: Feat, options?: {
    applyHpBonus?: boolean;
    selectedAbilityScore?: AbilityScoreName;
    selectedCantrips?: string[];
    selectedLeveledSpells?: string[];
    selectedSpellSource?: MagicInitiateSource;
    selectedSkills?: string[];
}) => PlayerCharacter;
/**
 * Applies many feats in order. Useful for the character creator preview where
 * the final sheet should reflect chosen feats.
 */
export declare const applyAllFeats: (character: PlayerCharacter, featIds: string[], featChoices?: Record<string, FeatChoice>) => PlayerCharacter;
export declare const getAbilityScoreImprovementBudget: (level: number) => number;
export declare function calculateCharacterSpeedFromRace(race: PlayerCharacter['race'], racialSelections?: PlayerCharacter['racialSelections']): number;
/**
 * Calculates a character's final movement speed, accounting for race, feats,
 * and heavy armor Strength requirement penalties.
 *
 * Called by: updateDerivedStats, normalizeCharacterRaceData
 * Depends on: PlayerCharacter, calculateCharacterSpeedFromRace, getSpeedBonusFromFeats
 */
export declare function calculateCharacterSpeed(character: PlayerCharacter): number;
export declare function calculateCharacterDarkvisionFromRace(race: PlayerCharacter['race'], racialSelections?: PlayerCharacter['racialSelections']): number;
/**
 * Fully recalculates all derived properties for a character based on their
 * current base ability scores, equipment, and level.
 * Consolidates logic that was previously duplicated across multiple reducers.
 */
export declare const updateDerivedStats: (character: PlayerCharacter) => PlayerCharacter;
export declare const normalizeCharacterRaceData: (character: PlayerCharacter) => PlayerCharacter;
/**
 * The spellcasting learning allowance for a caster at a given level: how many
 * class cantrips they should know and how many leveled spells they may have
 * prepared/known. Non-casters return zeroed capacity. This is derived (pure
 * function of class + level), so it recomputes automatically on level-up; the
 * UI uses it to surface "you may learn N new cantrips / prepare N spells"
 * rather than inventing picks.
 */
export interface SpellcastingAllowance {
    /** Class cantrips the character should know at this level. */
    maxCantrips: number;
    /** Cantrips still unfilled (maxCantrips minus cantrips already on the sheet). */
    cantripsToLearn: number;
    /** Leveled spells that may be prepared/known, or null if not applicable. */
    maxPreparedSpells: number | null;
}
export declare const getSpellcastingAllowance: (character: PlayerCharacter) => SpellcastingAllowance;
/**
 * Performs a full level up on a character, honoring ability score improvements
 * and optional feat selections. Defaults to an auto-allocation when no choice
 * data is supplied so simulation loops can still progress.
 */
export declare const performLevelUp: (character: PlayerCharacter, choices?: LevelUpChoices) => PlayerCharacter;
/**
 * Adds XP and processes level ups until the character no longer qualifies.
 */
export declare const applyXpAndHandleLevelUps: (character: PlayerCharacter, xpGained: number, choices?: LevelUpChoices) => PlayerCharacter;
