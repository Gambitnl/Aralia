/**
 * @file DruidFeatureSelection.tsx
 * This component allows a player who has chosen the Druid class to select
 * their Primal Order and their initial known cantrips and Level 1 spells.
 */
import React, { useState, useMemo } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { PrimalOrderOption, Spell, Class as CharClass, SpellEffect, DamageEffect } from '../../../types';
import Tooltip from '../../Tooltip';

interface DruidFeatureSelectionProps {
  primalOrders: PrimalOrderOption[];
  spellcastingInfo: NonNullable<CharClass['spellcasting']>;
  allSpells: Record<string, Spell>;
  onDruidFeaturesSelect: (order: 'Magician' | 'Warden', cantrips: Spell[], spellsL1: Spell[]) => void;
  onBack: () => void;
}

const containerMotion: MotionProps = {
  initial: { x: 300, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -300, opacity: 0 },
  transition: { duration: 0.3, ease: 'easeInOut' },
};

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

  const handleSubmit = () => {
    if (selectedOrder && selectedCantripIds.size === numCantripsToSelect && selectedSpellL1Ids.size === numSpellsL1ToSelect) {
      const cantrips = Array.from(selectedCantripIds).map(id => allSpells[String(id)]);
      // Manually add Speak with Animals to the list of prepared spells
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
    <motion.div
      key="druidFeatures"
      {...containerMotion}
    >
      <h2 className="text-2xl text-sky-300 mb-4 text-center">Druid Choices</h2>
      
      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-2">Choose Primal Order</h3>
        {primalOrders.map(order => (
          <button
            key={order.id}
            onClick={() => handleOrderSelect(order.id)}
            className={`w-full text-left p-3 mb-2 rounded-lg transition-colors border-2 ${selectedOrder === order.id ? 'bg-sky-700 border-sky-500 ring-2 ring-sky-400' : 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-sky-600'}`}
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
                    <input type="checkbox" className="mr-2 form-checkbox text-sky-500 bg-gray-800 border-gray-600 rounded focus:ring-sky-500"
                      checked={selectedCantripIds.has(spell.id)}
                      onChange={() => toggleSelection(spell.id, selectedCantripIds, setSelectedCantripIds, numCantripsToSelect)}
                      disabled={!selectedCantripIds.has(spell.id) && selectedCantripIds.size >= numCantripsToSelect}
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
              <label className="p-2 rounded-md cursor-default bg-gray-600/50 flex items-center opacity-70">
                  <input type="checkbox" className="mr-2 form-checkbox text-sky-500 bg-gray-800 border-gray-600 rounded" checked readOnly disabled />
                  Speak with Animals
                  <Tooltip content="Always prepared from the Druidic feature.">
                    <span className="ml-1 text-xs text-sky-300">(Class Feature)</span>
                  </Tooltip>
              </label>
              {availableSpellsL1.map(spell => (
                <label key={spell.id} className={`p-2 rounded-md cursor-pointer transition-colors flex flex-col ${selectedSpellL1Ids.has(spell.id) ? 'bg-sky-600 ring-1 ring-sky-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2 form-checkbox text-sky-500 bg-gray-800 border-gray-600 rounded focus:ring-sky-500"
                      checked={selectedSpellL1Ids.has(spell.id)}
                      onChange={() => toggleSelection(spell.id, selectedSpellL1Ids, setSelectedSpellL1Ids, numSpellsL1ToSelect)}
                      disabled={!selectedSpellL1Ids.has(spell.id) && selectedSpellL1Ids.size >= numSpellsL1ToSelect}
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
        <button onClick={onBack} className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow">Back</button>
        <button onClick={handleSubmit} disabled={isSubmitDisabled} className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow">
          Confirm Choices
        </button>
      </div>
    </motion.div>
  );
};

export default DruidFeatureSelection;
