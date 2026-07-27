/**
 * Burg ids whose seat cell is within `graphRadius` (atlas graph units) of the
 * given cell's site. Includes the burg on `cellId` itself.
 */
export declare function nearBurgIdsForCell(worldSeed: number, cellId: number, graphRadius: number): number[];
