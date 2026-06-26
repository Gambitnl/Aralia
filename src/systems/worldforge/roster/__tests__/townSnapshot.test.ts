/**
 * Proves the schedule→space bridge: occupants are placed at the centroid of the
 * plot the schedule assigns them, activities match the schedule, and a worker
 * physically moves between home and work plots across the day.
 */
import { describe, it, expect } from 'vitest';
import { townSnapshotAt, activityTallyAt, townMotionSnapshotAt } from '../townSnapshot';
import { occupantLocationAt } from '../occupantSchedule';
import { buildStreetGraph } from '../agentPath';
import type { TownPlan } from '../../artifacts';
import type { TownRoster } from '../types';

// Minimal plan: a home plot (id 10) at the origin, a work plot (id 20) far east.
const plan = {
  burgId: 1,
  streets: [],
  plots: [
    { id: 10, role: 'house', footprint: [[0, 0], [10, 0], [10, 10], [0, 10]] },
    { id: 20, role: 'market', footprint: [[100, 0], [110, 0], [110, 10], [100, 10]] },
  ],
} as unknown as TownPlan;

const roster: TownRoster = {
  burgId: 1,
  occupants: [
    { id: 1, name: 'Aldric', ageBand: 'adult', homePlotId: 10, workPlotId: 20, occupation: 'shopkeeper' },
    { id: 2, name: 'Bess', ageBand: 'child', homePlotId: 10, occupation: 'resident' },
  ],
};

describe('townSnapshotAt', () => {
  it('places each occupant at the centroid of their scheduled plot', () => {
    const snap = townSnapshotAt(plan, roster, 12);
    const aldric = snap.find((a) => a.occupantId === 1)!;
    // At noon the worker is at the market plot (centroid 105,5).
    expect(occupantLocationAt(roster.occupants[0], 12).activity).toBe('working');
    expect(aldric.plotId).toBe(20);
    expect(aldric.x).toBeCloseTo(105);
    expect(aldric.y).toBeCloseTo(5);
  });

  it('keeps a worker home at night (home-plot centroid)', () => {
    const aldric = townSnapshotAt(plan, roster, 3).find((a) => a.occupantId === 1)!;
    expect(aldric.activity).toBe('sleeping');
    expect(aldric.plotId).toBe(10);
    expect(aldric.x).toBeCloseTo(5);
    expect(aldric.y).toBeCloseTo(5);
  });

  it('moves the worker physically between home and work across the day', () => {
    const night = townSnapshotAt(plan, roster, 3).find((a) => a.occupantId === 1)!;
    const noon = townSnapshotAt(plan, roster, 12).find((a) => a.occupantId === 1)!;
    expect(Math.hypot(noon.x - night.x, noon.y - night.y)).toBeGreaterThan(50); // commuted east
  });

  it('skips occupants whose scheduled plot is absent from the plan', () => {
    const orphan: TownRoster = {
      burgId: 1,
      occupants: [{ id: 9, name: 'Ghost', ageBand: 'adult', homePlotId: 999, occupation: 'resident' }],
    };
    expect(townSnapshotAt(plan, orphan, 12)).toHaveLength(0);
  });

  it('is deterministic for the same hour', () => {
    expect(townSnapshotAt(plan, roster, 9)).toEqual(townSnapshotAt(plan, roster, 9));
  });
});

describe('townSnapshotAt — population conservation across the day', () => {
  // Build a larger town: several homes + workplaces, a mix of workers and
  // home-only residents. The sim-LOD invariant is that NO agent blinks out of
  // existence at any hour — every occupant referencing real plots is placed at
  // every hour 0–23, deterministically, inside the plan's coordinate bounds.
  const bigPlan = {
    burgId: 9,
    plots: Array.from({ length: 8 }, (_, i) => ({
      id: 100 + i,
      role: i % 2 === 0 ? 'house' : 'market',
      footprint: [
        [i * 20, 0], [i * 20 + 10, 0], [i * 20 + 10, 10], [i * 20, 10],
      ],
    })),
  } as unknown as TownPlan;
  const homeIds = [100, 102, 104, 106];
  const workIds = [101, 103, 105, 107];
  const bigRoster: TownRoster = {
    burgId: 9,
    occupants: Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: `Sim${i}`,
      ageBand: i % 3 === 0 ? 'child' : 'adult',
      homePlotId: homeIds[i % homeIds.length],
      // Two-thirds are workers (have a workplace); the rest are home-only.
      workPlotId: i % 3 === 0 ? undefined : workIds[i % workIds.length],
      occupation: i % 3 === 0 ? 'resident' : 'shopkeeper',
    })),
  } as TownRoster;

  const maxX = 8 * 20 + 10;

  it('places every occupant at every hour, in-bounds, with no duplicates', () => {
    for (let hour = 0; hour < 24; hour++) {
      const snap = townSnapshotAt(bigPlan, bigRoster, hour);
      // Conservation: nobody vanishes (all plots referenced exist in the plan).
      expect(snap).toHaveLength(bigRoster.occupants.length);
      const ids = new Set(snap.map((a) => a.occupantId));
      expect(ids.size).toBe(bigRoster.occupants.length); // no duplicate placement
      for (const a of snap) {
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.x).toBeLessThanOrEqual(maxX);
        expect(a.y).toBeGreaterThanOrEqual(0);
        expect(a.y).toBeLessThanOrEqual(10);
      }
    }
  });

  it('is deterministic for every hour of the day', () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(townSnapshotAt(bigPlan, bigRoster, hour)).toEqual(
        townSnapshotAt(bigPlan, bigRoster, hour),
      );
    }
  });

  it('tally sums to the full placed population at every hour', () => {
    for (let hour = 0; hour < 24; hour++) {
      const tally = activityTallyAt(bigPlan, bigRoster, hour);
      const total = tally.sleeping + tally.home + tally.working + tally.out;
      expect(total).toBe(bigRoster.occupants.length);
    }
  });
});

describe('townMotionSnapshotAt — street movement between plots', () => {
  const graph = buildStreetGraph(plan);
  const aldric = roster.occupants[0]; // worker: home 10 (x≈5), work 20 (x≈105)
  const homeX = 5;
  const workX = 105;

  // Find an hour where Aldric's scheduled plot flips (a commute).
  const transitionHour = (() => {
    for (let h = 0; h < 24; h++) {
      if (occupantLocationAt(aldric, h - 1).plotId !== occupantLocationAt(aldric, h).plotId) return h;
    }
    throw new Error('no transition found');
  })();

  it('places agents mid-route (between plots) early in a commute hour', () => {
    const mid = townMotionSnapshotAt(plan, graph, roster, transitionHour + 0.25).find((a) => a.occupantId === aldric.id)!;
    expect(mid.moving).toBe(true);
    // Strictly between the two plot centroids (walking the straight fallback route).
    expect(mid.x).toBeGreaterThan(Math.min(homeX, workX));
    expect(mid.x).toBeLessThan(Math.max(homeX, workX));
  });

  it('settles at the destination centroid once the commute window passes', () => {
    const settled = townMotionSnapshotAt(plan, graph, roster, transitionHour + 0.75).find((a) => a.occupantId === aldric.id)!;
    expect(settled.moving).toBe(false);
    const dest = occupantLocationAt(aldric, transitionHour).plotId === 20 ? workX : homeX;
    expect(settled.x).toBeCloseTo(dest);
  });

  it('is stationary at a non-transition hour', () => {
    // Deep night: everyone asleep at home, no plot change → not moving.
    const night = townMotionSnapshotAt(plan, graph, roster, 3.25);
    expect(night.every((a) => !a.moving)).toBe(true);
  });

  it('conserves population and is deterministic at a fractional clock', () => {
    const a = townMotionSnapshotAt(plan, graph, roster, transitionHour + 0.25);
    const b = townMotionSnapshotAt(plan, graph, roster, transitionHour + 0.25);
    expect(a).toEqual(b);
    expect(a).toHaveLength(roster.occupants.length);
  });

  it('every agent stays finite and in-bounds across a fine clock sweep (moving + settled)', () => {
    // The settled in-bounds test only covers integer hours; moving agents are
    // placed at INTERPOLATED street positions on fractional clocks. Sweep the
    // whole day finely and assert no NaN/Infinity and every position sits within
    // the plan footprint (a degenerate route or bad interpolation would escape).
    const xs = plan.plots.flatMap((p) => p.footprint.map((c) => c[0]));
    const ys = plan.plots.flatMap((p) => p.footprint.map((c) => c[1]));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    for (let clock = 0; clock < 24; clock += 0.05) {
      const snap = townMotionSnapshotAt(plan, graph, roster, clock);
      expect(snap).toHaveLength(roster.occupants.length); // nobody vanishes mid-walk
      for (const a of snap) {
        expect(Number.isFinite(a.x) && Number.isFinite(a.y), `clock ${clock.toFixed(2)} ${a.name}: finite`).toBe(true);
        expect(a.x).toBeGreaterThanOrEqual(minX);
        expect(a.x).toBeLessThanOrEqual(maxX);
        expect(a.y).toBeGreaterThanOrEqual(minY);
        expect(a.y).toBeLessThanOrEqual(maxY);
      }
    }
  });
});

describe('activityTallyAt', () => {
  it('tallies activities and sums to the placed population', () => {
    const tally = activityTallyAt(plan, roster, 12);
    const total = tally.sleeping + tally.home + tally.working + tally.out;
    expect(total).toBe(townSnapshotAt(plan, roster, 12).length);
  });

  it('has everyone sleeping in the dead of night', () => {
    const tally = activityTallyAt(plan, roster, 3);
    expect(tally.sleeping).toBe(2);
    expect(tally.working).toBe(0);
  });
});
