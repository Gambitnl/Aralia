/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Cleric Feature' selection (Divine Order, 
 * Cantrips, and Level 1 Spells).
 *
 * WHEN the Divine Domain is chosen depends on the campaign's rules edition
 * (agora-f821.56): the 2014 Player's Handbook picks a Divine Domain at level 1,
 * while the 2024 one defers it to level 3. The level comes from
 * `getSubclassLevel`, so this component never decides the edition for itself —
 * it is told. Note that the Divine Domain (the subclass) is a different choice
 * from the 2024 Divine Order (Protector / Thaumaturge), which stays on every
 * edition because it is what this repo's level-1 cleric data encodes.
 *
 * Recent updates focus on '2024 Rulebook Alignment' and 'Dynamic Selection Pools'.
 * - Added `sr-only` accessibility labels for all spell selection inputs.
 * - Refined item highlighting to use a consolidated check 
 *   (`selectedCantripIds.has || selectedSpellL1Ids.has`). This ensures 
 *   visual consistency across sub-lists.
 * - Implemented `numCantripsToSelect` logic to account for the 
 *   'Thaumaturge' Divine Order, which grants an extra cantrip. This 
 *   dynamic limit ensures that validation correctly scales based on the 
 *   player's specific build choices.
 * 
 * @file src/components/CharacterCreator/Class/ClericFeatureSelection.tsx
 */
import React, { useState } from 'react';
import { DivineOrderOption, Spell, Class as CharClass } from '../../../types';
import { getSubclassLevel, type RulesEdition } from '../../../config/rulesEdition';
import { CreationStepLayout } from '../ui/CreationStepLayout';
import { SpellCard } from './SpellCard';

/** One Divine Domain offered at level 1, derived from SUBCLASSES.cleric by the caller. */
export interface DivineDomainOption {
  id: string;
  name: string;
  description: string;
}

interface ClericFeatureSelectionProps {
  divineOrders: DivineOrderOption[];
  /** Every Divine Domain a cleric can serve; only offered when the edition puts the choice at level 1. */
  divineDomains: DivineDomainOption[];
  /** The campaign's rules edition, read by the caller via `getRulesEdition`. */
  rulesEdition: RulesEdition;
  spellcastingInfo: NonNullable<CharClass['spellcasting']>;
  allSpells: Record<string, Spell>;
  onClericFeaturesSelect: (order: 'Protector' | 'Thaumaturge', cantrips: Spell[], spellsL1: Spell[], domainId?: string) => void;
  onBack: () => void;
}

const ClericFeatureSelection: React.FC<ClericFeatureSelectionProps> = ({ 
  divineOrders, divineDomains, rulesEdition, spellcastingInfo, allSpells, onClericFeaturesSelect, onBack 
}) => {
  const [selectedOrder, setSelectedOrder] = useState<'Protector' | 'Thaumaturge' | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [selectedCantripIds, setSelectedCantripIds] = useState<Set<string>>(new Set());
  const [selectedSpellL1Ids, setSelectedSpellL1Ids] = useState<Set<string>>(new Set());

  // The whole edition switch reduces to this one number. Level 1 means the
  // Divine Domain is part of this step; anything later means it is not.
  const domainLevel = getSubclassLevel('cleric', rulesEdition);
  const choosesDomainNow = domainLevel === 1 && divineDomains.length > 0;

  const handleOrderSelect = (orderId: 'Protector' | 'Thaumaturge') => {
    if (orderId !== selectedOrder) {
      setSelectedCantripIds(new Set());
      setSelectedSpellL1Ids(new Set());
    }
    setSelectedOrder(orderId);
  };

  // WHAT CHANGED: Dynamic cantrip limit calculation.
  // WHY IT CHANGED: To align with the 2024 Player's Handbook. Selecting 
  // the 'Thaumaturge' order grants an additional cantrip, so the 
  // validation limit must adjust in real-time.
  const numCantripsToSelect = spellcastingInfo.knownCantrips + (selectedOrder === 'Thaumaturge' ? 1 : 0);
  const numSpellsL1ToSelect = spellcastingInfo.knownSpellsL1;

  const availableCantrips = spellcastingInfo.spellList
    .map(id => allSpells[String(id)])
    .filter(spell => spell && spell.level === 0);
  
  const availableSpellsL1 = spellcastingInfo.spellList
    .map(id => allSpells[String(id)])
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
  
  const isDomainSatisfied = !choosesDomainNow || selectedDomainId !== null;

  const handleSubmit = () => {
    if (selectedOrder && selectedCantripIds.size === numCantripsToSelect && selectedSpellL1Ids.size === numSpellsL1ToSelect && isDomainSatisfied) {
      const cantrips = Array.from(selectedCantripIds).map(id => allSpells[String(id)]);
      const spellsL1 = Array.from(selectedSpellL1Ids).map(id => allSpells[String(id)]);
      onClericFeaturesSelect(selectedOrder, cantrips, spellsL1, choosesDomainNow ? selectedDomainId! : undefined);
    }
  };

  const isSubmitDisabled = !selectedOrder || selectedCantripIds.size !== numCantripsToSelect || selectedSpellL1Ids.size !== numSpellsL1ToSelect || !isDomainSatisfied;

  return (
    <CreationStepLayout
      title={choosesDomainNow ? 'Cleric Domain & Choices' : 'Cleric Choices'}
      onBack={onBack}
      onNext={handleSubmit}
      canProceed={!isSubmitDisabled}
      nextLabel="Confirm Choices"
    >
      <div className="space-y-8">
        {choosesDomainNow ? (
          <section>
            <div className="flex justify-between items-end mb-3 border-b border-gray-700 pb-1">
              <h3 className="text-xl font-cinzel text-amber-400">Choose Your Divine Domain</h3>
              <span className="text-xs font-mono text-gray-500 mb-1">2014 rules &middot; level 1</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {divineDomains.map(domain => {
                const isSelected = selectedDomainId === domain.id;
                return (
                  <button
                    key={domain.id}
                    type="button"
                    onClick={() => setSelectedDomainId(domain.id)}
                    aria-pressed={isSelected}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-amber-900/40 border-amber-400'
                        : 'bg-gray-800 border-gray-700 hover:border-amber-600'
                    }`}
                  >
                    <span className="block font-cinzel text-amber-300">{domain.name}</span>
                    <span className="block text-xs text-gray-400 mt-1">{domain.description}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <p className="text-sm text-gray-400 italic">
            Under the 2024 rules you choose a Divine Domain at level {domainLevel}.
          </p>
        )}

        <section>
          <h3 className="text-xl font-cinzel text-amber-400 mb-3 border-b border-gray-700 pb-1">Choose Divine Order</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {divineOrders.map(order => (
              <button
                key={order.id}
                onClick={() => handleOrderSelect(order.id)}
                className={`text-left p-4 rounded-xl transition-all border-2 ${
                  selectedOrder === order.id 
                    ? 'bg-sky-900/40 border-sky-500 shadow-md' 
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }`}
              >
                <h4 className="font-bold text-gray-100">{order.name}</h4>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{order.description}</p>
              </button>
            ))}
          </div>
        </section>

        {selectedOrder && (
          <>
            <section>
              <div className="flex justify-between items-end mb-3 border-b border-gray-700 pb-1">
                <h3 className="text-xl font-cinzel text-amber-400">Select Cantrips</h3>
                <span className="text-xs font-mono text-gray-500 mb-1">
                  {selectedCantripIds.size} / {numCantripsToSelect}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {availableCantrips.map(spell => {
                  const isSelected = selectedCantripIds.has(spell.id) || selectedSpellL1Ids.has(spell.id);
                  const isDisabled = !selectedCantripIds.has(spell.id) && selectedCantripIds.size >= numCantripsToSelect;

                  return (
                    <SpellCard
                      key={spell.id}
                      spell={spell}
                      selected={isSelected}
                      disabled={isDisabled}
                      onToggle={() => toggleSelection(spell.id, selectedCantripIds, setSelectedCantripIds, numCantripsToSelect)}
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
                  {selectedSpellL1Ids.size} / {numSpellsL1ToSelect}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {availableSpellsL1.map(spell => {
                  const isSelected = selectedCantripIds.has(spell.id) || selectedSpellL1Ids.has(spell.id);
                  const isDisabled = !selectedSpellL1Ids.has(spell.id) && selectedSpellL1Ids.size >= numSpellsL1ToSelect;

                  return (
                    <SpellCard
                      key={spell.id}
                      spell={spell}
                      selected={isSelected}
                      disabled={isDisabled}
                      onToggle={() => toggleSelection(spell.id, selectedSpellL1Ids, setSelectedSpellL1Ids, numSpellsL1ToSelect)}
                      idPrefix="spell1"
                    />
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </CreationStepLayout>
  );
};

export default ClericFeatureSelection;
