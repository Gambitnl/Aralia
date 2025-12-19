
import { getSubmapTileInfo } from './submapUtils';

/**
 * Checks if the player is adjacent to a village area on the submap.
 * Returns information about adjacency and the direction of the village relative to the player
 * (which implies the entry direction).
 */
export function getAdjacentVillageEntry(
    worldSeed: number,
    subMapCoordinates: { x: number, y: number },
    parentWorldMapCoords: { x: number, y: number },
    currentWorldBiomeId: string,
    submapDimensions: { rows: number, cols: number }
): { adjacentToVillage: boolean; entryDirection: string | null } {
    const cardinalOffsets = [
        { x: 0, y: -1, entryDirection: 'south' },  // Village is north of player -> enter from south
        { x: 0, y: 1, entryDirection: 'north' },   // Village is south of player -> enter from north
        { x: -1, y: 0, entryDirection: 'east' },   // Village is west of player -> enter from east
        { x: 1, y: 0, entryDirection: 'west' },    // Village is east of player -> enter from west
    ];

    for (const offset of cardinalOffsets) {
        const checkX = subMapCoordinates.x + offset.x;
        const checkY = subMapCoordinates.y + offset.y;

        // Only check within submap bounds
        if (checkX >= 0 && checkX < submapDimensions.cols &&
            checkY >= 0 && checkY < submapDimensions.rows) {

            const { effectiveTerrainType: checkType } = getSubmapTileInfo(
                worldSeed,
                parentWorldMapCoords,
                currentWorldBiomeId,
                submapDimensions,
                { x: checkX, y: checkY }
            );

            if (checkType === 'village_area') {
                return {
                    adjacentToVillage: true,
                    entryDirection: offset.entryDirection
                };
            }
        }
    }

    return { adjacentToVillage: false, entryDirection: null };
}
