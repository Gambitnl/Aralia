import { describe, it, expect } from 'vitest';
import { makeSeedPath } from '../../seedPath';
import {
  placeProps,
  SCATTER_SEED_CHANCE,
  BUILDING_CLEAR_MARGIN_M,
  ROAD_CLEAR_MARGIN_M,
  RENDERABLE_DEF_IDS,
  DEFILE_SLOPE_THRESHOLD_ENC,
  ORNAMENT_BUILDING_CLEAR_M,
  type PropPlacementContext,
} from '../placementEngine';
import { PROPS_BY_ID } from '../catalog';

function emptyCtx(over: Partial<PropPlacementContext> = {}): PropPlacementContext {
  return {
    extentMetersX: 200,
    extentMetersZ: 200,
    cols: 0,
    rows: 0,
    biomeIds: [],
    buildings: [],
    roads: [],
    decks: [],
    plazas: [],
    ...over,
  };
}

const SEED = makeSeedPath(1337, 'cell:71-8', 'local:2-1');

describe('placementEngine — determinism', () => {
  it('same seed + context → deep-equal output, twice', () => {
    const ctx = emptyCtx({
      plazas: [{ id: 'p1', xM: 100, zM: 100, radiusM: 12 }],
      decks: [{ xM: 30, zM: 30, kind: 'dock' }],
      buildings: [
        { id: 'b1', xM: 50, zM: 50, role: 'smithy' },
        { id: 'b2', xM: 80, zM: 80, role: 'farm' },
      ],
      cols: 8,
      rows: 8,
      biomeIds: Array(64).fill('temperate forest'),
    });
    const a = placeProps(SEED, ctx);
    const b = placeProps(SEED, ctx);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('a different seed path yields different placement', () => {
    const ctx = emptyCtx({ plazas: [{ id: 'p1', xM: 100, zM: 100, radiusM: 12 }] });
    const a = placeProps(SEED, ctx);
    const b = placeProps(makeSeedPath(9999, 'cell:1-1'), ctx);
    expect(a).not.toEqual(b);
  });

  it('every emitted instance references a real catalog def and sits in bounds', () => {
    const ctx = emptyCtx({
      plazas: [{ id: 'p1', xM: 100, zM: 100, radiusM: 12 }],
      cols: 6,
      rows: 6,
      biomeIds: Array(36).fill('forest'),
    });
    for (const inst of placeProps(SEED, ctx)) {
      expect(PROPS_BY_ID.has(inst.defId)).toBe(true);
      expect(inst.xM).toBeGreaterThanOrEqual(0);
      expect(inst.xM).toBeLessThanOrEqual(ctx.extentMetersX);
      expect(inst.zM).toBeGreaterThanOrEqual(0);
      expect(inst.zM).toBeLessThanOrEqual(ctx.extentMetersZ);
      expect(inst.variation.scale).toBeGreaterThanOrEqual(0.85);
      expect(inst.variation.scale).toBeLessThanOrEqual(1.15);
    }
  });
});

describe('placementEngine — placement rules', () => {
  it('dresses each courtyard amenity inside its canonical open radius', () => {
    const amenities = ['well', 'wash-yard', 'work-yard', 'garden'] as const;
    const courtyards = amenities.map((amenity, index) => ({
      id: `court:${index}`,
      xM: 35 + index * 40,
      zM: 35,
      radiusM: 10,
      districtKey: `district:${index}`,
      wealth: amenity === 'garden' ? 'wealthy' as const : 'common' as const,
      amenity,
      courtyardSignature: `court-${index}`,
    }));
    const props = placeProps(SEED, emptyCtx({ courtyards }));

    expect(props.some((prop) => prop.defId === 'well')).toBe(true);
    expect(props.some((prop) => prop.defId === 'water-trough')).toBe(true);
    expect(props.some((prop) => prop.defId === 'cart')).toBe(true);
    expect(props.filter((prop) => prop.defId === 'stone-planter')).toHaveLength(4);
    for (const prop of props) {
      const nearestCourt = Math.min(...courtyards.map((court) =>
        Math.hypot(prop.xM - court.xM, prop.zM - court.zM),
      ));
      expect(nearestCourt).toBeLessThanOrEqual(10);
    }
  });

  it('uses stable courtyard streams and keeps unrelated courts unchanged', () => {
    const first = {
      id: 'court:a', xM: 40, zM: 40, radiusM: 9,
      districtKey: 'district:a', wealth: 'common' as const,
      amenity: 'well' as const, courtyardSignature: 'court-a',
    };
    const second = {
      id: 'court:b', xM: 120, zM: 120, radiusM: 9,
      districtKey: 'district:b', wealth: 'poor' as const,
      amenity: 'wash-yard' as const, courtyardSignature: 'court-b',
    };
    const alone = placeProps(SEED, emptyCtx({ courtyards: [first] }));
    const together = placeProps(SEED, emptyCtx({ courtyards: [first, second] }));

    expect(together.filter((prop) => Math.hypot(prop.xM - 40, prop.zM - 40) <= 9)).toEqual(alone);
  });

  it('a market plaza produces stalls (in the plaza) + understock goods', () => {
    const ctx = emptyCtx({ plazas: [{ id: 'p1', xM: 100, zM: 100, radiusM: 12 }] });
    const props = placeProps(SEED, ctx);
    const stalls = props.filter((p) => p.defId === 'market-stall');
    expect(stalls.length).toBeGreaterThanOrEqual(3);
    // stalls ring the plaza edge, within its radius of the center
    for (const s of stalls) {
      const d = Math.hypot(s.xM - 100, s.zM - 100);
      expect(d).toBeLessThanOrEqual(12 + 0.001);
    }
    const goods = props.filter((p) => ['crate', 'barrel', 'sack'].includes(p.defId));
    expect(goods.length).toBeGreaterThan(0);
  });

  it('a dock context produces crate clusters at the loading point', () => {
    const ctx = emptyCtx({ decks: [{ xM: 40, zM: 40, kind: 'dock' }] });
    const props = placeProps(SEED, ctx);
    const crates = props.filter((p) => p.defId === 'crate');
    expect(crates.length).toBeGreaterThanOrEqual(2);
    expect(crates.length).toBeLessThanOrEqual(5);
    // pooled near the dock (within a couple of cells)
    for (const c of crates) {
      expect(Math.hypot(c.xM - 40, c.zM - 40)).toBeLessThan(5);
    }
    expect(props.some((p) => p.defId === 'crate-stack')).toBe(true);
  });

  it('a smithy gets a woodpile; a bare house context gets no stalls', () => {
    const ctx = emptyCtx({ buildings: [{ id: 'b1', xM: 50, zM: 50, role: 'smithy' }] });
    const props = placeProps(SEED, ctx);
    expect(props.some((p) => p.defId === 'woodpile')).toBe(true);
    expect(props.some((p) => p.defId === 'market-stall')).toBe(false);
  });

  it('a farm gets fence runs, haystacks, and a water trough', () => {
    const ctx = emptyCtx({ buildings: [{ id: 'f1', xM: 60, zM: 60, role: 'farm' }] });
    const props = placeProps(SEED, ctx);
    expect(props.some((p) => p.defId === 'fence-run')).toBe(true);
    expect(props.some((p) => p.defId === 'haystack')).toBe(true);
    expect(props.some((p) => p.defId === 'water-trough')).toBe(true);
  });

  it('forest biome cells scatter wilderness cover; ocean scatters nothing', () => {
    // Scatter is deliberately sparse now — use a big grid so clusters appear.
    const cols = 60, rows = 60;
    const forest = emptyCtx({
      extentMetersX: cols * 1.524,
      extentMetersZ: rows * 1.524,
      cols, rows,
      biomeIds: Array(cols * rows).fill('boreal forest'),
    });
    const fp = placeProps(SEED, forest);
    const cover = fp.filter((p) => ['boulder', 'fallen-log', 'bush'].includes(p.defId));
    expect(cover.length).toBeGreaterThan(0);

    const ocean = emptyCtx({ cols, rows, biomeIds: Array(cols * rows).fill('ocean') });
    expect(placeProps(SEED, ocean)).toHaveLength(0);
  });
});

describe('placementEngine — expanded contexts (strawman full set)', () => {
  it('a temple plot grows a graveyard: gravestone rows + tombs + brazier pair', () => {
    const ctx = emptyCtx({ buildings: [{ id: 't1', xM: 100, zM: 100, role: 'temple' }] });
    const props = placeProps(SEED, ctx);
    const stones = props.filter((p) => p.defId === 'gravestone');
    expect(stones.length).toBeGreaterThanOrEqual(6); // min 2 rows × 3 cols
    const tombs = props.filter((p) => p.defId === 'tomb');
    expect(tombs.length).toBeGreaterThanOrEqual(1);
    expect(props.filter((p) => p.defId === 'brazier')).toHaveLength(2);
    // Gravestone rows share one orientation (±0.1 rad jitter).
    const angles = stones.map((s) => s.rotationRad);
    expect(Math.max(...angles) - Math.min(...angles)).toBeLessThanOrEqual(0.2 + 1e-9);
  });

  it('poor-quarter plots may add rubbish heaps / coops but never stalls', () => {
    const ctx = emptyCtx({
      buildings: Array.from({ length: 12 }, (_, i) => ({
        id: `p${i}`, xM: 20 + i * 10, zM: 50, role: 'poor',
      })),
    });
    const props = placeProps(SEED, ctx);
    expect(props.some((p) => p.defId === 'rubbish-heap' || p.defId === 'chicken-coop')).toBe(true);
    expect(props.some((p) => p.defId === 'market-stall')).toBe(false);
  });

  it('roads get sparse trailside markers (milestone spacing, no density bloat)', () => {
    const ctx = emptyCtx({
      extentMetersX: 400,
      extentMetersZ: 400,
      roads: [{ points: [{ x: 0, z: 200 }, { x: 400, z: 200 }] }],
    });
    const props = placeProps(SEED, ctx);
    const markers = props.filter((p) =>
      ['milestone', 'wayside-shrine', 'fingerpost'].includes(p.defId),
    );
    expect(markers.length).toBeGreaterThanOrEqual(1);
    // 400 m of road at 120 m spacing → a handful, never a carpet.
    expect(markers.length).toBeLessThanOrEqual(6);
    expect(props.length).toBe(markers.length); // roadside adds NOTHING else
  });

  it('roadside markers are deterministic per road', () => {
    const ctx = emptyCtx({
      extentMetersX: 400,
      extentMetersZ: 400,
      roads: [{ points: [{ x: 0, z: 100 }, { x: 380, z: 120 }] }],
    });
    expect(placeProps(SEED, ctx)).toEqual(placeProps(SEED, ctx));
  });
});

describe('placementEngine — full-catalog flip (no invisible props)', () => {
  it('every emitted def is renderable (never an invisible referee-blocker)', () => {
    // Build a rich context that fires every placer, then assert nothing lands
    // outside the render-form allowlist.
    const cols = 40, rows = 40;
    const extent = cols * 1.524;
    const ctx = emptyCtx({
      extentMetersX: extent, extentMetersZ: extent, cols, rows,
      biomeIds: Array(cols * rows).fill('temperate forest'),
      heights: Array.from({ length: cols * rows }, (_, i) => (i % 5) * 4), // slopes for defiles
      plazas: [{ id: 'p1', xM: extent / 2, zM: extent / 2, radiusM: 10 }],
      decks: [{ xM: 20, zM: 20, kind: 'dock' }],
      buildings: [
        { id: 'wf-plot-1-0', xM: 30, zM: 30, role: 'smithy' },
        { id: 'wf-plot-1-1', xM: 40, zM: 40, role: 'farm', wealthy: true },
        { id: 'wf-plot-1-2', xM: 50, zM: 50, role: 'market', businessType: 'tavern' },
      ],
      roads: [{ points: [{ x: 0, z: extent * 0.6 }, { x: extent, z: extent * 0.6 }] }],
      gatehouses: [{ xM: 10, zM: extent * 0.6, angleRad: 0 }],
      rivers: [{ points: [{ x: 0, z: 5 }, { x: extent, z: 5 }] }],
      hiddenSites: [{ id: 'r1', kind: 'ruin', xM: extent * 0.8, zM: extent * 0.2 }],
    });
    const props = placeProps(SEED, ctx);
    expect(props.length).toBeGreaterThan(0);
    for (const p of props) {
      expect(RENDERABLE_DEF_IDS.has(p.defId), `non-renderable emitted: ${p.defId}`).toBe(true);
      expect(PROPS_BY_ID.has(p.defId), p.defId).toBe(true);
    }
  });

  it('draws from the EXPANDED pool, not just WAVE-1 (market has variety)', () => {
    const ctx = emptyCtx({ plazas: [{ id: 'p1', xM: 100, zM: 100, radiusM: 12 }] });
    const ids = new Set(placeProps(SEED, ctx).map((p) => p.defId));
    // At least one expanded market def appears beyond crate/barrel/sack/stall.
    const expanded = ['produce-basket', 'fish-barrel', 'trestle-table', 'notice-board', 'awning-pole'];
    expect(expanded.some((d) => ids.has(d))).toBe(true);
  });
});

describe('placementEngine — SLICE B context enrichment', () => {
  // Each context: at least one context-gated prop appears WITH the signal and
  // NONE of that context's dressing appears WITHOUT it.

  it('tavern: a tavern business dresses its frontage; a plain plot does not', () => {
    const TAVERN = ['tavern-sign', 'overturned-barrel', 'trestle-table', 'slop-bucket'];
    const withT = placeProps(SEED, emptyCtx({
      buildings: [{ id: 'b1', xM: 60, zM: 60, role: 'market', businessType: 'tavern' }],
    }));
    expect(withT.some((p) => TAVERN.includes(p.defId))).toBe(true);
    const without = placeProps(SEED, emptyCtx({
      buildings: [{ id: 'b1', xM: 60, zM: 60, role: 'market' }],
    }));
    expect(without.some((p) => TAVERN.includes(p.defId))).toBe(false);
  });

  it('wealthy-quarter: a wealthy plot gets ornamental dressing; a plain one does not', () => {
    const WEALTHY = ['stone-planter', 'topiary', 'stone-bench', 'hedge-run', 'statue'];
    const withW = placeProps(SEED, emptyCtx({
      buildings: [{ id: 'b1', xM: 60, zM: 60, role: 'house', wealthy: true }],
    }));
    expect(withW.some((p) => WEALTHY.includes(p.defId))).toBe(true);
    const without = placeProps(SEED, emptyCtx({
      buildings: [{ id: 'b1', xM: 60, zM: 60, role: 'house' }],
    }));
    expect(without.some((p) => WEALTHY.includes(p.defId))).toBe(false);
  });

  it('wealthy ornaments keep wall clearance from EVERY building plot (statue-in-wall fix)', () => {
    const WEALTHY = ['stone-planter', 'topiary', 'stone-bench', 'hedge-run', 'statue'];
    const ctx = emptyCtx({
      buildings: [
        { id: 'b1', xM: 60, zM: 60, role: 'house', wealthy: true },
        { id: 'b2', xM: 78, zM: 60, role: 'house' }, // neighbor: its walls must clear too
        { id: 'b3', xM: 60, zM: 78, role: 'house', wealthy: true },
      ],
    });
    const ornaments = placeProps(SEED, ctx).filter((p) => WEALTHY.includes(p.defId));
    expect(ornaments.length).toBeGreaterThan(0);
    for (const p of ornaments) {
      for (const b of ctx.buildings) {
        const d = Math.hypot(p.xM - b.xM, p.zM - b.zM);
        expect(d).toBeGreaterThan(ORNAMENT_BUILDING_CLEAR_M);
      }
    }
  });

  it('gate/walls: a gatehouse posts guard clutter; no gate → none', () => {
    const GATE = ['brazier', 'tool-rack']; // gate-signature (not shared with wilderness)
    const withG = placeProps(SEED, emptyCtx({
      gatehouses: [{ xM: 100, zM: 100, angleRad: 0.3 }],
    }));
    expect(withG.some((p) => GATE.includes(p.defId))).toBe(true);
    const without = placeProps(SEED, emptyCtx({}));
    expect(without.some((p) => GATE.includes(p.defId))).toBe(false);
  });

  it('ruin: a ruin hidden-site grows rubble/columns; a cave does not', () => {
    const RUIN = ['rubble-pile', 'broken-wall', 'toppled-column', 'ivy-mass'];
    const withR = placeProps(SEED, emptyCtx({
      hiddenSites: [{ id: 'r1', kind: 'ruin', xM: 100, zM: 100 }],
    }));
    expect(withR.some((p) => RUIN.includes(p.defId))).toBe(true);
    const cave = placeProps(SEED, emptyCtx({
      hiddenSites: [{ id: 'c1', kind: 'cave', xM: 100, zM: 100 }],
    }));
    expect(cave.some((p) => RUIN.includes(p.defId))).toBe(false);
  });

  it('riverbank: a river fringes its banks; no river → none', () => {
    const BANK = ['reed-bed', 'driftwood-pile', 'gravel-bar'];
    const withRiver = placeProps(SEED, emptyCtx({
      extentMetersX: 400, extentMetersZ: 400,
      rivers: [{ points: [{ x: 0, z: 200 }, { x: 400, z: 200 }] }],
    }));
    expect(withRiver.some((p) => BANK.includes(p.defId))).toBe(true);
    const without = placeProps(SEED, emptyCtx({ extentMetersX: 400, extentMetersZ: 400 }));
    expect(without.some((p) => BANK.includes(p.defId))).toBe(false);
  });

  it('riverbank reads as a patchy BAND, not prop-on-a-string (eyeball fix)', () => {
    // A long straight horizontal river at z=500 across a 1000 m window: enough
    // interval samples (~40) to assert the statistical shape of the fringe.
    const river = { points: [{ x: 0, z: 500 }, { x: 1000, z: 500 }] };
    const props = placeProps(SEED, emptyCtx({
      extentMetersX: 1000, extentMetersZ: 1000, rivers: [river],
    }));
    expect(props.length).toBeGreaterThan(10);

    // 1. Deterministic: the jittered placement reproduces byte-identically.
    const again = placeProps(SEED, emptyCtx({
      extentMetersX: 1000, extentMetersZ: 1000, rivers: [river],
    }));
    expect(again).toEqual(props);

    // 2. BAND not line: perpendicular offsets (|z − 500|) must genuinely vary —
    //    the old fringe pinned everything in a 1.5–3.8 m rail; the band now
    //    spans near-shore to ~4 cells + clump radius. Assert a wide spread.
    const offsets = props.map((p) => Math.abs(p.zM - 500));
    const minOff = Math.min(...offsets);
    const maxOff = Math.max(...offsets);
    expect(maxOff - minOff).toBeGreaterThan(4); // >4 m of band depth used
    expect(maxOff).toBeLessThan(30); // still a river FRINGE, not field scatter

    // 3. PATCHY along the bank: with ~50% skip, some 48 m stretches carry no
    //    props at all. Bucket x into 48 m bins and require at least one gap.
    const bins = new Set(props.map((p) => Math.floor(p.xM / 48)));
    let gaps = 0;
    for (let b = 1; b < Math.floor(1000 / 48) - 1; b++) if (!bins.has(b)) gaps++;
    expect(gaps).toBeGreaterThan(0);

    // 4. CLUMPED + varied: more props than surviving samples (clumps of 1–4)
    //    and more than one def id along the same river (mixed family pool).
    const ids = new Set(props.map((p) => p.defId));
    expect(ids.size).toBeGreaterThan(1);

    // 5. Along-line jitter: consecutive props are NOT metronome-spaced. Collect
    //    sorted unique x positions and assert spacing variance is real.
    const xs = [...new Set(props.map((p) => Math.round(p.xM)))].sort((a, b) => a - b);
    const spacings = xs.slice(1).map((x, i) => x - xs[i]);
    const distinct = new Set(spacings);
    expect(distinct.size).toBeGreaterThan(3); // regular dotted line would be ~1
  });

  it('defile: steep cells seed ambush cover; flat ground does not', () => {
    const cols = 30, rows = 30;
    const extent = cols * 1.524;
    // A steep ridge down the middle columns: alternating high/low → big gradient.
    const steep = Array.from({ length: cols * rows }, (_, i) => {
      const c = i % cols;
      return c > 10 && c < 20 ? (c % 2 === 0 ? 40 : 0) : 5;
    });
    const withSlope = placeProps(SEED, emptyCtx({
      extentMetersX: extent, extentMetersZ: extent, cols, rows,
      biomeIds: Array(cols * rows).fill('ocean'), // isolate defile from wilderness
      heights: steep,
    }));
    const DEFILE = ['boulder', 'rock-outcrop', 'dead-snag', 'fallen-log', 'rubble-pile'];
    expect(withSlope.some((p) => DEFILE.includes(p.defId))).toBe(true);
    // Flat ground (all one height, gradient 0 < threshold) seeds nothing.
    const flat = placeProps(SEED, emptyCtx({
      extentMetersX: extent, extentMetersZ: extent, cols, rows,
      biomeIds: Array(cols * rows).fill('ocean'),
      heights: Array(cols * rows).fill(10),
    }));
    expect(flat.length).toBe(0);
    expect(DEFILE_SLOPE_THRESHOLD_ENC).toBeGreaterThan(0);
  });
});

describe('placementEngine — BG3 density calibration bounds', () => {
  // From docs/superpowers/research/2026-07-03-bg3-reference-pack.md cheat sheet.

  it('market: ~1 stall per ~4 m of plaza edge (perimeter/4, clamped 3..10)', () => {
    // r=12 → perimeter ≈ 75 m → 75/4 ≈ 19 → clamped to 10 (upper bound)
    const ctx = emptyCtx({ plazas: [{ id: 'p1', xM: 100, zM: 100, radiusM: 12 }] });
    const stalls = placeProps(SEED, ctx).filter((p) => p.defId === 'market-stall');
    expect(stalls.length).toBeGreaterThanOrEqual(3);
    expect(stalls.length).toBeLessThanOrEqual(10);
    // small plaza r=3 → perimeter ≈ 18.8 → ~5 stalls
    const small = emptyCtx({ plazas: [{ id: 'p2', xM: 50, zM: 50, radiusM: 3 }] });
    const smallStalls = placeProps(SEED, small).filter((p) => p.defId === 'market-stall');
    expect(smallStalls.length).toBeGreaterThanOrEqual(3);
    expect(smallStalls.length).toBeLessThanOrEqual(6);
  });

  it('docks: 4–8 crate/barrel/stack objects pooled per loading point', () => {
    const ctx = emptyCtx({ decks: [{ xM: 40, zM: 40, kind: 'dock' }] });
    const pooled = placeProps(SEED, ctx).filter((p) =>
      ['crate', 'crate-stack', 'barrel'].includes(p.defId),
    );
    expect(pooled.length).toBeGreaterThanOrEqual(4);
    expect(pooled.length).toBeLessThanOrEqual(10); // 2–5 + 1–2 + 1–3 headroom
  });

  it('wilderness: HARD density ceiling — a full-window forest stays in the low thousands', () => {
    // A real ground window is ~10^5 five-foot cells; the 2026-07-04 density fix
    // caps expected instances at cells × SCATTER_SEED_CHANCE × 6 (max cluster).
    // The old 0.18 rate produced ~130k/window; this bound forbids regression.
    const cols = 100, rows = 100; // 10k eligible cells
    const ctx = emptyCtx({
      extentMetersX: cols * 1.524,
      extentMetersZ: rows * 1.524,
      cols, rows,
      biomeIds: Array(cols * rows).fill('temperate forest'),
    });
    const props = placeProps(SEED, ctx);
    const cells = cols * rows;
    // Hard ceiling: 2× the expected max budget (≈ 0.006 × 6 = 0.036/cell).
    expect(props.length).toBeLessThan(cells * SCATTER_SEED_CHANCE * 6 * 2);
    expect(props.length).toBeGreaterThan(0); // sparse, never sterile-empty
    expect(SCATTER_SEED_CHANCE).toBeLessThanOrEqual(0.01); // an order below the old 0.18
  });

  it('wilderness composition: fallen logs are the RARE element (≥4 bushes per log)', () => {
    const cols = 120, rows = 120;
    const ctx = emptyCtx({
      extentMetersX: cols * 1.524,
      extentMetersZ: rows * 1.524,
      cols, rows,
      biomeIds: Array(cols * rows).fill('temperate forest'),
    });
    const props = placeProps(SEED, ctx);
    const bushes = props.filter((p) => p.defId === 'bush').length;
    const logs = props.filter((p) => p.defId === 'fallen-log').length;
    expect(bushes).toBeGreaterThan(0);
    expect(logs).toBeLessThanOrEqual(bushes / 4); // forest floors mostly clear + bushes
  });

  it('boulders are biome-weighted: rocky hills yes, meadow rare', () => {
    const cols = 120, rows = 120;
    const mk = (biome: string) =>
      placeProps(SEED, emptyCtx({
        extentMetersX: cols * 1.524,
        extentMetersZ: rows * 1.524,
        cols, rows,
        biomeIds: Array(cols * rows).fill(biome),
      }));
    const hills = mk('rocky hills');
    expect(hills.length).toBeGreaterThan(0);
    // Full-catalog composition: rocky ground is STONE-dominated (boulders +
    // crags/standing stones/cairns), but every emitted def is a stone/rock form
    // — no vegetation carpets the crag. `boulder` is still the plurality.
    const STONE_FORMS = new Set([
      'boulder', 'rock-outcrop', 'standing-stone', 'cairn', 'gorse-shrub', 'mossy-rock-cluster',
    ]);
    expect(hills.every((p) => STONE_FORMS.has(p.defId))).toBe(true);
    expect(hills.filter((p) => p.defId === 'boulder').length).toBeGreaterThan(hills.length * 0.4);
    const meadow = mk('meadow');
    const meadowBoulders = meadow.filter((p) => p.defId === 'boulder').length;
    const meadowBushes = meadow.filter((p) => p.defId === 'bush').length;
    expect(meadowBoulders).toBeLessThan(meadowBushes / 4);
  });

  it('settlement clearance: ZERO wilderness scatter inside building/road margins', () => {
    const cols = 80, rows = 80;
    const extent = cols * 1.524; // ~122 m
    const buildings = [
      { id: 'h1', xM: extent / 2, zM: extent / 2, role: 'house' },
      { id: 'h2', xM: extent / 3, zM: extent / 3, role: 'house' },
    ];
    const road = { points: [{ x: 0, z: extent * 0.7 }, { x: extent, z: extent * 0.7 }] };
    const ctx = emptyCtx({
      extentMetersX: extent,
      extentMetersZ: extent,
      cols, rows,
      biomeIds: Array(cols * rows).fill('temperate forest'),
      buildings,
      roads: [road],
    });
    const cover = placeProps(SEED, ctx).filter((p) =>
      ['boulder', 'fallen-log', 'bush'].includes(p.defId),
    );
    expect(cover.length).toBeGreaterThan(0); // forest still reads as forest
    for (const c of cover) {
      for (const b of buildings) {
        expect(Math.hypot(c.xM - b.xM, c.zM - b.zM)).toBeGreaterThan(BUILDING_CLEAR_MARGIN_M);
      }
      // road is horizontal at z = extent*0.7 spanning full width
      expect(Math.abs(c.zM - extent * 0.7)).toBeGreaterThan(ROAD_CLEAR_MARGIN_M);
    }
  });

  it('market stalls never sit on a building plot (stall-in-building fix)', () => {
    // Market plots ring the plaza center — exactly where stalls want to stand.
    const plots = Array.from({ length: 6 }, (_, i) => {
      const ang = (i / 6) * Math.PI * 2;
      return { id: `wf-plot-1-${i}`, xM: 100 + Math.cos(ang) * 10, zM: 100 + Math.sin(ang) * 10, role: 'house' };
    });
    const ctx = emptyCtx({
      plazas: [{ id: 'p1', xM: 100, zM: 100, radiusM: 12 }],
      buildings: plots,
    });
    const stalls = placeProps(SEED, ctx).filter((p) => p.defId === 'market-stall');
    for (const s of stalls) {
      for (const b of plots) {
        expect(Math.hypot(s.xM - b.xM, s.zM - b.zM)).toBeGreaterThan(1.524 * 3 - 1e-9);
      }
    }
  });
});
