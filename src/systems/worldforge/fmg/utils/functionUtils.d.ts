/**
 * @file utils/functionUtils.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/utils/functionUtils.ts. See
 * ../ATTRIBUTION.md. Only distanceSquared is needed by the slice-1 modules;
 * rollups (UI/statistics helper) was not ported.
 */
/**
 * Squared Euclidean distance between two points.
 */
export declare const distanceSquared: ([x1, y1]: [number, number], [x2, y2]: [number, number]) => number;
