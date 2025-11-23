
/**
 * @file RacialSpellAbilitySelection.tsx
 * A reusable component for any race that needs to select a spellcasting ability
 * (Intelligence, Wisdom, or Charisma) for one of its racial traits.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AbilityScoreName, AbilityScores, Class as CharClass } from '../../../types';
import { RELEVANT_SPELLCASTING_ABILITIES } from '../../../constants';
import { getAbilityModifierString } from '../../../utils/characterUtils';

export interface RacialSpellAbilitySelectionProps {
  // The name of the race for display purposes (e.g., "Aarakocra")
  raceName: string;
  // The name of the racial trait that grants the spellcasting choice (e.g., "Wind Caller")
  traitName: string;
  // A description of the trait and the choice the player is making.
  traitDescription: string;
  // Callback to the parent component (CharacterCreator) to confirm the selection.
  onAbilitySelect: (ability: AbilityScoreName) => void;
  // Callback to navigate back to the previous step in character creation.
  onBack: () => void;
  // The character's final ability scores to provide context.
  abilityScores: AbilityScores;
  // The character's selected class to provide a recommendation.
  selectedClass: CharClass | null;
}

const RacialSpellAbilitySelection: React.FC<RacialSpellAbilitySelectionProps> = ({
  raceName,
  traitName,
  traitDescription,
  onAbilitySelect,
  onBack,
  abilityScores,
  selectedClass
}) => {
  const [selectedAbility, setSelectedAbility] = useState<AbilityScoreName | null>(null);

  const handleSubmit = () => {
    if (selectedAbility) {
      onAbilitySelect(selectedAbility);
    }
  };

  return (
    <motion.div
      key="racialSpellAbility"
      {...{
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.3 },
      } as any}
    >
      <h2 className="text-2xl text-sky-300 mb-4 text-center">{raceName} Trait: {traitName}</h2>
      <p className="text-sm text-gray-400 mb-6 text-center">
        {traitDescription}
      </p>
      
      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-3">Select Spellcasting Ability:</h3>
        <div className="flex flex-wrap justify-center gap-3">
          {RELEVANT_SPELLCASTING_ABILITIES.map((ability) => {
            const score = abilityScores[ability];
            const modifier = getAbilityModifierString(score);
            const isRecommended = selectedClass?.spellcasting?.ability === ability;

            return (
              <button
                key={ability}
                onClick={() => setSelectedAbility(ability)}
                className={`px-4 py-2 rounded-lg transition-colors border-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-opacity-75 min-w-[140px] relative text-center ${
                  selectedAbility === ability
                    ? 'bg-sky-700 border-sky-500 ring-sky-500 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-sky-600 text-gray-300 ring-transparent'
                }`}
                aria-pressed={selectedAbility === ability}
                aria-label={`Select ${ability} as spellcasting ability`}
              >
                <span className="text-lg font-semibold">{ability}</span>
                <span className="block text-xs text-gray-400">({score} / {modifier})</span>
                 {isRecommended && (
                  <span className="absolute -top-2 -right-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full shadow">
                    Recommended
                  </span>
                )}
              </button>
            );
          })}
        </div>
         {selectedAbility && <p className="text-sm text-gray-400 mt-4 text-center">Selected: {selectedAbility}</p>}
      </div>
      
      <div className="flex gap-4 mt-8">
        <button
          onClick={onBack}
          className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
          aria-label="Go back to ability scores"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedAbility}
          className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
          aria-label="Confirm spellcasting ability"
        >
          Confirm Ability
        </button>
      </div>
    </motion.div>
  );
};

export default RacialSpellAbilitySelection;
