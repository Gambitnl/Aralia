/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Wizard Feature' step. Wizards are unique 
 * in that they must select a larger initial pool of spells for their 
 * 'Spellbook' than other prepared casters.
 *
 * Recent updates focus on 'Accessibility' and 'Standardized Input'.
 * - Added `htmlFor` and `id` linking for spell labels. This ensures 
 *   that clicking the text or the container correctly toggles the 
 *   underlying checkbox, improving UX for all users and specifically 
 *   assisting screen reader navigation.
 * - Integrated `sr-only` labels for redundant visual text, ensuring 
 *   that the selection state is clearly communicated to assistive tools.
 * - Standardized the `form-checkbox` styling to match the rest of the 
 *   Character Creator suite (sky-500 theme).
 * 
 * @file src/components/CharacterCreator/Class/WizardFeatureSelection.tsx
 */
import React, { useState } from 'react';
import { Spell, Class as CharClass } from '../../../types';
import { CreationStepLayout } from '../ui/CreationStepLayout';
import { SpellCard } from './SpellCard';

interface WizardFeatureSelectionProps {
  spellcastingInfo: NonNullable<CharClass['spellcasting']>; 
  allSpells: Record<string, Spell>; 
  onWizardFeaturesSelect: (cantrips: Spell[], spellsL1: Spell[]) => void;
  onBack: () => void; 
}

const WizardFeatureSelection: React.FC<WizardFeatureSelectionProps> = ({ 
  spellcastingInfo, allSpells, onWizardFeaturesSelect, onBack 
}) => {
  const [selectedCantripIds, setSelectedCantripIds] = useState<Set<string>>(new Set());
  const [selectedSpellL1Ids, setSelectedSpellL1Ids] = useState<Set<string>>(new Set());

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
    if (selectedCantripIds.size === spellcastingInfo.knownCantrips && selectedSpellL1Ids.size === spellcastingInfo.knownSpellsL1) {
      const cantrips = Array.from(selectedCantripIds).map(id => allSpells[String(id)]);
      const spellsL1 = Array.from(selectedSpellL1Ids).map(id => allSpells[String(id)]);
      onWizardFeaturesSelect(cantrips, spellsL1);
    }
  };

  const isButtonDisabled = selectedCantripIds.size !== spellcastingInfo.knownCantrips || selectedSpellL1Ids.size !== spellcastingInfo.knownSpellsL1;

  return (
    <CreationStepLayout
      title="Wizard Spell Selection"
      onBack={onBack}
      onNext={handleSubmit}
      canProceed={!isButtonDisabled}
      nextLabel="Confirm Spells"
    >
      <div className="space-y-8">
        <section>
          <div className="flex justify-between items-end mb-3 border-b border-gray-700 pb-1">
            <h3 className="text-xl font-cinzel text-amber-400">Select Cantrips</h3>
            <span className="text-xs font-mono text-gray-500 mb-1">
              {selectedCantripIds.size} / {spellcastingInfo.knownCantrips}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {availableCantrips.map(spell => {
              const isSelected = selectedCantripIds.has(spell.id) || selectedSpellL1Ids.has(spell.id);
              const isDisabled = !selectedCantripIds.has(spell.id) && selectedCantripIds.size >= spellcastingInfo.knownCantrips;

              return (
                <SpellCard
                  key={spell.id}
                  spell={spell}
                  selected={isSelected}
                  disabled={isDisabled}
                  onToggle={() => toggleSelection(spell.id, selectedCantripIds, setSelectedCantripIds, spellcastingInfo.knownCantrips)}
                  idPrefix="cantrip"
                />
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex justify-between items-end mb-1 border-b border-gray-700 pb-1">
            <h3 className="text-xl font-cinzel text-amber-400">Select Level 1 Spells</h3>
            <span className="text-xs font-mono text-gray-500 mb-1">
              {selectedSpellL1Ids.size} / {spellcastingInfo.knownSpellsL1}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3 italic">These initial spells will be recorded in your starting spellbook.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {availableSpellsL1.map(spell => {
              const isSelected = selectedCantripIds.has(spell.id) || selectedSpellL1Ids.has(spell.id);
              const isDisabled = !selectedSpellL1Ids.has(spell.id) && selectedSpellL1Ids.size >= spellcastingInfo.knownSpellsL1;

              return (
                <SpellCard
                  key={spell.id}
                  spell={spell}
                  selected={isSelected}
                  disabled={isDisabled}
                  onToggle={() => toggleSelection(spell.id, selectedSpellL1Ids, setSelectedSpellL1Ids, spellcastingInfo.knownSpellsL1)}
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

export default WizardFeatureSelection;
