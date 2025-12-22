/**
 * @file BardFeatureSelection.tsx
 * This component allows a player who has chosen the Bard class to select
 * their initial known cantrips and Level 1 spells.
 */
import React, { useState, useMemo } from 'react';
import { motion, type MotionProps } from 'framer-motion';
import { Spell, Class as CharClass } from '../../../types';

interface BardFeatureSelectionProps {
  spellcastingInfo: NonNullable<CharClass['spellcasting']>;
  allSpells: Record<string, Spell>;
  onBardFeaturesSelect: (cantrips: Spell[], spellsL1: Spell[]) => void;
  onBack: () => void;
}

const BardFeatureSelection: React.FC<BardFeatureSelectionProps> = ({
  spellcastingInfo,
  allSpells,
  onBardFeaturesSelect,
  onBack,
}) => {
  const [selectedCantripIds, setSelectedCantripIds] = useState<Set<string>>(new Set());
  const [selectedSpellL1Ids, setSelectedSpellL1Ids] = useState<Set<string>>(new Set());

  const { knownCantrips, knownSpellsL1, spellList } = spellcastingInfo;

  const availableCantrips = useMemo(() => spellList
    .map((id: string) => allSpells[String(id)])
    .filter((spell): spell is Spell => !!spell && spell.level === 0), [spellList, allSpells]);
    
  const availableSpellsL1 = useMemo(() => spellList
    .map((id: string) => allSpells[String(id)])
    .filter((spell): spell is Spell => !!spell && spell.level === 1), [spellList, allSpells]);

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
    if (selectedCantripIds.size === knownCantrips && selectedSpellL1Ids.size === knownSpellsL1) {
      const cantrips = Array.from(selectedCantripIds).map(id => allSpells[String(id)]);
      const spellsL1 = Array.from(selectedSpellL1Ids).map(id => allSpells[String(id)]);
      onBardFeaturesSelect(cantrips, spellsL1);
    }
  };

  const isSubmitDisabled = selectedCantripIds.size !== knownCantrips || selectedSpellL1Ids.size !== knownSpellsL1;

  const motionProps: MotionProps = {
    key: "bardFeatures",
    initial: { x: 300, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -300, opacity: 0 },
    transition: { duration: 0.3, ease: 'easeInOut' },
  };

  return (
    <motion.div {...motionProps}>
      <h2 className="text-2xl text-sky-300 mb-4 text-center">Bard Spell Selection</h2>
      <p className="text-sm text-gray-400 mb-6 text-center">
        As a Bard, you weave magic through your art. Choose the spells that will be your instruments.
      </p>

      {/* Cantrip Selection */}
      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-2">Select {knownCantrips} Cantrips</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {availableCantrips.map(spell => (
            <label key={spell.id} className={`p-2 rounded-md cursor-pointer transition-colors ${selectedCantripIds.has(spell.id) ? 'bg-sky-600 ring-1 ring-sky-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <input type="checkbox" className="mr-2 form-checkbox text-sky-500 bg-gray-800 border-gray-600 rounded focus:ring-sky-500"
                checked={selectedCantripIds.has(spell.id)}
                onChange={() => toggleSelection(spell.id, selectedCantripIds, setSelectedCantripIds, knownCantrips)}
                disabled={!selectedCantripIds.has(spell.id) && selectedCantripIds.size >= knownCantrips}
                aria-label={`Select cantrip ${spell.name}`}
              />
              {spell.name}
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Selected: {selectedCantripIds.size}/{knownCantrips}</p>
      </div>

      {/* Level 1 Spell Selection */}
      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-2">Select {knownSpellsL1} Level 1 Spells</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {availableSpellsL1.map(spell => (
            <label key={spell.id} className={`p-2 rounded-md cursor-pointer transition-colors ${selectedSpellL1Ids.has(spell.id) ? 'bg-sky-600 ring-1 ring-sky-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <input type="checkbox" className="mr-2 form-checkbox text-sky-500 bg-gray-800 border-gray-600 rounded focus:ring-sky-500"
                checked={selectedSpellL1Ids.has(spell.id)}
                onChange={() => toggleSelection(spell.id, selectedSpellL1Ids, setSelectedSpellL1Ids, knownSpellsL1)}
                disabled={!selectedSpellL1Ids.has(spell.id) && selectedSpellL1Ids.size >= knownSpellsL1}
                aria-label={`Select level 1 spell ${spell.name}`}
              />
              {spell.name}
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Selected: {selectedSpellL1Ids.size}/{knownSpellsL1}</p>
      </div>

      <div className="flex gap-4 mt-6">
        <button onClick={onBack} className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow">Back</button>
        <button onClick={handleSubmit} disabled={isSubmitDisabled} className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow">
          Confirm Spells
        </button>
      </div>
    </motion.div>
  );
};

export default BardFeatureSelection;
