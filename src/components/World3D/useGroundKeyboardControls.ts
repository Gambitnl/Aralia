// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 18:47:55
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { groundWalkHeight, type GroundWalkSurfaces } from './groundBuildingMotion';
import type { PlayerCharacter } from '@/types/character';
import { resolveGroundWaterWalk } from './groundWaterMovement';
import { groundFrameSeconds, groundSpeedMps, type GroundMovementIntent } from './groundLocomotion';

// ============================================================================
// Types & Configuration
// ============================================================================

export interface GroundKeyboardControlsProps {
  /** Ground world for boundary clamping and terrain extent. */
  groundWorld?: GroundWorld | null;
  /** Fixed floating-origin scene anchor. */
  sceneOrigin: SceneOrigin;
  /** Current logical ground position (tile-local meters). */
  playerGroundPos?: { xM: number; zM: number; yM?: number } | null;
  /** Begin keyboard control at the rendered body, including mid-click walks. */
  getFootfall?: () => { xM: number; zM: number; yM: number } | null;
  /** Callback to dispatch updated position to the state store. */
  onGroundPick?: (xM: number, zM: number) => void;
  /** Settle reached native feet without creating another click destination. */
  onGroundStop?: (position: { xM: number; zM: number; yM: number }) => void;
  /** Whether keyboard locomotion is enabled (e.g. ground mode, no active modal). */
  enabled?: boolean;
  openDoors?: ReadonlySet<string>;
  walkingSurfaces?: GroundWalkSurfaces;
  character?: PlayerCharacter | null;
  /** Shared with the visible body, including when Shift is held for a click. */
  movementIntent?: GroundMovementIntent;
}

/** Dispatch throttle interval in milliseconds to prevent React state flood. */
const DISPATCH_THROTTLE_MS = 40;

// ============================================================================
// Helper: Text Input Focus Guard
// ============================================================================
/** Checks whether the user is currently typing in an input or text field. */
function isTextInputFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    (active as HTMLElement).isContentEditable
  );
}

// ============================================================================
// 3D Keyboard Locomotion Driver Component (R3F Scene Child)
// ============================================================================
/**
 * R3F component mounted inside World3DScene Canvas.
 * Tracks held keys, steps the avatar's position, and glides the camera along with the player.
 */
export const GroundKeyboardDriver: React.FC<GroundKeyboardControlsProps> = ({
  groundWorld,
  sceneOrigin,
  playerGroundPos,
  onGroundPick,
  onGroundStop,
  enabled = true,
  openDoors,
  walkingSurfaces,
  character,
  movementIntent,
  getFootfall,
}) => {
  const { camera, controls } = useThree();

  // Active key state tracker
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });

  // Local authoritative position for smooth frame-by-frame accumulation
  const nativeKeyboard = Boolean(getFootfall && movementIntent && onGroundPick && onGroundStop);
  const footfallReader = useRef(getFootfall);
  footfallReader.current = getFootfall;
  const groundStop = useRef(onGroundStop);
  groundStop.current = onGroundStop;

  // Legacy callers still accumulate requested steps here. Native play sends
  // key direction to the body, which owns its single physical movement budget.
  const posRef = useRef({
    xM: playerGroundPos?.xM ?? sceneOrigin.x,
    zM: playerGroundPos?.zM ?? sceneOrigin.z,
    yM: playerGroundPos?.yM,
  });

  // Synchronize internal position when external discrete moves occur (e.g. mouse click)
  useEffect(() => {
    if (playerGroundPos) {
      posRef.current.xM = playerGroundPos.xM;
      posRef.current.zM = playerGroundPos.zM;
      posRef.current.yM = playerGroundPos.yM;
    }
  }, [playerGroundPos?.xM, playerGroundPos?.zM]);

  const lastDispatchTime = useRef(0);
  const isMovingRef = useRef(false);
  const cameraFootfallRef = useRef<{xM: number; zM: number} | null>(null);
  const followKeyboardRef = useRef(false);
  const translateCamera = (x: number, z: number) => {
    if (x === 0 && z === 0) return;
    camera.position.x += x; camera.position.z += z;
    const ctrl = controls as unknown as {target?: {x: number; z: number}; update?: () => void} | null;
    if (ctrl?.target) {
      ctrl.target.x += x; ctrl.target.z += z;
      ctrl.update?.();
    }
  };

  // ==========================================================================
  // Window Keydown / Keyup Event Listeners
  // ==========================================================================
  useEffect(() => {
    if (movementIntent && (!enabled || !nativeKeyboard)) movementIntent.keyboard = undefined;
    if (!enabled) return;
    if (nativeKeyboard && movementIntent) movementIntent.keyboard = keysRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTextInputFocused() || e.metaKey || e.ctrlKey || e.altKey) return;

      let matched = false;
      const k = keysRef.current;
      const hadDirectionalInput = k.forward || k.backward || k.left || k.right;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          k.forward = true;
          matched = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          k.backward = true;
          matched = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          k.left = true;
          matched = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          k.right = true;
          matched = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          k.sprint = true;
          if (movementIntent) movementIntent.sprinting = true;
          matched = true;
          break;
      }

      if (matched && nativeKeyboard && movementIntent) {
        movementIntent.keyboard = k;
        if (k.forward || k.backward || k.left || k.right) {
          movementIntent.keyboardOwnsFeet = true;
          // Cancel a previous click destination even when a brief key press
          // ends before the next render. Release must not resume that old walk.
          if (!hadDirectionalInput) {
            const feet = footfallReader.current?.();
            if (feet) groundStop.current?.(feet);
          }
        }
      }
      if (matched) {
        // Prevent default browser scrolling on arrow keys while exploring
        if (e.code.startsWith('Arrow')) {
          e.preventDefault();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = keysRef.current;
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          k.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          k.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          k.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          k.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          k.sprint = e.shiftKey;
          if (movementIntent) movementIntent.sprinting = k.sprint;
          break;
      }

      // If all movement keys released, perform final authoritative dispatch
      if (!k.forward && !k.backward && !k.left && !k.right && isMovingRef.current) {
        isMovingRef.current = false;
        const feet = nativeKeyboard ? footfallReader.current?.() : null;
        if (feet) groundStop.current?.(feet);
        else if (onGroundPick) onGroundPick(posRef.current.xM, posRef.current.zM);
      }
    };

    const handleBlur = () => {
      const feet = nativeKeyboard && isMovingRef.current ? footfallReader.current?.() : null;
      if (feet) groundStop.current?.(feet);
      // Clear all keys if window loses focus
      keysRef.current = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
      };
      isMovingRef.current = false;
      followKeyboardRef.current = false; cameraFootfallRef.current = null;
      if (movementIntent) movementIntent.sprinting = false;
      // Detach the old mutable key object. A disabled legacy listener may
      // still receive keys behind a modal, but cannot arm the native body.
      if (nativeKeyboard && movementIntent) movementIntent.keyboard = undefined;
    };

    // A pointer gesture hands the camera back to orbit/pan or stationary click
    // walking. Key release alone still lets the view follow the body's last step.
    const handlePointerDown = () => { followKeyboardRef.current = false; };
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      handleBlur();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [enabled, onGroundPick, movementIntent, nativeKeyboard]);

  // ==========================================================================
  // Per-Frame Movement Stepper & Camera Sync
  // ==========================================================================
  const tempCamDir = useRef(new THREE.Vector3());
  const tempCamRight = useRef(new THREE.Vector3());
  const UP_VECTOR = useRef(new THREE.Vector3(0, 1, 0));

  useFrame((_, delta) => {
    if (!enabled || !onGroundPick) return;

    const k = keysRef.current;
    const hasInput = k.forward || k.backward || k.left || k.right;

    if (hasInput) followKeyboardRef.current = true;
    const actualFootfall = getFootfall?.();
    if (actualFootfall) {
      const previous = cameraFootfallRef.current;
      // Requests can run ahead of interpolation and be resynchronized by save
      // reports. Only rendered footfalls may translate the keyboard's camera.
      if (previous && followKeyboardRef.current) translateCamera(actualFootfall.xM - previous.xM, actualFootfall.zM - previous.zM);
      cameraFootfallRef.current = {xM: actualFootfall.xM, zM: actualFootfall.zM};
    } else cameraFootfallRef.current = null;
    if (!hasInput) return;

    if (nativeKeyboard) {
      // The Avatar has already spent this frame's budget (-0.75). This pass
      // follows its reached feet (-0.5), never a second eased destination.
      if (actualFootfall) posRef.current = { ...actualFootfall };
      isMovingRef.current = true;
      return;
    }

    if (!isMovingRef.current) {
      const actual = getFootfall?.();
      if (actual) posRef.current = { ...actual };
    }
    isMovingRef.current = true;

    // Calculate camera planar forward & right vectors
    camera.getWorldDirection(tempCamDir.current);
    tempCamDir.current.y = 0;
    tempCamDir.current.normalize();
    if (tempCamDir.current.lengthSq() < 0.0001) {
      tempCamDir.current.set(0, 0, -1);
    }

    tempCamRight.current.crossVectors(tempCamDir.current, UP_VECTOR.current).normalize();

    // Compute net movement heading
    let dx = 0;
    let dz = 0;
    if (k.forward) {
      dx += tempCamDir.current.x;
      dz += tempCamDir.current.z;
    }
    if (k.backward) {
      dx -= tempCamDir.current.x;
      dz -= tempCamDir.current.z;
    }
    if (k.right) {
      dx += tempCamRight.current.x;
      dz += tempCamRight.current.z;
    }
    if (k.left) {
      dx -= tempCamRight.current.x;
      dz -= tempCamRight.current.z;
    }

    const inputMag = Math.hypot(dx, dz);
    if (inputMag < 0.001) return;

    // Normalize and scale by speed and elapsed frame time
    const normX = dx / inputMag;
    const normZ = dz / inputMag;
    const speed = groundSpeedMps(character, k.sprint);
    const stepSeconds = groundFrameSeconds(delta);
    const step = speed * stepSeconds;

    const stepX = normX * step;
    const stepZ = normZ * step;

    let nextX = posRef.current.xM + stepX;
    let nextZ = posRef.current.zM + stepZ;

    // Clamp within ground world spatial boundaries if available
    if (groundWorld) {
      const minBound = 2;
      const maxBoundX = Math.max(minBound, groundWorld.extentMetersX - 2);
      const maxBoundZ = Math.max(minBound, groundWorld.extentMetersZ - 2);
      nextX = Math.max(minBound, Math.min(maxBoundX, nextX));
      nextZ = Math.max(minBound, Math.min(maxBoundZ, nextZ));
    }

    if (groundWorld) {
      const from = { ...posRef.current, yM: groundWalkHeight(groundWorld, posRef.current, openDoors, walkingSurfaces) };
      let motion = resolveGroundWaterWalk(groundWorld, from, { xM: nextX, zM: nextZ }, step, movementIntent?.waterProfile ?? {}, openDoors, walkingSurfaces);
      if (motion.onStairs && step > 1.6 * stepSeconds) {
        motion = resolveGroundWaterWalk(groundWorld, from, { xM: from.xM + normX * 1.6 * stepSeconds,
          zM: from.zM + normZ * 1.6 * stepSeconds }, Math.min(speed, 1.6) * stepSeconds, movementIntent?.waterProfile ?? {}, openDoors, walkingSurfaces);
      }
      nextX = motion.xM;
      nextZ = motion.zM;
      posRef.current.yM = motion.yM;
      if (movementIntent) movementIntent.waterIssue = motion.water.reason;
    }

    const actualStepX = nextX - posRef.current.xM;
    const actualStepZ = nextZ - posRef.current.zM;

    posRef.current.xM = nextX;
    posRef.current.zM = nextZ;

    // Legacy callers without a rendered-body reader retain their established
    // requested-step follow. Native town play uses the actual-footfall pass above.
    if (!getFootfall) translateCamera(actualStepX, actualStepZ);

    // Throttled dispatch to update parent state smoothly
    const now = performance.now();
    if (now - lastDispatchTime.current >= DISPATCH_THROTTLE_MS) {
      lastDispatchTime.current = now;
      onGroundPick(nextX, nextZ);
    }
  // Move before the camera visibility pass (priority 0), after MapControls (-1).
  }, -0.5);

  return null;
};

export default GroundKeyboardDriver;
