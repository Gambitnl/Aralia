/**
 * @file townPropGeometry.test.ts — determinism + sanity for the owned TOWN
 * prop generators (beautification wave, owned-generators slice): gravestones,
 * posts, monuments, smithy furniture, scarecrow, brazier.
 */
import { describe, it, expect } from 'vitest';
import type * as THREE from 'three';
import { createGravestoneGeometry, type GravestoneKind } from '../gravestoneGeometry';
import { createPostGeometry, type PostKind } from '../postGeometry';
import { createStatueGeometry, type MonumentKind } from '../statueGeometry';
import { createAnvilGeometry, type SmithyKind } from '../anvilGeometry';
import { createScarecrowGeometry } from '../scarecrowGeometry';
import { createBrazierGeometry } from '../brazierGeometry';

function positions(geo: THREE.BufferGeometry): Float32Array {
  return new Float32Array(geo.getAttribute('position').array as Float32Array);
}

/** All generator entry points, flattened to (label, factory) pairs. */
const CASES: Array<[string, (seed: number) => THREE.BufferGeometry]> = [
  ...(['headstone', 'tomb', 'cross'] as GravestoneKind[]).map(
    (k): [string, (s: number) => THREE.BufferGeometry] => [`gravestone:${k}`, (s) => createGravestoneGeometry(s, k)],
  ),
  ...(['lantern', 'sign', 'fingerpost'] as PostKind[]).map(
    (k): [string, (s: number) => THREE.BufferGeometry] => [`post:${k}`, (s) => createPostGeometry(s, k)],
  ),
  ...(['statue', 'milestone', 'shrine'] as MonumentKind[]).map(
    (k): [string, (s: number) => THREE.BufferGeometry] => [`monument:${k}`, (s) => createStatueGeometry(s, k)],
  ),
  ...(['anvil', 'grindstone'] as SmithyKind[]).map(
    (k): [string, (s: number) => THREE.BufferGeometry] => [`smithy:${k}`, (s) => createAnvilGeometry(s, k)],
  ),
  ['scarecrow', (s) => createScarecrowGeometry(s)],
  ['brazier', (s) => createBrazierGeometry(s)],
];

describe('owned town prop generators', () => {
  for (const [label, make] of CASES) {
    describe(label, () => {
      it('same seed → byte-identical position buffer', () => {
        expect(positions(make(1234))).toEqual(positions(make(1234)));
      });

      it('has position, color and normal attributes, all finite', () => {
        for (const seed of [3, 4, 5]) {
          const geo = make(seed);
          const pos = geo.getAttribute('position').array as Float32Array;
          const col = geo.getAttribute('color').array as Float32Array;
          const nrm = geo.getAttribute('normal').array as Float32Array;
          expect(pos.length).toBeGreaterThan(0);
          expect(col.length).toBe(pos.length);
          expect(nrm.length).toBe(pos.length);
          for (let i = 0; i < pos.length; i++) expect(Number.isFinite(pos[i])).toBe(true);
          for (let i = 0; i < nrm.length; i++) expect(Number.isFinite(nrm[i])).toBe(true);
          for (let i = 0; i < col.length; i++) {
            expect(col[i]).toBeGreaterThanOrEqual(0);
            expect(col[i]).toBeLessThanOrEqual(1);
          }
        }
      });

      it('is ground-origin and walking-scale (base near y=0, height 0.3–4 m, radius < 4 m)', () => {
        for (const seed of [7, 8, 9]) {
          const pos = make(seed).getAttribute('position').array as Float32Array;
          let minY = Infinity, maxY = -Infinity, maxR = 0;
          for (let i = 0; i < pos.length; i += 3) {
            minY = Math.min(minY, pos[i + 1]);
            maxY = Math.max(maxY, pos[i + 1]);
            maxR = Math.max(maxR, Math.hypot(pos[i], pos[i + 2]));
          }
          expect(minY).toBeGreaterThan(-0.3); // nothing buried deep
          expect(minY).toBeLessThan(0.15); // actually touches the ground
          expect(maxY).toBeGreaterThan(0.3);
          expect(maxY).toBeLessThan(4);
          expect(maxR).toBeLessThan(4);
        }
      });

      it('different seeds → different shapes across a seed sweep', () => {
        // Some seeds share the same variant branch; assert that at least two
        // of five seeds differ (buffer bytes or lengths).
        const bufs = [11, 12, 13, 14, 15].map((s) => positions(make(s)));
        const anyDiff = bufs.some((b) => b.length !== bufs[0].length || b.some((v, i) => v !== bufs[0][i]));
        expect(anyDiff).toBe(true);
      });
    });
  }
});
