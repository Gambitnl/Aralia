import type { Grid } from "./utils/graphUtils";
type Tool = "Hill" | "Pit" | "Range" | "Trough" | "Strait" | "Mask" | "Invert" | "Add" | "Multiply" | "Smooth";
export interface HeightmapGenerateOptions {
    seed: string;
    template: string;
    graphWidth: number;
    graphHeight: number;
}
export declare class HeightmapModule {
    grid: Grid | null;
    heights: Uint8Array | null;
    blobPower: number;
    linePower: number;
    /** upstream: global graphWidth */
    private graphWidth;
    /** upstream: global graphHeight */
    private graphHeight;
    private clearData;
    private getBlobPower;
    private getLinePower;
    private getPointInRange;
    setGraph(graph: Grid): void;
    addHill(count: string, height: string, rangeX: string, rangeY: string): void;
    addPit(count: string, height: string, rangeX: string, rangeY: string): void;
    addRange(count: string, height: string, rangeX: string, rangeY: string, startCellId?: number, endCellId?: number): void;
    addTrough(count: string, height: string, rangeX: string, rangeY: string, startCellId?: number, endCellId?: number): void;
    addStrait(width: string, direction?: string): void;
    modify(range: string, add: number, mult: number, power?: number): void;
    smooth(fr?: number, add?: number): void;
    mask(power?: number): void;
    invert(count: number, axes: string): void;
    addStep(tool: Tool, a2: string, a3: string, a4: string, a5: string): void;
    /**
     * Upstream signature: `async generate(graph)` reading the global `seed` and
     * `byId("templateInput").value`, with an async image-based fallback. Here
     * the template-driven path is ported synchronously and the inputs are
     * explicit options. RNG seeding position is identical.
     */
    generate(graph: Grid, options: HeightmapGenerateOptions): Uint8Array;
    fromTemplate(graph: Grid, id: string): Uint8Array | null;
    getHeights(): Uint8Array<ArrayBufferLike>;
}
/** Module-level singleton, mirroring upstream `window.HeightmapGenerator`. */
export declare const HeightmapGenerator: HeightmapModule;
export {};
