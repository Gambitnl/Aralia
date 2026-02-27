// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:26:33
 * Dependents: CharacterCreator.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file AbilityScoreAllocation.tsx
 * Refactored to use Split Config Style (Calculator vs Stat Preview).
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Pruning] Removed unused 'useCallback' import, 
 * 'firstUnaffordableScore' state and its associated logic in useEffect, 
 * and the unused 'handleScoreSelect' function to resolve ESLint warnings 
 * and improve code maintainability.
 */
import React, { useState, useEffect } from 'react';
import { AbilityScores, Race, AbilityScoreName, Class as CharClass } from '../../types';
import { ABILITY_SCORE_NAMES } from '../../constants';
import { POINT_BUY_TOTAL_POINTS, POINT_BUY_MIN_SCORE, POINT_BUY_MAX_SCORE, ABILITY_SCORE_COST } from '../../config/characterCreationConfig';
import { Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { CreationStepLayout } from './ui/CreationStepLayout';
import { SplitPaneLayout } from '../ui/SplitPaneLayout';

interface AbilityScoreAllocationProps {
  race: Race;
  selectedClass: CharClass | null;
  onAbilityScoresSet: (scores: AbilityScores) => void;
  onBack: () => void;
}

const STANDARD_RECOMMENDED_POINT_BUY_ARRAY = [15, 14, 13, 12, 10, 8];

const getAbilityModifier = (score: number) => Math.floor((score - 10) / 2);
const getAbilityModifierString = (score: number) => {
  const mod = getAbilityModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

const AbilityScoreAllocation: React.FC<AbilityScoreAllocationProps> = ({
  race,
  selectedClass,
  onAbilityScoresSet,
  onBack,
}) => {
  const initialScores = ABILITY_SCORE_NAMES.reduce(
    (acc, name) => {
      acc[name] = POINT_BUY_MIN_SCORE;
      return acc;
    },
    {} as AbilityScores,
  );

  const [baseScores, setBaseScores] = useState<AbilityScores>(initialScores);
  const [pointsRemaining, setPointsRemaining] = useState<number>(POINT_BUY_TOTAL_POINTS);
  const [feedback, setFeedback] = useState<{ type: 'info' | 'error' | 'success'; message: string; targetAbility?: AbilityScoreName } | null>(null);

  useEffect(() => {
    let spentPoints = 0;
    for (const ability of ABILITY_SCORE_NAMES) {
      spentPoints += ABILITY_SCORE_COST[baseScores[ability]];
    }
    const newPointsRemaining = POINT_BUY_TOTAL_POINTS - spentPoints;
    setPointsRemaining(newPointsRemaining);
  }, [baseScores]);

  const handleScoreChange = (abilityName: AbilityScoreName, change: 1 | -1) => {
    const currentScore = baseScores[abilityName];
    const newScore = currentScore + change;

    if (newScore < POINT_BUY_MIN_SCORE || newScore > POINT_BUY_MAX_SCORE) return;

    const costDiff = ABILITY_SCORE_COST[newScore] - ABILITY_SCORE_COST[currentScore];

    if (change === 1 && pointsRemaining < costDiff) return;

    setBaseScores(prev => ({ ...prev, [abilityName]: newScore }));
    setFeedback(null);
  };

  const handleSubmit = () => {
    if (pointsRemaining === 0) {
      onAbilityScoresSet(baseScores);
    }
  };

  const handleSetRecommendedStats = () => {
    if (!selectedClass?.recommendedPointBuyPriorities) return;

    const newBaseScores = { ...initialScores };
    const priorities = selectedClass.recommendedPointBuyPriorities;
    const scoresToAssign = [...STANDARD_RECOMMENDED_POINT_BUY_ARRAY];

    priorities.forEach((ability, idx) => {
      if (idx < scoresToAssign.length) newBaseScores[ability] = scoresToAssign[idx];
    });

    // Assign remaining standard array scores to remaining abilities arbitrarily
    const assignedAbilities = new Set(priorities);
    let remainingIdx = priorities.length;
    ABILITY_SCORE_NAMES.forEach(ability => {
        if (!assignedAbilities.has(ability)) {
            if (remainingIdx < scoresToAssign.length) {
                newBaseScores[ability] = scoresToAssign[remainingIdx++];
            }
        }
    });

    setBaseScores(newBaseScores);
    setFeedback({ type: 'success', message: 'Applied recommended spread.' });
  };

  const canSetRecommended = !!selectedClass?.recommendedPointBuyPriorities;

  const headerActions = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setBaseScores(initialScores);
        setFeedback({ type: 'info', message: 'Scores reset to minimum.' });
      }}
      disabled={Object.values(baseScores).every(s => s === POINT_BUY_MIN_SCORE)}
      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
    >
      Reset
    </Button>
  );

  return (
    <CreationStepLayout
      title="Assign Ability Scores"
      onBack={onBack}
      onNext={handleSubmit}
      canProceed={pointsRemaining === 0}
      nextLabel={pointsRemaining === 0 ? 'Confirm Attributes' : `Spend ${pointsRemaining} more`}
      bodyScrollable={false}
      headerActions={headerActions}
    >
      <div className="h-full min-h-0">
        <SplitPaneLayout
          controls={
            <div className="space-y-4">
              {/* Header / Points Display */}
              <div className="sticky top-0 bg-gray-900/90 backdrop-blur-sm z-[var(--z-index-content-overlay-low)] pb-4 border-b border-gray-700 -mx-4 px-4 pt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400 text-sm">Points Available</span>
                  <span className={`text-2xl font-bold ${pointsRemaining < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                    {pointsRemaining} <span className="text-sm text-gray-500 font-normal">/ {POINT_BUY_TOTAL_POINTS}</span>
                  </span>
                </div>
                
                <button
                  onClick={handleSetRecommendedStats}
                  disabled={!canSetRecommended}
                  className="w-full py-2 px-3 bg-sky-700/50 hover:bg-sky-600/50 border border-sky-600/50 rounded-lg text-sky-200 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Sparkles size={14} />
                  Apply {selectedClass?.name || 'Class'} Recommended
                </button>

                {feedback && (
                  <div className={`mt-2 text-xs text-center px-2 py-1 rounded border ${
                    feedback.type === 'error' ? 'bg-red-900/30 border-red-500/50 text-red-200' :
                    feedback.type === 'success' ? 'bg-green-900/30 border-green-500/50 text-green-200' :
                    'bg-blue-900/30 border-blue-500/50 text-blue-200'
                  }`}>
                    {feedback.message}
                  </div>
                )}
              </div>

              {/* Controls Grid */}
              <div className="space-y-3">
                {ABILITY_SCORE_NAMES.map((abilityName) => {
                  const currentBaseScore = baseScores[abilityName];
                  const costToIncrement = currentBaseScore < POINT_BUY_MAX_SCORE ? (ABILITY_SCORE_COST[currentBaseScore + 1] - ABILITY_SCORE_COST[currentBaseScore]) : Infinity;
                  const isFeedbackTarget = feedback?.targetAbility === abilityName;
                  const isSpellcastingAbility = selectedClass?.spellcasting?.ability === abilityName;

                  return (
                    <div
                      key={abilityName}
                      className={`p-3 bg-gray-800 rounded-lg border ${isFeedbackTarget ? 'border-amber-500 ring-1 ring-amber-500' : 'border-gray-700'}`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className={`font-semibold ${isSpellcastingAbility ? 'text-purple-300' : 'text-gray-300'}`}>
                          {abilityName}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          {ABILITY_SCORE_COST[currentBaseScore]} pts
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleScoreChange(abilityName, -1)}
                          disabled={currentBaseScore <= POINT_BUY_MIN_SCORE}
                          className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold"
                        >
                          -
                        </button>
                        
                        <div className="flex-1 text-center font-bold text-xl text-sky-300 bg-black/20 rounded py-0.5">
                          {currentBaseScore}
                        </div>

                        <button
                          onClick={() => handleScoreChange(abilityName, 1)}
                          disabled={currentBaseScore >= POINT_BUY_MAX_SCORE || pointsRemaining < costToIncrement}
                          className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          }
          preview={
            // TODO: Extract this Stat Snapshot visualization into a reusable component (e.g., <CharacterStatBlock />).
            <div className="flex flex-col h-full">
              <div className="border-b border-gray-700 pb-4 mb-6">
                <h2 className="text-3xl font-bold text-amber-400 font-cinzel">Ability Snapshot</h2>
                <p className="text-sm text-gray-400">Final scores include racial bonuses.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ABILITY_SCORE_NAMES.map((ability) => {
                  const base = baseScores[ability];
                  const racial = race.abilityBonuses?.find(b => b.ability === ability)?.bonus || 0;
                  const final = base + racial;
                  const mod = getAbilityModifierString(final);
                  const isPrimary = selectedClass?.primaryAbility.includes(ability);
                  const isSave = selectedClass?.savingThrowProficiencies.includes(ability);

                  return (
                    <div key={ability} className="bg-gray-900/40 border border-gray-700 rounded-xl p-4 flex flex-col items-center relative overflow-hidden group">
                      {/* Background "watermark" letter */}
                      <span className="absolute -bottom-4 -right-2 text-6xl font-black text-gray-800/50 select-none group-hover:text-gray-800/80 transition-colors">
                        {ability.charAt(0)}
                      </span>

                      <h3 className={`font-cinzel font-bold text-lg mb-1 z-[var(--z-index-content-overlay-low)] ${isPrimary ? 'text-amber-400' : 'text-gray-400'}`}>
                        {ability.toUpperCase()}
                      </h3>
                      
                      <div className="text-4xl font-black text-white z-[var(--z-index-content-overlay-low)] mb-1">
                        {final}
                      </div>
                      
                      <div className={`px-3 py-0.5 rounded-full text-sm font-bold z-[var(--z-index-content-overlay-low)] ${
                        parseInt(mod) >= 0 ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'
                      }`}>
                        {mod}
                      </div>

                      <div className="w-full mt-4 pt-3 border-t border-gray-700/50 z-[var(--z-index-content-overlay-low)] text-xs space-y-1">
                        <div className="flex justify-between text-gray-500">
                          <span>Base</span>
                          <span>{base}</span>
                        </div>
                        {racial !== 0 && (
                          <div className="flex justify-between text-sky-400">
                            <span>{race.name}</span>
                            <span>+{racial}</span>
                          </div>
                        )}
                        {isSave && (
                          <div className="mt-2 text-center text-purple-300 font-medium bg-purple-900/20 rounded py-1 border border-purple-500/20">
                            Saving Throw Prof.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          }
        />
      </div>
    </CreationStepLayout>
  );
};

export default AbilityScoreAllocation;