/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 02/06/2026, 11:58:31
 * Dependents: components/CharacterCreator/CharacterCreator.tsx, components/CharacterCreator/CreationSidebar.tsx, components/CharacterCreator/FeatSelection.tsx, components/CharacterCreator/NameAndReview.tsx, components/CharacterCreator/config/sidebarSteps.ts, components/CharacterCreator/hooks/useCharacterAssembly.ts, components/CharacterSheet/LevelUpModal.tsx, hooks/useCharacterAssembly.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * ARCHITECTURAL CONTEXT:
 * This file manages the complex state machine for the 'Character Creator'.
 * It uses a Reducer pattern (characterCreatorReducer) to handle step-by-step
 * navigation and data accumulation.
 */
import { Race, Class as CharClass, AbilityScores, Skill, Spell, FightingStyle, AbilityScoreName, RacialSelectionData } from '../../../types';
import { CharacterVisualConfig } from '../../../services/CharacterAssetService';
export declare enum CreationStep {
    Race = 0,
    AgeSelection = 1,
    BackgroundSelection = 2,
    BackgroundFeatSelection = 3,
    Visuals = 4,
    Class = 5,
    AbilityScores = 6,
    HumanSkillChoice = 7,
    Skills = 8,
    ClassFeatures = 9,
    WeaponMastery = 10,
    RacialFeatSelection = 11,
    FeatSelection = 11,
    NameAndReview = 12
}
export type FeatChoiceValue = AbilityScoreName | string | string[] | undefined;
export type FeatChoiceState = {
    selectedAbilityScore?: AbilityScoreName;
    selectedSpells?: string[];
    selectedCantrips?: string[];
    selectedLeveledSpells?: string[];
    selectedSpellSource?: string;
    selectedSkills?: string[];
    selectedWeapons?: string[];
    selectedTools?: string[];
    selectedDamageType?: string;
    [key: string]: FeatChoiceValue;
};
export type PortraitGenerationStatus = 'idle' | 'requesting' | 'polling' | 'ready' | 'error';
export interface CharacterCreationState {
    step: CreationStep;
    selectedRace: Race | null;
    racialSpellChoiceContext: {
        raceName: string;
        traitName: string;
        traitDescription: string;
    } | null;
    racialSelections: Record<string, RacialSelectionData>;
    selectedClass: CharClass | null;
    baseAbilityScores: AbilityScores | null;
    finalAbilityScores: AbilityScores | null;
    selectedSkills: Skill[];
    selectedFightingStyle: FightingStyle | null;
    selectedDivineOrder: 'Protector' | 'Thaumaturge' | null;
    selectedDruidOrder: 'Magician' | 'Warden' | null;
    selectedWarlockPatron: string | null;
    selectedCantrips: Spell[];
    selectedSpellsL1: Spell[];
    selectedWeaponMasteries: string[] | null;
    backgroundFeatId: string | null;
    racialFeatId: string | null;
    featChoices?: Record<string, FeatChoiceState>;
    characterName: string;
    characterAge: number;
    selectedBackground: string | null;
    featStepSkipped?: boolean;
    visuals: CharacterVisualConfig;
    visualDescription: string;
    portrait: {
        status: PortraitGenerationStatus;
        url: string | null;
        error: string | null;
        requestedForName: string | null;
    };
}
export type ClassFeatureFinalSelectionAction = {
    type: 'SELECT_FIGHTER_FEATURES';
    payload: FightingStyle;
} | {
    type: 'SELECT_CLERIC_FEATURES';
    payload: {
        order: 'Protector' | 'Thaumaturge';
        cantrips: Spell[];
        spellsL1: Spell[];
    };
} | {
    type: 'SELECT_WIZARD_FEATURES';
    payload: {
        cantrips: Spell[];
        spellsL1: Spell[];
    };
} | {
    type: 'SELECT_ARTIFICER_FEATURES';
    payload: {
        cantrips: Spell[];
        spellsL1: Spell[];
    };
} | {
    type: 'SELECT_SORCERER_FEATURES';
    payload: {
        cantrips: Spell[];
        spellsL1: Spell[];
    };
} | {
    type: 'SELECT_RANGER_FEATURES';
    payload: {
        spellsL1: Spell[];
    };
} | {
    type: 'SELECT_PALADIN_FEATURES';
    payload: {
        spellsL1: Spell[];
    };
} | {
    type: 'SELECT_BARD_FEATURES';
    payload: {
        cantrips: Spell[];
        spellsL1: Spell[];
    };
} | {
    type: 'SELECT_DRUID_FEATURES';
    payload: {
        order: 'Magician' | 'Warden';
        cantrips: Spell[];
        spellsL1: Spell[];
    };
} | {
    type: 'SELECT_WARLOCK_FEATURES';
    payload: {
        cantrips: Spell[];
        spellsL1: Spell[];
    };
};
export type CharacterCreatorAction = {
    type: 'SET_STEP';
    payload: CreationStep;
} | {
    type: 'SELECT_RACE';
    payload: Race;
} | {
    type: 'SET_RACIAL_SELECTION';
    payload: {
        raceId: string;
        patch: Partial<RacialSelectionData>;
    };
} | {
    type: 'SELECT_VISUALS';
    payload: Partial<CharacterVisualConfig>;
} | {
    type: 'SELECT_CLASS';
    payload: CharClass;
} | {
    type: 'SET_ABILITY_SCORES';
    payload: {
        baseScores: AbilityScores;
    };
} | {
    type: 'SELECT_HUMAN_SKILL';
    payload: string;
} | {
    type: 'SELECT_SKILLS';
    payload: Skill[];
} | ClassFeatureFinalSelectionAction | {
    type: 'SELECT_WEAPON_MASTERIES';
    payload: string[];
} | {
    type: 'SELECT_BACKGROUND_FEAT';
    payload: string;
} | {
    type: 'SELECT_RACIAL_FEAT';
    payload: string;
} | {
    type: 'SET_FEAT_CHOICE';
    payload: {
        featId: string;
        choiceType: string;
        value: FeatChoiceValue;
    };
} | {
    type: 'CONFIRM_FEAT_STEP';
} | {
    type: 'SET_CHARACTER_NAME';
    payload: string;
} | {
    type: 'SET_VISUAL_DESCRIPTION';
    payload: string;
} | {
    type: 'PORTRAIT_REQUEST_START';
    payload: {
        requestedForName: string | null;
    };
} | {
    type: 'PORTRAIT_POLL_START';
} | {
    type: 'PORTRAIT_REQUEST_SUCCESS';
    payload: {
        url: string;
    };
} | {
    type: 'PORTRAIT_REQUEST_ERROR';
    payload: {
        error: string;
    };
} | {
    type: 'PORTRAIT_REQUEST_CANCEL';
} | {
    type: 'CLEAR_PORTRAIT';
} | {
    type: 'SET_CHARACTER_AGE';
    payload: number;
} | {
    type: 'SELECT_BACKGROUND';
    payload: string;
} | {
    type: 'GO_BACK';
} | {
    type: 'NAVIGATE_TO_STEP';
    payload: CreationStep;
} | {
    type: 'RESET_CREATOR';
};
export declare const initialCharacterCreatorState: CharacterCreationState;
/**
 * True for base humans AND human variants (e.g. Beastborn Human). Human-only
 * steps (Skillful, Racial Feat) must use this rather than `id === 'human'` so
 * variants are routed through the same steps the sidebar already lists for
 * them (see GAPS.md G13).
 */
export declare const isHumanLineage: (state: CharacterCreationState) => boolean;
export declare const getFeatStepOrReview: (state: CharacterCreationState) => {
    step: CreationStep;
    skipped: boolean;
};
export declare function characterCreatorReducer(state: CharacterCreationState, action: CharacterCreatorAction): CharacterCreationState;
