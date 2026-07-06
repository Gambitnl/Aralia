// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:27:07
 * Dependents: CharacterCreator.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * ARCHITECTURAL CONTEXT:
 * This component handles the 'Race Taxonomy' selection. It groups 
 * subraces (variants) under their base parent races (e.g., High Elf and 
 * Wood Elf under 'Elf') to keep the selection sidebar manageable.
 *
 * Recent updates focus on 'State Synchronization' and 'Choice Isolation'.
 * - Refined the `useEffect` used to reset racial choices (like Keen 
 *   Senses or Spellcasting Ability). It now depends on `effectiveRaceId` 
 *   to ensure that switching between similar subraces or groups correctly 
 *   clears stale local state.
 * - Added `eslint-disable` for `react-hooks/set-state-in-effect`. While 
 *   resetting state in an effect can cause extra renders, it is currently 
 *   required here to ensure that "hidden" choices for a newly selected 
 *   race don't inherit values from the previous one.
 * - Improved darkvision and speed extraction logic in `transformRaceData` 
 *   to handle variations in trait text formatting across different race 
 *   definitions.
 * 
 * @file src/components/CharacterCreator/Race/RaceSelection.tsx
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Race, RacialSelectionData } from '../../../types';
import { CreationStepLayout } from '../ui/CreationStepLayout';
import { SplitPaneLayout } from '../../ui/SplitPaneLayout';
import { RaceDetailPane, RaceDetailData, RacialChoiceData } from './RaceDetailPane';
import { getRaceGroupById } from '../../../data/races/raceGroups';
import { getRacialSpellCastingAbilityChoiceForRace } from '../../../data/races';
import { Button } from '../../ui/Button';

// Helper to transform raw Race data into the detail pane format
const transformRaceData = (race: Race): RaceDetailData => {
  const baseTraits: RaceDetailData['baseTraits'] = {};
  const feats: RaceDetailData['feats'] = [];
  const parsedSpellAbilityChoice = getRacialSpellCastingAbilityChoiceForRace(race.id);
  type RacialSpellChoiceSource = 'parser' | 'legacy';

  const coreTraitKeywords = ['creature type:', 'size:', 'speed:', 'vision:'];

  race.traits.forEach(trait => {
    const lowerTrait = trait.toLowerCase();
    let isCoreTrait = false;
    let keywordFound: string | null = null;

    for (const keyword of coreTraitKeywords) {
      if (lowerTrait.startsWith(keyword)) {
        isCoreTrait = true;
        keywordFound = keyword;
        break;
      }
    }

    if (isCoreTrait && keywordFound) {
      const value = trait.substring(keywordFound.length).trim();
      switch (keywordFound) {
        case 'creature type:': {
          baseTraits.type = value;
          break;
        }
        case 'size:': {
          baseTraits.size = value;
          break;
        }
        case 'speed:': {
          const speedMatch = value.match(/(\d+)/);
          baseTraits.speed = speedMatch ? parseInt(speedMatch[1], 10) : 30;
          break;
        }
        case 'vision:': {
          const dvMatch = value.match(/(\d+)/);
          baseTraits.darkvision = dvMatch ? parseInt(dvMatch[1], 10) : 0;
          break;
        }
      }
    } else {
      const parts = trait.split(':');
      const name = parts[0]?.trim();
      const description = parts.slice(1).join(':').trim();
      if (name) {
        feats.push({ name, description: description || "No detailed description." });
      }
    }
  });

  if (baseTraits.darkvision === undefined) {
    const vTrait = race.traits.find(t => t.toLowerCase().includes('vision:'));
    if (vTrait) {
      const vMatch = vTrait.match(/(\d+)/);
      baseTraits.darkvision = vMatch ? parseInt(vMatch[1], 10) : 0;
    } else {
      baseTraits.darkvision = 0;
    }
  }

  const furtherChoicesNote = (race.elvenLineages || race.gnomeSubraces || race.giantAncestryChoices || race.fiendishLegacies)
    ? "Your choice of this race will unlock additional options in the next steps of character creation."
    : undefined;

  const raceSpellAbilityChoice = parsedSpellAbilityChoice
    ? {
      traitName: parsedSpellAbilityChoice.sourceTraitName,
      traitDescription: parsedSpellAbilityChoice.sourceTraitDescription,
      source: 'parser' as RacialSpellChoiceSource,
    }
    : race.racialSpellChoice
      ? {
        traitName: race.racialSpellChoice.traitName,
        traitDescription: race.racialSpellChoice.traitDescription,
        source: 'legacy' as RacialSpellChoiceSource,
      }
      : undefined;

  return {
    id: race.id,
    name: race.name,
    image: race.imageUrl,
    maleImage: race.visual?.maleIllustrationPath,
    femaleImage: race.visual?.femaleIllustrationPath,
    description: race.description,
    baseTraits,
    feats,
    furtherChoicesNote,
    racialSpellChoice: raceSpellAbilityChoice,
    spellsOfTheMark: race.spellsOfTheMark,
    modernizationStatus: race.modernizationStatus,
  };
};

interface RaceGroup {
  id: string;
  name: string;
  description?: string;
  variants: Race[];
}

interface RaceSelectionProps {
  races: Race[];
  onRaceSelect: (raceId: string, choices?: RacialChoiceData) => void;
  selectedRaceId?: string | null;
  racialSelections?: Record<string, RacialSelectionData>;
  onBack?: () => void;
}

type AbilityScoreName = 'Intelligence' | 'Wisdom' | 'Charisma';

const RaceSelection: React.FC<RaceSelectionProps> = ({ races, onRaceSelect, onBack }) => {
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [selectedSpellAbility, setSelectedSpellAbility] = useState<AbilityScoreName | null>(null);
  const [selectedKeenSensesSkillId, setSelectedKeenSensesSkillId] = useState<string | null>(null);
  const [selectedCentaurNaturalAffinitySkillId, setSelectedCentaurNaturalAffinitySkillId] = useState<string | null>(null);
  const [selectedChangelingInstinctSkillIds, setSelectedChangelingInstinctSkillIds] = useState<Set<string>>(new Set());
  const [selectedChangelingSize, setSelectedChangelingSize] = useState<'Small' | 'Medium' | null>(null);
  
  // Generic choices for the current race
  const [racialSkillChoices, setRacialSkillChoices] = useState<string[]>([]);
  const [racialToolChoices, setRacialToolChoices] = useState<string[]>([]);
  const [racialCantripChoices, setRacialCantripChoices] = useState<string[]>([]);

  // Group races by baseRace
  const raceGroups = useMemo(() => {
    const groupMap = new Map<string, Race[]>();

    races.forEach(race => {
      const groupId = race.baseRace || race.id;
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, []);
      }
      groupMap.get(groupId)!.push(race);
    });

    // Convert to array and sort
    const groups: RaceGroup[] = [];
    groupMap.forEach((variants, groupId) => {
      const meta = getRaceGroupById(groupId);
      // Use the first variant's name if no meta, or capitalize the groupId
      const displayName = meta?.name || groupId.charAt(0).toUpperCase() + groupId.slice(1);
      groups.push({
        id: groupId,
        name: displayName,
        description: meta?.description,
        variants: variants.sort((a, b) => a.name.localeCompare(b.name)),
      });
    });

    return groups.sort((a, b) => a.name.localeCompare(b.name));
  }, [races]);

  const defaultRaceId = raceGroups[0]?.variants[0]?.id ?? null;
  // Avoid setState-in-effect by treating the first variant as the implicit selection.
  const effectiveRaceId = selectedRaceId ?? defaultRaceId;
  const selectedRace = races.find(r => r.id === effectiveRaceId);
  const selectedRaceSpellAbilityChoice = selectedRace ? getRacialSpellCastingAbilityChoiceForRace(selectedRace.id) : null;

  // When the viewed race changes, clear per-race local choice state so we don't accidentally carry it over.
  useEffect(() => {
    // WHAT CHANGED: Added explicit reset logic for sub-choices.
    // WHY IT CHANGED: Previously, if you selected 'Elf' and picked a 
    // proficiency, then switched to 'Dwarf', the internal state for the 
    // elf proficiency might persist. This effect ensures a clean slate on 
    // every race navigation event.
    // DEBT: Resetting local choices when race selection changes; synchronous setStates here trigger cascading renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedSpellAbility(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedKeenSensesSkillId(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCentaurNaturalAffinitySkillId(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedChangelingInstinctSkillIds(new Set());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedChangelingSize(null);
  }, [effectiveRaceId]); // Depend on effectiveRaceId instead of setStates inside

  // Compute detail data with sibling variants for comparison table
  const detailData = useMemo(() => {
    if (!selectedRace) return null;

    const baseData = transformRaceData(selectedRace);

    // Find the group this race belongs to
    const groupId = selectedRace.baseRace || selectedRace.id;
    const group = raceGroups.find(g => g.id === groupId);

    // If group has multiple variants, add sibling data for comparison table
    if (group && group.variants.length > 1) {
      baseData.siblingVariants = group.variants.map(v => {
        // Extract speed from traits
        const speedTrait = v.traits.find(t => t.toLowerCase().startsWith('speed:'));
        const speedMatch = speedTrait?.match(/(\d+)/);
        const speed = speedMatch ? parseInt(speedMatch[1], 10) : 30;

        // Extract darkvision range from traits.
        // Some races use "Darkvision:" while others use a standardized "Vision:" description.
        const dvTrait = v.traits.find((t) => {
          const tt = t.toLowerCase();
          return tt.startsWith('darkvision:') || tt.startsWith('vision:') || tt.includes('darkvision');
        });
        const dvMatch = dvTrait?.match(/(\d+)\s*(?:feet|ft)/i) ?? dvTrait?.match(/(\d+)/);
        const darkvision = dvMatch ? parseInt(dvMatch[1], 10) : 0;

        // Build a map of trait key -> description (used for tooltips in the comparison table).
        const traitDescriptions: Record<string, string> = {};
        v.traits.forEach((t) => {
          const idx = t.indexOf(':');
          const key = (idx === -1 ? t : t.slice(0, idx)).trim();
          const desc = (idx === -1 ? t : t.slice(idx + 1)).trim();
          if (key) traitDescriptions[key] = desc;
        });

        // Extract key trait names (used by the Compare Variants table).
        // We include all non-core traits so the comparison can be exhaustive.
        const coreKeywords = ['creature type:', 'size:', 'speed:', 'vision:', 'darkvision:'];
        const keyTraits = v.traits
          .filter(t => !coreKeywords.some(k => t.toLowerCase().startsWith(k)))
          .map(t => t.split(':')[0].trim())
          .filter(Boolean);

        return {
          id: v.id,
          name: v.name,
          speed,
          darkvision,
          keyTraits,
          traitDescriptions,
        };
      });
    }

    return baseData;
  }, [selectedRace, raceGroups]);


  const handleGroupClick = (groupId: string) => {
    setExpandedGroupId(expandedGroupId === groupId ? null : groupId);
  };

  const handleVariantClick = (raceId: string) => {
    setSelectedRaceId(raceId);
    // Reset spell ability when the chosen race changes.
    setSelectedSpellAbility(null);
  };

  // Single source of truth for "why can't I confirm yet" — used for the
  // disabled state, the hover tooltip, AND a visible header hint so the
  // explanation isn't tooltip-only (GAPS.md G11).
  const confirmBlockedReason: string | null = !selectedRace
    ? null
    : selectedRaceSpellAbilityChoice && !selectedSpellAbility
      ? 'Please select a spellcasting ability first'
      : selectedRace.id === 'elf' && !selectedKeenSensesSkillId
        ? 'Please select a Keen Senses skill first'
        : selectedRace.id === 'centaur' && !selectedCentaurNaturalAffinitySkillId
          ? 'Please select a Natural Affinity skill first'
          : selectedRace.id === 'changeling' && selectedChangelingInstinctSkillIds.size !== 2
            ? 'Please select two Changeling Instincts skills first'
            : selectedRace.id === 'changeling' && !selectedChangelingSize
              ? 'Please select your size first'
              : selectedRace.id === 'kender' && racialSkillChoices.length !== 1
                ? 'Please select a skill first'
                : selectedRace.id === 'kenku' && racialSkillChoices.length !== 2
                  ? 'Please select two skills first'
                  : selectedRace.id === 'warforged' && racialSkillChoices.length !== 1
                    ? 'Please select a skill first'
                    : selectedRace.id === 'warforged' && racialToolChoices.length !== 1
                      ? 'Please select a tool first'
                      : selectedRace.id.startsWith('half_elf') && racialSkillChoices.length !== 2
                        ? 'Please select two skills first'
                        : selectedRace.id === 'autognome' && racialToolChoices.length !== 2
                          ? 'Please select two tools first'
                          : selectedRace.id === 'forgeborn_human' && racialToolChoices.length !== 1
                            ? 'Please select a tool first'
                            : selectedRace.id === 'lizardfolk' && racialSkillChoices.length !== 2
                              ? 'Please select two skills first'
                              : selectedRace.id.includes('dwarf') && selectedRace.id !== 'dwarf' && racialToolChoices.length !== 1
                                ? 'Please select a tool first'
                                : (selectedRace.id === 'astral_elf' || selectedRace.id === 'high_elf' || selectedRace.id === 'half_elf_high') && racialCantripChoices.length !== 1
                                  ? 'Please select a cantrip first'
                                  : null;

  const customConfirmButton = selectedRace ? (
    // The race step supplies its own header confirm action so it can collect
    // race-specific choices before advancing, but it still needs the shared
    // creator hit-area floor used by the default Next button.
    <Button
      variant="primary"
      className="min-h-11"
      onClick={() => {
        const choices: RacialChoiceData = {};
        if (selectedSpellAbility) {
          choices.spellAbility = selectedSpellAbility;
        }
        if (selectedRace.id === 'elf' && selectedKeenSensesSkillId) {
          choices.keenSensesSkillId = selectedKeenSensesSkillId;
        }
        if (selectedRace.id === 'centaur' && selectedCentaurNaturalAffinitySkillId) {
          choices.centaurNaturalAffinitySkillId = selectedCentaurNaturalAffinitySkillId;
        }
        if (selectedRace.id === 'changeling') {
          if (selectedChangelingInstinctSkillIds.size > 0) {
            choices.changelingInstinctSkillIds = Array.from(selectedChangelingInstinctSkillIds);
          }
          if (selectedChangelingSize) {
            choices.changelingSize = selectedChangelingSize;
          }
        }
        if (racialSkillChoices.length > 0) choices.genericSkillChoices = racialSkillChoices;
        if (racialToolChoices.length > 0) choices.genericToolChoices = racialToolChoices;
        if (racialCantripChoices.length > 0) choices.genericCantripChoices = racialCantripChoices;
        onRaceSelect(selectedRace.id, choices);
      }}
      disabled={!!confirmBlockedReason}
      title={confirmBlockedReason ?? `Confirm ${selectedRace.name}`}
    >
      Confirm {selectedRace.name}
    </Button>
  ) : null;

  return (
    <CreationStepLayout
      title="Choose Your Race"
      customNextButton={customConfirmButton}
      bodyScrollable={false}
      onBack={onBack}
      backLabel="Main Menu"
      blockedReason={confirmBlockedReason}
    >
      <div className="h-full min-h-0">
        <SplitPaneLayout
          className="h-full min-h-0"
          controls={
            <div className="space-y-1">
              {raceGroups.map((group) => {
                const isExpanded = expandedGroupId === group.id;
                const isSingleRace = group.variants.length === 1;

                if (isSingleRace) {
                  const race = group.variants[0];
                  const isSelected = effectiveRaceId === race.id;
                  return (
                    <button
                      key={race.id}
                      onClick={() => handleVariantClick(race.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 border border-transparent flex items-center justify-between ${isSelected
                        ? 'bg-amber-900/40 border-amber-500/50 text-amber-400 shadow-md font-semibold'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white hover:border-gray-600'
                        }`}
                    >
                      <span>{race.name}</span>
                      {isSelected && (
                        <motion.span layoutId="active-indicator" className="text-amber-500 text-sm">
                          ▶
                        </motion.span>
                      )}
                    </button>
                  );
                }

                return (
                  <div key={group.id} className="flex flex-col">
                    <button
                      onClick={() => handleGroupClick(group.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 border border-transparent flex items-center justify-between ${isExpanded
                        ? 'bg-gray-700/60 border-gray-600 text-white'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white hover:border-gray-600'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{group.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-900/40 border border-sky-700/50 text-sky-400 font-bold">
                          {group.variants.length}
                        </span>
                      </div>
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} text-gray-400`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-4 pl-3 border-l-2 border-gray-700 space-y-1 py-2">
                            {group.variants.map((race) => {
                              const isSelected = effectiveRaceId === race.id;
                              return (
                                <button
                                  key={race.id}
                                  onClick={() => handleVariantClick(race.id)}
                                  className={`w-full text-left px-3 py-2 rounded-md transition-all duration-150 text-sm flex items-center justify-between ${isSelected
                                    ? 'bg-amber-900/50 text-amber-400 font-semibold'
                                    : 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white'
                                    }`}
                                >
                                  <span>{race.name}</span>
                                  {isSelected && (
                                    <motion.span layoutId="active-indicator" className="text-amber-500 text-xs">
                                      ▶
                                    </motion.span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          }
          preview={
            detailData ? (
              <motion.div
                key={detailData.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <RaceDetailPane
                  race={detailData}
                  onSelect={onRaceSelect}
                  selectedSpellAbility={selectedSpellAbility}
                  onSpellAbilityChange={setSelectedSpellAbility}
                  selectedKeenSensesSkillId={selectedKeenSensesSkillId}
                  onKeenSensesSkillChange={setSelectedKeenSensesSkillId}
                  selectedCentaurNaturalAffinitySkillId={selectedCentaurNaturalAffinitySkillId}
                  onCentaurNaturalAffinitySkillChange={setSelectedCentaurNaturalAffinitySkillId}
                  selectedChangelingInstinctSkillIds={selectedChangelingInstinctSkillIds}
                  onChangelingInstinctSkillToggle={(skillId) => {
                    setSelectedChangelingInstinctSkillIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(skillId)) {
                        next.delete(skillId);
                      } else if (next.size < 2) {
                        next.add(skillId);
                      }
                      return next;
                    });
                  }}
                  selectedChangelingSize={selectedChangelingSize}
                  onChangelingSizeChange={setSelectedChangelingSize}
                  racialSkillChoices={racialSkillChoices}
                  onRacialSkillChoiceToggle={(skillId, maxChoices) => {
                    setRacialSkillChoices(prev => {
                      if (prev.includes(skillId)) {
                        return prev.filter(id => id !== skillId);
                      }
                      if (prev.length < maxChoices) {
                        return [...prev, skillId];
                      }
                      return prev;
                    });
                  }}
                  racialToolChoices={racialToolChoices}
                  onRacialToolChoiceToggle={(toolId, maxChoices) => {
                    setRacialToolChoices(prev => {
                      if (prev.includes(toolId)) {
                        return prev.filter(id => id !== toolId);
                      }
                      if (prev.length < maxChoices) {
                        return [...prev, toolId];
                      }
                      return prev;
                    });
                  }}
                  racialCantripChoices={racialCantripChoices}
                  onRacialCantripChoiceToggle={(cantripId, maxChoices) => {
                    setRacialCantripChoices(prev => {
                      if (prev.includes(cantripId)) {
                        return prev.filter(id => id !== cantripId);
                      }
                      if (prev.length < maxChoices) {
                        return [...prev, cantripId];
                      }
                      return prev;
                    });
                  }}
                />
              </motion.div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 italic">
                Select a race to view details
              </div>
            )
          }
        />
      </div>
    </CreationStepLayout>
  );
};

export default RaceSelection;
