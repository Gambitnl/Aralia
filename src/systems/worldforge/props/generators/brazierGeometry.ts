/**
 * @file brazierGeometry.ts — owned, seeded brazier / candle-stand geometry.
 *
 * Replaces the boulder reuse for `brazier` (beautification wave,
 * owned-generators slice): an iron bowl on three splayed legs with a ring of
 * ember-colored coals cresting the rim — the warm top is the read at night
 * gate posts and graveyard shrines. Some seeds are the taller candle-stand
 * form (narrow column + wide drip pan + candle glow).
 *
 * Unit frame: ground contact at y = 0. Deterministic from the seed.
 */
import * as THREE from 'three';
import { makeRng } from './proceduralNoise';
import { PartBuilder, P } from './partBuilder';

export function createBrazierGeometry(seed: number): THREE.BufferGeometry {
  const rng = makeRng(seed ^ 0xb4a21);
  const b = new PartBuilder();
  const tall = rng() < 0.35; // candle-stand form

  if (!tall) {
    const bowlY = 0.72 + rng() * 0.15;
    const bowlR = 0.4 + rng() * 0.08;
    // three splayed legs
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rng() * 0.15;
      b.addBox(0.05, bowlY * 1.1, 0.05, P.IRON,
        [Math.cos(a) * bowlR * 0.55, bowlY * 0.5, Math.sin(a) * bowlR * 0.55],
        [Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32]);
    }
    // bowl: flared cylinder + inner dark liner + coal mound
    b.addCylinder(bowlR, bowlR * 0.55, 0.3, 9, P.IRON, [0, bowlY, 0]);
    b.addCylinder(bowlR * 0.86, bowlR * 0.5, 0.26, 9, '#2b2b2b', [0, bowlY + 0.04, 0]);
    b.addSphere(bowlR * 0.72, P.EMBER, [0, bowlY + 0.14, 0], 7, 5, [1, 0.45, 1]); // coals
    b.addSphere(bowlR * 0.4, P.GLOW, [0, bowlY + 0.2, 0], 6, 4, [1, 0.6, 1]); // hot core
  } else {
    const h = 1.25 + rng() * 0.25;
    b.addCylinder(0.16, 0.2, 0.08, 7, P.IRON, [0, 0.04, 0]); // foot
    b.addCylinder(0.035, 0.05, h, 6, P.IRON, [0, h / 2, 0]); // column
    b.addCylinder(0.2, 0.16, 0.05, 8, P.IRON, [0, h, 0]); // drip pan
    // candles: 1–3 stubs with glow tips
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const r = i === 0 ? 0 : 0.1;
      const ch = 0.1 + rng() * 0.12;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      b.addCylinder(0.03, 0.03, ch, 5, P.CANVAS, [cx, h + ch / 2, cz]);
      b.addSphere(0.035, P.GLOW, [cx, h + ch + 0.03, cz], 5, 4);
    }
  }
  return b.build();
}
