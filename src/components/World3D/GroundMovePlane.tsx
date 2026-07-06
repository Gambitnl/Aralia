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
import type { ThreeEvent } from '@react-three/fiber';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { groundSurfaceYM } from './PlayerAvatar';
import { sceneHitToTileMeters } from './groundClickMove';

interface GroundMovePlaneProps {
  ground: GroundWorld | null;
  sceneOrigin: SceneOrigin;
  /** Called with the clicked destination in tile/world meters (clamped to tile). */
  onGroundPick?: (xM: number, zM: number) => void;
}

const GroundMovePlane: React.FC<GroundMovePlaneProps> = ({ ground, sceneOrigin, onGroundPick }) => {
  if (!ground || !onGroundPick) return null;

  const extentX = ground.extentMetersX || 0;
  const extentZ = ground.extentMetersZ || 0;
  // Center the plane on the tile middle, at a representative surface height (the
  // click only needs XZ; the avatar plants itself on the real terrain height).
  const centerXM = extentX / 2;
  const centerZM = extentZ / 2;
  const centerScene = worldToScene(centerXM, centerZM, sceneOrigin);
  const centerY = groundSurfaceYM(ground, centerXM, centerZM);

  const handlePick = (e: ThreeEvent<PointerEvent>) => {
    // Stop the pick reaching any farther meshes; NPC figures already stop it
    // first (they're nearer the camera), so this only fires on open ground.
    e.stopPropagation();
    const { xM, zM } = sceneHitToTileMeters(e.point.x, e.point.z, sceneOrigin, extentX, extentZ);
    onGroundPick(xM, zM);
  };

  return (
    <mesh
      position={[centerScene.x, centerY, centerScene.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={handlePick}
      data-testid="ground-move-plane"
    >
      {/* Slightly oversize so the whole visible tile is clickable. */}
      <planeGeometry args={[extentX * 1.2 || 1000, extentZ * 1.2 || 1000]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
};

export default GroundMovePlane;
