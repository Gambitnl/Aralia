/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:45
 * Dependents: context/index.ts, contextUtils.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/contextUtils.ts
 * Utility functions for generating rich narrative context for AI processing.
 */
import { GameState, PlayerCharacter, NPC, Location } from '../../types';
interface ContextGenerationParams {
    gameState: GameState;
    playerCharacter: PlayerCharacter | undefined;
    currentLocation: Location;
    npcsInLocation: NPC[];
}
/**
 * Generates a comprehensive, structured context string for AI narrative generation.
 * Uses Markdown-style headers to organize player state, location details, items, NPCs, active quests, and recent history.
 */
export declare function generateGeneralActionContext({ gameState, playerCharacter, currentLocation, npcsInLocation }: ContextGenerationParams): string;
export {};
