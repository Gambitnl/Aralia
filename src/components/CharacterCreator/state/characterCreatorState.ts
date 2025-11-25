/**
 * @file src/components/CharacterCreator/state/characterCreatorState.ts
 * Defines the state structure, initial state, actions, and reducer for the CharacterCreator component.
 */
import {
  PlayerCharacter,
  Race,
  Class as CharClass,
  AbilityScores,
  Skill,
  Spell,
  FightingStyle,
  AbilityScoreName,
  DraconicAncestryInfo,
  ElvenLineageType,
  GnomeSubraceType,
  GiantAncestryType,
  FiendishLegacyType,
  DraconicAncestorType,
  RacialSelectionData,
} from '../../../types';
import {
  RACES_DATA,
} from '../../../constants';
import { FEATS_DATA } from '../../../data/feats/featsData';
import { calculateFixedRacialBonuses, evaluateFeatPrerequisites } from '../../../utils/characterUtils';

// --- Enums and Types ---
export enum CreationStep {
  Race,
  DragonbornAncestry,
  ElvenLineage,
  GnomeSubrace,
  GiantAncestry,
  TieflingLegacy,
  CentaurNaturalAffinitySkill,
  ChangelingInstincts,
  RacialSpellAbilityChoice, // Consolidated Step
  Class,
  AbilityScores,
  HumanSkillChoice,
  Skills,
  ClassFeatures,
  WeaponMastery,
  FeatSelection,
  NameAndReview,
}

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
  characterName: string;
  characterAge: number;
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
  | { type: 'SELECT_DRAGONBORN_ANCESTRY'; payload: DraconicAncestorType }
  | { type: 'SELECT_ELVEN_LINEAGE'; payload: { lineageId: ElvenLineageType; spellAbility: AbilityScoreName } }
  | { type: 'SELECT_GNOME_SUBRACE'; payload: { subraceId: GnomeSubraceType; spellAbility: AbilityScoreName } }
  | { type: 'SELECT_GIANT_ANCESTRY'; payload: GiantAncestryType }
  | { type: 'SELECT_TIEFLING_LEGACY'; payload: { legacyId: FiendishLegacyType; spellAbility: AbilityScoreName } }
  | { type: 'SELECT_CENTAUR_NATURAL_AFFINITY_SKILL'; payload: string }
  | { type: 'SELECT_CHANGELING_INSTINCTS'; payload: string[] }
  | { type: 'SELECT_RACIAL_SPELL_ABILITY'; payload: AbilityScoreName }
  | { type: 'SELECT_CLASS'; payload: CharClass }
  | { type: 'SET_ABILITY_SCORES'; payload: { baseScores: AbilityScores } }
  | { type: 'SELECT_HUMAN_SKILL'; payload: string }
  | { type: 'SELECT_SKILLS'; payload: Skill[] }
  | ClassFeatureFinalSelectionAction
  | { type: 'SELECT_WEAPON_MASTERIES'; payload: string[] }
  | { type: 'SELECT_FEAT'; payload: string }
  | { type: 'CONFIRM_FEAT_STEP' }
  | { type: 'SET_CHARACTER_NAME'; payload: string }
  | { type: 'SET_CHARACTER_AGE'; payload: number }
  | { type: 'GO_BACK' };

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
  characterName: '',
  characterAge: 25, // Default age
};

// --- Reducer Helper Functions ---

function determineNextStepAfterRace(race: Race): CreationStep {
  if (race.id === 'dragonborn') return CreationStep.DragonbornAncestry;
  if (race.id === 'elf') return CreationStep.ElvenLineage;
  if (race.id === 'gnome') return CreationStep.GnomeSubrace;
  if (race.id === 'goliath') return CreationStep.GiantAncestry;
  if (race.id === 'tiefling') return CreationStep.TieflingLegacy;
  if (race.id === 'centaur') return CreationStep.CentaurNaturalAffinitySkill;
  if (race.id === 'changeling') return CreationStep.ChangelingInstincts;
  return CreationStep.Class;
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

  return FEATS_DATA.some(feat => {
    const eligibility = evaluateFeatPrerequisites(feat, {
      level: 1,
      abilityScores: state.finalAbilityScores!,
      raceId: state.selectedRace!.id,
      classId: state.selectedClass!.id,
      knownFeats: state.selectedFeat ? [state.selectedFeat] : [],
    });
    return eligibility.isEligible;
  });
};

const getFeatStepOrReview = (state: CharacterCreationState): CreationStep => {
  return canOfferFeatAtLevelOne(state) || !!state.selectedFeat
    ? CreationStep.FeatSelection
    : CreationStep.NameAndReview;
};

const getFieldsToResetOnGoBack = (state: CharacterCreationState, exitedStep: CreationStep): Partial<CharacterCreationState> => {
    const resetFields: Partial<CharacterCreationState> = {};
    const pruneRacialSelection = (key: string) => {
        const nextSelections = { ...state.racialSelections };
        delete nextSelections[key];
        resetFields.racialSelections = nextSelections;
    };

    switch (exitedStep) {
        case CreationStep.DragonbornAncestry: pruneRacialSelection('dragonborn'); break;
        case CreationStep.ElvenLineage: pruneRacialSelection('elf'); break;
        case CreationStep.GnomeSubrace: pruneRacialSelection('gnome'); break;
        case CreationStep.GiantAncestry: pruneRacialSelection('goliath'); break;
        case CreationStep.TieflingLegacy: pruneRacialSelection('tiefling'); break;
        case CreationStep.CentaurNaturalAffinitySkill: pruneRacialSelection('centaur'); break;
        case CreationStep.ChangelingInstincts: pruneRacialSelection('changeling'); break;
        case CreationStep.RacialSpellAbilityChoice:
            // Clearing the spell ability ensures the dropdown re-validates against updated ability scores when the user revisits
            // the step (for example after adjusting point-buy totals) instead of silently reusing stale data.
            if (state.selectedRace) { pruneRacialSelection(state.selectedRace.id); }
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
  [CreationStep.DragonbornAncestry]: { previousStep: () => CreationStep.Race },
  [CreationStep.ElvenLineage]: { previousStep: () => CreationStep.Race },
  [CreationStep.GnomeSubrace]: { previousStep: () => CreationStep.Race },
  [CreationStep.GiantAncestry]: { previousStep: () => CreationStep.Race },
  [CreationStep.TieflingLegacy]: { previousStep: () => CreationStep.Race },
  [CreationStep.CentaurNaturalAffinitySkill]: { previousStep: () => CreationStep.Race },
  [CreationStep.ChangelingInstincts]: { previousStep: () => CreationStep.Race },
  [CreationStep.RacialSpellAbilityChoice]: { previousStep: () => CreationStep.AbilityScores },
  [CreationStep.Class]: {
    previousStep: (state) => {
      if (!state.selectedRace) return CreationStep.Race;
      // Go back to the race-specific step if it exists, otherwise back to Race selection
      const raceStep = determineNextStepAfterRace(state.selectedRace);
      return raceStep !== CreationStep.Class ? raceStep : CreationStep.Race;
    },
  },
  [CreationStep.AbilityScores]: { previousStep: () => CreationStep.Class },
  [CreationStep.HumanSkillChoice]: { previousStep: (state) => state.racialSpellChoiceContext ? CreationStep.RacialSpellAbilityChoice : CreationStep.AbilityScores },
  [CreationStep.Skills]: {
    previousStep: (state) => (state.selectedRace?.id === 'human' ? CreationStep.HumanSkillChoice : (state.racialSpellChoiceContext ? CreationStep.RacialSpellAbilityChoice : CreationStep.AbilityScores))
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
  const resolveStepAfterFeature = (candidate: CharacterCreationState): CreationStep => {
    return (state.selectedClass?.weaponMasterySlots ?? 0) > 0
      ? CreationStep.WeaponMastery
      : getFeatStepOrReview(candidate);
  };

  switch (action.type) {
    case 'SELECT_FIGHTER_FEATURES': {
      const nextState = { ...state, selectedFightingStyle: action.payload };
      return { ...nextState, step: resolveStepAfterFeature(nextState) };
    }
    case 'SELECT_CLERIC_FEATURES': {
      const nextState = { ...state, selectedDivineOrder: action.payload.order, selectedCantrips: action.payload.cantrips, selectedSpellsL1: action.payload.spellsL1 };
      return { ...nextState, step: resolveStepAfterFeature(nextState) };
    }
    case 'SELECT_DRUID_FEATURES': {
      const nextState = { ...state, selectedDruidOrder: action.payload.order, selectedCantrips: action.payload.cantrips, selectedSpellsL1:action.payload.spellsL1 };
      return { ...nextState, step: resolveStepAfterFeature(nextState) };
    }
    case 'SELECT_WIZARD_FEATURES': case 'SELECT_ARTIFICER_FEATURES': case 'SELECT_SORCERER_FEATURES': case 'SELECT_BARD_FEATURES': case 'SELECT_WARLOCK_FEATURES': {
      const nextState = { ...state, selectedCantrips: action.payload.cantrips, selectedSpellsL1: action.payload.spellsL1 };
      return { ...nextState, step: resolveStepAfterFeature(nextState) };
    }
    case 'SELECT_RANGER_FEATURES': case 'SELECT_PALADIN_FEATURES': {
      const nextState = { ...state, selectedSpellsL1: action.payload.spellsL1 };
      return { ...nextState, step: resolveStepAfterFeature(nextState) };
    }
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
    case 'SELECT_DRAGONBORN_ANCESTRY': return { ...state, racialSelections: { ...state.racialSelections, dragonborn: { choiceId: action.payload } }, step: CreationStep.Class };
    case 'SELECT_ELVEN_LINEAGE': return { ...state, racialSelections: { ...state.racialSelections, elf: { choiceId: action.payload.lineageId, spellAbility: action.payload.spellAbility } }, step: CreationStep.Class };
    case 'SELECT_GNOME_SUBRACE': return { ...state, racialSelections: { ...state.racialSelections, gnome: { choiceId: action.payload.subraceId, spellAbility: action.payload.spellAbility } }, step: CreationStep.Class };
    case 'SELECT_GIANT_ANCESTRY': return { ...state, racialSelections: { ...state.racialSelections, goliath: { choiceId: action.payload } }, step: CreationStep.Class };
    case 'SELECT_TIEFLING_LEGACY': return { ...state, racialSelections: { ...state.racialSelections, tiefling: { choiceId: action.payload.legacyId, spellAbility: action.payload.spellAbility } }, step: CreationStep.Class };
    case 'SELECT_CENTAUR_NATURAL_AFFINITY_SKILL': return { ...state, racialSelections: { ...state.racialSelections, centaur: { skillIds: [action.payload] } }, step: CreationStep.Class };
    case 'SELECT_CHANGELING_INSTINCTS': return { ...state, racialSelections: { ...state.racialSelections, changeling: { skillIds: action.payload } }, step: CreationStep.Class };
    case 'SELECT_RACIAL_SPELL_ABILITY': {
        if (!state.racialSpellChoiceContext || !state.selectedRace) return state;
        const raceId = state.selectedRace.id;
        const ability = action.payload;
        const nextStep = state.selectedRace?.id === 'human' ? CreationStep.HumanSkillChoice : CreationStep.Skills;
        
        return {
            ...state,
            racialSelections: {
                ...state.racialSelections,
                [raceId]: {
                    ...state.racialSelections[raceId],
                    spellAbility: ability
                }
            },
            step: nextStep,
        };
    }
    case 'SELECT_CLASS':
      return { ...state, selectedClass: action.payload, step: CreationStep.AbilityScores };
    case 'SET_ABILITY_SCORES': {
      const { baseScores } = action.payload;
      const finalScores = calculateFixedRacialBonuses(baseScores, state.selectedRace);
      
      let nextStep: CreationStep;
      if (state.racialSpellChoiceContext) {
          nextStep = CreationStep.RacialSpellAbilityChoice;
      } else if (state.selectedRace?.id === 'human') {
          nextStep = CreationStep.HumanSkillChoice;
      } else {
          nextStep = CreationStep.Skills;
      }

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
      return { ...nextState, step: getFeatStepOrReview(nextState) };
    }
    case 'SELECT_WEAPON_MASTERIES': {
      // Always move into (or skip past) the feat picker so the user can opt in (or we auto-bypass when nothing qualifies).
      const nextState = { ...state, selectedWeaponMasteries: action.payload };
      return { ...nextState, step: getFeatStepOrReview(nextState) };
    }
    case 'SELECT_FEAT':
      // Selecting a feat no longer auto-advances so users can compare options or clear their pick before continuing.
      // Empty payloads clear the selection, ensuring downstream assembly does not apply stale bonuses.
      return { ...state, selectedFeat: action.payload || null };
    case 'CONFIRM_FEAT_STEP':
      return { ...state, step: CreationStep.NameAndReview };
    case 'SET_CHARACTER_NAME':
      return { ...state, characterName: action.payload };
    case 'SET_CHARACTER_AGE':
      return { ...state, characterAge: action.payload };
    case 'GO_BACK': {
      const currentStep = state.step;
      if (currentStep === CreationStep.Race) return state;
      const targetPrevStep = stepDefinitions[currentStep]?.previousStep(state) ?? CreationStep.Race;
      const fieldsToReset = getFieldsToResetOnGoBack(state, currentStep);
      // Reset only the data captured on the step we are leaving while leaving
      // subsequent choices intact for a non-destructive review.
      return { ...state, ...fieldsToReset, step: targetPrevStep };
    }
    default:
      return state;
  }
}
