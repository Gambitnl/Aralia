/**
 * Unit suite for the shared street-geometry module (streetRibbons.ts) — the
 * single source of tier widths/tints/layers and centerline→ribbon math for
 * BOTH town street renderers (game ground path + design-preview schematic).
 */
import { describe, it, expect } from 'vitest';
import {
  STREET_TIER_SPECS,
  STREET_TIER_ORDER,
  STREET_MIN_WIDTH_M,
  streetTierByColorHex,
  streetWidthM,
  streetRibbonLayers,
  ribbonEdgeOffsets,
  ribbonTrianglePositions,
  ribbonStripIndices,
} from '../streetRibbons';
import { ROAD_3D_TIERS } from '../../travel/roadTunables';

describe('street tier specs — the four-tier contrast contract', () => {
  it('orders tier widths strictly plaza > avenue > street > lane', () => {
    const w = STREET_TIER_ORDER.map((t) => STREET_TIER_SPECS[t].widthFt);
    expect(STREET_TIER_ORDER).toEqual(['plaza', 'avenue', 'street', 'lane']);
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeLessThan(w[i - 1]);
  });

  it('gives every tier a distinct core tint (the wire-format tier identity)', () => {
    const hexes = STREET_TIER_ORDER.map((t) => STREET_TIER_SPECS[t].colorHex);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it('never collides a street tint with a rural ROAD_3D_TIERS tint', () => {
    // colorHex is the ONLY tier identity that survives into chunk road data, so
    // a shared hex would make the game renderer dress a region road as a street.
    const rural = new Set(Object.values(ROAD_3D_TIERS).map((t) => t.colorHex.toLowerCase()));
    for (const t of STREET_TIER_ORDER) {
      expect(rural.has(STREET_TIER_SPECS[t].colorHex.toLowerCase())).toBe(false);
    }
  });

  it('resolves tiers by colorHex, case-insensitively, and rejects strangers', () => {
    for (const t of STREET_TIER_ORDER) {
      expect(streetTierByColorHex(STREET_TIER_SPECS[t].colorHex)?.tier).toBe(t);
      expect(streetTierByColorHex(STREET_TIER_SPECS[t].colorHex.toUpperCase())?.tier).toBe(t);
    }
    expect(streetTierByColorHex('#a08b62')).toBeUndefined(); // old lane = region road dirt
    expect(streetTierByColorHex(undefined)).toBeUndefined();
  });

  it('keeps the paint-order lift bias strictly ordered with tier rank (junction determinism)', () => {
    const lifts = STREET_TIER_ORDER.map((t) => STREET_TIER_SPECS[t].liftBiasM);
    for (let i = 1; i < lifts.length; i++) expect(lifts[i]).toBeLessThan(lifts[i - 1]);
  });

  it('renders every tier at or above the 2.5 m grass-visibility floor', () => {
    for (const t of STREET_TIER_ORDER) {
      expect(streetWidthM(STREET_TIER_SPECS[t])).toBeGreaterThanOrEqual(STREET_MIN_WIDTH_M);
    }
    // The floor itself only engages below ~8.2 ft; lane (10 ft) clears it for real.
    expect(streetWidthM({ widthFt: 4 })).toBe(STREET_MIN_WIDTH_M);
  });
});

describe('streetRibbonLayers — per-tier paint recipe', () => {
  it('edged tiers stack a full-width edging band under an inset core', () => {
    for (const t of ['plaza', 'avenue'] as const) {
      const spec = STREET_TIER_SPECS[t];
      const layers = streetRibbonLayers(spec);
      expect(layers).toHaveLength(2);
      expect(layers[0]).toMatchObject({ colorHex: spec.edgeHex, widthScale: 1 });
      expect(layers[1].colorHex).toBe(spec.colorHex);
      expect(layers[1].widthScale).toBeLessThan(1);
      expect(layers[1].liftM).toBeGreaterThan(layers[0].liftM); // core paints over edging
    }
  });

  it('the lane stacks a narrow dark rut stripe over its full-width dirt core', () => {
    const layers = streetRibbonLayers(STREET_TIER_SPECS.lane);
    expect(layers).toHaveLength(2);
    expect(layers[0]).toMatchObject({ colorHex: STREET_TIER_SPECS.lane.colorHex, widthScale: 1 });
    expect(layers[1].colorHex).toBe(STREET_TIER_SPECS.lane.rutHex);
    expect(layers[1].widthScale).toBeLessThan(0.5);
    expect(layers[1].liftM).toBeGreaterThan(layers[0].liftM);
  });

  it('the mid street tier is a single plain band (plain-vs-edged is a tier cue)', () => {
    const layers = streetRibbonLayers(STREET_TIER_SPECS.street);
    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({ colorHex: STREET_TIER_SPECS.street.colorHex, widthScale: 1 });
  });

  it('is deterministic — same spec in, identical layers out', () => {
    for (const t of STREET_TIER_ORDER) {
      expect(streetRibbonLayers(STREET_TIER_SPECS[t]))
        .toEqual(streetRibbonLayers(STREET_TIER_SPECS[t]));
    }
  });
});

describe('ribbonEdgeOffsets — the shared centerline→edges math', () => {
  it('offsets a straight 2-point dead-end square across the run direction', () => {
    // Run along +X: left edge is +(−dz,dx) = +Z? No — d=(1,0) ⇒ perp=(0,1)·h.
    const e = ribbonEdgeOffsets([[0, 0], [10, 0]], () => 2);
    expect(e).toHaveLength(2);
    expect(e[0]).toEqual({ lx: 0, lz: 2, rx: 0, rz: -2 });
    expect(e[1]).toEqual({ lx: 10, lz: 2, rx: 10, rz: -2 });
  });

  it('miters an interior corner by the neighbours\' central difference', () => {
    const e = ribbonEdgeOffsets([[0, 0], [10, 0], [10, 10]], () => 1);
    // Middle point: prev→next direction (10,10)/√200 ⇒ perp (−√½, √½).
    expect(e[1].lx).toBeCloseTo(10 - Math.SQRT1_2, 10);
    expect(e[1].lz).toBeCloseTo(Math.SQRT1_2, 10);
    expect(e[1].rx).toBeCloseTo(10 + Math.SQRT1_2, 10);
    expect(e[1].rz).toBeCloseTo(-Math.SQRT1_2, 10);
  });

  it('supports per-point widths (the game path tapers by clipped ribbon data)', () => {
    const e = ribbonEdgeOffsets([[0, 0], [10, 0]], (i) => (i === 0 ? 1 : 3));
    expect(e[0].lz - e[0].rz).toBeCloseTo(2, 10);
    expect(e[1].lz - e[1].rz).toBeCloseTo(6, 10);
  });

  it('never yields NaN on degenerate zero-length segments', () => {
    const e = ribbonEdgeOffsets([[5, 5], [5, 5]], () => 2);
    for (const p of e) for (const v of [p.lx, p.lz, p.rx, p.rz]) expect(Number.isFinite(v)).toBe(true);
  });

  it('is deterministic — identical input arrays produce identical outputs', () => {
    const pts: Array<[number, number]> = [[0, 0], [7, 3], [11, 9], [11, 20]];
    expect(ribbonEdgeOffsets(pts, (i) => 1 + i * 0.25))
      .toEqual(ribbonEdgeOffsets(pts, (i) => 1 + i * 0.25));
  });
});

describe('ribbon triangle emitters', () => {
  it('emits two up-facing triangles per segment (non-indexed path)', () => {
    const edges = ribbonEdgeOffsets([[0, 0], [10, 0], [20, 0]], () => 2);
    const pos = ribbonTrianglePositions(edges, () => 0.5);
    expect(pos.length).toBe(2 /* segments */ * 2 /* tris */ * 3 /* verts */ * 3 /* xyz */);
    // Every Y is the lift; winding: (l,+z) → next-l → (r,−z) is CCW from +Y.
    for (let i = 1; i < pos.length; i += 3) expect(pos[i]).toBe(0.5);
    // Cross product of the first triangle's edges must point UP (+Y).
    const [ax, , az, bx, , bz, cx2, , cz2] = pos;
    const uy = (cx2 - ax) * (bz - az) - (cz2 - az) * (bx - ax);
    expect(uy).toBeGreaterThan(0);
  });

  it('junction case: two ribbons meeting at one endpoint emit independent finite geometry', () => {
    const a = ribbonEdgeOffsets([[0, 0], [10, 0]], () => 2);
    const b = ribbonEdgeOffsets([[10, 0], [10, 12]], () => 1);
    const pos = [...ribbonTrianglePositions(a, () => 0), ...ribbonTrianglePositions(b, () => 0)];
    expect(pos).toHaveLength(2 * 18);
    for (const v of pos) expect(Number.isFinite(v)).toBe(true);
  });

  it('indexed strip pattern matches the game path\'s historical (l0,l1,r0)(r0,l1,r1) layout', () => {
    expect(ribbonStripIndices(2, 0)).toEqual([0, 2, 1, 1, 2, 3]);
    expect(ribbonStripIndices(3, 10)).toEqual([10, 12, 11, 11, 12, 13, 12, 14, 13, 13, 14, 15]);
    expect(ribbonStripIndices(1, 0)).toEqual([]); // a dead point emits no segment
  });
});
