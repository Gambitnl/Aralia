// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 27/01/2026, 01:42:02
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
// TODO: Move SplitPaneLayout to a shared UI barrel file (e.g., src/components/CharacterCreator/ui/index.ts) to simplify imports.
import { SplitPaneLayout } from './ui/SplitPaneLayout';
import { BTN_PRIMARY } from '../../styles/buttonStyles';

interface SkillSelectionProps {
  charClass: CharClass;
  abilityScores: AbilityScores;
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
 * Uses a Split Config layout for consistency with Race/Feat selection.
 */
const SkillSelection: React.FC<SkillSelectionProps> = ({
  charClass,
  abilityScores,
  race,
  racialSelections,
  onSkillsSelect,
  onBack,
}) => {
  const [selectedClassSkillIds, setSelectedClassSkillIds] = useState<Set<string>>(new Set());
  const [selectedKeenSensesSkillId, setSelectedKeenSensesSkillId] = useState<string | null>(null);
  const [viewedSkillId, setViewedSkillId] = useState<string | null>(null);

  const availableSkillsFromClass = charClass.skillProficienciesAvailable
    .map((id) => SKILLS_DATA[id])
    .filter((skill) => skill);

  // Set initial viewed skill
  useEffect(() => {
    if (!viewedSkillId && availableSkillsFromClass.length > 0) {
      setViewedSkillId(availableSkillsFromClass[0].id);
    }
  }, [availableSkillsFromClass, viewedSkillId]);

  const keenSensesOptions = KEEN_SENSES_SKILL_IDS.map((id) => SKILLS_DATA[id]).filter((skill) => skill);

  const getAbilityModifier = (score: number): number => Math.floor((score - 10) / 2);

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
      if (keenSensesSkill && !allSelectedSkills.some((s) => s.id === keenSensesSkill.id)) {
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

    if (selectedClassSkillIds.size !== charClass.numberOfSkillProficiencies) return;
    if (race.id === 'elf' && !selectedKeenSensesSkillId) return;

    onSkillsSelect(allSelectedSkills);
  };

  const isSubmitDisabled =
    selectedClassSkillIds.size !== charClass.numberOfSkillProficiencies ||
    (race.id === 'elf' && !selectedKeenSensesSkillId);

  const humanSkillId = racialSelections['human']?.skillIds?.[0];
  const centaurSkillId = racialSelections['centaur']?.skillIds?.[0];
  const changelingSkillIds = racialSelections['changeling']?.skillIds;

  // Determine racial grants map for easier lookup
  const getRacialGrantInfo = (skillId: string) => {
    if (humanSkillId === skillId) return { granted: true, source: "Human 'Skillful' trait" };
    if (race.id === 'elf' && selectedKeenSensesSkillId === skillId) return { granted: true, source: "Elf 'Keen Senses' trait" };
    if (race.id === 'bugbear' && skillId === BUGBEAR_AUTO_SKILL_ID) return { granted: true, source: "Bugbear 'Sneaky' trait" };
    if (centaurSkillId === skillId) return { granted: true, source: "Centaur 'Natural Affinity' trait" };
    if (changelingSkillIds?.includes(skillId)) return { granted: true, source: "Changeling 'Instincts' trait" };
    return { granted: false, source: '' };
  };

  const viewedSkill = viewedSkillId ? SKILLS_DATA[viewedSkillId] : null;
  const viewedGrantInfo = viewedSkillId ? getRacialGrantInfo(viewedSkillId) : { granted: false, source: '' };
  const isViewedSelected = viewedSkillId && selectedClassSkillIds.has(viewedSkillId);
  const isViewedDisabled = viewedSkillId && (
    viewedGrantInfo.granted ||
    (!selectedClassSkillIds.has(viewedSkillId) && selectedClassSkillIds.size >= charClass.numberOfSkillProficiencies)
  );

  // TODO: Add visual 'Proficiency Bonus' indicator next to mod calculations
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
            <div className="space-y-4">
              <div className="px-2">
                <p className="text-sm text-gray-400 text-center">
                  Choose <span className="text-amber-400 font-bold">{charClass.numberOfSkillProficiencies}</span> skills.
                  <br />
                  <span className="text-xs">
                    Selected: {selectedClassSkillIds.size} / {charClass.numberOfSkillProficiencies}
                  </span>
                </p>
              </div>

              <div className="space-y-1">
                {availableSkillsFromClass.map((skill) => {
                  const { granted, source } = getRacialGrantInfo(skill.id);
                  const isSelected = selectedClassSkillIds.has(skill.id);
                  const isViewed = viewedSkillId === skill.id;
                  const isDisabled = granted || (!isSelected && selectedClassSkillIds.size >= charClass.numberOfSkillProficiencies);

                  return (
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
            viewedSkill ? (
              <motion.div
                key={viewedSkill.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-6 border-b border-gray-700 pb-4">
                  <div>
                    <h2 className="text-3xl font-bold text-sky-400 font-cinzel mb-1">{viewedSkill.name}</h2>
                    <span className="text-sm text-gray-400 uppercase tracking-wider font-semibold">
                      {viewedSkill.ability} Ability Check
                    </span>
                  </div>
                  
                  {!viewedGrantInfo.granted && (
                    <button
                      onClick={() => handleClassSkillToggle(viewedSkill.id)}
                      disabled={isViewedDisabled && !isViewedSelected}
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

                <div className="bg-gray-900/30 border border-gray-700 rounded-xl p-6 space-y-4">
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

                  {viewedGrantInfo.granted && (
                    <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                      <p className="text-yellow-200 text-sm">
                        <strong className="block mb-1">Racial Proficiency</strong>
                        You are automatically proficient in this skill thanks to your {viewedGrantInfo.source}.
                      </p>
                    </div>
                  )}

                  <p className="text-gray-400 text-sm leading-relaxed italic">
                    Proficiency in <strong>{viewedSkill.name}</strong> allows you to add your Proficiency Bonus to checks made to...
                    <br/><br/>
                    (Detailed descriptions coming soon to the Archives)
                  </p>
                </div>
              </motion.div>
            ) : (
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
