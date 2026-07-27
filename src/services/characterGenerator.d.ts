/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:28:52
 * Dependents: CompanionGenerator.ts, GameGuideModal.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/services/characterGenerator.ts
 * Service for generating full PlayerCharacter objects from simplified configurations.
 * This allows the AI (or other systems) to create valid characters without going through
 * the UI wizard, while ensuring all derived stats (HP, AC, Speed, etc.) are calculated correctly.
 */
import { PlayerCharacter, AbilityScores } from '../types';
export interface CharacterGenerationConfig {
    name: string;
    raceId: string;
    classId: string;
    backgroundBio?: string;
    abilityScores?: AbilityScores;
    skillIds?: string[];
}
/**
 * Generates a complete PlayerCharacter object from a partial configuration.
 * Automatically handles derived stats, equipment (Option A defaults), and resource setup.
 */
export declare function generateCharacterFromConfig(config: CharacterGenerationConfig): PlayerCharacter | null;
