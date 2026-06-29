// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/06/2026, 18:11:40
 * Dependents: components/CharacterCreator/CharacterCreator.tsx
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file SkillSelection.tsx
 * Refactored to use Split Config Style (List vs Detail).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Class as CharClass,
  Skill,
  AbilityScores,
  Race,
  RacialSelectionData,
} from '../../types';
import { SKILLS_DATA } from '../../data/skills';
import { BACKGROUNDS } from '../../data/backgrounds';
import Tooltip from '../ui/Tooltip';
import { Button } from '../ui/Button';
import { CreationStepLayout } from './ui/CreationStepLayout';
import { SplitPaneLayout } from '../ui/SplitPaneLayout';
import { BTN_PRIMARY } from '../../styles/buttonStyles';
import { getAbilityModifierValue } from '../../utils/character/statUtils';
import { calculateProficiencyBonus } from '../../utils/character/savingThrowUtils';
import { calculateTotalSkillModifier } from '../../utils/character/skillModifierUtils';
import { useSkillSelectionState } from './hooks/useSkillSelectionState';
import {
  buildSkillsForSubmit,
  deriveRacialSkillGrants,
  getKeenSensesOptions,
  isSkillSelectionValid,
} from './utils/skillSelectionUtils';

interface SkillSelectionProps {
  charClass: CharClass;
  abilityScores: AbilityScores;
  race: Race;
  racialSelections: Record<string, RacialSelectionData>;
  selectedBackground?: string;
  onSkillsSelect: (skills: Skill[]) => void;
  onBack: () => void;
}

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
  selectedBackground,
  onSkillsSelect,
  onBack,
}) => {
  const assumedCharacterLevel = 1;
  const listKeyNavRef = useRef<HTMLDivElement | null>(null);
  const [skillSearchQuery, setSkillSearchQuery] = useState('');

  const {
    selectedClassSkillIds,
    selectedKeenSensesSkillId,
    viewedSkillId,
    toggleClassSkill,
    setSelectedKeenSensesSkillId,
    setViewedSkillId,
    resetSelectedClassSkills,
  } = useSkillSelectionState();

  const headerActions = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        resetSelectedClassSkills();
        setSelectedKeenSensesSkillId(null);
      }}
      disabled={selectedClassSkillIds.size === 0 && !selectedKeenSensesSkillId}
      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
    >
      Reset
    </Button>
  );

  // Prepare options for Elf Keen Senses racial feature
  const keenSensesOptions = useMemo(() => getKeenSensesOptions(SKILLS_DATA), []);

  const racialGrantsBySkillId = useMemo(() => {
    return deriveRacialSkillGrants({
      raceId: race.id,
      racialSelections,
      selectedKeenSensesSkillId,
    });
  }, [race.id, racialSelections, selectedKeenSensesSkillId]);

  // Compute all skills automatically granted by race or background.
  const autoSkillIds = useMemo(() => {
    const ids = new Set<string>();
    
    // Add skills automatically granted by chosen racial traits.
    Object.entries(racialGrantsBySkillId).forEach(([skillId, info]) => {
      if (info.granted) {
        ids.add(skillId);
      }
    });

    // Add skills automatically granted by the chosen background.
    if (selectedBackground && BACKGROUNDS[selectedBackground]) {
      BACKGROUNDS[selectedBackground].skillProficiencies.forEach(id => {
        ids.add(id);
      });
    }

    return ids;
  }, [racialGrantsBySkillId, selectedBackground]);

  // Determine if there is any overlap between class skill lists and auto-granted skills.
  const hasOverlap = useMemo(() => {
    return charClass.skillProficienciesAvailable.some(id => autoSkillIds.has(id));
  }, [charClass.skillProficienciesAvailable, autoSkillIds]);

  // Keep class-list auto grants visible as disabled/badged rows while still
  // expanding replacement choices when a background or racial grant overlaps.
  const visibleSkillsFromClass = useMemo(() => {
    const classSkillIds = new Set(charClass.skillProficienciesAvailable);
    const autoGrantedClassSkills = charClass.skillProficienciesAvailable
      .map((id) => SKILLS_DATA[id])
      .filter((skill): skill is Skill => !!skill && autoSkillIds.has(skill.id));

    if (hasOverlap) {
      // If there is an overlap, the player can choose from any skill in the game
      // (excluding auto-granted ones), but the original overlapping class rows
      // remain visible so the source badge explains why they cannot be picked.
      const replacementOptions = Object.values(SKILLS_DATA)
        .filter((skill): skill is Skill => !!skill && !autoSkillIds.has(skill.id));
      return [
        ...autoGrantedClassSkills,
        ...replacementOptions.filter((skill) => !classSkillIds.has(skill.id)),
        ...replacementOptions.filter((skill) => classSkillIds.has(skill.id)),
      ];
    }

    // Otherwise, they choose from their standard class list.
    return charClass.skillProficienciesAvailable
      .map((id) => SKILLS_DATA[id])
      .filter((skill): skill is Skill => !!skill);
  }, [charClass.skillProficienciesAvailable, hasOverlap, autoSkillIds]);

  const filteredSkillsFromClass = useMemo(() => {
    const q = skillSearchQuery.trim().toLowerCase();
    if (!q) return visibleSkillsFromClass;
    return visibleSkillsFromClass.filter((skill) => {
      return (
        skill.name.toLowerCase().includes(q) ||
        skill.ability.toLowerCase().includes(q) ||
        skill.id.toLowerCase().includes(q)
      );
    });
  }, [visibleSkillsFromClass, skillSearchQuery]);

  // Set initial viewed skill when component mounts or available skills change
  useEffect(() => {
    if (!viewedSkillId && visibleSkillsFromClass.length > 0) {
      setViewedSkillId(visibleSkillsFromClass[0].id);
    }
  }, [visibleSkillsFromClass, setViewedSkillId, viewedSkillId]);

  useEffect(() => {
    if (filteredSkillsFromClass.length === 0) return;
    const stillVisible = viewedSkillId && filteredSkillsFromClass.some((s) => s.id === viewedSkillId);
    if (!stillVisible) {
      setViewedSkillId(filteredSkillsFromClass[0].id);
    }
  }, [filteredSkillsFromClass, setViewedSkillId, viewedSkillId]);

  const EMPTY_GRANT_INFO = useMemo(() => ({ granted: false as const, source: '' as const }), []);

  const onListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (filteredSkillsFromClass.length === 0) return;

    const currentIndex = viewedSkillId
      ? filteredSkillsFromClass.findIndex((s) => s.id === viewedSkillId)
      : -1;

    const clampIndex = (i: number) => Math.max(0, Math.min(filteredSkillsFromClass.length - 1, i));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = clampIndex((currentIndex === -1 ? 0 : currentIndex) + 1);
      setViewedSkillId(filteredSkillsFromClass[nextIndex].id);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIndex = clampIndex((currentIndex === -1 ? 0 : currentIndex) - 1);
      setViewedSkillId(filteredSkillsFromClass[nextIndex].id);
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      setViewedSkillId(filteredSkillsFromClass[0].id);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      setViewedSkillId(filteredSkillsFromClass[filteredSkillsFromClass.length - 1].id);
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!viewedSkillId) return;
      const grantInfo = racialGrantsBySkillId[viewedSkillId] ?? EMPTY_GRANT_INFO;
      const isBackgroundGranted = !!(selectedBackground && BACKGROUNDS[selectedBackground]?.skillProficiencies.includes(viewedSkillId));
      if (grantInfo.granted || isBackgroundGranted) return;
      toggleClassSkill(viewedSkillId, charClass.numberOfSkillProficiencies);
    }
  };

  /**
   * Handle form submission and prepare selected skills for character creation
   * Aggregates all selected skills including racial bonuses
   */
  const handleSubmit = () => {
    const isValid = isSkillSelectionValid({
      selectedClassSkillIds,
      requiredClassSkillCount: charClass.numberOfSkillProficiencies,
      raceId: race.id,
      selectedKeenSensesSkillId,
    });
    if (!isValid) return;

    const allSelectedSkills = buildSkillsForSubmit({
      skillsById: SKILLS_DATA,
      selectedClassSkillIds,
      raceId: race.id,
      racialSelections,
      selectedKeenSensesSkillId,
    });

    onSkillsSelect(allSelectedSkills);
  };

  // Determine if submission is disabled based on selection requirements
  const isSubmitDisabled = !isSkillSelectionValid({
    selectedClassSkillIds,
    requiredClassSkillCount: charClass.numberOfSkillProficiencies,
    raceId: race.id,
    selectedKeenSensesSkillId,
  });

  // Current skill being viewed in detail panel
  const viewedSkill = viewedSkillId ? SKILLS_DATA[viewedSkillId] : null;
  const viewedGrantInfo = viewedSkillId ? (racialGrantsBySkillId[viewedSkillId] ?? EMPTY_GRANT_INFO) : EMPTY_GRANT_INFO;
  const isViewedRacialGranted = viewedGrantInfo.granted;
  const isViewedBackgroundGranted = !!(viewedSkillId && selectedBackground && BACKGROUNDS[selectedBackground]?.skillProficiencies.includes(viewedSkillId));
  const isViewedAutoGranted = isViewedRacialGranted || isViewedBackgroundGranted;
  const isViewedSelected = viewedSkillId && selectedClassSkillIds.has(viewedSkillId);
  const isViewedDisabled = viewedSkillId && (
    isViewedAutoGranted ||
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
      headerActions={headerActions}
    >
      <div className="h-full min-h-0">
        <SplitPaneLayout
          controls={
            // Left panel: Skill selection list
            <div className="space-y-4">
              {/* Skill list search */}
              <div className="px-2">
                <label htmlFor="skill-search" className="sr-only">Search skills</label>
                <input
                  id="skill-search"
                  value={skillSearchQuery}
                  onChange={(e) => setSkillSearchQuery(e.target.value)}
                  placeholder="Search skills..."
                  className="w-full px-3 py-2 rounded-lg bg-gray-900/60 border border-gray-700 text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

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
              <div
                className="space-y-1 outline-none"
                ref={listKeyNavRef}
                tabIndex={0}
                onKeyDown={onListKeyDown}
                aria-label="Skill list"
              >
                {filteredSkillsFromClass.map((skill) => {
                  const grantInfo = racialGrantsBySkillId[skill.id] ?? EMPTY_GRANT_INFO;
                  const isRacialGranted = grantInfo.granted;
                  const isBackgroundGranted = !!(selectedBackground && BACKGROUNDS[selectedBackground]?.skillProficiencies.includes(skill.id));
                  const isAutoGranted = isRacialGranted || isBackgroundGranted;
                  const isSelected = selectedClassSkillIds.has(skill.id);
                  const isViewed = viewedSkillId === skill.id;

                  return (
                    // Individual skill selection button
                    <button
                      key={skill.id}
                      onClick={() => {
                        setViewedSkillId(skill.id);
                        if (!isAutoGranted) toggleClassSkill(skill.id, charClass.numberOfSkillProficiencies);
                      }}
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
                            isSelected || isAutoGranted
                              ? 'bg-sky-600 border-sky-500'
                              : 'border-gray-500 bg-gray-900/50'
                          }`}
                        >
                          {(isSelected || isAutoGranted) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={isSelected || isAutoGranted ? 'text-sky-300 font-medium' : ''}>
                          {skill.name}
                        </span>
                      </div>
                      
                      {/* Auto grant indicators */}
                      <div className="flex items-center gap-1.5">
                        {isRacialGranted && (
                          <Tooltip content={grantInfo.source}>
                            <span className="text-[10px] bg-yellow-900/40 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-700/30">
                              Racial
                            </span>
                          </Tooltip>
                        )}
                        {isBackgroundGranted && selectedBackground && BACKGROUNDS[selectedBackground] && (
                          <Tooltip content={`Granted by your ${BACKGROUNDS[selectedBackground].name} background`}>
                            <span className="text-[10px] bg-sky-900/40 text-sky-400 px-1.5 py-0.5 rounded border border-sky-700/30">
                              Background
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </button>
                  );
                })}

                {filteredSkillsFromClass.length === 0 && (
                  <div className="text-xs text-gray-500 text-center py-3 italic">
                    No skills match &quot;{skillSearchQuery.trim()}&quot;
                  </div>
                )}
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
                  
                  {/* Selection toggle button (hidden for automatically granted skills) */}
                  {!isViewedAutoGranted && (
                    <button
                      onClick={() => toggleClassSkill(viewedSkill.id, charClass.numberOfSkillProficiencies)}
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
                      <p className={`text-2xl font-bold ${getAbilityModifierValue(abilityScores[viewedSkill.ability]) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {getAbilityModifierValue(abilityScores[viewedSkill.ability]) >= 0 ? '+' : ''}
                        {getAbilityModifierValue(abilityScores[viewedSkill.ability])}
                      </p>
                    </div>
                  </div>

                  {/* Proficiency Bonus Indicator - Only shown when skill is selected or automatically granted */}
                  {/* Helps players understand the additional bonus they'll get on skill checks */}
                  {(isViewedSelected || isViewedAutoGranted) && (
                    <div className="flex items-center justify-between p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                      <span className="text-blue-200">Proficiency Bonus:</span>
                      <span className="text-blue-400 font-bold">+{calculateProficiencyBonus(assumedCharacterLevel)}</span>
                    </div>
                  )}

                  {/* Total Modifier Display - Shows the complete skill check modifier */}
                  {/* This is what players will actually roll when making skill checks */}
                  <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                    <span className="text-green-200">Total Modifier:</span>
                    <span className="text-green-400 font-bold text-xl">
                      {calculateTotalSkillModifier({
                        abilityScore: abilityScores[viewedSkill.ability],
                        hasProficiency: isViewedSelected || isViewedAutoGranted,
                        level: assumedCharacterLevel,
                      }) >= 0 ? '+' : ''}
                      {calculateTotalSkillModifier({
                        abilityScore: abilityScores[viewedSkill.ability],
                        hasProficiency: isViewedSelected || isViewedAutoGranted,
                        level: assumedCharacterLevel,
                      })}
                    </span>
                  </div>

                  {/* Racial proficiency explanation */}
                  {isViewedRacialGranted && (
                    <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                      <p className="text-yellow-200 text-sm">
                        <strong className="block mb-1">Racial Proficiency</strong>
                        You are automatically proficient in this skill thanks to your {viewedGrantInfo.source}.
                      </p>
                    </div>
                  )}

                  {/* Background proficiency explanation */}
                  {isViewedBackgroundGranted && selectedBackground && BACKGROUNDS[selectedBackground] && (
                    <div className="p-3 bg-sky-900/20 border border-sky-700/50 rounded-lg">
                      <p className="text-sky-200 text-sm">
                        <strong className="block mb-1">Background Proficiency</strong>
                        You are automatically proficient in this skill thanks to your {BACKGROUNDS[selectedBackground].name} background.
                      </p>
                    </div>
                  )}

                  {/* Skill description placeholder */}
                  <p className="text-gray-400 text-sm leading-relaxed italic">
                    Proficiency in <strong>{viewedSkill.name}</strong> lets you add your Proficiency Bonus to checks that draw on this skill.
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
