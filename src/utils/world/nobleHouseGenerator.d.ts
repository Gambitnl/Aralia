/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:35:26
 * Dependents: factionUtils.ts, nobleHouseGenerator.ts, world/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { NobleHouse } from '../../types/noble';
import { SeededRandom } from '../random/seededRandom';
export interface NobleHouseGenerationOptions {
    seed: number;
    region?: string;
    isAncient?: boolean;
}
export declare function generateNobleHouseName(rng: SeededRandom): {
    fullName: string;
    familyName: string;
};
export declare function generateMotto(rng: SeededRandom): string;
export declare function generateHeraldry(rng: SeededRandom): import('../../types/noble').Heraldry;
export declare function generateSeat(rng: SeededRandom, familyName: string): string;
export declare function generateOrigin(rng: SeededRandom): string;
export declare function generateSpecialty(rng: SeededRandom): string;
export declare function generateNobleHouse(options: NobleHouseGenerationOptions): NobleHouse;
/**
 * Generates a set of noble houses with relationships between them.
 */
export declare function generateRegionalPolitics(seed: number, numHouses: number): NobleHouse[];
