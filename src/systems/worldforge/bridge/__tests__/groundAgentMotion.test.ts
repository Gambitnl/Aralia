/**
 * Verifies the ground-meters agent-motion primitive: occupants convert from the
 * plan's feet frame to ground meters (offset from the artifact origin), commuters
 * interpolate mid-route, and the set is conserved + deterministic.
 */
import { describe, it, expect } from 'vitest';
import { groundTownAgentsAt, allGroundAgentsAt, groundAgentScenePositions } from '../groundAgentMotion';
import { occupantLocationAt } from '../../roster/occupantSchedule';
import { WORLD3D_CONFIG } from '../../../world3d/config';
import type { TownPlan } from '../../artifacts';
import type { TownRoster } from '../../roster/types';

const FEET_TO_METERS = 0.3048;
const bounds = { x: 1000, y: 2000 }; // artifact NW origin in feet

// Home plot at the origin; work plot 100 ft east. No streets → straight-line route.
const plan = {
  burgId: 3,
  streets: [],
  plots: [
    { id: 10, role: 'house', footprint: [[1000, 2000], [1010, 2000], [1010, 2010], [1000, 2010]] },
    { id: 20, role: 'market', footprint: [[1100, 2000], [1110, 2000], [1110, 2010], [1100, 2010]] },
  ],
} as unknown as TownPlan;

const roster: TownRoster = {
  burgId: 3,
  occupants: [
    { id: 1, name: 'Aldric', ageBand: 'adult', homePlotId: 10, workPlotId: 20, occupation: 'shopkeeper' },
    { id: 2, name: 'Bess', ageBand: 'adult', homePlotId: 10, occupation: 'resident' },
  ],
};

const transitionHour = (() => {
  for (let h = 0; h < 24; h++) {
    if (occupantLocationAt(roster.occupants[0], h - 1).plotId !== occupantLocationAt(roster.occupants[0], h).plotId) return h;
  }
  throw new Error('no transition');
})();

describe('groundTownAgentsAt', () => {
  it('converts plan-feet positions to ground meters (offset from the artifact origin)', () => {
    // Deep night: everyone home at plot 10, whose centroid is (1005, 2005) ft.
    const agents = groundTownAgentsAt(3, plan, roster, bounds, 3.0);
    const aldric = agents.find((a) => a.occupantId === 1)!;
    expect(aldric.xM).toBeCloseTo((1005 - bounds.x) * FEET_TO_METERS); // 5 ft → ~1.52 m
    expect(aldric.zM).toBeCloseTo((2005 - bounds.y) * FEET_TO_METERS);
    expect(aldric.moving).toBe(false);
    expect(aldric.activity).toBe('sleeping');
  });

  it('places a commuter mid-route (between the two plots) during the commute window', () => {
    const agents = groundTownAgentsAt(3, plan, roster, bounds, transitionHour + 0.25);
    const aldric = agents.find((a) => a.occupantId === 1)!;
    expect(aldric.moving).toBe(true);
    const homeXm = (1005 - bounds.x) * FEET_TO_METERS;
    const workXm = (1105 - bounds.x) * FEET_TO_METERS;
    expect(aldric.xM).toBeGreaterThan(Math.min(homeXm, workXm));
    expect(aldric.xM).toBeLessThan(Math.max(homeXm, workXm));
  });

  it('conserves the population and is deterministic', () => {
    const a = groundTownAgentsAt(3, plan, roster, bounds, transitionHour + 0.25);
    const b = groundTownAgentsAt(3, plan, roster, bounds, transitionHour + 0.25);
    expect(a).toEqual(b);
    expect(a).toHaveLength(roster.occupants.length);
    expect(a.every((x) => x.burgId === 3)).toBe(true);
  });
});

describe('allGroundAgentsAt', () => {
  const groundLike = {
    rosters: [roster, { burgId: 9, occupants: [{ id: 5, name: 'Cara', ageBand: 'adult', homePlotId: 10, occupation: 'resident' }] }],
    townPlans: [
      { burgId: 3, plan },
      { burgId: 9, plan: { ...plan, burgId: 9 } },
    ],
    boundsFeet: bounds,
  } as unknown as Parameters<typeof allGroundAgentsAt>[0];

  it('flattens all towns, pairing each plan with its roster by burgId', () => {
    const agents = allGroundAgentsAt(groundLike, 3.0);
    // 2 from burg 3 + 1 from burg 9 = 3 total, tagged with their burg.
    expect(agents).toHaveLength(3);
    expect(agents.filter((a) => a.burgId === 3)).toHaveLength(2);
    expect(agents.filter((a) => a.burgId === 9)).toHaveLength(1);
  });

  it('returns [] when the ground world lacks agent-motion inputs', () => {
    expect(allGroundAgentsAt({ rosters: [] } as unknown as Parameters<typeof allGroundAgentsAt>[0], 12)).toEqual([]);
  });
});

describe('groundAgentScenePositions', () => {
  const ground = {
    rosters: [roster],
    townPlans: [{ burgId: 3, plan }],
    boundsFeet: bounds,
    // Minimal flat terrain so groundSurfaceY returns a finite value.
    cols: 4, rows: 4,
    heights: new Array(16).fill(50),
    extentMetersX: 400, extentMetersZ: 400,
  } as unknown as Parameters<typeof groundAgentScenePositions>[0];

  it('adds pseudo-grid coords (meters ÷ METERS_PER_CELL) and a finite surfaceY', () => {
    const nodes = groundAgentScenePositions(ground, 3.0);
    expect(nodes.length).toBe(roster.occupants.length);
    for (const n of nodes) {
      expect(n.gridX).toBeCloseTo(n.xM / WORLD3D_CONFIG.METERS_PER_CELL);
      expect(n.gridY).toBeCloseTo(n.zM / WORLD3D_CONFIG.METERS_PER_CELL);
      expect(Number.isFinite(n.surfaceY)).toBe(true);
    }
  });

  it('preserves the motion flag + identity from the underlying agents', () => {
    const nodes = groundAgentScenePositions(ground, 3.0);
    const aldric = nodes.find((n) => n.occupantId === 1)!;
    expect(aldric.name).toBe('Aldric');
    expect(aldric.activity).toBe('sleeping');
    expect(aldric.moving).toBe(false);
  });
});
