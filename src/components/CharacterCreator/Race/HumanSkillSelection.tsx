/**
 * @file HumanSkillSelection.tsx
 * This component allows a Human character to select one skill proficiency
 * from all available skills, as per their "Skillful" racial trait.
 */
import React, { useState } from 'react';
import { Skill, AbilityScores } from '../../../types'; // Path relative to src/components/CharacterCreator/Human/
import { SKILLS_DATA } from '../../../constants'; // Path relative to src/components/CharacterCreator/Human/

interface HumanSkillSelectionProps {
  abilityScores: AbilityScores; // For displaying modifiers
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
    <div>
      <h2 className="text-2xl text-sky-300 mb-2 text-center">Human Trait: Skillful</h2>
      <p className="text-sm text-gray-400 mb-6 text-center">
        As a Human, you gain proficiency in one skill of your choice.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 max-h-96 overflow-y-auto scrollable-content pr-2">
        {allSkills.map(skill => (
          <button
            key={skill.id}
            onClick={() => handleSelect(skill.id)}
            className={`w-full text-left p-3 rounded-lg transition-colors border-2 ${
              selectedSkillId === skill.id
                ? 'bg-sky-700 border-sky-500 ring-2 ring-sky-400'
                : 'bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-sky-600'
            }`}
            aria-pressed={selectedSkillId === skill.id}
            aria-label={`Select skill: ${skill.name}`}
          >
            <span className="text-gray-200">
              {skill.name} <span className="text-xs text-gray-400">({skill.ability.substring(0, 3)})</span>
              <span className="ml-1 text-xs text-green-400">(Mod: {getAbilityModifier(abilityScores[skill.ability]) >= 0 ? '+' : ''}{getAbilityModifier(abilityScores[skill.ability])})</span>
            </span>
          </button>
        ))}
      </div>
       {selectedSkillId && SKILLS_DATA[selectedSkillId] && (
        <p className="text-sm text-amber-300 mb-4 text-center">Selected: {SKILLS_DATA[selectedSkillId].name}</p>
      )}

      <div className="flex gap-4 mt-6">
        <button
          onClick={onBack}
          className="w-1/2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors"
          aria-label="Go back to previous step"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedSkillId}
          className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors"
          aria-label="Confirm selected skill"
        >
          Confirm Skill
        </button>
      </div>
    </div>
  );
};

export default HumanSkillSelection;
