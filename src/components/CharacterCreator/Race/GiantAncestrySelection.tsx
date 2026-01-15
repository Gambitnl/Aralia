/**
 * @file GiantAncestrySelection.tsx
 * This component is part of the character creation process for Goliath characters.
 * It allows the player to choose their Giant Ancestry benefit.
 */
import React, { useState } from 'react';
import { GiantAncestryBenefit, GiantAncestryType } from '../../../types';
import { GIANT_ANCESTRIES as GIANT_ANCESTRIES_DATA } from '../../../constants';

interface GiantAncestrySelectionProps {
  onAncestrySelect: (ancestryBenefitId: GiantAncestryType) => void;
  onBack: () => void;
}

const GIANT_INFO: Record<GiantAncestryType, {
  color: string;
  borderColor: string;
  accentColor: string;
  tagline: string;
  icon: string;
}> = {
  Cloud: {
    color: 'text-sky-300',
    borderColor: 'border-sky-400/50',
    accentColor: 'bg-sky-400/20',
    tagline: 'Wreathed in mists and elusive as the wind',
    icon: '☁️',
  },
  Fire: {
    color: 'text-orange-500',
    borderColor: 'border-orange-500/50',
    accentColor: 'bg-orange-500/20',
    tagline: 'Born of the forge and the heart of the volcano',
    icon: '🔥',
  },
  Frost: {
    color: 'text-cyan-300',
    borderColor: 'border-cyan-400/50',
    accentColor: 'bg-cyan-400/20',
    tagline: 'Hardened by the absolute cold of eternal winters',
    icon: '❄️',
  },
  Hill: {
    color: 'text-lime-400',
    borderColor: 'border-lime-500/50',
    accentColor: 'bg-lime-500/20',
    tagline: 'Unstoppable force of nature with immense durability',
    icon: '🪨',
  },
  Stone: {
    color: 'text-slate-400',
    borderColor: 'border-slate-500/50',
    accentColor: 'bg-slate-500/20',
    tagline: 'Patient observers with the resilience of the earth',
    icon: '⛰️',
  },
  Storm: {
    color: 'text-indigo-400',
    borderColor: 'border-indigo-400/50',
    accentColor: 'bg-indigo-400/20',
    tagline: 'Keepers of the ancient patterns of the storm',
    icon: '⚡',
  },
};

const GiantAncestrySelection: React.FC<GiantAncestrySelectionProps> = ({ onAncestrySelect, onBack }) => {
  const [selectedBenefitId, setSelectedBenefitId] = useState<GiantAncestryType | null>(null);

  const handleSubmit = () => {
    if (selectedBenefitId) {
      onAncestrySelect(selectedBenefitId);
    }
  };

  const benefitOptions: GiantAncestryBenefit[] = GIANT_ANCESTRIES_DATA;

  return (
    <div className="max-w-4xl mx-auto py-4 px-2 h-full overflow-y-auto">
      <h2 className="text-2xl text-sky-300 mb-2 text-center">
        Choose Your Giant Ancestry
      </h2>
      <p className="text-gray-400 text-sm text-center mb-8">
        Your giant ancestry determines the specialized benefit you can use with your Stone's Endurance
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {benefitOptions.map((benefit) => {
          const info = GIANT_INFO[benefit.id as GiantAncestryType];
          const isSelected = selectedBenefitId === benefit.id;

          return (
            <button
              key={benefit.id}
              type="button"
              onClick={() => setSelectedBenefitId(benefit.id as GiantAncestryType)}
              className={`w-full text-left p-5 rounded-xl transition-all border-2 shadow-lg flex flex-col h-full ${isSelected
                  ? 'bg-sky-800/40 border-sky-400 ring-2 ring-sky-500 ring-opacity-50 scale-[1.02]'
                  : 'bg-gray-800/60 hover:bg-gray-700/80 border-gray-700 hover:border-gray-500'
                }`}
              aria-pressed={isSelected ? 'true' : 'false'}
            >
              <div className="flex justify-between items-start mb-1">
                <h4 className={`font-bold text-xl ${isSelected ? 'text-white' : info.color}`}>
                  {benefit.name}
                </h4>
                <span className="text-2xl">{info.icon}</span>
              </div>
              <p className="text-xs text-amber-400/80 mb-3 font-medium uppercase tracking-wider">
                {info.tagline}
              </p>

              <p className="text-sm text-gray-300 leading-relaxed">
                {benefit.description}
              </p>

              <div className="mt-4 pt-4 border-t border-gray-700/50">
                <div className={`text-[10px] uppercase font-bold tracking-widest mb-1 ${isSelected ? 'text-sky-300' : 'text-gray-500'}`}>
                  Specialized Reaction
                </div>
                <div className={`text-xs px-2 py-1.5 rounded ${isSelected
                    ? 'bg-sky-500/20 text-sky-100'
                    : `${info.accentColor} text-gray-300`
                  }`}>
                  Stone's Endurance Enhancement
                </div>
              </div>
            </button>
          );
        })}
      </div>

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
          disabled={!selectedBenefitId}
          className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:border-gray-800 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95"
        >
          Confirm Ancestry
        </button>
      </div>
    </div>
  );
};

export default GiantAncestrySelection;
