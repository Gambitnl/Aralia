import type { Grid } from "./utils/graphUtils";
import type { Pack } from "./features";
export interface BiomesData {
    i: number[];
    name: string[];
    color: string[];
    biomesMatrix: Uint8Array[];
    habitability: number[];
    iconsDensity: number[];
    icons: string[][];
    cost: number[];
}
declare class BiomesModule {
    private MIN_LAND_HEIGHT;
    getDefault(): BiomesData;
    define(grid: Grid, pack: Pack, biomesData: BiomesData): void;
    getId(moisture: number, temperature: number, height: number, hasRiver: boolean, biomesData: BiomesData): number;
    private isWetland;
}
/** Module-level singleton, mirroring upstream `window.Biomes`. */
export declare const Biomes: BiomesModule;
export {};
