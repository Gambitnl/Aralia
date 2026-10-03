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
import React from 'react';
import { type SceneOrigin } from '@/systems/world3d/sceneOrigin';
/**
 * One-shot camera framing command. Bumping `nonce` (vs the last applied value)
 * snaps the camera to look straight down at `target` from `height` meters up,
 * with a slight horizontal offset so the view reads as a steep overhead rather
 * than a gimbal-locked top-down. Used by the HUD "Town Cell" button to pull the
 * camera up to frame the whole town without leaving the 3D scene.
 */
export interface CameraFrameRequest {
    nonce: number;
    target: readonly [number, number, number];
    height: number;
}
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
    /** Optional one-shot overhead framing command (see CameraFrameRequest). */
    frameRequest?: CameraFrameRequest | null;
}
declare const FreeRoamCameraController: React.FC<FreeRoamCameraControllerProps>;
export default FreeRoamCameraController;
