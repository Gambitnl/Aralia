/**
 * THE CAMERA HOLD (agora-257c, 2026-10-30). A probe or a capture rig can hold
 * the World 3D camera at one pose; while it holds, the player's camera input
 * does nothing. Remy, 2026-10-30, after a probe held the camera with no sign:
 * "can you have an indicator somewhere that the camera is locked?" So a hold
 * is never silent: the HUD shows a badge with its note and a Release button
 * (`InWorldHUD.tsx`), and `FreeRoamCameraController` applies it each frame.
 *
 * Probe hook: `window.__wf3dHoldCamera(cam, target, note?)` and
 * `window.__wf3dReleaseCamera()`, scene coordinates. Use these, not a write to
 * the camera from `scene.onBeforeRender`, which leaves no sign.
 */
import { useSyncExternalStore } from 'react';

export interface CameraHold {
  /** Camera position, scene m. */
  cam: [number, number, number];
  /** The point the camera looks at, scene m. */
  target: [number, number, number];
  /** Who holds it and why, shown on the badge. */
  note: string;
}

let hold: CameraHold | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** Hold the camera at a pose until `releaseCamera`. */
export function holdCamera(cam: readonly number[], target: readonly number[], note = 'a probe'): void {
  if (cam.length < 3 || target.length < 3 || ![...cam, ...target].every(Number.isFinite)) {
    throw new Error('[camera] A hold needs a finite camera position and target.');
  }
  hold = { cam: [cam[0], cam[1], cam[2]], target: [target[0], target[1], target[2]], note };
  emit();
}

/** Give the camera back to the player. */
export function releaseCamera(): void {
  if (!hold) return;
  hold = null;
  emit();
}

export function getCameraHold(): CameraHold | null {
  return hold;
}

/** The current hold, for React (re-renders on hold and release). */
export function useCameraHold(): CameraHold | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    getCameraHold,
    getCameraHold,
  );
}

if (typeof window !== 'undefined') {
  const w = window as unknown as {
    __wf3dHoldCamera?: typeof holdCamera;
    __wf3dReleaseCamera?: typeof releaseCamera;
  };
  w.__wf3dHoldCamera = holdCamera;
  w.__wf3dReleaseCamera = releaseCamera;
}
