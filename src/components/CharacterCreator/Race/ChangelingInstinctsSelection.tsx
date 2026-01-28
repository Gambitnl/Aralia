import React, { useState } from 'react';
import { Skill } from '../../../types';
import { SKILLS_DATA } from '../../../data/skills';
import { CreationStepLayout } from '../ui/CreationStepLayout';

interface ChangelingInstinctsSelectionProps {
  onSkillsSelect: (skillIds: string[]) => void;
  onBack: () => void;
}

const CHANGELING_INSTINCTS_SKILL_CHOICES_IDS: string[] = [
  'deception',
  'insight',
  'intimidation',
  'performance',
  'persuasion',
];

const MAX_SKILLS_TO_SELECT = 2;

const SKILL_INFO: Record<string, {
  color: string;
  tagline: string;
  icon: string;
}> = {
  deception: {
    color: 'text-purple-400',
    tagline: 'Masking your intentions with effortless lies',
    icon: '🎭',
  },
  insight: {
    color: 'text-sky-400',
    tagline: 'Seeing through the masks and lies of others',
    icon: '👁️',
  },
  intimidation: {
    color: 'text-red-500',
    tagline: 'Commanding presence that bends others to your will',
    icon: '👹',
  },
  performance: {
    color: 'text-amber-400',
    tagline: 'Captivating an audience with your fey charm',
    icon: '🎻',
  },
  persuasion: {
    color: 'text-blue-400',
    tagline: 'Influencing others with grace and diplomacy',
    icon: '🤝',
  },
};

const ChangelingInstinctsSelection: React.FC<ChangelingInstinctsSelectionProps> = ({ onSkillsSelect, onBack }) => {
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());

  const skillOptions: Skill[] = CHANGELING_INSTINCTS_SKILL_CHOICES_IDS.map(id => SKILLS_DATA[id]).filter(Boolean);

  const handleSkillToggle = (skillId: string) => {
    setSelectedSkillIds(prevSelectedIds => {
      const newSelectedIds = new Set(prevSelectedIds);
      if (newSelectedIds.has(skillId)) {
        newSelectedIds.delete(skillId);
      } else {
        if (newSelectedIds.size < MAX_SKILLS_TO_SELECT) {
          newSelectedIds.add(skillId);
        }
      }
      return newSelectedIds;
    });
  };

  const handleSubmit = () => {
    if (selectedSkillIds.size === MAX_SKILLS_TO_SELECT) {
      onSkillsSelect(Array.from(selectedSkillIds));
    }
  };

  const isSubmitDisabled = selectedSkillIds.size !== MAX_SKILLS_TO_SELECT;

  return (
    <CreationStepLayout
      title="Changeling Instincts"
      onBack={onBack}
      onNext={handleSubmit}
      canProceed={!isSubmitDisabled}
      nextLabel="Confirm Skills"
    >
      <div className="max-w-4xl mx-auto py-4 px-2">
        <p className="text-gray-400 text-sm text-center mb-8">
          Thanks to your fey heritage, you have an intuitive grasp of the social arts. Select <span className="font-bold text-sky-300">two</span> skill proficiencies.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {skillOptions.map((skill) => {
            const info = SKILL_INFO[skill.id];
            const isSelected = selectedSkillIds.has(skill.id);
            const isMaxReached = selectedSkillIds.size >= MAX_SKILLS_TO_SELECT;
            const isDisabled = !isSelected && isMaxReached;

            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => handleSkillToggle(skill.id)}
                disabled={isDisabled}
                className={`w-full text-left p-5 rounded-xl transition-all border-2 shadow-lg flex items-center gap-4 ${isSelected
                    ? 'bg-sky-800/40 border-sky-400 ring-2 ring-sky-500 ring-opacity-50 scale-[1.02]'
                    : isDisabled
                      ? 'bg-gray-800/30 border-gray-800 opacity-50 cursor-not-allowed'
                      : 'bg-gray-800/60 hover:bg-gray-700/80 border-gray-700 hover:border-gray-500'
                }`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl aspect-square ${isSelected ? 'bg-sky-400/20 shadow-inner' : 'bg-gray-700/50'
                  }`}>
                  {info?.icon || '📜'}
                </div>

                <div className="flex-grow">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-bold text-lg ${isSelected ? 'text-white' : info?.color || 'text-amber-400'}`}>
                      {skill.name}
                    </h4>
                    {isSelected && (
                      <span className="text-sky-400 animate-in zoom-in duration-200">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {info?.tagline}
                  </p>
                </div>

                <div className="text-[10px] bg-gray-900/50 px-1.5 py-0.5 rounded border border-gray-700/50 text-gray-400 uppercase font-mono">
                  {skill.ability.substring(0, 3)}
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 bg-gray-900/60 px-6 py-2 rounded-full border border-gray-700">
            <span className="text-sm text-gray-400">Selections Remaining:</span>
            <span className={`text-lg font-bold ${selectedSkillIds.size === MAX_SKILLS_TO_SELECT ? 'text-green-400' : 'text-amber-400'}`}>
              {MAX_SKILLS_TO_SELECT - selectedSkillIds.size}
            </span>
            <div className="flex gap-1 ml-2">
              {[...Array(MAX_SKILLS_TO_SELECT)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full border transition-colors ${i < selectedSkillIds.size ? 'bg-sky-400 border-sky-300' : 'bg-gray-800 border-gray-600'
                    }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </CreationStepLayout>
  );
};

export default ChangelingInstinctsSelection;
