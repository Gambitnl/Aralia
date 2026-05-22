/**
 * @file PaladinFeatureSelection.tsx
 * This component allows a player who has chosen the Paladin class to select
 * their initial known Level 1 spells.
 */
import React, { useState, useMemo } from 'react';
import { Spell, Class as CharClass } from '../../../types';
import { CreationStepLayout } from '../ui/CreationStepLayout';
import { SpellCard } from './SpellCard';

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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {availableSpellsL1.map(spell => {
            const isSelected = selectedSpellL1Ids.has(spell.id);
            const isDisabled = !selectedSpellL1Ids.has(spell.id) && selectedSpellL1Ids.size >= knownSpellsL1;

            return (
              <SpellCard
                key={spell.id}
                spell={spell}
                selected={isSelected}
                disabled={isDisabled}
                onToggle={() => toggleSelection(spell.id)}
                idPrefix="spell1"
              />
            );
          })}
        </div>
      </section>
    </CreationStepLayout>
  );
};

export default PaladinFeatureSelection;
