/**
 * This file proves the town's street network is generated from the town, not
 * decreed: gates follow the roads that arrive, the high street is ROUTED over
 * the ward-edge graph to the market square, tier follows traffic, and every
 * street's width fits the wards it runs between — because that width is what
 * the ward blocks are inset to leave.
 */
import { describe, it, expect } from 'vitest';
import {
  buildStreetNetwork,
  densifyPolyline,
  halfWidthByWardEdge,
  roadGateCandidates,
  segmentCross,
  TIER_WIDTH_RATIO,
  type StreetNetworkInput,
  type TownStreet,
} from '../townStreetNetwork';
import { STREET_TIER_SPECS } from '../streetRibbons';
import type { Pt } from '../../submap/submapEngine';

/** A 4x4 grid of square wards over [0,400]^2 — a planar graph with real junctions. */
function gridWards(n = 4, size = 400): Pt[][] {
  const step = size / n;
  const out: Pt[][] = [];
  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      const x = gx * step;
      const y = gy * step;
      out.push([[x, y], [x + step, y], [x + step, y + step], [x, y + step]]);
    }
  }
  return out;
}

const SQUARE = (s: number): Pt[] => [[0, 0], [s, 0], [s, s], [0, s]];

function makeInput(over: Partial<StreetNetworkInput> = {}): StreetNetworkInput {
  const wardPolys = gridWards();
  return {
    wardPolys,
    wardCivic: wardPolys.map(() => undefined),
    wallRing: SQUARE(400),
    gatehouses: [[0, 200], [400, 200]],
    approachRoads: [[[-200, 200], [0, 200]], [[400, 200], [600, 200]]],
    envelope: SQUARE(400),
    laneWidth: 10,
    ...over,
  };
}

const tiers = (streets: readonly TownStreet[]): Set<string> => new Set(streets.map((s) => s.tier));
const roles = (streets: readonly TownStreet[]): Set<string> => new Set(streets.map((s) => s.role));

describe('roadGateCandidates', () => {
  it('seats a gate where a road crosses the ring', () => {
    const gates = roadGateCandidates(SQUARE(100), [[[-50, 50], [150, 50]]], 10);
    // The road crosses the west and east walls.
    expect(gates.length).toBe(2);
    expect(gates.map((g) => g[0]).sort((a, b) => a - b)).toEqual([0, 100]);
  });

  it('collapses two crossings closer together than the spacing into one gate', () => {
    // A road that wobbles across the west wall three times inside a few feet.
    const road: Pt[][] = [[[-5, 50], [5, 52], [-5, 54], [5, 56]]];
    const gates = roadGateCandidates(SQUARE(100), road, 30);
    expect(gates.length).toBe(1);
  });

  it('finds no gate for a road that misses the ring', () => {
    expect(roadGateCandidates(SQUARE(100), [[[200, 0], [200, 100]]], 10)).toEqual([]);
  });
});

describe('segmentCross', () => {
  it('returns the crossing point of two segments', () => {
    expect(segmentCross([0, 0], [10, 0], [5, -5], [5, 5])).toEqual([5, 0]);
  });
  it('returns null for parallel segments and for non-overlapping ones', () => {
    expect(segmentCross([0, 0], [10, 0], [0, 1], [10, 1])).toBeNull();
    expect(segmentCross([0, 0], [1, 0], [5, -5], [5, 5])).toBeNull();
  });
});

describe('densifyPolyline', () => {
  it('inserts points so no span exceeds the spacing, keeping both ends', () => {
    const out = densifyPolyline([[0, 0], [100, 0]], 25);
    expect(out[0]).toEqual([0, 0]);
    expect(out.at(-1)).toEqual([100, 0]);
    for (let i = 0; i < out.length - 1; i++) {
      expect(Math.hypot(out[i + 1][0] - out[i][0], out[i + 1][1] - out[i][1])).toBeLessThanOrEqual(25.001);
    }
  });

  it('leaves a line alone when it is already fine enough', () => {
    expect(densifyPolyline([[0, 0], [5, 0]], 25)).toEqual([[0, 0], [5, 0]]);
  });
});

describe('buildStreetNetwork', () => {
  it('is deterministic — same town in, identical streets out', () => {
    const a = buildStreetNetwork(makeInput());
    const b = buildStreetNetwork(makeInput());
    expect(a).toEqual(b);
  });

  it('emits nothing for a town with no wards', () => {
    expect(buildStreetNetwork(makeInput({ wardPolys: [], wardCivic: [] }))).toEqual([]);
  });

  it('routes a spine from every gate and reaches the gate point itself', () => {
    const net = buildStreetNetwork(makeInput());
    const spines = net.filter((s) => s.role === 'spine');
    expect(spines.length).toBe(2);
    // Each spine touches the gatehouse it started from, so the high street
    // arrives at the arch instead of stopping at the nearest ward corner.
    for (const gate of [[0, 200], [400, 200]] as Pt[]) {
      expect(spines.some((s) =>
        s.centerline.some((p) => Math.hypot(p[0] - gate[0], p[1] - gate[1]) < 1e-6),
      )).toBe(true);
    }
  });

  it('makes the busiest lines the widest — tier follows routed traffic', () => {
    const net = buildStreetNetwork(makeInput());
    const spine = net.find((s) => s.role === 'spine')!;
    const lane = net.find((s) => s.role === 'ward' && s.tier === 'lane')!;
    expect(spine.width).toBeGreaterThan(lane.width);
    expect(net.filter((s) => s.tier === 'lane').length).toBeGreaterThan(0);
  });

  it('paves the market square frontage as the plaza tier whatever its traffic', () => {
    const wardPolys = gridWards();
    const wardCivic = wardPolys.map((_, i) => (i === 5 ? 'plaza' : undefined));
    const net = buildStreetNetwork(makeInput({ wardPolys, wardCivic }));
    expect(tiers(net).has('plaza')).toBe(true);
    const plazaStreets = net.filter((s) => s.tier === 'plaza');
    for (const s of plazaStreets) {
      expect(s.width).toBeCloseTo(10 * TIER_WIDTH_RATIO.plaza, 6);
    }
  });

  it('keeps a lane at exactly the lane width so existing towns do not re-scale', () => {
    const net = buildStreetNetwork(makeInput());
    const lane = net.find((s) => s.tier === 'lane')!;
    expect(lane.width).toBeCloseTo(10, 6);
  });

  it('runs a ring lane inside the wall so houses cannot pack against the stone', () => {
    const net = buildStreetNetwork(makeInput());
    expect(roles(net).has('ring')).toBe(true);
  });

  it('has no ring role at all when the settlement is unwalled', () => {
    const net = buildStreetNetwork(makeInput({ wallRing: [], gatehouses: [] }));
    expect(roles(net).has('ring')).toBe(false);
  });

  it('still routes a spine for an unwalled village, off the road entry points', () => {
    // No gatehouses: the entries come from where the roads cross the envelope.
    const net = buildStreetNetwork(makeInput({ wallRing: [], gatehouses: [] }));
    expect(net.filter((s) => s.role === 'spine').length).toBeGreaterThan(0);
  });

  it('keeps the approach road OUTSIDE the wall and drops the part that was inside', () => {
    const net = buildStreetNetwork(makeInput({
      // One road driving clean across the town, west to east.
      approachRoads: [[[-200, 200], [600, 200]]],
    }));
    const approaches = net.filter((s) => s.role === 'approach');
    expect(approaches.length).toBe(2); // the two extramural halves
    for (const a of approaches) {
      for (const [x] of a.centerline) {
        // Nothing between the walls: the routed spine covers the town, not the road.
        expect(x <= 0 + 1e-6 || x >= 400 - 1e-6).toBe(true);
      }
    }
  });

  it('leaves a road that never reaches the town whole', () => {
    const net = buildStreetNetwork(makeInput({ approachRoads: [[[600, 0], [600, 400]]] }));
    const approach = net.filter((s) => s.role === 'approach');
    expect(approach.length).toBe(1);
    expect(approach[0].centerline).toEqual([[600, 0], [600, 400]]);
  });

  it('never lets a street grow wider than the ward beside it can give up', () => {
    // A tiny ward tessellating a strip with a big one, so the shared edge is
    // genuinely shared (identical endpoints) as a real ward tessellation is.
    const strip = {
      wardPolys: [
        [[0, 0], [20, 0], [20, 20], [0, 20]],       // 20-unit ward
        [[20, 0], [400, 0], [400, 20], [20, 20]],   // the rest of the strip
      ] as Pt[][],
      wardCivic: [undefined, undefined],
      wallRing: [[0, 0], [400, 0], [400, 20], [0, 20]] as Pt[],
      envelope: [[0, 0], [400, 0], [400, 20], [0, 20]] as Pt[],
      gatehouses: [[0, 10], [400, 10]] as Pt[],
      approachRoads: [] as Pt[][],
    };
    const net = buildStreetNetwork(makeInput({
      ...strip,
      laneWidth: 40, // deliberately absurd for a 20-unit ward
    }));
    const shared = net.filter((s) => s.centerline.every(([x]) => Math.abs(x - 20) < 1e-6));
    expect(shared.length).toBeGreaterThan(0);
    for (const s of shared) expect(s.width).toBeLessThanOrEqual(20 * 0.28 + 1e-6);
  });

  it('exempts the market square from the cap — it builds nothing to protect', () => {
    const strip = {
      wardPolys: [
        [[0, 0], [20, 0], [20, 20], [0, 20]],
        [[20, 0], [400, 0], [400, 20], [20, 20]],
      ] as Pt[][],
      wallRing: [[0, 0], [400, 0], [400, 20], [0, 20]] as Pt[],
      envelope: [[0, 0], [400, 0], [400, 20], [0, 20]] as Pt[],
      gatehouses: [[0, 10], [400, 10]] as Pt[],
      approachRoads: [] as Pt[][],
      laneWidth: 40,
    };
    const capped = buildStreetNetwork(makeInput({ ...strip, wardCivic: [undefined, undefined] }));
    const exempt = buildStreetNetwork(makeInput({ ...strip, wardCivic: ['plaza', undefined] }));
    const sharedWidth = (n: TownStreet[]): number =>
      Math.max(...n.filter((s) => s.centerline.every(([x]) => Math.abs(x - 20) < 1e-6)).map((s) => s.width));
    expect(sharedWidth(exempt)).toBeGreaterThan(sharedWidth(capped));
  });

  it('orders the tier ratios strictly plaza > avenue > street > lane', () => {
    expect(TIER_WIDTH_RATIO.plaza).toBeGreaterThan(TIER_WIDTH_RATIO.avenue);
    expect(TIER_WIDTH_RATIO.avenue).toBeGreaterThan(TIER_WIDTH_RATIO.street);
    expect(TIER_WIDTH_RATIO.street).toBeGreaterThan(TIER_WIDTH_RATIO.lane);
    expect(TIER_WIDTH_RATIO.lane).toBe(1);
  });

  it('uses the tints the shared paint module owns, never its own', () => {
    // The wire identity of a tier is its colorHex; the network must not fork it.
    for (const tier of ['plaza', 'avenue', 'street', 'lane'] as const) {
      expect(STREET_TIER_SPECS[tier].widthFt / STREET_TIER_SPECS.lane.widthFt)
        .toBeCloseTo(TIER_WIDTH_RATIO[tier], 6);
    }
  });
});

describe('halfWidthByWardEdge', () => {
  it('reports HALF the street width, keyed on the quantized ward edge', () => {
    const net: TownStreet[] = [
      { centerline: [[0, 0], [100, 0]], tier: 'avenue', role: 'spine', width: 22 },
    ];
    const map = halfWidthByWardEdge(net, 0.01);
    expect(map.get('0,0|10000,0')).toBe(11);
  });

  it('is direction-agnostic — the same edge keys the same either way round', () => {
    const a = halfWidthByWardEdge([{ centerline: [[0, 0], [10, 0]], tier: 'lane', role: 'ward', width: 8 }], 0.01);
    const b = halfWidthByWardEdge([{ centerline: [[10, 0], [0, 0]], tier: 'lane', role: 'ward', width: 8 }], 0.01);
    expect([...a.keys()]).toEqual([...b.keys()]);
  });

  it('keeps the WIDEST claim when two streets share a segment', () => {
    const map = halfWidthByWardEdge([
      { centerline: [[0, 0], [10, 0]], tier: 'lane', role: 'ward', width: 8 },
      { centerline: [[0, 0], [10, 0]], tier: 'avenue', role: 'spine', width: 22 },
    ], 0.01);
    expect([...map.values()]).toEqual([11]);
  });

  it('ignores the extramural approach — no ward block borders it', () => {
    const map = halfWidthByWardEdge([
      { centerline: [[0, 0], [10, 0]], tier: 'avenue', role: 'approach', width: 22 },
    ], 0.01);
    expect(map.size).toBe(0);
  });
});
