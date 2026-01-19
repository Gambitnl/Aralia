/**
 * @file LevelUpModal.tsx
 * Modal UI for confirming level-ups, including class selection and ASI/feat choices.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion, MotionProps } from 'framer-motion';
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
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  canLevelUp,
  evaluateFeatPrerequisites,
  getAbilityScoreImprovementBudget,
} from '../../utils/characterUtils';
import FeatSelection from '../CharacterCreator/FeatSelection';
import type { FeatChoiceState, FeatChoiceValue } from '../CharacterCreator/state/characterCreatorState';

interface LevelUpModalProps {
  isOpen: boolean;
  character: PlayerCharacter | null;
  onClose: () => void;
  onConfirm: (choices: LevelUpChoices) => void;
}

const overlayMotion: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalMotion: MotionProps = {
  initial: { y: -20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -20, opacity: 0 },
};

type LevelUpStep = 'choice' | 'asi' | 'feat' | 'base';
type FeatOption = Feat & { isEligible: boolean; unmet: string[] };

const ABILITY_ORDER: AbilityScoreName[] = [
  'Strength',
  'Dexterity',
  'Constitution',
  'Intelligence',
  'Wisdom',
  'Charisma',
];

const LevelUpModal: React.FC<LevelUpModalProps> = ({ isOpen, character, onClose, onConfirm }) => {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

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

  useEffect(() => {
    if (!isOpen || !character) return;
    // Reset modal state for the active character so choices don't leak across sessions.
    const defaultClassId = classOptions[0]?.id ?? character.class?.id ?? '';
    setSelectedClassId(defaultClassId);
    setAbilityScoreIncreases({});
    setSelectedFeatId('');
    setFeatChoices({});
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
    // Build the LevelUpChoices payload so the reducer can apply the selections.
    const choices: LevelUpChoices = {
      classId: selectedClassId || character.class?.id,
      abilityScoreIncreases: payloadStep === 'asi' ? abilityScoreIncreases : undefined,
      featId: payloadStep === 'feat' ? selectedFeatId || undefined : undefined,
      featChoices: payloadStep === 'feat' ? (featChoices as Record<string, FeatChoice>) : undefined,
    };
    onConfirm(choices);
    onClose();
  };

  if (!isOpen || !character) return null;

  if (!canLevelUp(character)) {
    return null;
  }

  return (
    <motion.div
      {...overlayMotion}
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="level-up-title"
    >
      <motion.div
        ref={modalRef}
        {...modalMotion}
        className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-900/40">
          <div>
            <h2 id="level-up-title" className="text-xl font-semibold text-amber-300">
              Level Up
            </h2>
            <p className="text-xs text-gray-400">
              {character.name} advances to level {nextLevel}.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close level up"
            type="button"
          >
            x
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollable-content px-6 py-4 space-y-4">
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
                  disabled={totalAsiSpent !== asiBudget}
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
              <h3 className="text-sm font-semibold text-amber-200">Confirm level up</h3>
              <p className="text-xs text-gray-400">
                This level does not grant an Ability Score Improvement or feat choice.
              </p>
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
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2 rounded-lg"
                >
                  Confirm Level Up
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LevelUpModal;
