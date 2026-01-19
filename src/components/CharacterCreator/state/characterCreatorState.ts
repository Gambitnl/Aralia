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
  CentaurNaturalAffinitySkill,
  ChangelingInstincts,
  Class,
  AbilityScores,
  HumanSkillChoice,
  Skills,
  ClassFeatures,
  WeaponMastery,
  FeatSelection,
  Visuals,
  NameAndReview,
  DragonbornAncestry,
  ElvenLineage,
  GnomeSubrace,
  GiantAncestry,
  TieflingLegacy,
  RacialSpellAbilityChoice,
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

export type RaceSpecificFinalSelectionAction =
  | { type: 'SELECT_DRAGONBORN_ANCESTRY'; payload: DraconicAncestorType }
  | { type: 'SELECT_ELVEN_LINEAGE'; payload: { lineageId: ElvenLineageType; spellAbility: AbilityScoreName } }
  | { type: 'SELECT_GNOME_SUBRACE'; payload: { subraceId: GnomeSubraceType; spellAbility: AbilityScoreName } }
  | { type: 'SELECT_GIANT_ANCESTRY'; payload: GiantAncestryType }
  | { type: 'SELECT_TIEFLING_LEGACY'; payload: { legacyId: FiendishLegacyType; spellAbility: AbilityScoreName } };


export type CharacterCreatorAction =
  | { type: 'SET_STEP'; payload: CreationStep }
  | { type: 'SELECT_RACE'; payload: Race }
  | RaceSpecificFinalSelectionAction
  | { type: 'SELECT_RACIAL_SPELL_ABILITY'; payload: AbilityScoreName }
  | { type: 'SELECT_CENTAUR_NATURAL_AFFINITY_SKILL'; payload: string }
  | { type: 'SELECT_CHANGELING_INSTINCTS'; payload: string[] }
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
};

// --- Reducer Helper Functions ---

/**
 * Determines the next step after race selection.
 * Race-specific sub-selections (ancestry, lineage, etc.) come BEFORE age/background.
 */
function determineNextStepAfterRace(race: Race): CreationStep {
  // Race-specific sub-selections happen immediately after race choice
  if (race.id === 'dragonborn') return CreationStep.DragonbornAncestry;
  if (race.id === 'elf') return CreationStep.ElvenLineage;
  if (race.id === 'gnome') return CreationStep.GnomeSubrace;
  if (race.id === 'goliath') return CreationStep.GiantAncestry;
  if (race.id === 'tiefling') return CreationStep.TieflingLegacy;
  if (race.id === 'centaur') return CreationStep.CentaurNaturalAffinitySkill;
  if (race.id === 'changeling') return CreationStep.ChangelingInstincts;
  // Races without sub-selections go directly to age
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
    case CreationStep.CentaurNaturalAffinitySkill: pruneRacialSelection('centaur'); break;
    case CreationStep.ChangelingInstincts: pruneRacialSelection('changeling'); break;
    case CreationStep.DragonbornAncestry: pruneRacialSelection('dragonborn'); break;
    case CreationStep.ElvenLineage: pruneRacialSelection('elf'); break;
    case CreationStep.GnomeSubrace: pruneRacialSelection('gnome'); break;
    case CreationStep.GiantAncestry: pruneRacialSelection('goliath'); break;
    case CreationStep.TieflingLegacy: pruneRacialSelection('tiefling'); break;
    case CreationStep.RacialSpellAbilityChoice:
      if (state.selectedRace?.id) {
        pruneRacialSelection(state.selectedRace.id);
      }
      break;
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
  [CreationStep.CentaurNaturalAffinitySkill]: { previousStep: () => CreationStep.Race },
  [CreationStep.ChangelingInstincts]: { previousStep: () => CreationStep.Race },
  [CreationStep.DragonbornAncestry]: { previousStep: () => CreationStep.Race },
  [CreationStep.ElvenLineage]: { previousStep: () => CreationStep.Race },
  [CreationStep.GnomeSubrace]: { previousStep: () => CreationStep.Race },
  [CreationStep.GiantAncestry]: { previousStep: () => CreationStep.Race },
  [CreationStep.TieflingLegacy]: { previousStep: () => CreationStep.Race },
  [CreationStep.RacialSpellAbilityChoice]: { previousStep: () => CreationStep.AbilityScores },
  [CreationStep.AbilityScores]: { previousStep: () => CreationStep.Class },
  [CreationStep.Class]: { previousStep: () => CreationStep.Visuals },
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
    case 'SELECT_RACE': {
      const race = action.payload;
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
    case 'SELECT_DRAGONBORN_ANCESTRY':
      return { ...state, racialSelections: { ...state.racialSelections, dragonborn: { choiceId: action.payload } }, step: CreationStep.AgeSelection };
    case 'SELECT_ELVEN_LINEAGE':
      return {
        ...state,
        racialSelections: {
          ...state.racialSelections,
          elf: { choiceId: action.payload.lineageId, spellAbility: action.payload.spellAbility },
        },
        step: CreationStep.AgeSelection,
      };
    case 'SELECT_GNOME_SUBRACE':
      return {
        ...state,
        racialSelections: {
          ...state.racialSelections,
          gnome: { choiceId: action.payload.subraceId, spellAbility: action.payload.spellAbility },
        },
        step: CreationStep.AgeSelection,
      };
    case 'SELECT_GIANT_ANCESTRY':
      return { ...state, racialSelections: { ...state.racialSelections, goliath: { choiceId: action.payload } }, step: CreationStep.AgeSelection };
    case 'SELECT_TIEFLING_LEGACY':
      return {
        ...state,
        racialSelections: {
          ...state.racialSelections,
          tiefling: { choiceId: action.payload.legacyId, spellAbility: action.payload.spellAbility },
        },
        step: CreationStep.AgeSelection,
      };
    case 'SELECT_RACIAL_SPELL_ABILITY': {
      const raceId = state.selectedRace?.id;
      if (!raceId) {
        return state;
      }
      const nextStep = raceId === 'human' ? CreationStep.HumanSkillChoice : CreationStep.Skills;
      return {
        ...state,
        racialSelections: {
          ...state.racialSelections,
          [raceId]: {
            ...(state.racialSelections[raceId] || {}),
            spellAbility: action.payload,
          },
        },
        step: nextStep,
      };
    }
    case 'SELECT_CENTAUR_NATURAL_AFFINITY_SKILL': return { ...state, racialSelections: { ...state.racialSelections, centaur: { skillIds: [action.payload] } }, step: CreationStep.AgeSelection };
    case 'SELECT_CHANGELING_INSTINCTS': return { ...state, racialSelections: { ...state.racialSelections, changeling: { skillIds: action.payload } }, step: CreationStep.AgeSelection };
    case 'SELECT_VISUALS':
      return { ...state, visuals: { ...state.visuals, ...action.payload } };
    case 'SELECT_CLASS':
      return { ...state, selectedClass: action.payload, step: CreationStep.AbilityScores };
    case 'SET_ABILITY_SCORES': {
      const { baseScores } = action.payload;
      const finalScores = calculateFixedRacialBonuses(baseScores, state.selectedRace);

      const nextStep = state.racialSpellChoiceContext
        ? CreationStep.RacialSpellAbilityChoice
        : (state.selectedRace?.id === 'human' ? CreationStep.HumanSkillChoice : CreationStep.Skills);

      return { ...state, baseAbilityScores: baseScores, finalAbilityScores: finalScores, step: nextStep };
    }
    case 'SELECT_HUMAN_SKILL':
      return { ...state, racialSelections: { ...state.racialSelections, human: { skillIds: [action.payload] } }, step: CreationStep.Skills };
    case 'SELECT_SKILLS': {
      const hasFeatureStep = !!(state.selectedClass?.fightingStyles || state.selectedClass?.spellcasting);
      const hasWeaponMasteryStep = (state.selectedClass?.weaponMasterySlots ?? 0) > 0;

      if (hasFeatureStep) {
        return { ...state, selectedSkills: action.payload, step: CreationStep.ClassFeatures };
      }
      if (hasWeaponMasteryStep) {
        return { ...state, selectedSkills: action.payload, step: CreationStep.WeaponMastery };
      }

      // If the class has neither a feature nor mastery stop, jump straight to feats only when something is eligible.
      const nextState = { ...state, selectedSkills: action.payload };
      const { step, skipped } = getFeatStepOrReview(nextState);
      return { ...nextState, step, featStepSkipped: skipped };
    }
    case 'SELECT_WEAPON_MASTERIES': {
      // Always move into (or skip past) the feat picker so the user can opt in (or we auto-bypass when nothing qualifies).
      const nextState = { ...state, selectedWeaponMasteries: action.payload };
      const { step, skipped } = getFeatStepOrReview(nextState);
      return { ...nextState, step, featStepSkipped: skipped };
    }
    case 'SELECT_FEAT':
      // Selecting a feat no longer auto-advances so users can compare options or clear their pick before continuing.
      // Empty payloads clear the selection, ensuring downstream assembly does not apply stale bonuses.
      return { ...state, selectedFeat: action.payload || null };
    case 'SET_FEAT_CHOICE': {
      const { featId, choiceType, value } = action.payload;
      const currentChoices = state.featChoices || {};
      return {
        ...state,
        featChoices: {
          ...currentChoices,
          [featId]: {
            ...currentChoices[featId],
            [choiceType]: value,
          },
        },
      };
    }
    case 'CONFIRM_FEAT_STEP':
      return { ...state, step: CreationStep.NameAndReview };
    case 'SET_CHARACTER_NAME':
      return { ...state, characterName: action.payload };
    case 'SET_CHARACTER_AGE':
      return { ...state, characterAge: action.payload };
    case 'SELECT_BACKGROUND':
      return { ...state, selectedBackground: action.payload };
    case 'GO_BACK': {
      const currentStep = state.step;
      if (currentStep === CreationStep.Race) return state;
      const targetPrevStep = stepDefinitions[currentStep]?.previousStep(state) ?? CreationStep.Race;
      const fieldsToReset = getFieldsToResetOnGoBack(state, currentStep);
      // Reset only the data captured on the step we are leaving while leaving
      // subsequent choices intact for a non-destructive review.
      return { ...state, ...fieldsToReset, step: targetPrevStep };
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
