/**
 * @file LevelUpModal.tsx
 * Modal UI for confirming level-ups, including class selection and ASI/feat choices.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import {
  AbilityScoreName,
  AbilityScores,
  FeatChoice,
  Feat,
  LevelUpChoices,
  PlayerCharacter,
} from '../../types';
import { CLASSES_DATA } from '../../constants';
import { FEATS_DATA } from '../../data/feats/featsData';
import {
  canLevelUp,
  evaluateFeatPrerequisites,
  getAbilityScoreImprovementBudget,
} from '../../utils/character';
import FeatSelection from '../CharacterCreator/FeatSelection';
import { subclassesForClass } from '../../data/classes/subclasses';
import { classFeaturesForLevel } from '../../data/classes/classFeatureProgression';
import { SKILLS_DATA } from '../../data/skills';
import { EXPERTISE_CHOICE_KEY } from '../../utils/character/skillModifierUtils';
import type { FeatChoiceState, FeatChoiceValue } from '../CharacterCreator/state/characterCreatorState';

interface LevelUpModalProps {
  isOpen: boolean;
  character: PlayerCharacter | null;
  onClose: () => void;
  onConfirm: (choices: LevelUpChoices) => void;
}

type LevelUpStep = 'choice' | 'asi' | 'feat' | 'base';
type FeatOption = Feat & { isEligible: boolean; unmet: string[] };

/**
 * Every source of Expertise the level-up flow can offer, keyed by the id the
 * choice is recorded under (agora-db71.18).
 *
 * The key IS the `featChoices` key. `skillModifierUtils.getExpertiseSkillIds`
 * walks every `featChoices` entry looking for `selectedExpertiseSkills`, so a
 * class feature and a feat both land in the same place without either knowing
 * the other exists — which is why this registry can stay this small.
 *
 * `eligibleSkillIds` is present only where the source restricts the choice.
 * Everything else is limited to skills the character is already proficient in,
 * because `calculateExpertiseBonus` returns 0 without proficiency: offering a
 * non-proficient skill would be offering a pick worth nothing.
 *
 * NOT LISTED, on purpose: the Rogue. This project's class data gives the rogue
 * `sneak_attack` at level 1 and `cunning_action`/`steady_aim` at 2-3
 * (`src/data/classes/index.ts`, `tierOneFeatures.ts`); there is no rogue
 * Expertise feature to key on. This registry is data-driven off the feature id,
 * so adding one to the class data is all that picker would need.
 */
const EXPERTISE_GRANTS: Record<string, { picks: number; eligibleSkillIds?: string[] }> = {
  /** Bard, level 2: "Double your proficiency bonus on two chosen skills." */
  expertise: { picks: 2 },
  /** Wizard, level 2 (Scholar): one skill, from the six knowledge skills. */
  scholar: {
    picks: 1,
    eligibleSkillIds: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion'],
  },
  /** The Skill Expert feat: one skill the character is already proficient with. */
  skill_expert: { picks: 1 },
};

const ABILITY_ORDER: AbilityScoreName[] = [
  'Strength',
  'Dexterity',
  'Constitution',
  'Intelligence',
  'Wisdom',
  'Charisma',
];

const LevelUpModal: React.FC<LevelUpModalProps> = ({ isOpen, character, onClose, onConfirm }) => {
  // Resolve the next level and ASI budget up front for consistent rendering.
  const nextLevel = (character?.level ?? 1) + 1;
  const asiBudget = getAbilityScoreImprovementBudget(nextLevel);

  const classOptions = useMemo(() => {
    if (!character) return [];
    const classIds = new Set<string>();
    if (character.class?.id) classIds.add(character.class.id);
    Object.keys(character.classLevels ?? {}).forEach((id) => classIds.add(id));
    (character.classes ?? []).forEach((cls) => classIds.add(cls.id));

    return Array.from(classIds).map((classId) => {
      const resolved = CLASSES_DATA[classId] ||
        character.classes?.find((cls) => cls.id === classId) ||
        (character.class?.id === classId ? character.class : null);
      return {
        id: classId,
        name: resolved?.name ?? classId,
        hitDie: resolved?.hitDie ?? 8,
      };
    });
  }, [character]);

  // Track player selections for class, ASI, and feat paths.
  const [step, setStep] = useState<LevelUpStep>('choice');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [abilityScoreIncreases, setAbilityScoreIncreases] = useState<Partial<AbilityScores>>({});
  const [selectedFeatId, setSelectedFeatId] = useState<string>('');
  const [featChoices, setFeatChoices] = useState<Record<string, FeatChoiceState>>({});
  const [selectedSubclassId, setSelectedSubclassId] = useState<string>('');

  // The level-3 subclass milestone: offer the class's subclasses when the
  // character is advancing to level 3 and hasn't already chosen one.
  const subclassOptions = useMemo(() => {
    if (!character || nextLevel < 3 || character.subclassId) return [];
    return subclassesForClass(selectedClassId || character.class?.id || '');
  }, [character, nextLevel, selectedClassId]);
  const needsSubclassChoice = subclassOptions.length > 0;

  /**
   * The Expertise sources that arrive at THIS level-up and still need a pick.
   *
   * Two kinds, resolved the same way:
   *  - class features whose `levelAvailable` is exactly `nextLevel` (so a bard
   *    advancing to 4 is not asked to re-pick the Expertise they took at 2);
   *  - the Skill Expert feat, but only once the player has actually selected it.
   *
   * Candidates are the character's proficient skills, minus any skill they
   * already hold Expertise in, because doubling an already-doubled bonus is not
   * a choice the rules offer.
   */
  const expertiseGrants = useMemo(() => {
    if (!character) return [];
    const alreadyExpert = new Set(
      Object.values(character.featChoices ?? {}).flatMap((choice) => {
        const selected = (choice as Record<string, unknown> | undefined)?.[EXPERTISE_CHOICE_KEY];
        return Array.isArray(selected) ? selected.filter((s): s is string => typeof s === 'string') : [];
      })
    );
    const proficientSkillIds = (character.skills ?? [])
      .map((skill) => skill.id)
      .filter((id) => !alreadyExpert.has(id));

    const sources = classFeaturesForLevel(character.class, nextLevel, character.subclassId)
      .filter((feature) => (feature.levelAvailable ?? 1) === nextLevel && EXPERTISE_GRANTS[feature.id])
      .map((feature) => ({ id: feature.id, name: feature.name, description: feature.description }));

    if (selectedFeatId === 'skill_expert') {
      const feat = FEATS_DATA.find((entry) => entry.id === 'skill_expert');
      sources.push({
        id: 'skill_expert',
        name: feat?.name ?? 'Skill Expert',
        description: 'Choose the skill this feat doubles your proficiency bonus in.',
      });
    }

    return sources.map((source) => {
      const grant = EXPERTISE_GRANTS[source.id];
      const eligible = grant.eligibleSkillIds
        ? proficientSkillIds.filter((id) => grant.eligibleSkillIds?.includes(id))
        : proficientSkillIds;
      return { ...source, picks: grant.picks, eligibleSkillIds: eligible };
    });
  }, [character, nextLevel, selectedFeatId]);

  const expertisePicksFor = (featureId: string): string[] => {
    const selected = featChoices[featureId]?.[EXPERTISE_CHOICE_KEY];
    return Array.isArray(selected) ? selected : [];
  };

  /**
   * Toggles one skill in one grant's pick list, capped at that grant's allowance.
   * Re-clicking a chosen skill removes it, so a player can change their mind
   * without a reset control.
   */
  const handleExpertiseToggle = (featureId: string, skillId: string, picks: number) => {
    const current = expertisePicksFor(featureId);
    const next = current.includes(skillId)
      ? current.filter((id) => id !== skillId)
      : [...current, skillId];
    if (next.length > picks) return;
    handleFeatChoice(featureId, EXPERTISE_CHOICE_KEY, next);
  };

  /**
   * Every offered grant must be filled before the level-up can be confirmed. A
   * grant with no eligible skill at all (a wizard proficient in none of the six
   * Scholar skills) is treated as satisfied rather than as a dead end.
   */
  const areExpertisePicksComplete = expertiseGrants.every(
    (grant) =>
      grant.eligibleSkillIds.length === 0 ||
      expertisePicksFor(grant.id).length === Math.min(grant.picks, grant.eligibleSkillIds.length)
  );

  useEffect(() => {
    if (!isOpen || !character) return;
    // Reset modal state for the active character so choices don't leak across sessions.
    const defaultClassId = classOptions[0]?.id ?? character.class?.id ?? '';
    setSelectedClassId(defaultClassId);
    setAbilityScoreIncreases({});
    setSelectedFeatId('');
    setFeatChoices({});
    setSelectedSubclassId('');
    setStep(asiBudget > 0 ? 'choice' : 'base');
  }, [isOpen, character?.id, asiBudget, classOptions, character]);

  const totalAsiSpent = Object.values(abilityScoreIncreases).reduce((sum, value) => sum + (value || 0), 0);
  const remainingAsi = Math.max(0, asiBudget - totalAsiSpent);

  const handleAbilityAdjust = (ability: AbilityScoreName, delta: number) => {
    if (!character) return;
    // Enforce ASI budget and the ability score cap (20) in the UI.
    setAbilityScoreIncreases((prev) => {
      const current = prev[ability] || 0;
      const next = Math.max(0, current + delta);
      const spentSoFar = Object.values(prev).reduce((sum, value) => sum + (value || 0), 0);
      const tentativeSpent = spentSoFar - current + next;
      const baseScore = character.abilityScores[ability] || 0;

      if (tentativeSpent > asiBudget) return prev;
      if (baseScore + next > 20) return prev;

      return { ...prev, [ability]: next };
    });
  };

  const availableFeats: FeatOption[] = useMemo(() => {
    if (!character) return [];
    const abilityScores = character.finalAbilityScores || character.abilityScores;
    const classIds = classOptions.length > 0 ? classOptions.map((option) => option.id) : [character.class?.id || ''];
    // Feat prerequisites are evaluated against each class the character already has.
    const hasFightingStyle = !!character.selectedFightingStyle ||
      classIds.some((id) => (CLASSES_DATA[id]?.fightingStyles?.length || 0) > 0);

    return FEATS_DATA.map((feat) => {
      const evaluations = classIds.map((classId) =>
        evaluateFeatPrerequisites(feat, {
          level: nextLevel,
          abilityScores,
          raceId: character.race.id,
          classId,
          knownFeats: character.feats || [],
          hasFightingStyle,
          hasSpellcasting: !!character.class?.spellcasting || classIds.some((id) => !!CLASSES_DATA[id]?.spellcasting),
        }),
      );
      const isEligible = evaluations.some((entry) => entry.isEligible);
      const bestUnmet = evaluations.sort((a, b) => a.unmet.length - b.unmet.length)[0]?.unmet ?? [];
      return {
        ...feat,
        isEligible,
        unmet: isEligible ? [] : bestUnmet,
      };
    });
  }, [character, nextLevel, classOptions]);

  const hasEligibleFeats = useMemo(
    () => availableFeats.some((feat) => feat.isEligible),
    [availableFeats],
  );

  const handleFeatChoice = (featId: string, choiceType: string, value: FeatChoiceValue) => {
    setFeatChoices((prev) => ({
      ...prev,
      [featId]: { ...(prev[featId] || {}), [choiceType]: value },
    }));
  };

  const handleConfirm = (payloadStep: 'asi' | 'feat' | 'base') => {
    if (!character) return;
    // An unfilled Expertise pick blocks every path, including FeatSelection's own
    // Confirm button, which this component does not own. The warning line above
    // the step content says why.
    if (!areExpertisePicksComplete) return;
    // Build the LevelUpChoices payload so the reducer can apply the selections.
    //
    // WHAT CHANGED (agora-db71.18): `featChoices` used to ride only on the 'feat'
    // step. A class-feature Expertise pick (bard level 2) is made on the 'base'
    // step, so restricting the payload to 'feat' would have dropped it silently.
    const hasChoices = Object.keys(featChoices).length > 0;
    const choices: LevelUpChoices = {
      classId: selectedClassId || character.class?.id,
      abilityScoreIncreases: payloadStep === 'asi' ? abilityScoreIncreases : undefined,
      featId: payloadStep === 'feat' ? selectedFeatId || undefined : undefined,
      featChoices: hasChoices ? (featChoices as Record<string, FeatChoice>) : undefined,
      subclassId: needsSubclassChoice ? (selectedSubclassId || undefined) : undefined,
    };
    onConfirm(choices);
    onClose();
  };

  if (!isOpen || !character) return null;

  if (!canLevelUp(character)) {
    return null;
  }

  return (
    <WindowFrame
      title="Level Up"
      onClose={onClose}
      storageKey={WINDOW_KEYS.LEVEL_UP}
      initialMaximized={false}
    >
      <div className="flex flex-col h-full">
        {/* Advancement subtitle (was a header subtitle). */}
        <div className="shrink-0 px-6 py-2 border-b border-gray-700 bg-gray-900/40">
          <p className="text-xs text-gray-400">
            {character.name} advances to level {nextLevel}.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollable-content px-6 py-4 space-y-4">
          {/* Class selection stays visible for all steps when multiple classes are present. */}
          {classOptions.length > 1 && (
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/40">
              <h3 className="text-sm font-semibold text-amber-200 mb-3">Choose a class to advance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {classOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedClassId(option.id)}
                    className={`p-3 rounded border text-left transition-colors ${
                      selectedClassId === option.id
                        ? 'bg-amber-700/30 border-amber-500 text-white'
                        : 'bg-gray-700/50 border-gray-600 text-gray-200 hover:bg-gray-700'
                    }`}
                  >
                    <div className="font-semibold">{option.name}</div>
                    <div className="text-xs text-gray-400">Hit Die: d{option.hitDie}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {classOptions.length === 1 && (
            <div className="text-xs text-gray-400">
              Leveling as {classOptions[0]?.name} (Hit Die d{classOptions[0]?.hitDie}).
            </div>
          )}

          {/*
            Expertise picker (agora-db71.18). Rendered outside the step switch on
            purpose: a bard's Expertise arrives at level 2, where `asiBudget` is 0
            and the flow sits on the 'base' step, while the Skill Expert feat's
            pick belongs to the 'feat' step. One block serves both.
          */}
          {expertiseGrants.map((grant) => {
            const picked = expertisePicksFor(grant.id);
            const allowance = Math.min(grant.picks, grant.eligibleSkillIds.length);
            return (
              <div key={grant.id} className="border border-gray-700 rounded-lg p-4 bg-gray-900/40 space-y-3">
                <h3 className="text-sm font-semibold text-amber-200">{grant.name}: choose your Expertise</h3>
                <p className="text-xs text-gray-400">{grant.description}</p>
                {grant.eligibleSkillIds.length === 0 ? (
                  <p className="text-xs text-red-300">
                    No eligible skill: Expertise only doubles a proficiency you already have.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-gray-400">
                      Chosen {picked.length} of {allowance}.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {grant.eligibleSkillIds.map((skillId) => {
                        const isPicked = picked.includes(skillId);
                        return (
                          <button
                            key={skillId}
                            type="button"
                            onClick={() => handleExpertiseToggle(grant.id, skillId, allowance)}
                            aria-pressed={isPicked}
                            className={`p-2 rounded border text-left text-sm transition-colors ${
                              isPicked
                                ? 'bg-amber-700/30 border-amber-500 text-white'
                                : 'bg-gray-700/50 border-gray-600 text-gray-200 hover:bg-gray-700'
                            }`}
                          >
                            {SKILLS_DATA[skillId]?.name ?? skillId}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {!areExpertisePicksComplete && (
            <p className="text-xs text-red-300">
              Choose your Expertise skills before confirming this level.
            </p>
          )}

          {asiBudget > 0 && step === 'choice' && (
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/40 space-y-3">
              <h3 className="text-sm font-semibold text-amber-200">Choose your level-up reward</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStep('asi')}
                  className="p-4 rounded-lg border border-gray-600 bg-gray-700/50 hover:bg-gray-700 text-left"
                >
                  <div className="font-semibold text-amber-300">Ability Score Improvement</div>
                  <div className="text-xs text-gray-400">Spend {asiBudget} points across your abilities.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setStep('feat')}
                  className="p-4 rounded-lg border border-gray-600 bg-gray-700/50 hover:bg-gray-700 text-left"
                >
                  <div className="font-semibold text-amber-300">Feat</div>
                  <div className="text-xs text-gray-400">Select a feat you qualify for.</div>
                </button>
              </div>
            </div>
          )}

          {asiBudget > 0 && step === 'asi' && (
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/40 space-y-3">
              <h3 className="text-sm font-semibold text-amber-200">Ability Score Improvement</h3>
              <p className="text-xs text-gray-400">
                Remaining points: {remainingAsi}. You must spend all {asiBudget} points to confirm.
              </p>
              <div className="space-y-2">
                {ABILITY_ORDER.map((ability) => {
                  const base = character.abilityScores[ability] || 0;
                  const increase = abilityScoreIncreases[ability] || 0;
                  const nextScore = Math.min(20, base + increase);
                  return (
                    <div key={ability} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-200">{ability}</div>
                        <div className="text-xs text-gray-400">
                          {base} → {nextScore}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAbilityAdjust(ability, -1)}
                          className="w-7 h-7 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40"
                          disabled={increase <= 0}
                          aria-label={`Decrease ${ability}`}
                        >
                          -
                        </button>
                        <div className="w-8 text-center text-sm text-gray-100">{increase}</div>
                        <button
                          type="button"
                          onClick={() => handleAbilityAdjust(ability, 1)}
                          className="w-7 h-7 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40"
                          disabled={remainingAsi <= 0 || base + increase >= 20}
                          aria-label={`Increase ${ability}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setStep('choice')}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded-lg"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirm('asi')}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                  disabled={totalAsiSpent !== asiBudget || !areExpertisePicksComplete}
                >
                  Confirm Level Up
                </button>
              </div>
            </div>
          )}

          {asiBudget > 0 && step === 'feat' && (
            <FeatSelection
              availableFeats={availableFeats}
              selectedFeatId={selectedFeatId || undefined}
              featChoices={featChoices}
              onSelectFeat={setSelectedFeatId}
              onSetFeatChoice={handleFeatChoice}
              onConfirm={() => handleConfirm('feat')}
              onBack={() => setStep('choice')}
              hasEligibleFeats={hasEligibleFeats}
              knownSkillIds={character.skills?.map((skill) => skill.id) || []}
              allowSkip={false}
            />
          )}

          {asiBudget === 0 && step === 'base' && (
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/40 space-y-3">
              {needsSubclassChoice ? (
                <>
                  <h3 className="text-sm font-semibold text-amber-200">Choose your subclass</h3>
                  <p className="text-xs text-gray-400">
                    At level 3 you commit to a specialization — the defining choice of your career.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {subclassOptions.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSelectedSubclassId(sub.id)}
                        className={`p-3 rounded border text-left transition-colors ${
                          selectedSubclassId === sub.id
                            ? 'bg-amber-700/30 border-amber-500 text-white'
                            : 'bg-gray-700/50 border-gray-600 text-gray-200 hover:bg-gray-700'
                        }`}
                      >
                        <div className="font-semibold">{sub.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{sub.description}</div>
                        <div className="text-xs text-amber-200/80 mt-1">
                          Grants: {sub.features.filter((feat) => feat.levelAvailable === 3).map((feat) => feat.name).join(', ')}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-amber-200">Confirm level up</h3>
                  <p className="text-xs text-gray-400">
                    This level does not grant an Ability Score Improvement or feat choice.
                  </p>
                </>
              )}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirm('base')}
                  disabled={(needsSubclassChoice && !selectedSubclassId) || !areExpertisePicksComplete}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  Confirm Level Up
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </WindowFrame>
  );
};

export default LevelUpModal;
