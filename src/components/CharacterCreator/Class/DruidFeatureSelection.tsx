/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Druid Feature' selection (Primal Order,
 * Cantrips, and Level 1 Spells).
 *
 * Under the 2014 PHB it also holds the level 2 step: the player picks a Druid
 * Circle here (Remy, Agora 8335; agora-f821.58). Under 2024 the circle waits
 * for level 3 and the LevelUpModal offers it.
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
import { choosesSubclassInCreator, getSubclassLevel, type RulesEdition } from '../../../config/rulesEdition';
import _Tooltip from '../../Tooltip';
import { CreationStepLayout } from '../ui/CreationStepLayout';
import { SpellCard } from './SpellCard';
// GG-378: shared button style and control roles.
import { BTN_FOCUS_VISIBLE } from '../../../styles/buttonStyles';
import { SubclassChoiceSection, type SubclassChoiceOption } from './SubclassChoiceSection';

interface DruidFeatureSelectionProps {
  primalOrders: PrimalOrderOption[];
  /**
   * Every Druid Circle (agora-f821.58). Offered only when the rules edition
   * puts the circle at level 2 (2014 PHB): Remy ruled that the creator then
   * gets a level 2 step (Agora 8335). Optional so older callers still render.
   */
  circles?: SubclassChoiceOption[];
  /** The campaign's rules edition, read by the caller via `getRulesEdition`. */
  rulesEdition?: RulesEdition;
  spellcastingInfo: NonNullable<CharClass['spellcasting']>;
  allSpells: Record<string, Spell>;
  onDruidFeaturesSelect: (order: 'Magician' | 'Warden', cantrips: Spell[], spellsL1: Spell[], circleId?: string) => void;
  onBack: () => void;
}

const DruidFeatureSelection: React.FC<DruidFeatureSelectionProps> = ({
  primalOrders,
  circles = [],
  rulesEdition = '2024',
  spellcastingInfo,
  allSpells,
  onDruidFeaturesSelect,
  onBack,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<'Magician' | 'Warden' | null>(null);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);

  // agora-f821.58: the edition decides whether the circle is part of creation.
  const circleLevel = getSubclassLevel('druid', rulesEdition);
  const choosesCircleNow = choosesSubclassInCreator('druid', rulesEdition) && circles.length > 0;
  const isCircleSatisfied = !choosesCircleNow || selectedCircleId !== null;
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
    if (selectedOrder && selectedCantripIds.size === numCantripsToSelect && selectedSpellL1Ids.size === numSpellsL1ToSelect && isCircleSatisfied) {
      const cantrips = Array.from(selectedCantripIds).map(id => allSpells[String(id)]);
      const speakWithAnimalsSpell = allSpells['speak-with-animals'];
      const spellsL1 = Array.from(selectedSpellL1Ids).map(id => allSpells[String(id)]);
      if(speakWithAnimalsSpell) {
        spellsL1.push(speakWithAnimalsSpell);
      }
      onDruidFeaturesSelect(selectedOrder, cantrips, spellsL1, choosesCircleNow ? selectedCircleId! : undefined);
    }
  };

  const isSubmitDisabled = !selectedOrder || selectedCantripIds.size !== numCantripsToSelect || selectedSpellL1Ids.size !== numSpellsL1ToSelect || !isCircleSatisfied;

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
                className={`${BTN_FOCUS_VISIBLE} text-left p-4 rounded-xl transition-all border-2 ${
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
                {allSpells['speak-with-animals'] && (
                  <div className="relative group">
                    <div className="absolute inset-0 z-10 cursor-not-allowed"></div>
                    <SpellCard
                      spell={allSpells['speak-with-animals']}
                      selected={true}
                      disabled={false}
                      onToggle={() => {}}
                      idPrefix="spell1-feature"
                      className="opacity-70 grayscale-[20%]"
                    />
                    <div className="absolute -top-2 right-2 px-1.5 py-0.5 bg-amber-600/90 text-amber-100 text-[9px] uppercase font-bold rounded shadow-md pointer-events-none z-20 border border-amber-500/50">
                      Class Feature
                    </div>
                  </div>
                )}
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

        {choosesCircleNow ? (
          <SubclassChoiceSection
            subclassLabel="Druid Circle"
            level={circleLevel}
            options={circles}
            selectedId={selectedCircleId}
            onSelect={setSelectedCircleId}
          />
        ) : (
          <p className="text-sm text-gray-400 italic">
            You choose a Druid Circle at level {circleLevel}.
          </p>
        )}
      </div>
    </CreationStepLayout>
  );
};

export default DruidFeatureSelection;
