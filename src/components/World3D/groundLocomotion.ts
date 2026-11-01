/** Shared free-roam pace. Character speed stays in its existing feet-per-round
 * model; both input requests and the visible body convert it at this boundary.
 * Shift requests twice that pace. It does not spend or replace combat actions. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 18:47:55
 * Dependents: components/World3D/PlayerAvatar.tsx, components/World3D/World3DScene.tsx, components/World3D/useGroundKeyboardControls.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GroundWaterProfile, GroundWaterMovement } from './groundWaterMovement';
import type { PlayerCharacter } from '@/types/character';
import { getMovementSpeed } from '@/utils/character/partyStatUtils';

/** Scene-local transient intent, reset by the keyboard owner on blur/cleanup.
 * Sharing this object keeps a Shift-click and Shift-WASD on the same pace. */
export interface GroundKeyboardIntent {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

export interface GroundMovementIntent {
  sprinting: boolean;
  /** Native keys request direction; the body spends their physical budget once. */
  keyboard?: GroundKeyboardIntent;
  /** Hold reached feet after release until a new destination takes over. */
  keyboardOwnsFeet?: boolean;
  /** Body-owned standing anatomy, shared by both input paths; never saved. */
  waterProfile?: GroundWaterProfile;
  /** Last failed water request remains readable until another approach is tried. */
  waterIssue?: GroundWaterMovement['reason'];
}

export function groundKeyboardHasInput(keys?: GroundKeyboardIntent): boolean {
  return Boolean(keys && (keys.forward || keys.backward || keys.left || keys.right));
}

/** Planar camera-relative heading, shared without a second movement solver. */
export function groundKeyboardHeading(keys: GroundKeyboardIntent | undefined, forward: { x: number; z: number }): { x: number; z: number } {
  if (!keys) return { x: 0, z: 0 };
  const length = Math.hypot(forward.x, forward.z);
  const fx = length > 1e-6 ? forward.x / length : 0, fz = length > 1e-6 ? forward.z / length : -1;
  const along = Number(keys.forward) - Number(keys.backward), across = Number(keys.right) - Number(keys.left);
  const x = fx * along - fz * across, z = fz * along + fx * across, magnitude = Math.hypot(x, z);
  return magnitude > 1e-6 ? { x: x / magnitude, z: z / magnitude } : { x: 0, z: 0 };
}

export function groundSpeedMps(character?: PlayerCharacter | null, sprinting = false): number {
  const feetPerRound = character ? getMovementSpeed(character) : 30;
  const validSpeed = Number.isFinite(feetPerRound) ? Math.max(0, feetPerRound) : 0;
  return validSpeed * .3048 / 6 * (sprinting ? 2 : 1);
}

/** A stalled frame cannot turn a fine doorway adjustment into a long stride. */
export function groundFrameSeconds(delta: number): number {
  return Number.isFinite(delta) ? Math.min(.1, Math.max(0, delta)) : 0;
}
