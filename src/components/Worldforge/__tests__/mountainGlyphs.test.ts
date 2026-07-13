import { describe, it, expect } from 'vitest';
import {
  cellReliefGlyphs,
  reliefBandForHeight,
  reliefGlyphPath,
  reliefInk,
  type ReliefBand,
  type ReliefGlyph,
} from '../mountainGlyphs';
import {
  GLYPH_PEAK_MIN_H,
  GLYPH_HILL_MIN_H,
  GLYPH_SNOW_TIP_MIN_H,
} from '../../../systems/worldforge/mountains/mountainTunables';

/** Square cell polygon: any point in its bbox is inside, so rejection
 * sampling never starves and inside-ness is checkable with plain bounds. */
const SQUARE: Array<[number, number]> = [
  [10, 10],
  [30, 10],
  [30, 30],
  [10, 30],
];

describe('reliefBandForHeight', () => {
  it('returns "peak" for h >= PEAK_MIN_H (70)', () => {
    expect(reliefBandForHeight(70)).toBe('peak');
    expect(reliefBandForHeight(75)).toBe('peak');
    expect(reliefBandForHeight(100)).toBe('peak');
  });

  it('returns "hill" for HILL_MIN_H (50) <= h < PEAK_MIN_H (70)', () => {
    expect(reliefBandForHeight(50)).toBe('hill');
    expect(reliefBandForHeight(60)).toBe('hill');
    expect(reliefBandForHeight(69)).toBe('hill');
  });

  it('returns null for h < HILL_MIN_H (50)', () => {
    expect(reliefBandForHeight(49)).toBeNull();
    expect(reliefBandForHeight(0)).toBeNull();
    expect(reliefBandForHeight(-10)).toBeNull();
  });

  it('boundary: h = 49 → null, h = 50 → hill, h = 69 → hill, h = 70 → peak, h = 80 → peak', () => {
    expect(reliefBandForHeight(49)).toBeNull();
    expect(reliefBandForHeight(50)).toBe('hill');
    expect(reliefBandForHeight(69)).toBe('hill');
    expect(reliefBandForHeight(70)).toBe('peak');
    expect(reliefBandForHeight(80)).toBe('peak');
  });
});

describe('cellReliefGlyphs', () => {
  it('is deterministic: identical inputs produce deep-equal glyph lists', () => {
    const a = cellReliefGlyphs(42, SQUARE, 65, 'hill');
    const b = cellReliefGlyphs(42, SQUARE, 65, 'hill');
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it('different cell ids give different layouts (hash actually varies)', () => {
    const a = cellReliefGlyphs(1, SQUARE, 65, 'hill');
    const b = cellReliefGlyphs(2, SQUARE, 65, 'hill');
    expect(a.map((g) => [g.x, g.y])).not.toEqual(b.map((g) => [g.x, g.y]));
  });

  it('peak band produces exactly 1 glyph', () => {
    const glyphs = cellReliefGlyphs(42, SQUARE, 75, 'peak');
    expect(glyphs.length).toBe(1);
  });

  it('hill band produces up to 2 glyphs', () => {
    for (const cellId of [1, 5, 10, 99, 1000]) {
      const glyphs = cellReliefGlyphs(cellId, SQUARE, 60, 'hill');
      expect(glyphs.length).toBeGreaterThan(0);
      expect(glyphs.length).toBeLessThanOrEqual(2);
    }
  });

  it('places every glyph inside the polygon', () => {
    for (const cellId of [3, 99, 1234, 500000]) {
      for (const band of ['peak', 'hill'] as const) {
        const glyphs = cellReliefGlyphs(cellId, SQUARE, 65, band);
        if (glyphs.length === 0) continue; // degenerate rejects all
        for (const g of glyphs) {
          expect(g.x).toBeGreaterThanOrEqual(10);
          expect(g.x).toBeLessThanOrEqual(30);
          expect(g.y).toBeGreaterThanOrEqual(10);
          expect(g.y).toBeLessThanOrEqual(30);
        }
      }
    }
  });

  it('size scales with height: s = 0.8 + (h - 50) / 50 * 1.2', () => {
    // At h=50: s = 0.8
    const low = cellReliefGlyphs(42, SQUARE, 50, 'hill');
    expect(low.length).toBeGreaterThan(0);
    expect(low[0].s).toBeCloseTo(0.8, 0.1);

    // At h=100: s = 0.8 + 50/50*1.2 = 0.8 + 1.2 = 2.0
    const high = cellReliefGlyphs(42, SQUARE, 100, 'peak');
    expect(high.length).toBeGreaterThan(0);
    expect(high[0].s).toBeCloseTo(2.0, 0.1);

    // Middle (h=75): s = 0.8 + 25/50*1.2 = 0.8 + 0.6 = 1.4
    const mid = cellReliefGlyphs(42, SQUARE, 75, 'peak');
    expect(mid.length).toBeGreaterThan(0);
    expect(mid[0].s).toBeCloseTo(1.4, 0.1);
  });

  it('snowTip = true only when band === "peak" AND h >= SNOW_TIP_MIN_H (80)', () => {
    // peak + h=80: snowTip = true
    const peak80 = cellReliefGlyphs(42, SQUARE, 80, 'peak');
    expect(peak80[0].snowTip).toBe(true);

    // peak + h=79: snowTip = false
    const peak79 = cellReliefGlyphs(42, SQUARE, 79, 'peak');
    expect(peak79[0].snowTip).toBe(false);

    // peak + h=70: snowTip = false
    const peak70 = cellReliefGlyphs(42, SQUARE, 70, 'peak');
    expect(peak70[0].snowTip).toBe(false);

    // hill + h=100: snowTip = false (hills never have snow tips)
    const hill100 = cellReliefGlyphs(42, SQUARE, 100, 'hill');
    for (const g of hill100) {
      expect(g.snowTip).toBe(false);
    }

    // hill + h=50: snowTip = false
    const hill50 = cellReliefGlyphs(42, SQUARE, 50, 'hill');
    for (const g of hill50) {
      expect(g.snowTip).toBe(false);
    }
  });

  it('band property matches the input band', () => {
    const peaks = cellReliefGlyphs(42, SQUARE, 75, 'peak');
    for (const g of peaks) {
      expect(g.band).toBe('peak');
    }

    const hills = cellReliefGlyphs(42, SQUARE, 60, 'hill');
    for (const g of hills) {
      expect(g.band).toBe('hill');
    }
  });

  it('a degenerate polygon that rejects every sample returns fewer (zero) glyphs without hanging', () => {
    const line: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [0, 0],
    ];
    expect(cellReliefGlyphs(5, line, 75, 'peak')).toEqual([]);
  });

  it('returns [] for a polygon with < 3 vertices', () => {
    const twoPoint: Array<[number, number]> = [
      [0, 0],
      [10, 0],
    ];
    expect(cellReliefGlyphs(5, twoPoint, 75, 'peak')).toEqual([]);
  });
});

describe('reliefGlyphPath', () => {
  it('peak returns a path starting with M (absolute moveto)', () => {
    const d = reliefGlyphPath('peak', 12, 34, 1, false);
    expect(d.startsWith('M')).toBe(true);
  });

  it('hill returns a path starting with M', () => {
    const d = reliefGlyphPath('hill', 12, 34, 1, false);
    expect(d.startsWith('M')).toBe(true);
  });

  it('peak without snowTip contains three L (lineto) commands for the ∧ shape', () => {
    const d = reliefGlyphPath('peak', 0, 0, 1, false);
    const lineCount = (d.match(/L/g) ?? []).length;
    expect(lineCount).toBe(2); // M x0 L x1 L x2 = 2 line-tos
  });

  it('peak with snowTip contains an additional M...L...L sequence for the cap', () => {
    const noSnow = reliefGlyphPath('peak', 0, 0, 1, false);
    const withSnow = reliefGlyphPath('peak', 0, 0, 1, true);
    expect(withSnow.length).toBeGreaterThan(noSnow.length);
    // withSnow should have one M at the start, then M again for the cap.
    const moveCount = (withSnow.match(/M/g) ?? []).length;
    expect(moveCount).toBe(2); // initial peak M, then cap M
  });

  it('hill contains exactly one a (arc) command', () => {
    const d = reliefGlyphPath('hill', 0, 0, 1, false);
    const arcCount = (d.match(/a/g) ?? []).length;
    expect(arcCount).toBe(1);
  });

  it('parses as a Path2D-compatible command string (only known SVG ops)', () => {
    for (const band of ['peak', 'hill'] as const) {
      for (const snowTip of [false, true]) {
        const d = reliefGlyphPath(band, 0, 0, 1, snowTip);
        const ops = d.match(/[a-zA-Z]/g) ?? [];
        for (const op of ops) {
          expect('MLaZ'.includes(op)).toBe(true);
        }
      }
    }
  });

  it('scales with s: paths for different sizes differ', () => {
    const p1 = reliefGlyphPath('peak', 5, 5, 0.8, false);
    const p2 = reliefGlyphPath('peak', 5, 5, 1.2, false);
    expect(p1).not.toEqual(p2);

    const h1 = reliefGlyphPath('hill', 5, 5, 0.8, false);
    const h2 = reliefGlyphPath('hill', 5, 5, 1.2, false);
    expect(h1).not.toEqual(h2);
  });

  it('snowTip parameter only affects peak paths, not hills', () => {
    const hill1 = reliefGlyphPath('hill', 0, 0, 1, false);
    const hill2 = reliefGlyphPath('hill', 0, 0, 1, true);
    expect(hill1).toEqual(hill2);
  });

  it('peak path grows upward (negative y): apex has smaller y-coord than base', () => {
    // Peak base at y=0; apex at y-3.2*s
    const d = reliefGlyphPath('peak', 10, 0, 1, false);
    // Extract y values: look for negative numbers in the output
    expect(d).toContain('-3.2'); // apex is at y - 3.2*s, which is negative
  });

  it('hill path is a single arc from left to right at base y', () => {
    const d = reliefGlyphPath('hill', 20, 15, 1, false);
    // Should contain arc rx, ry, rotation, large-arc, sweep, dx, dy
    // a1.6 1.1 0 0 1 3.2 0
    expect(d).toContain('a');
    expect(d).not.toContain('L'); // no line segments in hill
  });
});

describe('reliefInk', () => {
  it('peak returns dark ink #3d3833', () => {
    expect(reliefInk('peak')).toBe('#3d3833');
  });

  it('hill returns softer grey-brown #5a5248', () => {
    expect(reliefInk('hill')).toBe('#5a5248');
  });

  it('always returns a valid hex color string', () => {
    for (const band of ['peak', 'hill'] as const) {
      const ink = reliefInk(band);
      expect(ink).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('integration: cellReliefGlyphs + reliefGlyphPath + reliefInk', () => {
  it('glyphs can be rendered: all have valid paths and colors', () => {
    for (const band of ['peak', 'hill'] as const) {
      const glyphs = cellReliefGlyphs(99, SQUARE, 75, band);
      if (glyphs.length === 0) continue;
      const color = reliefInk(band);
      for (const g of glyphs) {
        const path = reliefGlyphPath(g.band, g.x, g.y, g.s, g.snowTip);
        expect(path.length).toBeGreaterThan(0);
        expect(path.startsWith('M')).toBe(true);
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('all glyphs from a cell have the same band and ink', () => {
    for (const band of ['peak', 'hill'] as const) {
      const glyphs = cellReliefGlyphs(42, SQUARE, 65, band);
      if (glyphs.length === 0) continue;
      const ink = reliefInk(band);
      for (const g of glyphs) {
        expect(g.band).toBe(band);
        expect(reliefInk(g.band)).toBe(ink);
      }
    }
  });

  it('tall peaks with snow look different from short peaks (deterministic variation on h)', () => {
    const short = cellReliefGlyphs(42, SQUARE, 70, 'peak');
    const tall = cellReliefGlyphs(42, SQUARE, 95, 'peak');
    expect(short.length).toBe(1);
    expect(tall.length).toBe(1);
    // Size should differ
    expect(short[0].s).not.toEqual(tall[0].s);
    // Snow tip only on tall
    expect(short[0].snowTip).toBe(false);
    expect(tall[0].snowTip).toBe(true);
    // Paths are different
    const shortPath = reliefGlyphPath('peak', short[0].x, short[0].y, short[0].s, short[0].snowTip);
    const tallPath = reliefGlyphPath('peak', tall[0].x, tall[0].y, tall[0].s, tall[0].snowTip);
    expect(shortPath).not.toEqual(tallPath);
  });
});
