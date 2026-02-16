/**
 * @file WarlockFeatureSelection.tsx
 * This component allows a player who has chosen the Warlock class to select
 * their initial known cantrips and Level 1 spells. Patron selection happens at level 3.
 */
import React, { useState, useMemo } from 'react';
import { Spell, Class as CharClass, SpellEffect, DamageEffect } from '../../../types';
import { CreationStepLayout } from '../ui/CreationStepLayout';

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

  const getSpellDamageInfo = (spell: Spell): string | null => {
    if (!spell.effects) return null;
    const damageEffect = spell.effects.find((e: SpellEffect) => e.type === 'DAMAGE') as DamageEffect | undefined;
    if (damageEffect && damageEffect.damage) {
      return `${damageEffect.damage.dice} ${damageEffect.damage.type}`;
    }
    return null;
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
                    onChange={() => toggleSelection(spell.id, selectedCantripIds, setSelectedCantripIds, knownCantrips)} 
                    disabled={!selectedCantripIds.has(spell.id) && selectedCantripIds.size >= knownCantrips}
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
                    onChange={() => toggleSelection(spell.id, selectedSpellL1Ids, setSelectedSpellL1Ids, knownSpellsL1)} 
                    disabled={!selectedSpellL1Ids.has(spell.id) && selectedSpellL1Ids.size >= knownSpellsL1}
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
      </div>
    </CreationStepLayout>
  );
};

export default WarlockFeatureSelection;
