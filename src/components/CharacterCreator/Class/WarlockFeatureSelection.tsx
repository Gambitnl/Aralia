/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Warlock Feature' selection (Otherworldly Patron,
 * Cantrips, and Level 1 Spells).
 *
 * WHEN the patron is chosen depends on the campaign's rules edition (agora-18ab):
 * the 2014 Player's Handbook picks an Otherworldly Patron at level 1, while the
 * 2024 one defers it to level 3. The level comes from `getSubclassLevel`, so this
 * component never decides the edition for itself — it is told.
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
import { Spell, Class as CharClass, WarlockPatronOption } from '../../../types';
import { getSubclassLevel, type RulesEdition } from '../../../config/rulesEdition';
import { CreationStepLayout } from '../ui/CreationStepLayout';
import { SpellCard } from './SpellCard';

interface WarlockFeatureSelectionProps {
  spellcastingInfo: NonNullable<CharClass['spellcasting']>;
  /** Every patron a warlock can swear to; only offered when the edition puts the choice at level 1. */
  patrons: WarlockPatronOption[];
  /** The campaign's rules edition, read by the caller via `getRulesEdition`. */
  rulesEdition: RulesEdition;
  allSpells: Record<string, Spell>;
  onWarlockFeaturesSelect: (cantrips: Spell[], spellsL1: Spell[], patronId?: string) => void;
  onBack: () => void;
}

const WarlockFeatureSelection: React.FC<WarlockFeatureSelectionProps> = ({
  spellcastingInfo,
  patrons,
  rulesEdition,
  allSpells,
  onWarlockFeaturesSelect,
  onBack,
}) => {
  const [selectedCantripIds, setSelectedCantripIds] = useState<Set<string>>(new Set());
  const [selectedSpellL1Ids, setSelectedSpellL1Ids] = useState<Set<string>>(new Set());
  const [selectedPatronId, setSelectedPatronId] = useState<string | null>(null);

  const { knownCantrips, knownSpellsL1, spellList } = spellcastingInfo;

  // The whole edition switch reduces to this one number. Level 1 means the
  // patron is part of this step; anything later means it is not.
  const patronLevel = getSubclassLevel('warlock', rulesEdition);
  const choosesPatronNow = patronLevel === 1 && patrons.length > 0;

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

  const isPatronSatisfied = !choosesPatronNow || selectedPatronId !== null;

  const handleSubmit = () => {
    if (selectedCantripIds.size === knownCantrips && selectedSpellL1Ids.size === knownSpellsL1 && isPatronSatisfied) {
      const cantrips = Array.from(selectedCantripIds).map(id => allSpells[String(id)]);
      const spellsL1 = Array.from(selectedSpellL1Ids).map(id => allSpells[String(id)]);
      onWarlockFeaturesSelect(cantrips, spellsL1, choosesPatronNow ? selectedPatronId! : undefined);
    }
  };

  const isSubmitDisabled =
    selectedCantripIds.size !== knownCantrips ||
    selectedSpellL1Ids.size !== knownSpellsL1 ||
    !isPatronSatisfied;

  return (
    <CreationStepLayout
      title={choosesPatronNow ? 'Warlock Patron & Spells' : 'Warlock Spell Selection'}
      onBack={onBack}
      onNext={handleSubmit}
      canProceed={!isSubmitDisabled}
      nextLabel="Confirm Spells"
    >
      <div className="space-y-8">
        {choosesPatronNow ? (
          <section>
            <div className="flex justify-between items-end mb-3 border-b border-gray-700 pb-1">
              <h3 className="text-xl font-cinzel text-amber-400">Choose Your Patron</h3>
              <span className="text-xs font-mono text-gray-500 mb-1">2014 rules &middot; level 1</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {patrons.map(patron => {
                const isSelected = selectedPatronId === patron.id;
                return (
                  <button
                    key={patron.id}
                    type="button"
                    onClick={() => setSelectedPatronId(patron.id)}
                    aria-pressed={isSelected}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-amber-900/40 border-amber-400'
                        : 'bg-gray-800 border-gray-700 hover:border-amber-600'
                    }`}
                  >
                    <span className="block font-cinzel text-amber-300">{patron.name}</span>
                    <span className="block text-xs text-gray-400 mt-1">{patron.description}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <p className="text-sm text-gray-400 italic">
            Under the 2024 rules you swear to an Otherworldly Patron at level {patronLevel}.
          </p>
        )}

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
