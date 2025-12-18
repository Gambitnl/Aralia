/**
 * @file useInspectableTiles.ts
 * Computes which tiles the player can inspect (the Moore neighborhood around the player).
 * Dependencies: playerSubmapCoords + submapDimensions + inspect mode flag.
 */
import { useMemo } from 'react';

interface InspectableTilesOptions {
  isInspecting: boolean;
  playerSubmapCoords: { x: number; y: number } | null;
  submapDimensions: { rows: number; cols: number };
}

export const useInspectableTiles = ({
  isInspecting,
  playerSubmapCoords,
  submapDimensions,
}: InspectableTilesOptions): Set<string> => {
  return useMemo(() => {
    const tiles = new Set<string>();
    if (!isInspecting || !playerSubmapCoords) return tiles;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const adjX = playerSubmapCoords.x + dx;
        const adjY = playerSubmapCoords.y + dy;
        if (adjX >= 0 && adjX < submapDimensions.cols && adjY >= 0 && adjY < submapDimensions.rows) {
          tiles.add(`${adjX},${adjY}`);
        }
      }
    }
    return tiles;
  }, [isInspecting, playerSubmapCoords, submapDimensions]);
};

export default useInspectableTiles;
