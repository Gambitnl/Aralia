/**
 * @file ClericFeatureSelection.tsx
 * This component allows a player who has chosen the Cleric class to select
 * their Divine Order and their initial known cantrips and Level 1 spells.
 */
import React, { useState } from 'react';
import { DivineOrderOption, Spell, Class as CharClass, SpellEffect, DamageEffect } from '../../../types'; 
import { CreationStepLayout } from '../ui/CreationStepLayout';

interface ClericFeatureSelectionProps {
  divineOrders: DivineOrderOption[];
  spellcastingInfo: NonNullable<CharClass['spellcasting']>;
  allSpells: Record<string, Spell>;
  onClericFeaturesSelect: (order: 'Protector' | 'Thaumaturge', cantrips: Spell[], spellsL1: Spell[]) => void;
  onBack: () => void;
}

const ClericFeatureSelection: React.FC<ClericFeatureSelectionProps> = ({ 
  divineOrders, spellcastingInfo, allSpells, onClericFeaturesSelect, onBack 
}) => {
  const [selectedOrder, setSelectedOrder] = useState<'Protector' | 'Thaumaturge' | null>(null);
  const [selectedCantripIds, setSelectedCantripIds] = useState<Set<string>>(new Set());
  const [selectedSpellL1Ids, setSelectedSpellL1Ids] = useState<Set<string>>(new Set());

  const handleOrderSelect = (orderId: 'Protector' | 'Thaumaturge') => {
    if (orderId !== selectedOrder) {
      setSelectedCantripIds(new Set());
      setSelectedSpellL1Ids(new Set());
    }
    setSelectedOrder(orderId);
  };

  const numCantripsToSelect = spellcastingInfo.knownCantrips + (selectedOrder === 'Thaumaturge' ? 1 : 0);
  const numSpellsL1ToSelect = spellcastingInfo.knownSpellsL1;

  const availableCantrips = spellcastingInfo.spellList
    .map(id => allSpells[String(id)])
    .filter(spell => spell && spell.level === 0);
  
  const availableSpellsL1 = spellcastingInfo.spellList
    .map(id => allSpells[String(id)])
    .filter(spell => spell && spell.level === 1);

  const getSpellDamageInfo = (spell: Spell): string | null => {
    if (!spell.effects) return null;
    const damageEffect = spell.effects.find((e: SpellEffect) => e.type === 'DAMAGE') as DamageEffect | undefined;
    if (damageEffect && damageEffect.damage) {
      return `${damageEffect.damage.dice} ${damageEffect.damage.type}`;
    }
    return null;
  };

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
      const spellsL1 = Array.from(selectedSpellL1Ids).map(id => allSpells[String(id)]);
      onClericFeaturesSelect(selectedOrder, cantrips, spellsL1);
    }
  };

  const isSubmitDisabled = !selectedOrder || selectedCantripIds.size !== numCantripsToSelect || selectedSpellL1Ids.size !== numSpellsL1ToSelect;

  return (
    <CreationStepLayout
      title="Cleric Choices"
      onBack={onBack}
      onNext={handleSubmit}
      canProceed={!isSubmitDisabled}
      nextLabel="Confirm Choices"
    >
      <div className="space-y-8">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {availableCantrips.map(spell => (
                  <label 
                    key={spell.id} 
                    className={`p-3 rounded-lg cursor-pointer transition-all border ${
                      selectedCantripIds.has(spell.id) 
                        ? 'bg-sky-900/40 border-sky-500 text-sky-200' 
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        className="form-checkbox h-4 w-4 text-sky-500 bg-gray-950 border-gray-700 rounded focus:ring-sky-500" 
                        checked={selectedCantripIds.has(spell.id)} 
                        onChange={() => toggleSelection(spell.id, selectedCantripIds, setSelectedCantripIds, numCantripsToSelect)} 
                        disabled={!selectedCantripIds.has(spell.id) && selectedCantripIds.size >= numCantripsToSelect}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{spell.name}</span>
                        {getSpellDamageInfo(spell) && (
                          <span className="text-[10px] text-red-400/80 font-bold">{getSpellDamageInfo(spell)}</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section>
              <div className="flex justify-between items-end mb-3 border-b border-gray-700 pb-1">
                <h3 className="text-xl font-cinzel text-amber-400">Select Level 1 Spells</h3>
                <span className="text-xs font-mono text-gray-500 mb-1">
                  {selectedSpellL1Ids.size} / {numSpellsL1ToSelect}
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
                        onChange={() => toggleSelection(spell.id, selectedSpellL1Ids, setSelectedSpellL1Ids, numSpellsL1ToSelect)} 
                        disabled={!selectedSpellL1Ids.has(spell.id) && selectedSpellL1Ids.size >= numSpellsL1ToSelect}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{spell.name}</span>
                        {getSpellDamageInfo(spell) && (
                          <span className="text-[10px] text-red-400/80 font-bold">{getSpellDamageInfo(spell)}</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </CreationStepLayout>
  );
};

export default ClericFeatureSelection;
