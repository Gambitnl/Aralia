/**
 * @file BackgroundSelection.tsx
 * Allows players to select their character's background, with age-appropriate options.
 */
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Race } from '../../types';
import { BACKGROUNDS, AGE_APPROPRIATE_BACKGROUNDS } from '../../data/backgrounds';
import { SelectionCard } from '../ui/SelectionCard';
import { BTN_PRIMARY, BTN_SECONDARY } from '../../styles/buttonStyles';

interface BackgroundSelectionProps {
  selectedRace: Race | null;
  characterAge: number;
  currentBackground: string | null;
  onBackgroundChange: (backgroundId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

// Get age category for background filtering
const getAgeCategoryForBackgrounds = (age: number, raceId: string) => {
  // Get age data (similar logic to AgeSelection component)
  const ageData = getAgeDataForBackgroundFiltering(raceId);
  const categories = ageData.categories;

  if (age <= categories.child.max) return 'child';
  if (age <= categories.adolescent.max) return 'young';
  if (age <= categories.adult.max) return 'adult';
  return 'adult'; // Default to adult for elderly
};

const getAgeDataForBackgroundFiltering = (raceId: string) => {
  switch (raceId) {
    case 'human':
      return {
        categories: {
          child: { max: 12 },
          adolescent: { max: 17 },
          adult: { max: 50 },
          middleAged: { max: 70 },
          elderly: { max: 90 }
        }
      };
    case 'elf':
    case 'eladrin':
      return {
        categories: {
          child: { max: 80 },
          adolescent: { max: 99 },
          adult: { max: 400 },
          middleAged: { max: 600 },
          elderly: { max: 800 }
        }
      };
    // Add other races as needed, for now default to human ranges
    default:
      return {
        categories: {
          child: { max: 12 },
          adolescent: { max: 17 },
          adult: { max: 50 },
          middleAged: { max: 70 },
          elderly: { max: 90 }
        }
      };
  }
};

const BackgroundSelection: React.FC<BackgroundSelectionProps> = ({
  selectedRace,
  characterAge,
  currentBackground,
  onBackgroundChange,
  onNext,
  onBack,
}) => {
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string | null>(currentBackground);

  const ageCategory = selectedRace ? getAgeCategoryForBackgrounds(characterAge, selectedRace.id) : 'adult';

  const availableBackgrounds = useMemo(() => {
    const appropriateIds = AGE_APPROPRIATE_BACKGROUNDS[ageCategory as keyof typeof AGE_APPROPRIATE_BACKGROUNDS] || [];
    return appropriateIds.map(id => BACKGROUNDS[id]).filter(Boolean);
  }, [ageCategory]);

  const selectedBackground = selectedBackgroundId ? BACKGROUNDS[selectedBackgroundId] : null;

  const handleBackgroundSelect = (backgroundId: string) => {
    setSelectedBackgroundId(backgroundId);
    onBackgroundChange(backgroundId);
  };

  const handleSubmit = () => {
    if (selectedBackgroundId) {
      onNext();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="max-w-4xl mx-auto p-6"
    >
      <div className="bg-gray-700 rounded-lg shadow-lg p-8 border border-gray-600">
        <h2 className="text-2xl text-sky-300 mb-6 text-center">
          Background Selection
        </h2>

        <div className="mb-6">
          <p className="text-gray-300 text-center mb-4">
            Choose your {selectedRace?.name}'s background. This determines your skills, equipment, and life experience.
          </p>

          <div className="bg-blue-900 bg-opacity-30 p-4 rounded-lg mb-6 border border-blue-800 border-opacity-50">
            <h3 className="font-semibold text-blue-300 mb-2">
              Age Category: <span className="capitalize">{ageCategory}</span>
            </h3>
            <p className="text-blue-200 text-sm">
              Showing backgrounds appropriate for {ageCategory} characters ({characterAge} years old).
            </p>
          </div>

          {/* Background Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {availableBackgrounds.map((background) => (
              <SelectionCard
                key={background.id}
                title={background.name}
                selected={selectedBackgroundId === background.id}
                onClick={() => handleBackgroundSelect(background.id)}
              >
                <p className="mb-3">{background.description}</p>
                <div className="text-xs text-gray-400 space-y-1">
                  <div><strong>Skills:</strong> {background.skillProficiencies.join(', ')}</div>
                  {background.toolProficiencies && (
                    <div><strong>Tools:</strong> {background.toolProficiencies.join(', ')}</div>
                  )}
                  {background.languages && (
                    <div><strong>Languages:</strong> {background.languages.join(', ')}</div>
                  )}
                  <div><strong>Feature:</strong> {background.feature.name}</div>
                </div>
              </SelectionCard>
            ))}
          </div>

          {/* Selected Background Details */}
          {selectedBackground && (
            <div className="bg-green-900 bg-opacity-30 border border-green-800 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-green-300 mb-4">
                {selectedBackground.name}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 text-gray-200">Background Feature</h4>
                  <p className="text-sm mb-4 text-gray-300">{selectedBackground.feature.description}</p>

                  <h4 className="font-semibold mb-2 text-gray-200">Proficiencies</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li><strong>Skills:</strong> {selectedBackground.skillProficiencies.join(', ')}</li>
                    {selectedBackground.toolProficiencies && (
                      <li><strong>Tools:</strong> {selectedBackground.toolProficiencies.join(', ')}</li>
                    )}
                    {selectedBackground.languages && (
                      <li><strong>Languages:</strong> {selectedBackground.languages.join(', ')}</li>
                    )}
                  </ul>

                  <h4 className="font-semibold mb-2 mt-4 text-gray-200">Starting Equipment</h4>
                  <p className="text-sm text-gray-300">{selectedBackground.equipment.join(', ')}</p>
                </div>

                {selectedBackground.suggestedCharacteristics && (
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-200">Suggested Characteristics</h4>
                    <div className="text-sm text-gray-300 space-y-2">
                      <div>
                        <strong>Personality Traits:</strong>
                        <ul className="ml-4 mt-1 space-y-1">
                          {selectedBackground.suggestedCharacteristics.personalityTraits.slice(0, 2).map((trait, idx) => (
                            <li key={idx}>• {trait}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <strong>Ideals:</strong>
                        <ul className="ml-4 mt-1 space-y-1">
                          {selectedBackground.suggestedCharacteristics.ideals.slice(0, 2).map((ideal, idx) => (
                            <li key={idx}>• {ideal}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <button
            onClick={onBack}
            className={`${BTN_SECONDARY} px-6 py-3 rounded-lg`}
          >
            Back
          </button>

          <button
            onClick={handleSubmit}
            disabled={!selectedBackgroundId}
            className={`${BTN_PRIMARY} px-6 py-3 rounded-lg`}
          >
            Next
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default BackgroundSelection;
