/**
 * This test file proves that the Character Creator random-fill engine produces
 * legal state-machine input instead of building a separate finished character.
 *
 * The tests replay the generated action plan through the real reducer, then
 * check the resulting creator state against the same class, skill, spell, feat,
 * and weapon-option data that the interactive wizard uses.
 *
 * Called by: Vitest during Character Creator verification.
 * Depends on: randomizeCreation.ts, characterCreatorState.ts, class/race data,
 * skill data, feat data, and the public spell bundle shape.
 */
import { describe, expect, it } from 'vitest';
import type { Spell } from '../../types';
import { CLASSES_DATA } from '../../data/classes';
import { ACTIVE_RACES } from '../../data/races';
import { FEATS_DATA } from '../../data/feats/featsData';
import { BACKGROUNDS } from '../../data/backgrounds';
import { SKILLS_DATA } from '../../data/skills';
import { WEAPONS_DATA } from '../../constants';
import { evaluateFeatPrerequisites } from '../../utils/characterUtils';
import {
  CharacterCreationState,
  CreationStep,
  characterCreatorReducer,
  initialCharacterCreatorState,
  isHumanLineage,
} from './state/characterCreatorState';
import { isStepCompleted } from './config/sidebarSteps';
import { randomizeCreation, seededRng } from './randomizeCreation';

// ============================================================================
// Spell Fixtures
// ============================================================================
// The randomizer only needs spell identity and level while choosing class
// features. The production app passes the full SpellContext bundle; tests build
// a compact legal bundle from every class spell list so the engine can exercise
// every caster without loading the large public JSON file.
// ============================================================================

const spellLevelsById = new Map<string, number>();
for (const charClass of Object.values(CLASSES_DATA)) {
  for (const spellId of charClass.spellcasting?.spellList ?? []) {
    const inferredLevel = spellId.includes('cantrip') ? 0 : undefined;
    if (!spellLevelsById.has(spellId)) {
      spellLevelsById.set(spellId, inferredLevel ?? 1);
    }
  }
}

// Known cantrip ids appear directly in the class spell-list arrays; these ids
// are enough for the legality checks because every chosen spell is also checked
// against the class list that exposed it.
const CANTRIP_IDS = new Set([
  'acid-splash',
  'blade-ward',
  'booming-blade',
  'chill-touch',
  'dancing-lights',
  'druidcraft',
  'eldritch-blast',
  'elementalism',
  'fire-bolt',
  'friends',
  'guidance',
  'light',
  'mage-hand',
  'mending',
  'message',
  'minor-illusion',
  'poison-spray',
  'prestidigitation',
  'produce-flame',
  'ray-of-frost',
  'resistance',
  'sacred-flame',
  'shillelagh',
  'shocking-grasp',
  'spare-the-dying',
  'thaumaturgy',
  'thorn-whip',
  'true-strike',
  'vicious-mockery',
]);

const TEST_SPELLS: Record<string, Spell> = {};
for (const spellId of spellLevelsById.keys()) {
  TEST_SPELLS[spellId] = {
    id: spellId,
    name: spellId,
    level: CANTRIP_IDS.has(spellId) ? 0 : 1,
    school: 'Evocation',
    classes: [],
    subClasses: [],
    description: '',
    castingTime: { value: 1, unit: 'action' },
    range: { type: 'self' },
    components: { verbal: false, somatic: false, material: false },
    duration: { type: 'instantaneous', concentration: false },
    targeting: { type: 'self' },
    effects: [],
  } as unknown as Spell;
}

// ============================================================================
// Deterministic Replay Helpers
// ============================================================================
// These helpers keep the assertions focused on aggregate legality counts. The
// brief explicitly asked for aggregate-counter style tests rather than one
// assertion per element inside loops.
// ============================================================================

function replayPlan(seed: number): CharacterCreationState {
  const plan = randomizeCreation({
    allSpells: TEST_SPELLS,
    rng: seededRng(seed),
  });

  return plan.actions.reduce(characterCreatorReducer, initialCharacterCreatorState);
}

function countIllegalSkills(state: CharacterCreationState): number {
  const classSkillIds = new Set(state.selectedClass?.skillProficienciesAvailable ?? []);
  return state.selectedSkills.filter((skill) => {
    const racialIds = state.selectedRace ? (state.racialSelections[state.selectedRace.id]?.skillIds ?? []) : [];
    const humanIds = state.racialSelections.human?.skillIds ?? [];
    const racialSkillIds = new Set([...racialIds, ...humanIds, ...(state.selectedRace?.id === 'bugbear' ? ['stealth'] : [])]);
    return !classSkillIds.has(skill.id) && !racialSkillIds.has(skill.id);
  }).length;
}

function countIllegalFeatureChoices(state: CharacterCreationState): number {
  const charClass = state.selectedClass;
  if (!charClass) return 1;

  let violations = 0;
  const spellList = new Set(charClass.spellcasting?.spellList ?? []);

  if (charClass.id === 'fighter' && !charClass.fightingStyles?.some((style) => style.id === state.selectedFightingStyle?.id)) {
    violations += 1;
  }

  if (charClass.spellcasting) {
    violations += state.selectedCantrips.filter((spell) => spell.level !== 0 || !spellList.has(spell.id)).length;
    violations += state.selectedSpellsL1.filter((spell) => spell.level !== 1 || !spellList.has(spell.id)).length;
  } else {
    violations += state.selectedCantrips.length + state.selectedSpellsL1.length;
  }

  return violations;
}

function countIllegalWeaponMasteries(state: CharacterCreationState): number {
  const charClass = state.selectedClass;
  if (!charClass || !state.selectedWeaponMasteries) return 0;
  const simple = charClass.weaponProficiencies.includes('Simple weapons');
  const martial = charClass.weaponProficiencies.includes('Martial weapons');

  return state.selectedWeaponMasteries.filter((weaponId) => {
    const weapon = WEAPONS_DATA[weaponId];
    return !weapon || !weapon.mastery || !(
      (simple && !weapon.isMartial) ||
      (martial && weapon.isMartial) ||
      charClass.weaponProficiencies.some((prof) => weapon.name.toLowerCase().includes(prof.toLowerCase().replace(/s$/, '')))
    );
  }).length;
}

function countIllegalFeatChoices(state: CharacterCreationState): number {
  const abilityScores = state.finalAbilityScores ?? state.baseAbilityScores;
  if (!abilityScores) return 1;

  const selectedFeatIds = [state.backgroundFeatId, state.racialFeatId].filter((featId): featId is string => !!featId);
  return selectedFeatIds.filter((featId) => {
    const feat = FEATS_DATA.find((candidate) => candidate.id === featId);
    if (!feat) return true;
    return !evaluateFeatPrerequisites(feat, {
      level: 1,
      abilityScores,
      raceId: state.selectedRace?.id,
      classId: state.selectedClass?.id,
      knownFeats: [],
      hasFightingStyle: !!(state.selectedClass?.fightingStyles && state.selectedClass.fightingStyles.length > 0),
    }).isEligible;
  }).length;
}

// ============================================================================
// Random Creation Engine
// ============================================================================
// These tests cover the durable contract: a seedable randomizer walks the live
// reducer state machine and never assigns options outside the current legal
// race/class/feat/spell/weapon pools.
// ============================================================================

describe('randomizeCreation', () => {
  it('is deterministic for the same seed', () => {
    const first = replayPlan(7);
    const second = replayPlan(7);

    expect(first).toEqual(second);
  });

  it('produces legal complete creator states across many seeds', () => {
    const seeds = Array.from({ length: 30 }, (_, index) => index + 1);

    const totals = seeds.reduce(
      (acc, seed) => {
        const state = replayPlan(seed);
        const visibleSteps = [
          CreationStep.Race,
          CreationStep.AgeSelection,
          CreationStep.BackgroundSelection,
          CreationStep.Visuals,
          CreationStep.Class,
          CreationStep.AbilityScores,
          ...(isHumanLineage(state) ? [CreationStep.HumanSkillChoice] : []),
          CreationStep.Skills,
          ...(state.selectedClass?.fightingStyles || state.selectedClass?.spellcasting ? [CreationStep.ClassFeatures] : []),
          ...((state.selectedClass?.weaponMasterySlots ?? 0) > 0 ? [CreationStep.WeaponMastery] : []),
          ...(state.selectedBackground ? [CreationStep.BackgroundFeatSelection] : []),
          ...(isHumanLineage(state) ? [CreationStep.RacialFeatSelection] : []),
        ];
        const incompleteSteps = visibleSteps.filter((step) => !isStepCompleted(step, state));

        const classSkillCount = state.selectedClass?.numberOfSkillProficiencies ?? 0;
        const racialSkillIds = new Set([
          ...(state.selectedRace ? (state.racialSelections[state.selectedRace.id]?.skillIds ?? []) : []),
          ...(state.racialSelections.human?.skillIds ?? []),
          ...(state.selectedRace?.id === 'bugbear' ? ['stealth'] : []),
        ]);
        const selectedClassSkillCount = state.selectedSkills
          .filter((skill) => state.selectedClass?.skillProficienciesAvailable.includes(skill.id))
          .filter((skill) => !racialSkillIds.has(skill.id))
          .length;
        const masteryCount = state.selectedWeaponMasteries?.length ?? 0;
        const requiredMasteryCount = state.selectedClass?.weaponMasterySlots ?? 0;

        return {
          finalStepFailures: acc.finalStepFailures + (state.step === CreationStep.NameAndReview ? 0 : 1),
          nameFailures: acc.nameFailures + (state.characterName.trim().length > 0 ? 0 : 1),
          racePoolFailures: acc.racePoolFailures + (ACTIVE_RACES.some((race) => race.id === state.selectedRace?.id) ? 0 : 1),
          backgroundFailures: acc.backgroundFailures + (state.selectedBackground && BACKGROUNDS[state.selectedBackground] ? 0 : 1),
          classSkillCountFailures: acc.classSkillCountFailures + (selectedClassSkillCount === classSkillCount ? 0 : 1),
          illegalSkillChoices: acc.illegalSkillChoices + countIllegalSkills(state),
          illegalFeatureChoices: acc.illegalFeatureChoices + countIllegalFeatureChoices(state),
          masteryCountFailures: acc.masteryCountFailures + (masteryCount === requiredMasteryCount ? 0 : 1),
          illegalMasteryChoices: acc.illegalMasteryChoices + countIllegalWeaponMasteries(state),
          illegalFeatChoices: acc.illegalFeatChoices + countIllegalFeatChoices(state),
          incompletePriorSteps: acc.incompletePriorSteps + incompleteSteps.length,
        };
      },
      {
        finalStepFailures: 0,
        nameFailures: 0,
        racePoolFailures: 0,
        backgroundFailures: 0,
        classSkillCountFailures: 0,
        illegalSkillChoices: 0,
        illegalFeatureChoices: 0,
        masteryCountFailures: 0,
        illegalMasteryChoices: 0,
        illegalFeatChoices: 0,
        incompletePriorSteps: 0,
      },
    );

    expect(totals).toEqual({
      finalStepFailures: 0,
      nameFailures: 0,
      racePoolFailures: 0,
      backgroundFailures: 0,
      classSkillCountFailures: 0,
      illegalSkillChoices: 0,
      illegalFeatureChoices: 0,
      masteryCountFailures: 0,
      illegalMasteryChoices: 0,
      illegalFeatChoices: 0,
      incompletePriorSteps: 0,
    });
  });
});
