// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 27/01/2026, 01:41:52
 * Dependents: CharacterCreator.tsx, LevelUpModal.tsx
 * Imports: 10 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file FeatSelection.tsx
 * Refactored to use Split Config Style (List vs Detail).
 */
import React, { useContext, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { BTN_PRIMARY } from '../../styles/buttonStyles';

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
      case 'at_will':
        return 'At Will';
      case 'once_per_long_rest':
        return '1/Long Rest';
      case 'once_per_short_rest':
        return '1/Short Rest';
      default:
        return '';
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
                <span className="text-green-300 font-medium text-sm block">
                  {spell?.name || granted.spellId}
                </span>
                <span className="text-xs text-green-500/80 block">
                  {getCastingLabel(granted.castingMethod)}
                </span>
              </div>
              {granted.specialNotes && (
                <span className="text-xs text-gray-500 italic ml-1">
                  {granted.specialNotes}
                </span>
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
  // Local state to track which feat is being viewed in the detail pane.
  // Initialize with the selected feat if any, otherwise the first available one.
  const [viewedFeatId, setViewedFeatId] = useState<string | null>(selectedFeatId || availableFeats[0]?.id || null);

  // Sync viewed feat if selection changes externally
  useEffect(() => {
    if (selectedFeatId) {
      setViewedFeatId(selectedFeatId);
    }
  }, [selectedFeatId]);

  const selectionRequired = !allowSkip;

  const handleSelect = (featId: string) => {
    // If selecting the same feat, toggle it off (unless required? No, allow toggle off to clear state)
    // Actually, UI pattern usually implies selection replaces previous.
    // Let's stick to standard behavior: Clicking "Confirm" or "Select" on the detail pane selects it.
    
    const newFeatId = selectedFeatId === featId ? '' : featId;

    // Clear spell and skill choices when feat changes
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
        payload: {
          message: 'Feat selection skipped.',
          type: 'info',
          duration: 3000,
        },
      });
    }
    onConfirm();
  };

  const viewedFeat = viewedFeatId ? availableFeats.find(f => f.id === viewedFeatId) : null;
  
  // TODO: Create a strongly-typed helper (renderFeatPrerequisites) to handle the 'prerequisites' object safely.
  // Logic for validation (reused from previous implementation)
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

  const canProceed = !(
    (selectionRequired && !selectedFeatId) ||
    (!!selectedFeatId && !availableFeats.find(f => f.id === selectedFeatId)?.isEligible) ||
    (hasSelectableASI && !selectedASI) ||
    (hasSelectableDamageType && !selectedDamageType) ||
    (hasSpellBenefits && !areSpellChoicesComplete) ||
    (hasSelectableSkills && !areSkillChoicesComplete)
  );

  // Helper for viewing logic (viewed feat vs selected feat)
  // We need to show interactive choices ONLY if the viewed feat matches the selected feat.
  // Otherwise, we just show the static description.
  const isViewingSelected = viewedFeatId === selectedFeatId;

  // -- Render Helpers for Detail Pane --

  const handleSpellSourceChange = useCallback((source: MagicInitiateSource) => {
    if (!selectedFeatId) return;
    if (selectedSpellSource !== source) {
      onSetFeatChoice(selectedFeatId, 'selectedCantrips', []);
      onSetFeatChoice(selectedFeatId, 'selectedLeveledSpells', []);
    }
    onSetFeatChoice(selectedFeatId, 'selectedSpellSource', source);
  }, [selectedFeatId, selectedSpellSource, onSetFeatChoice]);

  const handleSkillToggle = (skillId: string) => {
    if (!selectedFeatId) return;
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

  const skipButton = allowSkip ? (
    <button
      onClick={handleSkip}
      className="text-gray-400 hover:text-white text-sm font-medium px-3 py-1 rounded hover:bg-gray-700/50 transition-colors"
    >
      Skip
    </button>
  ) : null;

  return (
    <CreationStepLayout
      title="Select a Feat"
      onBack={onBack}
      onNext={onConfirm}
      canProceed={canProceed}
      nextLabel="Confirm Feat"
      customNextButton={skipButton}
      bodyScrollable={false} // Important for SplitPaneLayout to handle scrolling
    >
        <div className="h-full min-h-0">
            <SplitPaneLayout
                controls={
                    <div className="space-y-1">
                        {!hasEligibleFeats && (
                            <div className="mb-2 text-xs text-amber-200 bg-amber-900/30 border border-amber-700/60 rounded p-2">
                                No eligible feats available.
                            </div>
                        )}
                        {availableFeats.map(feat => {
                            const isSelected = feat.id === selectedFeatId;
                            const isViewed = feat.id === viewedFeatId;
                            const disabled = !feat.isEligible;

                            return (
                                <button
                                    key={feat.id}
                                    onClick={() => setViewedFeatId(feat.id)}
                                    disabled={disabled && !isViewed} // Allow viewing disabled feats to see why
                                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 border border-transparent flex flex-col gap-0.5 ${
                                        isViewed
                                            ? 'bg-amber-900/20 border-amber-500/50 text-white shadow-md'
                                            : disabled 
                                                ? 'bg-gray-800/50 text-gray-500'
                                                : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white hover:border-gray-600'
                                    }`}
                                >
                                    <div className="flex justify-between items-center w-full">
                                        <span className={`font-medium ${isSelected ? 'text-amber-400' : ''}`}>{feat.name}</span>
                                        {isSelected && (
                                            <span className="text-amber-500 text-xs font-bold uppercase tracking-wider bg-amber-900/40 px-1.5 py-0.5 rounded">Selected</span>
                                        )}
                                    </div>
                                    {disabled && (
                                        <span className="text-xs text-red-400/80 italic">Prerequisites not met</span>
                                    )}
                                </button>
                            );
                        })}
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
                            <div className="flex justify-between items-start mb-4 border-b border-gray-700 pb-4">
                                <div>
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
                                {!viewedFeat.isEligible ? (
                                    <div className="px-3 py-1 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-sm">
                                        Unavailable
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleSelect(viewedFeat.id)}
                                        className={`px-4 py-2 rounded-lg font-bold shadow-md transition-all ${
                                            selectedFeatId === viewedFeat.id
                                                ? 'bg-green-600 hover:bg-green-500 text-white ring-2 ring-green-400 ring-offset-2 ring-offset-gray-800'
                                                : BTN_PRIMARY
                                        }`}
                                    >
                                        {selectedFeatId === viewedFeat.id ? 'Selected' : 'Select Feat'}
                                    </button>
                                )}
                            </div>

                            <div className="prose prose-invert max-w-none text-gray-300 text-sm leading-relaxed mb-6">
                                <p>{viewedFeat.description}</p>
                            </div>

                            {/* Unmet Reasons */}
                            {!viewedFeat.isEligible && viewedFeat.unmet.length > 0 && (
                                <div className="mb-6 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
                                    <h4 className="text-red-400 font-bold mb-2">Prerequisites Not Met:</h4>
                                    <ul className="list-disc list-inside text-red-300/80 text-sm">
                                        {viewedFeat.unmet.map(reason => <li key={reason}>{reason}</li>)}
                                    </ul>
                                </div>
                            )}

                            {/* Benefits Table / Configuration Area */}
                            {viewedFeat.benefits && (
                                <div className="space-y-6 flex-grow overflow-y-auto pr-2">
                                    <h3 className="text-lg font-cinzel text-sky-400 border-b border-gray-700 pb-1">Feat Features</h3>
                                    
                                    {/* Static Benefits List */}
                                    <ul className="space-y-2 text-sm text-gray-300">
                                        {viewedFeat.benefits.speedIncrease && (
                                            <li className="flex items-start gap-2">
                                                <span className="text-green-400">✓</span> Speed increases by {viewedFeat.benefits.speedIncrease} feet.
                                            </li>
                                        )}
                                        {viewedFeat.benefits.initiativeBonus && (
                                            <li className="flex items-start gap-2">
                                                <span className="text-green-400">✓</span> Gain a +{viewedFeat.benefits.initiativeBonus} bonus to initiative rolls.
                                            </li>
                                        )}
                                        {/* Add other static benefits here as simple list items */}
                                    </ul>

                                    {/* Interactive Selections - Only show if this feat is SELECTED */}
                                    {isViewingSelected ? (
                                        <div className="bg-gray-900/40 border border-gray-700 rounded-xl p-4 space-y-6">
                                            {/* ASI Selection */}
                                            {hasSelectableASI && (
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-300 mb-2">Ability Score Increase</h4>
                                                    <div className="flex gap-2">
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

                                            {/* Skill Selection */}
                                            {hasSelectableSkills && (
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-300 mb-2">
                                                        Select {selectableSkillCount} Skill{selectableSkillCount > 1 ? 's' : ''} ({selectedSkills.length}/{selectableSkillCount})
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-900/50 rounded border border-gray-700">
                                                        {Object.values(SKILLS_DATA).map(skill => {
                                                            const isKnown = knownSkillIds.includes(skill.id);
                                                            const isSelected = selectedSkills.includes(skill.id);
                                                            const isMaxed = selectedSkills.length >= selectableSkillCount;
                                                            return (
                                                                <button
                                                                    key={skill.id}
                                                                    disabled={isKnown || (!isSelected && isMaxed)}
                                                                    onClick={() => handleSkillToggle(skill.id)}
                                                                    className={`px-2 py-1.5 rounded text-xs text-left border ${
                                                                        isKnown ? 'bg-gray-800/50 border-gray-800 text-gray-600 opacity-50' :
                                                                        isSelected ? 'bg-amber-700 border-amber-500 text-white' :
                                                                        'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                                                    }`}
                                                                >
                                                                    {skill.name} {isKnown && '✓'}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Spell Selections */}
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
                                    ) : (
                                        <div className="p-4 bg-gray-800/50 border border-dashed border-gray-600 rounded-xl text-center text-gray-400 text-sm">
                                            Select this feat to configure options.
                                        </div>
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