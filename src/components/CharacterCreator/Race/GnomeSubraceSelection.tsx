/**
 * @file GnomeSubraceSelection.tsx
 * This component is part of the character creation process for Gnome characters.
 * It allows the player to choose their Gnome Subrace (Forest, Rock, or Deep Gnome)
 * and the spellcasting ability for spells granted by that subrace.
 */
import React, { useState, useContext } from 'react';
import { GnomeSubrace, GnomeSubraceType, AbilityScoreName } from '../../../types';
import { RELEVANT_SPELLCASTING_ABILITIES } from '../../../constants';
import SpellContext from '../../../context/SpellContext';

interface GnomeSubraceSelectionProps {
  subraces: GnomeSubrace[];
  onSubraceSelect: (
    subraceId: GnomeSubraceType,
    spellcastingAbility: AbilityScoreName,
  ) => void;
  onBack: () => void;
}

const GNOME_INFO: Record<GnomeSubraceType, {
  color: string;
  bgColor: string;
  borderColor: string;
  accentColor: string;
  tagline: string;
  icon: string;
}> = {
  forest_gnome: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-900/30',
    borderColor: 'border-emerald-500/50',
    accentColor: 'bg-emerald-500/20',
    tagline: 'Cunning illusionists in harmony with woodland life',
    icon: '🍃',
  },
  rock_gnome: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-900/30',
    borderColor: 'border-amber-500/50',
    accentColor: 'bg-amber-500/20',
    tagline: 'Master tinkerers and tenacious inventors',
    icon: '⚙️',
  },
  deep_gnome: {
    color: 'text-slate-400',
    bgColor: 'bg-slate-900/30',
    borderColor: 'border-slate-500/50',
    accentColor: 'bg-slate-500/20',
    tagline: 'Resilient survivors of the lightless Underdark',
    icon: '💎',
  },
};

const GnomeSubraceSelection: React.FC<GnomeSubraceSelectionProps> = ({
  subraces,
  onSubraceSelect,
  onBack,
}) => {
  const [selectedSubraceId, setSelectedSubraceId] = useState<GnomeSubraceType | null>(null);
  const [selectedSpellcastingAbility, setSelectedSpellcastingAbility] = useState<AbilityScoreName | null>(null);

  const allSpells = useContext(SpellContext);

  const selectedSubraceDetails = selectedSubraceId
    ? subraces.find((sr) => sr.id === selectedSubraceId)
    : null;

  const needsSpellcastingAbilityChoice = !!(
    selectedSubraceDetails &&
    (selectedSubraceDetails.grantedCantrip || selectedSubraceDetails.grantedSpell)
  );

  const handleSubmit = () => {
    if (selectedSubraceId) {
      if (needsSpellcastingAbilityChoice && selectedSpellcastingAbility) {
        onSubraceSelect(selectedSubraceId, selectedSpellcastingAbility);
      } else if (!needsSpellcastingAbilityChoice) {
        onSubraceSelect(
          selectedSubraceId,
          selectedSpellcastingAbility || 'Intelligence',
        );
      }
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
      <h2 className="text-2xl text-sky-300 mb-2 text-center">
        Choose Your Gnome Subrace
      </h2>
      <p className="text-gray-400 text-sm text-center mb-8">
        Your subrace defines your cultural heritage and innate technical or magical talents
      </p>

      {/* Subrace Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {subraces.map((subrace) => {
          const info = GNOME_INFO[subrace.id as GnomeSubraceType];
          const isSelected = selectedSubraceId === subrace.id;

          return (
            <button
              key={subrace.id}
              type="button"
              onClick={() => {
                setSelectedSubraceId(subrace.id as GnomeSubraceType);
                if (!(subrace.grantedCantrip || subrace.grantedSpell)) {
                  setSelectedSpellcastingAbility(null);
                } else if (!selectedSpellcastingAbility) {
                  setSelectedSpellcastingAbility('Intelligence');
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
                  {subrace.name}
                </h4>
                <span className="text-2xl">{info.icon}</span>
              </div>
              <p className="text-xs text-amber-400/80 mb-3 font-medium uppercase tracking-wider">
                {info.tagline}
              </p>

              <p className="text-sm text-gray-300 mb-4 line-clamp-4 leading-relaxed">
                {subrace.description}
              </p>

              <div className="mt-auto space-y-2">
                {subrace.traits.map((trait, idx) => (
                  <div
                    key={idx}
                    className={`text-xs px-2 py-1 rounded border ${isSelected
                        ? 'bg-sky-500/20 border-sky-400/30 text-sky-100'
                        : `${info.accentColor} ${info.borderColor.replace('/50', '/30')} text-gray-300`
                      }`}
                  >
                    {trait}
                  </div>
                ))}
                {(subrace.grantedCantrip || subrace.grantedSpell) && (
                  <div className={`text-xs px-2 py-1.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200`}>
                    <span className="font-semibold">Magecraft:</span>{' '}
                    {subrace.grantedCantrip && allSpells[subrace.grantedCantrip.id]?.name}
                    {subrace.grantedCantrip && subrace.grantedSpell && ', '}
                    {subrace.grantedSpell && allSpells[subrace.grantedSpell.id]?.name}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Spellcasting Ability Selection */}
      {selectedSubraceId && needsSpellcastingAbilityChoice && (
        <div className="mb-8 p-6 bg-gray-800/40 border border-gray-700 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h3 className="text-lg font-semibold text-amber-300 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Spellcasting Ability
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Select the ability score used for your innate gnome magic:
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
          disabled={
            !selectedSubraceId ||
            (needsSpellcastingAbilityChoice && !selectedSpellcastingAbility)
          }
          className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:border-gray-800 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95"
        >
          Confirm Subrace
        </button>
      </div>
    </div>
  );
};

export default GnomeSubraceSelection;
