/**
 * @file src/services/wfcService.ts
 * Minimal Wave Function Collapse helper for deterministic submap prototyping.
 * The implementation is intentionally small: it walks the grid row-by-row,
 * respecting neighbor compatibility and using a seeded PRNG to pick tiles.
 * This trades full entropy propagation for speed, which is acceptable for small 25x25 submaps.
 */
export type WfcGrid = string[][];
interface GenerateWfcGridParams {
    rows: number;
    cols: number;
    rulesetId?: string;
    seed: number;
    biomeContext?: string;
}
export declare function generateWfcGrid({ rows, cols, rulesetId, seed, biomeContext }: GenerateWfcGridParams): WfcGrid;
export {};
