/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 05:08:18
 * Dependents: services/geminiService.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { GeminiHarvestData, GeminiInventoryData, GeminiTextData, StandardizedResult } from "./types";
import { EconomyState, GoalStatus, NPCMemory } from "../../types";
export declare function generateMerchantInventory(shopType: string, context: string, economyState: EconomyState, devModelOverride?: string | null, seedKey?: string): Promise<StandardizedResult<GeminiInventoryData>>;
export declare function generateHarvestLoot(locationName: string, actionDescription: string, devModelOverride?: string | null): Promise<StandardizedResult<GeminiHarvestData>>;
export declare function generateGuideResponse(memory: NPCMemory, goalStatus: GoalStatus, playerContext: string, devModelOverride?: string | null): Promise<StandardizedResult<GeminiTextData>>;
