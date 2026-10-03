/**
 * @file GroundMovePlane.tsx
 * Interactive-3D click-to-move: an invisible horizontal plane over the loaded
 * ground tile. Clicking it walks the player's avatar to the clicked spot —
 * point-and-click locomotion (BG3-style), the character-control counterpart to
 * click-to-talk.
 *
 * It reuses the fight-in-place pick-plane pattern (an invisible plane +
 * `event.point` raycast) and the SAME coordinate convention as the camera walk
 * and combat pick, so a clicked destination lands the avatar exactly where a
 * camera walk would put it. XZ is what a move needs — the avatar resamples its
 * own terrain height (`groundSurfaceYM`) at the destination, so the plane's flat
 * Y is only the raycast surface, never the avatar's rendered elevation.
 *
 * Ordering: NPC figures (SceneCast) sit above this plane and stop propagation on
 * click, so clicking a person talks to them; clicking open ground moves you.
 */
import React from 'react';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { type SceneOrigin } from '@/systems/world3d/sceneOrigin';
interface GroundMovePlaneProps {
    ground: GroundWorld | null;
    sceneOrigin: SceneOrigin;
    /** Called with the clicked destination in tile/world meters (clamped to tile). */
    onGroundPick?: (xM: number, zM: number) => void;
}
declare const GroundMovePlane: React.FC<GroundMovePlaneProps>;
export default GroundMovePlane;
