/**
 * The market square (GG-586): what a square holds by size and wealth, how its
 * stalls stand, and that every stall opens onto paving a walker reaches from
 * a street.
 */
import { describe, expect, it } from 'vitest';
import type { Pt } from '../../submap/submapEngine';
import {
  buildMarketSquare,
  distToRing,
  MARKET_EDGE_WALK_FT,
  MARKET_OPEN_SHARE_MIN,
  marketPieces,
  marketReach,
  plotFacesSquare,
  type MarketStreet,
} from '../marketSquare';

const unit = (ft: number): number => ft;

/** A square `w` by `h` feet with its ring street 28 ft wide round it. */
function square(w: number, h: number): { sq: Pt[]; streets: MarketStreet[] } {
  const sq: Pt[] = [[0, 0], [w, 0], [w, h], [0, h]];
  const r = 14;
  const ring: Pt[] = [[-r, -r], [w + r, -r], [w + r, h + r], [-r, h + r], [-r, -r]];
  return { sq, streets: [{ line: ring, half: 14 }] };
}

function overlaps(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const nx = q[1] - p[1], ny = p[0] - q[0];
      const pa = a.map((v) => v[0] * nx + v[1] * ny), pb = b.map((v) => v[0] * nx + v[1] * ny);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false;
    }
  }
  return true;
}

describe('marketPieces (GG-586)', () => {
  it('chooses the pieces by town size and wealth band', () => {
    expect(marketPieces('village', 'comfortable')).toMatchObject({ centerpiece: 'well', hall: false, weighHouse: false, pillory: false });
    expect(marketPieces('village', 'rich').centerpiece).toBe('market-cross');
    expect(marketPieces('walled town', 'poor')).toMatchObject({ centerpiece: 'well', hall: false, weighHouse: false, pillory: true });
    expect(marketPieces('walled town', 'comfortable')).toMatchObject({ centerpiece: 'market-cross', hall: false, weighHouse: true });
    expect(marketPieces('walled town', 'rich')).toMatchObject({ centerpiece: 'fountain', hall: true, weighHouse: true });
    expect(marketPieces('city', 'poor')).toMatchObject({ centerpiece: 'market-cross', hall: true, weighHouse: true, pillory: true });
    expect(marketPieces('capital', 'poor').centerpiece).toBe('fountain');
  });

  it('caps stalls higher in a bigger and a richer town', () => {
    const cap = (t: Parameters<typeof marketPieces>[0], b: Parameters<typeof marketPieces>[1]) => marketPieces(t, b).stallCap;
    expect(cap('village', 'comfortable')).toBeLessThan(cap('walled town', 'comfortable'));
    expect(cap('walled town', 'comfortable')).toBeLessThan(cap('city', 'comfortable'));
    expect(cap('city', 'comfortable')).toBeLessThan(cap('capital', 'comfortable'));
    expect(cap('city', 'poor')).toBeLessThan(cap('city', 'rich'));
  });
});

describe('buildMarketSquare (GG-586)', () => {
  const { sq, streets } = square(200, 150);
  const build = (typology: Parameters<typeof marketPieces>[0], band: Parameters<typeof marketPieces>[1], mainEnd?: Pt) =>
    buildMarketSquare({ wardIndex: 3, square: sq, typology, band, streets, ...(mainEnd ? { mainEnd } : {}), unit, seedPath: 'test|market' as never })!;

  it('records the square as plaza grounds with the market set piece', () => {
    const m = build('city', 'comfortable', [100, -14]);
    expect(m).toMatchObject({ wardIndex: 3, civicKind: 'plaza', setPiece: 'market', chosenBy: 'city, comfortable', forecourt: [], approach: [] });
    expect(m.grounds).toEqual(sq);
    const kinds = new Set(m.features.map((f) => f.kind));
    for (const k of ['fountain', 'market-hall', 'weigh-house', 'pillory', 'stall'] as const) expect(kinds.has(k)).toBe(true);
  });

  it('opens every stall onto paving a walker reaches from a street, and keeps the edge walk and the open share', () => {
    for (const [typ, band] of [['walled town', 'comfortable'], ['city', 'rich'], ['capital', 'poor']] as const) {
      const m = build(typ, band, [100, -14]);
      const r = marketReach(m, streets, unit);
      expect(r.stalls).toBeGreaterThan(0);
      expect(r.reachedStalls).toBe(r.stalls);
      expect(r.openShare).toBeGreaterThanOrEqual(MARKET_OPEN_SHARE_MIN);
      expect(r.reachedOpenShare).toBe(1);
      expect(r.stallEdgeGap).toBeGreaterThanOrEqual(MARKET_EDGE_WALK_FT - 1e-6);
      expect(r.stalls).toBeLessThanOrEqual(marketPieces(typ, band).stallCap);
    }
  });

  it('lets no piece overlap another', () => {
    const m = build('capital', 'rich', [100, -14]);
    for (let i = 0; i < m.features.length; i++) {
      for (let j = i + 1; j < m.features.length; j++) {
        expect(overlaps(m.features[i].polygon, m.features[j].polygon), `${m.features[i].kind} ${i} / ${m.features[j].kind} ${j}`).toBe(false);
      }
    }
  });

  it('keeps the lane from the main street to the centerpiece clear of stalls', () => {
    const m = build('walled town', 'comfortable', [100, -14]);
    const center = m.features[0].polygon.reduce((s, p) => [s[0] + p[0] / m.features[0].polygon.length, s[1] + p[1] / m.features[0].polygon.length] as Pt, [0, 0] as Pt);
    for (const f of m.features.filter((g) => g.kind === 'stall')) {
      for (const p of f.polygon) {
        // The lane runs from (100, 0) up to the centerpiece; 8 ft each side.
        const onLane = p[1] >= 0 && p[1] <= center[1] && Math.abs(p[0] - 100) < 8 - 1e-6;
        expect(onLane).toBe(false);
      }
    }
  });

  it('turns each stall in a pair of rows toward its own aisle', () => {
    const m = build('city', 'comfortable');
    const stalls = m.features.filter((f) => f.kind === 'stall');
    // The square's long side runs along x, so every stall faces up or down.
    for (const s of stalls) {
      const front = [(s.polygon[2][0] + s.polygon[3][0]) / 2, (s.polygon[2][1] + s.polygon[3][1]) / 2];
      const back = [(s.polygon[0][0] + s.polygon[1][0]) / 2, (s.polygon[0][1] + s.polygon[1][1]) / 2];
      expect(Math.abs(front[0] - back[0])).toBeLessThan(1e-6);
      expect(Math.abs(Math.abs(front[1] - back[1]) - 7)).toBeLessThan(1e-6);
    }
    expect(new Set(stalls.map((s) => Math.sign(s.polygon[2][1] - s.polygon[0][1]))).size).toBe(2);
  });

  it('is deterministic', () => {
    expect(build('capital', 'comfortable', [100, -14])).toEqual(build('capital', 'comfortable', [100, -14]));
  });

  it('returns no market for a square too small for its centerpiece', () => {
    const tiny = square(10, 10);
    expect(buildMarketSquare({ wardIndex: 0, square: tiny.sq, typology: 'capital', band: 'rich', streets: tiny.streets, unit, seedPath: 't' as never })).toBeNull();
  });

  it('holds a village green with a well and a few stalls, an 8 ft walk at its edge', () => {
    const green = square(70, 56);
    const m = buildMarketSquare({ wardIndex: 0, square: green.sq, typology: 'village', band: 'comfortable', streets: green.streets, unit, seedPath: 'g' as never })!;
    expect(m.features[0].kind).toBe('well');
    const stalls = m.features.filter((f) => f.kind === 'stall');
    expect(stalls.length).toBeGreaterThan(0);
    expect(stalls.length).toBeLessThanOrEqual(marketPieces('village', 'comfortable').stallCap);
    for (const s of stalls) for (const p of s.polygon) expect(distToRing(p, green.sq)).toBeGreaterThanOrEqual(8 - 1e-6);
  });
});

describe('plotFacesSquare (GG-586)', () => {
  const sq: Pt[] = [[0, 0], [100, 0], [100, 100], [0, 100]];
  it('is true for a house whose street side looks onto the square across the street', () => {
    // Street side (corners 0 to 1) at y = -28, the house behind it to y = -60.
    expect(plotFacesSquare([[40, -28], [60, -28], [60, -60], [40, -60]], sq, 40)).toBe(true);
  });
  it('is false for a house that turns its back to the square, or stands too far off', () => {
    expect(plotFacesSquare([[40, -60], [60, -60], [60, -28], [40, -28]], sq, 40)).toBe(false);
    expect(plotFacesSquare([[40, -80], [60, -80], [60, -110], [40, -110]], sq, 40)).toBe(false);
  });
});
