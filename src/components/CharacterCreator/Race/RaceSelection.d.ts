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
import React from 'react';
import { Race, RacialSelectionData } from '../../../types';
import { RacialChoiceData } from './RaceDetailPane';
interface RaceSelectionProps {
    races: Race[];
    onRaceSelect: (raceId: string, choices?: RacialChoiceData) => void;
    selectedRaceId?: string | null;
    racialSelections?: Record<string, RacialSelectionData>;
    onBack?: () => void;
}
declare const RaceSelection: React.FC<RaceSelectionProps>;
export default RaceSelection;
