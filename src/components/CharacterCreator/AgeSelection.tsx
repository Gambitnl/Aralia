/**
 * @file AgeSelection.tsx
 * Allows players to select their character's age, with race-appropriate age ranges.
 *
 * TODO: Styling inconsistency audit (2025-12-11)
 * - Header uses `text-3xl font-bold text-gray-100` instead of standard `text-2xl text-sky-300`
 * - Primary button uses `bg-blue-600` instead of `bg-green-600` (confirm) or `bg-sky-700` (action)
 * - Info panels use `bg-blue-900 bg-opacity-30 border-blue-800` instead of standard gray tones
 * - Container wrapper uses `bg-gray-700 p-8 border` but other steps have no wrapper
 * - Consider aligning with RaceSelection.tsx/ClassSelection.tsx styling patterns
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Race } from '../../types';

interface AgeSelectionProps {
  selectedRace: Race | null;
  currentAge: number;
  onAgeChange: (age: number) => void;
  onNext: () => void;
  onBack: () => void;
}

// Age ranges and categories for different races
const getAgeData = (raceId: string) => {
  switch (raceId) {
    case 'human':
      return {
        min: 5, max: 90,
        categories: {
          child: { max: 12, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 17, statPenalty: -1 },
          adult: { max: 50, statPenalty: 0 },
          middleAged: { max: 70, statPenalty: -1 },
          elderly: { max: 90, statPenalty: -2 }
        }
      };
    case 'elf':
    case 'eladrin':
      return {
        min: 50, max: 800,
        categories: {
          child: { max: 80, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 99, statPenalty: -1 },
          adult: { max: 400, statPenalty: 0 },
          middleAged: { max: 600, statPenalty: -1 },
          elderly: { max: 800, statPenalty: -2 }
        }
      };
    case 'dwarf':
    case 'duergar':
      return {
        min: 25, max: 400,
        categories: {
          child: { max: 35, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 49, statPenalty: -1 },
          adult: { max: 200, statPenalty: 0 },
          middleAged: { max: 300, statPenalty: -1 },
          elderly: { max: 400, statPenalty: -2 }
        }
      };
    case 'halfling':
      return {
        min: 10, max: 160,
        categories: {
          child: { max: 15, sizeModifier: 'Tiny', statPenalty: -2 },
          adolescent: { max: 19, statPenalty: -1 },
          adult: { max: 80, statPenalty: 0 },
          middleAged: { max: 120, statPenalty: -1 },
          elderly: { max: 160, statPenalty: -2 }
        }
      };
    case 'gnome':
      return {
        min: 20, max: 550,
        categories: {
          child: { max: 30, sizeModifier: 'Tiny', statPenalty: -2 },
          adolescent: { max: 39, statPenalty: -1 },
          adult: { max: 275, statPenalty: 0 },
          middleAged: { max: 400, statPenalty: -1 },
          elderly: { max: 550, statPenalty: -2 }
        }
      };
    case 'dragonborn':
      return {
        min: 8, max: 90,
        categories: {
          child: { max: 12, sizeModifier: 'Medium', statPenalty: -2 }, // Dragonborn mature quickly
          adolescent: { max: 14, statPenalty: -1 },
          adult: { max: 45, statPenalty: 0 },
          middleAged: { max: 65, statPenalty: -1 },
          elderly: { max: 90, statPenalty: -2 }
        }
      };
    case 'orc':
      return {
        min: 6, max: 55,
        categories: {
          child: { max: 9, sizeModifier: 'Medium', statPenalty: -2 },
          adolescent: { max: 11, statPenalty: -1 },
          adult: { max: 30, statPenalty: 0 },
          middleAged: { max: 40, statPenalty: -1 },
          elderly: { max: 55, statPenalty: -2 }
        }
      };
    case 'tiefling':
    case 'aasimar':
      return {
        min: 5, max: 110,
        categories: {
          child: { max: 12, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 17, statPenalty: -1 },
          adult: { max: 55, statPenalty: 0 },
          middleAged: { max: 80, statPenalty: -1 },
          elderly: { max: 110, statPenalty: -2 }
        }
      };
    case 'air_genasi':
    case 'earth_genasi':
    case 'fire_genasi':
    case 'water_genasi':
      return {
        min: 5, max: 130,
        categories: {
          child: { max: 12, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 17, statPenalty: -1 },
          adult: { max: 65, statPenalty: 0 },
          middleAged: { max: 95, statPenalty: -1 },
          elderly: { max: 130, statPenalty: -2 }
        }
      };
    case 'goliath':
      return {
        min: 8, max: 90,
        categories: {
          child: { max: 12, sizeModifier: 'Medium', statPenalty: -2 },
          adolescent: { max: 14, statPenalty: -1 },
          adult: { max: 45, statPenalty: 0 },
          middleAged: { max: 65, statPenalty: -1 },
          elderly: { max: 90, statPenalty: -2 }
        }
      };
    case 'firbolg':
      return {
        min: 15, max: 550,
        categories: {
          child: { max: 25, sizeModifier: 'Medium', statPenalty: -2 },
          adolescent: { max: 29, statPenalty: -1 },
          adult: { max: 275, statPenalty: 0 },
          middleAged: { max: 400, statPenalty: -1 },
          elderly: { max: 550, statPenalty: -2 }
        }
      };
    case 'bugbear':
      return {
        min: 8, max: 90,
        categories: {
          child: { max: 12, sizeModifier: 'Medium', statPenalty: -2 },
          adolescent: { max: 15, statPenalty: -1 },
          adult: { max: 45, statPenalty: 0 },
          middleAged: { max: 65, statPenalty: -1 },
          elderly: { max: 90, statPenalty: -2 }
        }
      };
    case 'goblin':
      return {
        min: 4, max: 65,
        categories: {
          child: { max: 6, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 7, statPenalty: -1 },
          adult: { max: 35, statPenalty: 0 },
          middleAged: { max: 50, statPenalty: -1 },
          elderly: { max: 65, statPenalty: -2 }
        }
      };
    case 'githyanki':
    case 'githzerai':
      return {
        min: 5, max: 110,
        categories: {
          child: { max: 12, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 17, statPenalty: -1 },
          adult: { max: 55, statPenalty: 0 },
          middleAged: { max: 80, statPenalty: -1 },
          elderly: { max: 110, statPenalty: -2 }
        }
      };
    case 'aarakocra':
      return {
        min: 8, max: 35,
        categories: {
          child: { max: 12, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 14, statPenalty: -1 },
          adult: { max: 20, statPenalty: 0 },
          middleAged: { max: 25, statPenalty: -1 },
          elderly: { max: 35, statPenalty: -2 }
        }
      };
    case 'centaur':
      return {
        min: 5, max: 110,
        categories: {
          child: { max: 12, sizeModifier: 'Large', statPenalty: -2 }, // Centaurs are large even as children
          adolescent: { max: 17, statPenalty: -1 },
          adult: { max: 55, statPenalty: 0 },
          middleAged: { max: 80, statPenalty: -1 },
          elderly: { max: 110, statPenalty: -2 }
        }
      };
    case 'fairy':
      return {
        min: 5, max: 1100,
        categories: {
          child: { max: 50, sizeModifier: 'Tiny', statPenalty: -2 },
          adolescent: { max: 99, statPenalty: -1 },
          adult: { max: 550, statPenalty: 0 },
          middleAged: { max: 800, statPenalty: -1 },
          elderly: { max: 1100, statPenalty: -2 }
        }
      };
    case 'changeling':
      return {
        min: 8, max: 90,
        categories: {
          child: { max: 12, sizeModifier: 'Small', statPenalty: -2 },
          adolescent: { max: 14, statPenalty: -1 },
          adult: { max: 45, statPenalty: 0 },
          middleAged: { max: 65, statPenalty: -1 },
          elderly: { max: 90, statPenalty: -2 }
        }
      };
    default:
      return {
        min: 5, max: 110,
        categories: {
          child: { max: 12, statPenalty: -2 },
          adolescent: { max: 17, statPenalty: -1 },
          adult: { max: 55, statPenalty: 0 },
          middleAged: { max: 80, statPenalty: -1 },
          elderly: { max: 110, statPenalty: -2 }
        }
      };
  }
};

const getAgeCategory = (age: number, ageData: any) => {
  if (age <= ageData.categories.child.max) return { name: 'Child', ...ageData.categories.child };
  if (age <= ageData.categories.adolescent.max) return { name: 'Adolescent', ...ageData.categories.adolescent };
  if (age <= ageData.categories.adult.max) return { name: 'Adult', ...ageData.categories.adult };
  if (age <= ageData.categories.middleAged.max) return { name: 'Middle-aged', ...ageData.categories.middleAged };
  return { name: 'Elderly', ...ageData.categories.elderly };
};

const AgeSelection: React.FC<AgeSelectionProps> = ({
  selectedRace,
  currentAge,
  onAgeChange,
  onNext,
  onBack,
}) => {
  const [ageInput, setAgeInput] = useState(currentAge.toString());

  const ageData = selectedRace ? getAgeData(selectedRace.id) : getAgeData('human');
  const ageCategory = getAgeCategory(parseInt(ageInput) || currentAge, ageData);

  useEffect(() => {
    setAgeInput(currentAge.toString());
  }, [currentAge]);

  const handleAgeChange = (value: string) => {
    setAgeInput(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= ageData.min && numValue <= ageData.max) {
      onAgeChange(numValue);
    }
  };

  const handleSubmit = () => {
    const age = parseInt(ageInput);
    if (age >= ageData.min && age <= ageData.max) {
      onNext();
    }
  };

  const isValidAge = parseInt(ageInput) >= ageData.min && parseInt(ageInput) <= ageData.max;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="max-w-2xl mx-auto p-6"
    >
      <div className="bg-gray-700 rounded-lg shadow-lg p-8 border border-gray-600">
        <h2 className="text-3xl font-bold text-gray-100 mb-6 text-center">
          Age Selection
        </h2>

        <div className="mb-6">
          <p className="text-gray-300 text-center mb-4">
            Choose your {selectedRace?.name}'s age. Age affects ability scores, size, hit points, and armor class.
          </p>

          <div className="bg-blue-900 bg-opacity-30 p-4 rounded-lg mb-6 border border-blue-800 border-opacity-50">
            <h3 className="font-semibold text-blue-300 mb-2">Age Range for {selectedRace?.name}s</h3>
            <p className="text-blue-200 mb-2">
              Total lifespan: {ageData.min}-{ageData.max} years
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-blue-100">
              <div><strong>Child:</strong> {ageData.min}-{ageData.categories.child.max}y</div>
              <div><strong>Adolescent:</strong> {ageData.categories.child.max + 1}-{ageData.categories.adolescent.max}y</div>
              <div><strong>Adult:</strong> {ageData.categories.adolescent.max + 1}-{ageData.categories.adult.max}y</div>
              <div><strong>Middle-aged:</strong> {ageData.categories.adult.max + 1}-{ageData.categories.middleAged.max}y</div>
              <div><strong>Elderly:</strong> {ageData.categories.middleAged.max + 1}-{ageData.max}y</div>
            </div>
          </div>

          {ageCategory && (
            <div className={`p-4 rounded-lg mb-6 border ${
              ageCategory.statPenalty === 0
                ? 'bg-green-900 bg-opacity-30 border-green-800'
                : 'bg-orange-900 bg-opacity-30 border-orange-800'
            }`}>
              <h3 className="font-semibold text-gray-200 mb-2">
                Current Age Category: <span className={`font-bold ${
                  ageCategory.statPenalty === 0 ? 'text-green-400' : 'text-orange-400'
                }`}>
                  {ageCategory.name}
                </span>
              </h3>
              <div className="text-sm text-gray-300 space-y-1">
                {ageCategory.sizeModifier && (
                  <p><strong>Size:</strong> {ageCategory.sizeModifier} (normally {selectedRace?.traits.find(t => t.includes('Size:'))?.split(':')[1]?.trim() || 'Medium'})</p>
                )}
                <p><strong>Ability Scores:</strong> {ageCategory.statPenalty >= 0 ? '+' : ''}{ageCategory.statPenalty} to all (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma)</p>
                <p><strong>Hit Points:</strong> Recalculated based on modified Constitution</p>
                <p><strong>Armor Class:</strong> Recalculated if Dexterity is modified</p>
                <div className="mt-2 p-2 bg-black bg-opacity-30 rounded text-xs text-gray-300">
                  {ageCategory.statPenalty === 0
                    ? "✅ Adult characters have full ability scores and are at peak physical/mental condition."
                    : ageCategory.statPenalty === -1
                    ? "⚠️ This age applies -1 to all ability scores, representing reduced physical/mental capabilities."
                    : "⚠️ This age applies -2 to all ability scores, representing significantly reduced capabilities."
                  }
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center space-y-4">
            <label htmlFor="age" className="text-lg font-medium text-gray-300">
              Character Age (years):
            </label>

            <input
              id="age"
              type="number"
              value={ageInput}
              onChange={(e) => handleAgeChange(e.target.value)}
              min={ageData.min}
              max={ageData.max}
              className="w-32 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-center text-lg font-semibold text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
            />

            {!isValidAge && ageInput && (
              <p className="text-red-400 text-sm">
                Age must be between {ageData.min} and {ageData.max} years
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
          >
            Back
          </button>

          <button
            onClick={handleSubmit}
            disabled={!isValidAge}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default AgeSelection;
