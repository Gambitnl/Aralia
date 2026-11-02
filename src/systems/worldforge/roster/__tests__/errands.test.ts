/**
 * Proves the errand layer (NPC life, 2026-11-02): an OUT person walks the
 * streets to a public place near home, waits there in a small group in front
 * of its door, and walks home; the room gate waits for that walk.
 */
import { describe, it, expect } from 'vitest';
import { errandPlotFor } from '../errands';
import {
  townMotionSnapshotAt,
  commuteArrivalDelayAtHour,
  occupantStopAt,
  errandSpotFor,
  legDepartureDelayHours,
} from '../townSnapshot';
import { occupantLocationAt } from '../occupantSchedule';
import { buildStreetGraph } from '../agentPath';
import type { TownPlan } from '../../artifacts';
import type { Occupant, TownRoster } from '../types';

// One east-west street (y = 0). Houses north of it, two markets and a temple
// along it, and a far market 3,000 ft away (beyond the near-errand range).
const plan = {
  burgId: 1,
  streets: [{ id: 1, widthFt: 10, centerline: [[-50, 0], [3200, 0]] }],
  plots: [
    { id: 10, role: 'house', footprint: [[0, 5], [20, 5], [20, 25], [0, 25]] },
    { id: 11, role: 'house', footprint: [[30, 5], [50, 5], [50, 25], [30, 25]] },
    { id: 20, role: 'market', footprint: [[200, 5], [220, 5], [220, 25], [200, 25]] },
    { id: 21, role: 'market', footprint: [[300, 5], [320, 5], [320, 25], [300, 25]] },
    { id: 30, role: 'temple', footprint: [[400, 5], [440, 5], [440, 45], [400, 45]] },
    { id: 40, role: 'market', footprint: [[3000, 5], [3020, 5], [3020, 25], [3000, 25]] },
  ],
} as unknown as TownPlan;

const resident = (id: number, ageBand: Occupant['ageBand'] = 'adult'): Occupant => ({
  id, name: `P${id}`, ageBand, homePlotId: 10, occupation: 'resident', householdMemberId: `h10:m${id}`,
});

/** The person's OUT hours (the schedule's own block). */
function outHours(o: Occupant): number[] {
  return [...Array(24).keys()].filter((h) => occupantLocationAt(o, h).activity === 'out');
}

describe('errandPlotFor', () => {
  const graph = buildStreetGraph(plan);

  it('records each plot role on its street entrance', () => {
    expect(graph.plotEntrances.get(20)?.role).toBe('market');
    expect(graph.plotEntrances.get(30)?.role).toBe('temple');
  });

  it('sends people to a public place near home, never the far market', () => {
    const picks = new Set<number>();
    for (let id = 1; id <= 200; id++) {
      const plot = errandPlotFor(graph, resident(id, (['child', 'adult', 'elder'] as const)[id % 3]));
      expect(plot).toBeDefined();
      picks.add(plot!);
    }
    expect(picks.has(40)).toBe(false);
    // More than one place is used, so groups form in several spots.
    expect(picks.size).toBeGreaterThan(1);
    for (const p of picks) expect([20, 21, 30]).toContain(p);
  });

  it('is deterministic per person', () => {
    const a = errandPlotFor(graph, resident(7));
    const b = errandPlotFor(buildStreetGraph(plan), resident(7));
    expect(a).toBe(b);
  });

  it('has no errand place in a town with only houses', () => {
    const houses = { ...plan, plots: plan.plots.filter((p) => p.role === 'house') } as TownPlan;
    expect(errandPlotFor(buildStreetGraph(houses), resident(3))).toBeUndefined();
  });
});

describe('errand walks in the street motion', () => {
  const graph = buildStreetGraph(plan);
  // A person with an OUT block and a known errand place.
  const person = [...Array(60).keys()].map((i) => resident(i + 1)).find((o) => outHours(o).length > 0)!;
  const roster: TownRoster = { burgId: 1, occupants: [person] };
  const out = outHours(person);
  const start = out[0];
  const end = out[out.length - 1] + 1;
  const errand = errandPlotFor(graph, person)!;

  it('sends the OUT block to the errand place, not home', () => {
    expect(occupantStopAt(person, start, graph).plotId).toBe(errand);
    // The schedule itself is unchanged: interiors still read OUT as away from home.
    expect(occupantLocationAt(person, start).plotId).toBe(person.homePlotId);
  });

  it('walks there after the departure delay, then stands in front of the door, outdoors', () => {
    const wait = legDepartureDelayHours(person, start);
    const walking = townMotionSnapshotAt(plan, graph, roster, start + wait + 1 / 3600)[0];
    expect(walking.moving).toBe(true);
    expect(walking.outdoors).toBe(true);
    const there = townMotionSnapshotAt(plan, graph, roster, start + 0.9)[0];
    const spot = errandSpotFor(graph, person, errand)!;
    expect(there).toMatchObject({ moving: false, outdoors: true, x: spot.spot[0], y: spot.spot[1] });
    expect(there.faceX).toBe(spot.face[0]);
    // The spot is in front of the door: on the street side (y < 5), never inside.
    expect(spot.spot[1]).toBeLessThan(5);
  });

  it('walks home after the block and the room gate waits for that walk', () => {
    const delay = commuteArrivalDelayAtHour(graph, person, end);
    expect(delay).toBeGreaterThan(legDepartureDelayHours(person, end));
    const walkingHome = townMotionSnapshotAt(plan, graph, roster, end + delay - 1 / 3600)[0];
    expect(walkingHome.moving).toBe(true);
    const home = townMotionSnapshotAt(plan, graph, roster, end + delay + 1 / 3600)[0];
    expect(home).toMatchObject({ moving: false, outdoors: false });
  });

  it('moves less than walking speed between any two game seconds (no jumps)', () => {
    let prev = townMotionSnapshotAt(plan, graph, roster, start)[0];
    for (let s = 1; s < 3600 * (end - start + 1); s += 1) {
      const cur = townMotionSnapshotAt(plan, graph, roster, start + s / 3600)[0];
      const stepM = Math.hypot(cur.x - prev.x, cur.y - prev.y) * 0.3048;
      expect(stepM, `second ${s}`).toBeLessThanOrEqual(1.2 + 1e-6);
      prev = cur;
    }
  });
});

describe('the outdoor-only pass', () => {
  it('returns exactly the outdoor people of the full pass, all day', () => {
    const graph = buildStreetGraph(plan);
    const people = [...Array(40).keys()].map((i) => resident(i + 1, (['child', 'adult', 'elder'] as const)[i % 3]));
    const roster: TownRoster = { burgId: 1, occupants: people };
    for (let clock = 0; clock < 24; clock += 1 / 12) {
      const full = townMotionSnapshotAt(plan, graph, roster, clock, { measuredWalk: true }).filter((a) => a.outdoors);
      const fast = townMotionSnapshotAt(plan, graph, roster, clock, { measuredWalk: true, outdoorsOnly: true });
      expect(fast, `clock ${clock.toFixed(2)}`).toEqual(full);
    }
  });
});
