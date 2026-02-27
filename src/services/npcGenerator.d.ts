// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 27/02/2026, 09:28:57
 * Dependents: None (Orphan)
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 21/02/2026, 02:40:35
 * Dependents: CompanionGenerator.ts, ThreeDModal.tsx, handleMerchantInteraction.ts, handleNpcInteraction.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { TTSVoiceOption, RichNPC } from '../types/world';
import { NPCVisualSpec } from '../types/visuals';
/**
 * Configuration options for the NPC generator.
 */
export interface NPCGenerationConfig {
    /** Optional ID override. If not provided, a random UUID is generated. */
    id?: string;
    /** Optional name override. If not provided, a random name is chosen based on race. */
    name?: string;
    /** The system role defines functional behavior (merchant, guard, etc.). */
    role: 'merchant' | 'quest_giver' | 'guard' | 'civilian' | 'unique';
    /** Optional specific occupation (e.g., "Blacksmith", "Baker") to refine description/personality. */
    occupation?: string;
    /** Optional race ID to influence naming and visuals. */
    raceId?: string;
    /** Optional faction affiliation. */
    faction?: string;
    /** Optional specific visual override. */
    visual?: Partial<NPCVisualSpec>;
    /** Optional voice override. */
    voice?: TTSVoiceOption;
    /** Optional starting level for memory/disposition. */
    initialDisposition?: number;
    /** Optional class ID. If not provided, one is random or inferred. */
    classId?: string;
    /** Optional level. Defaults to 1. */
    level?: number;
    /** Optional background ID. If not provided, one is random. */
    backgroundId?: string;
    /** Optional gender override. If not provided, randomly determined. */
    gender?: 'male' | 'female';
}
/**
 * Generates a fully formed NPC object based on the provided configuration.
 * Orchestrates all sub-generators (names, stats, equipment, family, etc.) to produce a cohesive character.
 * @param config Configuration options for the generator.
 * @returns A RichNPC object containing all character data.
 */
export declare function generateNPC(config: NPCGenerationConfig): RichNPC;
