/**
 * @file DragonbornAncestrySelection.tsx
 * This component is part of the character creation process, specifically for Dragonborn characters.
 * It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),
 * which determines their damage resistance and breath weapon type.
 */
import React, { useState } from 'react';
import { DraconicAncestryInfo, DraconicAncestorType } from '../../../types'; // Path relative to src/components/CharacterCreator/Dragonborn/
import { DRAGONBORN_ANCESTRIES } from '../../../constants'; // Path relative to src/components/CharacterCreator/Dragonborn/

interface DragonbornAncestrySelectionProps {
  onAncestrySelect: (ancestryType: DraconicAncestorType) => void;
  onBack: () => void; // Function to go back to Race selection
}

/**
 * DragonbornAncestrySelection component.
 * Displays a list of Draconic Ancestries for the player to choose from.
 * @param {DragonbornAncestrySelectionProps} props - Props for the component.
 * @returns {React.FC} The rendered DragonbornAncestrySelection component.
 */
const DragonbornAncestrySelection: React.FC<
  DragonbornAncestrySelectionProps
> = ({ onAncestrySelect, onBack }) => {
  const [selectedAncestorType, setSelectedAncestorType] =
    useState<DraconicAncestorType | null>(null);

  /**
   * Handles the submission of the selected ancestry.
   * Calls the onAncestrySelect callback with the chosen ancestry data.
   */
  const handleSubmit = () => {
    if (selectedAncestorType) {
      onAncestrySelect(selectedAncestorType);
    }
  };

  const ancestorOptions = Object.values(DRAGONBORN_ANCESTRIES);

  return (
    <div>
      <h2 className="text-2xl text-sky-300 mb-6 text-center">
        Choose Your Draconic Ancestry
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {ancestorOptions.map((ancestry) => (
          <button
            key={ancestry.type}
            onClick={() => setSelectedAncestorType(ancestry.type)}
            className={`w-full text-left p-4 rounded-lg transition-colors border-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-opacity-75 ${
              selectedAncestorType === ancestry.type
                ? 'bg-sky-700 border-sky-500 ring-sky-500' // Selected state
                : 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-sky-600 ring-transparent' // Default state
            }`}
            aria-pressed={selectedAncestorType === ancestry.type}
            aria-label={`Select ${ancestry.type} dragon ancestry`}
          >
            <h3 className="font-semibold text-amber-400 text-lg">
              {ancestry.type} Dragon
            </h3>
            <p className="text-sm text-gray-300">
              Resistance: {ancestry.damageType}
            </p>
            <p className="text-sm text-gray-300">
              Breath Weapon: {ancestry.damageType}
            </p>
          </button>
        ))}
      </div>
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
          disabled={!selectedAncestorType}
          className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
          aria-label="Confirm selected draconic ancestry"
        >
          Confirm Ancestry
        </button>
      </div>
    </div>
  );
};

export default DragonbornAncestrySelection;
