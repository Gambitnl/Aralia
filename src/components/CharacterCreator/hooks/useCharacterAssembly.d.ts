/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/06/2026, 20:43:21
 * Dependents: components/CharacterCreator/CharacterCreator.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { PlayerCharacter, Item } from '../../../types';
import { CharacterCreationState } from '../state/characterCreatorState';
type AgeSizeOverride = NonNullable<PlayerCharacter['ageSizeOverride']>;
export declare function assembleSelectedFeats(state: CharacterCreationState): string[];
/** Human-readable label for the age band a character falls into. */
export type AgeBandLabel = 'Child' | 'Adolescent' | 'Adult' | 'Middle-aged' | 'Elderly';
export interface AgeAdjustmentSummary {
    /** The age band the character falls into. */
    band: AgeBandLabel;
    /** Flat modifier applied to every ability score (negative = penalty). */
    statPenalty: number;
    /** Size override the age band imposes, if any (e.g. children render Small). */
    sizeModifier?: AgeSizeOverride;
}
/**
 * Resolve how a character's age modifies their stats/size, so the review sheet
 * can EXPLAIN the age-adjusted ability scores instead of silently showing
 * numbers that differ from the pre-age sidebar values (GAPS.md C10). Returns
 * null when age has no mechanical effect (the Adult band).
 */
export declare const getAgeAdjustmentSummary: (raceId: string, age: number) => AgeAdjustmentSummary | null;
/**
 * Pure character assembly — builds a PlayerCharacter from a completed creator
 * state. Exported so non-React callers (e.g. the premade-character generator
 * script) can assemble characters through the exact same pipeline the
 * creator's review step uses.
 */
export declare function assemblePlayerCharacter(currentState: CharacterCreationState, currentName: string): PlayerCharacter | null;
interface UseCharacterAssemblyProps {
    onCharacterCreate: (character: PlayerCharacter, startingInventory: Item[]) => void;
}
export declare function useCharacterAssembly({ onCharacterCreate }: UseCharacterAssemblyProps): {
    assembleAndSubmitCharacter: (currentState: CharacterCreationState, name: string) => boolean;
    generatePreviewCharacter: (currentState: CharacterCreationState, currentName: string) => PlayerCharacter | null;
};
export {};
