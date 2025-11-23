/**
 * @file ArtificerFeatureSelection.tsx
 * This component allows a player who has chosen the Artificer class to select
 * their initial known cantrips and prepared Level 1 spells. The number of
 * prepared spells is dynamically calculated based on their Intelligence modifier.
 */
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Spell, Class as CharClass, AbilityScores } from '../../../types';
import { getAbilityModifierValue } from '../../../utils/characterUtils';

interface ArtificerFeatureSelectionProps {
  spellcastingInfo: NonNullable<CharClass['spellcasting']>;
  allSpells: Record<string, Spell>;
  abilityScores: AbilityScores;
  onArtificerFeaturesSelect: (cantrips: Spell[], spellsL1: Spell[]) => void;
  onBack: () => void;
}

const ArtificerFeatureSelection: React.FC<ArtificerFeatureSelectionProps> = ({
  spellcastingInfo,
  allSpells,
  abilityScores,
  onArtificerFeaturesSelect,
  onBack,
}) => {
  const [selectedCantripIds, setSelectedCantripIds] = useState<Set<string>>(new Set());
  const [selectedSpellL1Ids, setSelectedSpellL1Ids] = useState<Set<string>>(new Set());

  const intModifier = useMemo(() => getAbilityModifierValue(abilityScores.Intelligence), [abilityScores.Intelligence]);
  const numPreparedSpells = useMemo(() => Math.max(1, intModifier + Math.floor(1 / 2)), [intModifier]);

  const availableCantrips = spellcastingInfo.spellList
    .map((id: string) => allSpells[String(id)])
    .filter(spell => spell && spell.level === 0);

  const availableSpellsL1 = spellcastingInfo.spellList
    .map((id: string) => allSpells[String(id)])
    .filter(spell => spell && spell.level === 1);

  const toggleSelection = (id: string, currentSelection: Set<string>, setSelection: React.Dispatch<React.SetStateAction<Set<string>>>, limit: number) => {
    const newSelection = new Set(currentSelection);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else if (newSelection.size < limit) {
      newSelection.add(id);
    }
    setSelection(newSelection);
  };

  const handleSubmit = () => {
    if (selectedCantripIds.size === spellcastingInfo.knownCantrips && selectedSpellL1Ids.size === numPreparedSpells) {
      const cantrips = Array.from(selectedCantripIds).map(id => allSpells[String(id)]);
      const spellsL1 = Array.from(selectedSpellL1Ids).map(id => allSpells[String(id)]);
      onArtificerFeaturesSelect(cantrips, spellsL1);
    }
  };

  const isButtonDisabled = selectedCantripIds.size !== spellcastingInfo.knownCantrips || selectedSpellL1Ids.size !== numPreparedSpells;

  return (
    <motion.div
      {...{
        key: "artificerFeatures",
        initial: { x: 300, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: -300, opacity: 0 },
        transition: { duration: 0.3, ease: 'easeInOut' },
      } as any}
    >
      <h2 className="text-2xl text-sky-300 mb-4 text-center">Artificer Spell Selection</h2>

      {/* Cantrip Selection */}
      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-2">Select {spellcastingInfo.knownCantrips} Cantrips</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {availableCantrips.map(spell => (
            <label key={spell.id} className={`p-2 rounded-md cursor-pointer transition-colors ${selectedCantripIds.has(spell.id) ? 'bg-sky-600 ring-1 ring-sky-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <input type="checkbox" className="mr-2 form-checkbox text-sky-500 bg-gray-800 border-gray-600 rounded focus:ring-sky-500"
                checked={selectedCantripIds.has(spell.id)}
                onChange={() => toggleSelection(spell.id, selectedCantripIds, setSelectedCantripIds, spellcastingInfo.knownCantrips)}
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
        <h3 className="text-xl text-amber-300 mb-2">Prepare {numPreparedSpells} Level 1 Spells</h3>
        <p className="text-xs text-gray-400 mb-2">(Based on your Intelligence modifier of {intModifier})</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {availableSpellsL1.map(spell => (
            <label key={spell.id} className={`p-2 rounded-md cursor-pointer transition-colors ${selectedSpellL1Ids.has(spell.id) ? 'bg-sky-600 ring-1 ring-sky-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <input type="checkbox" className="mr-2 form-checkbox text-sky-500 bg-gray-800 border-gray-600 rounded focus:ring-sky-500"
                checked={selectedSpellL1Ids.has(spell.id)}
                onChange={() => toggleSelection(spell.id, selectedSpellL1Ids, setSelectedSpellL1Ids, numPreparedSpells)}
                disabled={!selectedSpellL1Ids.has(spell.id) && selectedSpellL1Ids.size >= numPreparedSpells}
                aria-label={`Select level 1 spell ${spell.name}`}
              />
              {spell.name}
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Selected: {selectedSpellL1Ids.size}/{numPreparedSpells}</p>
      </div>

      <div className="flex gap-4 mt-6">
        <button onClick={onBack} className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow">Back</button>
        <button onClick={handleSubmit} disabled={isButtonDisabled} className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow">
          Confirm Spells
        </button>
      </div>
    </motion.div>
  );
};

export default ArtificerFeatureSelection;