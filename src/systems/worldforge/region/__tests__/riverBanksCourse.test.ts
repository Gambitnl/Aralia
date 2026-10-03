import { describe, it, expect } from 'vitest';
import { getBridgeAtlas, getWorldforgeLocalForCell } from '../../bridge/legacySubmapBridge';

const SEED = 903674813;
const CELL = 2186;
const BURG = 5;

describe('region river banks carry a real course', () => {
  it('gives Epicea a dense river instead of a two-point chord', () => {
    const atlas = getBridgeAtlas(SEED);
    const burg = (atlas.pack.burgs as Array<{ x: number; y: number }>)[BURG];
    const { region } = getWorldforgeLocalForCell(SEED, CELL, { centerPx: [burg.x, burg.y] });

    const river = region.rivers.find((r) => r.riverId === 5);
    expect(river).toBeDefined();

    // Was 2 points across 25,537 ft. The heightfield samples every 100 ft, so
    // the river should be resolved at a comparable scale.
    expect(river!.centerline.length).toBeGreaterThan(20);
    let total = 0;
    for (let i = 0; i < river!.centerline.length - 1; i++) {
      total += Math.hypot(
        river!.centerline[i + 1][0] - river!.centerline[i][0],
        river!.centerline[i + 1][1] - river!.centerline[i][1],
      );
    }
    const perSegment = total / (river!.centerline.length - 1);
    expect(perSegment).toBeLessThan(1000);
  }, 120000);

  it('runs the river through the burg whose cell carries it', () => {
    const atlas = getBridgeAtlas(SEED);
    const burg = (atlas.pack.burgs as Array<{ x: number; y: number }>)[BURG];
    const { region } = getWorldforgeLocalForCell(SEED, CELL, { centerPx: [burg.x, burg.y] });
    const site = region.townSites.find((t) => t.burgId === BURG)!;
    const cx = site.envelope.x + site.envelope.width / 2;
    const cy = site.envelope.y + site.envelope.height / 2;

    const river = region.rivers.find((r) => r.riverId === 5)!;
    const nearest = Math.min(
      ...river.centerline.map(([x, y]) => Math.hypot(x - cx, y - cy)),
    );
    // The chord passed 4,045 ft away; the town is 2,936 ft across. The course
    // must now actually reach the settlement.
    expect(nearest).toBeLessThan(site.envelope.width / 2);
  }, 120000);
});
