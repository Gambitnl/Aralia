/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:35:36
 * Dependents: settlementGeneration.ts, world/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file settlementGeneration.ts
 * Utilities for determining settlement characteristics based on race, background, and culture
 */
import { VillagePersonality } from '../../types/village';
import { Location, GameState } from '../../types';
export interface SettlementType {
    name: string;
    description: string;
    dominantRace?: string;
    architecturalStyle: VillagePersonality['architecturalStyle'];
    governingBody: VillagePersonality['governingBody'];
    primaryIndustry: VillagePersonality['primaryIndustry'];
    culture: VillagePersonality['culture'];
    wealth: VillagePersonality['wealth'];
    population?: string;
}
export declare const SETTLEMENT_TYPES: Record<string, SettlementType>;
/**
 * Determines the most appropriate settlement type for a given race and context
 */
export declare const getSettlementTypeForRace: (raceId?: string, biomeId?: string) => SettlementType;
/**
 * Creates a VillagePersonality based on settlement type
 */
export declare const createPersonalityFromSettlementType: (settlementType: SettlementType, biomeId: string) => VillagePersonality;
/**
 * Determines settlement information for town generation based on location
 */
export declare const determineSettlementInfo: (location: Location, gameState: GameState) => SettlementType;
/**
 * Determines if a settlement should be character-driven based on location and context
 */
export declare const shouldGenerateCharacterDrivenSettlement: (worldX: number, worldY: number, isPlayerStartingArea?: boolean, characterRace?: string) => boolean;
/**
 * Generates settlement parameters based on character influence level
 */
export declare const generateSettlementParameters: (worldX: number, worldY: number, biomeId: string, isStartingSettlement?: boolean, characterRace?: string) => {
    dominantRace?: string;
    settlementType: SettlementType | null;
};
