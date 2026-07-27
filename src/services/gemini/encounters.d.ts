/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 00:38:43
 * Dependents: services/geminiService.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { GeminiCustomActionData, GeminiEncounterData, GeminiMetadata, GeminiSocialCheckData, GeminiTextData, StandardizedResult } from "./types";
import { NPCMemory, TempPartyMember, VillageActionContext } from "../../types";
export declare function generateOracleResponse(playerQuery: string, context: string, devModelOverride?: string | null): Promise<StandardizedResult<GeminiTextData>>;
export declare function generateCharacterName(race: string, className: string, gender: string, setting: string, devModelOverride?: string | null): Promise<StandardizedResult<{
    name: string | null;
} & GeminiMetadata>>;
export declare function generateEncounter(xpBudget: number, themeTags: string[], party: TempPartyMember[], devModelOverride?: string | null, seed?: number): Promise<StandardizedResult<GeminiEncounterData>>;
export declare function generateCustomActions(sceneDescription: string, context: string, devModelOverride?: string | null): Promise<StandardizedResult<GeminiCustomActionData>>;
export declare function generateSocialCheckOutcome(npcMemory: NPCMemory | null, villageContext: VillageActionContext | null, playerAction: string, devModelOverride?: string | null): Promise<StandardizedResult<GeminiSocialCheckData>>;
