/**
 * @file tableLamp.ts
 * @description The oil lamp that stands on a table in a lit household
 * (GG-594 part 3, 2026-11-02).
 *
 * Why: InteriorLights already puts an 8 cd point light above each table,
 * desk, counter and workbench while the household's windows are lit, but the
 * light came from nothing. This module gives that light a body: a small brass
 * standing lamp (base, stem, oil font, nozzle) and a flame.
 *
 * One source for the placement: LAMP_FURNITURE says which furniture holds a
 * lamp, and the flame center stands LAMP_FLAME_ABOVE_M above the table top.
 * InteriorLights puts its point light at that same point, and SiteBuilding
 * (World3DScene) draws the mesh there. A test pins the flame geometry to it.
 *
 * Both geometries are lathes around +y with their base at y = 0 (the table
 * top). They are built once and shared by every lamp.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 05/11/2026, 05:10:51
 * Dependents: components/World3D/InteriorLights.tsx, components/World3D/World3DScene.tsx, components/World3D/cameraGroundRaycast.ts, components/World3D/playerCameraVisibility.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';

/** This emitter mesh is visible but never blocks the camera's structure rays. */
export const TABLE_LAMP_NO_HIT_RAYCAST: THREE.Object3D['raycast'] = () => {};

/** Furniture that holds a lamp when the household has its lamps lit. */
export const LAMP_FURNITURE: ReadonlySet<string> = new Set(['table', 'desk', 'writing-desk', 'counter', 'workbench']);

/** The lamp's flame center stands this far above the top of its table. */
export const LAMP_FLAME_ABOVE_M = 0.3;

/** Brass of the lamp body. */
export const LAMP_BODY_HEX = '#9c7a3c';

/** Warm flame color, shown at full value (not tone mapped). */
export const LAMP_FLAME_HEX = '#ffd08a';

/** Lathe profile (radius, height) in meters, base to nozzle: a standing oil lamp. */
const BODY_PROFILE: ReadonlyArray<[number, number]> = [
  [0, 0], [0.06, 0], [0.06, 0.012], [0.03, 0.022], [0.012, 0.032],
  [0.012, 0.215], [0.035, 0.232], [0.046, 0.255], [0.03, 0.272], [0.008, 0.28], [0, 0.28],
];
/** Teardrop flame on the nozzle; widest at the flame center. */
const FLAME_PROFILE: ReadonlyArray<[number, number]> = [
  [0, 0.28], [0.008, 0.288], [0.012, LAMP_FLAME_ABOVE_M], [0.008, 0.318], [0, 0.34],
];
const LATHE_SEGMENTS = 12;

let bodyGeometry: THREE.LatheGeometry | null = null;
let flameGeometry: THREE.LatheGeometry | null = null;
let flameMaterial: THREE.MeshBasicMaterial | null = null;

const lathe = (profile: ReadonlyArray<[number, number]>) =>
  new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), LATHE_SEGMENTS);

/** The shared lamp body (do not dispose: every lamp uses it). */
export function tableLampBodyGeometry(): THREE.LatheGeometry {
  return (bodyGeometry ??= lathe(BODY_PROFILE));
}

/** The shared flame (do not dispose: every lamp uses it). */
export function tableLampFlameGeometry(): THREE.LatheGeometry {
  return (flameGeometry ??= lathe(FLAME_PROFILE));
}

/**
 * The flame shows its color at full value, as an emitter. three converts a
 * basic material for the WebGPU renderer, so one material serves both.
 */
export function tableLampFlameMaterial(): THREE.MeshBasicMaterial {
  return (flameMaterial ??= new THREE.MeshBasicMaterial({ color: LAMP_FLAME_HEX, toneMapped: false }));
}
