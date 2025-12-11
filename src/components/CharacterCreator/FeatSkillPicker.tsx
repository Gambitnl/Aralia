/**
 * @file FeatSkillPicker.tsx
 * Component to select skills granted by a feat.
 */
import React from 'react';
import { SKILLS_DATA } from '../../constants';

interface FeatSkillPickerProps {
  knownSkillIds: Set<string>;
  maxSelections: number;
  selectedSkillIds: string[];
  onSelectionChange: (skillIds: string[]) => void;
}

const FeatSkillPicker: React.FC<FeatSkillPickerProps> = ({
  knownSkillIds,
  maxSelections,
  selectedSkillIds,
  onSelectionChange,
}) => {
  const allSkills = Object.values(SKILLS_DATA);
  const availableSkills = allSkills.filter(skill => !knownSkillIds.has(skill.id));

  const handleToggle = (skillId: string) => {
    if (selectedSkillIds.includes(skillId)) {
      onSelectionChange(selectedSkillIds.filter(id => id !== skillId));
    } else {
      if (selectedSkillIds.length < maxSelections) {
        onSelectionChange([...selectedSkillIds, skillId]);
      }
    }
  };

  return (
    <div className="mt-4">
      <h4 className="text-amber-300 font-medium mb-2">
        Select {maxSelections} Skills:
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-2">
        {availableSkills.map(skill => {
            const isSelected = selectedSkillIds.includes(skill.id);
            const isDisabled = !isSelected && selectedSkillIds.length >= maxSelections;

            return (
                <div
                    key={skill.id}
                    onClick={() => !isDisabled && handleToggle(skill.id)}
                    className={`
                        p-2 rounded border cursor-pointer flex justify-between items-center transition-colors
                        ${isSelected
                            ? 'bg-amber-900/40 border-amber-500 text-amber-100'
                            : isDisabled
                                ? 'bg-gray-800/50 border-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                        }
                    `}
                >
                    <span className="text-sm font-medium">{skill.name}</span>
                    <span className="text-xs text-gray-400">({skill.ability.substring(0,3)})</span>
                </div>
            );
        })}
      </div>
      <p className="text-xs text-right mt-1 text-gray-400">
        {selectedSkillIds.length} / {maxSelections} selected
      </p>
    </div>
  );
};

export default FeatSkillPicker;
