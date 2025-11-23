/**
 * @file GiantAncestrySelection.tsx
 * This component is part of the character creation process for Goliath characters.
 * It allows the player to choose their Giant Ancestry benefit.
 */
import React, { useState } from 'react';
import { GiantAncestryBenefit, GiantAncestryType } from '../../../types'; // Path relative to src/components/CharacterCreator/Goliath/
import { GIANT_ANCESTRIES as GIANT_ANCESTRIES_DATA } from '../../../constants'; // Path relative to src/components/CharacterCreator/Goliath/

interface GiantAncestrySelectionProps {
  onAncestrySelect: (ancestryBenefitId: GiantAncestryType) => void;
  onBack: () => void; // Function to go back to Race selection
}

/**
 * GiantAncestrySelection component.
 * Displays a list of Giant Ancestry benefits for the player to choose from.
 */
const GiantAncestrySelection: React.FC<GiantAncestrySelectionProps> = ({ onAncestrySelect, onBack }) => {
  const [selectedBenefitId, setSelectedBenefitId] = useState<GiantAncestryType | null>(null);

  const handleSubmit = () => {
    if (selectedBenefitId) {
      onAncestrySelect(selectedBenefitId);
    }
  };

  const benefitOptions: GiantAncestryBenefit[] = GIANT_ANCESTRIES_DATA;

  return (
    <div>
      <h2 className="text-2xl text-sky-300 mb-6 text-center">
        Choose Your Giant Ancestry Benefit
      </h2>
      <div className="space-y-3 mb-6 max-h-96 overflow-y-auto scrollable-content pr-2">
        {benefitOptions.map((benefit) => (
          <button
            key={benefit.id}
            onClick={() => setSelectedBenefitId(benefit.id)}
            className={`w-full text-left p-4 rounded-lg transition-colors border-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-opacity-75 ${
              selectedBenefitId === benefit.id
                ? 'bg-sky-700 border-sky-500 ring-sky-500' // Selected state
                : 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-sky-600 ring-transparent' // Default state
            }`}
            aria-pressed={selectedBenefitId === benefit.id}
            aria-label={`Select ${benefit.name}`}
          >
            <h3 className="font-semibold text-amber-400 text-lg">
              {benefit.name}
            </h3>
            <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">
              {benefit.description}
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
          Back to Race
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedBenefitId}
          className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
          aria-label="Confirm selected giant ancestry benefit"
        >
          Confirm Ancestry
        </button>
      </div>
    </div>
  );
};

export default GiantAncestrySelection;