/**
 * @file src/components/World3D/AtlasPlayerMarker.tsx
 * Draws the player's last known 3D world position on the Azgaar atlas overlay.
 *
 * Why this exists: when you exit 3D back to the map (or open the world map while
 * playerWorldPos is set), you should see where you were in the streamed world.
 * The marker uses the same pan/zoom math as travel precision overlays so it stays
 * aligned when you drag or zoom the embedded atlas.
 */
import React from 'react';
import type { PlayerWorldPosition } from '../../types';
import type { AzgaarAtlasTransform } from '@/utils/spatial';
export interface AtlasPlayerMarkerProps {
    /** Last known 3D position from game state (null hides the marker). */
    playerWorldPos: PlayerWorldPosition;
    /** World map grid size — must match MapPane mapData.gridSize. */
    gridCols: number;
    gridRows: number;
    /** Live Azgaar pan/zoom from the iframe bridge (may be null before ready). */
    atlasTransform: AzgaarAtlasTransform | null;
}
declare const AtlasPlayerMarker: React.FC<AtlasPlayerMarkerProps>;
export default AtlasPlayerMarker;
