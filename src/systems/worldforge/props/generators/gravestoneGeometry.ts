/**
 * @file gravestoneGeometry.ts — owned, seeded graveyard monument geometry.
 *
 * Replaces the boulder reuse for `gravestone`, `tomb` and `stone-cross` in
 * GroundProps (beautification wave, owned-generators slice). Three kinds:
 *  - headstone: a thin slab (rounded-top or square per seed) with a small
 *    plinth, tilted a few degrees so rows read weathered, not machine-set.
 *  - tomb: a low sarcophagus box with a stepped lid.
 *  - cross: a stone cross on a two-step base.
 *
 * Unit frame: ground contact at y = 0. Deterministic from the seed
 * (unit-tested in __tests__/townPropGeometry.test.ts).
 */
import * as THREE from 'three';
import { makeRng } from './proceduralNoise';
import { PartBuilder, P } from './partBuilder';

export type GravestoneKind = 'headstone' | 'tomb' | 'cross';

export function createGravestoneGeometry(seed: number, kind: GravestoneKind = 'headstone'): THREE.BufferGeometry {
  const rng = makeRng(seed ^ 0x94a7e);
  const b = new PartBuilder();
  const stone = rng() < 0.5 ? P.STONE : P.STONE_PALE;

  if (kind === 'headstone') {
    const h = 0.75 + rng() * 0.35; // slab height
    const w = 0.5 + rng() * 0.2;
    const tilt = (rng() - 0.5) * 0.24; // weathered lean
    const lean = (rng() - 0.5) * 0.1;
    // plinth
    b.addBox(w * 1.25, 0.12, 0.3, P.STONE_DARK, [0, 0.06, 0]);
    // slab
    b.addBox(w, h, 0.12, stone, [Math.sin(tilt) * h * 0.4, 0.1 + (h / 2) * Math.cos(tilt), 0], [lean, 0, tilt]);
    if (rng() < 0.6) {
      // rounded top: a squashed cylinder cap lying along the slab top edge
      const cap = new THREE.CylinderGeometry(w / 2, w / 2, 0.12, 8);
      cap.scale(1, 1, 1);
      b.add(cap, stone, [Math.sin(tilt) * h * 0.82, 0.1 + h * Math.cos(tilt), 0], [Math.PI / 2, 0, tilt]);
    }
  } else if (kind === 'tomb') {
    const len = 1.9 + rng() * 0.4;
    const wid = 0.9 + rng() * 0.2;
    const rot = (rng() - 0.5) * 0.08;
    b.addBox(len * 1.1, 0.18, wid * 1.1, P.STONE_DARK, [0, 0.09, 0], [0, rot, 0]); // base step
    b.addBox(len, 0.62, wid, stone, [0, 0.18 + 0.31, 0], [0, rot, 0]); // body
    b.addBox(len * 1.06, 0.14, wid * 1.06, P.STONE_PALE, [0, 0.87, 0], [0, rot, 0]); // lid
    if (rng() < 0.5) {
      // gabled lid ridge
      b.addBox(len * 0.95, 0.22, wid * 0.5, P.STONE_PALE, [0, 1.0, 0], [0, rot, Math.PI / 40]);
    }
  } else {
    // cross
    const h = 1.5 + rng() * 0.5;
    const tilt = (rng() - 0.5) * 0.12;
    b.addBox(0.9, 0.16, 0.9, P.STONE_DARK, [0, 0.08, 0]); // lower step
    b.addBox(0.6, 0.18, 0.6, stone, [0, 0.25, 0]); // upper step
    b.addBox(0.16, h, 0.16, stone, [Math.sin(tilt) * h * 0.4, 0.34 + (h / 2) * Math.cos(tilt), 0], [0, 0, tilt]); // shaft
    b.addBox(0.72, 0.16, 0.16, stone, [Math.sin(tilt) * h * 0.62, 0.34 + h * 0.78 * Math.cos(tilt), 0], [0, 0, tilt]); // arms
  }
  return b.build();
}
