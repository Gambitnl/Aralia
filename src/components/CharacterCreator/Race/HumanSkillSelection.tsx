/**
 * @file HumanSkillSelection.tsx
 * This component allows a Human character to select one skill proficiency
 * from all available skills, as per their "Skillful" racial trait.
 */
import React, { useState } from 'react';
import { AbilityScores } from '../../../types'; 
import { SKILLS_DATA } from '../../../data/skills';
import { CreationStepLayout } from '../ui/CreationStepLayout';

interface HumanSkillSelectionProps {
  abilityScores: AbilityScores; 
  onSkillSelect: (skillId: string) => void;
  onBack: () => void;
}

const getAbilityModifier = (score: number): number => Math.floor((score - 10) / 2);

const HumanSkillSelection: React.FC<HumanSkillSelectionProps> = ({ abilityScores, onSkillSelect, onBack }) => {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const allSkills = Object.values(SKILLS_DATA);

  const handleSelect = (skillId: string) => {
    setSelectedSkillId(skillId);
  };

  const handleSubmit = () => {
    if (selectedSkillId) {
      onSkillSelect(selectedSkillId);
    }
  };

  return (
    <CreationStepLayout
      title="Human: Skillful"
      onBack={onBack}
      onNext={handleSubmit}
      canProceed={!!selectedSkillId}
      nextLabel="Confirm Skill"
    >
      <p className="text-sm text-gray-400 mb-6 text-center">
        As a Human, you gain proficiency in one additional skill of your choice.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {allSkills.map(skill => (
          <button
            key={skill.id}
            onClick={() => handleSelect(skill.id)}
            className={`w-full text-left p-4 rounded-xl transition-all border-2 ${
              selectedSkillId === skill.id
                ? 'bg-sky-900/40 border-sky-500 shadow-md'
                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
            }`}
            aria-pressed={selectedSkillId === skill.id}
          >
            <div className="flex flex-col">
              <span className="font-bold text-gray-100">{skill.name}</span>
              <div className="flex justify-between items-center mt-1">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">{skill.ability}</span>
                <span className={`text-xs font-bold ${getAbilityModifier(abilityScores[skill.ability]) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {getAbilityModifier(abilityScores[skill.ability]) >= 0 ? '+' : ''}{getAbilityModifier(abilityScores[skill.ability])}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </CreationStepLayout>
  );
};

export default HumanSkillSelection;
