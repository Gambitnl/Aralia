/**
 * @file ElvenLineageSelection.tsx
 * This component is part of the character creation process for Elf characters.
 * It allows the player to choose their Elven Lineage (Drow, High Elf, or Wood Elf)
 * and the spellcasting ability for spells granted by that lineage.
 */
import React, { useState } from 'react';
import { ElvenLineage, ElvenLineageType, AbilityScoreName } from '../../../types';
import { RELEVANT_SPELLCASTING_ABILITIES } from '../../../constants';

interface ElvenLineageSelectionProps {
  lineages: ElvenLineage[];
  onLineageSelect: (
    lineageId: ElvenLineageType,
    spellcastingAbility: AbilityScoreName,
  ) => void;
  onBack: () => void;
}

const LINEAGE_INFO: Record<ElvenLineageType, {
  color: string;
  bgColor: string;
  borderColor: string;
  accentColor: string;
  tagline: string;
}> = {
  drow: {
    color: 'text-purple-400',
    bgColor: 'bg-indigo-900/30',
    borderColor: 'border-indigo-500/50',
    accentColor: 'bg-indigo-500/20',
    tagline: 'Dwellers of the Underdark with innate magical darkness',
  },
  high_elf: {
    color: 'text-sky-400',
    bgColor: 'bg-sky-900/30',
    borderColor: 'border-sky-500/50',
    accentColor: 'bg-sky-500/20',
    tagline: 'Scholarly aristocrats with a focus on arcane study',
  },
  wood_elf: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-900/30',
    borderColor: 'border-emerald-500/50',
    accentColor: 'bg-emerald-500/20',
    tagline: 'Keen-eyed guardians of the deep forests',
  },
};

const ElvenLineageSelection: React.FC<ElvenLineageSelectionProps> = ({
  lineages,
  onLineageSelect,
  onBack,
}) => {
  const [selectedLineageId, setSelectedLineageId] = useState<ElvenLineageType | null>(null);
  const [selectedSpellcastingAbility, setSelectedSpellcastingAbility] = useState<AbilityScoreName | null>(null);

  const handleSubmit = () => {
    if (selectedLineageId && selectedSpellcastingAbility) {
      onLineageSelect(selectedLineageId, selectedSpellcastingAbility);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-2 h-full overflow-y-auto">
      <h2 className="text-2xl text-sky-300 mb-2 text-center">
        Choose Your Elven Lineage
      </h2>
      <p className="text-gray-400 text-sm text-center mb-8">
        Your lineage reflects your ancestry and grants specific magical traits
      </p>

      {/* Lineage Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {lineages.map((lineage) => {
          const info = LINEAGE_INFO[lineage.id as ElvenLineageType];
          const isSelected = selectedLineageId === lineage.id;

          return (
            <button
              key={lineage.id}
              type="button"
              onClick={() => setSelectedLineageId(lineage.id as ElvenLineageType)}
              className={`w-full text-left p-5 rounded-xl transition-all border-2 shadow-lg flex flex-col h-full ${isSelected
                  ? `bg-sky-800/40 border-sky-400 ring-2 ring-sky-500 ring-opacity-50 scale-[1.02]`
                  : `bg-gray-800/60 hover:bg-gray-700/80 border-gray-700 hover:border-gray-500`
                }`}
              aria-pressed={isSelected ? 'true' : 'false'}
            >
              <h4 className={`font-bold text-xl mb-1 ${isSelected ? 'text-white' : info.color}`}>
                {lineage.name}
              </h4>
              <p className="text-xs text-amber-400/80 mb-3 font-medium uppercase tracking-wider">
                {info.tagline}
              </p>

              <p className="text-sm text-gray-300 mb-4 line-clamp-3">
                {lineage.description}
              </p>

              <div className="mt-auto space-y-2">
                {lineage.benefits
                  .filter((b) => b.level === 1)
                  .map((benefit, idx) => (
                    <div
                      key={idx}
                      className={`text-xs px-2 py-1.5 rounded border ${isSelected
                          ? 'bg-sky-500/20 border-sky-400/30 text-sky-100'
                          : `${info.accentColor} ${info.borderColor.replace('/50', '/30')} text-gray-200`
                        }`}
                    >
                      {benefit.description}
                      {benefit.cantripId && (
                        <span className="block mt-1 font-semibold text-amber-300">
                          ✦ {benefit.cantripId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Spellcasting Ability Selection */}
      {selectedLineageId && (
        <div className="mb-8 p-6 bg-gray-800/40 border border-gray-700 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h3 className="text-lg font-semibold text-amber-300 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Spellcasting Ability
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Select the ability score you will use for your lineage's innate magic:
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
          disabled={!selectedLineageId || !selectedSpellcastingAbility}
          className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:border-gray-800 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95"
        >
          Confirm Lineage
        </button>
      </div>
    </div>
  );
};

export default ElvenLineageSelection;