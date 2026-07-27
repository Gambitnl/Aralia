/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 27/02/2026, 09:28:07
 * Dependents: CharacterCreator.tsx, PreviewRaceImages.tsx, characterUtils.ts, characterValidation.ts, constants.ts, dummyCharacter.ts, npcGenerator.ts, quickCharacterGenerator.ts, raceSyncAuditor.ts, useCharacterAssembly.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file index.ts
 * Aggregates all race data exports for centralized access using import.meta.glob.
 * Race files are automatically discovered - no manual imports needed!
 *
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added an 'as any' cast to
 * 'import.meta' to resolve type errors in script-specific type
 * checking environments while maintaining Vite compatibility.
 *
 * To add a new race:
 * 1. Create a new .ts file in src/data/races/ (e.g., kobold.ts)
 * 2. Export a constant named <RACE_ID>_DATA (e.g., KOBOLD_DATA)
 * 3. That's it! The race will be automatically included.
 */
import { Race } from '../../types/index.js';
import { buildRacialTraitLibrary, RacialTraitLibrary } from './racialTraits.js';
export { buildRacialTraitLibrary };
export { type RacialTraitLibrary };
export declare const getRacialChoiceRequirementsForRace: (raceId: string) => import("./racialTraits.js").RacialChoiceRequirement[];
export declare const getRacialSpellCastingAbilityChoiceForRace: (raceId: string) => import("./racialTraits.js").RacialChoiceRequirement;
export declare const getRacialSpellCastingAbilityChoicesForRace: (raceId: string) => import("./racialTraits.js").RacialChoiceRequirement[];
export declare const hasRacialSpellCastingAbilityChoiceForRace: (raceId: string) => boolean;
export declare const ALL_RACES_DATA: Record<string, Race>;
export declare const RACE_DATA_BUNDLE: {
    dragonbornAncestries: Record<import("../../types/character.js").DraconicAncestorType, import("../../types/character.js").DraconicAncestryInfo>;
    goliathGiantAncestries: import("../../types/character.js").GiantAncestryBenefit[];
    tieflingLegacies: import("../../types/character.js").FiendishLegacy[];
    gnomeSubraces: any[];
};
export declare const getRacialTraitLibrary: () => RacialTraitLibrary;
export declare const ACTIVE_RACES: Race[];
