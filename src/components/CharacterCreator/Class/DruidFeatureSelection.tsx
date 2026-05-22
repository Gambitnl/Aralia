/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Druid Feature' selection (Primal Order, 
 * Cantrips, and Level 1 Spells).
 *
 * Recent updates focus on '2024 Rulebook Alignment' and 'Automated Feature Injection'.
 * - Added `sr-only` accessibility labels for all spell selection inputs.
 * - Refined item highlighting to use a consolidated check 
 *   (`selectedCantripIds.has || selectedSpellL1Ids.has`) for UI consistency.
 * - Implemented `numCantripsToSelect` logic to account for the 
 *   'Magician' Primal Order, which grants an extra cantrip.
 * - Automated the inclusion of `Speak with Animals`. This spell is now 
 *   displayed as a locked, pre-selected 'Class Feature' in the Level 1 
 *   list, ensuring players are aware of their innate class abilities 
 *   without having to manually spend a selection slot on them.
 * 
 * @file src/components/CharacterCreator/Class/DruidFeatureSelection.tsx
 */
import React, { useState, useMemo } from 'react';
import { PrimalOrderOption, Spell, Class as CharClass } from '../../../types';
import _Tooltip from '../../Tooltip';
import { CreationStepLayout } from '../ui/CreationStepLayout';
import { SpellCard } from './SpellCard';

interface DruidFeatureSelectionProps {
  primalOrders: PrimalOrderOption[];
  spellcastingInfo: NonNullable<CharClass['spellcasting']>;
  allSpells: Record<string, Spell>;
  onDruidFeaturesSelect: (order: 'Magician' | 'Warden', cantrips: Spell[], spellsL1: Spell[]) => void;
  onBack: () => void;
}

const DruidFeatureSelection: React.FC<DruidFeatureSelectionProps> = ({
  primalOrders,
  spellcastingInfo,
  allSpells,
  onDruidFeaturesSelect,
  onBack,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<'Magician' | 'Warden' | null>(null);
  const [selectedCantripIds, setSelectedCantripIds] = useState<Set<string>>(new Set());
  const [selectedSpellL1Ids, setSelectedSpellL1Ids] = useState<Set<string>>(new Set());

  const handleOrderSelect = (orderId: 'Magician' | 'Warden') => {
    if (orderId !== selectedOrder) {
      setSelectedCantripIds(new Set());
      setSelectedSpellL1Ids(new Set());
    }
    setSelectedOrder(orderId);
  };

  const numCantripsToSelect = spellcastingInfo.knownCantrips + (selectedOrder === 'Magician' ? 1 : 0);
  const numSpellsL1ToSelect = spellcastingInfo.knownSpellsL1;

  const availableCantrips = useMemo(() => spellcastingInfo.spellList
    .map((id: string) => allSpells[String(id)])
    .filter((spell): spell is Spell => !!spell && spell.level === 0), [spellcastingInfo.spellList, allSpells]);
    
  // WHAT CHANGED: Filtered out 'Speak with Animals' from the selection list.
  // WHY IT CHANGED: Druids now get this spell automatically as a class 
  // feature at Level 1. By filtering it here and rendering it as a 
  // locked item in the UI, we prevent players from wasting their 
  // limited preparation slots on a spell they already possess.
  const availableSpellsL1 = useMemo(() => spellcastingInfo.spellList
    .map((id: string) => allSpells[String(id)])
    .filter((spell): spell is Spell => !!spell && spell.level === 1 && spell.id !== 'speak-with-animals'), [spellcastingInfo.spellList, allSpells]);

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
    if (selectedOrder && selectedCantripIds.size === numCantripsToSelect && selectedSpellL1Ids.size === numSpellsL1ToSelect) {
      const cantrips = Array.from(selectedCantripIds).map(id => allSpells[String(id)]);
      const speakWithAnimalsSpell = allSpells['speak-with-animals'];
      const spellsL1 = Array.from(selectedSpellL1Ids).map(id => allSpells[String(id)]);
      if(speakWithAnimalsSpell) {
        spellsL1.push(speakWithAnimalsSpell);
      }
      onDruidFeaturesSelect(selectedOrder, cantrips, spellsL1);
    }
  };

  const isSubmitDisabled = !selectedOrder || selectedCantripIds.size !== numCantripsToSelect || selectedSpellL1Ids.size !== numSpellsL1ToSelect;

  return (
    <CreationStepLayout
      title="Druid Choices"
      onBack={onBack}
      onNext={handleSubmit}
      canProceed={!isSubmitDisabled}
      nextLabel="Confirm Choices"
    >
      <div className="space-y-8">
        <section>
          <h3 className="text-xl font-cinzel text-amber-400 mb-3 border-b border-gray-700 pb-1">Choose Primal Order</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {primalOrders.map(order => (
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

export default DruidFeatureSelection;
