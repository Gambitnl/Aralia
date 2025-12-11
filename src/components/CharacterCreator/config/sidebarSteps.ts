/**
 * @file sidebarSteps.ts
 * Configuration for the character creation sidebar - defines step metadata,
 * display labels, groupings, and selection summary functions.
 */
import { CreationStep, CharacterCreationState } from '../state/characterCreatorState';

export type StepGroup = 'origin' | 'class' | 'abilities' | 'final';

export interface SidebarStepConfig {
  step: CreationStep;
  label: string;
  group: StepGroup;
  /** Returns a summary of the current selection for this step, or null if not yet selected */
  getSelectionSummary: (state: CharacterCreationState) => string | null;
  /** Returns true if this step should be shown (for conditional race-specific steps) */
  isVisible: (state: CharacterCreationState) => boolean;
  /** Parent step for nested display (e.g., DragonbornAncestry is nested under Race) */
  parentStep?: CreationStep;
}

/**
 * Determines if a step has been completed based on the state
 */
export const isStepCompleted = (step: CreationStep, state: CharacterCreationState): boolean => {
  switch (step) {
    case CreationStep.Race:
      return state.selectedRace !== null;
    case CreationStep.AgeSelection:
      return state.characterAge > 0 && state.selectedRace !== null;
    case CreationStep.BackgroundSelection:
      return state.selectedBackground !== null;
    case CreationStep.DragonbornAncestry:
      return !!state.racialSelections['dragonborn']?.choiceId;
    case CreationStep.ElvenLineage:
      return !!state.racialSelections['elf']?.choiceId;
    case CreationStep.GnomeSubrace:
      return !!state.racialSelections['gnome']?.choiceId;
    case CreationStep.GiantAncestry:
      return !!state.racialSelections['goliath']?.choiceId;
    case CreationStep.TieflingLegacy:
      return !!state.racialSelections['tiefling']?.choiceId;
    case CreationStep.CentaurNaturalAffinitySkill:
      return !!state.racialSelections['centaur']?.skillIds?.length;
    case CreationStep.ChangelingInstincts:
      return !!state.racialSelections['changeling']?.skillIds?.length;
    case CreationStep.RacialSpellAbilityChoice:
      return state.selectedRace ? !!state.racialSelections[state.selectedRace.id]?.spellAbility : false;
    case CreationStep.Class:
      return state.selectedClass !== null;
    case CreationStep.AbilityScores:
      return state.finalAbilityScores !== null;
    case CreationStep.HumanSkillChoice:
      return !!state.racialSelections['human']?.skillIds?.length;
    case CreationStep.Skills:
      return state.selectedSkills.length > 0;
    case CreationStep.ClassFeatures:
      // Varies by class - check if relevant features are selected
      if (!state.selectedClass) return false;
      if (state.selectedClass.id === 'fighter') return state.selectedFightingStyle !== null;
      if (state.selectedClass.spellcasting) return state.selectedCantrips.length > 0 || state.selectedSpellsL1.length > 0;
      return true;
    case CreationStep.WeaponMastery:
      return state.selectedWeaponMasteries !== null && state.selectedWeaponMasteries.length > 0;
    case CreationStep.FeatSelection:
      // Feat selection is "complete" if we've either selected a feat or confirmed skipping
      return state.selectedFeat !== null || state.featStepSkipped === true;
    case CreationStep.NameAndReview:
      return state.characterName.trim().length > 0;
    default:
      return false;
  }
};

/**
 * Group display configuration
 */
export const STEP_GROUPS: Record<StepGroup, { label: string; order: number }> = {
  origin: { label: 'Origin', order: 1 },
  class: { label: 'Class', order: 2 },
  abilities: { label: 'Abilities & Skills', order: 3 },
  final: { label: 'Finalize', order: 4 },
};

/**
 * All sidebar step configurations
 */
export const SIDEBAR_STEPS: SidebarStepConfig[] = [
  // === ORIGIN GROUP ===
  {
    step: CreationStep.Race,
    label: 'Race',
    group: 'origin',
    getSelectionSummary: (state) => state.selectedRace?.name ?? null,
    isVisible: () => true,
  },
  {
    step: CreationStep.DragonbornAncestry,
    label: 'Draconic Ancestry',
    group: 'origin',
    parentStep: CreationStep.Race,
    getSelectionSummary: (state) => {
      const choice = state.racialSelections['dragonborn']?.choiceId;
      return choice ? String(choice).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null;
    },
    isVisible: (state) => state.selectedRace?.id === 'dragonborn',
  },
  {
    step: CreationStep.ElvenLineage,
    label: 'Elven Lineage',
    group: 'origin',
    parentStep: CreationStep.Race,
    getSelectionSummary: (state) => {
      const choice = state.racialSelections['elf']?.choiceId;
      return choice ? String(choice).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null;
    },
    isVisible: (state) => state.selectedRace?.id === 'elf',
  },
  {
    step: CreationStep.GnomeSubrace,
    label: 'Gnome Subrace',
    group: 'origin',
    parentStep: CreationStep.Race,
    getSelectionSummary: (state) => {
      const choice = state.racialSelections['gnome']?.choiceId;
      return choice ? String(choice).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null;
    },
    isVisible: (state) => state.selectedRace?.id === 'gnome',
  },
  {
    step: CreationStep.GiantAncestry,
    label: 'Giant Ancestry',
    group: 'origin',
    parentStep: CreationStep.Race,
    getSelectionSummary: (state) => {
      const choice = state.racialSelections['goliath']?.choiceId;
      return choice ? String(choice).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null;
    },
    isVisible: (state) => state.selectedRace?.id === 'goliath',
  },
  {
    step: CreationStep.TieflingLegacy,
    label: 'Fiendish Legacy',
    group: 'origin',
    parentStep: CreationStep.Race,
    getSelectionSummary: (state) => {
      const choice = state.racialSelections['tiefling']?.choiceId;
      return choice ? String(choice).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null;
    },
    isVisible: (state) => state.selectedRace?.id === 'tiefling',
  },
  {
    step: CreationStep.CentaurNaturalAffinitySkill,
    label: 'Natural Affinity',
    group: 'origin',
    parentStep: CreationStep.Race,
    getSelectionSummary: (state) => {
      const skills = state.racialSelections['centaur']?.skillIds;
      return skills?.length ? skills[0].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null;
    },
    isVisible: (state) => state.selectedRace?.id === 'centaur',
  },
  {
    step: CreationStep.ChangelingInstincts,
    label: 'Changeling Instincts',
    group: 'origin',
    parentStep: CreationStep.Race,
    getSelectionSummary: (state) => {
      const skills = state.racialSelections['changeling']?.skillIds;
      return skills?.length ? `${skills.length} skills` : null;
    },
    isVisible: (state) => state.selectedRace?.id === 'changeling',
  },
  {
    step: CreationStep.AgeSelection,
    label: 'Age',
    group: 'origin',
    getSelectionSummary: (state) => state.characterAge > 0 ? `${state.characterAge} years` : null,
    isVisible: () => true,
  },
  {
    step: CreationStep.BackgroundSelection,
    label: 'Background',
    group: 'origin',
    getSelectionSummary: (state) => {
      if (!state.selectedBackground) return null;
      return state.selectedBackground.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },
    isVisible: () => true,
  },

  // === CLASS GROUP ===
  {
    step: CreationStep.Class,
    label: 'Class',
    group: 'class',
    getSelectionSummary: (state) => state.selectedClass?.name ?? null,
    isVisible: () => true,
  },
  {
    step: CreationStep.ClassFeatures,
    label: 'Class Features',
    group: 'class',
    parentStep: CreationStep.Class,
    getSelectionSummary: (state) => {
      if (!state.selectedClass) return null;
      if (state.selectedClass.id === 'fighter' && state.selectedFightingStyle) {
        return state.selectedFightingStyle.name;
      }
      if (state.selectedDivineOrder) return state.selectedDivineOrder;
      if (state.selectedDruidOrder) return state.selectedDruidOrder;
      if (state.selectedCantrips.length > 0) return `${state.selectedCantrips.length} cantrips`;
      return null;
    },
    isVisible: (state) => {
      if (!state.selectedClass) return false;
      return !!(state.selectedClass.fightingStyles || state.selectedClass.spellcasting);
    },
  },

  // === ABILITIES GROUP ===
  {
    step: CreationStep.AbilityScores,
    label: 'Ability Scores',
    group: 'abilities',
    getSelectionSummary: (state) => {
      if (!state.finalAbilityScores) return null;
      const scores = state.finalAbilityScores;
      return `STR ${scores.Strength} DEX ${scores.Dexterity} CON ${scores.Constitution}`;
    },
    isVisible: () => true,
  },
  {
    step: CreationStep.RacialSpellAbilityChoice,
    label: 'Spellcasting Ability',
    group: 'abilities',
    getSelectionSummary: (state) => {
      if (!state.selectedRace) return null;
      const ability = state.racialSelections[state.selectedRace.id]?.spellAbility;
      return ability ?? null;
    },
    isVisible: (state) => state.racialSpellChoiceContext !== null,
  },
  {
    step: CreationStep.HumanSkillChoice,
    label: 'Versatile Skill',
    group: 'abilities',
    getSelectionSummary: (state) => {
      const skills = state.racialSelections['human']?.skillIds;
      return skills?.length ? skills[0].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null;
    },
    isVisible: (state) => state.selectedRace?.id === 'human',
  },
  {
    step: CreationStep.Skills,
    label: 'Skills',
    group: 'abilities',
    getSelectionSummary: (state) => {
      if (state.selectedSkills.length === 0) return null;
      return `${state.selectedSkills.length} skills`;
    },
    isVisible: () => true,
  },
  {
    step: CreationStep.WeaponMastery,
    label: 'Weapon Mastery',
    group: 'abilities',
    getSelectionSummary: (state) => {
      if (!state.selectedWeaponMasteries?.length) return null;
      return `${state.selectedWeaponMasteries.length} weapons`;
    },
    isVisible: (state) => (state.selectedClass?.weaponMasterySlots ?? 0) > 0,
  },
  {
    step: CreationStep.FeatSelection,
    label: 'Feat',
    group: 'abilities',
    getSelectionSummary: (state) => {
      if (state.featStepSkipped) return 'Skipped';
      if (!state.selectedFeat) return null;
      return state.selectedFeat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },
    isVisible: (state) => {
      // Show if human (always gets feat) or if we're at/past this step
      return state.selectedRace?.id === 'human' || state.step >= CreationStep.FeatSelection;
    },
  },

  // === FINAL GROUP ===
  {
    step: CreationStep.NameAndReview,
    label: 'Name & Review',
    group: 'final',
    getSelectionSummary: (state) => state.characterName.trim() || null,
    isVisible: () => true,
  },
];

/**
 * Get visible steps for the current state
 */
export const getVisibleSteps = (state: CharacterCreationState): SidebarStepConfig[] => {
  return SIDEBAR_STEPS.filter(step => step.isVisible(state));
};

/**
 * Get steps grouped by their group
 */
export const getStepsByGroup = (state: CharacterCreationState): Map<StepGroup, SidebarStepConfig[]> => {
  const visible = getVisibleSteps(state);
  const grouped = new Map<StepGroup, SidebarStepConfig[]>();

  for (const group of Object.keys(STEP_GROUPS) as StepGroup[]) {
    grouped.set(group, visible.filter(s => s.group === group));
  }

  return grouped;
};
