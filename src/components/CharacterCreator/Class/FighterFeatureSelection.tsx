/**
 * @file FighterFeatureSelection.tsx
 * This component allows a player who has chosen the Fighter class to select
 * a Fighting Style from the available options.
 */
import React, { useState } from 'react';
import { FightingStyle } from '../../../types'; // Path relative to src/components/CharacterCreator/Class/

interface FighterFeatureSelectionProps {
  styles: FightingStyle[]; // Array of available fighting styles
  onStyleSelect: (style: FightingStyle) => void;
  onBack: () => void; // Function to go back to Skill Selection
}

/**
 * FighterFeatureSelection component.
 * Displays a list of fighting styles for the Fighter class to choose from.
 * @param {FighterFeatureSelectionProps} props - Props for the component.
 * @returns {React.FC} The rendered FighterFeatureSelection component.
 */
const FighterFeatureSelection: React.FC<FighterFeatureSelectionProps> = ({
  styles,
  onStyleSelect,
  onBack,
}) => {
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);

  /**
   * Handles the selection of a fighting style.
   * @param {string} styleId - The ID of the selected fighting style.
   */
  const handleSelect = (styleId: string) => {
    setSelectedStyleId(styleId);
  };

  /**
   * Confirms the selected fighting style and calls the onStyleSelect callback.
   */
  const handleSubmit = () => {
    if (selectedStyleId) {
      const style = styles.find((s) => s.id === selectedStyleId);
      if (style) {
        onStyleSelect(style);
      }
    }
  };

  return (
    <div>
      <h2 className="text-2xl text-sky-300 mb-4 text-center">
        Choose Fighting Style
      </h2>
      <div className="space-y-3 mb-6">
        {styles.map((style) => (
          <button
            key={style.id}
            onClick={() => handleSelect(style.id)}
            className={`w-full text-left p-3 rounded-lg transition-colors border-2 ${
              selectedStyleId === style.id
                ? 'bg-sky-700 border-sky-500 ring-2 ring-sky-400' // Enhanced selected state
                : 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-sky-600'
            }`}
            aria-pressed={selectedStyleId === style.id}
            aria-label={`Select fighting style: ${style.name}`}
          >
            <h3 className="font-semibold text-amber-400">{style.name}</h3>
            <p className="text-sm text-gray-300">{style.description}</p>
          </button>
        ))}
      </div>
      <div className="flex gap-4 mt-6">
        <button
          onClick={onBack}
          className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors"
          aria-label="Go back to skill selection"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedStyleId}
          className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors"
          aria-label="Confirm selected fighting style"
        >
          Confirm Style
        </button>
      </div>
    </div>
  );
};

export default FighterFeatureSelection;