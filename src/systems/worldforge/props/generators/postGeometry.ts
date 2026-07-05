/**
 * @file postGeometry.ts — owned, seeded post-mounted street furniture.
 *
 * Replaces the absurd barrel reuse for `lantern-post` / `tavern-sign` and the
 * boulder reuse for `fingerpost` (beautification wave, owned-generators
 * slice). Three kinds sharing one tilted-wooden-post skeleton:
 *  - lantern: post + short arm + hanging lantern box with a warm glow pane.
 *  - sign: post + arm + hanging swing sign board.
 *  - fingerpost: post with 1–2 pointing finger boards at different headings.
 *
 * Unit frame: ground contact at y = 0. Deterministic from the seed.
 */
import * as THREE from 'three';
import { makeRng } from './proceduralNoise';
import { PartBuilder, P } from './partBuilder';

export type PostKind = 'lantern' | 'sign' | 'fingerpost';

export function createPostGeometry(seed: number, kind: PostKind = 'lantern'): THREE.BufferGeometry {
  const rng = makeRng(seed ^ 0x705f5);
  const b = new PartBuilder();

  const h = kind === 'fingerpost' ? 2.0 + rng() * 0.4 : 2.5 + rng() * 0.4;
  const lean = (rng() - 0.5) * 0.06;
  const postCol = rng() < 0.5 ? P.WOOD_DARK : P.WOOD;

  // Post + small base collar so the ground join reads deliberate.
  b.addCylinder(0.055, 0.075, h, 6, postCol, [0, h / 2, 0], [0, 0, lean]);
  b.addCylinder(0.11, 0.13, 0.14, 6, P.STONE_DARK, [0, 0.07, 0]);

  if (kind === 'lantern') {
    const armY = h - 0.12;
    b.addBox(0.7, 0.06, 0.06, postCol, [0.3, armY, 0]); // arm
    b.addBox(0.06, 0.25, 0.06, postCol, [0.52, armY - 0.1, 0], [0, 0, 0.5]); // brace
    // hanging lantern: iron cage + glow core
    const ly = armY - 0.34;
    b.addBox(0.02, 0.18, 0.02, P.IRON, [0.58, armY - 0.12, 0]); // hanger
    b.addBox(0.2, 0.26, 0.2, P.IRON, [0.58, ly, 0]); // cage
    b.addBox(0.15, 0.2, 0.15, P.GLOW, [0.58, ly, 0]); // glow pane (pokes through)
    b.addCylinder(0.03, 0.11, 0.09, 4, P.IRON, [0.58, ly + 0.17, 0]); // little roof
  } else if (kind === 'sign') {
    const armY = h - 0.1;
    b.addBox(0.95, 0.07, 0.07, postCol, [0.42, armY, 0]);
    b.addBox(0.07, 0.34, 0.07, postCol, [0.62, armY - 0.14, 0], [0, 0, 0.45]);
    // swinging sign board, slightly rotated as if caught mid-sway
    const sway = (rng() - 0.5) * 0.2;
    const board = rng() < 0.5 ? P.WOOD_PALE : P.CANVAS;
    b.addBox(0.02, 0.14, 0.02, P.IRON, [0.72, armY - 0.1, 0]);
    b.addBox(0.62, 0.44, 0.05, board, [0.72, armY - 0.42, 0], [sway * 0.3, 0, sway]);
    b.addBox(0.66, 0.06, 0.07, P.WOOD_DARK, [0.72, armY - 0.18, 0], [0, 0, sway]); // top rail
  } else {
    // fingerpost: 1–2 direction boards at different heights/headings
    const fingers = 1 + (rng() < 0.6 ? 1 : 0);
    for (let i = 0; i < fingers; i++) {
      const fy = h - 0.25 - i * 0.3;
      const heading = rng() * Math.PI * 2;
      const board = new THREE.BoxGeometry(0.85, 0.16, 0.05);
      // arrow tip: taper one end with a small rotated box
      b.add(board, P.WOOD_PALE, [Math.cos(heading) * 0.35, fy, -Math.sin(heading) * 0.35], [0, heading, 0]);
      b.addBox(0.16, 0.16, 0.05, P.WOOD_PALE,
        [Math.cos(heading) * 0.78, fy, -Math.sin(heading) * 0.78], [0, heading + Math.PI / 4, 0]);
    }
  }
  return b.build();
}
