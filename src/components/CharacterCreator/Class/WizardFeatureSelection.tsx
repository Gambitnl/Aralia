/**
 * @file WizardFeatureSelection.tsx
 * This component allows a player who has chosen the Wizard class to select
 * their initial known cantrips and Level 1 spells for their spellbook.
 */
import React, { useState } from 'react';
import { Spell, Class as CharClass } from '../../../types'; // Aliasing Class

interface WizardFeatureSelectionProps {
  spellcastingInfo: NonNullable<CharClass['spellcasting']>; // Ensured by class selection logic
  allSpells: Record<string, Spell>; // All available spells in the game
  onWizardFeaturesSelect: (cantrips: Spell[], spellsL1: Spell[]) => void;
  onBack: () => void; // Function to go back to Skill Selection
}

/**
 * WizardFeatureSelection component.
 * Handles selection of cantrips and Level 1 spells for Wizard characters.
 * @param {WizardFeatureSelectionProps} props - Props for the component.
 * @returns {React.FC} The rendered WizardFeatureSelection component.
 */
const WizardFeatureSelection: React.FC<WizardFeatureSelectionProps> = ({ 
  spellcastingInfo, allSpells, onWizardFeaturesSelect, onBack 
}) => {
  const [selectedCantripIds, setSelectedCantripIds] = useState<Set<string>>(new Set());
  // Wizards typically learn a number of L1 spells for their spellbook (e.g., 6).
  // `knownSpellsL1` in `spellcastingInfo` dictates how many they pick for their initial spellbook from the wizard list.
  // For simplicity, these become their initially "prepared" or readily available spells at game start.
  const [selectedSpellL1Ids, setSelectedSpellL1Ids] = useState<Set<string>>(new Set());

  // Filter available cantrips and L1 spells from the wizard's spell list
  const availableCantrips = spellcastingInfo.spellList
    .map((id: string) => allSpells[String(id)])
    .filter(spell => spell && spell.level === 0);
  
  const availableSpellsL1 = spellcastingInfo.spellList
    .map((id: string) => allSpells[String(id)])
    .filter(spell => spell && spell.level === 1);

  /**
   * Toggles the selection of a spell (cantrip or L1 spell).
   * @param {string} id - The ID of the spell.
   * @param {Set<string>} currentSelection - The current set of selected spell IDs.
   * @param {React.Dispatch<React.SetStateAction<Set<string>>>} setSelection - State setter for the selection.
   * @param {number} limit - The maximum number of spells allowed for this type.
   * @param {string} type - A string descriptor for logging ('cantrip' or 'spell L1').
   */
  const toggleSelection = (id: string, currentSelection: Set<string>, setSelection: React.Dispatch<React.SetStateAction<Set<string>>>, limit: number, type: string) => {
    const newSelection = new Set(currentSelection);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else if (newSelection.size < limit) {
      newSelection.add(id);
    }
    setSelection(newSelection);
  };
  
  /**
   * Confirms the selected spells and calls the onWizardFeaturesSelect callback.
   */
  const handleSubmit = () => {
    if (selectedCantripIds.size === spellcastingInfo.knownCantrips && selectedSpellL1Ids.size === spellcastingInfo.knownSpellsL1) {
      const cantrips = Array.from(selectedCantripIds).map(id => allSpells[String(id)]);
      const spellsL1 = Array.from(selectedSpellL1Ids).map(id => allSpells[String(id)]);
      onWizardFeaturesSelect(cantrips, spellsL1);
    } else {
        // Optionally provide UI feedback
    }
  };

  const isButtonDisabled = selectedCantripIds.size !== spellcastingInfo.knownCantrips || selectedSpellL1Ids.size !== spellcastingInfo.knownSpellsL1;

  return (
    <div>
      <h2 className="text-2xl text-sky-300 mb-4 text-center">Wizard Spell Selection</h2>
      
      {/* Cantrip Selection */}
      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-2">Select {spellcastingInfo.knownCantrips} Cantrips</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {availableCantrips.map(spell => (
          <label key={spell.id} className={`p-2 rounded-md cursor-pointer transition-colors ${selectedCantripIds.has(spell.id) ? 'bg-sky-600 ring-1 ring-sky-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
            <input 
              type="checkbox" 
              className="mr-2 form-checkbox text-sky-500 bg-gray-800 border-gray-600 rounded focus:ring-sky-500" 
              checked={selectedCantripIds.has(spell.id)} 
              onChange={() => toggleSelection(spell.id, selectedCantripIds, setSelectedCantripIds, spellcastingInfo.knownCantrips, 'cantrip')} 
              disabled={!selectedCantripIds.has(spell.id) && selectedCantripIds.size >= spellcastingInfo.knownCantrips}
              aria-label={`Select cantrip ${spell.name}`}
            />
            {spell.name}
          </label>
        ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Selected: {selectedCantripIds.size}/{spellcastingInfo.knownCantrips}</p>
      </div>

      {/* Level 1 Spell Selection */}
      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-2">Select {spellcastingInfo.knownSpellsL1} Level 1 Spells for your Spellbook</h3>
         <p className="text-xs text-gray-400 mb-2">(These will be your initially prepared spells.)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {availableSpellsL1.map(spell => (
          <label key={spell.id} className={`p-2 rounded-md cursor-pointer transition-colors ${selectedSpellL1Ids.has(spell.id) ? 'bg-sky-600 ring-1 ring-sky-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
            <input 
              type="checkbox" 
              className="mr-2 form-checkbox text-sky-500 bg-gray-800 border-gray-600 rounded focus:ring-sky-500" 
              checked={selectedSpellL1Ids.has(spell.id)} 
              onChange={() => toggleSelection(spell.id, selectedSpellL1Ids, setSelectedSpellL1Ids, spellcastingInfo.knownSpellsL1, 'spell L1')} 
              disabled={!selectedSpellL1Ids.has(spell.id) && selectedSpellL1Ids.size >= spellcastingInfo.knownSpellsL1}
              aria-label={`Select level 1 spell ${spell.name}`}
            />
            {spell.name}
          </label>
        ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Selected: {selectedSpellL1Ids.size}/{spellcastingInfo.knownSpellsL1}</p>
      </div>

      <div className="flex gap-4 mt-6">
        <button onClick={onBack} className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow" aria-label="Go back to skill selection">Back</button>
        <button 
            onClick={handleSubmit} 
            disabled={isButtonDisabled}
            className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow"
            aria-label="Confirm wizard spells"
        >
            Confirm Spells
        </button>
      </div>
    </div>
  );
};

export default WizardFeatureSelection;