/**
 * ARCHITECTURAL CONTEXT:
 * This component handles the 'Race Taxonomy' selection. It groups 
 * subraces (variants) under their base parent races (e.g., High Elf and 
 * Wood Elf under 'Elf') to keep the selection sidebar manageable.
 *
 * Recent updates focus on 'State Synchronization' and 'Choice Isolation'.
 * - The racial choices (like Keen Senses or Spellcasting Ability) are no
 *   longer mirrored into component state and re-synchronized from an effect.
 *   They are derived from the creator draft for the race being viewed, and a
 *   reducer owns the player's edits. See the race-draft section below.
 * - That removed the eight `react-hooks/set-state-in-effect` suppressions this
 *   file carried, and the extra render each race click used to cost. The
 *   isolation the effect protected is preserved: choices for a newly selected
 *   race still never inherit values from the previous one.
 * - Improved darkvision and speed extraction logic in `transformRaceData` 
 *   to handle variations in trait text formatting across different race 
 *   definitions.
 * 
 * @file src/components/CharacterCreator/Race/RaceSelection.tsx
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: components/CharacterCreator/CharacterCreator.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useReducer, useState } from 'react';
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

// Reuse one empty draft map for races with no saved subchoices. The draft key
// below compares this map by identity, so a fresh object on every render would
// make every render look like a new set of saved choices and throw away the
// edit in progress.
const EMPTY_RACIAL_SELECTIONS: Record<string, RacialSelectionData> = {};

type AbilityScoreName = 'Intelligence' | 'Wisdom' | 'Charisma';

// Changeling Instincts is a "choose exactly two" trait. The count is named
// once so the toggle cap and the confirm gate below cannot drift apart.
const CHANGELING_INSTINCT_SKILL_COUNT = 2;

// ---------------------------------------------------------------------------
// Reducer-owned race draft (agora-b6fc)
// ---------------------------------------------------------------------------
// This step used to mirror the creator draft into nine pieces of component
// state and re-synchronize all of them from an effect whenever the viewed race
// changed. That is why this file carried eight
// `react-hooks/set-state-in-effect` suppressions and paid a second render for
// every race click.
//
// The draft is derived now, not mirrored. `buildRaceDraft` reads the saved
// selections for the race being viewed, and the reducer stores an edited draft
// beside the key it was edited against. When that key moves on - a different
// race, or a parent that stored new selections - the derived draft wins on the
// very next render, with no effect and no second render.
//
// Preserved: every per-race rule the effect encoded (Keen Senses only for the
// elf family, Changeling skills and size cleared together, the generic skill
// store empty for races that have a dedicated control) now lives in
// `buildRaceDraft`, which is exported so it can be read on its own.

export interface RaceDraft {
  spellAbility: AbilityScoreName | null;
  keenSensesSkillId: string | null;
  centaurNaturalAffinitySkillId: string | null;
  changelingInstinctSkillIds: Set<string>;
  changelingSize: 'Small' | 'Medium' | null;
  skillIds: string[];
  toolIds: string[];
  cantripIds: string[];
}

/** Everything the derived draft depends on. Compared by identity. */
export interface RaceDraftKey {
  raceId: string | null;
  race: Race | undefined;
  racialSelections: Record<string, RacialSelectionData>;
}

export const buildRaceDraft = ({ raceId, race, racialSelections }: RaceDraftKey): RaceDraft => {
  const currentSelection = racialSelections[raceId ?? ''];
  const isElfFamily = race?.id === 'elf' || race?.baseRace === 'elf';
  // These races collect their skills through a dedicated control, so the
  // generic skill store stays empty for them instead of showing the same
  // choice twice.
  const hasDedicatedSkillControl = race?.id === 'changeling' || race?.id === 'centaur' || isElfFamily;

  return {
    spellAbility: (currentSelection?.spellAbility as AbilityScoreName | undefined) ?? null,
    keenSensesSkillId: isElfFamily ? racialSelections.elf?.skillIds?.[0] ?? null : null,
    centaurNaturalAffinitySkillId: race?.id === 'centaur'
      ? racialSelections.centaur?.skillIds?.[0] ?? null
      : null,
    changelingInstinctSkillIds: new Set(
      race?.id === 'changeling' ? racialSelections.changeling?.skillIds ?? [] : [],
    ),
    changelingSize: race?.id === 'changeling' ? racialSelections.changeling?.size ?? null : null,
    skillIds: hasDedicatedSkillControl ? [] : currentSelection?.skillIds ?? [],
    toolIds: currentSelection?.toolIds ?? [],
    cantripIds: currentSelection?.selectedSpellIds ?? [],
  };
};

export const isSameRaceDraftKey = (a: RaceDraftKey, b: RaceDraftKey): boolean =>
  a.raceId === b.raceId && a.race === b.race && a.racialSelections === b.racialSelections;

// Every edit carries the key it was made against, so an edit that races a race
// change lands on the newly derived draft rather than the stale stored one.
export type RaceDraftAction = { key: RaceDraftKey } & (
  | { field: 'spellAbility'; value: AbilityScoreName | null }
  | { field: 'keenSensesSkillId'; value: string | null }
  | { field: 'centaurNaturalAffinitySkillId'; value: string | null }
  | { field: 'changelingSize'; value: 'Small' | 'Medium' | null }
  | { field: 'changelingInstinctSkillIds'; skillId: string }
  | { field: 'skillIds' | 'toolIds' | 'cantripIds'; id: string; maxChoices: number }
);

export interface RaceDraftState {
  key: RaceDraftKey;
  draft: RaceDraft;
}

export const createRaceDraftState = (key: RaceDraftKey): RaceDraftState => ({
  key,
  draft: buildRaceDraft(key),
});

// A choice list is a capped toggle: picking a chosen entry drops it, and a new
// entry is taken only while the race still allows another one.
const toggleChoice = (choices: string[], id: string, maxChoices: number): string[] => {
  if (choices.includes(id)) return choices.filter(choice => choice !== id);
  if (choices.length < maxChoices) return [...choices, id];
  return choices;
};

export const raceDraftReducer = (state: RaceDraftState, action: RaceDraftAction): RaceDraftState => {
  const base = isSameRaceDraftKey(state.key, action.key) ? state.draft : buildRaceDraft(action.key);

  switch (action.field) {
    case 'spellAbility':
      return { key: action.key, draft: { ...base, spellAbility: action.value } };
    case 'keenSensesSkillId':
      return { key: action.key, draft: { ...base, keenSensesSkillId: action.value } };
    case 'centaurNaturalAffinitySkillId':
      return { key: action.key, draft: { ...base, centaurNaturalAffinitySkillId: action.value } };
    case 'changelingSize':
      return { key: action.key, draft: { ...base, changelingSize: action.value } };
    case 'changelingInstinctSkillIds': {
      const next = new Set(base.changelingInstinctSkillIds);
      if (next.has(action.skillId)) {
        next.delete(action.skillId);
      } else if (next.size < CHANGELING_INSTINCT_SKILL_COUNT) {
        next.add(action.skillId);
      }
      return { key: action.key, draft: { ...base, changelingInstinctSkillIds: next } };
    }
    case 'skillIds':
      return {
        key: action.key,
        draft: { ...base, skillIds: toggleChoice(base.skillIds, action.id, action.maxChoices) },
      };
    case 'toolIds':
      return {
        key: action.key,
        draft: { ...base, toolIds: toggleChoice(base.toolIds, action.id, action.maxChoices) },
      };
    case 'cantripIds':
      return {
        key: action.key,
        draft: { ...base, cantripIds: toggleChoice(base.cantripIds, action.id, action.maxChoices) },
      };
  }
};

const RaceSelection: React.FC<RaceSelectionProps> = ({
  races,
  onRaceSelect,
  selectedRaceId: savedRaceId,
  racialSelections = EMPTY_RACIAL_SELECTIONS,
  onBack,
}) => {
  // Returning to this step must show the race already stored by the creator.
  // Starting from an empty local selection made the detail pane fall back to
  // the alphabetically first race, so pressing Confirm after Back could replace
  // the player's earlier choice without warning.
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(() => savedRaceId ?? null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

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

  // The draft the player is editing. It is read from the creator draft for the
  // race in view, so returning to this step, or switching race, shows that
  // race's own saved choices with nothing carried over from the previous one.
  const draftKey: RaceDraftKey = { raceId: effectiveRaceId, race: selectedRace, racialSelections };
  const [draftState, dispatchDraft] = useReducer(raceDraftReducer, draftKey, createRaceDraftState);
  // When the key has moved on, the freshly derived draft is what this render
  // shows. The reducer rebases the next edit onto it, so nothing is written
  // back here and no second render is queued.
  const draft = isSameRaceDraftKey(draftState.key, draftKey)
    ? draftState.draft
    : buildRaceDraft(draftKey);

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
    // The draft is derived from the race in view, so the new race's own spell
    // ability is read on the next render. The explicit reset that used to sit
    // here was already redundant: the synchronization effect overwrote it in
    // the same commit.
    setSelectedRaceId(raceId);
  };

  // Single source of truth for "why can't I confirm yet" — used for the
  // disabled state, the hover tooltip, AND a visible header hint so the
  // explanation isn't tooltip-only (GAPS.md G11).
  const confirmBlockedReason: string | null = !selectedRace
    ? null
    : selectedRaceSpellAbilityChoice && !draft.spellAbility
      ? 'Please select a spellcasting ability first'
      : selectedRace.id === 'elf' && !draft.keenSensesSkillId
        ? 'Please select a Keen Senses skill first'
        : selectedRace.id === 'centaur' && !draft.centaurNaturalAffinitySkillId
          ? 'Please select a Natural Affinity skill first'
          : selectedRace.id === 'changeling' && draft.changelingInstinctSkillIds.size !== CHANGELING_INSTINCT_SKILL_COUNT
            ? 'Please select two Changeling Instincts skills first'
            : selectedRace.id === 'changeling' && !draft.changelingSize
              ? 'Please select your size first'
              : selectedRace.id === 'kender' && draft.skillIds.length !== 1
                ? 'Please select a skill first'
                : selectedRace.id === 'kenku' && draft.skillIds.length !== 2
                  ? 'Please select two skills first'
                  : selectedRace.id === 'warforged' && draft.skillIds.length !== 1
                    ? 'Please select a skill first'
                    : selectedRace.id === 'warforged' && draft.toolIds.length !== 1
                      ? 'Please select a tool first'
                      : selectedRace.id.startsWith('half_elf') && draft.skillIds.length !== 2
                        ? 'Please select two skills first'
                        : selectedRace.id === 'autognome' && draft.toolIds.length !== 2
                          ? 'Please select two tools first'
                          : selectedRace.id === 'forgeborn_human' && draft.toolIds.length !== 1
                            ? 'Please select a tool first'
                            : selectedRace.id === 'lizardfolk' && draft.skillIds.length !== 2
                              ? 'Please select two skills first'
                              : selectedRace.id.includes('dwarf') && selectedRace.id !== 'dwarf' && draft.toolIds.length !== 1
                                ? 'Please select a tool first'
                                : (selectedRace.id === 'astral_elf' || selectedRace.id === 'high_elf' || selectedRace.id === 'half_elf_high') && draft.cantripIds.length !== 1
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
        if (draft.spellAbility) {
          choices.spellAbility = draft.spellAbility;
        }
        if (selectedRace.id === 'elf' && draft.keenSensesSkillId) {
          choices.keenSensesSkillId = draft.keenSensesSkillId;
        }
        if (selectedRace.id === 'centaur' && draft.centaurNaturalAffinitySkillId) {
          choices.centaurNaturalAffinitySkillId = draft.centaurNaturalAffinitySkillId;
        }
        if (selectedRace.id === 'changeling') {
          if (draft.changelingInstinctSkillIds.size > 0) {
            choices.changelingInstinctSkillIds = Array.from(draft.changelingInstinctSkillIds);
          }
          if (draft.changelingSize) {
            choices.changelingSize = draft.changelingSize;
          }
        }
        if (draft.skillIds.length > 0) choices.genericSkillChoices = draft.skillIds;
        if (draft.toolIds.length > 0) choices.genericToolChoices = draft.toolIds;
        if (draft.cantripIds.length > 0) choices.genericCantripChoices = draft.cantripIds;
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
                  selectedSpellAbility={draft.spellAbility}
                  onSpellAbilityChange={(ability) => dispatchDraft({ key: draftKey, field: 'spellAbility', value: ability })}
                  selectedKeenSensesSkillId={draft.keenSensesSkillId}
                  onKeenSensesSkillChange={(skillId) => dispatchDraft({ key: draftKey, field: 'keenSensesSkillId', value: skillId })}
                  selectedCentaurNaturalAffinitySkillId={draft.centaurNaturalAffinitySkillId}
                  onCentaurNaturalAffinitySkillChange={(skillId) => dispatchDraft({ key: draftKey, field: 'centaurNaturalAffinitySkillId', value: skillId })}
                  selectedChangelingInstinctSkillIds={draft.changelingInstinctSkillIds}
                  onChangelingInstinctSkillToggle={(skillId) => dispatchDraft({ key: draftKey, field: 'changelingInstinctSkillIds', skillId })}
                  selectedChangelingSize={draft.changelingSize}
                  onChangelingSizeChange={(size) => dispatchDraft({ key: draftKey, field: 'changelingSize', value: size })}
                  racialSkillChoices={draft.skillIds}
                  onRacialSkillChoiceToggle={(skillId, maxChoices) => dispatchDraft({ key: draftKey, field: 'skillIds', id: skillId, maxChoices })}
                  racialToolChoices={draft.toolIds}
                  onRacialToolChoiceToggle={(toolId, maxChoices) => dispatchDraft({ key: draftKey, field: 'toolIds', id: toolId, maxChoices })}
                  racialCantripChoices={draft.cantripIds}
                  onRacialCantripChoiceToggle={(cantripId, maxChoices) => dispatchDraft({ key: draftKey, field: 'cantripIds', id: cantripId, maxChoices })}
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
