import type { Grid } from "./utils/graphUtils";
import type { Pack, PackedGraphFeature } from "./features";
export declare class LakesModule {
    private LAKE_ELEVATION_DELTA;
    getHeight(feature: PackedGraphFeature, pack: Pack): number;
    cleanupLakeData: (pack: Pack) => void;
    defineClimateData(heights: number[] | Uint8Array, grid: Grid, pack: Pack, heightExponent: number): Uint16Array<ArrayBuffer>;
    detectCloseLakes(h: number[] | Uint8Array, pack: Pack, elevationLimit: number): void;
    defineNames(pack: Pack, names: import("./names-generator").NamesGenerator): void;
    getName(feature: PackedGraphFeature, pack: Pack, names: import("./names-generator").NamesGenerator): string;
}
/** Module-level singleton, mirroring upstream `window.Lakes`. */
export declare const Lakes: LakesModule;
