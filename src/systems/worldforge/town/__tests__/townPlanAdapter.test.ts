import { describe, it, expect } from 'vitest';
import { toArtifactPlan, storeysForRole, STREET_TIERS } from '../townPlanAdapter';

const { avenue: AVENUE, street: STREET, lane: LANE } = STREET_TIERS;
import { STYLE_FAMILIES } from '../architectureStyle';
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

  it('surfaces the wall ring and gatehouses', () => {
    expect(walls.ring.length).toBe(4);
    expect(walls.gatehouses.length).toBe(1);
  });

  it('turns every ward edge into a lane and keeps the inherited road as an avenue', () => {
    // One 4-sided ward → 4 lane edges; plus the one inherited regional road.
    expect(plan.streets.length).toBe(5);
    expect(plan.streets.filter((s) => s.widthFt === LANE.widthFt).length).toBe(4);
    expect(plan.streets.filter((s) => s.widthFt === AVENUE.widthFt).length).toBe(1);
  });

  it('tags the inherited road as a wide pale avenue, centerline untouched', () => {
    const avenue = plan.streets.find((s) => s.widthFt === AVENUE.widthFt)!;
    expect(avenue.colorHex).toBe(AVENUE.colorHex);
    expect(avenue.centerline).toEqual([[0, 0], [25, 25], [50, 50]]);
  });

  it('lanes are narrow packed dirt', () => {
    for (const lane of plan.streets.filter((s) => s.widthFt === LANE.widthFt)) {
      expect(lane.colorHex).toBe(LANE.colorHex);
      expect(lane.centerline.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('promotes plaza-ward frontage to paved streets', () => {
    const plaza = {
      ...makeEnginePlan(),
      wards: [{ polygon: sq(0, 0, 40), block: sq(1, 1, 38), plots: [{ polygon: sq(4, 4, 16), frontageEdge: 0, buildingType: 'shop' as const }], civic: 'plaza' as const }],
      plots: [{ polygon: sq(4, 4, 16), frontageEdge: 0, buildingType: 'shop' as const }],
      streets: [],
    } as EngineTownPlan;
    const { plan: p } = toArtifactPlan(plaza, 3);
    expect(p.streets.length).toBe(4); // the plaza ward's 4 edges, no inherited road
    for (const s of p.streets) {
      expect(s.widthFt).toBe(STREET.widthFt);
      expect(s.colorHex).toBe(STREET.colorHex);
    }
  });

  it('dedups ward edges shared between two adjacent wards', () => {
    const twoWard = {
      ...makeEnginePlan(),
      wards: [
        { polygon: sq(0, 0, 20), block: sq(1, 1, 18), plots: [], civic: undefined },
        { polygon: sq(20, 0, 20), block: sq(21, 1, 18), plots: [], civic: undefined },
      ],
      plots: [],
      streets: [],
    } as EngineTownPlan;
    const { plan: p } = toArtifactPlan(twoWard, 4);
    // 4 + 4 edges, one shared → 7 unique streets.
    expect(p.streets.length).toBe(7);
  });

  it('emits no style fields when no family is given (legacy shape)', () => {
    for (const p of plan.plots) {
      expect(p.wallColorHex).toBeUndefined();
      expect(p.roofColorHex).toBeUndefined();
      expect(p.roofForm).toBeUndefined();
    }
  });

  it('stamps deterministic style fields when a family is provided', () => {
    const fam = STYLE_FAMILIES.highlandStone;
    const a = toArtifactPlan(makeEnginePlan(), 42, fam);
    const b = toArtifactPlan(makeEnginePlan(), 42, fam);
    expect(a.plan.plots.length).toBeGreaterThan(0);
    for (const [i, plot] of a.plan.plots.entries()) {
      expect(plot.wallColorHex).toBeTruthy();
      expect(fam.wallPalette).toContain(plot.wallColorHex!);
      expect(plot.roofColorHex).toBeTruthy();
      expect(fam.roofPalette).toContain(plot.roofColorHex!);
      expect(plot.roofForm && fam.roofForms.includes(plot.roofForm)).toBe(true);
      expect(plot.wallColorHex).toBe(b.plan.plots[i].wallColorHex);
      expect(plot.roofColorHex).toBe(b.plan.plots[i].roofColorHex);
      expect(plot.roofForm).toBe(b.plan.plots[i].roofForm);
    }
  });

  it('plot IDs are unchanged by styling (business-binding invariant)', () => {
    const plain = toArtifactPlan(makeEnginePlan(), 42);
    const styled = toArtifactPlan(makeEnginePlan(), 42, STYLE_FAMILIES.coastalTimber);
    expect(styled.plan.plots.map((p) => p.id)).toEqual(plain.plan.plots.map((p) => p.id));
    expect(styled.plan.plots.map((p) => p.footprint)).toEqual(plain.plan.plots.map((p) => p.footprint));
    expect(styled.plan.plots.map((p) => p.role)).toEqual(plain.plan.plots.map((p) => p.role));
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
