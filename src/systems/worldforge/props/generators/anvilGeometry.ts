/**
 * @file anvilGeometry.ts — owned, seeded smithy-street furniture: anvil on a
 * stump, and a foot-treadle grindstone.
 *
 * Replaces the crate reuse for `anvil` and the boulder reuse for `grindstone`
 * (beautification wave, owned-generators slice).
 *  - anvil: oak stump + iron body with a stepped waist, flat face and a
 *    tapered horn — the horn is the read at walking scale.
 *  - grindstone: A-frame wooden trestle + big stone wheel on an axle +
 *    treadle board.
 *
 * Unit frame: ground contact at y = 0. Deterministic from the seed.
 */
import * as THREE from 'three';
import { makeRng } from './proceduralNoise';
import { PartBuilder, P } from './partBuilder';

export type SmithyKind = 'anvil' | 'grindstone';

export function createAnvilGeometry(seed: number, kind: SmithyKind = 'anvil'): THREE.BufferGeometry {
  const rng = makeRng(seed ^ 0xa4711);
  const b = new PartBuilder();

  if (kind === 'anvil') {
    const stumpH = 0.42 + rng() * 0.1;
    const rot = rng() * Math.PI;
    // stump
    b.addCylinder(0.26, 0.3, stumpH, 8, P.WOOD_DARK, [0, stumpH / 2, 0], [0, rot, 0]);
    b.addCylinder(0.26, 0.26, 0.02, 8, P.WOOD_PALE, [0, stumpH, 0], [0, rot, 0]); // cut face
    // anvil body: foot, waist, face block, horn
    const y0 = stumpH;
    b.addBox(0.4, 0.09, 0.3, P.IRON, [0, y0 + 0.045, 0]); // foot
    b.addBox(0.24, 0.14, 0.18, P.IRON, [0, y0 + 0.16, 0]); // waist
    b.addBox(0.56, 0.13, 0.24, P.IRON, [0.02, y0 + 0.295, 0]); // face block
    // horn: tapered cone lying forward
    const horn = new THREE.CylinderGeometry(0.012, 0.09, 0.34, 6);
    b.add(horn, P.IRON, [0.44, y0 + 0.31, 0], [0, 0, -Math.PI / 2 - 0.12]);
  } else {
    // grindstone
    const wheelR = 0.38 + rng() * 0.08;
    const axleY = wheelR + 0.18;
    // two A-frame leg pairs
    for (const side of [-0.26, 0.26]) {
      b.addBox(0.07, axleY * 1.15, 0.07, P.WOOD_DARK, [0.16, axleY * 0.52, side], [0.28 * Math.sign(side) * 0, 0, 0.3]);
      b.addBox(0.07, axleY * 1.15, 0.07, P.WOOD_DARK, [-0.16, axleY * 0.52, side], [0, 0, -0.3]);
    }
    // cross rails
    b.addBox(0.08, 0.08, 0.62, P.WOOD, [0.3, 0.12, 0]);
    b.addBox(0.08, 0.08, 0.62, P.WOOD, [-0.3, 0.12, 0]);
    // stone wheel (upright, spins around Z-axis through the frame)
    const wheel = new THREE.CylinderGeometry(wheelR, wheelR, 0.14, 12);
    b.add(wheel, rng() < 0.5 ? P.STONE : P.STONE_PALE, [0, axleY, 0], [Math.PI / 2, 0, 0]);
    // axle
    b.addCylinder(0.035, 0.035, 0.66, 6, P.WOOD_DARK, [0, axleY, 0], [Math.PI / 2, 0, 0]);
    // treadle board
    b.addBox(0.5, 0.04, 0.2, P.WOOD_PALE, [0.05, 0.08, 0.3], [0, 0.15, 0.08]);
  }
  return b.build();
}
