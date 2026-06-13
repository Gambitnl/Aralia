/**
 * This file builds a legal random walk through the Character Creator wizard.
 *
 * It exists so the "Auto-Fill (Random)" button can use the same reducer actions
 * that normal player clicks use, instead of constructing a finished character
 * behind the wizard's back. The component supplies the loaded spell registry and
 * dispatches the returned actions in order.
 *
 * Called by: CharacterCreator.tsx and randomizeCreation.test.ts.
 * Depends on: Character Creator reducer action types, race/class/background/
 * feat data, skill-selection helpers, spell data from SpellContext, and weapon
 * data from constants.ts.
 */
import type {
  AbilityScoreName,
  AbilityScores,
  Class as CharClass,
  Feat,
  MagicInitiateSource,
  Race,
  RacialSelectionData,
  Skill,
  Spell,
} from '../../types';
import { CLASSES_DATA, WEAPONS_DATA } from '../../constants';
import { ACTIVE_RACES } from '../../data/races';
import { getRacialSpellCastingAbilityChoiceForRace } from '../../data/races';
import { BACKGROUNDS } from '../../data/backgrounds';
import { FEATS_DATA } from '../../data/feats/featsData';
import { SKILLS_DATA } from '../../data/skills';
import { evaluateFeatPrerequisites, getAbilityModifierValue } from '../../utils/characterUtils';
import { filterSpellsForRequirement } from '../../utils/spellFilterUtils';
import type { RacialChoiceData } from './Race/RaceDetailPane';
import {
  buildSkillsForSubmit,
  getKeenSensesOptions,
} from './utils/skillSelectionUtils';
import {
  CharacterCreatorAction,
  CreationStep,
  getFeatStepOrReview,
  initialCharacterCreatorState,
  characterCreatorReducer,
  type CharacterCreationState,
  type FeatChoiceValue,
} from './state/characterCreatorState';

// ============================================================================
// Public Types
// ============================================================================
// These types keep the engine independent from React. The button can dispatch
// the action plan, and tests can replay the same plan through the reducer.
// ============================================================================

export type RandomNumberGenerator = () => number;

export interface RandomizeCreationInput {
  allSpells: Record<string, Spell>;
  rng?: RandomNumberGenerator;
}

export interface RandomizedCreationPlan {
  actions: CharacterCreatorAction[];
  state: CharacterCreationState;
}

// ============================================================================
// Deterministic Random Helpers
// ============================================================================
// All random choices flow through the injected RNG. The default button path can
// pass Math.random, while tests can pass seededRng for repeatable builds.
// ============================================================================

export function seededRng(seed: number): RandomNumberGenerator {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne<T>(items: readonly T[], rng: RandomNumberGenerator, label: string): T {
  if (items.length === 0) {
    throw new Error(`Cannot randomize ${label}: no legal options available.`);
  }

  return items[Math.floor(rng() * items.length)];
}

function pickMany<T>(items: readonly T[], count: number, rng: RandomNumberGenerator, label: string): T[] {
  if (count < 0 || items.length < count) {
    throw new Error(`Cannot randomize ${label}: need ${count} options, found ${items.length}.`);
  }

  const pool = [...items];
  const selected: T[] = [];

  while (selected.length < count) {
    const index = Math.floor(rng() * pool.length);
    const [choice] = pool.splice(index, 1);
    selected.push(choice);
  }

  return selected;
}

// ============================================================================
// Option Source Helpers
// ============================================================================
// This section mirrors the option pools from the step components. When a step
// has conditional choices, the helper samples from the options visible at that
// point in the wizard.
// ============================================================================

const SPELLCASTING_ABILITIES: Array<NonNullable<RacialChoiceData['spellAbility']>> = ['Intelligence', 'Wisdom', 'Charisma'];
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
const DEFAULT_TOOLS = [
  'alchemists_supplies',
  'brewers_supplies',
  'calligraphers_supplies',
  'carpenters_tools',
  'cartographers_tools',
  'cobblers_tools',
  'cooks_utensils',
  'glassblowers_tools',
  'jewelers_tools',
  'leatherworkers_tools',
  'masons_tools',
  'painters_supplies',
  'potters_tools',
  'smiths_tools',
  'tinkers_tools',
  'weavers_tools',
  'woodcarvers_tools',
  'disguise_kit',
  'forgery_kit',
  'herbalism_kit',
  'navigators_tools',
  'poisoners_kit',
  'thieves_tools',
] as const;

function buildRaceChoices(race: Race, rng: RandomNumberGenerator): RacialChoiceData {
  const choices: RacialChoiceData = {};

  if (getRacialSpellCastingAbilityChoiceForRace(race.id)) {
    choices.spellAbility = pickOne(SPELLCASTING_ABILITIES, rng, `${race.name} spellcasting ability`);
  }

  if (race.id === 'elf') {
    choices.keenSensesSkillId = pickOne(getKeenSensesOptions(SKILLS_DATA), rng, 'Elf Keen Senses').id;
  }

  if (race.id === 'centaur') {
    choices.centaurNaturalAffinitySkillId = pickOne(
      ['animal_handling', 'medicine', 'nature', 'survival'],
      rng,
      'Centaur Natural Affinity',
    );
  }

  if (race.id === 'changeling') {
    choices.changelingInstinctSkillIds = pickMany(
      ['deception', 'insight', 'intimidation', 'performance', 'persuasion'],
      2,
      rng,
      'Changeling Instincts',
    );
    choices.changelingSize = pickOne(['Small', 'Medium'] as const, rng, 'Changeling size');
  }

  if (race.id === 'kender') {
    choices.genericSkillChoices = pickMany(['insight', 'investigation', 'sleight_of_hand', 'stealth', 'survival'], 1, rng, 'Kender skill');
  }

  if (race.id === 'kenku') {
    choices.genericSkillChoices = pickMany(['acrobatics', 'deception', 'stealth', 'sleight_of_hand'], 2, rng, 'Kenku skills');
  }

  if (race.id === 'warforged') {
    choices.genericSkillChoices = pickMany(Object.keys(SKILLS_DATA), 1, rng, 'Warforged skill');
    choices.genericToolChoices = pickMany(DEFAULT_TOOLS, 1, rng, 'Warforged tool');
  }

  if (race.id.startsWith('half_elf')) {
    choices.genericSkillChoices = pickMany(Object.keys(SKILLS_DATA), 2, rng, 'Half-Elf skills');
  }

  if (race.id === 'autognome') {
    choices.genericToolChoices = pickMany(DEFAULT_TOOLS, 2, rng, 'Autognome tools');
  }

  if (race.id === 'forgeborn_human') {
    choices.genericToolChoices = pickMany(DEFAULT_TOOLS, 1, rng, "Forgeborn Human Maker's Gift");
  }

  if (race.id === 'lizardfolk') {
    choices.genericSkillChoices = pickMany(
      ['animal_handling', 'medicine', 'nature', 'perception', 'stealth', 'survival'],
      2,
      rng,
      "Lizardfolk Nature's Intuition",
    );
  }

  if (race.id.includes('dwarf') && race.id !== 'dwarf') {
    choices.genericToolChoices = pickMany(['smiths_tools', 'brewers_supplies', 'masons_tools'], 1, rng, 'Dwarf tool');
  }

  if (race.id === 'astral_elf') {
    choices.genericCantripChoices = pickMany(['dancing-lights', 'light', 'sacred-flame'], 1, rng, 'Astral Elf cantrip');
  }

  if (race.id === 'high_elf' || race.id === 'half_elf_high') {
    choices.genericCantripChoices = pickMany(
      ['acid-splash', 'blade-ward', 'chill-touch', 'dancing-lights', 'fire-bolt', 'friends', 'light', 'mage-hand', 'mending', 'message', 'minor-illusion', 'poison-spray', 'prestidigitation', 'ray-of-frost', 'shocking-grasp', 'true-strike'],
      1,
      rng,
      'High Elf cantrip',
    );
  }

  return choices;
}

function raceChoicesToSelections(raceId: string, choices: RacialChoiceData): CharacterCreatorAction[] {
  const actions: CharacterCreatorAction[] = [];

  if (choices.spellAbility) {
    actions.push({ type: 'SET_RACIAL_SELECTION', payload: { raceId, patch: { spellAbility: choices.spellAbility } } });
  }

  if (choices.keenSensesSkillId) {
    actions.push({ type: 'SET_RACIAL_SELECTION', payload: { raceId: 'elf', patch: { skillIds: [choices.keenSensesSkillId] } } });
  }

  if (choices.centaurNaturalAffinitySkillId) {
    actions.push({ type: 'SET_RACIAL_SELECTION', payload: { raceId: 'centaur', patch: { skillIds: [choices.centaurNaturalAffinitySkillId] } } });
  }

  if (choices.changelingInstinctSkillIds) {
    actions.push({ type: 'SET_RACIAL_SELECTION', payload: { raceId: 'changeling', patch: { skillIds: choices.changelingInstinctSkillIds } } });
  }

  if (choices.genericSkillChoices) {
    actions.push({ type: 'SET_RACIAL_SELECTION', payload: { raceId, patch: { skillIds: choices.genericSkillChoices } } });
  }

  if (choices.genericToolChoices) {
    actions.push({ type: 'SET_RACIAL_SELECTION', payload: { raceId, patch: { toolIds: choices.genericToolChoices } } });
  }

  if (choices.genericCantripChoices) {
    actions.push({ type: 'SET_RACIAL_SELECTION', payload: { raceId, patch: { selectedSpellIds: choices.genericCantripChoices } } });
  }

  return actions;
}

function randomAbilityScores(charClass: CharClass, rng: RandomNumberGenerator): AbilityScores {
  const preferred = charClass.recommendedPointBuyPriorities ?? charClass.primaryAbility;
  const remainingAbilities = (['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'] as AbilityScoreName[])
    .filter((ability) => !preferred.includes(ability));
  const orderedAbilities = [...preferred, ...pickMany(remainingAbilities, remainingAbilities.length, rng, 'remaining abilities')];
  const shuffledScores = pickMany(STANDARD_ARRAY, STANDARD_ARRAY.length, rng, 'standard array scores');

  return orderedAbilities.reduce((scores, ability, index) => {
    scores[ability] = shuffledScores[index];
    return scores;
  }, {} as AbilityScores);
}

function randomSkills(state: CharacterCreationState, rng: RandomNumberGenerator): Skill[] {
  const charClass = state.selectedClass;
  const race = state.selectedRace;
  if (!charClass || !race) {
    throw new Error('Cannot randomize skills before race and class are selected.');
  }

  // The skill screen disables class-skill buttons that are already granted by
  // race. Excluding them here preserves the same count after submit-time
  // de-duplication.
  const racialSkillIds = new Set([
    ...(state.racialSelections[race.id]?.skillIds ?? []),
    ...(state.racialSelections.human?.skillIds ?? []),
    ...(race.id === 'bugbear' ? ['stealth'] : []),
  ]);

  const classSkillIds = pickMany(
    charClass.skillProficienciesAvailable.filter((skillId) => !racialSkillIds.has(skillId)),
    charClass.numberOfSkillProficiencies,
    rng,
    `${charClass.name} skills`,
  );

  const keenSkillId = race.id === 'elf' ? state.racialSelections.elf?.skillIds?.[0] ?? null : null;

  return buildSkillsForSubmit({
    skillsById: SKILLS_DATA,
    selectedClassSkillIds: new Set(classSkillIds),
    raceId: race.id,
    racialSelections: state.racialSelections,
    selectedKeenSensesSkillId: keenSkillId,
  });
}

function availableSpells(spellIds: readonly string[], allSpells: Record<string, Spell>, level: number): Spell[] {
  return spellIds
    .map((spellId) => allSpells[String(spellId)])
    .filter((spell): spell is Spell => !!spell && spell.level === level);
}

function randomSpellFeatures(
  state: CharacterCreationState,
  allSpells: Record<string, Spell>,
  rng: RandomNumberGenerator,
): CharacterCreatorAction | null {
  const charClass = state.selectedClass;
  if (!charClass) return null;

  if (charClass.id === 'fighter' && charClass.fightingStyles) {
    return { type: 'SELECT_FIGHTER_FEATURES', payload: pickOne(charClass.fightingStyles, rng, 'Fighter fighting style') };
  }

  if (!charClass.spellcasting) return null;

  const spellcasting = charClass.spellcasting;
  const cantrips = availableSpells(spellcasting.spellList, allSpells, 0);
  const levelOneSpells = availableSpells(spellcasting.spellList, allSpells, 1);

  if (charClass.id === 'cleric' && charClass.divineOrders) {
    const order = pickOne(charClass.divineOrders, rng, 'Cleric Divine Order').id;
    const cantripCount = spellcasting.knownCantrips + (order === 'Thaumaturge' ? 1 : 0);
    return {
      type: 'SELECT_CLERIC_FEATURES',
      payload: {
        order,
        cantrips: pickMany(cantrips, cantripCount, rng, 'Cleric cantrips'),
        spellsL1: pickMany(levelOneSpells, spellcasting.knownSpellsL1, rng, 'Cleric level 1 spells'),
      },
    };
  }

  if (charClass.id === 'druid' && charClass.primalOrders) {
    const order = pickOne(charClass.primalOrders, rng, 'Druid Primal Order').id;
    const cantripCount = spellcasting.knownCantrips + (order === 'Magician' ? 1 : 0);
    const selectableLevelOne = levelOneSpells.filter((spell) => spell.id !== 'speak-with-animals');
    const selectedLevelOne = pickMany(selectableLevelOne, spellcasting.knownSpellsL1, rng, 'Druid level 1 spells');
    const speakWithAnimals = allSpells['speak-with-animals'];
    return {
      type: 'SELECT_DRUID_FEATURES',
      payload: {
        order,
        cantrips: pickMany(cantrips, cantripCount, rng, 'Druid cantrips'),
        spellsL1: speakWithAnimals ? [...selectedLevelOne, speakWithAnimals] : selectedLevelOne,
      },
    };
  }

  if (charClass.id === 'ranger') {
    return { type: 'SELECT_RANGER_FEATURES', payload: { spellsL1: pickMany(levelOneSpells, spellcasting.knownSpellsL1, rng, 'Ranger level 1 spells') } };
  }

  if (charClass.id === 'paladin') {
    return { type: 'SELECT_PALADIN_FEATURES', payload: { spellsL1: pickMany(levelOneSpells, spellcasting.knownSpellsL1, rng, 'Paladin level 1 spells') } };
  }

  if (charClass.id === 'artificer') {
    const preparedCount = Math.max(1, getAbilityModifierValue(state.finalAbilityScores?.Intelligence ?? 10) + Math.floor(1 / 2));
    return {
      type: 'SELECT_ARTIFICER_FEATURES',
      payload: {
        cantrips: pickMany(cantrips, spellcasting.knownCantrips, rng, 'Artificer cantrips'),
        spellsL1: pickMany(levelOneSpells, preparedCount, rng, 'Artificer prepared spells'),
      },
    };
  }

  const payload = {
    cantrips: pickMany(cantrips, spellcasting.knownCantrips, rng, `${charClass.name} cantrips`),
    spellsL1: pickMany(levelOneSpells, spellcasting.knownSpellsL1, rng, `${charClass.name} level 1 spells`),
  };

  if (charClass.id === 'wizard') return { type: 'SELECT_WIZARD_FEATURES', payload };
  if (charClass.id === 'sorcerer') return { type: 'SELECT_SORCERER_FEATURES', payload };
  if (charClass.id === 'bard') return { type: 'SELECT_BARD_FEATURES', payload };
  if (charClass.id === 'warlock') return { type: 'SELECT_WARLOCK_FEATURES', payload };

  return null;
}

export function getLegalWeaponMasteryOptions(charClass: CharClass): string[] {
  const isSimpleProficient = charClass.weaponProficiencies.includes('Simple weapons');
  const isMartialProficient = charClass.weaponProficiencies.includes('Martial weapons');

  return Object.values(WEAPONS_DATA)
    .filter((weapon) => !!weapon.mastery)
    .filter((weapon) => (
      (isSimpleProficient && !weapon.isMartial) ||
      (isMartialProficient && weapon.isMartial) ||
      charClass.weaponProficiencies.some((prof) => weapon.name.toLowerCase().includes(prof.toLowerCase().replace(/s$/, '')))
    ))
    .map((weapon) => weapon.id);
}

function buildFeatChoiceActions(params: {
  feat: Feat;
  allSpells: Record<string, Spell>;
  rng: RandomNumberGenerator;
  knownSkillIds: string[];
  knownSpellIds: string[];
}): CharacterCreatorAction[] {
  const { feat, allSpells, rng, knownSkillIds, knownSpellIds } = params;
  const actions: CharacterCreatorAction[] = [];

  const pushChoice = (choiceType: string, value: FeatChoiceValue) => {
    actions.push({ type: 'SET_FEAT_CHOICE', payload: { featId: feat.id, choiceType, value } });
  };

  const selectableAbilities = feat.benefits?.selectableAbilityScores ?? [];
  if (selectableAbilities.length > 0) {
    pushChoice('selectedAbilityScore', pickOne(selectableAbilities, rng, `${feat.name} ability score`));
  }

  const selectableDamageTypes = feat.benefits?.selectableDamageTypes ?? [];
  if (selectableDamageTypes.length > 0) {
    pushChoice('selectedDamageType', pickOne(selectableDamageTypes, rng, `${feat.name} damage type`));
  }

  const selectableSkillCount = feat.benefits?.selectableSkillCount ?? 0;
  if (selectableSkillCount > 0) {
    const availableSkillIds = Object.keys(SKILLS_DATA).filter((skillId) => !knownSkillIds.includes(skillId));
    pushChoice('selectedSkills', pickMany(availableSkillIds, selectableSkillCount, rng, `${feat.name} skills`));
  }

  const spellBenefits = feat.benefits?.spellBenefits;
  if (!spellBenefits) return actions;

  const selectedSpellSource = spellBenefits.selectableSpellSource
    ? pickOne(spellBenefits.selectableSpellSource, rng, `${feat.name} spell source`)
    : undefined;

  if (selectedSpellSource) {
    pushChoice('selectedSpellSource', selectedSpellSource);
  }

  const selectedCantrips: string[] = [];
  const selectedLeveledSpells: string[] = [];

  for (const requirement of spellBenefits.spellChoices ?? []) {
    const knownForRequirement = new Set([
      ...knownSpellIds,
      ...selectedCantrips,
      ...selectedLeveledSpells,
    ]);
    const options = filterSpellsForRequirement(allSpells, requirement, selectedSpellSource as MagicInitiateSource | undefined)
      .filter((spell) => !knownForRequirement.has(spell.id));
    const selected = pickMany(options, requirement.count, rng, `${feat.name} spells`).map((spell) => spell.id);
    if (requirement.level === 0) selectedCantrips.push(...selected);
    else selectedLeveledSpells.push(...selected);
  }

  if (selectedCantrips.length > 0) pushChoice('selectedCantrips', selectedCantrips);
  if (selectedLeveledSpells.length > 0) pushChoice('selectedLeveledSpells', selectedLeveledSpells);

  return actions;
}

function randomEligibleFeat(state: CharacterCreationState, rng: RandomNumberGenerator): Feat {
  const abilityScores = state.finalAbilityScores ?? state.baseAbilityScores ?? {
    Strength: 10,
    Dexterity: 10,
    Constitution: 10,
    Intelligence: 10,
    Wisdom: 10,
    Charisma: 10,
  };

  const eligibleFeats = FEATS_DATA
    .filter((feat) => !feat.prerequisites?.minLevel || feat.prerequisites.minLevel <= 1)
    .filter((feat) => evaluateFeatPrerequisites(feat, {
      level: 1,
      abilityScores,
      raceId: state.selectedRace?.id,
      classId: state.selectedClass?.id,
      knownFeats: [state.backgroundFeatId, state.racialFeatId].filter((featId): featId is string => !!featId),
      hasFightingStyle: !!(state.selectedClass?.fightingStyles && state.selectedClass.fightingStyles.length > 0),
    }).isEligible);

  return pickOne(eligibleFeats, rng, 'eligible feat');
}

// ============================================================================
// Plan Assembly
// ============================================================================
// This is the only exported behavior the button needs. It starts with a full
// reset, walks the canonical step order, and stores the blank name so the final
// review screen remains editable.
// ============================================================================

export function randomizeCreation(input: RandomizeCreationInput): RandomizedCreationPlan {
  const rng = input.rng ?? Math.random;
  const actions: CharacterCreatorAction[] = [{ type: 'RESET_CREATOR' }];
  let state = characterCreatorReducer(initialCharacterCreatorState, actions[0]);

  const dispatch = (action: CharacterCreatorAction) => {
    actions.push(action);
    state = characterCreatorReducer(state, action);
  };

  const race = pickOne(ACTIVE_RACES, rng, 'race');
  const raceChoices = buildRaceChoices(race, rng);
  dispatch({ type: 'SELECT_RACE', payload: race });
  for (const action of raceChoicesToSelections(race.id, raceChoices)) dispatch(action);

  dispatch({ type: 'SET_CHARACTER_AGE', payload: Math.floor(rng() * 62) + 18 });
  dispatch({ type: 'SET_STEP', payload: CreationStep.BackgroundSelection });
  dispatch({ type: 'SELECT_BACKGROUND', payload: pickOne(Object.keys(BACKGROUNDS), rng, 'background') });
  dispatch({ type: 'SET_STEP', payload: CreationStep.Visuals });
  dispatch({ type: 'SELECT_VISUALS', payload: { gender: pickOne(['Male', 'Female'] as const, rng, 'appearance gender') } });
  dispatch({ type: 'SET_STEP', payload: CreationStep.Class });

  const charClass = pickOne(Object.values(CLASSES_DATA), rng, 'class');
  dispatch({ type: 'SELECT_CLASS', payload: charClass });
  dispatch({ type: 'SET_ABILITY_SCORES', payload: { baseScores: randomAbilityScores(charClass, rng) } });

  if (state.step === CreationStep.HumanSkillChoice) {
    const raceSkillIds = new Set(Object.values(state.racialSelections).flatMap((selection: RacialSelectionData) => selection.skillIds ?? []));
    const availableHumanSkills = Object.keys(SKILLS_DATA).filter((skillId) => !raceSkillIds.has(skillId));
    const humanSkillId = pickOne(availableHumanSkills, rng, 'Human Skillful skill');
    dispatch({ type: 'SELECT_HUMAN_SKILL', payload: humanSkillId });
    if (state.selectedRace?.id !== 'human') {
      dispatch({ type: 'SET_RACIAL_SELECTION', payload: { raceId: 'human', patch: { skillIds: [humanSkillId] } } });
    }
  }

  dispatch({ type: 'SELECT_SKILLS', payload: randomSkills(state, rng) });

  const featureAction = randomSpellFeatures(state, input.allSpells, rng);
  if (featureAction) dispatch(featureAction);

  if (state.step === CreationStep.ClassFeatures) {
    const { step, skipped } = getFeatStepOrReview(state);
    dispatch({ type: 'SET_STEP', payload: step });
    if (skipped) dispatch({ type: 'CONFIRM_FEAT_STEP' });
  }

  if (state.step === CreationStep.WeaponMastery && state.selectedClass) {
    const weaponIds = pickMany(
      getLegalWeaponMasteryOptions(state.selectedClass),
      state.selectedClass.weaponMasterySlots ?? 0,
      rng,
      `${state.selectedClass.name} weapon masteries`,
    );
    dispatch({ type: 'SELECT_WEAPON_MASTERIES', payload: weaponIds });
  }

  while (state.step === CreationStep.BackgroundFeatSelection || state.step === CreationStep.RacialFeatSelection) {
    if (state.step === CreationStep.RacialFeatSelection && !state.racialFeatId) {
      dispatch({ type: 'SELECT_RACIAL_FEAT', payload: randomEligibleFeat(state, rng).id });
    }

    const featId = state.step === CreationStep.BackgroundFeatSelection ? state.backgroundFeatId : state.racialFeatId;
    const feat = featId ? FEATS_DATA.find((candidate) => candidate.id === featId) : null;
    if (feat) {
      const knownSkillIds = state.selectedSkills.map((skill: Skill) => skill.id);
      const knownSpellIds = [
        ...state.selectedCantrips.map((spell: Spell) => spell.id),
        ...state.selectedSpellsL1.map((spell: Spell) => spell.id),
      ];
      for (const action of buildFeatChoiceActions({ feat, allSpells: input.allSpells, rng, knownSkillIds, knownSpellIds })) {
        dispatch(action);
      }
    }
    dispatch({ type: 'CONFIRM_FEAT_STEP' });
  }

  if (state.step !== CreationStep.NameAndReview) {
    dispatch({ type: 'SET_STEP', payload: CreationStep.NameAndReview });
  }

  dispatch({ type: 'SET_CHARACTER_NAME', payload: '' });

  return { actions, state };
}
