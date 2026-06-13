/**
 * @file FreeRoamCameraController.tsx
 * @description Free-roam orbit/pan camera for the streamed 3D world. Reports its look-at
 * world position to the parent (throttled) so chunk streaming can follow it.
 *
 * Why this is built this way:
 * - A map-style orbit/pan camera gives a natural "divine overview" suitable for inspecting
 *   infinite procedural terrain without character physical constraints.
 * - Throttling position reporting at ~10 Hz (REPORT_INTERVAL = 0.1s) is critical for performance;
 *   re-evaluating sliding-window loading logic on every single frame would cause CPU overhead
 *   and degrade framerates.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import * as THREE from 'three';
import { sceneToWorld, type SceneOrigin } from '@/systems/world3d/sceneOrigin';

interface FreeRoamCameraControllerProps {
  /** Initial look-at target in SCENE-LOCAL coords (typically [0,0,0]). */
  initialTarget: readonly [number, number, number];
  /** Scene origin used to convert the scene-local camera target back to world coords. */
  sceneOrigin: SceneOrigin;
  /** Called (throttled) with the controls' current target in ABSOLUTE WORLD coords. */
  onPositionChange: (worldX: number, worldZ: number) => void;
  /** Dolly floor in meters — walking-scale scenes want ~2, map scale ~20. */
  minDistance?: number;
  /** Dolly ceiling in meters. */
  maxDistance?: number;
}

const REPORT_INTERVAL = 0.1; // seconds (~10 Hz)

const FreeRoamCameraController: React.FC<FreeRoamCameraControllerProps> = ({
  initialTarget,
  sceneOrigin,
  onPositionChange,
  minDistance = 20,
  maxDistance = 2000,
}) => {
  const controlsRef = useRef<any>(null);
  const sinceReport = useRef(0);
  const lastReported = useRef(new THREE.Vector2(NaN, NaN));

  useFrame((three, delta) => {
    const controls = controlsRef.current;
    if (!controls?.target) return;

    // Dev hooks: expose the live camera pose (read every frame) and a pose
    // SETTER so external tooling (headless capture replication, orchestrator
    // screenshot review) can mirror the user's exact framing.
    const w = window as unknown as {
      __wf3dPose?: object;
      __wf3dSetPose?: (cam: number[], target: number[]) => void;
    };
    w.__wf3dPose = {
      cam: three.camera.position.toArray(),
      target: controls.target.toArray(),
    };
    if (!w.__wf3dSetPose) {
      w.__wf3dSetPose = (cam: number[], target: number[]) => {
        three.camera.position.set(cam[0], cam[1], cam[2]);
        controls.target.set(target[0], target[1], target[2]);
        controls.update();
      };
    }

    sinceReport.current += delta;
    if (sinceReport.current < REPORT_INTERVAL) return;

    sinceReport.current = 0;
    const t = controls.target as THREE.Vector3;

    if (lastReported.current.x !== t.x || lastReported.current.y !== t.z) {
      lastReported.current.set(t.x, t.z);
      // Controls operate in scene-local space; the streamer needs absolute world coords.
      const w = sceneToWorld(t.x, t.z, sceneOrigin);
      onPositionChange(w.x, w.z);
    }
  });

  return (
    <MapControls
      ref={controlsRef}
      target={[initialTarget[0], initialTarget[1], initialTarget[2]]}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={Math.PI * 0.1}
      maxPolarAngle={Math.PI * 0.48}
      enableDamping
      dampingFactor={0.08}
    />
  );
};

export default FreeRoamCameraController;
