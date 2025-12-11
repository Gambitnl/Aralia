/**
 * @file ClassSelection.tsx
 * This component allows the player to select a class for their character
 * from a list of available D&D classes (e.g., Fighter, Wizard, Cleric).
 */
import React from 'react';
import { Class as CharClass } from '../../types'; // Aliasing 'Class' to 'CharClass' to avoid keyword conflict

interface ClassSelectionProps {
  classes: CharClass[];
  onClassSelect: (classId: string) => void;
  onBack: () => void; // Function to go back to the previous step (Race Selection)
}

/**
 * ClassSelection component.
 * Displays a grid of selectable class cards and a back button.
 * @param {ClassSelectionProps} props - Props for the component.
 * @returns {React.FC} The rendered ClassSelection component.
 */
const ClassSelection: React.FC<ClassSelectionProps> = ({
  classes,
  onClassSelect,
  onBack,
}) => {
  const sortedClasses = [...classes].sort((a, b) => a.name.localeCompare(b.name));
  
  return (
    <div>
      <h2 className="text-2xl text-sky-300 mb-6 text-center">
        Choose Your Class
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 mb-6">
        {sortedClasses.map((charClass) => (
          <button
            key={charClass.id}
            onClick={() => onClassSelect(charClass.id)}
            className="bg-gray-700 hover:bg-sky-700 text-left p-4 rounded-lg shadow transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label={`Select ${charClass.name}`}
          >
            <h3 className="text-xl font-semibold text-amber-400 mb-2">
              {charClass.name}
            </h3>
            <p className="text-sm text-gray-400 mb-1">
              Hit Die: d{charClass.hitDie}
            </p>
            <p className="text-sm text-gray-400 mb-2">
              Primary Abilities: {charClass.primaryAbility.join(', ')}
            </p>
            <p className="text-xs text-gray-500" style={{ minHeight: '3em' }}>
              {charClass.description}
            </p>{' '}
            {/* Ensure consistent height */}
          </button>
        ))}
      </div>
      <button
        onClick={onBack}
        className="w-full mt-4 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors"
        aria-label="Go back to race selection"
      >
        Back
      </button>
    </div>
  );
};

export default ClassSelection;