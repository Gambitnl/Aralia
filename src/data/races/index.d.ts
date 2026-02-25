/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 10/02/2026, 01:54:14
 * Dependents: CharacterCreator.tsx, characterUtils.ts, characterValidation.ts, constants.ts, dummyCharacter.ts, npcGenerator.ts, quickCharacterGenerator.ts, raceSyncAuditor.ts, useCharacterAssembly.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
/**
 * @file index.ts
 * Aggregates all race data exports for centralized access using import.meta.glob.
 * Race files are automatically discovered - no manual imports needed!
 *
 * To add a new race:
 * 1. Create a new .ts file in src/data/races/ (e.g., kobold.ts)
 * 2. Export a constant named <RACE_ID>_DATA (e.g., KOBOLD_DATA)
 * 3. That's it! The race will be automatically included.
 */
import { Race } from '../../types';
export declare const ALL_RACES_DATA: Record<string, Race>;
export declare const RACE_DATA_BUNDLE: {
    dragonbornAncestries: Record<import("../../types").DraconicAncestorType, import("../../types").DraconicAncestryInfo>;
    goliathGiantAncestries: import("../../types").GiantAncestryBenefit[];
    tieflingLegacies: import("../../types").FiendishLegacy[];
    gnomeSubraces: any[];
};
export declare const ACTIVE_RACES: Race[];
