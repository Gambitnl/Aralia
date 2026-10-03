import { describe, expect, it } from 'vitest';
import { buildRiverReach, courseKeyAt, designLevelAt, RIVER_ISLAND } from '../riverReach';

describe('riverReach: the judged reach', () => {
  const reach = buildRiverReach();

  it('is a pure function of the seed', () => {
    const again = buildRiverReach();
    let diff = 0;
    for (let c = 0; c < reach.bed.length; c += 997) diff = Math.max(diff, Math.abs(reach.bed[c] - again.bed[c]));
    expect(diff).toBe(0);
    expect(again.boulders.length).toBe(reach.boulders.length);
  });

  it('has no cliff in its ground (the first cut jumped 10 m across one cell between the S-bend\'s arms)', () => {
    const { nx, nz } = reach.grid;
    let worst = 0;
    for (let j = 0; j < nz - 1; j += 1) {
      for (let i = 0; i < nx - 1; i += 1) {
        const c = j * nx + i;
        worst = Math.max(worst, Math.abs(reach.ground[c + 1] - reach.ground[c]), Math.abs(reach.ground[c + nx] - reach.ground[c]));
      }
    }
    // The steepest ground stays under 0.9 m per 0.5 m cell: the cut bank on
    // the outside of the pool entrance (with the ragged edge of round 2) is
    // the steepest, about 60 degrees; a real cut bank stands that steep.
    expect(worst).toBeLessThan(0.9);
  });

  it('carves a channel under its bank tops along the whole course', () => {
    for (let s = 0; s <= 260; s += 10) {
      const p = reach.course.at(s);
      const i = Math.floor((p.x - reach.grid.x0) / reach.grid.dx);
      const j = Math.floor((p.z - reach.grid.z0) / reach.grid.dx);
      const key = courseKeyAt(s);
      const inIsland = Math.abs(s - RIVER_ISLAND.s) < RIVER_ISLAND.halfLen;
      if (!inIsland) expect(reach.ground[j * reach.grid.nx + i]).toBeLessThan(key.bankTop);
    }
  });

  it('never lets the design level rise downstream', () => {
    let prev = Infinity;
    for (let s = -100; s <= 420; s += 1) {
      const l = designLevelAt(s);
      expect(l).toBeLessThanOrEqual(prev + 1e-9);
      prev = l;
    }
  });
});
