/**
 * @file SkillSelection.tsx
 * This component allows the player to select a number of skill proficiencies
 * for their character from a list available to their chosen class.
 * For Elves, it also handles the "Keen Senses" skill choice.
 * It now prevents selecting class skills already granted by Human, Elf, Bugbear, Centaur or Changeling racial traits.
 *
 * - Header uses `mb-2` instead of standard `mb-6` (intentional due to subtitle below)
 * - This is acceptable since there's explanatory text immediately after the header
 */
import React, { useState } from 'react';
import {
  Class as CharClass,
  Skill,
  AbilityScores,
  Race,
  RacialSelectionData,
} from '../../types'; // Path relative to src/components/CharacterCreator/
import { SKILLS_DATA } from '../../data/skills';
import Tooltip from '../ui/Tooltip'; // Build failed due to '../Tooltip' being unresolved; point to the ui/Tooltip path.

interface SkillSelectionProps {
  charClass: CharClass;
  abilityScores: AbilityScores; // Final scores (base + racial) to calculate modifiers
  race: Race;
  racialSelections: Record<string, RacialSelectionData>;
  onSkillsSelect: (skills: Skill[]) => void;
  onBack: () => void;
}

const KEEN_SENSES_SKILL_IDS = ['insight', 'perception', 'survival'];
const BUGBEAR_AUTO_SKILL_ID = 'stealth';

/**
 * SkillSelection component.
 * Allows player to choose skill proficiencies based on their class and race.
 * Prevents re-selecting skills already granted by racial traits.
 */
const SkillSelection: React.FC<SkillSelectionProps> = ({
  charClass,
  abilityScores,
  race,
  racialSelections,
  onSkillsSelect,
  onBack,
}) => {
  const [selectedClassSkillIds, setSelectedClassSkillIds] = useState<
    Set<string>
  >(new Set());
  const [selectedKeenSensesSkillId, setSelectedKeenSensesSkillId] =
    useState<string | null>(null);

  const availableSkillsFromClass = charClass.skillProficienciesAvailable
    .map((id) => SKILLS_DATA[id])
    .filter((skill) => skill);

  const keenSensesOptions = KEEN_SENSES_SKILL_IDS.map(
    (id) => SKILLS_DATA[id],
  ).filter((skill) => skill);

  const getAbilityModifier = (score: number): number =>
    Math.floor((score - 10) / 2);

  const handleClassSkillToggle = (skillId: string) => {
    setSelectedClassSkillIds((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(skillId)) {
        newSelected.delete(skillId);
      } else {
        if (newSelected.size < charClass.numberOfSkillProficiencies) {
          newSelected.add(skillId);
        }
      }
      return newSelected;
    });
  };

  const handleKeenSensesSelect = (skillId: string) => {
    setSelectedKeenSensesSkillId(skillId);
  };

  const handleSubmit = () => {
    const allSelectedSkills: Skill[] = Array.from(selectedClassSkillIds).map(
      (id: string) => SKILLS_DATA[id],
    );

    const humanSkillId = racialSelections['human']?.skillIds?.[0];
    if (humanSkillId) {
        const humanSkill = SKILLS_DATA[humanSkillId];
        if (humanSkill && !allSelectedSkills.some(s => s.id === humanSkill.id)) {
            allSelectedSkills.push(humanSkill);
        }
    }
    
    if (race.id === 'elf' && selectedKeenSensesSkillId) {
      const keenSensesSkill = SKILLS_DATA[selectedKeenSensesSkillId];
      if (
        keenSensesSkill &&
        !allSelectedSkills.some((s) => s.id === keenSensesSkill.id)
      ) {
        allSelectedSkills.push(keenSensesSkill);
      }
    }

    if (race.id === 'bugbear') {
        const stealthSkill = SKILLS_DATA[BUGBEAR_AUTO_SKILL_ID];
        if (stealthSkill && !allSelectedSkills.some(s => s.id === stealthSkill.id)) {
            allSelectedSkills.push(stealthSkill);
        }
    }
    
    const centaurSkillId = racialSelections['centaur']?.skillIds?.[0];
    if (centaurSkillId) {
        const naturalAffinitySkill = SKILLS_DATA[centaurSkillId];
        if (naturalAffinitySkill && !allSelectedSkills.some(s => s.id === naturalAffinitySkill.id)) {
            allSelectedSkills.push(naturalAffinitySkill);
        }
    }

    const changelingSkillIds = racialSelections['changeling']?.skillIds;
    if (changelingSkillIds) {
        changelingSkillIds.forEach(skillId => {
            const instinctSkill = SKILLS_DATA[skillId];
            if (instinctSkill && !allSelectedSkills.some(s => s.id === instinctSkill.id)) {
                allSelectedSkills.push(instinctSkill);
            }
        });
    }


    // Validate number of class skills
    if (selectedClassSkillIds.size !== charClass.numberOfSkillProficiencies) {
      return; 
    }
    // Validate Keen Senses selection if Elf
    if (race.id === 'elf' && !selectedKeenSensesSkillId) {
      return; 
    }

    onSkillsSelect(allSelectedSkills);
  };

  const isSubmitDisabled =
    selectedClassSkillIds.size !== charClass.numberOfSkillProficiencies ||
    (race.id === 'elf' && !selectedKeenSensesSkillId);
  
  const humanSkillId = racialSelections['human']?.skillIds?.[0];
  const centaurSkillId = racialSelections['centaur']?.skillIds?.[0];
  const changelingSkillIds = racialSelections['changeling']?.skillIds;

  return (
    <div>
      <h2 className="text-2xl text-sky-300 mb-2 text-center">Select Skills</h2>
      <p className="text-sm text-gray-400 mb-6 text-center">
        As a {charClass.name}, you can choose{' '}
        {charClass.numberOfSkillProficiencies} skill proficiencies from the list
        below. Some skills may already be granted by your racial traits.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {availableSkillsFromClass.map((skill) => {
          let isSkillRaciallyGranted = false;
          let racialGrantSource = '';

          if (humanSkillId === skill.id) {
            isSkillRaciallyGranted = true;
            racialGrantSource = "Human 'Skillful' trait";
          } else if (race.id === 'elf' && selectedKeenSensesSkillId === skill.id) {
            isSkillRaciallyGranted = true;
            racialGrantSource = "Elf 'Keen Senses' trait";
          } else if (race.id === 'bugbear' && skill.id === BUGBEAR_AUTO_SKILL_ID) {
            isSkillRaciallyGranted = true;
            racialGrantSource = "Bugbear 'Sneaky' trait";
          } else if (centaurSkillId === skill.id) {
            isSkillRaciallyGranted = true;
            racialGrantSource = "Centaur 'Natural Affinity' trait";
          } else if (changelingSkillIds?.includes(skill.id)) {
            isSkillRaciallyGranted = true;
            racialGrantSource = "Changeling 'Instincts' trait";
          }


          const isDisabledForSelection = 
            isSkillRaciallyGranted || 
            (!selectedClassSkillIds.has(skill.id) && selectedClassSkillIds.size >= charClass.numberOfSkillProficiencies);
            
          const skillNameDisplay = isSkillRaciallyGranted ? (
            <Tooltip content={`Proficient from ${racialGrantSource}. Selection is handled by the racial trait.`}>
              <span>{skill.name}</span>
            </Tooltip>
          ) : (
            skill.name
          );

          return (
            <label
              key={skill.id}
              className={`flex items-start p-3 rounded-lg transition-colors ${
                selectedClassSkillIds.has(skill.id)
                  ? 'bg-sky-600 ring-2 ring-sky-400' 
                  : isDisabledForSelection && isSkillRaciallyGranted
                  ? 'bg-gray-600 opacity-70 cursor-not-allowed' 
                  : 'bg-gray-700 hover:bg-gray-600' 
              } ${isDisabledForSelection && !isSkillRaciallyGranted && !selectedClassSkillIds.has(skill.id) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <input
                type="checkbox"
                checked={selectedClassSkillIds.has(skill.id)}
                onChange={() => handleClassSkillToggle(skill.id)}
                disabled={isDisabledForSelection}
                className="form-checkbox h-5 w-5 text-sky-500 bg-gray-800 border-gray-600 rounded focus:ring-sky-500 mr-3 mt-0.5 disabled:opacity-50"
                aria-label={`Select class skill ${skill.name}${isSkillRaciallyGranted ? ` (already granted by ${racialGrantSource})` : ''}`}
              />
              <span className="text-gray-200">
                {skillNameDisplay}
                {' '}
                <span className="text-xs text-gray-400">
                  ({skill.ability.substring(0, 3)})
                </span>
                <span className="ml-1 text-xs text-green-400">
                  (Mod:{' '}
                  {getAbilityModifier(abilityScores[skill.ability]) >= 0 ? '+' : ''}
                  {getAbilityModifier(abilityScores[skill.ability])})
                </span>
                {isSkillRaciallyGranted && (
                   <span className="text-xs text-yellow-400 ml-1">(Racial)</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-sm text-gray-400 mb-4 text-center">
        Class Skills Selected: {selectedClassSkillIds.size} /{' '}
        {charClass.numberOfSkillProficiencies}
      </p>

      {race.id === 'elf' && (
        <div className="my-6 p-4 border border-amber-500 rounded-lg bg-gray-700/30">
          <h3 className="text-lg text-amber-300 mb-3">
            Keen Senses (Elf Racial Trait)
          </h3>
          <p className="text-sm text-gray-400 mb-3">
            Choose one skill proficiency:
          </p>
          <div className="space-y-2">
            {keenSensesOptions.map((skill) => (
              <label
                key={`keen-${skill.id}`}
                className={`flex items-start p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedKeenSensesSkillId === skill.id
                    ? 'bg-amber-600 ring-2 ring-amber-400'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="keenSensesSkill"
                  checked={selectedKeenSensesSkillId === skill.id}
                  onChange={() => handleKeenSensesSelect(skill.id)}
                  className="form-radio h-4 w-4 text-amber-500 bg-gray-800 border-gray-600 focus:ring-amber-500 mr-3 mt-1"
                  aria-label={`Select Keen Senses skill ${skill.name}`}
                />
                <span className="text-gray-200">
                  {skill.name}{' '}
                  <span className="text-xs text-gray-400">
                    ({skill.ability.substring(0, 3)})
                  </span>
                  <span className="ml-1 text-xs text-green-400">
                    (Mod:{' '}
                    {getAbilityModifier(abilityScores[skill.ability]) >= 0 ? '+' : ''}
                    {getAbilityModifier(abilityScores[skill.ability])})
                  </span>
                </span>
              </label>
            ))}
          </div>
          {selectedKeenSensesSkillId && (
            <p className="text-xs text-gray-400 mt-2">
              Selected: {SKILLS_DATA[selectedKeenSensesSkillId]?.name}
            </p>
          )}
        </div>
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
          disabled={isSubmitDisabled}
          className="w-1/2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors"
          aria-label="Confirm selected skills"
        >
          Confirm Skills
        </button>
      </div>
    </div>
  );
};

export default SkillSelection;
