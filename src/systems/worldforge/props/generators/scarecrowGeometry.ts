/**
 * @file scarecrowGeometry.ts — owned, seeded scarecrow geometry.
 *
 * Replaces the barrel reuse for `scarecrow` (beautification wave,
 * owned-generators slice): a leaning pole + crossbar, a sacking head, a
 * canvas "coat" block with ragged hem, straw tufts at the wrists and a hat on
 * most seeds. Silhouette is the whole job here — the T-pose reads instantly
 * in a field.
 *
 * Unit frame: ground contact at y = 0. Deterministic from the seed.
 */
import * as THREE from 'three';
import { makeRng } from './proceduralNoise';
import { PartBuilder, P } from './partBuilder';

export function createScarecrowGeometry(seed: number): THREE.BufferGeometry {
  const rng = makeRng(seed ^ 0x5ca7c);
  const b = new PartBuilder();

  const h = 1.9 + rng() * 0.3;
  const lean = (rng() - 0.5) * 0.16;
  const armY = h * 0.72;
  const armTilt = (rng() - 0.5) * 0.2;
  const coat = rng() < 0.5 ? P.CANVAS : '#9a8266';

  // pole + crossbar
  b.addCylinder(0.04, 0.05, h, 6, P.WOOD_DARK, [0, h / 2, 0], [0, 0, lean]);
  b.addBox(1.5, 0.06, 0.06, P.WOOD_DARK, [Math.sin(lean) * armY, armY, 0], [0, 0, armTilt + lean * 0.5]);

  // coat: torso block + flared ragged hem (two offset boxes)
  const cx = Math.sin(lean) * h * 0.55;
  b.addBox(0.5, 0.55, 0.28, coat, [cx, h * 0.55, 0], [0, 0, lean]);
  b.addBox(0.62, 0.22, 0.34, coat, [cx - 0.03, h * 0.36, 0], [0.08, 0.2, lean + 0.1]);
  // sleeves along the crossbar
  b.addBox(0.42, 0.16, 0.16, coat, [cx + 0.45, armY + 0.01, 0], [0, 0, armTilt]);
  b.addBox(0.42, 0.16, 0.16, coat, [cx - 0.45, armY - 0.01, 0], [0, 0, armTilt]);
  // straw tufts at wrists and hem
  b.addSphere(0.09, P.STRAW, [cx + 0.72, armY + Math.tan(armTilt) * 0.7, 0], 5, 4, [1, 0.7, 1]);
  b.addSphere(0.09, P.STRAW, [cx - 0.72, armY - Math.tan(armTilt) * 0.7, 0], 5, 4, [1, 0.7, 1]);
  b.addSphere(0.2, P.STRAW, [cx, h * 0.28, 0], 5, 4, [1.3, 0.5, 1.3]);

  // head: sack sphere + optional hat
  const hy = h * 0.9;
  const hx = Math.sin(lean) * hy;
  b.addSphere(0.17, '#c4b18b', [hx, hy, 0], 6, 5, [1, 1.15, 1]);
  if (rng() < 0.75) {
    b.addCylinder(0.3, 0.32, 0.05, 8, P.WOOD_DARK, [hx, hy + 0.13, 0], [0.1, 0, lean]); // brim
    b.addCylinder(0.14, 0.18, 0.2, 7, P.WOOD_DARK, [hx + 0.02, hy + 0.24, 0], [0.1, 0, lean]); // crown
  }
  return b.build();
}
