/**
 * @file statueGeometry.ts — owned, seeded monument geometry: statue / plinth,
 * milestone / waymarker, wayside shrine.
 *
 * Replaces the boulder reuse for `statue`, `milestone` and `wayside-shrine`
 * (beautification wave, owned-generators slice).
 *  - statue: stepped plinth + abstract weathered figure (torso, head, one
 *    raised arm) — reads "worn saint" at walking distance without needing a
 *    sculpt.
 *  - milestone: short rounded-top stone stump, slightly sunk and leaning.
 *  - shrine: small stone niche box on a post, tiny gable, offering ledge.
 *
 * Unit frame: ground contact at y = 0. Deterministic from the seed.
 */
import * as THREE from 'three';
import { makeRng } from './proceduralNoise';
import { PartBuilder, P } from './partBuilder';

export type MonumentKind = 'statue' | 'milestone' | 'shrine';

export function createStatueGeometry(seed: number, kind: MonumentKind = 'statue'): THREE.BufferGeometry {
  const rng = makeRng(seed ^ 0x57a70);
  const b = new PartBuilder();
  const stone = rng() < 0.5 ? P.STONE : P.STONE_PALE;

  if (kind === 'statue') {
    const figure = rng() < 0.35 ? P.BRONZE : stone;
    // plinth: two steps + pedestal
    b.addBox(1.3, 0.2, 1.3, P.STONE_DARK, [0, 0.1, 0]);
    b.addBox(0.9, 0.7, 0.9, stone, [0, 0.55, 0]);
    b.addBox(1.0, 0.12, 1.0, P.STONE_DARK, [0, 0.96, 0]);
    // figure: legs block, torso, head, arms
    const fh = 1.15 + rng() * 0.25; // torso-block height
    const twist = (rng() - 0.5) * 0.5;
    b.addBox(0.42, fh * 0.5, 0.3, figure, [0, 1.02 + fh * 0.25, 0], [0, twist, 0]); // robe/legs
    b.addBox(0.5, fh * 0.5, 0.34, figure, [0, 1.02 + fh * 0.72, 0], [0, twist, 0.04]); // torso
    b.addSphere(0.16, figure, [0.02, 1.12 + fh * 1.05, 0], 6, 5); // head
    // one raised arm, one lowered — silhouette asymmetry
    const raise = 0.7 + rng() * 0.5;
    b.addBox(0.11, 0.62, 0.11, figure, [0.32, 1.02 + fh * 0.92, 0.05], [0.15, twist, -raise]);
    b.addBox(0.11, 0.5, 0.11, figure, [-0.28, 1.02 + fh * 0.62, 0], [0, twist, 0.35]);
  } else if (kind === 'milestone') {
    const h = 0.7 + rng() * 0.3;
    const tilt = (rng() - 0.5) * 0.18;
    b.addBox(0.34, h, 0.26, stone, [0, h / 2 - 0.04, 0], [tilt * 0.4, rng() * Math.PI, tilt]);
    // rounded cap
    const cap = new THREE.CylinderGeometry(0.17, 0.17, 0.26, 7);
    b.add(cap, stone, [Math.sin(tilt) * h * 0.5, h - 0.06, 0], [Math.PI / 2, 0, tilt]);
  } else {
    // shrine: stone post + niche box with gable roof + ledge
    const h = 1.1 + rng() * 0.3;
    b.addBox(0.5, 0.14, 0.5, P.STONE_DARK, [0, 0.07, 0]);
    b.addBox(0.24, h, 0.24, stone, [0, 0.14 + h / 2, 0]);
    const ny = 0.14 + h + 0.24; // niche center
    b.addBox(0.56, 0.5, 0.4, stone, [0, ny, 0]); // niche body
    b.addBox(0.4, 0.36, 0.1, '#3a3630', [0, ny, 0.17]); // dark opening
    b.addBox(0.14, 0.22, 0.06, P.GLOW, [0, ny - 0.05, 0.18]); // candle glow
    b.addBox(0.62, 0.1, 0.5, P.STONE_DARK, [0, ny - 0.3, 0.05]); // offering ledge
    // gable roof: two pitched slabs
    b.addBox(0.42, 0.06, 0.52, P.STONE_DARK, [-0.16, ny + 0.36, 0], [0, 0, 0.7]);
    b.addBox(0.42, 0.06, 0.52, P.STONE_DARK, [0.16, ny + 0.36, 0], [0, 0, -0.7]);
  }
  return b.build();
}
