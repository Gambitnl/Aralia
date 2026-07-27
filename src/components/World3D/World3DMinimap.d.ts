/**
 * @file src/components/World3D/World3DMinimap.tsx
 * In-3D minimap overlay (Plan 4 deferred UX) — composited inside InWorldHUD.
 *
 * While exploring the streamed 3D world you lose the bird's-eye sense of where you
 * are. This paints a compact top-down view of the world straight from `WorldData`
 * (the same source the 3D scene streams from) and tracks the live player position
 * with the shared `AtlasPlayerMarker`. Unlike `WorldAtlasStrip` (which reads the
 * Azgaar `MapData` tiles on the 2D layout) this reads worldsim's flat `biomeIds`
 * grid, so it works inside the 3D view where only `WorldData` is available.
 */
import React from 'react';
import type { WorldData } from '../../services/worldSim/types';
import type { PlayerWorldPosition } from '../../types';
export interface World3DMinimapProps {
    /** World source the 3D scene streams from; null hides the minimap. */
    worldData: WorldData | null;
    /** Live player position; null hides the minimap until movement starts. */
    playerWorldPos: PlayerWorldPosition | null;
}
declare const World3DMinimap: React.FC<World3DMinimapProps>;
export default World3DMinimap;
