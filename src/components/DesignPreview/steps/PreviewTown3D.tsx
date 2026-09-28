// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/08/2026, 00:56:44
 * Dependents: components/DesignPreview/DesignPreviewPage.tsx
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import TownPlanView from '@/components/Worldforge/TownPlanView';
import World3DScene, { type World3DLayerVisibility } from '@/components/World3D/World3DScene';

/** The LAND pane's layer strip: one chip per toggleable scene component. */
const LAND_LAYER_CHIPS: ReadonlyArray<[keyof World3DLayerVisibility, string]> = [
  ['buildings', 'buildings'],
  ['walls', 'walls'],
  ['roads', 'roads'],
  ['water', 'water'],
  ['trees', 'trees'],
  ['bushes', 'bushes'],
  ['grass', 'grass'],
  ['understory', 'understory'],
  ['props', 'props'],
  ['agents', 'agents'],
  ['farShells', 'horizon'],
];
import { scaleProfile, typologyForPopulation, type TownTypology } from '@/systems/worldforge/town/townEngine';
import {
  getBridgeAtlas,
  getBurgCultureType,
  getWorldforgeLocalForCell,
} from '@/systems/worldforge/bridge/legacySubmapBridge';
import { listSelectableTowns, type SelectableTown } from '@/systems/worldforge/local/startTowns';
import {
  canonicalTownSeedPath,
  getCanonicalTownPlan,
  getCanonicalTownWaterFeatures,
} from '@/systems/worldforge/town/canonicalTown';
import { burgCellId } from '@/systems/worldforge/town/cellFeatures';
import {
  buildGroundLoaderFromWorld,
  makeGroundWorld,
  type GroundWorld,
} from '@/systems/worldforge/bridge/groundChunkLoader';
import { heightToMeters } from '@/systems/world3d/config';
import { styleFamilyForCultureType } from '@/systems/worldforge/town/architectureStyle';
import { resolveBuildingAgeBand } from '@/systems/worldforge/town/buildingAge';
import type { FmgWorldResult } from '@/systems/worldforge/fmg/generateWorld';

// R3F scene is heavy — lazy-load so the preview shell stays snappy.
const Town3DScene = lazy(() => import('./Town3DScene'));
type TownLayer = import('./Town3DScene').TownLayer;
const TOWN_LAYERS: TownLayer[] = ['ground', 'streets', 'buildings', 'walls', 'civic', 'water'];

/**
 * "Town" design-preview: three views of ONE REAL BURG.
 *
 * Every panel shows the same settlement out of the same fixed world — the 2D
 * town map, the schematic 3D minimap, and the real streamed 3D world the player
 * walks. Nothing here is hand-authored: the footprint, river, roads and plan all
 * come from `canonicalTown`, which is the single generator per (atlas, burgId).
 *
 * The typology buttons pick a REAL burg out of the world's 813, one per
 * population band, chosen deterministically (median population in the band) so
 * the same button always lands on the same named town.
 *
 * "WATER BURGS ONLY" (also `?water=1`) narrows every band to the 484 burgs
 * whose own cell carries a river or a coast. It exists because the population
 * median is blind to water: this world has 215 rivers and plenty of harbors,
 * and all five default picks came out DRY. A harness meant to show the town
 * generator could not show a bridge, a quay or a river ward, and the streamed
 * world's water could not be photographed here at all.
 *
 * The gate asks the SAME two questions `cellWaterFeatures` asks when it draws —
 * is the burg's cell on a river's course, and is its harbor value above zero.
 * Asking anything else (the burg record's own `isPort` flag, say) could offer a
 * town whose plan then draws no water, which is the one answer a control
 * labelled "water" must never give.
 */

/** One fixed world so the harness is deterministic (215 rivers, 813 burgs). */
const WORLD_SEED = 903674813;

interface TypologyBand {
  label: string;
  typology: TownTypology;
  /** Inclusive lower bound, exclusive upper — mirrors `typologyForPopulation`. */
  minPop: number;
  maxPop: number;
}

const TYPOLOGY_BANDS: TypologyBand[] = [
  { label: 'Hamlet', typology: 'hamlet', minPop: 0, maxPop: 100 },
  { label: 'Village', typology: 'village', minPop: 100, maxPop: 1000 },
  { label: 'Walled town', typology: 'walled town', minPop: 1000, maxPop: 5000 },
  { label: 'City', typology: 'city', minPop: 5000, maxPop: 25000 },
  { label: 'Capital', typology: 'capital', minPop: 25000, maxPop: Infinity },
];

/**
 * The band's representative burg: the MEDIAN-population town, ties broken by
 * burg index. Deterministic, and a median avoids showing the band's degenerate
 * edge (the 1,005-person "walled town" that barely qualifies).
 *
 * Returns null when the world has no burg in the band. That is reported as an
 * explicit gap — substituting a neighbouring band's town would put the harness
 * back to showing a settlement the button does not claim.
 */
function pickBurgForBand(
  towns: SelectableTown[],
  band: TypologyBand,
  /** Optional gate: keep only burgs this returns a water kind for. */
  waterKind?: (t: SelectableTown) => WaterKind,
): SelectableTown | null {
  const inBand = towns
    .filter((t) => t.population >= band.minPop && t.population < band.maxPop)
    .filter((t) => !waterKind || waterKind(t) !== null)
    .sort((a, b) => a.population - b.population || a.burgIndex - b.burgIndex);
  return inBand.length ? inBand[Math.floor(inBand.length / 2)] : null;
}

/** What water a burg's own cell carries. `null` means dry. */
type WaterKind = 'river' | 'coast' | 'both' | null;

/**
 * Every atlas cell a river runs through, as one set built in a single pass.
 *
 * WHY A SET AND NOT A PER-BURG QUERY. The honest per-burg test is the one
 * `cellWaterFeatures` runs: scan every river's cell sequence for this burg's
 * cell. Run per burg across 813 burgs that is a nested scan of all 215 rivers.
 * Inverted once into a set, the same answer costs one lookup per burg.
 */
function riverCellSet(atlas: FmgWorldResult): Set<number> {
  const out = new Set<number>();
  const rivers = (atlas.pack as unknown as { rivers?: Array<{ cells?: number[] }> }).rivers ?? [];
  for (const r of rivers) {
    for (const c of r.cells ?? []) if (c >= 0) out.add(c);
  }
  return out;
}

/**
 * Whether a burg has water, by the SAME two tests the town plan itself uses.
 *
 * That agreement is the whole point. `cellWaterFeatures` draws a river when the
 * burg's cell sits on a river's course, and a coast when the cell's harbor
 * value is above zero. A filter that asked a different question — the burg
 * record's own `isPort` flag, say — could offer a town whose plan then draws
 * no water, which is exactly the wrong answer to give a picker labelled
 * "water".
 */
function makeWaterKind(atlas: FmgWorldResult): (t: SelectableTown) => WaterKind {
  const riverCells = riverCellSet(atlas);
  const harbor = (atlas.pack.cells as unknown as { harbor?: ArrayLike<number> }).harbor;
  return (t) => {
    let cell: number;
    try {
      cell = burgCellId(atlas as never, t.burgIndex);
    } catch {
      return null;
    }
    const river = riverCells.has(cell);
    const coast = (harbor?.[cell] ?? 0) > 0;
    if (river && coast) return 'both';
    if (river) return 'river';
    if (coast) return 'coast';
    return null;
  };
}

const WATER_KIND_LABEL: Record<Exclude<WaterKind, null>, string> = {
  river: 'river',
  coast: 'coast',
  both: 'river + coast',
};

/** The four views. Panels always render in THIS order, whatever the toggle order. */
type ViewKey = '2d' | '3d' | 'world' | 'land';
const VIEW_ORDER: ViewKey[] = ['2d', '3d', 'world', 'land'];
const VIEW_LABEL: Record<ViewKey, string> = {
  '2d': '2D map',
  '3d': '3D minimap',
  world: 'Real 3D',
  land: 'LAND 3D',
};

/**
 * The LAND pane's volume bubble (Remy 2026-08-24: "the town implementation
 * but then on the LAND version — none of the 'sheets of land'"). One bubble
 * holds the whole burg: 240 m across at 0.94 m cells. Coarser than the 64 m
 * walking bubble (0.25 m cells) — the trade the town-scale view needs.
 *
 * SINCE agora-0774 this is the FLOOR, not the fixed width. A hamlet is smaller
 * than 240 m and gains nothing from a narrower bubble; a city is wider than it
 * and used to spill its outer wards onto flat sheets, so `bakeRealWorld` widens
 * the bubble per burg up to `TOWN_LAND_MAX_EXTENT_M`.
 */
const TOWN_LAND_EXTENT_M = 240;
/**
 * The bubble's target cell size, meters. 240 m over the worker's old fixed
 * 256-cells-per-edge — kept as the number, not the ratio, so a WIDER bubble
 * stays this detailed instead of coarsening in step with its extent.
 */
const TOWN_LAND_CELL_M = 240 / 256;
/**
 * Cells per edge the pane will pay for. The fill is this SQUARED times the
 * slab's cell height, so it is the real budget knob; 512 at 0.94 m reaches
 * 480 m before the cell has to grow at all.
 */
const TOWN_LAND_MAX_CELLS_PER_EDGE = 512;
/**
 * Widest bubble the LAND pane will ask for, meters.
 *
 * WAS 480, capped by the CUBE (agora-0774). The bubble's height used to equal
 * its width, so widening it bought area by spending cell size — 240 m at 0.94 m
 * cells, 480 m at 1.88 m — and past 480 m the 1.88 m vertical quantization read
 * as terraces rather than ground.
 *
 * agora-f452 broke the cube: `volumeBubbleHeightM` gives the slab its own
 * height, so the footprint no longer pays for hundreds of metres of sky and
 * buried rock. Hafting's ENVELOPE half is 244 m — 488 m across, past the old
 * cap — and its outer wards, walls and approaches were the part still standing
 * on flat sheets after slice 1 put its built core on the volume. 720 m holds
 * that envelope plus the camera's own standoff and a rim margin.
 */
const TOWN_LAND_MAX_EXTENT_M = 720;
/**
 * How tall the LAND pane asks its slab to be, meters — a FLOOR, not the answer.
 *
 * The worker measures the footprint's real relief and raises this when the
 * ground needs more room (`slabHeightForFootprint`), so this only has to cover
 * the flat case: the camera's 35 m standoff height above, and enough below the
 * surface that a cut face has strata to show.
 */
const TOWN_LAND_HEIGHT_M = 96;

/**
 * Multi-select view toggling. The visible set is never empty.
 *
 * - Everything showing, click one → isolate that one.
 * - Click a view that is off → add it (so the third click lands back on all three).
 * - Click a view that is on, with others showing → drop it.
 * - Click the ONLY visible view → no-op. Deliberate, not a missing branch:
 *   honouring it would leave zero panels and an empty harness.
 */
function toggleView(current: ReadonlySet<ViewKey>, v: ViewKey): Set<ViewKey> {
  if (current.size === VIEW_ORDER.length) return new Set([v]);
  if (!current.has(v)) return new Set([...current, v]);
  if (current.size === 1) return new Set(current);
  const next = new Set(current);
  next.delete(v);
  return next;
}

interface RealWorldScene {
  ground: GroundWorld;
  loader: ReturnType<typeof buildGroundLoaderFromWorld>;
  start: readonly [number, number, number];
  startSurfaceY: number;
  /**
   * The LAND pane's own scene origin: the TOWN CENTER, not the Real-3D
   * standoff. See `bakeRealWorld` — the volume bubble is built around the
   * scene origin, so these are what put the burg inside the bubble.
   */
  landStart: readonly [number, number, number];
  landStartSurfaceY: number;
  /** Bubble width for this burg, meters (town envelope + the camera standoff). */
  landExtentM: number;
  /** Bubble cell for this burg, meters. Held at `TOWN_LAND_CELL_M` until the
   * footprint would cost more than `TOWN_LAND_MAX_CELLS_PER_EDGE` cells. */
  landCellM: number;
  /** Bubble height floor for this burg, meters. The worker fits it to relief. */
  landHeightM: number;
}

/**
 * Baked real-3D worlds, keyed by burg. Baking costs ~3 s (region + local +
 * ground), so it happens once per burg and survives layout toggles.
 */
const groundCache = new Map<number, RealWorldScene>();

/**
 * Bake the streamed ground world around a burg and frame the camera on the town.
 *
 * `centerPx` is mandatory: without it the Locale window frames the cell point,
 * misses the town envelope, and `region.townSites` comes back empty — every town
 * feature then silently vanishes from the 3D world.
 */
function bakeRealWorld(atlas: FmgWorldResult, burg: SelectableTown): RealWorldScene {
  const cached = groundCache.get(burg.burgIndex);
  if (cached) return cached;

  const packBurg = (atlas.pack.burgs as unknown as Array<{ x: number; y: number }>)[burg.burgIndex];
  if (!packBurg) throw new Error(`No pack burg at index ${burg.burgIndex}`);

  const { local, region } = getWorldforgeLocalForCell(WORLD_SEED, burg.atlasCellId, {
    centerPx: [packBurg.x, packBurg.y],
  });
  // ANCHOR CELL (required, not optional). Without it the window resolves no
  // tree biome, so its tree scatter carries no biome channel and the grown-tree
  // batcher throws — taking the whole R3F canvas down, which is why this panel
  // rendered black. The live game path (worldGenCore) always passes its entry
  // cell; this harness did not. The anchor also gives the window its correct
  // ground tint, canopy and snow line, so passing it fixes more than the crash.
  const ground = makeGroundWorld(local, WORLD_SEED, region, { anchorCellId: burg.atlasCellId });
  const loader = buildGroundLoaderFromWorld(ground);

  // Frame the burg itself: the ground world reports every town it contains with
  // a center in ground meters, so the camera opens on the settlement rather than
  // the window's geometric middle.
  const town = ground.towns.find((t) => t.burgId === burg.burgIndex);
  if (!town) {
    throw new Error(
      `Ground bake for ${burg.name} (burg ${burg.burgIndex}) contains no town site — ` +
        'the Locale window missed the burg envelope.',
    );
  }
  // Stand off the town's SE side, at the distance where the settlement FILLS the
  // frame at walking-scale height.
  //
  // Two things force the arithmetic. `viewProfile="ground"` pins the camera at
  // `start + [60, 35, 60]` — 85 m diagonally back, 35 m up — and it looks at
  // `start`, so the only lever is where `start` sits. And `town.halfM` is the
  // ENVELOPE, not the built area: Hafting's envelope half is 244 m but 90% of its
  // buildings sit inside 118 m. Offsetting by the envelope put the camera ~400 m
  // out and shrank the town to a band on the horizon.
  //
  // So measure the real built radius (p90 of building distance from the town
  // center — p90 rather than max so a lone outlying farmstead cannot push the
  // camera back), and place `start` so the camera ends up ~2.2 radii from the
  // center. That is close enough for walls, streets and roofs to read as
  // structures, and far enough that the whole burg is in shot.
  const dists = ground.buildings
    .map((b) => Math.hypot(b.xM - town.xM, b.zM - town.zM))
    .sort((a, b) => a - b);
  const builtRadius = dists.length ? dists[Math.floor(dists.length * 0.9)] : town.halfM * 0.5;
  // camera distance = √2 × (edge + 60); solve that for 2.2 × builtRadius.
  const edge = Math.max(30, (2.2 * builtRadius) / Math.SQRT2 - 60);
  const startX = Math.max(0, Math.min(ground.extentMetersX, town.xM + edge));
  const startZ = Math.max(0, Math.min(ground.extentMetersZ, town.zM + edge));
  const gx = Math.max(0, Math.min(ground.cols - 1, Math.round((startX / ground.extentMetersX) * (ground.cols - 1))));
  const gy = Math.max(0, Math.min(ground.rows - 1, Math.round((startZ / ground.extentMetersZ) * (ground.rows - 1))));

  /**
   * THE LAND PANE'S OWN ORIGIN — the town center (agora-0774).
   *
   * The volume bubble is built around the scene origin (World3DScene passes
   * `start` straight through as `sceneOrigin`, and this harness never passes a
   * player position). The Real-3D standoff above sits ~175 m diagonally OUT
   * from the burg so the whole envelope fills the frame — which put the entire
   * settlement outside a 240 m bubble's 120 m reach. The pane then showed
   * exactly what it exists to disprove: volume ground in the foreground and the
   * town beyond it on flat sheets, floating a storey above the substance.
   *
   * So the LAND pane opens at the town's own center. `viewProfile="ground"`
   * puts the camera at origin + [60, 35, 60] — 85 m out, 35 m up, looking at
   * the center — which is inside the bubble as well, so the ground the camera
   * stands over and the ground the town stands on are one volume.
   *
   * Real 3D keeps the standoff. Two framings, one bake.
   */
  const landCx = Math.max(0, Math.min(ground.extentMetersX, town.xM));
  const landCz = Math.max(0, Math.min(ground.extentMetersZ, town.zM));
  const lgx = Math.max(0, Math.min(ground.cols - 1, Math.round((landCx / ground.extentMetersX) * (ground.cols - 1))));
  const lgy = Math.max(0, Math.min(ground.rows - 1, Math.round((landCz / ground.extentMetersZ) * (ground.rows - 1))));
  /* HALF-EXTENT: THE ENVELOPE, NOT THE BUILT CORE (agora-f452).
   *
   * Slice 1 sized this on `builtRadius` — p90 of building distance — which is
   * the right number for where to put the CAMERA and the wrong one for how far
   * the ground has to reach. Hafting's p90 is 118 m and its envelope half is
   * 244 m: everything between those two radii is wall, approach road, outer
   * ward and open ground inside the ring, and all of it was outside a 306 m
   * bubble, standing on the flat sheets this pane exists to retire.
   *
   * So the ground covers whichever is larger, plus the camera's own 85 m
   * standoff and a 35 m margin so the bubble rim is never in shot.
   */
  const landHalf = Math.max(builtRadius, town.halfM, 85) + 35;
  const landExtentM = Math.min(TOWN_LAND_MAX_EXTENT_M, Math.max(TOWN_LAND_EXTENT_M, landHalf * 2));
  /* DETAIL FIRST, THEN THE BUDGET. The cell holds at 0.94 m — what the 240 m
   * preset always drew — and only grows once the footprint would need more than
   * `TOWN_LAND_MAX_CELLS_PER_EDGE` of them. A 240 m hamlet is byte-for-byte the
   * bubble it was; Hafting's 558 m footprint comes back at 1.09 m rather than
   * the 2.18 m the fixed-cell-count rule would have handed it. */
  const landCellM = Math.max(TOWN_LAND_CELL_M, landExtentM / TOWN_LAND_MAX_CELLS_PER_EDGE);

  /* WHAT THE PANE ASKED FOR, PRINTED. The bubble's coverage is the whole
   * subject of this pane and it is invisible in a screenshot once it is right;
   * a capture rig and a reader both need the numbers, not an impression. */
  // eslint-disable-next-line no-console
  console.info(
    `[town3d/land] ${burg.name}: builtRadius(p90)=${builtRadius.toFixed(1)}m ` +
      `envelopeHalf=${town.halfM.toFixed(1)}m -> bubble ${landExtentM.toFixed(0)}m ` +
      `at ${landCellM.toFixed(2)}m cells (${Math.round(landExtentM / landCellM)} per edge), ` +
      `slab height floor ${TOWN_LAND_HEIGHT_M}m`,
  );

  const scene: RealWorldScene = {
    ground,
    loader,
    start: [startX, 0, startZ] as const,
    startSurfaceY: heightToMeters(ground.heights[gy * ground.cols + gx] ?? 0),
    landStart: [landCx, 0, landCz] as const,
    landStartSurfaceY: heightToMeters(ground.heights[lgy * ground.cols + lgx] ?? 0),
    landExtentM,
    landCellM,
    landHeightM: TOWN_LAND_HEIGHT_M,
  };
  groundCache.set(burg.burgIndex, scene);
  return scene;
}

export const PreviewTown3D: React.FC = () => {
  const [bandIdx, setBandIdx] = useState(2); // walled town
  // Which of the three views are showing. Multi-select, never empty.
  // Default = the 2D map alone (Remy 2026-08-24). Visibility only: hidden
  // panes still mount and bake (display:none by design, so a toggled-on 3D
  // view appears already built).
  const [views, setViews] = useState<Set<ViewKey>>(() => new Set<ViewKey>(['2d']));
  // Per-layer 3D-minimap visibility — hide buildings to inspect the streets and
  // river beneath, isolate the walls, etc. All layers start visible.
  const [show, setShow] = useState<Record<TownLayer, boolean>>({
    ground: true, streets: true, buildings: true, walls: true, civic: true, water: true,
  });

  // The atlas bake is ~1.5 s, so it runs off the first paint. Everything below
  // waits on it rather than inventing a stand-in world.
  const [atlas, setAtlas] = useState<FmgWorldResult | null>(null);
  const [atlasError, setAtlasError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      try {
        const built = getBridgeAtlas(WORLD_SEED);
        if (alive) setAtlas(built);
      } catch (err) {
        if (alive) setAtlasError(err instanceof Error ? err.message : String(err));
      }
    }, 0);
    return () => { alive = false; window.clearTimeout(t); };
  }, []);

  /* THE WATER GATE. Off, the bands pick on population alone — which is how
   * this harness shipped, and how all five of its burgs came out dry. World
   * 903674813 has 215 rivers and plenty of harbors; the picker simply never
   * asked. On, each band still takes its median burg, but only among the ones
   * whose own cell carries a river or a coast. */
  const [waterOnly, setWaterOnly] = useState(
    () => typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('water') === '1',
  );

  const waterKind = useMemo(() => (atlas ? makeWaterKind(atlas) : null), [atlas]);

  const picks = useMemo(() => {
    if (!atlas) return null;
    const towns = listSelectableTowns(atlas);
    const gate = waterOnly && waterKind ? waterKind : undefined;
    return TYPOLOGY_BANDS.map((band) => pickBurgForBand(towns, band, gate));
  }, [atlas, waterOnly, waterKind]);

  /** How many burgs in the world carry water at all — printed, not guessed. */
  const waterCount = useMemo(() => {
    if (!atlas || !waterKind) return null;
    return listSelectableTowns(atlas).filter((t) => waterKind(t) !== null).length;
  }, [atlas, waterKind]);

  const band = TYPOLOGY_BANDS[bandIdx];
  const burg = picks ? picks[bandIdx] : null;
  const burgWater = burg && waterKind ? waterKind(burg) : null;

  const plan = useMemo(
    () => (atlas && burg ? getCanonicalTownPlan(atlas, WORLD_SEED, burg.burgIndex) : null),
    [atlas, burg],
  );
  const water = useMemo(
    () => (atlas && burg ? getCanonicalTownWaterFeatures(atlas, burg.burgIndex, WORLD_SEED) : null),
    [atlas, burg],
  );
  const seedPath = useMemo(
    () => (burg ? canonicalTownSeedPath(WORLD_SEED, burg.burgIndex) : null),
    [burg],
  );
  const styleFamily = useMemo(
    () => (burg ? styleFamilyForCultureType(getBurgCultureType(WORLD_SEED, burg.burgIndex)) : undefined),
    [burg],
  );

  // Real streamed 3D: baked lazily, once per burg, only while its panel is up.
  // BOTH panels that stand on the streamed bake must arm it. The LAND view
  // renders the SAME `realScene` as Real 3D — only its ground differs — so
  // gating the bake on 'world' alone left LAND waiting on a bake that was
  // never started: isolate LAND and the pane sits on "Forging world…"
  // forever, with `baking` false because nothing ever began.
  const wantsRealWorld = views.has('world') || views.has('land');
  const [realScene, setRealScene] = useState<{ burgIndex: number; scene: RealWorldScene } | null>(null);
  const [realError, setRealError] = useState<string | null>(null);
  const [baking, setBaking] = useState(false);
  useEffect(() => {
    if (!atlas || !burg || !wantsRealWorld) return;
    if (realScene?.burgIndex === burg.burgIndex) return;
    let alive = true;
    setBaking(true);
    setRealError(null);
    const t = window.setTimeout(() => {
      try {
        const scene = bakeRealWorld(atlas, burg);
        if (alive) setRealScene({ burgIndex: burg.burgIndex, scene });
      } catch (err) {
        if (alive) setRealError(err instanceof Error ? err.message : String(err));
      } finally {
        if (alive) setBaking(false);
      }
    }, 0);
    return () => { alive = false; window.clearTimeout(t); };
  }, [atlas, burg, wantsRealWorld, realScene]);

  // Optional overhead framing for the real 3D panel — World3DScene's own "Town
  // Cell" lift, on demand. The panel OPENS at walking height (that is the point
  // of this view), so this is a button, not an automatic camera move.
  const [frameNonce, setFrameNonce] = useState(0);
  // LAND pane: flat opaque red on the water sheets, as a TOGGLE (Remy's
  // question-sheet pick, 2026-08-28). On = hunt water placement faults;
  // off = the normal ripple water.
  // AGORA-0774 flipped the DEFAULT, not the feature. The flat-red material is
  // opaque, and once this pane's camera moved inside the burg (see
  // `bakeRealWorld`) those sheets covered the streets and the volume ground
  // under them — hiding the exact surface the pane exists to show. Fault
  // hunting is still one click away; it is no longer what the pane opens on.
  const [redWater, setRedWater] = useState(false);
  // Night-sky lab knob (2026-08-26): drives World3DScene's timeOfDayHours so
  // the day→night lighting/sky swap can be eyeballed here without waiting for
  // the game clock. Default is the production golden-hour default.
  const [hour, setHour] = useState(18.2);
  /* The LAND pane's layer visibility. Absent key = visible; a chip click
   * flips one flag and the scene flips one `visible` bit. */
  const [landLayers, setLandLayers] = useState<World3DLayerVisibility>({});
  /**
   * THE HEIGHTFIELD SKIN, as a control (agora-0774).
   *
   * The pane is called LAND because Remy asked for the town "without the sheets
   * of land" (2026-08-24), so this still starts OFF and the volume bubble is
   * still the only ground under the burg. It is a chip rather than a constant
   * because the two states answer different questions: skin OFF proves the town
   * stands on substance, skin ON shows the bubble's rim JOIN — the seam the
   * bubble is built to dive under — which is unphotographable when the only
   * thing on the far side of the rim is sky.
   */
  const [landSkin, setLandSkin] = useState(false);

  const profile = useMemo(() => (burg ? scaleProfile(burg.population) : null), [burg]);
  const buildings = useMemo(
    () => (plan ? plan.wards.reduce((n, w) => n + w.plots.length, 0) : 0),
    [plan],
  );
  const architectureDistricts = useMemo(
    () => (plan ? new Set(plan.wards.map((ward) => ward.architectureDistrict?.key).filter(Boolean)).size : 0),
    [plan],
  );
  // Count the same frame-invariant age bands TownPlanView attaches to every
  // building. Keeping this as a preview statistic makes town growth rings easy
  // to audit without inventing a second age-assignment path.
  const buildingAges = useMemo(() => {
    const counts = { new: 0, aged: 0, old: 0, ancient: 0 };
    if (!plan || !seedPath) return counts;
    plan.wards.forEach((ward, wardIndex) => {
      ward.plots.forEach((plot, plotIndex) => {
        const ageBand = resolveBuildingAgeBand({
          polygon: plot.polygon,
          townCore: plan.core,
          settlementKey: seedPath,
          buildingKey: plot.architectureKey ?? `ward:${wardIndex}/plot:${plotIndex}`,
        });
        counts[ageBand]++;
      });
    });
    return counts;
  }, [plan, seedPath]);
  const civicKinds = useMemo(
    () => (plan ? Array.from(new Set(plan.civic.map((c) => c.kind))).join(', ') || '—' : '—'),
    [plan],
  );
  const demo = plan?.demographics;

  // Measure the 2D pane so TownPlanView fills it (clientWidth/Height is transform-
  // and throttle-safe — the preview window animates in via a CSS transform).
  const twoDRef = useRef<HTMLDivElement>(null);
  const [size2d, setSize2d] = useState({ width: 600, height: 540 });
  useEffect(() => {
    const el = twoDRef.current;
    if (!el) return;
    const measure = () => setSize2d((cur) => {
      const w = Math.max(120, el.clientWidth), h = Math.max(120, el.clientHeight);
      return cur.width === w && cur.height === h ? cur : { width: w, height: h };
    });
    measure();
    const t = window.setTimeout(measure, 350);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { window.clearTimeout(t); ro.disconnect(); };
  }, [views, plan]);

  // Visible panes share the row evenly; hidden ones are display:none rather than
  // unmounted, so toggling never tears down the baked real-3D scene.
  const paneClass = (key: ViewKey) =>
    `${views.has(key) ? 'flex-1' : 'hidden'} min-h-0 relative rounded border border-slate-700 overflow-hidden bg-slate-950`;

  return (
    <div className="flex flex-col gap-3 p-3 text-slate-100 h-full min-h-0" data-testid="preview-town">
      <div>
        <h2 className="text-lg font-semibold">
          Town — one real burg, four views
          {burg && <span className="ml-2 text-amber-300">{burg.name}</span>}
        </h2>
        <p className="text-xs text-slate-400">
          Every panel shows the SAME real settlement from world {WORLD_SEED}: the 2D town map, the
          schematic 3D minimap, the real streamed 3D world the player walks, and the LAND view — the
          same baked town on the volume ground, with no terrain sheets at all. The 2D map and the
          minimap share one canonical plan per (atlas, burg); both 3D panels bake that same burg
          into the ground world. Nothing here is hand-authored. Drag any 3D view to look around.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TYPOLOGY_BANDS.map((b, i) => {
          const pick = picks ? picks[i] : undefined;
          const missing = picks != null && pick == null;
          return (
            <button
              key={b.label}
              type="button"
              title={missing ? `World ${WORLD_SEED} has no burg in the ${b.typology} band` : pick?.name}
              onClick={() => setBandIdx(i)}
              className={`px-3 py-1 rounded text-sm border ${
                i === bandIdx
                  ? missing
                    ? 'bg-amber-900 text-amber-100 border-amber-600'
                    : 'bg-amber-700 text-white border-amber-900'
                  : 'bg-gray-700 text-gray-100 border-gray-600 hover:bg-gray-600'
              }`}
            >
              {b.label}
              {pick && <span className="ml-1.5 text-[11px] opacity-80">{pick.name}</span>}
              {pick && waterKind && waterKind(pick) && (
                <span className="ml-1.5 text-[11px] text-sky-300">
                  {WATER_KIND_LABEL[waterKind(pick) as Exclude<WaterKind, null>]}
                </span>
              )}
              {missing && (
                <span className="ml-1.5 text-[11px] text-amber-300">
                  {waterOnly ? 'none with water' : 'none in world'}
                </span>
              )}
            </button>
          );
        })}
        {/* THE WATER GATE, on the same row as the bands it constrains. */}
        <button
          type="button"
          aria-pressed={waterOnly}
          onClick={() => setWaterOnly((v) => !v)}
          title={
            waterCount == null
              ? 'Restrict every band to burgs whose own cell carries a river or a coast'
              : `Restrict every band to the ${waterCount} burgs whose own cell carries a river or a coast`
          }
          className={`px-3 py-1 rounded text-sm border ${
            waterOnly
              ? 'bg-sky-700 text-white border-sky-400'
              : 'bg-gray-700 text-gray-100 border-gray-600 hover:bg-gray-600'
          }`}
        >
          Water burgs only
          {waterCount != null && (
            <span className="ml-1.5 text-[11px] opacity-80">{waterCount}</span>
          )}
        </button>
        <span className="mx-1 w-px self-stretch bg-gray-600" />
        <button type="button" onClick={() => setViews(new Set(VIEW_ORDER))}
          className={`px-3 py-1 rounded text-sm border ${views.size === VIEW_ORDER.length ? 'bg-emerald-700 text-white border-emerald-500' : 'bg-gray-700 text-gray-100 border-gray-600 hover:bg-gray-600'}`}>
          All views
        </button>
        {VIEW_ORDER.map((v) => (
          <button key={v} type="button" aria-pressed={views.has(v)}
            onClick={() => setViews((cur) => toggleView(cur, v))}
            className={`px-3 py-1 rounded text-sm border ${views.has(v) ? 'bg-emerald-700 text-white border-emerald-500' : 'bg-gray-700 text-gray-100 border-gray-600 hover:bg-gray-600'}`}>
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>

      {/* 3D-minimap layer visibility — hide categories to inspect what's underneath
          (e.g. hide Buildings to trace the streets and river). Minimap only. */}
      {views.has('3d') && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className="text-slate-400">Minimap layers:</span>
          {TOWN_LAYERS.map((key) => (
            <label key={key} className="flex items-center gap-1.5 capitalize">
              <input
                type="checkbox"
                checked={show[key]}
                onChange={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
              />
              {key}
            </label>
          ))}
          <button type="button" onClick={() => setShow({ ground: true, streets: true, buildings: true, walls: true, civic: true, water: true })}
            className="px-2 py-0.5 rounded border border-slate-600 hover:bg-gray-700">All</button>
          <button type="button" onClick={() => setShow({ ground: true, streets: true, buildings: false, walls: false, civic: false, water: true })}
            className="px-2 py-0.5 rounded border border-slate-600 hover:bg-gray-700">Streets + water only</button>
        </div>
      )}

      {atlasError && (
        <div className="rounded border border-red-500 bg-red-950/60 px-3 py-2 text-sm text-red-200">
          World {WORLD_SEED} failed to forge: {atlasError}
        </div>
      )}

      {picks && !burg && (
        <div className="rounded border border-amber-500 bg-amber-950/50 px-3 py-2 text-sm text-amber-200">
          No burg in world {WORLD_SEED} falls in the <b>{band.typology}</b> band
          ({band.minPop.toLocaleString()}–{band.maxPop === Infinity ? '∞' : band.maxPop.toLocaleString()} people)
          {waterOnly ? ' AND carries water on its own cell' : ''}.
          {waterOnly
            ? ' Turn "Water burgs only" off, or pick another typology.'
            : ' Pick another typology — this harness will not stand in a different town for a band it cannot fill.'}
        </div>
      )}

      {burg && plan && profile && (
        <div className="text-xs text-slate-300 flex flex-wrap gap-x-4 gap-y-1">
          <span>burg: <b className="text-amber-200">{burg.name}</b> (#{burg.burgIndex})</span>
          <span>state: <b className="text-slate-100">{burg.stateName}</b></span>
          <span>typology: <b className="text-slate-100">{typologyForPopulation(burg.population)}</b></span>
          <span>pop: <b className="text-slate-100">{burg.population.toLocaleString()}</b></span>
          <span>wards: <b className="text-slate-100">{plan.wards.length}</b></span>
          <span>buildings: <b className="text-slate-100">{buildings}</b></span>
          <span>walls: <b className="text-slate-100">{plan.walls.ring.length > 0 ? 'yes' : 'no'}</b></span>
          <span>civic: <b className="text-slate-100">{civicKinds}</b></span>
          <span>port: <b className="text-slate-100">{burg.isPort ? 'yes' : 'no'}</b></span>
          <span>cell: <b className="text-slate-100">{burg.atlasCellId}</b></span>
        </div>
      )}

      {/* Population reconciliation: where the burg's souls actually live. */}
      {demo && plan && (
        <div className="text-xs text-emerald-200/90 flex flex-wrap gap-x-4 gap-y-1" data-testid="town-demographics">
          <span>accounted: <b className="text-emerald-100">{demo.accounted.toLocaleString()}</b> / {demo.population.toLocaleString()}</span>
          <span>urban: <b className="text-emerald-100">{demo.urban.toLocaleString()}</b></span>
          <span>rural: <b className="text-emerald-100">{demo.rural.toLocaleString()}</b> ({plan.farmsteads.length} farmsteads)</span>
          <span>dwellings: <b className="text-emerald-100">{demo.homes.toLocaleString()}</b> ({demo.renderedHomes} drawn)</span>
          <span>avg/home: <b className="text-emerald-100">{demo.avgHousehold}</b></span>
          <span>jobs: <b className="text-emerald-100">{demo.workplaces}</b></span>
          <span>architecture: <b className="text-emerald-100">{architectureDistricts} districts</b></span>
          <span>ages: <b className="text-emerald-100">
            {`${buildingAges.ancient} ancient · ${buildingAges.old} old · ` +
              `${buildingAges.aged} aged · ${buildingAges.new} new`}
          </b></span>
          <span>wealth: <b className="text-emerald-100">
            {(['wealthy', 'common', 'poor'] as const).map((cl) => `${plan.wards.filter((w) => w.wealth === cl).length} ${cl}`).join(' · ')}
          </b></span>
          <span>mix: <b className="text-emerald-100">
            {(['cottage', 'townhouse', 'tenement'] as const).map((t) => `${demo.byType[t] ?? 0} ${t}`).join(' · ')}
          </b></span>
        </div>
      )}

      <div className="flex-1 min-h-0 flex gap-3">
        {/* Panel 1 — 2D town map. */}
        <div ref={twoDRef} className={paneClass('2d')}>
          {plan && water && seedPath ? (
            <div className="absolute inset-0">
              <TownPlanView
                plan={plan}
                width={size2d.width}
                height={size2d.height}
                seedPath={seedPath}
                prefsScope={WORLD_SEED}
                styleFamily={styleFamily}
                settlementKey={burg ? `burg:${burg.burgIndex}` : undefined}
                water={water.rivers}
                coast={water.coast}
                riverWidth={water.riverWidthCanon}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
              {atlasError ? 'World failed to forge' : picks && !burg ? `No ${band.typology} in world ${WORLD_SEED}` : 'Forging world…'}
            </div>
          )}
          <span className="absolute top-1.5 left-2 text-[11px] text-slate-300 bg-black/50 px-1.5 py-0.5 rounded pointer-events-none">
            2D town map{burg ? ` — ${burg.name}` : ''}
          </span>
        </div>

        {/* Panel 2 — schematic 3D minimap, extruded from the SAME canonical plan. */}
        <div className={paneClass('3d')}>
          {plan && water ? (
            <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-slate-400">Loading 3D…</div>}>
              <Town3DScene key={`mini:${burg?.burgIndex}`} plan={plan} water={water.rivers} show={show} />
            </Suspense>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
              {atlasError ? 'World failed to forge' : picks && !burg ? `No ${band.typology} in world ${WORLD_SEED}` : 'Forging world…'}
            </div>
          )}
          <span className="absolute top-1.5 left-2 text-[11px] text-slate-300 bg-black/50 px-1.5 py-0.5 rounded pointer-events-none">
            3D minimap (same plan)
          </span>
        </div>

        {/* Panel 3 — the real streamed 3D world, exactly what the player sees. */}
        <div className={paneClass('world')}>
          {realError ? (
            <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-red-300">
              Real 3D bake failed for {burg?.name}: {realError}
            </div>
          ) : realScene && burg && realScene.burgIndex === burg.burgIndex ? (
            <>
            <div className="absolute inset-0">
              <World3DScene
                key={`world:${burg.burgIndex}`}
                loader={realScene.scene.loader}
                start={realScene.scene.start}
                startSurfaceY={realScene.scene.startSurfaceY}
                viewProfile="ground"
                groundWorld={realScene.scene.ground}
                frameTownCellNonce={frameNonce}
                timeOfDayHours={hour}
              />
            </div>
            <div className="absolute top-1.5 right-2 flex items-center gap-2">
              {/* Hour slider: 0–24, labelled; the night sky mounts below the
                  horizon (≈20.3h → ≈5.7h on this curve). */}
              <input
                type="range"
                min={0}
                max={23.9}
                step={0.1}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="w-28 accent-amber-400"
                aria-label="Time of day (hours)"
              />
              <span className="text-[11px] text-slate-200 bg-black/60 px-1 rounded tabular-nums">
                {String(Math.floor(hour)).padStart(2, '0')}:
                {String(Math.floor((hour % 1) * 60)).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => setFrameNonce((n) => n + 1)}
                className="rounded border border-slate-600 bg-black/60 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700"
              >
                Frame town
              </button>
            </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
              {baking
                ? `Baking the real 3D world around ${burg?.name ?? 'the burg'}…`
                : picks && !burg
                  ? `No ${band.typology} in world ${WORLD_SEED}`
                  : 'Forging world…'}
            </div>
          )}
          <span className="absolute top-1.5 left-2 text-[11px] text-slate-300 bg-black/50 px-1.5 py-0.5 rounded pointer-events-none">
            Real 3D town{burg ? ` — ${burg.name}` : ''}
          </span>
        </div>

        {/* Panel 4 — the LAND view (Remy 2026-08-24): the same baked burg, but
            the volume-ground bubble is the ONLY ground. No terrain sheets, no
            skirts, no far shells — buildings, streets, walls, and water stand
            on 240 m of substance volume. Same bake, so toggling is free. */}
        <div className={paneClass('land')}>
          {realError ? (
            <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-red-300">
              Real 3D bake failed for {burg?.name}: {realError}
            </div>
          ) : realScene && burg && realScene.burgIndex === burg.burgIndex ? (
            <>
            <div className="absolute inset-0">
              <World3DScene
                key={`land:${burg.burgIndex}`}
                loader={realScene.scene.loader}
                start={realScene.scene.landStart}
                startSurfaceY={realScene.scene.landStartSurfaceY}
                viewProfile="ground"
                groundWorld={realScene.scene.ground}
                frameTownCellNonce={frameNonce}
                terrainSkin={landSkin}
                volumeBubbleExtentM={realScene.scene.landExtentM}
                volumeBubbleCellM={realScene.scene.landCellM}
                volumeBubbleHeightM={realScene.scene.landHeightM}
                waterFlatColorHex={redWater ? '#cc2222' : undefined}
                layers={landLayers}
                timeOfDayHours={hour}
              />
            </div>
            <div className="absolute top-1.5 right-2 flex items-center gap-2">
              {/* Hour slider: 0–24, labelled; the night sky mounts below the
                  horizon (≈20.3h → ≈5.7h on this curve). */}
              <input
                type="range"
                min={0}
                max={23.9}
                step={0.1}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="w-28 accent-amber-400"
                aria-label="Time of day (hours)"
              />
              <span className="text-[11px] text-slate-200 bg-black/60 px-1 rounded tabular-nums">
                {String(Math.floor(hour)).padStart(2, '0')}:
                {String(Math.floor((hour % 1) * 60)).padStart(2, '0')}
              </span>
              <label className="flex items-center gap-1 rounded border border-slate-600 bg-black/60 px-2 py-0.5 text-[11px] text-slate-200">
                <input
                  type="checkbox"
                  checked={redWater}
                  onChange={(e) => setRedWater(e.target.checked)}
                  className="accent-red-500"
                />
                red water
              </label>
              <button
                type="button"
                onClick={() => setFrameNonce((n) => n + 1)}
                className="rounded border border-slate-600 bg-black/60 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700"
              >
                Frame town
              </button>
            </div>
            {/* THE LAYER STRIP (Remy 2026-08-25): every scene component the
                LAND pane composes, one chip each. A dim chip is a hidden
                layer. Instant — the scene flips `visible` flags, nothing
                rebuilds. */}
            <div className="absolute bottom-1.5 left-2 right-2 flex flex-wrap gap-1 pointer-events-none">
              <button
                type="button"
                onClick={() => setLandSkin((v) => !v)}
                aria-pressed={landSkin}
                className={`pointer-events-auto rounded border px-1.5 py-0.5 text-[11px] transition-colors ${
                  landSkin
                    ? 'border-emerald-500 bg-black/60 text-emerald-200'
                    : 'border-slate-700 bg-black/40 text-slate-500'
                }`}
                title="Heightfield terrain skin — off is the LAND view's volume-only ground"
              >
                skin
              </button>
              {LAND_LAYER_CHIPS.map(([key, label]) => {
                const shown = landLayers[key] !== false;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLandLayers((v) => ({ ...v, [key]: !shown }))}
                    aria-pressed={shown}
                    className={`pointer-events-auto rounded border px-1.5 py-0.5 text-[11px] transition-colors ${
                      shown
                        ? 'border-emerald-500 bg-black/60 text-emerald-200'
                        : 'border-slate-700 bg-black/40 text-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
              {baking
                ? `Baking the real 3D world around ${burg?.name ?? 'the burg'}…`
                : picks && !burg
                  ? `No ${band.typology} in world ${WORLD_SEED}`
                  : 'Forging world…'}
            </div>
          )}
          <span className="absolute top-1.5 left-2 text-[11px] text-slate-300 bg-black/50 px-1.5 py-0.5 rounded pointer-events-none">
            LAND 3D town{burg ? ` — ${burg.name}` : ''}{landSkin ? '' : ' (volume ground only)'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PreviewTown3D;
