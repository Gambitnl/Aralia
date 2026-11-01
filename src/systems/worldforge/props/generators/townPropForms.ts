/**
 * @file townPropForms.ts — render-form table for the owned TOWN prop
 * generators (beautification wave, owned-generators slice).
 *
 * Maps each upgraded defId to its cached seeded geometry variants so
 * GroundProps can render one vertex-colored InstancedMesh per (def, variant)
 * with a single data-driven loop. Seeds are frozen constants → the same
 * variants forever (the per-instance `variation.variant` picks among them,
 * exactly like the boulder/bush/log forms).
 *
 * All geometries are unit-frame (ground contact at y = 0) and carry a baked
 * `color` attribute — render with `vertexColors` and yLift 0.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 01:55:53
 * Dependents: components/World3D/GroundProps.tsx, components/World3D/WebGPUProbeScene.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type * as THREE from 'three';
import { createGravestoneGeometry } from './gravestoneGeometry';
import { createPostGeometry } from './postGeometry';
import { createStatueGeometry } from './statueGeometry';
import { createAnvilGeometry } from './anvilGeometry';
import { createScarecrowGeometry } from './scarecrowGeometry';
import { createBrazierGeometry } from './brazierGeometry';
import { createCaveOverhangGeometry, createUnlitFirepitGeometry } from './hiddenSiteGeometry';

export interface TownPropForm {
  /** Cached geometry variants; instance `variant % length` selects one. */
  geometries: THREE.BufferGeometry[];
}

/** Build all town-prop geometry variants (call once, memoized by the renderer). */
export function buildTownPropForms(): Record<string, TownPropForm> {
  return {
    gravestone: { geometries: [11, 12, 13].map((s) => createGravestoneGeometry(s, 'headstone')) },
    tomb: { geometries: [21, 22].map((s) => createGravestoneGeometry(s, 'tomb')) },
    'stone-cross': { geometries: [31, 32].map((s) => createGravestoneGeometry(s, 'cross')) },
    'lantern-post': { geometries: [41, 42, 43].map((s) => createPostGeometry(s, 'lantern')) },
    'tavern-sign': { geometries: [51, 52].map((s) => createPostGeometry(s, 'sign')) },
    fingerpost: { geometries: [61, 62].map((s) => createPostGeometry(s, 'fingerpost')) },
    statue: { geometries: [71, 72, 73].map((s) => createStatueGeometry(s, 'statue')) },
    milestone: { geometries: [81, 82].map((s) => createStatueGeometry(s, 'milestone')) },
    'wayside-shrine': { geometries: [91, 92].map((s) => createStatueGeometry(s, 'shrine')) },
    anvil: { geometries: [101].map((s) => createAnvilGeometry(s, 'anvil')) },
    grindstone: { geometries: [111, 112].map((s) => createAnvilGeometry(s, 'grindstone')) },
    scarecrow: { geometries: [121, 122, 123].map((s) => createScarecrowGeometry(s)) },
    // Discovery cues reuse this cached/batched form owner; they imply no fire or entry.
    'cave-mouth': { geometries: [141, 142].map(createCaveOverhangGeometry) },
    firepit: { geometries: [151, 152].map(createUnlitFirepitGeometry) },
    brazier: { geometries: [131, 132, 133].map((s) => createBrazierGeometry(s)) },
  };
}

/** DefIds upgraded to owned meshes — GroundProps must NOT route these through RENDER_VARIANT. */
export const TOWN_PROP_FORM_IDS = [
  'gravestone', 'tomb', 'stone-cross',
  'lantern-post', 'tavern-sign', 'fingerpost',
  'statue', 'milestone', 'wayside-shrine',
  'anvil', 'grindstone', 'scarecrow', 'brazier', 'cave-mouth', 'firepit',
] as const;
