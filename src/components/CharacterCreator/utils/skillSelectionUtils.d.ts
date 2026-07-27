/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:27:23
 * Dependents: SkillSelection.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { RacialSelectionData, Skill } from '../../../types';
export type SkillId = string;
export type SkillGrantInfo = {
    granted: true;
    source: string;
} | {
    granted: false;
    source: '';
};
export type SkillGrantsById = Record<SkillId, SkillGrantInfo>;
export declare function getKeenSensesOptions(skillsById: Record<string, Skill | undefined>): Skill[];
export declare function deriveRacialSkillGrants(params: {
    raceId: string;
    racialSelections: Record<string, RacialSelectionData>;
    selectedKeenSensesSkillId: string | null;
}): SkillGrantsById;
export declare function isSkillSelectionValid(params: {
    selectedClassSkillIds: Set<string>;
    requiredClassSkillCount: number;
    raceId: string;
    selectedKeenSensesSkillId: string | null;
}): boolean;
export declare function buildSkillsForSubmit(params: {
    skillsById: Record<string, Skill | undefined>;
    selectedClassSkillIds: Set<string>;
    raceId: string;
    racialSelections: Record<string, RacialSelectionData>;
    selectedKeenSensesSkillId: string | null;
}): Skill[];
