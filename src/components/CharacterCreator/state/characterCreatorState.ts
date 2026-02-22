// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 * 
 * Last Sync: 08/02/2026, 15:57:53
 * Dependents: CharacterCreator.tsx, CreationSidebar.tsx, FeatSelection.tsx, LevelUpModal.tsx, NameAndReview.tsx, sidebarSteps.ts, useCharacterAssembly.ts, useCharacterAssembly.ts
 * Imports: 4 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/CharacterCreator/state/characterCreatorState.ts
 * Defines the state structure, initial state, actions, and reducer for the CharacterCreator component.
 */
import {
  Race,
  Class as CharClass,
  AbilityScores,
  Skill,
  Spell,
  FightingStyle,
  AbilityScoreName,
  DraconicAncestorType,
  ElvenLineageType,
  GnomeSubraceType,
  GiantAncestryType,
  FiendishLegacyType,
  RacialSelectionData,
} from '../../../types';
import { CharacterVisualConfig } from '../../../services/CharacterAssetService';
import { FEATS_DATA } from '../../../data/feats/featsData';
import { calculateFixedRacialBonuses, evaluateFeatPrerequisites } from '../../../utils/characterUtils';

// --- Enums and Types ---
export enum CreationStep {
  Race,
  AgeSelection,
  BackgroundSelection,
  Visuals,
  Class,
  AbilityScores,
  HumanSkillChoice,
  Skills,
  ClassFeatures,
  WeaponMastery,
  FeatSelection,
  NameAndReview,
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
  selectedFeat: string | null;
  featChoices?: Record<string, FeatChoiceState>;
  characterName: string;
  characterAge: number;
  selectedBackground: string | null;
  featStepSkipped?: boolean;
  visuals: CharacterVisualConfig;
  /** Optional appearance/portrait prompt text entered by the player. */
  visualDescription: string;
  portrait: {
    status: PortraitGenerationStatus;
    url: string | null;
    error: string | null;
    requestedForName: string | null;
  };
}

export type ClassFeatureFinalSelectionAction =
  | { type: 'SELECT_FIGHTER_FEATURES'; payload: FightingStyle }
  | { type: 'SELECT_CLERIC_FEATURES'; payload: { order: 'Protector' | 'Thaumaturge', cantrips: Spell[]; spellsL1: Spell[] } }
  | { type: 'SELECT_WIZARD_FEATURES'; payload: { cantrips: Spell[]; spellsL1: Spell[] } }
  | { type: 'SELECT_ARTIFICER_FEATURES'; payload: { cantrips: Spell[]; spellsL1: Spell[] } }
  | { type: 'SELECT_SORCERER_FEATURES'; payload: { cantrips: Spell[]; spellsL1: Spell[] } }
  | { type: 'SELECT_RANGER_FEATURES'; payload: { spellsL1: Spell[] } }
  | { type: 'SELECT_PALADIN_FEATURES'; payload: { spellsL1: Spell[] } }
  | { type: 'SELECT_BARD_FEATURES'; payload: { cantrips: Spell[]; spellsL1: Spell[] } }
  | { type: 'SELECT_DRUID_FEATURES'; payload: { order: 'Magician' | 'Warden', cantrips: Spell[]; spellsL1: Spell[] } }
  | { type: 'SELECT_WARLOCK_FEATURES'; payload: { cantrips: Spell[]; spellsL1: Spell[] } };

export type CharacterCreatorAction =
  | { type: 'SET_STEP'; payload: CreationStep }
  | { type: 'SELECT_RACE'; payload: Race }
  | { type: 'SET_RACIAL_SELECTION'; payload: { raceId: string; patch: Partial<RacialSelectionData> } }
  | { type: 'SELECT_VISUALS'; payload: Partial<CharacterVisualConfig> }
  | { type: 'SELECT_CLASS'; payload: CharClass }
  | { type: 'SET_ABILITY_SCORES'; payload: { baseScores: AbilityScores } }
  | { type: 'SELECT_HUMAN_SKILL'; payload: string }
  | { type: 'SELECT_SKILLS'; payload: Skill[] }
  | ClassFeatureFinalSelectionAction
  | { type: 'SELECT_WEAPON_MASTERIES'; payload: string[] }
  | { type: 'SELECT_FEAT'; payload: string }
  | { type: 'SET_FEAT_CHOICE'; payload: { featId: string; choiceType: string; value: FeatChoiceValue } }
  | { type: 'CONFIRM_FEAT_STEP' }
  | { type: 'SET_CHARACTER_NAME'; payload: string }
  | { type: 'SET_VISUAL_DESCRIPTION'; payload: string }
  | { type: 'PORTRAIT_REQUEST_START'; payload: { requestedForName: string | null } }
  | { type: 'PORTRAIT_POLL_START' }
  | { type: 'PORTRAIT_REQUEST_SUCCESS'; payload: { url: string } }
  | { type: 'PORTRAIT_REQUEST_ERROR'; payload: { error: string } }
  | { type: 'PORTRAIT_REQUEST_CANCEL' }
  | { type: 'CLEAR_PORTRAIT' }
  | { type: 'SET_CHARACTER_AGE'; payload: number }
  | { type: 'SELECT_BACKGROUND'; payload: string }
  | { type: 'GO_BACK' }
  | { type: 'NAVIGATE_TO_STEP'; payload: CreationStep };

// --- Initial State ---
export const initialCharacterCreatorState: CharacterCreationState = {
  step: CreationStep.Race,
  selectedRace: null,
  racialSpellChoiceContext: null,
  racialSelections: {},
  selectedClass: null,
  baseAbilityScores: null,
  finalAbilityScores: null,
  selectedSkills: [],
  selectedFightingStyle: null,
  selectedDivineOrder: null,
  selectedDruidOrder: null,
  selectedWarlockPatron: null,
  selectedCantrips: [],
  selectedSpellsL1: [],
  selectedWeaponMasteries: null,
  selectedFeat: null,
  featChoices: {},
  characterName: '',
  characterAge: 25, // Default age
  selectedBackground: null,
  featStepSkipped: false,
  visuals: {
    gender: 'Male',
    skinColor: 1,
    hairStyle: 'Hair1',
    hairColor: 'Black',
    clothing: 'Clothing1',
  },
  visualDescription: '',
  portrait: {
    status: 'idle',
    url: null,
    error: null,
    requestedForName: null,
  },
};

// --- Reducer Helper Functions ---

/**
 * Determines the next step after race selection.
 * Race-specific sub-selections (ancestry, lineage, etc.) come BEFORE age/background.
 */
function determineNextStepAfterRace(_race: Race): CreationStep {
  return CreationStep.AgeSelection;
}

const getResetStateForNewRace = (): Partial<CharacterCreationState> => {
  const { step, selectedRace, characterName, ...resettableFields } = initialCharacterCreatorState;
  return { ...resettableFields, racialSelections: {} };
};

// Determine whether the feat step should even appear for the current snapshot of the character.
// We compute this in the reducer so navigation/backtracking logic can skip the screen entirely when nothing qualifies.
const canOfferFeatAtLevelOne = (state: CharacterCreationState): boolean => {
  if (!state.selectedRace || !state.selectedClass || !state.finalAbilityScores) {
    return false;
  }

  // Humans get the Versatile trait which grants access to feat selection at level 1
  if (state.selectedRace.id === 'human') {
    return true;
  }

  return FEATS_DATA.some(feat => {
    const eligibility = evaluateFeatPrerequisites(feat, {
      level: 1,
      abilityScores: state.finalAbilityScores!,
      raceId: state.selectedRace!.id,
      classId: state.selectedClass!.id,
      // Avoid treating the in-progress choice as already learned; we only want to filter out
      // feats that fail real prerequisites for this snapshot of the character.
      knownFeats: [],
    });
    return eligibility.isEligible;
  });
};

const getFeatStepOrReview = (state: CharacterCreationState): { step: CreationStep; skipped: boolean } => {
  const canOffer = canOfferFeatAtLevelOne(state) || !!state.selectedFeat;
  return {
    step: canOffer ? CreationStep.FeatSelection : CreationStep.NameAndReview,
    skipped: !canOffer,
  };
};

const getFieldsToResetOnGoBack = (state: CharacterCreationState, exitedStep: CreationStep): Partial<CharacterCreationState> => {
  const resetFields: Partial<CharacterCreationState> = {};
  const pruneRacialSelection = (key: string) => {
    const nextSelections = { ...state.racialSelections };
    delete nextSelections[key];
    resetFields.racialSelections = nextSelections;
  };

  switch (exitedStep) {
    case CreationStep.Class:
      resetFields.selectedClass = null;
      break;
    case CreationStep.AbilityScores:
      resetFields.baseAbilityScores = null;
      resetFields.finalAbilityScores = null;
      break;
    case CreationStep.HumanSkillChoice:
      pruneRacialSelection('human');
      break;
    case CreationStep.Skills:
      resetFields.selectedSkills = [];
      break;
    case CreationStep.ClassFeatures:
      resetFields.selectedFightingStyle = null;
      resetFields.selectedDivineOrder = null;
      resetFields.selectedDruidOrder = null;
      resetFields.selectedWarlockPatron = null;
      resetFields.selectedCantrips = [];
      resetFields.selectedSpellsL1 = [];
      break;
    case CreationStep.WeaponMastery:
      resetFields.selectedWeaponMasteries = null;
      break;
    case CreationStep.FeatSelection:
      resetFields.selectedFeat = null;
      break;
    case CreationStep.NameAndReview:
      break;
    default: break;
  }
  return resetFields;
};

// Centralizes the step that immediately precedes the feat screen so we can reuse the same logic for back navigation from review.
const getPreviousStepBeforeFeat = (state: CharacterCreationState): CreationStep => {
  return (state.selectedClass?.weaponMasterySlots ?? 0) > 0
    ? CreationStep.WeaponMastery
    : (state.selectedClass?.fightingStyles || state.selectedClass?.spellcasting ? CreationStep.ClassFeatures : CreationStep.Skills);
};

interface StepDefinition {
  previousStep: (state: CharacterCreationState) => CreationStep;
}

const stepDefinitions: Record<CreationStep, StepDefinition> = {
  [CreationStep.Race]: { previousStep: () => CreationStep.Race },
  [CreationStep.AgeSelection]: { previousStep: () => CreationStep.Race },
  [CreationStep.BackgroundSelection]: { previousStep: () => CreationStep.AgeSelection },
  [CreationStep.Visuals]: { previousStep: () => CreationStep.BackgroundSelection },
  [CreationStep.Class]: { previousStep: () => CreationStep.Visuals },
  [CreationStep.AbilityScores]: { previousStep: () => CreationStep.Class },
  [CreationStep.HumanSkillChoice]: { previousStep: () => CreationStep.AbilityScores },
  [CreationStep.Skills]: {
    previousStep: (state) => (state.selectedRace?.id === 'human' ? CreationStep.HumanSkillChoice : CreationStep.AbilityScores)
  },
  [CreationStep.ClassFeatures]: { previousStep: () => CreationStep.Skills },
  [CreationStep.WeaponMastery]: { previousStep: (state) => (state.selectedClass?.fightingStyles || state.selectedClass?.spellcasting ? CreationStep.ClassFeatures : CreationStep.Skills) },
  [CreationStep.FeatSelection]: { previousStep: (state) => getPreviousStepBeforeFeat(state) },
  [CreationStep.NameAndReview]: {
    previousStep: (state) => {
      // Only surface the feat screen when it actually applies; otherwise drop to the step that would have fed it.
      return (canOfferFeatAtLevelOne(state) || state.selectedFeat)
        ? CreationStep.FeatSelection
        : getPreviousStepBeforeFeat(state);
    },
  },
};

function isClassFeatureFinalSelectionAction(action: CharacterCreatorAction): action is ClassFeatureFinalSelectionAction {
  return [
    'SELECT_FIGHTER_FEATURES', 'SELECT_CLERIC_FEATURES', 'SELECT_WIZARD_FEATURES', 'SELECT_ARTIFICER_FEATURES',
    'SELECT_SORCERER_FEATURES', 'SELECT_RANGER_FEATURES', 'SELECT_PALADIN_FEATURES',
    'SELECT_BARD_FEATURES', 'SELECT_DRUID_FEATURES', 'SELECT_WARLOCK_FEATURES'
  ].includes(action.type);
}

function handleClassFeatureFinalSelectionAction(state: CharacterCreationState, action: ClassFeatureFinalSelectionAction): CharacterCreationState {
  const resolveStepAfterFeature = (candidate: CharacterCreationState): { step: CreationStep; featStepSkipped: boolean } => {
    if ((state.selectedClass?.weaponMasterySlots ?? 0) > 0) {
      return { step: CreationStep.WeaponMastery, featStepSkipped: false };
    }
    const { step, skipped } = getFeatStepOrReview(candidate);
    return { step, featStepSkipped: skipped };
  };

  const applyFeaturesAndAdvance = (featureState: Partial<CharacterCreationState>): CharacterCreationState => {
    const nextState = { ...state, ...featureState };
    const { step, featStepSkipped } = resolveStepAfterFeature(nextState);
    return { ...nextState, step, featStepSkipped };
  };

  switch (action.type) {
    case 'SELECT_FIGHTER_FEATURES':
      return applyFeaturesAndAdvance({ selectedFightingStyle: action.payload });
    case 'SELECT_CLERIC_FEATURES':
      return applyFeaturesAndAdvance({
        selectedDivineOrder: action.payload.order,
        selectedCantrips: action.payload.cantrips,
        selectedSpellsL1: action.payload.spellsL1,
      });
    case 'SELECT_DRUID_FEATURES':
      return applyFeaturesAndAdvance({
        selectedDruidOrder: action.payload.order,
        selectedCantrips: action.payload.cantrips,
        selectedSpellsL1: action.payload.spellsL1,
      });
    case 'SELECT_WIZARD_FEATURES':
    case 'SELECT_ARTIFICER_FEATURES':
    case 'SELECT_SORCERER_FEATURES':
    case 'SELECT_BARD_FEATURES':
    case 'SELECT_WARLOCK_FEATURES':
      return applyFeaturesAndAdvance({
        selectedCantrips: action.payload.cantrips,
        selectedSpellsL1: action.payload.spellsL1,
      });
    case 'SELECT_RANGER_FEATURES':
    case 'SELECT_PALADIN_FEATURES':
      return applyFeaturesAndAdvance({ selectedSpellsL1: action.payload.spellsL1 });
    default:
      return state;
  }
}

// --- Reducer ---
export function characterCreatorReducer(state: CharacterCreationState, action: CharacterCreatorAction): CharacterCreationState {
  if (isClassFeatureFinalSelectionAction(action)) {
    return handleClassFeatureFinalSelectionAction(state, action);
  }

  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'SET_RACIAL_SELECTION': {
      const { raceId, patch } = action.payload;
      const prev = state.racialSelections[raceId] ?? {};
      return {
        ...state,
        racialSelections: {
          ...state.racialSelections,
          [raceId]: {
            ...prev,
            ...patch,
          },
        },
      };
    }
    case 'SELECT_RACE': {
      const race = action.payload;
      // Only reset if the race actually changes
      if (state.selectedRace?.id === race.id) {
         const nextStep = determineNextStepAfterRace(race);
         return { ...state, step: nextStep };
      }

      const nextStep = determineNextStepAfterRace(race);
      const spellChoiceContext = race.racialSpellChoice
        ? {
          raceName: race.name,
          traitName: race.racialSpellChoice.traitName,
          traitDescription: race.racialSpellChoice.traitDescription,
        }
        : null;

      return {
        ...state,
        ...getResetStateForNewRace(),
        selectedRace: race,
        racialSpellChoiceContext: spellChoiceContext,
        step: nextStep,
      };
    }
    case 'SET_CHARACTER_AGE': {
      return { ...state, characterAge: action.payload };
    }
    case 'SELECT_BACKGROUND': {
      return { ...state, selectedBackground: action.payload };
    }
    case 'SELECT_VISUALS': {
      return { ...state, visuals: { ...state.visuals, ...action.payload } };
    }
    case 'SELECT_CLASS': {
      const newClass = action.payload;
      // Only reset downstream if class changes
      if (state.selectedClass?.id === newClass.id) {
         return { ...state, step: CreationStep.AbilityScores };
      }
      
      // Reset class-dependent fields
      return { 
        ...state, 
        selectedClass: newClass,
        selectedSkills: [],
        selectedFightingStyle: null,
        selectedDivineOrder: null,
        selectedDruidOrder: null,
        selectedWarlockPatron: null,
        selectedCantrips: [],
        selectedSpellsL1: [],
        selectedWeaponMasteries: null,
        selectedFeat: null, // Feats might depend on class prerequisites
        portrait: { ...initialCharacterCreatorState.portrait },
        step: CreationStep.AbilityScores 
      };
    }
    case 'SET_ABILITY_SCORES': {
      const baseScores = action.payload.baseScores;
      const finalScores = state.selectedRace ? calculateFixedRacialBonuses(baseScores, state.selectedRace) : baseScores;
      const nextStep = state.selectedRace?.id === 'human' ? CreationStep.HumanSkillChoice : CreationStep.Skills;
      return { ...state, baseAbilityScores: baseScores, finalAbilityScores: finalScores, step: nextStep };
    }
    case 'SELECT_HUMAN_SKILL': {
      const nextSelections = {
        ...state.racialSelections,
        human: { ...(state.racialSelections['human'] ?? {}), skillIds: [action.payload] },
      };
      return { ...state, racialSelections: nextSelections, step: CreationStep.Skills };
    }
    case 'SELECT_SKILLS': {
      const nextState = { ...state, selectedSkills: action.payload };
      // If class features exist, go there; otherwise skip forward.
      const hasClassFeatures = !!(state.selectedClass?.fightingStyles || state.selectedClass?.spellcasting);
      if (hasClassFeatures) return { ...nextState, step: CreationStep.ClassFeatures };
      if ((state.selectedClass?.weaponMasterySlots ?? 0) > 0) return { ...nextState, step: CreationStep.WeaponMastery, featStepSkipped: false };
      const { step, skipped } = getFeatStepOrReview(nextState);
      return { ...nextState, step, featStepSkipped: skipped };
    }
    case 'SELECT_WEAPON_MASTERIES': {
      const nextState = { ...state, selectedWeaponMasteries: action.payload };
      const { step, skipped } = getFeatStepOrReview(nextState);
      return { ...nextState, step, featStepSkipped: skipped };
    }
    case 'SELECT_FEAT': {
      return { ...state, selectedFeat: action.payload || null };
    }
    case 'SET_FEAT_CHOICE': {
      const { featId, choiceType, value } = action.payload;
      return {
        ...state,
        featChoices: {
          ...(state.featChoices ?? {}),
          [featId]: {
            ...(state.featChoices?.[featId] ?? {}),
            [choiceType]: value,
          },
        },
      };
    }
    case 'CONFIRM_FEAT_STEP': {
      // The user has completed the feat step (with or without a selection).
      // Always advance to NameAndReview — do NOT call getFeatStepOrReview here,
      // as that function determines whether to SHOW the feat step, not what comes after it.
      return { ...state, step: CreationStep.NameAndReview, featStepSkipped: false };
    }
    case 'SET_CHARACTER_NAME': {
      return { ...state, characterName: action.payload };
    }
    case 'SET_VISUAL_DESCRIPTION': {
      return { ...state, visualDescription: action.payload };
    }
    case 'PORTRAIT_REQUEST_START': {
      return {
        ...state,
        portrait: {
          ...state.portrait,
          status: 'requesting',
          error: null,
          requestedForName: action.payload.requestedForName,
        },
      };
    }
    case 'PORTRAIT_POLL_START': {
      return {
        ...state,
        portrait: {
          ...state.portrait,
          status: 'polling',
          error: null,
        },
      };
    }
    case 'PORTRAIT_REQUEST_SUCCESS': {
      return {
        ...state,
        portrait: {
          ...state.portrait,
          status: 'ready',
          url: action.payload.url,
          error: null,
        },
      };
    }
    case 'PORTRAIT_REQUEST_ERROR': {
      return {
        ...state,
        portrait: {
          ...state.portrait,
          status: 'error',
          error: action.payload.error,
        },
      };
    }
    case 'PORTRAIT_REQUEST_CANCEL': {
      return {
        ...state,
        portrait: {
          ...state.portrait,
          status: 'idle',
          error: null,
          requestedForName: null,
        },
      };
    }
    case 'CLEAR_PORTRAIT': {
      return { ...state, portrait: { ...initialCharacterCreatorState.portrait } };
    }
    case 'GO_BACK': {
      const currentStep = state.step;
      if (currentStep === CreationStep.Race) return state;
      const targetPrevStep = stepDefinitions[currentStep]?.previousStep(state) ?? CreationStep.Race;
      // NON-DESTRUCTIVE BACK NAVIGATION:
      // We no longer reset fields on back. Data is only wiped when a dependency (Race/Class) changes.
      return { ...state, step: targetPrevStep };
    }
    case 'NAVIGATE_TO_STEP': {
      const targetStep = action.payload;
      // Sidebar navigation does NOT reset data - it just changes the current view.
      // Steps are freely navigable regardless of completion.
      if (targetStep === state.step) return state;
      return { ...state, step: targetStep };
    }
    default:
      return state;
  }
}
