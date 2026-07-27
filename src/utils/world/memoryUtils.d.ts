/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 05:08:19
 * Dependents: services/gemini/items.ts, utils/memoryUtils.ts, utils/world/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/world/memoryUtils.ts
 * Canonical world-layer memory helpers for AI formatting, retrieval, and forgetting (decay).
 * The deprecated bridge in src/utils/memoryUtils.ts stays only for older imports.
 */
import { Interaction, GameDate } from '../../types/memory';
import { NpcMemory, KnownFact } from '../../types/world';
/**
 * Creates a blank memory structure for a new NPC on the canonical merged shape.
 * The live-lane fields (disposition/suspicion/goals) get neutral defaults so the object
 * satisfies `NpcMemory`; the richer optional fields start empty.
 */
export declare const createEmptyMemory: () => NpcMemory;
/**
 * Adds a new interaction to the NPC's memory.
 * Handles duplicate checks or merging if necessary (though usually interactions are unique events).
 */
export declare const addInteraction: (memory: NpcMemory, interaction: Omit<Interaction, "id"> & {
    id?: string;
}) => NpcMemory;
/**
 * Retrieves relevant memories for a given context.
 * Currently uses simple keyword matching and importance sorting.
 * In the future, this could use semantic search.
 *
 * @param memory The NPC's memory bank
 * @param contextKeywords Keywords relevant to the current conversation (e.g. "theft", "king")
 * @param limit Max number of memories to return
 */
export declare const getRelevantMemories: (memory: NpcMemory, contextKeywords?: string[], limit?: number) => Interaction[];
/**
 * Formats NPC memory into a context string for the AI.
 * Includes disposition, recent/relevant interactions, and known facts.
 *
 * @param memory The NPC's memory object.
 * @param contextKeywords Optional keywords to fetch specific relevant memories.
 */
export declare const formatMemoryForAI: (memory: NpcMemory, contextKeywords?: string[]) => string;
/**
 * Processes memory decay based on time passed.
 * Removes low-significance memories that are too old.
 *
 * Decay Rules:
 * - Trivial (0): 1 day
 * - Minor (1): 7 days
 * - Standard (3): 30 days
 * - Major (5): 365 days
 * - Critical (10): Never
 *
 * @param memory The NPC's memory
 * @param currentDate The current game date (timestamp)
 */
export declare const decayMemories: (memory: NpcMemory, currentDate: GameDate) => NpcMemory;
/**
 * Teaches an NPC a new fact, or updates confidence if they already knew it.
 * Operates on the canonical `KnownFact`; the merged optional `confidence`/`significance`
 * fields default to 0 when comparing so pre-merge facts still behave sensibly.
 */
export declare const learnFact: (memory: NpcMemory, fact: KnownFact) => NpcMemory;
