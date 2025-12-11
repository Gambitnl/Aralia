/**
 * @file DragonbornAncestrySelection.tsx
 * This component is part of the character creation process, specifically for Dragonborn characters.
 * It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),
 * which determines their damage resistance and breath weapon type.
 */
import React, { useState } from 'react';
import { DraconicAncestorType } from '../../../types';
import { DRAGONBORN_ANCESTRIES } from '../../../constants';

interface DragonbornAncestrySelectionProps {
  onAncestrySelect: (ancestryType: DraconicAncestorType) => void;
  onBack: () => void;
}

// Dragon type metadata for visual distinction
const DRAGON_INFO: Record<DraconicAncestorType, {
  alignment: 'Chromatic' | 'Metallic';
  color: string; // Tailwind border/accent color
  description: string;
}> = {
  // Chromatic (evil) dragons
  Black: { alignment: 'Chromatic', color: 'emerald', description: 'Cruel and sadistic, lurking in swamps' },
  Blue: { alignment: 'Chromatic', color: 'blue', description: 'Vain and territorial, dwelling in deserts' },
  Green: { alignment: 'Chromatic', color: 'lime', description: 'Cunning and deceptive, forest dwellers' },
  Red: { alignment: 'Chromatic', color: 'red', description: 'Greedy and arrogant, the most feared' },
  White: { alignment: 'Chromatic', color: 'slate', description: 'Savage and bestial, arctic hunters' },
  // Metallic (good) dragons
  Brass: { alignment: 'Metallic', color: 'yellow', description: 'Talkative and social, desert dwellers' },
  Bronze: { alignment: 'Metallic', color: 'orange', description: 'Honorable warriors, coastal guardians' },
  Copper: { alignment: 'Metallic', color: 'amber', description: 'Playful pranksters, mountain dwellers' },
  Gold: { alignment: 'Metallic', color: 'yellow', description: 'Wise and just, the most revered' },
  Silver: { alignment: 'Metallic', color: 'gray', description: 'Kind and helpful, often in humanoid form' },
};

// Damage type icons/colors for visual clarity
const DAMAGE_COLORS: Record<string, string> = {
  Fire: 'text-orange-400',
  Cold: 'text-cyan-400',
  Lightning: 'text-yellow-300',
  Acid: 'text-lime-400',
  Poison: 'text-green-400',
};

const DragonbornAncestrySelection: React.FC<DragonbornAncestrySelectionProps> = ({
  onAncestrySelect,
  onBack
}) => {
  const [selectedAncestorType, setSelectedAncestorType] = useState<DraconicAncestorType | null>(null);

  const handleSubmit = () => {
    if (selectedAncestorType) {
      onAncestrySelect(selectedAncestorType);
    }
  };

  const ancestorOptions = Object.values(DRAGONBORN_ANCESTRIES);

  // Group by alignment
  const chromatic = ancestorOptions.filter(a => DRAGON_INFO[a.type].alignment === 'Chromatic');
  const metallic = ancestorOptions.filter(a => DRAGON_INFO[a.type].alignment === 'Metallic');

  const renderAncestryCard = (ancestry: typeof ancestorOptions[0]) => {
    const info = DRAGON_INFO[ancestry.type];
    const isSelected = selectedAncestorType === ancestry.type;
    const damageColor = DAMAGE_COLORS[ancestry.damageType] || 'text-gray-300';

    return (
      <button
        type="button"
        key={ancestry.type}
        onClick={() => setSelectedAncestorType(ancestry.type)}
        className={`w-full text-left p-4 rounded-lg transition-all border-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-opacity-75 ${
          isSelected
            ? 'bg-sky-700 border-sky-400 ring-sky-500 scale-[1.02]'
            : 'bg-gray-700 hover:bg-gray-650 border-gray-600 hover:border-gray-500 ring-transparent'
        }`}
        aria-pressed={isSelected ? 'true' : 'false'}
        aria-label={`Select ${ancestry.type} dragon ancestry - ${ancestry.damageType} damage`}
      >
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-amber-400 text-lg">
            {ancestry.type}
          </h3>
          <span className={`text-xs px-2 py-0.5 rounded ${damageColor} bg-gray-800/50`}>
            {ancestry.damageType}
          </span>
        </div>
        <p className="text-xs text-gray-400 mb-2 italic">
          {info.description}
        </p>
        <div className="text-sm text-gray-300 space-y-0.5">
          <p><span className="text-gray-500">Resistance:</span> <span className={damageColor}>{ancestry.damageType}</span></p>
          <p><span className="text-gray-500">Breath:</span> <span className={damageColor}>{ancestry.damageType}</span></p>
        </div>
      </button>
    );
  };

  return (
    <div>
      <h2 className="text-2xl text-sky-300 mb-2 text-center">
        Choose Your Draconic Ancestry
      </h2>
      <p className="text-gray-400 text-sm text-center mb-6">
        Your ancestry determines your damage resistance and breath weapon type
      </p>

      {/* Chromatic Dragons */}
      <div className="mb-6">
        <h3 className="text-lg text-red-400 mb-3 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          Chromatic Dragons
          <span className="text-xs text-gray-500 font-normal">(traditionally evil)</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {chromatic.map(renderAncestryCard)}
        </div>
      </div>

      {/* Metallic Dragons */}
      <div className="mb-6">
        <h3 className="text-lg text-yellow-400 mb-3 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          Metallic Dragons
          <span className="text-xs text-gray-500 font-normal">(traditionally good)</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {metallic.map(renderAncestryCard)}
        </div>
      </div>

      <div className="flex gap-4 mt-8">
        <button
          type="button"
          onClick={onBack}
          className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
          aria-label="Go back to race selection"
        >
          Back
        </button>
        <button
          type="button"
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
