/**
 * @file ChangelingInstinctsSelection.tsx
 * This component is part of the character creation process for Changeling characters.
 * It allows the player to choose two skill proficiencies from a list of five options
 * for their "Changeling Instincts" racial trait.
 */
import React, { useState } from 'react';
import { Skill } from '../../../types';
import { SKILLS_DATA } from '../../../constants';

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
    <div>
      <h2 className="text-2xl text-sky-300 mb-4 text-center">Changeling Trait: Changeling Instincts</h2>
      <p className="text-sm text-gray-400 mb-6 text-center">
        Thanks to your connection to the fey realm, you gain proficiency with <span className="font-bold">two</span> of the following skills of your choice:
      </p>
      
      <div className="mb-6">
        <h3 className="text-xl text-amber-300 mb-3">Select Two Skill Proficiencies:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {skillOptions.map((skill) => (
            <label
              key={skill.id}
              className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                selectedSkillIds.has(skill.id)
                  ? 'bg-sky-600 ring-2 ring-sky-400'
                  : (!selectedSkillIds.has(skill.id) && selectedSkillIds.size >= MAX_SKILLS_TO_SELECT)
                  ? 'bg-gray-600 opacity-70 cursor-not-allowed'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedSkillIds.has(skill.id)}
                onChange={() => handleSkillToggle(skill.id)}
                disabled={!selectedSkillIds.has(skill.id) && selectedSkillIds.size >= MAX_SKILLS_TO_SELECT}
                className="form-checkbox h-5 w-5 text-sky-500 bg-gray-800 border-gray-600 rounded focus:ring-sky-500 mr-3 disabled:opacity-50"
                aria-label={`Select skill ${skill.name}`}
              />
              <span className="text-gray-200">
                {skill.name}
                <span className="text-xs text-gray-400 ml-1">({skill.ability.substring(0,3)})</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-sm text-gray-400 mt-4 text-center">
          Selected: {selectedSkillIds.size} / {MAX_SKILLS_TO_SELECT}
        </p>
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
          disabled={isSubmitDisabled}
          className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors"
          aria-label="Confirm Changeling Instincts skills"
        >
          Confirm Skills
        </button>
      </div>
    </div>
  );
};

export default ChangelingInstinctsSelection;