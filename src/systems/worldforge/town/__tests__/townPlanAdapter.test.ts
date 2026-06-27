import { describe, it, expect } from 'vitest';
import { toArtifactPlan, storeysForRole } from '../townPlanAdapter';
import type { TownPlan as EngineTownPlan } from '../townEngine';

const sq = (x: number, y: number, s: number): [number, number][] =>
  [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];

/** Synthetic engine plan: two ward plots (a shop + a home), a temple, one street, a wall ring.
 *  Plots are >= MIN_PLOT_SIDE_FT so the adapter keeps them. */
function makeEnginePlan(): EngineTownPlan {
  const shop = { polygon: sq(0, 0, 16), frontageEdge: 0, buildingType: 'shop' as const };
  const home = { polygon: sq(30, 0, 16), frontageEdge: 0, buildingType: 'cottage' as const };
  return {
    footprint: sq(-5, -5, 80),
    core: sq(0, 0, 70),
    wards: [{ polygon: sq(0, 0, 70), block: sq(1, 1, 68), plots: [shop, home], civic: undefined }],
    plots: [shop, home],
    outskirts: [],
    walls: { ring: sq(0, 0, 70), gatehouses: [[35, 0]] },
    civic: [{ kind: 'temple', polygon: sq(40, 40, 18), wardIndex: 0 }],
    streets: [[[0, 0], [25, 25], [50, 50]]],
    farmsteads: [],
  } as EngineTownPlan;
}

describe('toArtifactPlan', () => {
  const { plan, walls } = toArtifactPlan(makeEnginePlan(), 7);

  it('carries the burgId', () => {
    expect(plan.burgId).toBe(7);
  });

  it('maps building types into the 3D role buckets', () => {
    const roles = plan.plots.map((p) => p.role).sort();
    // shop → market, cottage → house, temple civic → temple
    expect(roles).toContain('market');
    expect(roles).toContain('house');
    expect(roles).toContain('temple');
  });

  it('emits 4-corner footprints for every plot (3D oriented-box contract)', () => {
    for (const p of plan.plots) expect(p.footprint.length).toBe(4);
  });

  it('gives every plot >= 1 storey; civic/commercial taller than rim houses', () => {
    for (const p of plan.plots) expect(p.storeys).toBeGreaterThanOrEqual(1);
    const temple = plan.plots.find((p) => p.role === 'temple')!;
    expect(temple.storeys).toBe(3);
  });

  it('converts streets and surfaces the wall ring', () => {
    expect(plan.streets.length).toBe(1);
    expect(plan.streets[0].centerline.length).toBe(3);
    expect(walls.ring.length).toBe(4);
    expect(walls.gatehouses.length).toBe(1);
  });
});

describe('storeysForRole', () => {
  it('keeps civic/commercial tall and houses low', () => {
    const poly = sq(0, 0, 10);
    expect(storeysForRole('keep', poly)).toBe(3);
    expect(storeysForRole('market', poly)).toBe(2);
    expect(storeysForRole('house', poly)).toBeGreaterThanOrEqual(1);
    expect(storeysForRole('house', poly)).toBeLessThanOrEqual(2);
  });
});
