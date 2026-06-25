/**
 * Proves the schedule→space bridge: occupants are placed at the centroid of the
 * plot the schedule assigns them, activities match the schedule, and a worker
 * physically moves between home and work plots across the day.
 */
import { describe, it, expect } from 'vitest';
import { townSnapshotAt, activityTallyAt } from '../townSnapshot';
import { occupantLocationAt } from '../occupantSchedule';
import type { TownPlan } from '../../artifacts';
import type { TownRoster } from '../types';

// Minimal plan: a home plot (id 10) at the origin, a work plot (id 20) far east.
const plan = {
  burgId: 1,
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
