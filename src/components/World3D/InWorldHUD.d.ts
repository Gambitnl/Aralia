/**
 * @file src/components/World3D/InWorldHUD.tsx
 * HUD container that overlays the 3D canvas without blocking R3F interaction.
 *
 * Mounts as a sibling of World3DScene inside World3DWrapper.
 * Uses position: absolute; pointer-events: auto to overlay the canvas.
 *
 * Sub-components:
 * - HUDControlPanel: dropdown menu with "Open Map", "Exit to Menu"
 * - ViewModeToggle: switch between 3D/Atlas modes
 * - DebugHUD: dev-only technical readout (chunk count, FPS, coords, streamer
 *   stats) — hosted inside the "3D World View" title dropdown when dev mode is on
 */
import React from 'react';
import type { WorldData } from '../../services/worldSim/types';
import type { PlayerWorldPosition } from '../../types';
import type { WorldGenDiagnostics } from '../../types/world';
import type { CanonicalTownIdentity } from '../../systems/worldforge/artifacts';
import type { GroundFocus } from '../../systems/worldforge/leaf3d/atlasGroundDrilldown';
interface InWorldHUDProps {
    /** Whether dev mode is enabled (controls DebugHUD visibility). */
    isDevModeEnabled: boolean;
    /** World source for the in-3D minimap (null hides it). */
    worldData?: WorldData | null;
    /** World generation provenance (primary vs fallback) for the DebugHUD. */
    worldGen?: WorldGenDiagnostics | null;
    /** Current chunk count loaded (for DebugHUD). */
    chunkCount?: number;
    /** FPS counter value (for DebugHUD). */
    fps?: number;
    /** Player world position (for DebugHUD and minimap). */
    playerPos?: PlayerWorldPosition | null;
    /** Streamer stats (for DebugHUD). */
    streamerStats?: {
        chunksLoaded: number;
        chunksUnloaded: number;
        pendingRequests: number;
    };
    /** Callback when "Open Map" is clicked — returns to atlas mode. */
    onOpenMap: () => void;
    /** Callback when "Exit to Menu" is clicked — returns to main menu. */
    onExitToMenu: () => void;
    /** Whether we are currently in Ground/Village mode (vs Continent mode). */
    isGroundMode?: boolean;
    /** Callback to toggle between Ground and Continent views. */
    onToggleGroundMode?: () => void;
    /**
     * Pull the camera up to an overhead "Town Cell" framing of the whole town,
     * staying in 3D. Only provided in ground mode (otherwise the button hides).
     */
    onFrameTownCell?: () => void;
    /**
     * Open the 2D Voronoi world map (modal over the 3D view) centered on the
     * player's town cell. Only provided in ground mode (otherwise hides).
     */
    onOpenCellMap?: () => void;
    /**
     * Open the 2D world map (modal over the 3D view) drilled straight to the
     * player's town PLAN — the detailed building/ward map of the town the player
     * is standing in. Only provided in ground mode (otherwise hides).
     */
    onOpenTownPlan?: () => void;
    /** Canonical retained-Local focus shown as the PLAYING place identity. */
    groundFocus?: GroundFocus | null;
    /** Atlas burg identity copied through Region and Local without renaming. */
    groundTownIdentity?: CanonicalTownIdentity | null;
}
declare const InWorldHUD: React.FC<InWorldHUDProps>;
export default InWorldHUD;
