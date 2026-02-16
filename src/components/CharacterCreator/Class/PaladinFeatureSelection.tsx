/**
 * @file PaladinFeatureSelection.tsx
 * This component allows a player who has chosen the Paladin class to select
 * their initial known Level 1 spells.
 */
import React, { useState, useMemo } from 'react';
import { Spell, Class as CharClass } from '../../../types';
import { CreationStepLayout } from '../ui/CreationStepLayout';

interface PaladinFeatureSelectionProps {
  spellcastingInfo: NonNullable<CharClass['spellcasting']>;
  allSpells: Record<string, Spell>;
  onPaladinFeaturesSelect: (spellsL1: Spell[]) => void;
  onBack: () => void;
}

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
    <CreationStepLayout
      title="Paladin Spell Selection"
      onBack={onBack}
      onNext={handleSubmit}
      canProceed={!isSubmitDisabled}
      nextLabel="Confirm Spells"
    >
      <section>
        <div className="flex justify-between items-end mb-3 border-b border-gray-700 pb-1">
          <h3 className="text-xl font-cinzel text-amber-400">Select Level 1 Spells</h3>
          <span className="text-xs font-mono text-gray-500 mb-1">
            {selectedSpellL1Ids.size} / {knownSpellsL1}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {availableSpellsL1.map(spell => (
            <label 
              key={spell.id} 
              className={`p-3 rounded-lg cursor-pointer transition-all border ${
                selectedSpellL1Ids.has(spell.id) 
                  ? 'bg-sky-900/40 border-sky-500 text-sky-200' 
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  className="form-checkbox h-4 w-4 text-sky-500 bg-gray-950 border-gray-700 rounded focus:ring-sky-500" 
                  checked={selectedSpellL1Ids.has(spell.id)} 
                  onChange={() => toggleSelection(spell.id)} 
                  disabled={!selectedSpellL1Ids.has(spell.id) && selectedSpellL1Ids.size >= knownSpellsL1}
                />
                <span className="text-sm font-semibold">{spell.name}</span>
              </div>
            </label>
          ))}
        </div>
      </section>
    </CreationStepLayout>
  );
};

export default PaladinFeatureSelection;
