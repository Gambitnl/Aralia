/**
 * The legacy biome id of the given atlas cell, or `undefined` when the cell has
 * no biome entry (honest unknown — caller keeps its own fallback). For a land
 * cell this is always a real walkable biome id. Escalation order (file
 * header): haunted/fey named forests, then elevation class, then the plain
 * mapping.
 */
export declare function biomeIdForCell(worldSeed: number, cellId: number): string | undefined;
