/**
 * @file townRoadCourse.test.ts — a world road keeps to a bank of the town's
 * river, and the town and the region draw it as one line (GG-582).
 *
 * Borieborum (burg 702, world 903674813) is the town Remy flagged: its south-
 * west approach ran down the middle of its river for 1,083 ft.
 */
import { describe, it, expect } from 'vitest';
import { getBridgeAtlas, getWorldforgeLocalForCell } from '../../bridge/legacySubmapBridge';
import { getCanonicalTownPlan, townSpanFtForBurg } from '../canonicalTown';
import { townRiverCourseCanon } from '../townRiverCourse';
import { CANON_TOWN_SPAN } from '../townScale';
import { pointInPolygon, type Pt } from '../../submap/submapEngine';
import { FEET_PER_FMG_PIXEL } from '../../adapter/atlasArtifact';

const SEED = 903674813;
const BURG = 702;

const segD = (p: Pt, a: Pt, b: Pt): number => {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy);
};
const lineD = (p: Pt, L: readonly Pt[]): number => {
  let m = Infinity;
  for (let i = 0; i < L.length - 1; i++) m = Math.min(m, segD(p, L[i], L[i + 1]));
  return m;
};

describe('town approach roads keep to a bank (GG-582)', () => {
  it('lay no approach road in the river outside a bridge, and end every one at a gate', () => {
    const atlas = getBridgeAtlas(SEED);
    const plan = getCanonicalTownPlan(atlas, SEED, BURG);
    const river = townRiverCourseCanon(atlas, SEED, BURG);
    const half = river.widthCanon / 2;
    expect(half).toBeGreaterThan(0);
    const decks = plan.civic.filter((c) => c.kind === 'bridge').map((c) => c.polygon);
    const approaches = plan.streetNetwork.filter((s) => s.role === 'approach' && !s.track);
    expect(approaches.length).toBeGreaterThan(0);
    let wet = 0;
    for (const s of approaches) {
      const L = s.centerline;
      for (let i = 0; i < L.length - 1; i++) {
        const n = Math.max(1, Math.ceil(Math.hypot(L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]) / (half / 4)));
        for (let k = 0; k < n; k++) {
          const p: Pt = [L[i][0] + ((L[i + 1][0] - L[i][0]) * (k + 0.5)) / n, L[i][1] + ((L[i + 1][1] - L[i][1]) * (k + 0.5)) / n];
          if (river.lines.some((r) => lineD(p, r) < half) && !decks.some((d) => pointInPolygon(p, d))) wet++;
        }
      }
      // The end on the wall is a gate.
      const atGate = [L[0], L[L.length - 1]].some((e) => plan.walls.gatehouses.some((g) => Math.hypot(g[0] - e[0], g[1] - e[1]) < 1e-6));
      expect(atGate).toBe(true);
    }
    // Before GG-582 the south-west approach had 1,083 ft in the water.
    expect(wet).toBe(0);
  });

  it('meets the region road at the town edge: one road in both tiers', () => {
    const atlas = getBridgeAtlas(SEED);
    const burg = (atlas.pack.burgs as Array<{ x: number; y: number; cell: number }>)[BURG];
    const { region } = getWorldforgeLocalForCell(SEED, burg.cell, { centerPx: [burg.x, burg.y] });
    const plan = getCanonicalTownPlan(atlas, SEED, BURG);
    const k = CANON_TOWN_SPAN / townSpanFtForBurg(atlas, BURG);
    const cx = burg.x * FEET_PER_FMG_PIXEL;
    const cy = burg.y * FEET_PER_FMG_PIXEL;
    const edge = CANON_TOWN_SPAN / 2;
    const ends = plan.streetNetwork
      .filter((s) => s.role === 'approach' && !s.track)
      .flatMap((s) => [s.centerline[0], s.centerline[s.centerline.length - 1]])
      .filter((p) => Math.abs(Math.abs(p[0]) - edge) < 1e-6 || Math.abs(Math.abs(p[1]) - edge) < 1e-6);
    expect(ends.length).toBeGreaterThan(0);
    for (const [nx, ny] of ends) {
      const w: Pt = [nx / k + cx, ny / k + cy];
      const off = Math.min(...region.roads.map((r) => lineD(w, r.centerline as Pt[])));
      expect(off).toBeLessThan(1);
    }
  }, 120000);
});
