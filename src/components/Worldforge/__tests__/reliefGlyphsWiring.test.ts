/**
 * Mountains campaign Task 9 — relief-glyph + pass-mark MODEL wiring.
 *
 * The pure builders that both renderers consume: buildReliefGlyphs stamps a
 * per-cell path for EVERY land cell whose height falls in a relief band
 * (height-truth, not range-gated), carrying the band ink key and a SEPARATE
 * white snowcap sub-path only for h >= 80 peaks. buildPassMarks anchors a
 * paired-chevron at each pack pass cell. reliefGlyphRampOpacity mirrors the
 * forest ramp on the mountain zoom knobs.
 */
import { describe, it, expect } from 'vitest';
import {
  buildReliefGlyphs,
  buildPassMarks,
  reliefGlyphRampOpacity,
  passMarkPath,
  buildAtlasSvgModel,
  RELIEF_GLYPH_LAYER_OPACITY,
} from '../atlasSvg';
import { reliefGlyphPath, reliefGlyphCapPath } from '../mountainGlyphs';
import {
  MOUNTAIN_GLYPH_MIN_ZOOM,
  MOUNTAIN_GLYPH_FULL_ZOOM,
} from '../../../systems/worldforge/mountains/mountainTunables';

/**
 * Four 20×20 square cells in a row: cell0 water (h10, skipped), cell1 hill
 * (h50), cell2 peak (h75, no snow), cell3 snow-capped peak (h85). The relief
 * layer is height-truth: it never reads pack.ranges, so a bare pack stamps.
 */
function reliefStubAtlas(): any {
  return {
    graphWidth: 100,
    graphHeight: 100,
    biomesData: { color: ['#001122', '#11aa33', '#cccccc'] },
    pack: {
      vertices: {
        p: [
          [0, 0], [20, 0], [20, 20], [0, 20],
          [40, 0], [40, 20], [60, 0], [60, 20],
          [80, 0], [80, 20],
        ],
      },
      cells: {
        h: [10, 50, 75, 85],
        v: [[0, 1, 2, 3], [1, 4, 5, 2], [4, 6, 7, 5], [6, 8, 9, 7]],
        biome: [0, 1, 2, 2],
        p: [[10, 10], [30, 10], [50, 10], [70, 10]],
      },
    },
  };
}

describe('buildReliefGlyphs', () => {
  it('emits one entry per LAND cell in a relief band (h>=50), skipping water and lowland', () => {
    const out = buildReliefGlyphs(reliefStubAtlas());
    expect(out).toHaveLength(3); // cells 1,2,3 — cell 0 (h10) excluded
    for (const c of out) {
      expect(c.d.length).toBeGreaterThan(0);
      expect(c.d.startsWith('M')).toBe(true);
    }
  });

  it('carries the correct band per cell (hill for 50<=h<70, peak for h>=70)', () => {
    const out = buildReliefGlyphs(reliefStubAtlas());
    expect(out.map((c) => c.band)).toEqual(['hill', 'peak', 'peak']);
  });

  it('fills snowD ONLY for peaks at/above the snow-tip line (h>=80)', () => {
    const out = buildReliefGlyphs(reliefStubAtlas());
    // cell1 hill, cell2 peak h75 → no snow; cell3 peak h85 → snow.
    expect(out[0].snowD).toBe('');
    expect(out[1].snowD).toBe('');
    expect(out[2].snowD.length).toBeGreaterThan(0);
    expect(out[2].snowD.startsWith('M')).toBe(true);
  });

  it("the main d never contains the snowcap sub-path (that lives only in snowD)", () => {
    const out = buildReliefGlyphs(reliefStubAtlas());
    const snowPeak = out[2];
    // The cap segment (snowD) must not be a substring of the stroked d — the
    // renderer strokes d dark and snowD white; double-inking the cap is the bug
    // this clean split avoids.
    expect(snowPeak.d.includes(snowPeak.snowD)).toBe(false);
  });

  it('is deterministic: same atlas shape → deep-equal output', () => {
    expect(buildReliefGlyphs(reliefStubAtlas())).toEqual(buildReliefGlyphs(reliefStubAtlas()));
  });

  it('returns [] for an all-lowland atlas (no cell reaches the hill band)', () => {
    const flat = reliefStubAtlas();
    flat.pack.cells.h = [10, 25, 30, 40];
    expect(buildReliefGlyphs(flat)).toEqual([]);
  });

  it('skips cells with degenerate polygons instead of emitting empty paths', () => {
    const a = reliefStubAtlas();
    a.pack.cells.v[1] = [0, 1]; // hill cell ring collapses (< 3 vertices)
    const out = buildReliefGlyphs(a);
    expect(out).toHaveLength(2); // only the two peaks stamp
    expect(out.map((c) => c.band)).toEqual(['peak', 'peak']);
  });

  it('folds into buildAtlasSvgModel as model.reliefGlyphs', () => {
    const model = buildAtlasSvgModel(reliefStubAtlas());
    expect(model.reliefGlyphs).toHaveLength(3);
    expect(model.reliefGlyphs!.map((c) => c.band)).toEqual(['hill', 'peak', 'peak']);
  });
});

describe('buildPassMarks', () => {
  it('anchors one mark at each pass cell site (pack.cells.p[cellId])', () => {
    const atlas = reliefStubAtlas();
    atlas.pack.passes = [
      { i: 1, rangeI: 1, cellId: 2, name: 'A Pass', routeIds: [0] },
      { i: 2, rangeI: 1, cellId: 3, name: 'B Col', routeIds: [1] },
    ];
    const marks = buildPassMarks(atlas);
    expect(marks).toEqual([{ x: 50, y: 10 }, { x: 70, y: 10 }]);
  });

  it('returns [] when the pack carries no passes (pre-mountains packs unchanged)', () => {
    expect(buildPassMarks(reliefStubAtlas())).toEqual([]);
    const empty = reliefStubAtlas();
    empty.pack.passes = [];
    expect(buildPassMarks(empty)).toEqual([]);
  });

  it('skips a pass whose cell site is missing rather than emitting NaN', () => {
    const atlas = reliefStubAtlas();
    atlas.pack.passes = [{ i: 1, rangeI: 1, cellId: 99, name: 'X', routeIds: [] }];
    expect(buildPassMarks(atlas)).toEqual([]);
  });

  it('folds into buildAtlasSvgModel as model.passMarks', () => {
    const atlas = reliefStubAtlas();
    atlas.pack.passes = [{ i: 1, rangeI: 1, cellId: 1, name: 'P', routeIds: [0] }];
    const model = buildAtlasSvgModel(atlas);
    expect(model.passMarks).toEqual([{ x: 30, y: 10 }]);
  });
});

describe('passMarkPath', () => {
  it('draws two chevrons (a paired ‹ › flanking the point): exactly two moveto sub-paths', () => {
    const d = passMarkPath(50, 10);
    expect(d.startsWith('M')).toBe(true);
    expect((d.match(/M/g) ?? []).length).toBe(2);
  });

  it('uses only straight-line ops (M/L) — no fills or arcs', () => {
    const d = passMarkPath(0, 0);
    for (const op of d.match(/[a-zA-Z]/g) ?? []) {
      expect('ML'.includes(op)).toBe(true);
    }
  });

  it('scales with size: a bigger mark yields a different path', () => {
    expect(passMarkPath(5, 5, 2)).not.toEqual(passMarkPath(5, 5, 4));
  });

  it('is symmetric about the anchor: left and right chevrons flank x', () => {
    // Left chevron vertex sits left of x; right chevron vertex sits right of x.
    const d = passMarkPath(50, 10, 2);
    expect(d).toContain('46'); // x - gap - arm = 50 - 2 - 2
    expect(d).toContain('54'); // x + gap + arm = 50 + 2 + 2
  });
});

describe('reliefGlyphRampOpacity', () => {
  it('is 0 below MOUNTAIN_GLYPH_MIN_ZOOM (map stays clean when far out)', () => {
    expect(reliefGlyphRampOpacity(MOUNTAIN_GLYPH_MIN_ZOOM - 0.01)).toBe(0);
    expect(reliefGlyphRampOpacity(0)).toBe(0);
  });

  it('reaches the full layer opacity at MOUNTAIN_GLYPH_FULL_ZOOM and beyond', () => {
    expect(reliefGlyphRampOpacity(MOUNTAIN_GLYPH_FULL_ZOOM)).toBe(RELIEF_GLYPH_LAYER_OPACITY);
    expect(reliefGlyphRampOpacity(MOUNTAIN_GLYPH_FULL_ZOOM + 5)).toBe(RELIEF_GLYPH_LAYER_OPACITY);
  });

  it('lerps linearly between MIN and FULL', () => {
    const mid = (MOUNTAIN_GLYPH_MIN_ZOOM + MOUNTAIN_GLYPH_FULL_ZOOM) / 2;
    expect(reliefGlyphRampOpacity(mid)).toBeCloseTo(RELIEF_GLYPH_LAYER_OPACITY / 2, 10);
  });

  it('answers 0 for a degenerate (NaN) zoom instead of leaking NaN into CSS', () => {
    expect(reliefGlyphRampOpacity(Number.NaN)).toBe(0);
  });
});

describe('reliefGlyphCapPath (clean snowcap split)', () => {
  it('returns just the cap sub-path, starting with M', () => {
    const cap = reliefGlyphCapPath(0, 0, 1);
    expect(cap.startsWith('M')).toBe(true);
    expect((cap.match(/M/g) ?? []).length).toBe(1);
  });

  it('a snow-tipped peak path == the plain peak path + the cap path (byte-identical)', () => {
    for (const [x, y, s] of [[0, 0, 1], [12, 34, 1.5], [-3, 7, 0.8]] as const) {
      expect(reliefGlyphPath('peak', x, y, s, true)).toBe(
        reliefGlyphPath('peak', x, y, s, false) + reliefGlyphCapPath(x, y, s),
      );
    }
  });
});
