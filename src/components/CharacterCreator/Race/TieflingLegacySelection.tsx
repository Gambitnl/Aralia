/**
 * @file TieflingLegacySelection.tsx
 * This component is part of the character creation process for Tiefling characters.
 * It allows the player to choose their Fiendish Legacy (Abyssal, Chthonic, or Infernal)
 * and the spellcasting ability for spells granted by that legacy and Otherworldly Presence.
 */
import React, { useState, useContext } from 'react';
import { FiendishLegacy, FiendishLegacyType, AbilityScoreName } from '../../../types';
import { RELEVANT_SPELLCASTING_ABILITIES, TIEFLING_LEGACIES } from '../../../constants';
import SpellContext from '../../../context/SpellContext';

interface TieflingLegacySelectionProps {
  onLegacySelect: (legacyId: FiendishLegacyType, spellcastingAbility: AbilityScoreName) => void;
  onBack: () => void;
}

const LEGACY_INFO: Record<FiendishLegacyType, {
  color: string;
  bgColor: string;
  borderColor: string;
  accentColor: string;
  tagline: string;
  icon: string;
}> = {
  abyssal: {
    color: 'text-red-500',
    bgColor: 'bg-red-900/30',
    borderColor: 'border-red-500/50',
    accentColor: 'bg-red-500/20',
    tagline: 'Spawn of the chaotic and infinite Abyss',
    icon: '🌪️',
  },
  chthonic: {
    color: 'text-slate-500',
    bgColor: 'bg-slate-900/30',
    borderColor: 'border-slate-500/50',
    accentColor: 'bg-slate-500/20',
    tagline: 'Children of the lightless, echoing Underworld',
    icon: '🌑',
  },
  infernal: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-900/30',
    borderColor: 'border-orange-500/50',
    accentColor: 'bg-orange-500/20',
    tagline: 'Heirs to the lawful tyranny of the Nine Hells',
    icon: '🔥',
  },
};

const TieflingLegacySelection: React.FC<TieflingLegacySelectionProps> = ({ onLegacySelect, onBack }) => {
  const [selectedLegacyId, setSelectedLegacyId] = useState<FiendishLegacyType | null>(null);
  const [selectedSpellcastingAbility, setSelectedSpellcastingAbility] = useState<AbilityScoreName | null>(null);
  const allSpells = useContext(SpellContext);

  const legacyOptions: FiendishLegacy[] = TIEFLING_LEGACIES;

  const handleSubmit = () => {
    if (selectedLegacyId && selectedSpellcastingAbility) {
      onLegacySelect(selectedLegacyId, selectedSpellcastingAbility);
    }
  };

  if (!allSpells) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4 px-2 h-full overflow-y-auto">
      <h2 className="text-2xl text-sky-300 mb-2 text-center">Choose Your Fiendish Legacy</h2>
      <p className="text-gray-400 text-sm text-center mb-8">
        Your legacy manifests through your resistance and the dark magic woven into your blood
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {legacyOptions.map((legacy) => {
          const info = LEGACY_INFO[legacy.id as FiendishLegacyType];
          const isSelected = selectedLegacyId === legacy.id;

          return (
            <button
              key={legacy.id}
              type="button"
              onClick={() => {
                setSelectedLegacyId(legacy.id as FiendishLegacyType);
                if (!selectedSpellcastingAbility) {
                  setSelectedSpellcastingAbility('Charisma'); // Sensible default for Tieflings
                }
              }}
              className={`w-full text-left p-5 rounded-xl transition-all border-2 shadow-lg flex flex-col h-full ${isSelected
                  ? 'bg-sky-800/40 border-sky-400 ring-2 ring-sky-500 ring-opacity-50 scale-[1.02]'
                  : 'bg-gray-800/60 hover:bg-gray-700/80 border-gray-700 hover:border-gray-500'
                }`}
              aria-pressed={isSelected ? 'true' : 'false'}
            >
              <div className="flex justify-between items-start mb-1">
                <h4 className={`font-bold text-xl ${isSelected ? 'text-white' : info.color}`}>
                  {legacy.name}
                </h4>
                <span className="text-2xl">{info.icon}</span>
              </div>
              <p className="text-xs text-amber-400/80 mb-3 font-medium uppercase tracking-wider">
                {info.tagline}
              </p>

              <p className="text-sm text-gray-300 mb-4 flex-grow leading-relaxed">
                {legacy.description}
              </p>

              <div className="mt-auto pt-4 border-t border-gray-700/50 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-gray-500">Resistance:</span>
                  <span className={`text-xs font-semibold ${isSelected ? 'text-sky-300' : info.color}`}>
                    {legacy.level1Benefit.resistanceType}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Blood Magic:</span>
                  <div className={`text-[11px] px-2 py-1 rounded bg-black/30 border border-gray-700/50 text-gray-200`}>
                    <span className="text-amber-400">❶</span> {allSpells[legacy.level1Benefit.cantripId]?.name || 'Cantrip'}
                  </div>
                  <div className={`text-[11px] px-2 py-1 rounded bg-black/30 border border-gray-700/50 text-gray-400`}>
                    <span className="text-amber-600">❸</span> {allSpells[legacy.level3SpellId]?.name || 'Spell'}
                  </div>
                  <div className={`text-[11px] px-2 py-1 rounded bg-black/30 border border-gray-700/50 text-gray-500`}>
                    <span className="text-amber-800">❺</span> {allSpells[legacy.level5SpellId]?.name || 'Spell'}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedLegacyId && (
        <div className="mb-8 p-6 bg-gray-800/40 border border-gray-700 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h3 className="text-lg font-semibold text-amber-300 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Spellcasting Ability
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Which ability scores do you use for your legacy spells and Otherworldly Presence?
          </p>
          <div className="flex flex-wrap gap-3">
            {RELEVANT_SPELLCASTING_ABILITIES.map((ability) => (
              <button
                key={ability}
                type="button"
                onClick={() => setSelectedSpellcastingAbility(ability)}
                className={`px-6 py-2.5 rounded-lg font-medium transition-all border-2 ${selectedSpellcastingAbility === ability
                    ? 'bg-sky-600 border-sky-400 text-white shadow-lg shadow-sky-900/40'
                    : 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300 active:scale-95'
                  }`}
                aria-pressed={selectedSpellcastingAbility === ability ? 'true' : 'false'}
              >
                {ability}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 max-w-md mx-auto mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold py-3 px-6 rounded-xl border border-gray-600 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedLegacyId || !selectedSpellcastingAbility}
          className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:border-gray-800 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95"
        >
          Confirm Legacy
        </button>
      </div>
    </div>
  );
};

export default TieflingLegacySelection;