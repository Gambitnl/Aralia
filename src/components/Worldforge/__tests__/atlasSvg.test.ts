import { describe, it, expect } from 'vitest';
import {
  cellPolygonPoints,
  biomeFillForCell,
  buildAtlasSvgModel,
  buildMergedRegions,
  buildCellRamp,
  buildCellOutlines,
  buildPoiMarkers,
  buildIceCells,
  buildZoneCells,
  buildRegiments,
  oceanDepthDistance,
  buildRiverRibbon,
  buildBurgs,
  buildStateBorders,
  buildLabels,
  declutterLabels,
  findCellAtPoint,
  cellTraits,
} from '../atlasSvg';
import {
  FOREST_LABEL_FONT_MAX,
  FOREST_LABEL_FONT_MIN,
} from '../../../systems/worldforge/forests/forestTunables';
import {
  PEAK_LABEL_FONT,
  PEAK_LABEL_MIN_ZOOM,
  RANGE_LABEL_FONT_MAX,
  RANGE_LABEL_FONT_MIN,
  RANGE_LABEL_FULL_SIZE_CELLS,
  RANGE_LABEL_MIN_ZOOM,
  RANGE_MIN_CELLS,
} from '../../../systems/worldforge/mountains/mountainTunables';

// Minimal stub shaped like FmgAtlasResult (only fields the helpers read).
const stub = {
  graphWidth: 100,
  graphHeight: 100,
  biomesData: { color: ['#000000', '#11aa33', '#cccccc'] },
  pack: {
    vertices: { p: [[0, 0], [10, 0], [10, 10], [0, 10]] },
    cells: {
      h: [5, 50],            // cell 0 = water, cell 1 = land
      v: [[0, 1, 2], [0, 1, 2, 3]],
      biome: [0, 1],
    },
  },
} as any;

describe('atlasSvg helpers', () => {
  it('cellPolygonPoints joins vertex coords as "x,y" pairs', () => {
    expect(cellPolygonPoints(stub, 1)).toBe('0,0 10,0 10,10 0,10');
  });
  it('biomeFillForCell resolves the biome color', () => {
    expect(biomeFillForCell(stub, 1)).toBe('#11aa33');
  });
  it('biomeFillForCell falls back when color missing', () => {
    expect(biomeFillForCell(stub, 99)).toBe('#888888');
  });
});

describe('buildAtlasSvgModel', () => {
  it('emits an ocean layer and a merged land-region layer (T2: no per-cell polygons)', () => {
    const model = buildAtlasSvgModel(stub);
    expect(model.width).toBe(100);
    expect(model.height).toBe(100);
    const land = model.layers.find((l) => l.id === 'land');
    expect(land!.regions).toHaveLength(1);             // only cell 1 is land (h>=20)
    expect(land!.regions![0].fill).toBe('#11aa33');
    expect(land!.regions![0].d.startsWith('M')).toBe(true);
    expect(land!.regions![0].d.endsWith('Z')).toBe(true);
    expect(land!.polygons).toHaveLength(0);            // merged, not per-cell
    expect(model.coastline && model.coastline.startsWith('M')).toBe(true); // T3a coast path
    expect(model.layers.map((l) => l.id)).toEqual(['ocean', 'land']);
  });

  it('builds merged per-culture regions colored from pack.cultures (cultural overlay)', () => {
    const cultured = {
      ...stub,
      pack: {
        ...stub.pack,
        cells: { ...stub.pack.cells, culture: [0, 2] }, // land cell 1 → culture 2
        cultures: [
          { i: 0, name: 'Wildlands', color: '#000' },
          { i: 1, name: 'A', color: '#aa0000' },
          { i: 2, name: 'B', color: '#0000aa' },
        ],
      },
    } as any;
    const model = buildAtlasSvgModel(cultured);
    expect(model.cultureRegions).toHaveLength(1);            // only the land cell, culture>0
    expect(model.cultureRegions![0].fill).toBe('#0000aa');   // culture 2's color
  });

  it('emits no culture regions when the pack has no cultures', () => {
    expect(buildAtlasSvgModel(stub).cultureRegions).toEqual([]);
  });
});

describe('buildCellRamp + population/climate overlays', () => {
  // cells 0,1 land (h=50); cell 2 water (h=5). grid temp/prec via cells.g.
  const mesh = {
    graphWidth: 100, graphHeight: 100,
    biomesData: { color: ['#000000', '#111111'] },
    grid: { cells: { temp: [5, 9, 1], prec: [2, 8, 4] } },
    pack: {
      vertices: { p: [[0, 0], [10, 0], [10, 10], [0, 10]] },
      cells: {
        h: [50, 50, 5],
        v: [[0, 1, 2], [1, 2, 3], [2, 3, 0]],
        biome: [1, 1, 0],
        pop: [10, 30, 0],
        g: [0, 1, 2],
      },
    },
  } as any;

  it('normalizes land-cell values through the ramp and skips water', () => {
    const ramp = (t: number) => (t <= 0 ? '#aaaaaa' : t >= 1 ? '#bbbbbb' : '#cccccc');
    const out = buildCellRamp(mesh, (i) => [10, 30, 99][i], ramp);
    expect(out).toHaveLength(2);          // only the two land cells
    expect(out[0].fill).toBe('#aaaaaa');  // min value → t=0
    expect(out[1].fill).toBe('#bbbbbb');  // max value → t=1
    expect(out[0].points.length).toBeGreaterThan(0);
  });

  it('emits population/temperature/precipitation ramps from the pack + grid data', () => {
    const model = buildAtlasSvgModel(mesh);
    expect(model.populationCells!.length).toBe(2);   // pop>0 land cells
    expect(model.temperatureCells!.length).toBe(2);  // land cells, grid temp via .g
    expect(model.precipitationCells!.length).toBe(2);
  });

  it('emits empty ramps when the source arrays are absent', () => {
    const bare = {
      ...mesh,
      grid: undefined,
      pack: { ...mesh.pack, cells: { ...mesh.pack.cells, pop: undefined } },
    } as any;
    const model = buildAtlasSvgModel(bare);
    expect(model.populationCells).toEqual([]);
    expect(model.temperatureCells).toEqual([]);
    expect(model.precipitationCells).toEqual([]);
  });

  it('buildCellOutlines emits one points string per cell with geometry', () => {
    const out = buildCellOutlines(mesh);
    expect(out.length).toBe(3);               // all three cells have vertices
    expect(out[0].split(' ').length).toBe(3); // triangle: 3 vertex pairs
  });

  it('buildPoiMarkers maps pack.markers to their cell centroids; empty when absent', () => {
    expect(buildPoiMarkers(mesh)).toEqual([]); // mesh has no markers
    const withMarkers = {
      ...mesh,
      pack: {
        ...mesh.pack,
        cells: { ...mesh.pack.cells, p: [[1, 2], [3, 4], [5, 6]] },
        markers: [{ cell: 1, type: 'cave' }, { cell: 2, type: 'shrine' }],
      },
    } as any;
    const m = buildPoiMarkers(withMarkers);
    expect(m).toHaveLength(2);
    expect(m[0]).toEqual({ x: 3, y: 4, type: 'cave' });
  });

  it('buildIceCells fills cells colder than the threshold (glaciers/icebergs)', () => {
    // temps [5,9,1]; threshold 2 → only cell 2 (temp 1) qualifies.
    const ice = buildIceCells(mesh, 2);
    expect(ice).toHaveLength(1);
    expect(ice[0].fill).toBe('#dfeefa');
    expect(buildIceCells({ ...mesh, grid: undefined } as any)).toEqual([]);
  });

  it('buildZoneCells fills each zone\'s cells in its color; empty when absent', () => {
    expect(buildZoneCells(mesh)).toEqual([]); // no zones on mesh
    const withZones = {
      ...mesh,
      pack: { ...mesh.pack, zones: [{ cells: [0, 1], color: '#ff000080' }] },
    } as any;
    const z = buildZoneCells(withZones);
    expect(z).toHaveLength(2);
    expect(z[0].fill).toBe('#ff000080');
  });

  it('buildRegiments flattens state military into markers, flagging naval; empty when absent', () => {
    expect(buildRegiments(mesh)).toEqual([]); // no states
    const withMil = {
      ...mesh,
      pack: {
        ...mesh.pack,
        states: [
          { military: [{ x: 5, y: 6, n: 0 }, { x: 7, y: 8, n: 1 }] },
          { military: [{ x: 9, y: 1, n: 0 }] },
        ],
      },
    } as any;
    const r = buildRegiments(withMil);
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual({ x: 5, y: 6, type: 'land' });
    expect(r[1].type).toBe('naval');
  });
});

// Two unit squares sharing the vertical edge (10,0)-(10,10).
function pairMesh(biome: number[]) {
  return {
    graphWidth: 30,
    graphHeight: 10,
    biomesData: { color: ['#000', '#111', '#222', '#333', '#444', '#555', '#666', '#7a7a7a', '#888', '#9a9a9a'] },
    pack: {
      vertices: { p: [[0, 0], [10, 0], [10, 10], [0, 10], [20, 0], [20, 10]] },
      cells: {
        h: [50, 50],
        v: [[0, 1, 2, 3], [1, 4, 5, 2]],
        c: [[1], [0]],
        biome,
      },
    },
  } as any;
}
const landBiomeKey = (a: any) => (i: number) => (a.pack.cells.h[i] >= 20 ? a.pack.cells.biome[i] : null);
const biomeColor = (a: any) => (k: any) => a.biomesData.color[k] ?? '#888';

describe('buildMergedRegions', () => {
  it('merges two same-biome adjacent cells into ONE region (drops the shared edge)', () => {
    const a = pairMesh([7, 7]);
    const regs = buildMergedRegions(a, landBiomeKey(a), biomeColor(a));
    expect(regs).toHaveLength(1);
    expect(regs[0].fill).toBe('#7a7a7a');
    // The interior shared edge endpoints 10,0 and 10,10 must not both terminate
    // a subpath as an internal wall — the merged ring traces only outer vertices.
    expect((regs[0].d.match(/M/g) || []).length).toBe(1); // single outer ring
    expect(regs[0].d.endsWith('Z')).toBe(true);
  });

  it('keeps two different-biome adjacent cells as TWO regions', () => {
    const a = pairMesh([7, 9]);
    const regs = buildMergedRegions(a, landBiomeKey(a), biomeColor(a));
    expect(regs).toHaveLength(2);
  });
});

describe('oceanDepthDistance', () => {
  it('BFS rings from the coast: land=0, then increasing into water', () => {
    // chain: cell0 land — cell1 water — cell2 water
    const chain = {
      graphWidth: 30, graphHeight: 10, biomesData: { color: [] },
      pack: { vertices: { p: [] }, cells: { h: [50, 5, 5], c: [[1], [0, 2], [1]] } },
    } as any;
    expect(oceanDepthDistance(chain)).toEqual([0, 1, 2]);
  });
});

describe('buildRiverRibbon', () => {
  it('offsets a centerline into a closed ribbon (2 sides → 2N vertices)', () => {
    // straight horizontal river, half-width 1 each point
    const d = buildRiverRibbon([[0, 0], [10, 0], [20, 0]], [1, 1, 1]);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    // 3 left + 3 right points → M + 5 L joins
    expect((d.match(/L/g) || []).length).toBe(5);
    // horizontal centerline, perpendicular is vertical → offsets at y = ±1
    expect(d).toContain('0,1');   // left side of first point
    expect(d).toContain('0,-1');  // right side of first point
  });
  it('returns empty for degenerate (<2 point) centerlines', () => {
    expect(buildRiverRibbon([[0, 0]], [1])).toBe('');
  });
});

describe('buildBurgs', () => {
  it('filters out the id-0 placeholder and removed burgs; flags capitals', () => {
    const a = {
      pack: { cells: {}, burgs: [{ i: 0 }, { i: 1, x: 10, y: 20, capital: 1 }, { i: 2, x: 5, y: 5, removed: true }, { i: 3, x: 7, y: 8 }] },
    } as any;
    const b = buildBurgs(a);
    expect(b).toHaveLength(2);          // i:1 (capital) + i:3 (town); i:0 placeholder + i:2 removed dropped
    expect(b[0]).toEqual({ x: 10, y: 20, capital: true, tier: 'capital' });
    expect(b[1]).toEqual({ x: 7, y: 8, capital: false, tier: 'village' }); // no population → village
  });

  it('tiers non-capital burgs by population percentile (city / town / village)', () => {
    const burgs = [{ i: 0 }];
    // 10 non-capitals with populations 1..10 → top 15% city, next 35% town, rest village.
    for (let p = 1; p <= 10; p++) burgs.push({ i: p, x: p, y: p, population: p } as any);
    const b = buildBurgs({ pack: { cells: {}, burgs } } as any);
    const tierOf = (pop: number) => b.find((x) => x.x === pop)!.tier;
    expect(tierOf(10)).toBe('city');    // highest population
    expect(tierOf(6)).toBe('town');     // mid band
    expect(tierOf(1)).toBe('village');  // lowest population
  });
});

describe('buildStateBorders', () => {
  const meshWithState = (state: number[]) => ({
    pack: {
      vertices: { p: [[0, 0], [10, 0], [10, 10], [0, 10], [20, 0], [20, 10]] },
      cells: { h: [50, 50], v: [[0, 1, 2, 3], [1, 4, 5, 2]], c: [[1], [0]], state },
    },
  } as any);
  it('emits a border segment between two land cells of different states', () => {
    expect(buildStateBorders(meshWithState([1, 2])).startsWith('M')).toBe(true);
  });
  it('emits nothing when adjacent land cells share a state', () => {
    expect(buildStateBorders(meshWithState([1, 1]))).toBe('');
  });
});

describe('buildLabels', () => {
  it('emits state names (full name) + burg names with capital/town kinds', () => {
    const a = {
      pack: {
        cells: { p: [[1, 1], [2, 2]] },
        burgs: [{ i: 0 }, { i: 1, x: 5, y: 6, name: 'Burgton', capital: 1 }, { i: 2, x: 7, y: 8, name: 'Villa' }],
        states: [{ i: 0 }, { i: 1, name: 'Realm', fullName: 'Kingdom of Realm', pole: [3, 4] }],
      },
    } as any;
    const labels = buildLabels(a);
    expect(labels.filter((l) => l.kind === 'capital')).toHaveLength(1);
    expect(labels.filter((l) => l.kind === 'town')).toHaveLength(1);
    const state = labels.find((l) => l.kind === 'state');
    expect(state?.text).toBe('Kingdom of Realm');
    // No pack.forests on this fixture → no forest labels (pre-forests packs unchanged).
    expect(labels.filter((l) => l.kind === 'forest')).toHaveLength(0);
  });
  it('emits forest names at their pole with the forest kind (forests campaign T4)', () => {
    const a = {
      pack: {
        cells: { p: [[1, 1]] },
        burgs: [],
        states: [],
        forests: [
          { i: 1, name: 'Angshire Wildwood', kind: 'ordinary', cells: [4, 5, 6, 7], pole: [12, 34] },
          { i: 2, name: 'Thornwold Murkwood', kind: 'haunted', cells: [9, 10, 11, 12], pole: [56, 78] },
        ],
      },
    } as any;
    const forests = buildLabels(a).filter((l) => l.kind === 'forest');
    // fontSize added by the area-scaled sizing ruling (2026-07-11): both
    // fixtures are 4-cell clusters = FOREST_MIN_CELLS, so the lerp sits at
    // its floor — FOREST_LABEL_FONT_MIN (9).
    expect(forests).toEqual([
      { x: 12, y: 34, text: 'Angshire Wildwood', kind: 'forest', fontSize: FOREST_LABEL_FONT_MIN },
      { x: 56, y: 78, text: 'Thornwold Murkwood', kind: 'forest', fontSize: FOREST_LABEL_FONT_MIN },
    ]);
  });
  it('scales forest label font by cluster area, capped at MAX (rulings 2026-07-11)', () => {
    const forestOf = (i: number, cellCount: number) => ({
      i,
      name: `Wood ${i}`,
      kind: 'ordinary',
      cells: Array.from({ length: cellCount }, (_, k) => k),
      pole: [i * 100, 10],
    });
    const a = {
      pack: {
        cells: { p: [] },
        burgs: [],
        states: [],
        forests: [
          forestOf(1, 4), //  = FOREST_MIN_CELLS          → t=0   → MIN (9)
          forestOf(2, 42), // midpoint of the 4..80 ramp  → t=0.5 → round(12.5) = 13
          forestOf(3, 80), //  = FULL_SIZE_CELLS          → t=1   → MAX (16)
          forestOf(4, 500), // beyond FULL_SIZE           → clamped at MAX (16)
        ],
      },
    } as any;
    const sizes = buildLabels(a)
      .filter((l) => l.kind === 'forest')
      .map((l) => l.fontSize);
    expect(sizes).toEqual([FOREST_LABEL_FONT_MIN, 13, FOREST_LABEL_FONT_MAX, FOREST_LABEL_FONT_MAX]);
  });
  it('leaves non-forest labels without a per-label fontSize (kind default applies)', () => {
    const a = {
      pack: {
        cells: { p: [[1, 1]] },
        burgs: [{ i: 0 }, { i: 1, x: 5, y: 6, name: 'Burgton', capital: 1 }, { i: 2, x: 7, y: 8, name: 'Villa' }],
        states: [{ i: 0 }, { i: 1, name: 'Realm', fullName: 'Kingdom of Realm', pole: [3, 4] }],
      },
    } as any;
    const labels = buildLabels(a);
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) expect(l.fontSize).toBeUndefined();
  });
  it('emits range names at their pole with the range kind, area-scaled MIN→MAX (mountains T3)', () => {
    const rangeOf = (i: number, cellCount: number) => ({
      i,
      name: `Range ${i}`,
      kind: 'range',
      cells: Array.from({ length: cellCount }, (_, k) => k),
      coreCells: [],
      pole: [i * 100, 20],
    });
    const a = {
      pack: {
        cells: { p: [] },
        burgs: [],
        states: [],
        ranges: [
          rangeOf(1, RANGE_MIN_CELLS), //             = RANGE_MIN_CELLS → t=0 → MIN (10)
          rangeOf(2, 33), // (33−5)/55 ≈ 0.509 on the 5..60 ramp → round(14.07) = 14
          rangeOf(3, RANGE_LABEL_FULL_SIZE_CELLS), // = FULL_SIZE      → t=1 → MAX (18)
          rangeOf(4, 400), //                    beyond FULL_SIZE → clamped at MAX (18)
        ],
      },
    } as any;
    const ranges = buildLabels(a).filter((l) => l.kind === 'range');
    expect(ranges.map(({ x, y, text }) => ({ x, y, text }))).toEqual([
      { x: 100, y: 20, text: 'Range 1' },
      { x: 200, y: 20, text: 'Range 2' },
      { x: 300, y: 20, text: 'Range 3' },
      { x: 400, y: 20, text: 'Range 4' },
    ]);
    expect(ranges.map((l) => l.fontSize)).toEqual(
      [RANGE_LABEL_FONT_MIN, 14, RANGE_LABEL_FONT_MAX, RANGE_LABEL_FONT_MAX]);
  });
  it('emits peak labels at their cell point with a ▲ prefix and flat font (mountains T3)', () => {
    const a = {
      pack: {
        cells: { p: [[0, 0], [10, 20], [30, 40]] },
        burgs: [],
        states: [],
        ranges: [],
        peaks: [
          { i: 1, rangeI: 1, cellId: 1, h: 78, name: 'Mount Elden' },
          { i: 2, rangeI: 1, cellId: 2, h: 74, name: 'Elden Horn' },
        ],
      },
    } as any;
    const peaks = buildLabels(a).filter((l) => l.kind === 'peak');
    expect(peaks).toEqual([
      { x: 10, y: 20, text: '▲ Mount Elden', kind: 'peak' },
      { x: 30, y: 40, text: '▲ Elden Horn', kind: 'peak' },
    ]);
    // Flat PEAK_LABEL_FONT comes from the kind default — no per-label override.
    for (const p of peaks) expect(p.fontSize).toBeUndefined();
  });
  it('emits no range or peak labels when the pack has no mountains data (pre-mountains packs unchanged)', () => {
    const a = {
      pack: {
        cells: { p: [[1, 1]] },
        burgs: [{ i: 0 }, { i: 1, x: 5, y: 6, name: 'Burgton', capital: 1 }],
        states: [],
      },
    } as any;
    const labels = buildLabels(a);
    expect(labels.filter((l) => l.kind === 'range' || l.kind === 'peak')).toHaveLength(0);
  });
});

describe('declutterLabels', () => {
  const labels = [
    { x: 0, y: 0, text: 'A', kind: 'state' as const },
    { x: 0, y: 0, text: 'B', kind: 'capital' as const }, // same spot as A
    { x: 100, y: 100, text: 'C', kind: 'town' as const },
  ];
  it('at k=1 shows only state labels (capitals/towns below zoom threshold)', () => {
    expect(declutterLabels(labels, { k: 1, x: 0, y: 0 }).map((l) => l.text)).toEqual(['A']);
  });
  it('at high zoom drops the overlapping lower-priority label, keeps the distant one', () => {
    const r = declutterLabels(labels, { k: 3, x: 0, y: 0 }).map((l) => l.text).sort();
    expect(r).toEqual(['A', 'C']); // B overlaps A (state wins), C is far away
  });
  it('hides forest labels below the 1.5 zoom threshold and shows them at k >= 1.5', () => {
    const forest = [{ x: 100, y: 100, text: 'Angshire Wildwood', kind: 'forest' as const }];
    expect(declutterLabels(forest, { k: 1.4, x: 0, y: 0 })).toHaveLength(0);
    expect(declutterLabels(forest, { k: 1.5, x: 0, y: 0 }).map((l) => l.text)).toEqual(['Angshire Wildwood']);
  });
  it('honors a forestMinScale override (same pattern as capitalMinScale)', () => {
    const forest = [{ x: 100, y: 100, text: 'Angshire Wildwood', kind: 'forest' as const }];
    expect(declutterLabels(forest, { k: 1.5, x: 0, y: 0 }, { forestMinScale: 3 })).toHaveLength(0);
    expect(declutterLabels(forest, { k: 3, x: 0, y: 0 }, { forestMinScale: 3 })).toHaveLength(1);
  });
  it('drops the forest label when it collides with a state label (state wins)', () => {
    // Forest priority moved 3 → 4 when mountain ranges took 3 (mountains T3,
    // rulings 2026-07-11); state (0) still outranks it, so this pin's intent
    // — civilization claims space before woods — is unchanged.
    const contested = [
      { x: 0, y: 0, text: 'Wildwood', kind: 'forest' as const }, // listed first, still loses
      { x: 0, y: 0, text: 'Realm', kind: 'state' as const },
    ];
    expect(declutterLabels(contested, { k: 2, x: 0, y: 0 }).map((l) => l.text)).toEqual(['Realm']);
  });
  it('hides range labels below RANGE_LABEL_MIN_ZOOM and shows them at k >= it (mountains T3)', () => {
    const range = [{ x: 100, y: 100, text: 'Elden Spine', kind: 'range' as const }];
    expect(declutterLabels(range, { k: RANGE_LABEL_MIN_ZOOM - 0.05, x: 0, y: 0 })).toHaveLength(0);
    expect(declutterLabels(range, { k: RANGE_LABEL_MIN_ZOOM, x: 0, y: 0 }).map((l) => l.text))
      .toEqual(['Elden Spine']);
  });
  it('honors a rangeMinScale override (the forestMinScale pattern)', () => {
    const range = [{ x: 100, y: 100, text: 'Elden Spine', kind: 'range' as const }];
    expect(declutterLabels(range, { k: 2, x: 0, y: 0 }, { rangeMinScale: 3 })).toHaveLength(0);
    expect(declutterLabels(range, { k: 3, x: 0, y: 0 }, { rangeMinScale: 3 })).toHaveLength(1);
  });
  it('hides peak labels below PEAK_LABEL_MIN_ZOOM (2.2) and shows them past it', () => {
    const peak = [{ x: 100, y: 100, text: '▲ Mount Elden', kind: 'peak' as const }];
    expect(declutterLabels(peak, { k: PEAK_LABEL_MIN_ZOOM - 0.1, x: 0, y: 0 })).toHaveLength(0);
    expect(declutterLabels(peak, { k: PEAK_LABEL_MIN_ZOOM, x: 0, y: 0 }).map((l) => l.text))
      .toEqual(['▲ Mount Elden']);
  });
  it('honors a peakMinScale override', () => {
    const peak = [{ x: 100, y: 100, text: '▲ Mount Elden', kind: 'peak' as const }];
    expect(declutterLabels(peak, { k: PEAK_LABEL_MIN_ZOOM, x: 0, y: 0 }, { peakMinScale: 4 })).toHaveLength(0);
    expect(declutterLabels(peak, { k: 4, x: 0, y: 0 }, { peakMinScale: 4 })).toHaveLength(1);
  });
  it('gives placed peak labels the flat PEAK_LABEL_FONT kind default', () => {
    const placed = declutterLabels(
      [{ x: 0, y: 0, text: '▲ Mount Elden', kind: 'peak' as const }],
      { k: 3, x: 0, y: 0 },
    );
    expect(placed[0].fontSize).toBe(PEAK_LABEL_FONT);
  });
  it('priority ladder (mountains T3): town beats range, range beats forest, forest beats peak', () => {
    // k=3 clears every zoom gate. Lower rank claims space first: state 0 <
    // capital 1 < town 2 < range 3 < forest 4 (moved from 3) < peak 5.
    // Town renders 15px below its anchor, so the range anchor sits 2 map-px
    // (6 screen-px) lower to make the two collision boxes actually meet.
    const townVsRange = [
      { x: 0, y: 2, text: 'Elden Spine', kind: 'range' as const }, // listed first, still loses
      { x: 0, y: 0, text: 'Villa', kind: 'town' as const },
    ];
    expect(declutterLabels(townVsRange, { k: 3, x: 0, y: 0 }).map((l) => l.text)).toEqual(['Villa']);
    const rangeVsForest = [
      { x: 0, y: 0, text: 'Wildwood', kind: 'forest' as const }, // listed first, still loses
      { x: 0, y: 0, text: 'Elden Spine', kind: 'range' as const },
    ];
    expect(declutterLabels(rangeVsForest, { k: 3, x: 0, y: 0 }).map((l) => l.text)).toEqual(['Elden Spine']);
    const forestVsPeak = [
      { x: 0, y: 0, text: '▲ Elden Horn', kind: 'peak' as const }, // listed first, still loses
      { x: 0, y: 0, text: 'Wildwood', kind: 'forest' as const },
    ];
    expect(declutterLabels(forestVsPeak, { k: 3, x: 0, y: 0 }).map((l) => l.text)).toEqual(['Wildwood']);
  });
  it('honors a label budget so cramped maps do not fill with state names', () => {
    const crowdedStateLabels = [
      { x: 0, y: 0, text: 'North Realm', kind: 'state' as const },
      { x: 500, y: 0, text: 'South Realm', kind: 'state' as const },
      { x: 1000, y: 0, text: 'East Realm', kind: 'state' as const },
      { x: 1500, y: 0, text: 'West Realm', kind: 'state' as const },
    ];

    expect(
      declutterLabels(crowdedStateLabels, { k: 1, x: 0, y: 0 }, { maxLabels: 2 }).map((l) => l.text),
    ).toHaveLength(2);
  });
  it('carries a per-label fontSize onto the placed label; absent falls back to the kind default', () => {
    const sized = declutterLabels(
      [{ x: 0, y: 0, text: 'Elderwood', kind: 'forest' as const, fontSize: 15 }],
      { k: 2, x: 0, y: 0 },
    );
    expect(sized[0].fontSize).toBe(15);
    const fallback = declutterLabels(
      [{ x: 0, y: 0, text: 'Elderwood', kind: 'forest' as const }],
      { k: 2, x: 0, y: 0 },
    );
    expect(fallback[0].fontSize).toBe(FOREST_LABEL_FONT_MIN); // LABEL_FONT.forest
  });
  it('sizes the collision box from the per-label fontSize (big fonts claim more room)', () => {
    // Two 8-char forest labels whose screen anchors sit 50px apart (k=2).
    // At the 9px kind default each box spans ±(8*9*0.55/2 + pad) ≈ ±21.8px —
    // clear of each other — but at 16px it spans ±37.2px and they collide,
    // so the second label must drop.
    const pair = (fontSize?: number) => [
      { x: 0, y: 0, text: 'Wildwood', kind: 'forest' as const, ...(fontSize ? { fontSize } : {}) },
      { x: 25, y: 0, text: 'Wildwood', kind: 'forest' as const, ...(fontSize ? { fontSize } : {}) },
    ];
    expect(declutterLabels(pair(), { k: 2, x: 0, y: 0 })).toHaveLength(2);
    expect(declutterLabels(pair(16), { k: 2, x: 0, y: 0 })).toHaveLength(1);
  });
});

describe('findCellAtPoint + cellTraits', () => {
  const a = {
    biomesData: { name: ['Marine', 'Forest', 'Desert'] },
    pack: {
      cells: { p: [[0, 0], [10, 10], [100, 100]], h: [5, 50, 40], biome: [0, 1, 2], state: [0, 1, 0], burg: [0, 2, 0] },
      states: [{}, { i: 1, name: 'Realm', fullName: 'Kingdom of Realm' }],
      burgs: [{}, {}, { i: 2, name: 'Townston', capital: 1 }],
    },
  } as any;
  it('finds the nearest cell (Voronoi site) to a point', () => {
    expect(findCellAtPoint(a, 9, 11)).toBe(1);
    expect(findCellAtPoint(a, 95, 90)).toBe(2);
  });
  it('reads cell traits (biome / state / burg)', () => {
    const t = cellTraits(a, 1);
    expect(t.land).toBe(true);
    expect(t.biome).toBe('Forest');
    expect(t.state).toBe('Kingdom of Realm');
    expect(t.burg).toEqual({ name: 'Townston', capital: true });
  });
});
