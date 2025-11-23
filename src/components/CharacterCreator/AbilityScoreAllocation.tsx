/**
 * @file AbilityScoreAllocation.tsx
 * This component allows the player to assign ability scores using a Point Buy system.
 * Players have a pool of points to spend, increasing scores from a base of 8 up to 15.
 * It displays the base scores, racial bonuses, final calculated scores, and remaining points.
 * It also includes a Stat Recommender section based on the selected class and a button
 * to apply class-recommended stats.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { AbilityScores, Race, AbilityScoreName, Class as CharClass } from '../../types'; // Path relative to src/components/CharacterCreator/
import { ABILITY_SCORE_NAMES } from '../../constants'; // Path relative to src/components/CharacterCreator/
import { POINT_BUY_TOTAL_POINTS, POINT_BUY_MIN_SCORE, POINT_BUY_MAX_SCORE, ABILITY_SCORE_COST } from '../../config/characterCreationConfig';

interface AbilityScoreAllocationProps {
  race: Race;
  selectedClass: CharClass | null; 
  onAbilityScoresSet: (scores: AbilityScores) => void;
  onBack: () => void; 
}

const STANDARD_RECOMMENDED_POINT_BUY_ARRAY = [15, 14, 13, 12, 10, 8]; // Costs 27 points

/**
 * AbilityScoreAllocation component.
 * Implements D&D 5e Point Buy system for ability scores.
 */
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

  useEffect(() => {
    // Recalculate points spent if baseScores change
    let spentPoints = 0;
    for (const ability of ABILITY_SCORE_NAMES) {
      spentPoints += ABILITY_SCORE_COST[baseScores[ability]];
    }
    setPointsRemaining(POINT_BUY_TOTAL_POINTS - spentPoints);
  }, [baseScores]); 

  const calculateFinalScore = useCallback(
    (abilityName: AbilityScoreName, baseVal: number): number => {
      const racialBonus = race.abilityBonuses?.find((b) => b.ability === abilityName)?.bonus || 0;
      return baseVal + racialBonus;
    },
    [race.abilityBonuses],
  );

  const handleScoreChange = (abilityName: AbilityScoreName, change: 1 | -1) => {
    const currentScore = baseScores[abilityName];
    const newScore = currentScore + change;

    if (newScore < POINT_BUY_MIN_SCORE || newScore > POINT_BUY_MAX_SCORE) {
      return; // Score out of bounds
    }

    const oldCostForAbility = ABILITY_SCORE_COST[currentScore];
    const newCostForAbility = ABILITY_SCORE_COST[newScore];
    const costDifference = newCostForAbility - oldCostForAbility;

    if (change === 1) { // Incrementing
      if (pointsRemaining >= costDifference) {
        setBaseScores(prev => ({ ...prev, [abilityName]: newScore }));
      }
    } else { // Decrementing
      setBaseScores(prev => ({ ...prev, [abilityName]: newScore }));
    }
  };

  // New handler for dropdown selection
  const handleScoreSelect = (abilityName: AbilityScoreName, newScoreValue: number) => {
    const currentScore = baseScores[abilityName];
    if (newScoreValue === currentScore) return; // No change

    const oldCostForAbility = ABILITY_SCORE_COST[currentScore];
    const newCostForAbility = ABILITY_SCORE_COST[newScoreValue];
    const costDifference = newCostForAbility - oldCostForAbility;

    // Check if the change is affordable
    if (pointsRemaining >= costDifference) {
      setBaseScores(prev => ({ ...prev, [abilityName]: newScoreValue }));
    } else {
      // Optional: Provide feedback to the user that they can't afford this score.
      // For now, we can just prevent the state update with no alert to avoid UI disruption
      console.log(`Cannot afford to set ${abilityName} to ${newScoreValue}. Need ${Math.abs(costDifference)} more points.`);
    }
  };
  
  const handleSubmit = () => {
    if (pointsRemaining === 0) {
      onAbilityScoresSet(baseScores);
    } else {
      alert(`Please spend all ${POINT_BUY_TOTAL_POINTS} points. You have ${pointsRemaining} points remaining.`);
    }
  };

  const handleSetRecommendedStats = () => {
    if (!selectedClass || !selectedClass.recommendedPointBuyPriorities) {
      alert("No recommended stat priorities defined for this class.");
      return;
    }

    const recommendedPriorities = selectedClass.recommendedPointBuyPriorities;
    const scoresToAssign = [...STANDARD_RECOMMENDED_POINT_BUY_ARRAY]; 
    
    const newBaseScores = { ...initialScores }; 

    recommendedPriorities.forEach((abilityName, index) => {
      if (index < scoresToAssign.length) {
        newBaseScores[abilityName] = scoresToAssign[index];
      } else {
        newBaseScores[abilityName] = POINT_BUY_MIN_SCORE;
      }
    });
    
    const assignedAbilities = new Set(recommendedPriorities);
    let remainingScoresIndex = recommendedPriorities.length;
    ABILITY_SCORE_NAMES.forEach(abilityName => {
        if (!assignedAbilities.has(abilityName)) {
            if (remainingScoresIndex < scoresToAssign.length) {
                 newBaseScores[abilityName] = scoresToAssign[remainingScoresIndex++];
            } else {
                 newBaseScores[abilityName] = POINT_BUY_MIN_SCORE;
            }
        }
    });

    setBaseScores(newBaseScores);
  };

  const getScoreCostFromBase = (score: number): number => {
    return ABILITY_SCORE_COST[score] || 0;
  };

  const canSetRecommended = !!selectedClass?.recommendedPointBuyPriorities;

  return (
    <div>
      <h2 className="text-2xl text-sky-300 mb-2 text-center">
        Allocate Ability Scores (Point Buy)
      </h2>
      <p className="text-sm text-gray-400 mb-1 text-center">
        You have <span className="font-bold text-amber-300">{POINT_BUY_TOTAL_POINTS}</span> points to spend. All scores start at 8.
      </p>
      <p className="text-xs text-gray-500 mb-4 text-center">
        Scores 9-13 cost 1 point each. Scores 14-15 cost 2 points each. Max score before racial bonus is 15.
      </p>
      
      {selectedClass && (selectedClass.statRecommendationFocus || selectedClass.statRecommendationDetails) && (
        <div className="mb-4 p-3 bg-gray-700/70 rounded-lg border border-sky-700 shadow">
          <h3 className="text-lg font-semibold text-sky-300 mb-1.5">
            Stat Recommendation for {selectedClass.name}
          </h3>
          {selectedClass.statRecommendationFocus && selectedClass.statRecommendationFocus.length > 0 && (
            <p className="text-sm text-gray-300 mb-0.5">
              Consider focusing on: <strong className="text-amber-300">{selectedClass.statRecommendationFocus.join(', ')}</strong>
            </p>
          )}
          {selectedClass.statRecommendationDetails && (
            <p className="text-xs text-gray-400 italic">{selectedClass.statRecommendationDetails}</p>
          )}
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={handleSetRecommendedStats}
          disabled={!canSetRecommended}
          className="w-full bg-sky-700 hover:bg-sky-600 disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors"
          aria-label={canSetRecommended ? `Set recommended stats for ${selectedClass?.name}` : "Recommended stats not available for this class"}
          title={canSetRecommended ? `Apply recommended stats for ${selectedClass?.name}` : "Recommended stats not available for this class"}
        >
          Set Recommended Stats for {selectedClass?.name || "Class"}
        </button>
      </div>

      <div className="mb-4 p-3 bg-gray-700 rounded-lg shadow">
        <h3 className="text-xl text-center font-semibold text-amber-300">
          Points Remaining: <span className={`text-2xl ${pointsRemaining < 0 ? 'text-red-400' : 'text-green-400'}`}>{pointsRemaining}</span> / {POINT_BUY_TOTAL_POINTS}
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 mb-4">
        {ABILITY_SCORE_NAMES.map((abilityName) => {
          const currentBaseScore = baseScores[abilityName];
          const racialBonus = race.abilityBonuses?.find(b => b.ability === abilityName)?.bonus || 0;
          const finalScore = currentBaseScore + racialBonus;
          const costToIncrement = currentBaseScore < POINT_BUY_MAX_SCORE ? (ABILITY_SCORE_COST[currentBaseScore + 1] - ABILITY_SCORE_COST[currentBaseScore]) : Infinity;

          return (
            <div key={abilityName} className="p-3 bg-gray-700 rounded-lg shadow-md flex flex-col items-center text-center">
              <h4 className="text-lg font-semibold text-amber-400 mb-1.5">{abilityName}</h4>
              
              <div className="flex items-center justify-center space-x-2 my-1">
                <button
                  onClick={() => handleScoreChange(abilityName, -1)}
                  disabled={currentBaseScore <= POINT_BUY_MIN_SCORE}
                  className="w-6 h-6 bg-red-600 hover:bg-red-500 disabled:bg-gray-500 text-white font-bold rounded text-sm flex items-center justify-center transition-colors"
                  aria-label={`Decrease ${abilityName} score`}
                >
                  -
                </button>
                <select
                  value={currentBaseScore}
                  onChange={(e) => handleScoreSelect(abilityName, parseInt(e.target.value, 10))}
                  className="text-xl font-bold text-sky-300 bg-gray-800 border border-gray-600 rounded-md px-2 py-1 focus:ring-sky-500 focus:border-sky-500 focus:outline-none min-w-0 text-center"
                  aria-label={`Select score for ${abilityName}`}
                >
                  {Object.keys(ABILITY_SCORE_COST).map(scoreStr => {
                    const score = parseInt(scoreStr, 10);
                    const costDiff = ABILITY_SCORE_COST[score] - ABILITY_SCORE_COST[currentBaseScore];
                    const isAffordable = pointsRemaining >= costDiff;
                    return (
                      <option
                        key={score}
                        value={score}
                        disabled={!isAffordable && score !== currentBaseScore}
                      >
                        {score}
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={() => handleScoreChange(abilityName, 1)}
                  disabled={currentBaseScore >= POINT_BUY_MAX_SCORE || pointsRemaining < costToIncrement}
                  className="w-6 h-6 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-bold rounded text-sm flex items-center justify-center transition-colors"
                  aria-label={`Increase ${abilityName} score`}
                >
                  +
                </button>
              </div>

              <p className="text-xs text-gray-400 mt-1 mb-0.5">
                Cost: {getScoreCostFromBase(currentBaseScore)} pts
              </p>
              {racialBonus !== 0 && (
                <p className="text-xs text-sky-200">{race.name} Bonus: {racialBonus > 0 ? `+${racialBonus}` : racialBonus}</p>
              )}
              <p className="text-md text-green-400 font-bold mt-0.5">Final: {finalScore}</p>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 mt-6">
        <button
          onClick={onBack}
          className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors"
          aria-label="Go back to class selection"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={pointsRemaining !== 0}
          className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors"
          aria-label="Confirm ability scores"
        >
          {pointsRemaining === 0 ? 'Confirm Scores' : `Spend ${pointsRemaining} more points`}
        </button>
      </div>
    </div>
  );
};

export default AbilityScoreAllocation;
