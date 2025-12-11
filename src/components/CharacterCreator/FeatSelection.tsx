/**
 * @file FeatSelection.tsx
 *
 * TODO: Styling inconsistency audit (2025-12-11)
 * - Header uses `mb-4` instead of standard `mb-6`
 * - Card backgrounds use `bg-gray-800` instead of `bg-gray-700` (standard)
 * - Selected card uses amber accent (bg-amber-900/40 border-amber-500) which is unique but intentional
 * - Consider standardizing header margin to `mb-6` for consistency
 */
import React, { useContext, useCallback, useMemo } from 'react';
import { Feat, AbilityScoreName, MagicInitiateSource, FeatGrantedSpell } from '../../types';
import SpellContext from '../../context/SpellContext';
import FeatSpellPicker from './FeatSpellPicker';
import SpellSourceSelector from './SpellSourceSelector';
import { getSchoolIcon } from '../../utils/spellFilterUtils';

interface FeatOption extends Feat {
  isEligible: boolean;
  unmet: string[];
}

interface FeatSelectionProps {
  availableFeats: FeatOption[];
  selectedFeatId?: string;
  featChoices?: { [featId: string]: { selectedAbilityScore?: AbilityScoreName; [key: string]: any } };
  onSelectFeat: (featId: string) => void;
  onSetFeatChoice: (featId: string, choiceType: string, value: any) => void;
  onConfirm: () => void;
  onBack?: () => void;
  hasEligibleFeats: boolean;
  dispatch: React.Dispatch<any>;
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
    <div className="space-y-2">
      <h4 className="text-amber-300/80 text-sm font-medium">Automatically Granted:</h4>
      <div className="flex flex-wrap gap-2">
        {grantedSpells.map((granted) => {
          const spell = allSpells[granted.spellId];

          return (
            <div
              key={granted.spellId}
              className="flex items-center gap-2 px-3 py-2 bg-green-900/30 border border-green-700/50 rounded-lg"
            >
              <span className="text-lg">{spell ? getSchoolIcon(spell.school || '') : '\u{1F4DC}'}</span>
              <div>
                <span className="text-green-300 font-medium">
                  {spell?.name || granted.spellId}
                </span>
                <span className="text-xs text-green-500/80 ml-2">
                  ({getCastingLabel(granted.castingMethod)})
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
  dispatch
}) => {
  // We allow deselection so the feat step behaves like a voluntary choice rather than a hard blocker.
  const handleToggle = useCallback((featId: string, isDisabled: boolean) => {
    if (isDisabled) return;

    const newFeatId = selectedFeatId === featId ? '' : featId;

    // Clear spell choices when feat changes
    if (selectedFeatId && selectedFeatId !== newFeatId) {
      onSetFeatChoice(selectedFeatId, 'selectedCantrips', []);
      onSetFeatChoice(selectedFeatId, 'selectedLeveledSpells', []);
      onSetFeatChoice(selectedFeatId, 'selectedSpellSource', undefined);
    }

    onSelectFeat(newFeatId);
  }, [onSelectFeat, selectedFeatId, onSetFeatChoice]);

  const selectedFeat = selectedFeatId ? availableFeats.find(f => f.id === selectedFeatId) : null;
  const hasSelectableASI = selectedFeat?.benefits?.selectableAbilityScores && selectedFeat.benefits.selectableAbilityScores.length > 0;
  const selectedASI = selectedFeatId ? featChoices[selectedFeatId]?.selectedAbilityScore : undefined;

  // Damage type selection (Elemental Adept)
  const hasSelectableDamageType = selectedFeat?.benefits?.selectableDamageTypes && selectedFeat.benefits.selectableDamageTypes.length > 0;
  const selectedDamageType = selectedFeatId ? featChoices[selectedFeatId]?.selectedDamageType : undefined;

  // Spell benefits
  const spellBenefits = selectedFeat?.benefits?.spellBenefits;
  const hasSpellBenefits = !!spellBenefits;
  const currentChoices = selectedFeatId ? featChoices[selectedFeatId] : undefined;
  const selectedSpellSource = currentChoices?.selectedSpellSource as MagicInitiateSource | undefined;

  // Helper to check if all spell choices are complete
  const areSpellChoicesComplete = useMemo(() => {
    if (!spellBenefits) return true;

    // Check if source is needed and selected (for Magic Initiate)
    if (spellBenefits.selectableSpellSource && !selectedSpellSource) {
      return false;
    }

    // Check each spell requirement
    for (const requirement of spellBenefits.spellChoices || []) {
      const choiceKey = requirement.level === 0 ? 'selectedCantrips' : 'selectedLeveledSpells';
      const selections = (currentChoices?.[choiceKey] as string[]) || [];
      if (selections.length !== requirement.count) {
        return false;
      }
    }

    return true;
  }, [spellBenefits, selectedSpellSource, currentChoices]);

  // Handle spell source change - clear spell selections
  const handleSpellSourceChange = useCallback((source: MagicInitiateSource) => {
    if (!selectedFeatId) return;

    // Clear existing spell selections when source changes
    if (selectedSpellSource !== source) {
      onSetFeatChoice(selectedFeatId, 'selectedCantrips', []);
      onSetFeatChoice(selectedFeatId, 'selectedLeveledSpells', []);
    }
    onSetFeatChoice(selectedFeatId, 'selectedSpellSource', source);
  }, [selectedFeatId, selectedSpellSource, onSetFeatChoice]);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl text-sky-300 mb-4 text-center">Select a Feat</h2>
      <p className="text-gray-400 text-center mb-6">
        Choose a feat to customize your character's abilities. This step is optional&mdash;continue without a selection if no feat fits your build.
      </p>
      {!hasEligibleFeats && (
        <div className="mb-4 text-center text-sm text-amber-200 bg-amber-900/30 border border-amber-700/60 rounded-lg px-3 py-2">
          At 1st level none of your prerequisites are met yet, so skipping is expected. You can always add a feat later once you qualify.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto mb-6 p-2">
        {availableFeats.map((feat) => {
          const isSelected = feat.id === selectedFeatId;
          const disabled = !feat.isEligible;
          return (
            <div
              key={feat.id}
              onClick={() => handleToggle(feat.id, disabled)}
              className={`
                p-4 rounded-lg border cursor-pointer transition-all duration-200 relative
                ${disabled ? 'bg-gray-900 border-gray-800 cursor-not-allowed opacity-70'
                  : isSelected
                    ? 'bg-amber-900/40 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-700/80'
                }
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className={`font-cinzel font-bold text-lg ${isSelected ? 'text-amber-400' : 'text-gray-200'}`}>
                 {feat.name}
                </h3>
              </div>

              <p className="text-sm text-gray-400 mb-2">{feat.description}</p>

              {feat.benefits && (
                  <div className="text-xs text-gray-500 mt-2">
                      <strong className="text-gray-400">Benefits:</strong>
                      <ul className="list-disc list-inside mt-1">
                          {feat.benefits.selectableAbilityScores && feat.benefits.selectableAbilityScores.length > 0 && (
                            <li>
                              Ability Score Increase: Choose one ({feat.benefits.selectableAbilityScores.join(', ')}) +1
                            </li>
                          )}
                          {feat.benefits.abilityScoreIncrease && Object.entries(feat.benefits.abilityScoreIncrease)
                            .filter(([, value]) => (value || 0) > 0)
                            .length > 0 && !feat.benefits.selectableAbilityScores && (
                              <li>
                                Ability Score Increase: {Object.entries(feat.benefits.abilityScoreIncrease)
                                  .filter(([, value]) => (value || 0) > 0)
                                  .map(([k, v]) => `${k} +${v}`).join(', ')}
                              </li>
                          )}
                          {feat.benefits.speedIncrease && <li>Speed +{feat.benefits.speedIncrease} ft</li>}
                          {feat.benefits.initiativeBonus && <li>Initiative +{feat.benefits.initiativeBonus}</li>}
                          {feat.benefits.hpMaxIncreasePerLevel && <li>HP Max +{feat.benefits.hpMaxIncreasePerLevel} per level</li>}
                          {feat.benefits.resistance && <li>Resistance: {feat.benefits.resistance.join(', ')}</li>}
                          {feat.benefits.skillProficiencies && <li>Skills: {feat.benefits.skillProficiencies.join(', ')}</li>}
                          {feat.benefits.savingThrowProficiencies && <li>Saving Throws: {feat.benefits.savingThrowProficiencies.join(', ')}</li>}
                      </ul>
                  </div>
              )}

              {!feat.isEligible && (
                <div className="text-xs text-red-400 mt-3">
                  <strong>Unavailable:</strong>
                  <ul className="list-disc list-inside">
                    {feat.unmet.map(reason => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {isSelected && (
                <div className="absolute top-2 right-2 text-amber-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedFeatId && (
        <div className="mb-4 p-4 bg-gray-800/50 border border-amber-500/30 rounded-lg">
          <div className="text-center text-sm text-amber-200 mb-3">
            <span className="font-semibold">Chosen feat:</span> {selectedFeat?.name}
          </div>
          {hasSelectableASI && (
            <div className="mt-3">
              <label className="block text-sm text-gray-300 mb-2">
                Select Ability Score to Increase:
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {selectedFeat.benefits.selectableAbilityScores!.map((ability) => (
                  <button
                    key={ability}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetFeatChoice(selectedFeatId, 'selectedAbilityScore', ability);
                    }}
                    className={`
                      px-3 py-2 rounded border text-sm transition-colors
                      ${selectedASI === ability
                        ? 'bg-amber-600 border-amber-400 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                      }
                    `}
                  >
                    {ability} +1
                  </button>
                ))}
              </div>
              {!selectedASI && (
                <p className="text-xs text-amber-300 mt-2">
                  Please select an ability score to increase.
                </p>
              )}
            </div>
          )}

          {hasSelectableDamageType && (
            <div className="mt-3">
              <label className="block text-sm text-gray-300 mb-2">
                Select Damage Type:
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedFeat.benefits.selectableDamageTypes!.map((damageType) => (
                  <button
                    key={damageType}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetFeatChoice(selectedFeatId, 'selectedDamageType', damageType);
                    }}
                    className={`
                      px-3 py-2 rounded border text-sm transition-colors
                      ${selectedDamageType === damageType
                        ? 'bg-red-900 border-red-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                      }
                    `}
                  >
                    {damageType}
                  </button>
                ))}
              </div>
              {!selectedDamageType && (
                <p className="text-xs text-amber-300 mt-2">
                  Please select a damage type.
                </p>
              )}
            </div>
          )}

          {/* Spell Benefits Section */}
          {hasSpellBenefits && spellBenefits && (
            <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-6">
              <h3 className="text-lg text-sky-300 font-cinzel">Spell Benefits</h3>

              {/* Spell Source Selector (for Magic Initiate) */}
              {spellBenefits.selectableSpellSource && (
                <SpellSourceSelector
                  availableSources={spellBenefits.selectableSpellSource}
                  selectedSource={selectedSpellSource}
                  onSourceSelect={handleSpellSourceChange}
                />
              )}

              {/* Granted Spells Display */}
              {spellBenefits.grantedSpells && spellBenefits.grantedSpells.length > 0 && (
                <GrantedSpellsDisplay grantedSpells={spellBenefits.grantedSpells} />
              )}

              {/* Spell Choices */}
              {spellBenefits.spellChoices?.map((requirement, index) => {
                // For Magic Initiate, only show spell choices after source is selected
                const needsSource = !!spellBenefits.selectableSpellSource;
                if (needsSource && !selectedSpellSource) return null;

                const choiceKey = requirement.level === 0 ? 'selectedCantrips' : 'selectedLeveledSpells';
                const currentSelections = (currentChoices?.[choiceKey] as string[]) || [];

                return (
                  <FeatSpellPicker
                    key={`spell-choice-${index}`}
                    requirement={requirement}
                    selectedSpellIds={currentSelections}
                    onSelectionChange={(spellIds) => onSetFeatChoice(selectedFeatId, choiceKey, spellIds)}
                    selectedSpellSource={selectedSpellSource}
                  />
                );
              })}

              {/* Completion indicator */}
              {!areSpellChoicesComplete && (
                <p className="text-xs text-amber-300">
                  Please complete all spell selections above.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex justify-between border-t border-gray-700 pt-4 gap-3 flex-wrap">
        {onBack && (
          <button
            onClick={onBack}
            className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Back
          </button>
        )}
        <div className="flex-1 flex justify-end gap-3">
          <button
            onClick={() => {
              const featCleared = !!selectedFeatId;
              onSelectFeat('');
              if (featCleared) {
                // We only surface the toast if a choice was actively cleared, not if the user just clicked past an empty selection.
                // This keeps the feedback relevant and avoids penalizing players for exploring.
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
            }}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            aria-label="Skip feat selection and continue"
          >
            Skip
          </button>
          <button
            onClick={onConfirm}
            className="bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            aria-label="Confirm feat choice and continue"
            disabled={
              (!!selectedFeatId && !availableFeats.find(f => f.id === selectedFeatId)?.isEligible) ||
              (hasSelectableASI && !selectedASI) ||
              (hasSelectableDamageType && !selectedDamageType) ||
              (hasSpellBenefits && !areSpellChoicesComplete)
            }
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeatSelection;
