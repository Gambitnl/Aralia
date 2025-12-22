/**
 * @file PaladinFeatureSelection.tsx
 * This component allows a player who has chosen the Paladin class to select
 * their initial known Level 1 spells.
 */
import React, { useState, useMemo } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { Spell, Class as CharClass } from '../../../types';

interface PaladinFeatureSelectionProps {
  spellcastingInfo: NonNullable<CharClass['spellcasting']>;
  allSpells: Record<string, Spell>;
  onPaladinFeaturesSelect: (spellsL1: Spell[]) => void;
  onBack: () => void;
}

const containerMotion: MotionProps = {
  initial: { x: 300, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -300, opacity: 0 },
  transition: { duration: 0.3, ease: 'easeInOut' },
};

const PaladinFeatureSelection: React.FC<PaladinFeatureSelectionProps> = ({
  spellcastingInfo,
  allSpells,
  onPaladinFeaturesSelect,
  onBack,
}) => {
  const [selectedSpellL1Ids, setSelectedSpellL1Ids] = useState<Set<string>>(new Set());

  const { knownSpellsL1, spellList } = spellcastingInfo;

  const availableSpellsL1 = useMemo(() => spellList
    .map((id: string) => allSpells[String(id)])
    .filter((spell): spell is Spell => !!spell && spell.level === 1), [spellList, allSpells]);
    
  const toggleSelection = (id: string) => {
    setSelectedSpellL1Ids(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else if (newSelected.size < knownSpellsL1) {
        newSelected.add(id);
      }
      return newSelected;
    });
  };

  const handleSubmit = () => {
    if (selectedSpellL1Ids.size === knownSpellsL1) {
      const spellsL1 = Array.from(selectedSpellL1Ids).map(id => allSpells[String(id)]);
      onPaladinFeaturesSelect(spellsL1);
    }
  };

  const isSubmitDisabled = selectedSpellL1Ids.size !== knownSpellsL1;

  return (
    <motion.div
      key="paladinFeatures"
      {...containerMotion}
    >
      <h2 className="text-2xl text-sky-300 mb-4 text-center">Paladin Spell Selection</h2>
      
      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-2">Select {knownSpellsL1} Level 1 Spells</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {availableSpellsL1.map(spell => (
            <label key={spell.id} className={`p-2 rounded-md cursor-pointer transition-colors ${selectedSpellL1Ids.has(spell.id) ? 'bg-sky-600 ring-1 ring-sky-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <input type="checkbox" className="mr-2 form-checkbox text-sky-500 bg-gray-800 border-gray-600 rounded focus:ring-sky-500"
                checked={selectedSpellL1Ids.has(spell.id)}
                onChange={() => toggleSelection(spell.id)}
                disabled={!selectedSpellL1Ids.has(spell.id) && selectedSpellL1Ids.size >= knownSpellsL1}
                aria-label={`Select spell ${spell.name}`}
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

export default PaladinFeatureSelection;
