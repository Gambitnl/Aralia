/**
 * @file footprint.golden.test.ts — draw-order golden for genFootprint (A8).
 *
 * Locks the CONCRETE footprint output (cols, rows, occupancy raster) for a
 * grid of fixed (seed, type) pairs. genFootprint's RNG draw count is
 * data-dependent (tower roll only for manors; variable wing counts in the
 * bare-rectangle repair loop), so any refactor that reorders or adds/removes
 * a draw silently rerolls every building in every world. This golden makes
 * that failure LOUD instead of silent.
 *
 * If this test fails after an intentional change to the footprint draw order,
 * that is a world-breaking change: existing worlds regenerate with different
 * buildings. Only update the snapshot if that is the explicit intent.
 */
import { describe, it, expect } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { genFootprint } from '../footprint';
import type { BuildingType } from '../blueprintTypes';

const SEEDS = [1, 42, 12345] as const;
const TYPES: BuildingType[] = ['cottage', 'shop', 'workshop', 'tavern', 'manor'];

/** Compact, human-diffable raster: one string per row, '#' occupied. */
function raster(seed: number, type: BuildingType): string[] {
  const fp = genFootprint(rootSeedPath(seed), type);
  const rows = fp.occ.map((row) => row.map((c) => (c ? '#' : '.')).join(''));
  return [`${fp.cols}x${fp.rows}`, ...rows];
}

describe('genFootprint draw-order golden', () => {
  for (const type of TYPES) {
    for (const seed of SEEDS) {
      it(`pins ${type} @ seed ${seed}`, () => {
        expect(raster(seed, type)).toMatchSnapshot();
      });
    }
  }

  it('cells list matches the occ raster exactly (self-consistency)', () => {
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const fp = genFootprint(rootSeedPath(seed), type);
        const fromOcc: string[] = [];
        for (let y = 0; y < fp.rows; y++) {
          for (let x = 0; x < fp.cols; x++) {
            if (fp.occ[y][x]) fromOcc.push(`${x},${y}`);
          }
        }
        expect(fp.cells.map((c) => `${c.cx},${c.cy}`)).toEqual(fromOcc);
      }
    }
  });
});
