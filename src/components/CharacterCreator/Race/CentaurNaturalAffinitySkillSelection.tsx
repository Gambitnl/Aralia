/**
 * @file CentaurNaturalAffinitySkillSelection.tsx
 * This component is part of the character creation process for Centaur characters.
 * It allows the player to choose their Natural Affinity skill proficiency.
 */
import React, { useState } from 'react';
import { Skill } from '../../../types';
import { SKILLS_DATA } from '../../../data/skills';

interface CentaurNaturalAffinitySkillSelectionProps {
  onSkillSelect: (skillId: string) => void;
  onBack: () => void;
}

const NATURAL_AFFINITY_SKILL_CHOICES_IDS: string[] = ['animal_handling', 'medicine', 'nature', 'survival'];

const SKILL_INFO: Record<string, {
  color: string;
  tagline: string;
  icon: string;
}> = {
  animal_handling: {
    color: 'text-emerald-400',
    tagline: 'Empathy with the beasts of field and forest',
    icon: '🐾',
  },
  medicine: {
    color: 'text-rose-400',
    tagline: 'Traditional healing and anatomical knowledge',
    icon: '🩹',
  },
  nature: {
    color: 'text-green-400',
    tagline: 'Innate lore of plants, animals, and cycles',
    icon: '🌿',
  },
  survival: {
    color: 'text-amber-500',
    tagline: 'Tracking and navigating the untamed wilds',
    icon: '⛺',
  },
};

const CentaurNaturalAffinitySkillSelection: React.FC<CentaurNaturalAffinitySkillSelectionProps> = ({ onSkillSelect, onBack }) => {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const skillOptions: Skill[] = NATURAL_AFFINITY_SKILL_CHOICES_IDS.map(id => SKILLS_DATA[id]).filter(Boolean);

  const handleSubmit = () => {
    if (selectedSkillId) {
      onSkillSelect(selectedSkillId);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-2 h-full overflow-y-auto">
      <h2 className="text-2xl text-sky-300 mb-2 text-center">Natural Affinity</h2>
      <p className="text-gray-400 text-sm text-center mb-10">
        Your fey connection to nature gives you an intuitive bond with the natural world. Choose a specialized skill.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
        {skillOptions.map((skill) => {
          const info = SKILL_INFO[skill.id];
          const isSelected = selectedSkillId === skill.id;

          return (
            <button
              key={skill.id}
              type="button"
              onClick={() => setSelectedSkillId(skill.id)}
              className={`w-full text-left p-6 rounded-2xl transition-all border-2 shadow-lg flex items-center gap-5 ${isSelected
                  ? 'bg-sky-800/40 border-sky-400 ring-2 ring-sky-500 ring-opacity-50 scale-[1.03]'
                  : 'bg-gray-800/60 hover:bg-gray-700/80 border-gray-700 hover:border-gray-500'
                }`}
              aria-pressed={isSelected ? 'true' : 'false'}
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl aspect-square ${isSelected ? 'bg-sky-400/20 shadow-inner shadow-sky-400/20' : 'bg-gray-700/50'
                }`}>
                {info?.icon || '📜'}
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-2">
                  <h4 className={`font-bold text-xl ${isSelected ? 'text-white' : info?.color || 'text-amber-400'}`}>
                    {skill.name}
                  </h4>
                  <span className="text-[10px] bg-gray-900/50 px-1.5 py-0.5 rounded border border-gray-700/50 text-gray-400 uppercase">
                    {skill.ability.substring(0, 3)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 italic">
                  {info?.tagline}
                </p>
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
          disabled={!selectedSkillId}
          className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:border-gray-800 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95"
        >
          Confirm Skill
        </button>
      </div>
    </div>
  );
};

export default CentaurNaturalAffinitySkillSelection;