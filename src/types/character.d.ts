import type { SpellSchool } from './spells';
import type { ActiveEffect, StatusEffect } from './effects';
import type { AbilityScoreName, AbilityScores, CharacterStats, Skill } from './core';
import type { EquipmentSlotType, Item } from './items';
import type { RaceVisualSpec } from './visuals';
import type { FamilyMember } from './world';
export type { AbilityScores, AbilityScoreName } from './core';
export interface RacialAbilityBonus {
    ability: AbilityScoreName | 'Any';
    bonus: number;
    choiceCount?: number;
}
export type ElvenLineageType = 'drow' | 'high_elf' | 'wood_elf';
export interface ElvenLineageBenefit {
    level: number;
    description?: string;
    cantripId?: string;
    spellId?: string;
    speedIncrease?: number;
    darkvisionRange?: number;
    canSwapCantrip?: boolean;
    swappableCantripSource?: 'wizard';
}
export interface ElvenLineage {
    id: ElvenLineageType;
    name: string;
    description: string;
    benefits: ElvenLineageBenefit[];
}
export type GnomeSubraceType = 'forest_gnome' | 'rock_gnome' | 'deep_gnome';
export interface GnomeSubrace {
    id: GnomeSubraceType;
    name: string;
    description: string;
    traits: string[];
    grantedCantrip?: {
        id: string;
        spellcastingAbilitySource: 'subrace_choice';
    };
    grantedSpell?: {
        id: string;
        spellcastingAbilitySource: 'subrace_choice';
        usesDescription: string;
        level: number;
    };
    superiorDarkvision?: boolean;
}
export type GiantAncestryType = 'Cloud' | 'Fire' | 'Frost' | 'Hill' | 'Stone' | 'Storm';
export interface GiantAncestryBenefit {
    id: GiantAncestryType;
    name: string;
    description: string;
}
export type FiendishLegacyType = 'abyssal' | 'chthonic' | 'infernal';
export interface FiendishLegacy {
    id: FiendishLegacyType;
    name: string;
    description: string;
    level1Benefit: {
        resistanceType: string;
        cantripId: string;
    };
    level3SpellId: string;
    level5SpellId: string;
}
export interface RacialSpell {
    minLevel: number;
    spellId: string;
}
export type DraconicAncestorType = 'Black' | 'Blue' | 'Brass' | 'Bronze' | 'Copper' | 'Gold' | 'Green' | 'Red' | 'Silver' | 'White';
export type DraconicDamageType = 'Acid' | 'Lightning' | 'Fire' | 'Poison' | 'Cold';
export interface DraconicAncestryInfo {
    type: DraconicAncestorType;
    damageType: DraconicDamageType;
}
/**
 * A comprehensive type that bundles all race-related data, including lineages,
 * subraces, and other unique racial choices. This provides a single, strongly-typed
 * source for all non-core race data.
 */
export interface RaceDataBundle {
    dragonbornAncestries: Record<DraconicAncestorType, DraconicAncestryInfo>;
    goliathGiantAncestries: GiantAncestryBenefit[];
    tieflingLegacies: FiendishLegacy[];
    gnomeSubraces: GnomeSubrace[];
}
export interface Race {
    id: string;
    name: string;
    description: string;
    abilityBonuses?: RacialAbilityBonus[];
    traits: string[];
    /** The parent race group this race belongs to (e.g., 'dwarf' for Hill Dwarf, Mountain Dwarf, etc.) */
    baseRace?: string;
    /** Whether this race can be selected directly without choosing a subrace. Defaults to true if omitted. */
    isSelectableAsBase?: boolean;
    elvenLineages?: ElvenLineage[];
    gnomeSubraces?: GnomeSubrace[];
    giantAncestryChoices?: GiantAncestryBenefit[];
    fiendishLegacies?: FiendishLegacy[];
    /** @deprecated Use visual.illustrationPath instead */
    imageUrl?: string;
    visual?: RaceVisualSpec;
    racialSpellChoice?: {
        traitName: string;
        traitDescription: string;
    };
    spellsOfTheMark?: {
        minLevel: number;
        spells: string[];
    }[];
    knownSpells?: RacialSpell[];
}
export interface ClassFeature {
    id: string;
    name: string;
    description: string;
    levelAvailable: number;
}
export interface FightingStyle extends ClassFeature {
}
export interface DivineOrderOption {
    id: 'Protector' | 'Thaumaturge';
    name: string;
    description: string;
}
export interface PrimalOrderOption {
    id: 'Magician' | 'Warden';
    name: string;
    description: string;
}
export interface WarlockPatronOption {
    id: string;
    name: string;
    description: string;
}
export type ArmorProficiencyLevel = 'unarmored' | 'light' | 'medium' | 'heavy';
export interface Class {
    id: string;
    name: string;
    description: string;
    hitDie: number;
    primaryAbility: AbilityScoreName[];
    savingThrowProficiencies: AbilityScoreName[];
    skillProficienciesAvailable: string[];
    numberOfSkillProficiencies: number;
    armorProficiencies: string[];
    weaponProficiencies: string[];
    weaponMasterySlots?: number;
    startingEquipment?: string[];
    features: ClassFeature[];
    fightingStyles?: FightingStyle[];
    divineOrders?: DivineOrderOption[];
    primalOrders?: PrimalOrderOption[];
    warlockPatrons?: WarlockPatronOption[];
    spellcasting?: {
        ability: AbilityScoreName;
        knownCantrips: number;
        knownSpellsL1: number;
        spellList: string[];
    };
    statRecommendationFocus?: AbilityScoreName[];
    statRecommendationDetails?: string;
    recommendedPointBuyPriorities?: AbilityScoreName[];
    /** Optional subclass data for specialized casters (e.g., Eldritch Knight) */
    subclass?: {
        id: string;
        name: string;
    };
}
export type MagicInitiateSource = 'bard' | 'cleric' | 'druid' | 'sorcerer' | 'warlock' | 'wizard';
/**
 * Configuration for a spell choice requirement in a feat.
 * Supports filtering by level, school, and attack type.
 */
export interface FeatSpellRequirement {
    /** How many spells must be chosen */
    count: number;
    /** Spell level (0 = cantrip, 1 = 1st level, etc.) */
    level: number;
    /** Filter by spell school(s) */
    schools?: SpellSchool[];
    /** Only spells that require an attack roll */
    requiresAttack?: boolean;
    /** Description shown to user explaining what they can pick */
    description: string;
}
/**
 * A spell automatically granted by a feat, with usage restrictions.
 */
export interface FeatGrantedSpell {
    /** The spell ID (must match spell data) */
    spellId: string;
    /** How often the spell can be cast */
    castingMethod: 'at_will' | 'once_per_long_rest' | 'once_per_short_rest';
    /** Special notes about modifications (e.g., "Range extended to 60 ft") */
    specialNotes?: string;
}
/**
 * Spell-related benefits for a feat.
 */
export interface FeatSpellBenefits {
    /** For Magic Initiate: which class spell lists can be chosen from */
    selectableSpellSource?: MagicInitiateSource[];
    /** Spells that require player choice */
    spellChoices?: FeatSpellRequirement[];
    /** Spells automatically granted (no choice needed) */
    grantedSpells?: FeatGrantedSpell[];
}
export interface Feat {
    id: string;
    name: string;
    description: string;
    prerequisites?: {
        minLevel?: number;
        abilityScores?: Partial<AbilityScores>;
        raceId?: string;
        classId?: string;
        requiresFightingStyle?: boolean;
    };
    benefits?: {
        abilityScoreIncrease?: Partial<AbilityScores>;
        selectableAbilityScores?: AbilityScoreName[];
        skillProficiencies?: string[];
        /** Number of skills player must choose (e.g., Skilled = 3). TODO(FEATURES): Implement skill selection UI in character builder (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path). */
        selectableSkillCount?: number;
        savingThrowProficiencies?: AbilityScoreName[];
        /** If true, saving throw proficiency matches the selected ability score (for Resilient feat). */
        savingThrowLinkedToAbility?: boolean;
        /** Damage types player can choose from (e.g., Elemental Adept). TODO(FEATURES): Implement damage type selection UI (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path). */
        selectableDamageTypes?: string[];
        speedIncrease?: number;
        initiativeBonus?: number;
        hpMaxIncreasePerLevel?: number;
        resistance?: string[];
        spellBenefits?: FeatSpellBenefits;
    };
}
export interface FeatPrerequisiteContext {
    level: number;
    abilityScores: AbilityScores;
    raceId?: string;
    classId?: string;
    knownFeats?: string[];
    hasFightingStyle?: boolean;
}
export interface FeatChoice {
    selectedAbilityScore?: AbilityScoreName;
    selectedSpells?: string[];
    selectedCantrips?: string[];
    selectedLeveledSpells?: string[];
    selectedSpellSource?: MagicInitiateSource | string;
    selectedSkills?: string[];
    selectedWeapons?: string[];
    selectedTools?: string[];
    selectedDamageType?: string;
    [key: string]: unknown;
}
export interface LevelUpChoices {
    classId?: string;
    abilityScoreIncreases?: Partial<AbilityScores>;
    featId?: string;
    featChoices?: {
        [featId: string]: FeatChoice;
    };
}
export interface ResourceVial {
    current: number;
    max: number;
}
export type SpellSlots = Record<`level_${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`, ResourceVial>;
export interface SpellbookData {
    knownSpells: string[];
    preparedSpells: string[];
    cantrips: string[];
}
export type ResetCondition = 'short_rest' | 'long_rest' | 'daily' | 'combat';
export interface LimitedUseAbility {
    name: string;
    current: number;
    max: number | 'proficiency_bonus' | 'charisma_mod' | 'strength_mod' | 'dexterity_mod' | 'constitution_mod' | 'intelligence_mod' | 'wisdom_mod';
    resetOn: ResetCondition;
}
export type LimitedUses = Record<string, LimitedUseAbility>;
export type HitDieSize = 6 | 8 | 10 | 12;
export interface HitPointDicePool {
    die: HitDieSize;
    current: number;
    max: number;
}
export type HitPointDiceSpend = Partial<Record<HitDieSize, number>>;
export type HitPointDiceSpendMap = Record<string, HitPointDiceSpend>;
export interface RacialSelectionData {
    choiceId?: string;
    spellAbility?: AbilityScoreName;
    skillIds?: string[];
}
export type TransportMode = 'foot' | 'mounted';
export interface PlayerCharacter {
    id: string;
    name: string;
    soul?: any;
    age?: number;
    ageSizeOverride?: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
    background?: string;
    level?: number;
    xp?: number;
    proficiencyBonus?: number;
    race: Race;
    class: Class;
    /**
     * Legacy multiclass/backup class list used by older systems (puzzles/skill checks).
     * TODO(lint-preserve): Migrate those systems to the primary `class` field and remove this fallback.
     */
    classes?: Class[];
    /**
     * Optional class-level breakdown used for multiclass features (e.g., Hit Dice pools).
     * When absent, systems assume the full level belongs to `class`.
     */
    classLevels?: Record<string, number>;
    abilityScores: AbilityScores;
    finalAbilityScores: AbilityScores;
    /**
     * Legacy statline kept for puzzle/lock/plate systems that still rely on lowercase ability keys.
     * TODO(lint-preserve): Consolidate callers onto `finalAbilityScores` and drop this shim once migrated.
     */
    stats?: CharacterStats;
    skills: Skill[];
    savingThrowProficiencies?: AbilityScoreName[];
    feats?: string[];
    initiativeBonus?: number;
    hp: number;
    maxHp: number;
    /**
     * Hit Point Dice (Hit Dice) available for spending during Short Rests.
     * 2024 rules: a character has 1 at level 1 and gains 1 each level thereafter.
     * Long Rests restore all spent Hit Point Dice.
     */
    hitPointDice?: HitPointDicePool[];
    armorClass: number;
    speed: number;
    darkvisionRange: number;
    selectedWeaponMasteries?: string[];
    transportMode: TransportMode;
    spellcastingAbility?: 'intelligence' | 'wisdom' | 'charisma';
    spellSlots?: SpellSlots;
    spellbook?: SpellbookData;
    limitedUses?: LimitedUses;
    activeEffects?: ActiveEffect[];
    statusEffects: StatusEffect[];
    conditions?: string[];
    selectedFightingStyle?: FightingStyle;
    selectedDivineOrder?: 'Protector' | 'Thaumaturge';
    selectedDruidOrder?: 'Magician' | 'Warden';
    selectedWarlockPatron?: string;
    racialSelections?: Record<string, RacialSelectionData>;
    featChoices?: {
        [featId: string]: FeatChoice;
    };
    equippedItems: Partial<Record<EquipmentSlotType, Item>>;
    /** Text description of character appearance for AI portrait generation */
    visualDescription?: string;
    /** URL (local path or https URL) for an AI-generated character portrait */
    portraitUrl?: string;
    /** Visual customization for layered sprites */
    visuals?: {
        gender: 'Male' | 'Female';
        skinColor: number;
        hairStyle?: string;
        clothingStyle?: string;
        pantsStyle?: string;
        bootsStyle?: string;
    };
    /** Rich NPC data from the NPC generator for party members with full biography details */
    richNpcData?: {
        /** Character age based on race-appropriate ranges */
        age: number;
        /** Family members generated for the character */
        family: FamilyMember[];
        /** Full physical description text from NPC generator */
        physicalDescription: string;
        /** Background ID for the character */
        backgroundId: string;
    };
}
export interface TempPartyMember {
    id: string;
    name: string;
    level: number;
    classId: string;
}
export interface SelectableClass {
    id: string;
    name: string;
    description: string;
}
export interface MissingChoiceOption {
    id: string;
    label: string;
    description?: string;
    [key: string]: unknown;
}
export interface MissingChoice {
    id: string;
    label: string;
    description: string;
    type: 'race' | 'class';
    options: MissingChoiceOption[];
}
