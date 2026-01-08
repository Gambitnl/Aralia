/**
 * @file ClericFeatureSelection.tsx
 * This component allows a player who has chosen the Cleric class to select
 * their Divine Order and their initial known cantrips and Level 1 spells.
 */
import React, { useState } from 'react';
import { DivineOrderOption, Spell, Class as CharClass, SpellEffect, DamageEffect } from '../../../types'; 

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

  // Helper to extract damage information from spell effects for display
  const getSpellDamageInfo = (spell: Spell): string | null => {
    if (!spell.effects) return null;
    // Find the first effect that deals damage
    const damageEffect = spell.effects.find((e: SpellEffect) => e.type === 'DAMAGE') as DamageEffect | undefined;
    if (damageEffect && damageEffect.damage) {
      // Return formatted string like "1d10 Fire"
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
    <div>
      <h2 className="text-2xl text-sky-300 mb-4 text-center">Cleric Choices</h2>
      
      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-2">Choose Divine Order</h3>
        {divineOrders.map(order => (
          <button
            key={order.id}
            onClick={() => handleOrderSelect(order.id)}
            className={`w-full text-left p-3 mb-2 rounded-lg transition-colors border-2 ${
              selectedOrder === order.id ? 'bg-sky-700 border-sky-500 ring-2 ring-sky-400' : 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-sky-600'
            }`}
            aria-pressed={selectedOrder === order.id}
            aria-label={`Select divine order: ${order.name}`}
          >
            <h4 className="font-semibold">{order.name}</h4>
            <p className="text-sm text-gray-400">{order.description}</p>
          </button>
        ))}
      </div>

      {selectedOrder && (
        <>
          <div className="mb-6">
            <h3 className="text-xl text-amber-300 mb-2">Select {numCantripsToSelect} Cantrips</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableCantrips.map(spell => (
              <label key={spell.id} className={`p-2 rounded-md cursor-pointer transition-colors flex flex-col ${selectedCantripIds.has(spell.id) ? 'bg-sky-600 ring-1 ring-sky-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    className="mr-2 form-checkbox text-sky-500 bg-gray-800 border-gray-600 rounded focus:ring-sky-500" 
                    checked={selectedCantripIds.has(spell.id)} 
                    onChange={() => toggleSelection(spell.id, selectedCantripIds, setSelectedCantripIds, numCantripsToSelect)} 
                    disabled={!selectedCantripIds.has(spell.id) && selectedCantripIds.size >= numCantripsToSelect}
                    aria-label={`Select cantrip ${spell.name}`}
                  />
                  {spell.name}
                </div>
                {/* Display damage info if available (e.g. "1d10 Fire") */}
                {getSpellDamageInfo(spell) && (
                  <span className="text-xs text-red-300 ml-6">{getSpellDamageInfo(spell)}</span>
                )}
              </label>
            ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">Selected: {selectedCantripIds.size}/{numCantripsToSelect}</p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl text-amber-300 mb-2">Select {numSpellsL1ToSelect} Level 1 Spells</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableSpellsL1.map(spell => (
              <label key={spell.id} className={`p-2 rounded-md cursor-pointer transition-colors flex flex-col ${selectedSpellL1Ids.has(spell.id) ? 'bg-sky-600 ring-1 ring-sky-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    className="mr-2 form-checkbox text-sky-500 bg-gray-800 border-gray-600 rounded focus:ring-sky-500" 
                    checked={selectedSpellL1Ids.has(spell.id)} 
                    onChange={() => toggleSelection(spell.id, selectedSpellL1Ids, setSelectedSpellL1Ids, numSpellsL1ToSelect)} 
                    disabled={!selectedSpellL1Ids.has(spell.id) && selectedSpellL1Ids.size >= numSpellsL1ToSelect}
                    aria-label={`Select level 1 spell ${spell.name}`}
                  />
                  {spell.name}
                </div>
                {/* Display damage info if available (e.g. "3d8 Thunder") */}
                {getSpellDamageInfo(spell) && (
                  <span className="text-xs text-red-300 ml-6">{getSpellDamageInfo(spell)}</span>
                )}
              </label>
            ))}
            </div>
             <p className="text-xs text-gray-400 mt-1">Selected: {selectedSpellL1Ids.size}/{numSpellsL1ToSelect}</p>
          </div>
        </>
      )}

      <div className="flex gap-4 mt-6">
        <button onClick={onBack} className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow" aria-label="Go back to skill selection">Back</button>
        <button 
            onClick={handleSubmit} 
            disabled={isSubmitDisabled}
            className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow"
            aria-label="Confirm cleric choices"
        >
            Confirm Choices
        </button>
      </div>
    </div>
  );
};

export default ClericFeatureSelection;
