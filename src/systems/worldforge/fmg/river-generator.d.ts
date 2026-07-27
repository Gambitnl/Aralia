import type { Grid } from "./utils/graphUtils";
import type { Point } from "./voronoi";
import type { Pack } from "./features";
export interface River {
    i: number;
    source: number;
    mouth: number;
    parent: number;
    basin: number;
    length: number;
    discharge: number;
    width: number;
    widthFactor: number;
    sourceWidth: number;
    name: string;
    type: string;
    cells: number[];
}
export interface RiversGenerateOptions {
    seed: string;
    grid: Grid;
    pack: Pack;
    cellsDesired: number;
    graphWidth: number;
    graphHeight: number;
    resolveDepressionsSteps: number;
    lakeElevationLimit: number;
    heightExponent: number;
    allowErosion?: boolean;
}
declare class RiverModule {
    private FLUX_FACTOR;
    private MAX_FLUX_WIDTH;
    private LENGTH_FACTOR;
    private LENGTH_STEP_WIDTH;
    private LENGTH_PROGRESSION;
    generate(options: RiversGenerateOptions): void;
    alterHeights(pack: Pack): number[];
    resolveDepressions(h: number[], pack: Pack, maxIterations: number): void;
    addMeandering(riverCells: number[], pack: Pack, graphWidth: number, graphHeight: number, riverPoints?: Point[] | null, meandering?: number): [number, number, number][];
    getRiverPoints(riverCells: number[], riverPoints: Point[] | null, pack: Pack, graphWidth: number, graphHeight: number): Point[];
    getBorderPoint(i: number, pack: Pack, graphWidth: number, graphHeight: number): Point;
    getOffset({ flux, pointIndex, widthFactor, startingWidth, }: {
        flux: number;
        pointIndex: number;
        widthFactor: number;
        startingWidth: number;
    }): number;
    getSourceWidth(flux: number): number;
    getApproximateLength(points: [number, number, number][]): number;
    getWidth(offset: number): number;
    riverTypes: {
        main: {
            big: {
                River: number;
            };
            small: {
                Creek: number;
                River: number;
                Brook: number;
                Stream: number;
            };
        };
        fork: {
            big: {
                Fork: number;
            };
            small: {
                Branch: number;
            };
        };
    };
    smallLength: number | null;
    specify(pack: Pack, names: import("./names-generator").NamesGenerator): void;
    getName(cell: number, pack: Pack, names: import("./names-generator").NamesGenerator): string;
    getType({ i, length, parent }: River, pack: Pack): string;
    getBasin(riverId: number, pack: Pack): number;
}
/** Module-level singleton, mirroring upstream `window.Rivers`. */
export declare const Rivers: RiverModule;
export {};
