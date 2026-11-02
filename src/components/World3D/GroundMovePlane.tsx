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
 * Ordering follows the actual terrain or supported floor ray: people, doors
 * and furnishings in front own the interaction even when the flat plane is nearer.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 02:41:27
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { groundSurfaceYM } from './terrain/groundSurfaceYM';
import { createGroundMoveGesture, hasInteractionBeforeGround, renderedGroundHit, sceneHitToTileMeters } from './groundClickMove';

interface GroundMovePlaneProps {
  ground: GroundWorld | null;
  sceneOrigin: SceneOrigin;
  /** Called with the clicked destination in tile/world meters (clamped to tile). */
  onGroundPick?: (xM: number, zM: number) => void;
}

const GroundMovePlane: React.FC<GroundMovePlaneProps> = ({ ground, sceneOrigin, onGroundPick }) => {
  const scene = useThree(state => state.scene);
  const gesture = useRef(createGroundMoveGesture());
  useEffect(() => {
    // Native capture follows a held pointer beyond the pick mesh. MapControls
    // can pan/orbit freely; only an uninterrupted tap reaches handlePick.
    const move = (event: PointerEvent) => gesture.current.move(event);
    const interrupt = (event: PointerEvent) => {
      if (event.isPrimary === false || event.button !== 0) gesture.current.cancel();
    };
    const cancel = () => gesture.current.cancel();
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerdown', interrupt, true);
    window.addEventListener('pointerup', cancel);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    return () => {
      cancel();
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerdown', interrupt, true);
      window.removeEventListener('pointerup', cancel);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
    };
  }, []);
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
    if (!gesture.current.finish(e)) return;
    const hit = renderedGroundHit(scene, e.ray);
    if (!hit || hasInteractionBeforeGround(e.intersections, e.eventObject, e.ray, hit)) return;
    e.stopPropagation();
    const { xM, zM } = sceneHitToTileMeters(hit.x, hit.z, sceneOrigin, extentX, extentZ);
    onGroundPick(xM, zM);
  };

  return (
    <mesh
      position={[centerScene.x, centerY, centerScene.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        // The library desk exposed a plane-first click that both examined and
        // walked. Yield without stopping propagation so its own handler runs.
        const hit = renderedGroundHit(scene, event.ray);
        if (!hit || hasInteractionBeforeGround(event.intersections, event.eventObject, event.ray, hit)) {
          gesture.current.cancel();
          return;
        }
        gesture.current.begin(event);
      }}
      onPointerUp={handlePick}
      onPointerCancel={() => gesture.current.cancel()}
      data-testid="ground-move-plane"
    >
      {/* Slightly oversize so the whole visible tile is clickable. */}
      <planeGeometry args={[extentX * 1.2 || 1000, extentZ * 1.2 || 1000]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
};

export default GroundMovePlane;
