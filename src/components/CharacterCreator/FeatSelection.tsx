// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:27:00
 * Dependents: CharacterCreator.tsx, LevelUpModal.tsx
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Feat Configuration' step. Unlike simple 
 * selection screens, feats can grant complex sets of benefits: Ability 
 * Score Increases (ASI), extra Skill Proficiencies, and even entirely 
 * new spellcasting capabilities (including sub-choice sources like 
 * Magic Initiate).
 *
 * Recent updates focus on '2024 Rulebook Alignment' and 'Choice Routing'.
 * - Expanded the detail view to display 2024-specific passive benefits 
 *   like Proficiency-scaled Initiative and Lucky points.
 * - Integrated `SpellSourceSelector` for feats like Magic Initiate, 
 *   ensuring that players pick their spell list (Wizard, Cleric, Druid) 
 *   before being offered the specific spell pickers.
 * - Improved 'Selection Validity' logic. The `canProceed` check now 
 *   exhaustively validates that all sub-choices (ASI, Skills, Spells) 
 *   are filled before allowing the player to commit the feat.
 * - Added `knownSkillIds` filtering to prevent players from double-dipping 
 *   on proficiencies they already have from their Race or Class.
 * 
 * @file src/components/CharacterCreator/FeatSelection.tsx
 */
import React, { useContext, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence as _AnimatePresence } from 'framer-motion';
import { Feat, MagicInitiateSource, FeatGrantedSpell } from '../../types';
import type { AppAction } from '../../state/actionTypes';
import type { FeatChoiceState, FeatChoiceValue } from './state/characterCreatorState';
import SpellContext from '../../context/SpellContext';
import FeatSpellPicker from './FeatSpellPicker';
import SpellSourceSelector from './SpellSourceSelector';
import { getSchoolIcon } from '../../utils/spellFilterUtils';
import { CreationStepLayout } from './ui/CreationStepLayout';
import { SplitPaneLayout } from '../ui/SplitPaneLayout';
import { SKILLS_DATA } from '../../data/skills';

interface FeatOption extends Feat {
  isEligible: boolean;
  unmet: string[];
}

interface FeatSelectionProps {
  availableFeats: FeatOption[];
  selectedFeatId?: string;
  featChoices?: Record<string, FeatChoiceState>;
  onSelectFeat: (featId: string) => void;
  onSetFeatChoice: (featId: string, choiceType: string, value: FeatChoiceValue) => void;
  onConfirm: () => void;
  onBack?: () => void;
  hasEligibleFeats: boolean;
  dispatch?: React.Dispatch<AppAction>;
  knownSkillIds?: string[];
  allowSkip?: boolean;
}

/**
 * Displays spells that are automatically granted by a feat.
 */
const GrantedSpellsDisplay: React.FC<{ grantedSpells: FeatGrantedSpell[] }> = ({ grantedSpells }) => {
  const allSpells = useContext(SpellContext);
  if (!allSpells) return null;

  const getCastingLabel = (method: FeatGrantedSpell['castingMethod']) => {
    switch (method) {
      case 'at_will': return 'At Will';
      case 'once_per_long_rest': return '1/Long Rest';
      case 'once_per_short_rest': return '1/Short Rest';
      default: return '';
    }
  };

  return (
    <div className="space-y-2 mt-4">
      <h4 className="text-amber-300/80 text-sm font-medium border-b border-gray-700 pb-1">Automatically Granted Spells</h4>
      <div className="flex flex-wrap gap-2 pt-1">
        {grantedSpells.map((granted) => {
          const spell = allSpells[granted.spellId];
          return (
            <div
              key={granted.spellId}
              className="flex items-center gap-2 px-3 py-2 bg-green-900/30 border border-green-700/50 rounded-lg"
            >
              <span className="text-lg">{spell ? getSchoolIcon(spell.school || '') : '\u{1F4DC}'}</span>
              <div>
                <span className="text-green-300 font-medium text-sm block">{spell?.name || granted.spellId}</span>
                <span className="text-xs text-green-500/80 block">{getCastingLabel(granted.castingMethod)}</span>
              </div>
              {granted.specialNotes && (
                <span className="text-xs text-gray-500 italic ml-1">{granted.specialNotes}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FeatSelection: React.FC<FeatSelectionProps> = ({
  availableFeats,
  selectedFeatId,
  featChoices = {},
  onSelectFeat,
  onSetFeatChoice,
  onConfirm,
  onBack,
  hasEligibleFeats,
  dispatch,
  knownSkillIds = [],
  allowSkip = true,
}) => {
  const [viewedFeatId, setViewedFeatId] = useState<string | null>(
    selectedFeatId || availableFeats.find(f => f.isEligible)?.id || availableFeats[0]?.id || null
  );
  const [showEligibleOnly, setShowEligibleOnly] = useState(false);

  // Sync viewed feat when selection changes externally
  useEffect(() => {
    if (selectedFeatId) setViewedFeatId(selectedFeatId);
  }, [selectedFeatId]);

  const selectionRequired = !allowSkip;

  // === Selected feat derivations (for interactive pickers) ===
  const selectedFeat = selectedFeatId ? availableFeats.find(f => f.id === selectedFeatId) : null;
  const selectableASIs = selectedFeat?.benefits?.selectableAbilityScores ?? [];
  const hasSelectableASI = selectableASIs.length > 0;
  const selectedASI = selectedFeatId ? featChoices[selectedFeatId]?.selectedAbilityScore : undefined;
  const selectableDamageTypes = selectedFeat?.benefits?.selectableDamageTypes ?? [];
  const hasSelectableDamageType = selectableDamageTypes.length > 0;
  const selectedDamageType = selectedFeatId ? featChoices[selectedFeatId]?.selectedDamageType : undefined;
  const selectableSkillCount = selectedFeat?.benefits?.selectableSkillCount ?? 0;
  const hasSelectableSkills = selectableSkillCount > 0;
  const selectedSkills = (selectedFeatId ? featChoices[selectedFeatId]?.selectedSkills : []) || [];
  const areSkillChoicesComplete = selectedSkills.length === selectableSkillCount;
  const spellBenefits = selectedFeat?.benefits?.spellBenefits;
  const hasSpellBenefits = !!spellBenefits;
  const currentChoices = selectedFeatId ? featChoices[selectedFeatId] : undefined;
  const selectedSpellSource = currentChoices?.selectedSpellSource as MagicInitiateSource | undefined;

  const areSpellChoicesComplete = (() => {
    if (!spellBenefits) return true;
    if (spellBenefits.selectableSpellSource && !selectedSpellSource) return false;
    for (const requirement of spellBenefits.spellChoices || []) {
      const choiceKey = requirement.level === 0 ? 'selectedCantrips' : 'selectedLeveledSpells';
      const selections = (currentChoices?.[choiceKey] as string[]) || [];
      if (selections.length !== requirement.count) return false;
    }
    return true;
  })();

  /** True when the selected feat has all required choices filled in. */
  const isFeatFullyConfigured: boolean = !!selectedFeatId && (
    (!hasSelectableASI || !!selectedASI) &&
    (!hasSelectableDamageType || !!selectedDamageType) &&
    (!hasSpellBenefits || areSpellChoicesComplete) &&
    (!hasSelectableSkills || areSkillChoicesComplete)
  );

  const canProceed = !(
    (selectionRequired && !selectedFeatId) ||
    (!!selectedFeatId && !availableFeats.find(f => f.id === selectedFeatId)?.isEligible) ||
    (hasSelectableASI && !selectedASI) ||
    (hasSelectableDamageType && !selectedDamageType) ||
    (hasSpellBenefits && !areSpellChoicesComplete) ||
    (hasSelectableSkills && !areSkillChoicesComplete)
  );

  // === Viewed feat derivations (for static display in detail pane) ===
  const viewedFeat = viewedFeatId ? availableFeats.find(f => f.id === viewedFeatId) : null;
  /** True when the detail pane is showing the feat that is also currently selected. */
  const isViewingSelected = !!selectedFeatId && viewedFeatId === selectedFeatId;
  const viewedBenefits = viewedFeat?.benefits ?? null;
  const viewedSelectableASIs = viewedBenefits?.selectableAbilityScores ?? [];
  const viewedSelectableDamageTypes = viewedBenefits?.selectableDamageTypes ?? [];
  const viewedSelectableSkillCount = viewedBenefits?.selectableSkillCount ?? 0;
  const viewedSpellBenefits = viewedBenefits?.spellBenefits;
  const viewedHasInteractiveChoices =
    viewedSelectableASIs.length > 0 ||
    viewedSelectableDamageTypes.length > 0 ||
    viewedSelectableSkillCount > 0 ||
    !!viewedSpellBenefits;
  const viewedHasPassiveBenefits = !!(
    viewedBenefits?.speedIncrease ||
    viewedBenefits?.initiativeBonus ||
    viewedBenefits?.initiativeBonusProficiency ||
    viewedBenefits?.damageReductionProficiency ||
    viewedBenefits?.heavyWeaponProficiencyBonus ||
    viewedBenefits?.luckyPoints
  );

  // === Handlers ===
  const handleSelect = (featId: string) => {
    const newFeatId = selectedFeatId === featId ? '' : featId;
    // Clear choices when switching feats
    if (selectedFeatId && selectedFeatId !== newFeatId) {
      onSetFeatChoice(selectedFeatId, 'selectedCantrips', []);
      onSetFeatChoice(selectedFeatId, 'selectedLeveledSpells', []);
      onSetFeatChoice(selectedFeatId, 'selectedSpellSource', undefined);
      onSetFeatChoice(selectedFeatId, 'selectedSkills', []);
    }
    onSelectFeat(newFeatId);
  };

  const handleSkip = () => {
    const featCleared = !!selectedFeatId;
    onSelectFeat('');
    if (featCleared && dispatch) {
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: { message: 'Feat selection skipped.', type: 'info', duration: 3000 },
      });
    }
    onConfirm();
  };

  const handleSpellSourceChange = useCallback((source: MagicInitiateSource) => {
    if (!selectedFeatId) return;
    // WHAT CHANGED: Clear previous spell selections when the source class changes.
    // WHY IT CHANGED: For feats like Magic Initiate, the available spells 
    // are dependent on the chosen class (e.g., Wizard vs Druid). If a 
    // player picks Wizard spells and then switches the source to Druid, 
    // we must clear the list to prevent invalid character states.
    if (selectedSpellSource !== source) {
      onSetFeatChoice(selectedFeatId, 'selectedCantrips', []);
      onSetFeatChoice(selectedFeatId, 'selectedLeveledSpells', []);
    }
    onSetFeatChoice(selectedFeatId, 'selectedSpellSource', source);
  }, [selectedFeatId, selectedSpellSource, onSetFeatChoice]);

  const handleSkillToggle = (skillId: string) => {
    if (!selectedFeatId) return;
    // WHAT CHANGED: Added multi-skill selection logic.
    // WHY IT CHANGED: Some 2024 feats (like Skilled) allow multiple skill 
    // choices. This handler manages a set of IDs and enforces the 
    // `selectableSkillCount` limit defined in the feat data, ensuring 
    // the player doesn't exceed their allowance.
    const currentList = (featChoices[selectedFeatId]?.selectedSkills as string[]) || [];
    let newList: string[];
    if (currentList.includes(skillId)) {
      newList = currentList.filter(id => id !== skillId);
    } else {
      if (currentList.length >= selectableSkillCount) return;
      newList = [...currentList, skillId];
    }
    onSetFeatChoice(selectedFeatId, 'selectedSkills', newList);
  };

  // Filtered feat list
  const displayedFeats = showEligibleOnly ? availableFeats.filter(f => f.isEligible) : availableFeats;

  return (
    <CreationStepLayout
      title="Select a Feat"
      onBack={onBack}
      onNext={onConfirm}
      canProceed={canProceed}
      nextLabel="Confirm Feat"
      bodyScrollable={false}
    >
      <div className="h-full min-h-0">
        <SplitPaneLayout
          controls={
            <div className="flex flex-col h-full min-h-0">

              {/* Filter bar */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700/50 flex-shrink-0">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Feats</span>
                <button
                  onClick={() => setShowEligibleOnly(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                  title={showEligibleOnly ? 'Show all feats' : 'Show eligible feats only'}
                >
                  <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors flex-shrink-0 ${showEligibleOnly ? 'bg-amber-600' : 'bg-gray-600'}`}>
                    <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${showEligibleOnly ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </span>
                  Eligible only
                </button>
              </div>

              {/* Feat list — scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 -mx-1 px-1">
                {!hasEligibleFeats && (
                  <div className="mb-2 text-xs text-amber-200 bg-amber-900/30 border border-amber-700/60 rounded p-2">
                    No eligible feats available.
                  </div>
                )}
                {showEligibleOnly && displayedFeats.length === 0 && (
                  <p className="text-xs text-gray-500 italic text-center py-4">No eligible feats found.</p>
                )}
                {displayedFeats.map(feat => {
                  const isSelected = feat.id === selectedFeatId;
                  const isViewed = feat.id === viewedFeatId;

                  return (
                    <button
                      key={feat.id}
                      onClick={() => {
                        setViewedFeatId(feat.id);
                        if (feat.isEligible) handleSelect(feat.id);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 border flex flex-col gap-0.5 ${
                        isSelected && isFeatFullyConfigured
                          ? 'bg-green-900/25 border-green-600/50 shadow-sm'
                          : isSelected
                            ? 'bg-amber-900/25 border-amber-500/50 shadow-sm'
                            : isViewed
                              ? 'bg-gray-700/50 border-gray-500/40'
                              : feat.isEligible
                                ? 'bg-gray-800 border-transparent hover:bg-gray-700/70 hover:border-gray-600/50'
                                : 'bg-gray-800/40 border-transparent opacity-60 hover:opacity-80 hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex justify-between items-center gap-2 w-full">
                        <span className={`font-medium text-sm leading-tight ${
                          isSelected && isFeatFullyConfigured ? 'text-green-300' :
                          isSelected ? 'text-amber-300' :
                          feat.isEligible ? 'text-gray-200' : 'text-gray-500'
                        }`}>
                          {feat.name}
                        </span>
                        {isSelected && (
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${
                            isFeatFullyConfigured
                              ? 'text-green-300 bg-green-900/50'
                              : 'text-amber-300 bg-amber-900/50'
                          }`}>
                            {isFeatFullyConfigured ? 'Ready' : 'Setup'}
                          </span>
                        )}
                      </div>
                      {!feat.isEligible ? (
                        <span className="text-[11px] text-red-400/60 italic">Prerequisites not met</span>
                      ) : feat.description ? (
                        <span className="text-[11px] text-gray-500 leading-tight truncate block">
                          {feat.description.length > 68 ? feat.description.slice(0, 68) + '\u2026' : feat.description}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Skip — pinned at bottom of list pane */}
              {allowSkip && (
                <div className="flex-shrink-0 pt-3 mt-2 border-t border-gray-700/50">
                  <button
                    onClick={handleSkip}
                    className="w-full text-sm text-gray-500 hover:text-gray-300 py-2 rounded-lg hover:bg-gray-700/40 transition-colors"
                  >
                    Skip feat selection
                  </button>
                </div>
              )}
            </div>
          }
          preview={
            viewedFeat ? (
              <motion.div
                key={viewedFeat.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
              >
                {/* Header: name + status badge */}
                <div className="flex justify-between items-start mb-4 border-b border-gray-700 pb-4 flex-shrink-0 gap-4">
                  <div className="min-w-0">
                    <h2 className="text-3xl font-bold text-amber-400 font-cinzel mb-2">{viewedFeat.name}</h2>
                    {viewedFeat.prerequisites && (
                      <div className="text-sm text-gray-400">
                        <span className="font-semibold text-gray-500 uppercase text-xs tracking-wider mr-2">Prerequisite:</span>
                        {(() => {
                          const p = viewedFeat.prerequisites;
                          const list: string[] = [];
                          if (p.minLevel) list.push(`Level ${p.minLevel}`);
                          if (p.abilityScores) {
                            Object.entries(p.abilityScores).forEach(([k, v]) =>
                              list.push(`${k.substring(0, 3).toUpperCase()} ${v}`)
                            );
                          }
                          if (p.raceId) list.push(`Race: ${p.raceId}`);
                          if (p.classId) list.push(`Class: ${p.classId}`);
                          if (p.requiresFightingStyle) list.push(`Fighting Style`);
                          return list.length > 0 ? list.join(', ') : 'None';
                        })()}
                      </div>
                    )}
                  </div>
                  {/* Status badge — read-only, selection happens via list click */}
                  <div className="flex-shrink-0">
                    {!viewedFeat.isEligible ? (
                      <div className="px-3 py-1.5 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
                        Unavailable
                      </div>
                    ) : isViewingSelected ? (
                      <div className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${
                        isFeatFullyConfigured
                          ? 'bg-green-900/30 border-green-600/50 text-green-300'
                          : 'bg-amber-900/30 border-amber-600/50 text-amber-300'
                      }`}>
                        {isFeatFullyConfigured ? 'Selected' : 'Configuring...'}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Description */}
                <div className="prose prose-invert max-w-none text-gray-300 text-sm leading-relaxed mb-6">
                  <p>{viewedFeat.description}</p>
                </div>

                {/* Unmet prerequisites */}
                {!viewedFeat.isEligible && viewedFeat.unmet.length > 0 && (
                  <div className="mb-6 p-4 bg-red-900/20 border border-red-700/50 rounded-lg flex-shrink-0">
                    <h4 className="text-red-400 font-bold mb-2 text-sm">Prerequisites Not Met:</h4>
                    <ul className="list-disc list-inside text-red-300/80 text-sm space-y-0.5">
                      {viewedFeat.unmet.map(reason => <li key={reason}>{reason}</li>)}
                    </ul>
                  </div>
                )}

                {/* Feat Features */}
                {viewedBenefits && (
                  <div className="space-y-4 flex-grow overflow-y-auto pr-1">
                    <h3 className="text-base font-cinzel text-sky-400 border-b border-gray-700 pb-1">Feat Features</h3>

                    {/* Passive benefits */}
                    {viewedHasPassiveBenefits && (
                      <ul className="space-y-1.5 text-sm text-gray-300">
                        {viewedBenefits.speedIncrease && (
                          <li className="flex items-start gap-2">
                            <span className="text-green-400 font-bold mt-0.5 leading-none">+</span>
                            Speed increases by {viewedBenefits.speedIncrease} ft.
                          </li>
                        )}
                        {viewedBenefits.initiativeBonus && (
                          <li className="flex items-start gap-2">
                            <span className="text-green-400 font-bold mt-0.5 leading-none">+</span>
                            +{viewedBenefits.initiativeBonus} bonus to initiative rolls.
                          </li>
                        )}
                        {viewedBenefits.initiativeBonusProficiency && (
                          <li className="flex items-start gap-2">
                            <span className="text-green-400 font-bold mt-0.5 leading-none">+</span>
                            Add your Proficiency Bonus to Initiative rolls (scales with level).
                          </li>
                        )}
                        {viewedBenefits.damageReductionProficiency && (
                          <li className="flex items-start gap-2">
                            <span className="text-green-400 font-bold mt-0.5 leading-none">+</span>
                            Reduce nonmagical physical damage taken by your Proficiency Bonus.
                          </li>
                        )}
                        {viewedBenefits.heavyWeaponProficiencyBonus && (
                          <li className="flex items-start gap-2">
                            <span className="text-green-400 font-bold mt-0.5 leading-none">+</span>
                            Add your Proficiency Bonus as bonus damage on every Heavy weapon hit.
                          </li>
                        )}
                        {viewedBenefits.luckyPoints && (
                          <li className="flex items-start gap-2">
                            <span className="text-green-400 font-bold mt-0.5 leading-none">+</span>
                            Gain Luck Points equal to your Proficiency Bonus (Long Rest reset).
                          </li>
                        )}
                      </ul>
                    )}

                    {/* Interactive choice summaries — descriptive, always visible */}
                    {viewedHasInteractiveChoices && (
                      <ul className="space-y-1.5 text-sm text-gray-300">
                        {viewedSelectableASIs.length > 0 && (
                          <li className="flex items-start gap-2">
                            <span className="text-sky-400 font-bold mt-0.5 leading-none">+</span>
                            Ability Score Increase: +1 to one of {viewedSelectableASIs.join(', ')}.
                          </li>
                        )}
                        {viewedSelectableDamageTypes.length > 0 && (
                          <li className="flex items-start gap-2">
                            <span className="text-sky-400 font-bold mt-0.5 leading-none">+</span>
                            Choose a damage type affinity ({viewedSelectableDamageTypes.length} options).
                          </li>
                        )}
                        {viewedSelectableSkillCount > 0 && (
                          <li className="flex items-start gap-2">
                            <span className="text-sky-400 font-bold mt-0.5 leading-none">+</span>
                            Gain proficiency in {viewedSelectableSkillCount} additional skill{viewedSelectableSkillCount > 1 ? 's' : ''}.
                          </li>
                        )}
                        {viewedSpellBenefits && (
                          <li className="flex items-start gap-2">
                            <span className="text-sky-400 font-bold mt-0.5 leading-none">+</span>
                            Grants access to spells (cantrips and/or leveled).
                          </li>
                        )}
                      </ul>
                    )}

                    {/* Fallback when there are no listable benefits at all */}
                    {!viewedHasPassiveBenefits && !viewedHasInteractiveChoices && (
                      <p className="text-sm text-gray-500 italic">See description above for full feature details.</p>
                    )}

                    {/* Interactive configuration — only when this feat is selected */}
                    {isViewingSelected && (
                      <div className="bg-gray-900/40 border border-gray-700 rounded-xl p-4 space-y-6">
                        {/* Incomplete-choices nudge */}
                        {!isFeatFullyConfigured && (
                          <div className="px-3 py-2 bg-amber-900/25 border border-amber-600/40 rounded-lg text-amber-300 text-xs">
                            Complete your choices below to finalize this feat.
                          </div>
                        )}

                        {/* ASI selection */}
                        {hasSelectableASI && (
                          <div>
                            <h4 className="text-sm font-bold text-gray-300 mb-2">Ability Score Increase</h4>
                            <div className="flex flex-wrap gap-2">
                              {selectableASIs.map(ability => (
                                <button
                                  key={ability}
                                  onClick={() => onSetFeatChoice(selectedFeatId!, 'selectedAbilityScore', ability)}
                                  className={`px-3 py-2 rounded border text-sm transition-colors ${
                                    selectedASI === ability
                                      ? 'bg-amber-600 border-amber-400 text-white'
                                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                  }`}
                                >
                                  {ability} +1
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Skill selection */}
                        {hasSelectableSkills && (
                          <div>
                            <h4 className="text-sm font-bold text-gray-300 mb-2">
                              Select {selectableSkillCount} Skill{selectableSkillCount > 1 ? 's' : ''}{' '}
                              <span className="text-gray-500 font-normal">({selectedSkills.length}/{selectableSkillCount})</span>
                            </h4>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-900/50 rounded border border-gray-700">
                              {Object.values(SKILLS_DATA).map(skill => {
                                const isKnown = knownSkillIds.includes(skill.id);
                                const isSkillSelected = selectedSkills.includes(skill.id);
                                const isMaxed = selectedSkills.length >= selectableSkillCount;
                                return (
                                  <button
                                    key={skill.id}
                                    disabled={isKnown || (!isSkillSelected && isMaxed)}
                                    onClick={() => handleSkillToggle(skill.id)}
                                    className={`px-2 py-1.5 rounded text-xs text-left border ${
                                      isKnown
                                        ? 'bg-gray-800/50 border-gray-800 text-gray-600 opacity-50'
                                        : isSkillSelected
                                          ? 'bg-amber-700 border-amber-500 text-white'
                                          : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                    }`}
                                  >
                                    {skill.name} {isKnown && '\u2713'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Spell selections */}
                        {hasSpellBenefits && spellBenefits && (
                          <div className="space-y-4">
                            {spellBenefits.selectableSpellSource && (
                              <SpellSourceSelector
                                availableSources={spellBenefits.selectableSpellSource}
                                selectedSource={selectedSpellSource}
                                onSourceSelect={handleSpellSourceChange}
                              />
                            )}
                            {spellBenefits.grantedSpells && spellBenefits.grantedSpells.length > 0 && (
                              <GrantedSpellsDisplay grantedSpells={spellBenefits.grantedSpells} />
                            )}
                            {spellBenefits.spellChoices?.map((requirement, index) => {
                              const needsSource = !!spellBenefits.selectableSpellSource;
                              if (needsSource && !selectedSpellSource) return null;
                              const choiceKey = requirement.level === 0 ? 'selectedCantrips' : 'selectedLeveledSpells';
                              const selections = (currentChoices?.[choiceKey] as string[]) || [];
                              return (
                                <FeatSpellPicker
                                  key={index}
                                  requirement={requirement}
                                  selectedSpellIds={selections}
                                  onSelectionChange={(ids) => onSetFeatChoice(selectedFeatId!, choiceKey, ids)}
                                  selectedSpellSource={selectedSpellSource}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline nudge when browsing an eligible unselected feat that has choices */}
                    {!isViewingSelected && viewedHasInteractiveChoices && viewedFeat.isEligible && (
                      <p className="text-xs text-gray-500 italic border-t border-gray-700/50 pt-3">
                        Click this feat in the list to select it and configure your choices.
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 italic">
                Select a feat to view details
              </div>
            )
          }
        />
      </div>
    </CreationStepLayout>
  );
};

export default FeatSelection;
