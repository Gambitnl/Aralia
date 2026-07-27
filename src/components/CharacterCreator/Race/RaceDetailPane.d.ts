/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/07/2026, 08:10:30
 * Dependents: components/CharacterCreator/CharacterCreator.tsx, components/CharacterCreator/Race/RaceSelection.tsx, components/CharacterCreator/randomizeCreation.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file RaceDetailPane.tsx
 * Detailed view of a selected race, designed for the right pane of the Split Config layout.
 */
import React from 'react';
export interface RaceDetailData {
    id: string;
    name: string;
    /** @deprecated Use maleImage/femaleImage instead */
    image?: string;
    /** Path to male character illustration */
    maleImage?: string;
    /** Path to female character illustration */
    femaleImage?: string;
    description: string;
    baseTraits: {
        type?: string;
        size?: string;
        speed?: number;
        darkvision?: number;
    };
    feats: {
        name: string;
        description: string;
    }[];
    furtherChoicesNote?: string;
    /** Sibling variants for comparison table (if this race belongs to a group) */
    siblingVariants?: Array<{
        id: string;
        name: string;
        speed?: number;
        darkvision?: number;
        keyTraits: string[];
        traitDescriptions: Record<string, string>;
    }>;
    /** Racial spell choice configuration (if race requires spellcasting ability selection) */
    racialSpellChoice?: {
        traitName: string;
        traitDescription: string;
        source?: 'parser' | 'legacy';
    };
    spellsOfTheMark?: {
        minLevel: number;
        spells: string[];
    }[];
    modernizationStatus?: 'official_2024' | 'modified_legacy';
}
type AbilityScoreName = 'Intelligence' | 'Wisdom' | 'Charisma';
export interface RacialChoiceData {
    spellAbility?: AbilityScoreName;
    /** Elf - Keen Senses (pick 1 of 3) */
    keenSensesSkillId?: string;
    /** Centaur - Natural Affinity (pick 1 of 4) */
    centaurNaturalAffinitySkillId?: string;
    /** Changeling - Instincts (pick 2 of 5) */
    changelingInstinctSkillIds?: string[];
    /** Changeling - Size (Small or Medium) */
    changelingSize?: 'Small' | 'Medium';
    /** Generic skill choices (e.g. Kender, Kenku, Warforged, Half-Elf) */
    genericSkillChoices?: string[];
    /** Generic tool choices (e.g. Autognome, Dwarves, Warforged) */
    genericToolChoices?: string[];
    /** Generic cantrip choices (e.g. Astral Elf, High Elf) */
    genericCantripChoices?: string[];
}
interface RaceDetailPaneProps {
    race: RaceDetailData;
    onSelect: (raceId: string, choices?: RacialChoiceData) => void;
    selectedSpellAbility?: AbilityScoreName | null;
    onSpellAbilityChange?: (ability: AbilityScoreName) => void;
    selectedKeenSensesSkillId?: string | null;
    onKeenSensesSkillChange?: (skillId: string) => void;
    selectedCentaurNaturalAffinitySkillId?: string | null;
    onCentaurNaturalAffinitySkillChange?: (skillId: string) => void;
    selectedChangelingInstinctSkillIds?: Set<string>;
    onChangelingInstinctSkillToggle?: (skillId: string) => void;
    selectedChangelingSize?: 'Small' | 'Medium' | null;
    onChangelingSizeChange?: (size: 'Small' | 'Medium') => void;
    racialSkillChoices?: string[];
    onRacialSkillChoiceToggle?: (skillId: string, maxChoices: number) => void;
    racialToolChoices?: string[];
    onRacialToolChoiceToggle?: (toolId: string, maxChoices: number) => void;
    racialCantripChoices?: string[];
    onRacialCantripChoiceToggle?: (cantripId: string, maxChoices: number) => void;
}
export declare const RaceDetailPane: React.FC<RaceDetailPaneProps & {
    children?: React.ReactNode;
}>;
export {};
