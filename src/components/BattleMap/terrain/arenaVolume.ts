/**
 * @file arenaVolume.ts — the combat arena, as matter.
 *
 * The 3D battle map has always drawn its ground as a heightfield: one
 * subdivided plane whose vertices are lifted by tile elevation and whose colour
 * is chosen per fragment from a tile-type texture. That surface can answer
 * "how high is the ground here" and nothing else. It has no inside. A spell
 * that digs, water that pools in the hole it dug, a wall a sapper breaches — all
 * of them ask a question a skin cannot answer.
 *
 * The substance-true campaign built the answer for the streamed world: a voxel
 * volume filled from real ground, meshed with surface nets, coloured by the
 * substance registry, with a conservative 2D water field over the bed it
 * derives. This file is the combat arena's fill for that machinery.
 *
 * WHAT AN ARENA NEEDS THAT A STREAMED BUBBLE DOES NOT
 *
 * A bubble follows a player and is 64 m across. An arena is a FIXED, BOUNDED
 * rectangle — 120 by 90 tiles at the shipped size — and every square of it is
 * play space. There is no streaming, no rebuild, no centre to follow. It is
 * built once when the map is generated and it lives as long as the encounter.
 *
 * That bound is the whole reason this is affordable: one volume, one fill, one
 * mesh, and no per-frame ground work at all.
 *
 * THE SUBSTANCE UNDER A TILE IS A LOOKUP, NEVER A GUESS
 *
 * Two total tables decide what a column is made of, and both throw on an id
 * they do not know — the campaign's oldest lesson, from the day a string-keyed
 * material switch silently turned every unrecognised layer into bedrock and
 * made a per-biome stack impossible to build.
 *
 * - `ARENA_BIOME_STACK` covers every `BattleMapBiome`. Outdoor biomes point
 *   straight at `BIOME_GROUND`, the FMG-keyed table the streamed world uses, so
 *   a forest arena and a forest hillside are made of the same thing. Built and
 *   underground biomes — cave, dungeon, ruins, volcanic — have no FMG biome, so
 *   they name their own stack out of the same registry.
 * - `TERRAIN_STACK` covers every `BattleMapTerrain`. A rock outcrop, a sand
 *   patch, a stream bed and a dungeon flagstone contradict whatever the biome
 *   says, and where they do, the tile wins.
 *
 * UNITS, AND THE ONE PLACE THEY DISAGREE
 *
 * The battle map's horizontal unit is a TILE (five feet), and its vertical unit
 * is a METRE — `makeTerrainHeightSampler` multiplies tile elevation by
 * `BATTLE_MAP_ELEVATION_METERS_PER_UNIT` and returns real metres. That
 * pre-existing mismatch is inherited here rather than corrected: strata depths
 * are metres and are measured down the Y axis, which is metres, so every depth
 * in this file is honest. The horizontal cell size is in scene units, and the
 * shader's world-space noise frequencies are therefore 1.524x finer across the
 * ground than they are down a cut face. That is a look question, recorded, not
 * silently "fixed" by scaling one axis of a shared shader.
 */
import { BattleMapData, BattleMapTile, BattleMapBiome, BattleMapTerrain } from '../../../types/combat';
import { Material, VoxelVolume } from '@/systems/worldforge/terrain/voxelVolume';
import { GroundBand, BIOME_GROUND, substanceAtDepth, substance } from '@/systems/worldforge/terrain/materials';
import { makeTerrainHeightSampler } from './terrainHeightSampler';

/* --------------------------------------------------------------- the stacks */

/**
 * A ground stack per arena biome. TOTAL over `BATTLE_MAP_BIOMES`.
 *
 * The outdoor five borrow the FMG table so the tactical board and the world it
 * was cut from are made of the same substances. The built and underground five
 * have no FMG counterpart and name their own, all out of `SUBSTANCES`.
 */
export const ARENA_BIOME_STACK: Readonly<Record<BattleMapBiome, readonly GroundBand[]>> = {
  // 6 Temperate deciduous forest — litter, topsoil, subsoil, granite.
  forest: BIOME_GROUND[6],
  // 1 Hot desert — deep sand over a cemented pan.
  desert: BIOME_GROUND[1],
  // 12 Wetland — peat and silt on clay that holds the water in.
  swamp: BIOME_GROUND[12],
  // 10 Tundra — a thin living layer over ground that never thaws.
  snow: BIOME_GROUND[10],
  // 7 Tropical rainforest — famously thin soil over deep leached clay.
  jungle: BIOME_GROUND[7],
  // 0 Marine — the seabed stack, which is also what a beach is made of.
  coast: BIOME_GROUND[0],

  // A limestone cavern: rubble and washed silt on the rock it dissolved from.
  cave: [
    { substance: Material.Gravel, depthM: 0.18 },
    { substance: Material.Silt, depthM: 0.5 },
    { substance: Material.Limestone, depthM: Infinity },
  ],
  // A worked floor: dressed stone over its bedding course, then bedrock.
  dungeon: [
    { substance: Material.Limestone, depthM: 0.35 },
    { substance: Material.Gravel, depthM: 1.1 },
    { substance: Material.Granite, depthM: Infinity },
  ],
  // Ruins: collapse rubble, the soil that grew over it, the footings beneath.
  ruins: [
    { substance: Material.Gravel, depthM: 0.25 },
    { substance: Material.Topsoil, depthM: 0.8 },
    { substance: Material.Limestone, depthM: Infinity },
  ],
  // Volcanic: loose ash and lapilli over welded rock.
  volcanic: [
    { substance: Material.Gravel, depthM: 0.4 },
    { substance: Material.Hardpan, depthM: 1.4 },
    { substance: Material.Granite, depthM: Infinity },
  ],
};

/**
 * A ground stack per tile terrain, or null where the tile has nothing to say
 * and the biome's stack stands. TOTAL over `BattleMapTerrain`.
 */
export const TERRAIN_STACK: Readonly<Record<BattleMapTerrain, readonly GroundBand[] | null>> = {
  // Open ground: whatever the biome is made of.
  grass: null,
  // An outcrop. A thin skin of frost-shattered chips, then rock.
  rock: [
    { substance: Material.Gravel, depthM: 0.1 },
    { substance: Material.Granite, depthM: Infinity },
  ],
  // A bar or a dune: sand deep enough to dig a foxhole in.
  sand: [
    { substance: Material.Sand, depthM: 1.2 },
    { substance: Material.Hardpan, depthM: 2.4 },
    { substance: Material.Sandstone, depthM: Infinity },
  ],
  // A stream or pond BED. Silt on clay is why the water stays in it.
  water: [
    { substance: Material.Silt, depthM: 0.55 },
    { substance: Material.Clay, depthM: 2.5 },
    { substance: Material.Limestone, depthM: Infinity },
  ],
  // Difficult ground: churned, waterlogged, slow. Same as mud below.
  difficult: [
    { substance: Material.Peat, depthM: 0.3 },
    { substance: Material.Silt, depthM: 1.2 },
    { substance: Material.Clay, depthM: Infinity },
  ],
  mud: [
    { substance: Material.Peat, depthM: 0.3 },
    { substance: Material.Silt, depthM: 1.2 },
    { substance: Material.Clay, depthM: Infinity },
  ],
  // A built wall: dressed stone all the way through.
  wall: [
    { substance: Material.Limestone, depthM: 0.6 },
    { substance: Material.Granite, depthM: Infinity },
  ],
  // A laid floor: flags on their bedding.
  floor: [
    { substance: Material.Limestone, depthM: 0.35 },
    { substance: Material.Gravel, depthM: 1.1 },
    { substance: Material.Granite, depthM: Infinity },
  ],
};

/** The stack for one arena biome, or an error. Never a guess. */
export function arenaBiomeStack(biome: string): readonly GroundBand[] {
  const stack = ARENA_BIOME_STACK[biome as BattleMapBiome];
  if (!stack) {
    throw new Error(
      `No arena ground stack for biome "${biome}" ` +
        `(known: ${Object.keys(ARENA_BIOME_STACK).join(', ')})`,
    );
  }
  return stack;
}

/** The stack under one tile: the terrain's if it has one, else the biome's. */
export function stackForTile(
  biomeStack: readonly GroundBand[],
  terrain: BattleMapTerrain | undefined,
): readonly GroundBand[] {
  if (terrain === undefined) return biomeStack;
  if (!(terrain in TERRAIN_STACK)) {
    throw new Error(
      `No arena ground stack for terrain "${terrain}" ` +
        `(known: ${Object.keys(TERRAIN_STACK).join(', ')})`,
    );
  }
  return TERRAIN_STACK[terrain] ?? biomeStack;
}

/* --------------------------------------------------------------- the volume */

/**
 * Cells along one edge of the arena volume.
 *
 * `VoxelVolume` is cubic, so this one number sizes all three axes and the cell
 * size follows from the arena's longest side. 256 is the size the live world
 * bubble already ships and measures: 32,768 bricks, and a sparse fill of the
 * same character costs about 1.2 MB of cells.
 *
 * The volume is NO LONGER CUBIC. `VoxelVolume` grew an independent vertical
 * resolution, so this number sizes X and Z only and the arena buys exactly the
 * height it needs at `ARENA_CELL_H_M`. See `ARENA_CELL_H_M` for why.
 */
export const ARENA_CELLS = 256;

/**
 * The VERTICAL cell, in meters. The number this whole change exists for.
 *
 * At the shipped map size the horizontal cell is 0.47 units, and while the
 * volume was cubic that was the vertical cell too. The heightfield carves a
 * water basin `WATER_BASIN_DEPTH` deep under a stream tile — 1.4 elevation
 * units, which is **0.42 m**, LESS THAN ONE VOXEL. So a stream had no bed to
 * lie in: the settled field found the channel and its banks quantized to the
 * same cell, and 2.24 of the arena's 2.51 m³ ran off the boundary inside the
 * settle. What was left read as puddles, not as the stream the 2D map draws.
 *
 * 0.15 m puts nearly three cells in the shallowest basin the generator makes,
 * which is enough for a channel to hold a level and for the drawn bed to slope
 * rather than step. It is also the axis that is cheap to refine: Y costs a
 * factor, X and Z cost that factor squared.
 */
export const ARENA_CELL_H_M = 0.15;

/**
 * Ceiling on the vertical lattice. 512 cells at 0.15 m is 76.8 m of arena,
 * which is far past anything the generator makes; the cap exists so a map with
 * a broken elevation field cannot ask for a gigabyte of brick headers.
 */
export const ARENA_MAX_CELLS_Y = 512;

/**
 * The finest cell the arena will ever use, in scene units.
 *
 * Small maps stop here instead of subdividing to 256 cells they do not need:
 * a 40-tile arena at 256 cells would be 6 cm cells, four times finer than the
 * shipped world bubble, for a board nobody looks at that closely.
 */
export const ARENA_MIN_CELL = 0.25;

/**
 * How far the volume reaches BELOW the lowest ground in the arena, in metres.
 *
 * Deep enough that every stack in `ARENA_BIOME_STACK` reaches its bedrock band
 * inside the volume, so a crater wall shows the whole column rather than
 * running out of matter. The deepest finite band in the tables is the desert's
 * 9 m sandstone; 10 m clears it.
 */
export const ARENA_DEPTH_M = 10;

/**
 * How far in from the arena edge the volume surface dives under the
 * heightfield, in tiles, and how far below it ends up, in metres.
 *
 * The join is the one IMPL-1 proved on the streamed world, restated for a
 * rectangle. A volume is a box and a box ENDS: its border cells mesh into a
 * vertical cut wall standing in open ground, and no amount of matching heights
 * removes a wall. So the fill lifts the surface just over a cell inside the
 * arena and ramps it down through zero to `RIM_SINK_M` below the terrain at the
 * edge. What the camera sees is the HIGHER of two surfaces, and the higher of
 * two continuous surfaces is continuous.
 */
export const RIM_RAMP_TILES = 3;
export const RIM_SINK_M = 0.6;

export interface ArenaVolume {
  volume: VoxelVolume;
  /** Cell size in SCENE UNITS on X and Z. See the header. */
  cellM: number;
  /** Cell size in METRES on Y. Independent of `cellM` — see `ARENA_CELL_H_M`. */
  cellHM: number;
  /** Cells on Y. Sized to the arena's own vertical extent, not to `cells`. */
  cellsY: number;
  /** World position of cell (0,0,0). */
  originM: [number, number, number];
  /** Cells per edge — cubic, so all three axes. */
  cells: number;
  /**
   * The highest voxel-lattice row that holds anything. Everything above is air,
   * and the mesh plan skips it rather than walking 256 rows of nothing.
   */
  topOccupiedCell: number;
  /**
   * The drawn-ground height per voxel column BEFORE any carve, world Y, laid
   * out `z * cells + x`.
   *
   * This is the datum every strata depth reads against, and measuring it from
   * the CURRENT column top instead was the sandbox's round-one knockout: a
   * crater floor is the top of its own carved column, so every carved bowl read
   * depth zero and came back uniform surface litter with no strata at all.
   */
  originalTopY: Float32Array;
  /** The stack the MATERIAL draws its bands from — the arena's biome stack. */
  biomeStack: readonly GroundBand[];
  /** Surface substance per voxel column, for the per-tile top-surface tint. */
  surfaceMaterial: Uint8Array;
  fillMs: number;
  solidCells: number;
}

export interface ArenaVolumeOptions {
  /** Override the derived cell size, in scene units. Tests and benches use it. */
  cellM?: number;
  cells?: number;
  /** Override the vertical cell, in metres. Tests and benches use it. */
  cellHM?: number;
}

/* ------------------------------------------------------ the worker's input */

/** The terrain vocabulary, as an index a `Uint8Array` can carry. */
export const ARENA_TERRAIN_ORDER: readonly BattleMapTerrain[] = [
  'grass',
  'rock',
  'water',
  'difficult',
  'wall',
  'floor',
  'sand',
  'mud',
];

/**
 * A combat map's ground, flattened into transferable buffers.
 *
 * The fill needs four facts per tile and nothing else: how high it is, what it
 * is made of, whether it is a ford, and the map's seed and biome. A `Map` of
 * ten thousand `BattleMapTile` objects is the one thing `postMessage` cannot
 * hand over cheaply — structured clone would walk every tile, its coordinates
 * object, its crossing object and its decoration string. Three typed arrays
 * transfer with no copy at all.
 */
export interface ArenaTiles {
  width: number;
  height: number;
  seed: number;
  biome: string;
  /** Tile elevation, `y * width + x`. */
  elevation: Float32Array;
  /** Index into `ARENA_TERRAIN_ORDER`, `y * width + x`. */
  terrain: Uint8Array;
  /** 1 where the tile carries a ford crossing. */
  ford: Uint8Array;
}

/** Flatten a battle map into the fill's input. */
export function arenaTilesFromMapData(mapData: BattleMapData): ArenaTiles {
  const { width, height } = mapData.dimensions;
  const elevation = new Float32Array(width * height);
  const terrain = new Uint8Array(width * height);
  const ford = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = mapData.tiles.get(`${x}-${y}`);
      const i = y * width + x;
      if (!tile) continue;
      elevation[i] = tile.elevation;
      const ti = ARENA_TERRAIN_ORDER.indexOf(tile.terrain);
      if (ti < 0) {
        throw new Error(
          `Unknown battle-map terrain "${tile.terrain}" at ${x},${y} ` +
            `(known: ${ARENA_TERRAIN_ORDER.join(', ')})`,
        );
      }
      terrain[i] = ti;
      ford[i] = tile.crossing?.kind === 'ford' ? 1 : 0;
    }
  }
  return {
    width,
    height,
    seed: mapData.seed ?? 42,
    biome: (mapData as BattleMapData & { biome?: string }).biome ?? mapData.theme ?? 'forest',
    elevation,
    terrain,
    ford,
  };
}

/** The buffers of an `ArenaTiles`, for `postMessage`'s transfer list. */
export function transfersOfArenaTiles(t: ArenaTiles): ArrayBuffer[] {
  return [t.elevation.buffer, t.terrain.buffer, t.ford.buffer] as ArrayBuffer[];
}

/**
 * Rebuild the grid shape `makeTerrainHeightSampler` reads.
 *
 * The sampler wants `(BattleMapTile | null)[][]` and touches exactly three
 * fields of it. Ten thousand three-field objects cost a couple of milliseconds
 * and keep ONE surface formula in the codebase — which is the whole point of
 * the extraction. A second bicubic written against flat arrays would be faster
 * and would drift.
 */
function samplerGrid(t: ArenaTiles): (BattleMapTile | null)[][] {
  const grid: (BattleMapTile | null)[][] = [];
  for (let y = 0; y < t.height; y++) {
    const row: (BattleMapTile | null)[] = [];
    for (let x = 0; x < t.width; x++) {
      const i = y * t.width + x;
      row.push({
        elevation: t.elevation[i],
        terrain: ARENA_TERRAIN_ORDER[t.terrain[i]],
        crossing: t.ford[i] ? { kind: 'ford' } : undefined,
      } as unknown as BattleMapTile);
    }
    grid.push(row);
  }
  return grid;
}

/** The cell size an arena of this size gets. */
export function arenaCellM(width: number, height: number, cells = ARENA_CELLS): number {
  return Math.max(ARENA_MIN_CELL, Math.max(width, height) / cells);
}

/**
 * Fill a voxel volume from a combat map's tile grid.
 *
 * The height at a column is the SAME formula the heightfield draws — the shared
 * `makeTerrainHeightSampler`, bicubic elevation plus micro-noise, with water
 * tiles carved down into their basins. Filling from anything else would put the
 * volume ground and the heightfield fringe on two different surfaces, and the
 * rim join can only hide a difference it knows about.
 */
export function buildArenaVolume(
  tiles: ArenaTiles,
  opts: ArenaVolumeOptions = {},
): ArenaVolume {
  const t0 = Date.now();
  const { width, height } = tiles;

  const tileGrid = samplerGrid(tiles);

  const cells = opts.cells ?? ARENA_CELLS;
  const cellM = opts.cellM ?? arenaCellM(width, height, cells);
  const cellHM = opts.cellHM ?? ARENA_CELL_H_M;
  const sampleY = makeTerrainHeightSampler(tileGrid, width, height, tiles.seed);

  const biomeStack = arenaBiomeStack(tiles.biome);

  /* The rim join, as a rectangle.
   *
   * `dEdge` is the distance INTO the arena from its nearest side, in tiles.
   * Inside the ramp the surface is lifted just over a cell — the fill makes a
   * column solid up to `floor(...)`, so the drawn surface lands zero to one cell
   * BELOW the height it was filled from, and lifting past a cell puts it
   * reliably above the heightfield instead of dancing across it. Over the last
   * `RIM_RAMP_TILES` the lift ramps down through zero to `-RIM_SINK_M`, so the
   * border cut wall finishes under the terrain where the heightfield covers it.
   */
  /* The lift is a VERTICAL correction — the drawn top lands up to one cell
   * below the height the column was filled from — so it is measured in
   * vertical cells. At 0.15 m that is an 18 cm lift instead of 56 cm, which is
   * a smaller step for the rim ramp to swallow as well as a truer join. */
  const lift = cellHM * 1.2;
  const joinedY = (tx: number, tz: number): number => {
    const base = sampleY(tx, tz);
    const dEdge = Math.min(tx, width - tx, tz, height - tz);
    if (dEdge >= RIM_RAMP_TILES) return base + lift;
    const t = Math.min(1, Math.max(0, 1 - dEdge / RIM_RAMP_TILES));
    return base + lift - t * (lift + RIM_SINK_M);
  };

  /* The vertical origin: the lowest joined ground in the arena, less the depth
   * every stack needs to reach its bedrock. Sampled on the tile lattice rather
   * than per voxel — one pass over 10,800 tiles instead of 65,536 columns, and
   * the bicubic surface cannot swing far enough between tile centres to escape
   * the margin below. */
  let minY = Infinity;
  let maxY = -Infinity;
  for (let ty = 0; ty <= height; ty++) {
    for (let tx = 0; tx <= width; tx++) {
      const y = joinedY(tx, ty);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const originY = minY - ARENA_DEPTH_M;
  const originM: [number, number, number] = [0, originY, 0];

  /* The vertical lattice is bought to fit, not inherited from the horizontal
   * one. One tile-lattice cell of headroom above the highest joined ground
   * covers the bicubic surface swinging above the tile centres it was sampled
   * at; a column that still lands past the top is clamped by `yMax` below and
   * simply reaches the roof of the volume, which is the honest answer for
   * ground higher than the box. */
  const cellsY = Math.min(
    ARENA_MAX_CELLS_Y,
    Math.max(8, Math.ceil((maxY + 1 - originY) / cellHM / 8) * 8),
  );

  const vol = new VoxelVolume(cells, cellsY);
  const originalTopY = new Float32Array(cells * cells);
  const surfaceMaterial = new Uint8Array(cells * cells);
  let solidCells = 0;
  let topOccupiedCell = 0;

  for (let z = 0; z < cells; z++) {
    const wz = z * cellM;
    for (let x = 0; x < cells; x++) {
      const wx = x * cellM;
      const i = z * cells + x;
      /* Outside the arena rectangle the volume holds nothing: the heightfield
       * fringe owns that ground and always has. A column of rock out there
       * would mesh a wall along the arena border, which is the exact artefact
       * the rim ramp exists to prevent. */
      if (wx > width || wz > height) {
        originalTopY[i] = originY;
        surfaceMaterial[i] = Material.Air;
        continue;
      }
      const surface = joinedY(wx, wz);
      const topCell = Math.floor((surface - originY) / cellHM);
      if (topCell < 0) {
        originalTopY[i] = originY;
        surfaceMaterial[i] = Material.Air;
        continue;
      }
      const tile = tileGrid[Math.min(height - 1, Math.floor(wz))]?.[
        Math.min(width - 1, Math.floor(wx))
      ];
      const stack = stackForTile(biomeStack, tile?.terrain);
      const yMax = Math.min(cellsY - 1, topCell);
      if (yMax > topOccupiedCell) topOccupiedCell = yMax;
      for (let y = 0; y <= yMax; y++) {
        const depth = surface - (originY + y * cellHM);
        vol.set(x, y, z, substanceAtDepth(depth, stack).id);
        solidCells++;
      }
      originalTopY[i] = originY + (yMax + 1) * cellHM;
      surfaceMaterial[i] = substanceAtDepth(0, stack).id;
    }
  }
  vol.compact();

  return {
    volume: vol,
    cellM,
    cellHM,
    cellsY,
    originM,
    cells,
    topOccupiedCell,
    originalTopY,
    biomeStack,
    surfaceMaterial,
    fillMs: Date.now() - t0,
    solidCells,
  };
}

/**
 * The depth datum, with a DEADBAND of most of a cell.
 *
 * Surface nets places a vertex at the average of its edge crossings, so a
 * top-surface vertex sits up to a cell below the column top it belongs to.
 * Measured against the raw column top that vertex reports a depth anywhere from
 * zero to one cell, which sweeps across the shallow horizons and draws contour
 * bands on flat ground. Subtracting most of a cell means "the top surface is
 * the top surface".
 */
export function arenaDepthDatum(a: ArenaVolume): (xM: number, zM: number) => number {
  const n = a.cells;
  /* The deadband absorbs the mesher's own vertical placement error, so it is
   * measured in VERTICAL cells. At 0.15 m it is 11 cm rather than 35, which is
   * why the shallow horizons now survive the datum instead of being swallowed
   * by the correction meant to protect them. */
  const deadband = a.cellHM * 0.75;
  return (xM, zM) => {
    const x = Math.min(n - 1, Math.max(0, Math.floor((xM - a.originM[0]) / a.cellM)));
    const z = Math.min(n - 1, Math.max(0, Math.floor((zM - a.originM[2]) / a.cellM)));
    return a.originalTopY[z * n + x] - deadband;
  };
}

/**
 * The per-vertex TINT that keeps terrain types legible on the drawn top.
 *
 * The substance material draws its bands from ONE stack, chosen per surface,
 * and a combat map is the first place that is not enough: a rock outcrop, a
 * sand bar and a dungeon flagstone are gameplay-legible features, and a board
 * where all three read as forest litter is a board that got harder to play.
 *
 * So the top surface carries a per-vertex multiplier: the ratio between the
 * TILE's own surface substance and the stack's top band. It is applied only to
 * the weathered top and fades out with cut depth, so a cut through a rock tile
 * still shows the arena's true strata rather than a tinted lie about them. A
 * ratio rather than a replacement because everything the shader does to the top
 * band — macro noise, grain, the fine octave — should survive it.
 */
export function arenaSurfaceTint(
  a: ArenaVolume,
  positions: Float32Array,
): Float32Array {
  const n = a.cells;
  const top = substance(a.biomeStack[0].substance).rgb;
  const out = new Float32Array(positions.length);
  const cache = new Map<number, [number, number, number]>();
  for (let v = 0; v < positions.length; v += 3) {
    const x = Math.min(n - 1, Math.max(0, Math.floor((positions[v] - a.originM[0]) / a.cellM)));
    const z = Math.min(n - 1, Math.max(0, Math.floor((positions[v + 2] - a.originM[2]) / a.cellM)));
    const m = a.surfaceMaterial[z * n + x];
    let t = cache.get(m);
    if (!t) {
      if (m === Material.Air) {
        t = [1, 1, 1];
      } else {
        const rgb = substance(m as Material).rgb;
        /* Clamped, and not by much. A ratio is a free multiplier and an
         * unclamped one turns a bright substance over a dark stack into a
         * blown-out white patch that no lighting can recover. */
        t = [
          Math.min(3, Math.max(0.25, rgb[0] / Math.max(1e-4, top[0]))),
          Math.min(3, Math.max(0.25, rgb[1] / Math.max(1e-4, top[1]))),
          Math.min(3, Math.max(0.25, rgb[2] / Math.max(1e-4, top[2]))),
        ];
      }
      cache.set(m, t);
    }
    out[v] = t[0];
    out[v + 1] = t[1];
    out[v + 2] = t[2];
  }
  return out;
}
