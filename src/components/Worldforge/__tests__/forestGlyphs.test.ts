import { describe, it, expect } from 'vitest';
import { cellGlyphs, glyphPath, forestTint, type GlyphKind } from '../forestGlyphs';
import {
  buildAtlasSvgModel,
  buildForestGlyphs,
  forestGlyphRampOpacity,
  FOREST_GLYPH_LAYER_OPACITY,
} from '../atlasSvg';
import { Biomes } from '../../../systems/worldforge/fmg/biomes';
import {
  GLYPH_MAX_PER_CELL,
  GLYPH_MIN_ZOOM,
  GLYPH_FULL_ZOOM,
  FOREST_TINTS,
} from '../../../systems/worldforge/forests/forestTunables';

/** Square cell polygon: any point in its bbox is inside, so rejection
 * sampling never starves and inside-ness is checkable with plain bounds. */
const SQUARE: Array<[number, number]> = [
  [10, 10],
  [30, 10],
  [30, 30],
  [10, 30],
];

const ALL_KINDS: GlyphKind[] = [
  'deciduous',
  'conifer',
  'acacia',
  'palm',
  'swamp',
  'dune',
  'cactus',
  'deadTree',
  'grass',
];

const biomesData = Biomes.getDefault();

describe('cellGlyphs', () => {
  it('is deterministic: identical inputs produce deep-equal glyph lists', () => {
    const a = cellGlyphs(42, SQUARE, 6, biomesData, null);
    const b = cellGlyphs(42, SQUARE, 6, biomesData, null);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it('different cell ids give different layouts (hash actually varies)', () => {
    const a = cellGlyphs(1, SQUARE, 6, biomesData, null);
    const b = cellGlyphs(2, SQUARE, 6, biomesData, null);
    expect(a.map((g) => [g.x, g.y])).not.toEqual(b.map((g) => [g.x, g.y]));
  });

  it('count scales with iconsDensity and caps at GLYPH_MAX_PER_CELL', () => {
    // Real FMG table: taiga 100 < deciduous 120 < wetland 250 (capped).
    const taiga = cellGlyphs(7, SQUARE, 9, biomesData, null);
    const deciduous = cellGlyphs(7, SQUARE, 6, biomesData, null);
    const wetland = cellGlyphs(7, SQUARE, 12, biomesData, null);
    expect(deciduous.length).toBeGreaterThanOrEqual(taiga.length);
    expect(wetland.length).toBeGreaterThanOrEqual(deciduous.length);
    expect(wetland.length).toBe(GLYPH_MAX_PER_CELL);
    for (const list of [taiga, deciduous, wetland]) {
      expect(list.length).toBeLessThanOrEqual(GLYPH_MAX_PER_CELL);
    }
  });

  it('returns [] for zero-density biomes (Marine, Glacier)', () => {
    expect(cellGlyphs(7, SQUARE, 0, biomesData, null)).toEqual([]);
    expect(cellGlyphs(7, SQUARE, 11, biomesData, null)).toEqual([]);
  });

  it('returns [] when the biome icon list is empty even if density is high', () => {
    const synthetic = { iconsDensity: [270], icons: [[]] as string[][] };
    expect(cellGlyphs(7, SQUARE, 0, synthetic, null)).toEqual([]);
  });

  it('places every glyph inside the polygon with a sane size jitter', () => {
    for (const cellId of [3, 99, 1234, 500000]) {
      const glyphs = cellGlyphs(cellId, SQUARE, 12, biomesData, null);
      expect(glyphs.length).toBeGreaterThan(0);
      for (const g of glyphs) {
        expect(g.x).toBeGreaterThanOrEqual(10);
        expect(g.x).toBeLessThanOrEqual(30);
        expect(g.y).toBeGreaterThanOrEqual(10);
        expect(g.y).toBeLessThanOrEqual(30);
        expect(g.s).toBeGreaterThanOrEqual(0.8);
        expect(g.s).toBeLessThanOrEqual(1.2);
      }
    }
  });

  it('picks glyph kinds from the biome vocabulary', () => {
    // Temperate rainforest (8): deciduous ×6 + swamp ×1.
    const glyphs = cellGlyphs(21, SQUARE, 8, biomesData, null);
    expect(glyphs.length).toBeGreaterThan(0);
    for (const g of glyphs) {
      expect(['deciduous', 'swamp']).toContain(g.g);
    }
    // Taiga (9): conifer only.
    for (const g of cellGlyphs(21, SQUARE, 9, biomesData, null)) {
      expect(g.g).toBe('conifer');
    }
  });

  it('a degenerate polygon that rejects every sample returns fewer (zero) glyphs without hanging', () => {
    const line: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [0, 0],
    ];
    expect(cellGlyphs(5, line, 6, biomesData, null)).toEqual([]);
  });

  it('output is a pure function of cellId + poly + tables, not of forest kind', () => {
    const plain = cellGlyphs(11, SQUARE, 6, biomesData, null);
    const fey = cellGlyphs(11, SQUARE, 6, biomesData, 'fey');
    expect(plain).toEqual(fey);
  });
});

describe('glyphPath', () => {
  it('every glyph kind yields a non-empty SVG path anchored via absolute moveto', () => {
    for (const kind of ALL_KINDS) {
      const d = glyphPath(kind, 12, 34, 1);
      expect(d.length).toBeGreaterThan(0);
      expect(d.startsWith('M')).toBe(true);
    }
  });

  it('scales with s: paths for different sizes differ', () => {
    for (const kind of ALL_KINDS) {
      expect(glyphPath(kind, 5, 5, 0.8)).not.toEqual(glyphPath(kind, 5, 5, 1.2));
    }
  });

  it('parses as a Path2D-compatible command string (only known SVG ops)', () => {
    for (const kind of ALL_KINDS) {
      const d = glyphPath(kind, 0, 0, 1);
      // Letters used must be drawable SVG path commands.
      const ops = d.match(/[a-zA-Z]/g) ?? [];
      for (const op of ops) {
        expect('MLaZ'.includes(op)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Task 6: model builder (atlasSvg.buildForestGlyphs) + zoom ramp
// ---------------------------------------------------------------------------

/**
 * Stub atlas: three 20×20 square land cells in a row, all temperate deciduous
 * forest (biome 6, iconsDensity 120 → glyphs guaranteed). Cells 0+1 belong to
 * one named forest; cell 2 is forest BIOME but no named forest (anonymous
 * copse) — it must get NO glyph entry.
 */
function forestStubAtlas(kind: string): any {
  return {
    graphWidth: 100,
    graphHeight: 100,
    biomesData: Biomes.getDefault(),
    pack: {
      vertices: { p: [[0, 0], [20, 0], [20, 20], [0, 20], [40, 0], [40, 20], [60, 0], [60, 20]] },
      cells: {
        h: [50, 50, 50],
        v: [[0, 1, 2, 3], [1, 4, 5, 2], [4, 6, 7, 5]],
        biome: [6, 6, 6],
        p: [[10, 10], [30, 10], [50, 10]],
      },
      forests: [{ i: 1, name: 'Testwood', kind, cells: [0, 1], pole: [20, 10] }],
    },
  };
}

describe('buildForestGlyphs', () => {
  it('emits ONE entry per forest cell with all its glyph paths concatenated', () => {
    const out = buildForestGlyphs(forestStubAtlas('ordinary'));
    expect(out).toHaveLength(2); // cells 0+1 only — copse cell 2 excluded
    for (const cell of out) {
      expect(cell.d.length).toBeGreaterThan(0);
      expect(cell.d.startsWith('M')).toBe(true);
      expect(cell.tint).toBeNull(); // ordinary keeps the plain biome color
    }
  });

  it('tints every cell of a haunted forest with the kind hex', () => {
    const out = buildForestGlyphs(forestStubAtlas('haunted'));
    expect(out).toHaveLength(2);
    for (const cell of out) expect(cell.tint).toBe(FOREST_TINTS.haunted);
  });

  it('returns [] for an atlas with no pack.forests (pre-forests packs unchanged)', () => {
    const bare = forestStubAtlas('ordinary');
    delete bare.pack.forests;
    expect(buildForestGlyphs(bare)).toEqual([]);
    bare.pack.forests = [];
    expect(buildForestGlyphs(bare)).toEqual([]);
  });

  it('is deterministic: same atlas shape → deep-equal output', () => {
    expect(buildForestGlyphs(forestStubAtlas('fey'))).toEqual(buildForestGlyphs(forestStubAtlas('fey')));
  });

  it('skips forest cells with degenerate polygons instead of emitting empty paths', () => {
    const a = forestStubAtlas('ordinary');
    a.pack.cells.v[1] = [0, 1]; // cell 1 ring collapses (< 3 vertices)
    const out = buildForestGlyphs(a);
    expect(out).toHaveLength(1); // only cell 0 stamps
    expect(out[0].d.length).toBeGreaterThan(0);
  });

  it('folds into buildAtlasSvgModel as model.forestGlyphs', () => {
    const model = buildAtlasSvgModel(forestStubAtlas('haunted'));
    expect(model.forestGlyphs).toHaveLength(2);
    expect(model.forestGlyphs![0].tint).toBe(FOREST_TINTS.haunted);
  });

  it('model.forestGlyphs is empty for a no-forests atlas (existing fixtures unchanged)', () => {
    const bare = forestStubAtlas('ordinary');
    delete bare.pack.forests;
    expect(buildAtlasSvgModel(bare).forestGlyphs).toEqual([]);
  });
});

describe('forestGlyphRampOpacity', () => {
  it('is 0 below GLYPH_MIN_ZOOM (map stays clean when far out)', () => {
    expect(forestGlyphRampOpacity(GLYPH_MIN_ZOOM - 0.01)).toBe(0);
    expect(forestGlyphRampOpacity(0)).toBe(0);
  });

  it('reaches the full layer opacity at GLYPH_FULL_ZOOM and beyond', () => {
    expect(forestGlyphRampOpacity(GLYPH_FULL_ZOOM)).toBe(FOREST_GLYPH_LAYER_OPACITY);
    expect(forestGlyphRampOpacity(GLYPH_FULL_ZOOM + 5)).toBe(FOREST_GLYPH_LAYER_OPACITY);
  });

  it('lerps linearly between MIN and FULL', () => {
    const mid = (GLYPH_MIN_ZOOM + GLYPH_FULL_ZOOM) / 2;
    expect(forestGlyphRampOpacity(mid)).toBeCloseTo(FOREST_GLYPH_LAYER_OPACITY / 2, 10);
  });

  it('answers 0 for a degenerate (NaN) zoom instead of leaking NaN into CSS', () => {
    expect(forestGlyphRampOpacity(Number.NaN)).toBe(0);
  });
});

describe('forestTint', () => {
  it('maps special kinds to the tunable hexes', () => {
    expect(forestTint('ancient')).toBe('#1d6b38');
    expect(forestTint('haunted')).toBe('#4a5a4e');
    expect(forestTint('fey')).toBe('#37b06f');
    expect(forestTint('ancient')).toBe(FOREST_TINTS.ancient);
    expect(forestTint('haunted')).toBe(FOREST_TINTS.haunted);
    expect(forestTint('fey')).toBe(FOREST_TINTS.fey);
  });

  it('ordinary and null map to null (plain biome color)', () => {
    expect(forestTint('ordinary')).toBeNull();
    expect(forestTint(null)).toBeNull();
  });
});
