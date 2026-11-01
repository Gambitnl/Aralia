/**
 * Physical cues for existing discovery sources. These meshes grant no name,
 * discovery, occupants, fire, loot or dungeon access; those stay with gameplay.
 * GroundProps batches them through the existing vertex-colored form table.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 01:55:53
 * Dependents: systems/worldforge/props/generators/townPropForms.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type * as THREE from 'three';
import { PartBuilder, P } from './partBuilder';
import { makeRng } from './proceduralNoise';

export function createCaveOverhangGeometry(seed: number): THREE.BufferGeometry {
  const rng = makeRng(seed ^ 0xca7e);
  const b = new PartBuilder();
  // An open rock overhang identifies the authored cave site without cutting
  // terrain or inventing a traversable tunnel behind it.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      b.addBox(0.85 + rng() * 0.2, 0.95, 1.8 + rng() * 0.3,
        row % 2 ? P.STONE : P.STONE_DARK,
        [side * (1.55 - row * 0.08), 0.475 + row * 0.84, 0],
        [0, (rng() - 0.5) * 0.13, side * 0.04]);
    }
  }
  b.addBox(3.8, 0.8, 2.2, P.STONE_DARK, [0, 2.85, 0]);
  b.addSphere(1.1, P.STONE, [0.3, 3.1, -0.1], 7, 4, [1.65, 0.4, 1]);
  return b.build();
}

export function createUnlitFirepitGeometry(seed: number): THREE.BufferGeometry {
  const rng = makeRng(seed ^ 0xf17e);
  const b = new PartBuilder();
  // Cold ash and stones imply a camp site, without asserting that someone is
  // present or that a fire has been lit. Ignition and recovery remain separate.
  b.addCylinder(0.58, 0.6, 0.04, 12, '#393735', [0, 0.02, 0]);
  for (let i = 0; i < 9; i++) {
    const angle = i * Math.PI * 2 / 9;
    b.addSphere(0.19 + rng() * 0.04, i % 2 ? P.STONE : P.STONE_DARK,
      [Math.cos(angle) * 0.66, 0.13, Math.sin(angle) * 0.66], 5, 4, [1, 0.7, 1]);
  }
  return b.build();
}
