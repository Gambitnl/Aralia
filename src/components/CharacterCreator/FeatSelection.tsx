import React from 'react';
import { Feat } from '../../types';

interface FeatOption extends Feat {
  isEligible: boolean;
  unmet: string[];
}

interface FeatSelectionProps {
  availableFeats: FeatOption[];
  selectedFeatId?: string;
  onSelectFeat: (featId: string) => void;
  onBack?: () => void;
}

const FeatSelection: React.FC<FeatSelectionProps> = ({ availableFeats, selectedFeatId, onSelectFeat, onBack }) => {
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl text-sky-300 mb-4 text-center">Select a Feat</h2>
      <p className="text-gray-400 text-center mb-6">
        Choose a feat to customize your character's abilities.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto mb-6 p-2">
        {availableFeats.map((feat) => {
          const isSelected = feat.id === selectedFeatId;
          const disabled = !feat.isEligible;
          return (
            <div
              key={feat.id}
              onClick={() => !disabled && onSelectFeat(feat.id)}
              className={`
                p-4 rounded-lg border cursor-pointer transition-all duration-200 relative
                ${disabled ? 'bg-gray-900 border-gray-800 cursor-not-allowed opacity-70'
                  : isSelected
                    ? 'bg-amber-900/40 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750'
                }
              `}
            >
              <div className="flex justify-between items-start mb-2">
                 <h3 className={`font-cinzel font-bold text-lg ${isSelected ? 'text-amber-400' : 'text-gray-200'}`}>
                  {feat.name}
                </h3>
              </div>

              <p className="text-sm text-gray-400 mb-2">{feat.description}</p>

              {feat.benefits && (
                  <div className="text-xs text-gray-500 mt-2">
                      <strong className="text-gray-400">Benefits:</strong>
                      <ul className="list-disc list-inside mt-1">
                          {feat.benefits.abilityScoreIncrease && Object.entries(feat.benefits.abilityScoreIncrease)
                            .filter(([, value]) => (value || 0) > 0)
                            .length > 0 && (
                              <li>
                                Ability Score Increase: {Object.entries(feat.benefits.abilityScoreIncrease)
                                  .filter(([, value]) => (value || 0) > 0)
                                  .map(([k, v]) => `${k} +${v}`).join(', ')}
                              </li>
                          )}
                          {feat.benefits.speedIncrease && <li>Speed +{feat.benefits.speedIncrease} ft</li>}
                          {feat.benefits.initiativeBonus && <li>Initiative +{feat.benefits.initiativeBonus}</li>}
                          {feat.benefits.hpMaxIncreasePerLevel && <li>HP Max +{feat.benefits.hpMaxIncreasePerLevel} per level</li>}
                          {feat.benefits.resistance && <li>Resistance: {feat.benefits.resistance.join(', ')}</li>}
                          {feat.benefits.skillProficiencies && <li>Skills: {feat.benefits.skillProficiencies.join(', ')}</li>}
                          {feat.benefits.savingThrowProficiencies && <li>Saving Throws: {feat.benefits.savingThrowProficiencies.join(', ')}</li>}
                      </ul>
                  </div>
              )}

              {!feat.isEligible && (
                <div className="text-xs text-red-400 mt-3">
                  <strong>Unavailable:</strong>
                  <ul className="list-disc list-inside">
                    {feat.unmet.map(reason => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {isSelected && (
                <div className="absolute top-2 right-2 text-amber-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex justify-between border-t border-gray-700 pt-4">
        {onBack && (
            <button
            onClick={onBack}
            className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
            Back
            </button>
        )}
        {/* Next button could be handled by parent based on selection */}
      </div>
    </div>
  );
};

export default FeatSelection;
