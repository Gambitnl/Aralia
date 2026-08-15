/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/World3D/useGroundKeyboardControls.ts
 *
 * Provides real-time keyboard locomotion (WASD / Arrow Keys) for the 3D ground world.
 *
 * ARCHITECTURAL ROLE:
 * Translates standard keyboard movement inputs (W/A/S/D, Arrow keys, and Shift to sprint)
 * into continuous directional ground movement. The movement is oriented relative to the
 * current camera azimuth so pressing "W" always walks into the scene and "D" walks right.
 *
 * CAMERA SYNCHRONIZATION:
 * Advances the camera and its MapControls look-at target together with the walking avatar
 * so the camera follows third-person locomotion seamlessly without snapping or jitter.
 *
 * MULTI-AGENT SAFETY:
 * Works symbiotically with GroundMovePlane (mouse click-to-move) and PlayerAvatar (gait
 * and orientation animation). Both mouse and keyboard dispatch to the same canonical
 * `onGroundPick` (SET_PLAYER_GROUND_POS) movement state.
 */

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';

// ============================================================================
// Types & Configuration
// ============================================================================

export interface GroundKeyboardControlsProps {
  /** Ground world for boundary clamping and terrain extent. */
  groundWorld?: GroundWorld | null;
  /** Fixed floating-origin scene anchor. */
  sceneOrigin: SceneOrigin;
  /** Current logical ground position (tile-local meters). */
  playerGroundPos?: { xM: number; zM: number } | null;
  /** Callback to dispatch updated position to the state store. */
  onGroundPick?: (xM: number, zM: number) => void;
  /** Whether keyboard locomotion is enabled (e.g. ground mode, no active modal). */
  enabled?: boolean;
}

/** Standard walking speed in meters per second. */
const WALK_SPEED_MPS = 6.0;

/** Sprinting speed in meters per second (holding Shift). */
const SPRINT_SPEED_MPS = 12.0;

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
  enabled = true,
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
  const posRef = useRef({
    xM: playerGroundPos?.xM ?? sceneOrigin.x,
    zM: playerGroundPos?.zM ?? sceneOrigin.z,
  });

  // Synchronize internal position when external discrete moves occur (e.g. mouse click)
  useEffect(() => {
    if (playerGroundPos) {
      posRef.current.xM = playerGroundPos.xM;
      posRef.current.zM = playerGroundPos.zM;
    }
  }, [playerGroundPos?.xM, playerGroundPos?.zM]);

  const lastDispatchTime = useRef(0);
  const isMovingRef = useRef(false);

  // ==========================================================================
  // Window Keydown / Keyup Event Listeners
  // ==========================================================================
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTextInputFocused() || e.metaKey || e.ctrlKey || e.altKey) return;

      let matched = false;
      const k = keysRef.current;

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
          matched = true;
          break;
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
          k.sprint = false;
          break;
      }

      // If all movement keys released, perform final authoritative dispatch
      if (!k.forward && !k.backward && !k.left && !k.right && isMovingRef.current) {
        isMovingRef.current = false;
        if (onGroundPick) {
          onGroundPick(posRef.current.xM, posRef.current.zM);
        }
      }
    };

    const handleBlur = () => {
      // Clear all keys if window loses focus
      keysRef.current = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
      };
      isMovingRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, onGroundPick]);

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

    if (!hasInput) {
      return;
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
    const speed = k.sprint ? SPRINT_SPEED_MPS : WALK_SPEED_MPS;
    const step = speed * Math.min(delta, 0.1);

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

    const actualStepX = nextX - posRef.current.xM;
    const actualStepZ = nextZ - posRef.current.zM;

    posRef.current.xM = nextX;
    posRef.current.zM = nextZ;

    // Advance camera and MapControls target alongside the player
    camera.position.x += actualStepX;
    camera.position.z += actualStepZ;

    const ctrl = controls as any;
    if (ctrl && ctrl.target) {
      ctrl.target.x += actualStepX;
      ctrl.target.z += actualStepZ;
      if (typeof ctrl.update === 'function') {
        ctrl.update();
      }
    }

    // Throttled dispatch to update parent state smoothly
    const now = performance.now();
    if (now - lastDispatchTime.current >= DISPATCH_THROTTLE_MS) {
      lastDispatchTime.current = now;
      onGroundPick(nextX, nextZ);
    }
  });

  return null;
};

export default GroundKeyboardDriver;
