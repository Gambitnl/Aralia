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

const CentaurNaturalAffinitySkillSelection: React.FC<CentaurNaturalAffinitySkillSelectionProps> = ({ onSkillSelect, onBack }) => {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const skillOptions: Skill[] = NATURAL_AFFINITY_SKILL_CHOICES_IDS.map(id => SKILLS_DATA[id]).filter(Boolean);

  const handleSubmit = () => {
    if (selectedSkillId) {
      onSkillSelect(selectedSkillId);
    }
  };

  return (
    <div>
      <h2 className="text-2xl text-sky-300 mb-4 text-center">Centaur Trait: Natural Affinity</h2>
      <p className="text-sm text-gray-400 mb-6 text-center">
        Your fey connection to nature gives you an intuitive connection to the natural world and the animals within it. Choose one skill proficiency:
      </p>
      
      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-3">Select Skill Proficiency:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {skillOptions.map((skill) => (
            <button
              key={skill.id}
              onClick={() => setSelectedSkillId(skill.id)}
              className={`w-full text-left p-4 rounded-lg transition-colors border-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-opacity-75 ${
                selectedSkillId === skill.id
                  ? 'bg-sky-700 border-sky-500 ring-sky-500 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-sky-600 text-gray-300 ring-transparent'
              }`}
              aria-pressed={selectedSkillId === skill.id}
              aria-label={`Select ${skill.name} skill`}
            >
              <span className="text-lg font-semibold">{skill.name}</span>
              <span className="text-xs text-gray-400 ml-1">({skill.ability.substring(0,3)})</span>
            </button>
          ))}
        </div>
         {selectedSkillId && SKILLS_DATA[selectedSkillId] && <p className="text-sm text-gray-400 mt-4 text-center">Selected: {SKILLS_DATA[selectedSkillId].name}</p>}
      </div>
      
      <div className="flex gap-4 mt-8">
        <button
          onClick={onBack}
          className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
          aria-label="Go back to race selection"
        >
          Back to Race
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedSkillId}
          className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
          aria-label="Confirm Natural Affinity skill"
        >
          Confirm Skill
        </button>
      </div>
    </div>
  );
};

export default CentaurNaturalAffinitySkillSelection;