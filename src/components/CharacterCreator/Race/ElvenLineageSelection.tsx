/**
 * @file ElvenLineageSelection.tsx
 * This component is part of the character creation process for Elf characters.
 * It allows the player to choose their Elven Lineage (Drow, High Elf, or Wood Elf)
 * and the spellcasting ability for spells granted by that lineage.
 */
import React, { useState } from 'react';
import { ElvenLineage, ElvenLineageType, AbilityScoreName } from '../../../types'; // Path relative to src/components/CharacterCreator/Elf/
import { RELEVANT_SPELLCASTING_ABILITIES } from '../../../constants'; // Path relative to src/components/CharacterCreator/Elf/

interface ElvenLineageSelectionProps {
  lineages: ElvenLineage[];
  onLineageSelect: (
    lineageId: ElvenLineageType,
    spellcastingAbility: AbilityScoreName,
  ) => void;
  onBack: () => void; // Function to go back to Race selection
}

/**
 * ElvenLineageSelection component.
 * Displays a list of Elven Lineages and spellcasting ability choices.
 * @param {ElvenLineageSelectionProps} props - Props for the component.
 * @returns {React.FC} The rendered ElvenLineageSelection component.
 */
const ElvenLineageSelection: React.FC<ElvenLineageSelectionProps> = ({
  lineages,
  onLineageSelect,
  onBack,
}) => {
  const [selectedLineageId, setSelectedLineageId] =
    useState<ElvenLineageType | null>(null);
  const [selectedSpellcastingAbility, setSelectedSpellcastingAbility] =
    useState<AbilityScoreName | null>(null);

  const selectedLineageDetails = selectedLineageId
    ? lineages.find((l) => l.id === selectedLineageId)
    : null;

  const handleSubmit = () => {
    if (selectedLineageId && selectedSpellcastingAbility) {
      onLineageSelect(selectedLineageId, selectedSpellcastingAbility);
    }
  };

  return (
    <div>
      <h2 className="text-2xl text-sky-300 mb-6 text-center">
        Choose Your Elven Lineage
      </h2>

      {/* Lineage Selection */}
      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-3">Select Lineage:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {lineages.map((lineage) => (
            <button
              key={lineage.id}
              onClick={() => setSelectedLineageId(lineage.id)}
              className={`w-full text-left p-4 rounded-lg transition-colors border-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-opacity-75 ${
                selectedLineageId === lineage.id
                  ? 'bg-sky-700 border-sky-500 ring-sky-500'
                  : 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-sky-600 ring-transparent'
              }`}
              aria-pressed={selectedLineageId === lineage.id}
              aria-label={`Select ${lineage.name} lineage`}
            >
              <h4 className="font-semibold text-amber-400 text-lg">
                {lineage.name}
              </h4>
              <p className="text-sm text-gray-300 mt-1">
                {lineage.description}
              </p>
              {lineage.benefits
                .filter((b) => b.level === 1)
                .map((benefit) => (
                  <p
                    key={`${lineage.id}-${
                      benefit.description ||
                      benefit.cantripId ||
                      benefit.speedIncrease
                    }`}
                    className="text-xs text-sky-200 mt-1"
                  >
                    {benefit.description}
                    {benefit.cantripId &&
                      ` (Cantrip: ${benefit.cantripId
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (l) => l.toUpperCase())})`}
                  </p>
                ))}
            </button>
          ))}
        </div>
      </div>

      {/* Spellcasting Ability Selection */}
      {selectedLineageId && (
        <div className="mb-6">
          <h3 className="text-xl text-amber-300 mb-3">
            Select Spellcasting Ability for Lineage Spells:
          </h3>
          <div className="flex flex-wrap gap-2">
            {RELEVANT_SPELLCASTING_ABILITIES.map((ability) => (
              <button
                key={ability}
                onClick={() => setSelectedSpellcastingAbility(ability)}
                className={`px-4 py-2 rounded-md transition-colors border ${
                  selectedSpellcastingAbility === ability
                    ? 'bg-green-600 border-green-500 text-white'
                    : 'bg-gray-600 hover:bg-gray-500 border-gray-500 text-gray-300'
                }`}
                aria-pressed={selectedSpellcastingAbility === ability}
                aria-label={`Select ${ability} as spellcasting ability`}
              >
                {ability}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Display selected lineage benefits for level 1 */}
      {selectedLineageDetails && (
        <div className="my-4 p-3 bg-gray-700/50 rounded-md border border-gray-600">
          <h4 className="text-md font-semibold text-sky-200 mb-1">
            Level 1 Benefits for {selectedLineageDetails.name}:
          </h4>
          <ul className="list-disc list-inside text-sm text-gray-300">
            {selectedLineageDetails.benefits
              .filter((b) => b.level === 1)
              .map((benefit) => {
                let text = benefit.description || '';
                if (benefit.cantripId)
                  text += ` You learn the ${benefit.cantripId
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (l) => l.toUpperCase())} cantrip.`;
                if (benefit.speedIncrease)
                  text += ` Your speed increases by ${benefit.speedIncrease}ft.`;
                if (benefit.darkvisionRange)
                  text = `Your Darkvision range becomes ${benefit.darkvisionRange}ft.`;
                return (
                  <li
                    key={`${selectedLineageDetails.id}-${benefit.level}-${
                      benefit.cantripId || benefit.description
                    }`}
                  >
                    {text}
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      <div className="flex gap-4 mt-8">
        <button
          onClick={onBack}
          className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
          aria-label="Go back to race selection"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedLineageId || !selectedSpellcastingAbility}
          className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
          aria-label="Confirm selected elven lineage and ability"
        >
          Confirm Lineage
        </button>
      </div>
    </div>
  );
};

export default ElvenLineageSelection;