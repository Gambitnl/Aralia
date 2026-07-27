/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:33:40
 * Dependents: PreviewCombatSandbox.tsx
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file quickCharacterGenerator.ts
 * Creates complete PlayerCharacter objects from minimal inputs for the Combat Sandbox.
 * This bypasses the full character creator for quick testing scenarios.
 */
import { PlayerCharacter } from '../../types';
import type { CombatCharacter } from '../../types/combat';
export interface QuickCharacterConfig {
    name?: string;
    raceId: string;
    classId: string;
    level: number;
    /** Point-buy style stats: [Str, Dex, Con, Int, Wis, Cha] */
    stats?: [number, number, number, number, number, number];
    /** Use class-recommended stat priorities if stats not provided */
    useRecommendedStats?: boolean;
}
export declare function createQuickCharacter(config: QuickCharacterConfig): PlayerCharacter | null;
export declare function createQuickCombatCharacter(config: QuickCharacterConfig, allSpells?: Record<string, unknown>): CombatCharacter | null;
export declare const AVAILABLE_CLASS_IDS: string[];
export declare const AVAILABLE_RACE_IDS: string[];
export declare function getClassDisplayName(classId: string): string;
export declare function getRaceDisplayName(raceId: string): string;
