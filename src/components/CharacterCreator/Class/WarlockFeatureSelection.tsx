/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Warlock Feature' selection (Cantrips and 
 * Level 1 Spells). Patron selection is deferred to Level 3 in the current 
 * implementation, focusing on core Pact Magic initialization at Level 1.
 *
 * Recent updates focus on 'Accessibility' and 'State Visualization'.
 * - Added `sr-only` labels to improve screen reader support for spell picks.
 * - Refined selection highlighting to use a consolidated check 
 *   (`selectedCantripIds.has || selectedSpellL1Ids.has`), ensuring that 
 *   any active selection is reflected in the UI across both lists.
 * - Centralized spell data filtering using `useMemo` to ensure stable 
 *   renders when the parent state update triggers a re-render.
 * 
 * @file src/components/CharacterCreator/Class/WarlockFeatureSelection.tsx
 */
import React, { useState, useMemo } from 'react';
import { Spell, Class as CharClass } from '../../../types';
import { CreationStepLayout } from '../ui/CreationStepLayout';
import { SpellCard } from './SpellCard';

interface WarlockFeatureSelectionProps {
  spellcastingInfo: NonNullable<CharClass['spellcasting']>;
  allSpells: Record<string, Spell>;
  onWarlockFeaturesSelect: (cantrips: Spell[], spellsL1: Spell[]) => void;
  onBack: () => void;
}

const WarlockFeatureSelection: React.FC<WarlockFeatureSelectionProps> = ({
  spellcastingInfo,
  allSpells,
  onWarlockFeaturesSelect,
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
      onWarlockFeaturesSelect(cantrips, spellsL1);
    }
  };

  const isSubmitDisabled = selectedCantripIds.size !== knownCantrips || selectedSpellL1Ids.size !== knownSpellsL1;

  return (
    <CreationStepLayout
      title="Warlock Spell Selection"
      onBack={onBack}
      onNext={handleSubmit}
      canProceed={!isSubmitDisabled}
      nextLabel="Confirm Spells"
    >
      <div className="space-y-8">
        <section>
          <div className="flex justify-between items-end mb-3 border-b border-gray-700 pb-1">
            <h3 className="text-xl font-cinzel text-amber-400">Select Cantrips</h3>
            <span className="text-xs font-mono text-gray-500 mb-1">
              {selectedCantripIds.size} / {knownCantrips}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {availableCantrips.map(spell => {
              const isSelected = selectedCantripIds.has(spell.id) || selectedSpellL1Ids.has(spell.id);
              const isDisabled = !selectedCantripIds.has(spell.id) && selectedCantripIds.size >= knownCantrips;

              return (
                <SpellCard
                  key={spell.id}
                  spell={spell}
                  selected={isSelected}
                  disabled={isDisabled}
                  onToggle={() => toggleSelection(spell.id, selectedCantripIds, setSelectedCantripIds, knownCantrips)}
                  idPrefix="cantrip"
                />
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex justify-between items-end mb-3 border-b border-gray-700 pb-1">
            <h3 className="text-xl font-cinzel text-amber-400">Select Level 1 Spells</h3>
            <span className="text-xs font-mono text-gray-500 mb-1">
              {selectedSpellL1Ids.size} / {knownSpellsL1}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {availableSpellsL1.map(spell => {
              const isSelected = selectedCantripIds.has(spell.id) || selectedSpellL1Ids.has(spell.id);
              const isDisabled = !selectedSpellL1Ids.has(spell.id) && selectedSpellL1Ids.size >= knownSpellsL1;

              return (
                <SpellCard
                  key={spell.id}
                  spell={spell}
                  selected={isSelected}
                  disabled={isDisabled}
                  onToggle={() => toggleSelection(spell.id, selectedSpellL1Ids, setSelectedSpellL1Ids, knownSpellsL1)}
                  idPrefix="spell1"
                />
              );
            })}
          </div>
        </section>
      </div>
    </CreationStepLayout>
  );
};

export default WarlockFeatureSelection;
