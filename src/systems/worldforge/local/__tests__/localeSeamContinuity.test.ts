/**
 * @file localeSeamContinuity.test.ts — the SEAM proof (Stage 5 S5.2), end-to-end.
 *
 * The streaming unit for seamless walking is the 3000ft Locale WINDOW (a Voronoi
 * cell is far larger). So the real continuity claim is: two ADJACENT Locale
 * windows, generated independently, must agree on their overlap — otherwise the
 * player sees a cliff where one window's ground meets the next.
 *
 * We offset the second window by exactly 1500ft = 300 cells, so the two windows'
 * 5ft cell grids ALIGN: window-A cell (300+k) and window-B cell (k) are the SAME
 * world position. With terrain a pure function of world position (S5.2: macro from
 * the shared region heightfield by world feet + detail from the global world-feet
 * lattice), those cells must carry the SAME elevation — a true seam, by
 * construction. This FAILS under the old per-window detail noise and PASSES now.
 */
import { describe, it, expect } from 'vitest';
import { generateFmgAtlas } from '../../fmg/generateAtlas';
import { generateRegion } from '../../region/generateRegion';
import { generateLocal } from '../generateLocal';
import { rootSeedPath } from '../../seedPath';
import { boundsCenter } from '../../units';

const SEED = 'world-42';
const WORLD_SEED = 42;
const FMG_OPTS = { width: 960, height: 540, cellsDesired: 10000, template: 'continents' as const };
const ANCHOR_CELL = 110;
const FEET_PER_PIXEL = 1000;
const OFFSET_FT = 1500; // half a 3000ft window = 300 cells (grids stay aligned)

describe('Locale seam continuity across adjacent windows (Stage 5 S5.2 end-to-end)', () => {
  it('two windows offset 1500ft agree EXACTLY on their overlapping cells', () => {
    const atlas = generateFmgAtlas(SEED, FMG_OPTS);
    const region = generateRegion(atlas, ANCHOR_CELL, rootSeedPath(WORLD_SEED), { feetPerPixel: FEET_PER_PIXEL });
    const center = boundsCenter(region.bounds);

    const a = generateLocal(region, center, region.seedPath, { biomeId: 6 });
    const b = generateLocal(region, { x: center.x + OFFSET_FT, y: center.y }, region.seedPath, { biomeId: 6 });

    const w = a.terrain.widthCells; // 600
    const shift = OFFSET_FT / 5; // 300 cells — A cell (shift+k) == B cell (k) in world space
    const aEl = a.terrain.elevationFt;
    const bEl = b.terrain.elevationFt;

    let compared = 0;
    let maxDelta = 0;
    for (let y = 0; y < a.terrain.heightCells; y += 7) {
      for (let k = 0; k < w - shift; k += 11) {
        const av = aEl[y * w + (shift + k)];
        const bv = bEl[y * w + k];
        maxDelta = Math.max(maxDelta, Math.abs(av - bv));
        compared++;
      }
    }

    expect(compared).toBeGreaterThan(100); // we actually sampled the overlap
    expect(maxDelta).toBe(0); // EXACT seam — same world position ⇒ same elevation
  });
});
