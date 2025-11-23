/**
 * @file TieflingLegacySelection.tsx
 * This component is part of the character creation process for Tiefling characters.
 * It allows the player to choose their Fiendish Legacy (Abyssal, Chthonic, or Infernal)
 * and the spellcasting ability for spells granted by that legacy and Otherworldly Presence.
 */
import React, { useState, useContext } from 'react';
import { FiendishLegacy, FiendishLegacyType, AbilityScoreName } from '../../../types';
import { RELEVANT_SPELLCASTING_ABILITIES, TIEFLING_LEGACIES } from '../../../constants';
import SpellContext from '../../../context/SpellContext';

interface TieflingLegacySelectionProps {
  onLegacySelect: (legacyId: FiendishLegacyType, spellcastingAbility: AbilityScoreName) => void;
  onBack: () => void;
}

const TieflingLegacySelection: React.FC<TieflingLegacySelectionProps> = ({ onLegacySelect, onBack }) => {
  const [selectedLegacyId, setSelectedLegacyId] = useState<FiendishLegacyType | null>(null);
  const [selectedSpellcastingAbility, setSelectedSpellcastingAbility] = useState<AbilityScoreName | null>(null);
  const allSpells = useContext(SpellContext);

  const legacyOptions: FiendishLegacy[] = TIEFLING_LEGACIES;

  const handleSubmit = () => {
    if (selectedLegacyId && selectedSpellcastingAbility) {
      onLegacySelect(selectedLegacyId, selectedSpellcastingAbility);
    }
  };
  
  if (!allSpells) {
    return <div>Loading spells...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl text-sky-300 mb-6 text-center">Choose Your Fiendish Legacy</h2>
      
      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-3">Select Legacy:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {legacyOptions.map((legacy) => (
            <button
              key={legacy.id}
              onClick={() => {
                setSelectedLegacyId(legacy.id);
                // Pre-select Intelligence as a sensible default when a legacy is chosen, or clear to force choice
                setSelectedSpellcastingAbility('Intelligence'); 
              }}
              className={`w-full text-left p-4 rounded-lg transition-colors border-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-opacity-75 ${
                selectedLegacyId === legacy.id
                  ? 'bg-sky-700 border-sky-500 ring-sky-500'
                  : 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-sky-600 ring-transparent'
              }`}
              aria-pressed={selectedLegacyId === legacy.id}
              aria-label={`Select ${legacy.name} legacy`}
            >
              <h4 className="font-semibold text-amber-400 text-lg">{legacy.name}</h4>
              <p className="text-sm text-gray-300 mt-1" style={{ minHeight: '4em' }}>{legacy.description}</p>
              <div className="text-xs text-sky-200 mt-2">
                <p>Lvl 1: {legacy.level1Benefit.resistanceType} Resistance, {allSpells[legacy.level1Benefit.cantripId]?.name || legacy.level1Benefit.cantripId} cantrip.</p>
                <p>Lvl 3: Learns {allSpells[legacy.level3SpellId]?.name || legacy.level3SpellId}.</p>
                <p>Lvl 5: Learns {allSpells[legacy.level5SpellId]?.name || legacy.level5SpellId}.</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedLegacyId && (
        <div className="mb-6">
          <h3 className="text-xl text-amber-300 mb-3">Select Spellcasting Ability for Legacy Spells & Thaumaturgy:</h3>
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
           {selectedSpellcastingAbility && <p className="text-xs text-gray-400 mt-2">Selected Spellcasting Ability: {selectedSpellcastingAbility}</p>}
        </div>
      )}
      
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
          disabled={!selectedLegacyId || !selectedSpellcastingAbility}
          className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
          aria-label="Confirm selected Tiefling legacy and ability"
        >
          Confirm Legacy
        </button>
      </div>
    </div>
  );
};

export default TieflingLegacySelection;