// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 05/02/2026, 16:17:03
 * Dependents: CharacterCreator.tsx
 * Imports: 6 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file SkillSelection.tsx
 * Refactored to use Split Config Style (List vs Detail).
 * 
 * TODO(QOL): Consider extracting the skill calculation utilities into a separate utility module
 * for better reusability across character creation components.
 * 
 * TODO(PERFORMANCE): Memoize expensive calculations like skill lists and modifiers
 * to prevent unnecessary recalculations during re-renders.
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Class as CharClass,
  Skill,
  AbilityScores,
  Race,
  RacialSelectionData,
} from '../../types';
import { SKILLS_DATA } from '../../data/skills';
import Tooltip from '../ui/Tooltip';
import { CreationStepLayout } from './ui/CreationStepLayout';
import { SplitPaneLayout } from '../ui/SplitPaneLayout';
import { BTN_PRIMARY } from '../../styles/buttonStyles';

// TODO(TYPES): Consider creating a dedicated interface for skill selection props
// to improve type safety and documentation
interface SkillSelectionProps {
  charClass: CharClass;
  abilityScores: AbilityScores;
  race: Race;
  racialSelections: Record<string, RacialSelectionData>;
  onSkillsSelect: (skills: Skill[]) => void;
  onBack: () => void;
}

// Constants for racial skill mechanics
// TODO(CONFIG): Move these constants to a centralized configuration file
// for easier maintenance and consistency across the codebase
const KEEN_SENSES_SKILL_IDS = ['insight', 'perception', 'survival'];
const BUGBEAR_AUTO_SKILL_ID = 'stealth';

/**
 * SkillSelection component.
 * Allows player to choose skill proficiencies based on their class and race.
 * Uses a Split Config layout for consistency with Race/Feat selection.
 * 
 * TODO(UI): Add keyboard navigation support for better accessibility
 * TODO(UI): Consider adding skill search/filter functionality for large skill lists
 * TODO(TESTING): Add comprehensive unit tests for skill selection logic
 */
const SkillSelection: React.FC<SkillSelectionProps> = ({
  charClass,
  abilityScores,
  race,
  racialSelections,
  onSkillsSelect,
  onBack,
}) => {
  // State management for skill selection
  // TODO(PERFORMANCE): Consider using useReducer for complex state logic
  // if the state management becomes more complex
  const [selectedClassSkillIds, setSelectedClassSkillIds] = useState<Set<string>>(new Set());
  const [selectedKeenSensesSkillId, setSelectedKeenSensesSkillId] = useState<string | null>(null);
  const [viewedSkillId, setViewedSkillId] = useState<string | null>(null);

  // Filter and map available skills from class data
  // TODO(PERFORMANCE): Memoize this computation with useMemo to avoid recalculation
  const availableSkillsFromClass = charClass.skillProficienciesAvailable
    .map((id) => SKILLS_DATA[id])
    .filter((skill) => skill);

  // Set initial viewed skill when component mounts or available skills change
  // TODO(EFFECTS): Consider adding dependency array optimization
  useEffect(() => {
    if (!viewedSkillId && availableSkillsFromClass.length > 0) {
      setViewedSkillId(availableSkillsFromClass[0].id);
    }
  }, [availableSkillsFromClass, viewedSkillId]);

  // Prepare options for Elf Keen Senses racial feature
  // TODO(CONFIG): Move this mapping logic to a utility function or data file
  const keenSensesOptions = KEEN_SENSES_SKILL_IDS.map((id) => SKILLS_DATA[id]).filter((skill) => skill);

  /**
   * Calculate ability modifier using standard D&D 5e formula
   * Formula: (ability_score - 10) / 2, rounded down
   * 
   * TODO(UTILS): This function is duplicated in multiple places - consider
   * creating a shared utility module for common character calculations
   */
  const getAbilityModifier = (score: number): number => Math.floor((score - 10) / 2);

  // Calculate proficiency bonus based on character level (assumed to be 1 during character creation)
  // D&D 5e formula: PB = floor((level + 7) / 4)
  // Level 1-4: +2, Level 5-8: +3, Level 9-12: +4, Level 13-16: +5, Level 17-20: +6
  const calculateProficiencyBonus = (level: number = 1): number => {
    return Math.floor((level + 7) / 4);
  };

  // Calculate total skill modifier combining ability modifier and proficiency bonus
  // Returns: ability modifier + (proficiency bonus if character is proficient in this skill)
  // Used to show players their actual skill check modifier
  const calculateTotalSkillModifier = (
    abilityScore: number, 
    hasProficiency: boolean, 
    level: number = 1
  ): number => {
    const abilityMod = getAbilityModifier(abilityScore);
    const proficiencyBonus = hasProficiency ? calculateProficiencyBonus(level) : 0;
    return abilityMod + proficiencyBonus;
  };

  /**
   * Handle toggling of class skill selections
   * Manages the selection state while respecting class skill limits
   * 
   * TODO(STATE): Consider extracting this logic into a custom hook for
   * better separation of concerns and reusability
   */
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

  /**
   * Handle selection of Elf Keen Senses skill
   * Elves must choose one skill from Insight, Perception, or Survival
   * 
   * TODO(VALIDATION): Add validation to ensure only one keen senses skill is selected
   */
  const handleKeenSensesSelect = (skillId: string) => {
    setSelectedKeenSensesSkillId(skillId);
  };

  /**
   * Handle form submission and prepare selected skills for character creation
   * Aggregates all selected skills including racial bonuses
   * 
   * TODO(COMPOSITION): This function is quite long - consider breaking it into
   * smaller helper functions for better readability and maintainability
   */
  const handleSubmit = () => {
    const allSelectedSkills: Skill[] = Array.from(selectedClassSkillIds).map(
      (id: string) => SKILLS_DATA[id],
    );

    // Add Human racial skill bonus if selected
    const humanSkillId = racialSelections['human']?.skillIds?.[0];
    if (humanSkillId) {
      const humanSkill = SKILLS_DATA[humanSkillId];
      if (humanSkill && !allSelectedSkills.some(s => s.id === humanSkill.id)) {
        allSelectedSkills.push(humanSkill);
      }
    }

    // Add Elf Keen Senses skill if selected
    if (race.id === 'elf' && selectedKeenSensesSkillId) {
      const keenSensesSkill = SKILLS_DATA[selectedKeenSensesSkillId];
      if (keenSensesSkill && !allSelectedSkills.some((s) => s.id === keenSensesSkill.id)) {
        allSelectedSkills.push(keenSensesSkill);
      }
    }

    // Add Bugbear automatic Stealth proficiency
    if (race.id === 'bugbear') {
      const stealthSkill = SKILLS_DATA[BUGBEAR_AUTO_SKILL_ID];
      if (stealthSkill && !allSelectedSkills.some(s => s.id === stealthSkill.id)) {
        allSelectedSkills.push(stealthSkill);
      }
    }

    // Add Centaur Natural Affinity skill if selected
    const centaurSkillId = racialSelections['centaur']?.skillIds?.[0];
    if (centaurSkillId) {
      const naturalAffinitySkill = SKILLS_DATA[centaurSkillId];
      if (naturalAffinitySkill && !allSelectedSkills.some(s => s.id === naturalAffinitySkill.id)) {
        allSelectedSkills.push(naturalAffinitySkill);
      }
    }

    // Add Changeling Instincts skills if selected
    const changelingSkillIds = racialSelections['changeling']?.skillIds;
    if (changelingSkillIds) {
      changelingSkillIds.forEach(skillId => {
        const instinctSkill = SKILLS_DATA[skillId];
        if (instinctSkill && !allSelectedSkills.some(s => s.id === instinctSkill.id)) {
          allSelectedSkills.push(instinctSkill);
        }
      });
    }

    // Final validation before submission
    if (selectedClassSkillIds.size !== charClass.numberOfSkillProficiencies) return;
    if (race.id === 'elf' && !selectedKeenSensesSkillId) return;

    onSkillsSelect(allSelectedSkills);
  };

  // Determine if submission is disabled based on selection requirements
  // TODO(VALIDATION): Consider moving validation logic to a separate validation function
  const isSubmitDisabled =
    selectedClassSkillIds.size !== charClass.numberOfSkillProficiencies ||
    (race.id === 'elf' && !selectedKeenSensesSkillId);

  // Extract racial selection data for easier access
  const humanSkillId = racialSelections['human']?.skillIds?.[0];
  const centaurSkillId = racialSelections['centaur']?.skillIds?.[0];
  const changelingSkillIds = racialSelections['changeling']?.skillIds;

  /**
   * Determine racial grant information for a given skill
   * Maps skill IDs to their racial source and grant status
   * 
   * TODO(PERFORMANCE): Memoize this function to avoid recalculating on each render
   * TODO(DATA): Consider moving this logic to a dedicated racial mechanics utility
   */
  const getRacialGrantInfo = (skillId: string) => {
    if (humanSkillId === skillId) return { granted: true, source: "Human 'Skillful' trait" };
    if (race.id === 'elf' && selectedKeenSensesSkillId === skillId) return { granted: true, source: "Elf 'Keen Senses' trait" };
    if (race.id === 'bugbear' && skillId === BUGBEAR_AUTO_SKILL_ID) return { granted: true, source: "Bugbear 'Sneaky' trait" };
    if (centaurSkillId === skillId) return { granted: true, source: "Centaur 'Natural Affinity' trait" };
    if (changelingSkillIds?.includes(skillId)) return { granted: true, source: "Changeling 'Instincts' trait" };
    return { granted: false, source: '' };
  };

  // Current skill being viewed in detail panel
  const viewedSkill = viewedSkillId ? SKILLS_DATA[viewedSkillId] : null;
  const viewedGrantInfo = viewedSkillId ? getRacialGrantInfo(viewedSkillId) : { granted: false, source: '' };
  const isViewedSelected = viewedSkillId && selectedClassSkillIds.has(viewedSkillId);
  const isViewedDisabled = viewedSkillId && (
    viewedGrantInfo.granted ||
    (!selectedClassSkillIds.has(viewedSkillId) && selectedClassSkillIds.size >= charClass.numberOfSkillProficiencies)
  );

  // Main render function returning the skill selection UI
  return (
    <CreationStepLayout
      title="Select Skills"
      onBack={onBack}
      onNext={handleSubmit}
      canProceed={!isSubmitDisabled}
      nextLabel="Confirm Skills"
      bodyScrollable={false}
    >
      <div className="h-full min-h-0">
        <SplitPaneLayout
          controls={
            // Left panel: Skill selection list
            <div className="space-y-4">
              {/* Skill selection header with progress indicator */}
              <div className="px-2">
                <p className="text-sm text-gray-400 text-center">
                  Choose <span className="text-amber-400 font-bold">{charClass.numberOfSkillProficiencies}</span> skills.
                  <br />
                  <span className="text-xs">
                    Selected: {selectedClassSkillIds.size} / {charClass.numberOfSkillProficiencies}
                  </span>
                </p>
              </div>

              {/* Main skill list from class */}
              <div className="space-y-1">
                {availableSkillsFromClass.map((skill) => {
                  const { granted, source } = getRacialGrantInfo(skill.id);
                  const isSelected = selectedClassSkillIds.has(skill.id);
                  const isViewed = viewedSkillId === skill.id;
                  const isDisabled = granted || (!isSelected && selectedClassSkillIds.size >= charClass.numberOfSkillProficiencies);

                  return (
                    // Individual skill selection button
                    <button
                      key={skill.id}
                      onClick={() => setViewedSkillId(skill.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 border border-transparent flex items-center justify-between ${
                        isViewed
                          ? 'bg-amber-900/20 border-amber-500/50 text-white shadow-md'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Selection indicator */}
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            isSelected || granted
                              ? 'bg-sky-600 border-sky-500'
                              : 'border-gray-500 bg-gray-900/50'
                          }`}
                        >
                          {(isSelected || granted) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={isSelected || granted ? 'text-sky-300 font-medium' : ''}>
                          {skill.name}
                        </span>
                      </div>
                      
                      {/* Racial grant indicator */}
                      {granted && (
                        <span className="text-[10px] bg-yellow-900/40 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-700/30">
                          Racial
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Elf Keen Senses Section within List */}
              {race.id === 'elf' && (
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <h4 className="text-sm font-cinzel text-amber-400 mb-2 px-2">Keen Senses (Elf)</h4>
                  <div className="space-y-1">
                    {keenSensesOptions.map((skill) => (
                      // Keen senses skill selection buttons
                      <button
                        key={`keen-${skill.id}`}
                        onClick={() => setSelectedKeenSensesSkillId(skill.id)}
                        className={`w-full text-left px-4 py-2 rounded-lg transition-all flex items-center gap-3 ${
                          selectedKeenSensesSkillId === skill.id
                            ? 'bg-amber-900/30 border border-amber-500/50 text-amber-200'
                            : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-400'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                          selectedKeenSensesSkillId === skill.id ? 'border-amber-500 bg-amber-500' : 'border-gray-500'
                        }`} />
                        <span>{skill.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          }
          preview={
            // Right panel: Skill detail view
            viewedSkill ? (
              <motion.div
                key={viewedSkill.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
              >
                {/* Skill header with selection controls */}
                <div className="flex justify-between items-start mb-6 border-b border-gray-700 pb-4">
                  <div>
                    <h2 className="text-3xl font-bold text-sky-400 font-cinzel mb-1">{viewedSkill.name}</h2>
                    <span className="text-sm text-gray-400 uppercase tracking-wider font-semibold">
                      {viewedSkill.ability} Ability Check
                    </span>
                  </div>
                  
                  {/* Selection toggle button (hidden for racial grants) */}
                  {!viewedGrantInfo.granted && (
                    <button
                      onClick={() => handleClassSkillToggle(viewedSkill.id)}
                      disabled={!!(isViewedDisabled && !isViewedSelected)}
                      className={`px-4 py-2 rounded-lg font-bold shadow-md transition-all ${
                        isViewedSelected
                          ? 'bg-red-900/80 hover:bg-red-800 text-red-100 border border-red-700'
                          : isViewedDisabled
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : BTN_PRIMARY
                      }`}
                    >
                      {isViewedSelected ? 'Remove' : 'Select Skill'}
                    </button>
                  )}
                </div>

                {/* Skill statistics and modifiers panel */}
                <div className="bg-gray-900/30 border border-gray-700 rounded-xl p-6 space-y-4">
                  {/* Ability modifier display */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center text-2xl font-bold text-gray-500">
                      {viewedSkill.ability.substring(0, 3).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-gray-300 text-sm">
                        Your <strong>{viewedSkill.ability}</strong> modifier is:
                      </p>
                      <p className={`text-2xl font-bold ${getAbilityModifier(abilityScores[viewedSkill.ability]) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {getAbilityModifier(abilityScores[viewedSkill.ability]) >= 0 ? '+' : ''}
                        {getAbilityModifier(abilityScores[viewedSkill.ability])}
                      </p>
                    </div>
                  </div>

                  {/* Proficiency Bonus Indicator - Only shown when skill is selected or racially granted */}
                  {/* Helps players understand the additional bonus they'll get on skill checks */}
                  {(isViewedSelected || viewedGrantInfo.granted) && (
                    <div className="flex items-center justify-between p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                      <span className="text-blue-200">Proficiency Bonus:</span>
                      <span className="text-blue-400 font-bold">+{calculateProficiencyBonus()}</span>
                    </div>
                  )}

                  {/* Total Modifier Display - Shows the complete skill check modifier */}
                  {/* This is what players will actually roll when making skill checks */}
                  <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                    <span className="text-green-200">Total Modifier:</span>
                    <span className="text-green-400 font-bold text-xl">
                      {calculateTotalSkillModifier(
                        abilityScores[viewedSkill.ability], 
                        isViewedSelected || viewedGrantInfo.granted
                      ) >= 0 ? '+' : ''}
                      {calculateTotalSkillModifier(
                        abilityScores[viewedSkill.ability], 
                        isViewedSelected || viewedGrantInfo.granted
                      )}
                    </span>
                  </div>

                  {/* Racial proficiency explanation */}
                  {viewedGrantInfo.granted && (
                    <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                      <p className="text-yellow-200 text-sm">
                        <strong className="block mb-1">Racial Proficiency</strong>
                        You are automatically proficient in this skill thanks to your {viewedGrantInfo.source}.
                      </p>
                    </div>
                  )}

                  {/* Skill description placeholder */}
                  <p className="text-gray-400 text-sm leading-relaxed italic">
                    Proficiency in <strong>{viewedSkill.name}</strong> allows you to add your Proficiency Bonus to checks made to...
                    <br/><br/>
                    (Detailed descriptions coming soon to the Archives)
                  </p>
                </div>
              </motion.div>
            ) : (
              // Empty state when no skill is selected
              <div className="flex items-center justify-center h-full text-gray-500 italic">
                Select a skill to view details
              </div>
            )
          }
        />
      </div>
    </CreationStepLayout>
  );
};

export default SkillSelection;
