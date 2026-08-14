// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 04:03:59
 * Dependents: components/BattleMap/camera/CameraController.tsx, components/BattleMap/terrain/TerrainMesh.tsx, components/BattleMap/terrain/VolumeArenaGround.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file defines non-conflicting mouse gestures for the 3D battle map.
 *
 * MapControls owns middle-drag panning, right-drag orbit, and wheel zoom. Left
 * click remains actor/tile input. The gesture guard prevents a left drag from
 * becoming a movement click when the browser later emits `click`.
 */

import { MOUSE } from 'three';

// Left is intentionally disabled for camera control. The controls help already
// documents middle pan and right orbit, so the gameplay gesture stays visible.
export const BATTLE_MAP_CAMERA_MOUSE_BUTTONS = {
  LEFT: -1,
  MIDDLE: MOUSE.PAN,
  RIGHT: MOUSE.ROTATE,
} as const;

export const BATTLE_MAP_CAMERA_GESTURES = {
  pan: 'middle-drag',
  orbit: 'right-drag',
  zoom: 'wheel',
} as const;

interface PointerSample {
  button: number;
  clientX: number;
  clientY: number;
}

export interface TilePointerGestureGuard {
  begin(sample: PointerSample): void;
  move(sample: PointerSample): void;
  end(sample: PointerSample): void;
  consumeClick(): boolean;
}

/** Create one stateful guard per clickable terrain surface. */
export function createTilePointerGestureGuard(dragThresholdPixels = 4): TilePointerGestureGuard {
  let trackingLeftButton = false;
  let startX = 0;
  let startY = 0;
  let dragged = false;
  const thresholdSquared = dragThresholdPixels * dragThresholdPixels;

  return {
    begin(sample) {
      if (sample.button !== 0) return;
      trackingLeftButton = true;
      startX = sample.clientX;
      startY = sample.clientY;
      dragged = false;
    },
    move(sample) {
      if (!trackingLeftButton) return;
      const deltaX = sample.clientX - startX;
      const deltaY = sample.clientY - startY;
      if ((deltaX * deltaX) + (deltaY * deltaY) > thresholdSquared) dragged = true;
    },
    end(sample) {
      if (sample.button === 0) trackingLeftButton = false;
    },
    consumeClick() {
      const shouldActivate = !dragged;
      trackingLeftButton = false;
      dragged = false;
      return shouldActivate;
    },
  };
}
