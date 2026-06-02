/**
 * @file src/components/World3D/AtlasPlayerMarker.tsx
 * Draws the player's last known 3D world position on the Azgaar atlas overlay.
 *
 * Why this exists: when you exit 3D back to the map (or open the world map while
 * playerWorldPos is set), you should see where you were in the streamed world.
 * The marker uses the same pan/zoom math as travel precision overlays so it stays
 * aligned when you drag or zoom the embedded atlas.
 */

import React, { useMemo } from 'react';
import type { PlayerWorldPosition } from '../../types';
import type { AzgaarAtlasTransform } from '@/utils/spatial';
import { getWorldPosOverlayPercentPoint } from '@/utils/spatial';
import { worldMetersToGridNormalized } from '../../utils/worldCoords';

export interface AtlasPlayerMarkerProps {
  /** Last known 3D position from game state (null hides the marker). */
  playerWorldPos: PlayerWorldPosition;
  /** World map grid size — must match MapPane mapData.gridSize. */
  gridCols: number;
  gridRows: number;
  /** Live Azgaar pan/zoom from the iframe bridge (may be null before ready). */
  atlasTransform: AzgaarAtlasTransform | null;
}

const AtlasPlayerMarker: React.FC<AtlasPlayerMarkerProps> = ({
  playerWorldPos,
  gridCols,
  gridRows,
  atlasTransform,
}) => {
  const pointStyle = useMemo(() => {
    const { normX, normY } = worldMetersToGridNormalized(
      playerWorldPos.x,
      playerWorldPos.z,
      gridCols,
      gridRows,
    );
    const { left, top } = getWorldPosOverlayPercentPoint(normX, normY, atlasTransform);
    return {
      left: `${left}%`,
      top: `${top}%`,
    };
  }, [atlasTransform, gridCols, gridRows, playerWorldPos.x, playerWorldPos.z]);

  return (
    <div
      className="absolute z-[3] pointer-events-none"
      style={pointStyle}
      aria-hidden="true"
    >
      <div
        className="relative -translate-x-1/2 -translate-y-1/2"
        title="Your 3D world position"
      >
        <div
          className="h-3 w-3 rounded-full border border-white bg-red-500 shadow-[0_0_8px_rgba(248,113,113,0.85)]"
        />
        <div className="absolute left-1/2 top-full mt-0.5 h-2 w-px -translate-x-1/2 bg-red-300/80" />
      </div>
    </div>
  );
};

export default AtlasPlayerMarker;
