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
/**
 * ARCHITECTURAL CONTEXT:
 * This component handles the 'Race Taxonomy' selection. It groups
 * subraces (variants) under their base parent races (e.g., High Elf and
 * Wood Elf under 'Elf') to keep the selection sidebar manageable.
 *
 * The per-race draft is owned by a reducer (agora-b6fc), not by mirrored
 * component state. `buildRaceDraft` derives the draft for the race being
 * viewed from the saved selections, and `raceDraftReducer` stores an edited
 * draft beside the `RaceDraftKey` it was edited against, so a stale edit
 * cannot survive a race change. Those pieces are exported and are part of
 * this module's public surface, which is why they appear below.
 *
 * @file src/components/CharacterCreator/Race/RaceSelection.tsx
 */
import React from 'react';
import { Race, RacialSelectionData } from '../../../types';
import { RacialChoiceData } from './RaceDetailPane';
type AbilityScoreName = 'Intelligence' | 'Wisdom' | 'Charisma';
interface RaceSelectionProps {
    races: Race[];
    onRaceSelect: (raceId: string, choices?: RacialChoiceData) => void;
    selectedRaceId?: string | null;
    racialSelections?: Record<string, RacialSelectionData>;
    onBack?: () => void;
}
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
export declare const buildRaceDraft: ({ raceId, race, racialSelections }: RaceDraftKey) => RaceDraft;
export declare const isSameRaceDraftKey: (a: RaceDraftKey, b: RaceDraftKey) => boolean;
export type RaceDraftAction = {
    key: RaceDraftKey;
} & ({
    field: 'spellAbility';
    value: AbilityScoreName | null;
} | {
    field: 'keenSensesSkillId';
    value: string | null;
} | {
    field: 'centaurNaturalAffinitySkillId';
    value: string | null;
} | {
    field: 'changelingSize';
    value: 'Small' | 'Medium' | null;
} | {
    field: 'changelingInstinctSkillIds';
    skillId: string;
} | {
    field: 'skillIds' | 'toolIds' | 'cantripIds';
    id: string;
    maxChoices: number;
});
export interface RaceDraftState {
    key: RaceDraftKey;
    draft: RaceDraft;
}
export declare const createRaceDraftState: (key: RaceDraftKey) => RaceDraftState;
export declare const raceDraftReducer: (state: RaceDraftState, action: RaceDraftAction) => RaceDraftState;
declare const RaceSelection: React.FC<RaceSelectionProps>;
export default RaceSelection;
