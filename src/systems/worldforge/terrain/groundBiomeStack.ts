/**
 * @file groundBiomeStack.ts — what the STREAMED world's ground is made of,
 * column by column.
 *
 * IMPL-1's first open call, in one sentence: the live volume bubble was filled
 * from `DEFAULT_STACK` — temperate forest litter — wherever the player stood,
 * so a dark brown disc was let into a pale snow-and-sand mountainside. The
 * substance registry has carried `BIOME_GROUND` the whole time. This file is the
 * wire, and the wire is not a one-liner, because the two ends speak different
 * languages.
 *
 * TWO VOCABULARIES, AND WHY BOTH ARE RIGHT
 *
 * `BIOME_GROUND` is keyed by FMG biome id, 0 to 12 — the atlas vocabulary, which
 * is a CLIMATE classification. The streamed ground speaks a different one: the
 * L2 `LocalArtifact` collapses the atlas biome into eight surface MATERIALS at
 * generation time (`groundWorldAdapter.MATERIAL_BIOME`), and what reaches
 * `GroundWorld.biomeIds` is the `terrainColor` palette id the heightfield tints
 * itself with. Those ids include four things FMG has no biome for at all —
 * `mountain`, `dirt`, `paved`, `floor` — because they are SURFACES, not climates.
 *
 * So the table below is total over the palette vocabulary, and it is the same
 * shape IMPL-4 chose for the combat arena: every id with an honest FMG
 * counterpart points STRAIGHT AT `BIOME_GROUND`, so a wetland bubble and a
 * wetland arena are made of the same peat; the four that have none name their
 * own stacks out of the same substance registry. Unknown ids throw. There is no
 * default, because a bubble that silently became forest litter is the exact bug
 * this file exists to remove.
 *
 * THE SNOW LINE IS PART OF THE GROUND, NOT PART OF THE WEATHER
 *
 * `sampleGroundChunk` paints snow on any vertex above the window's snow line
 * whose slope is gentle enough to hold it. That is the single largest tonal
 * feature of high country and no biome id carries it — a summit cell is still
 * `mountain`. A bubble that ignores it is a brown patch in a snowfield, which is
 * IMPL-1's complaint with a white background instead of a pale one. So the
 * sampler asks the same two questions the heightfield asks (encoded height
 * against the snow line, slope against the shed rule) and caps the column's
 * stack with real snow when the answer is yes.
 *
 * WHAT THIS FILE MAY NOT DO: import the bridge. `groundChunkLoader` is one of
 * the largest modules in the repo, and pulling it in here would make every
 * volume test load the town generator. The sampler takes plain arrays, the same
 * discipline `groundSource` already keeps.
 */
import { Material } from './voxelVolume';
import { GroundBand, BIOME_GROUND, substance } from './materials';

/**
 * How many bands a stack may carry.
 *
 * The substance shader's band arrays are fixed-size and its loop stops at that
 * size, so a seventh band would be dropped SILENTLY — the worst kind of wrong,
 * because the picture stays plausible. `MAX_BANDS` in
 * `components/World3D/terrain/substanceGroundMaterial.ts` is the real bound;
 * duplicating the number here rather than importing it keeps this module free of
 * a dependency on a React component tree, and the test asserts the two agree.
 */
export const MAX_STACK_BANDS = 6;

/* ------------------------------------------------------- surface-only stacks */

/**
 * Bare mountain: scree over a cemented pan over bedrock.
 *
 * `mountain` is what the adapter emits for the `rock` terrain material, and
 * there is no FMG biome for it because elevation is not a climate. Remy's ask
 * for this slice was literally "a mountain bubble is rock", and this is the
 * shortest stack in the file for that reason: a quarter metre of loose stone,
 * then hardpan, then granite all the way down. Dig anywhere on it and you are
 * into rock inside a metre.
 */
export const MOUNTAIN_STACK: readonly GroundBand[] = [
  { substance: Material.Gravel, depthM: 0.25 },
  { substance: Material.Hardpan, depthM: 0.9 },
  { substance: Material.Granite, depthM: Infinity },
];

/**
 * Packed earth: trails, taiga and tundra floor, shorelines.
 *
 * `dirt` is the most OVERLOADED id in the vocabulary — the adapter's own comment
 * admits it carries taiga and tundra cells as well as beaten paths, because the
 * L2 artifact threw the distinction away. It gets its own stack rather than
 * borrowing taiga's, for one measurable reason: taiga leads with leaf litter,
 * which is the darkest substance in the registry and identical to the temperate
 * forest top, so a `dirt` bubble built on taiga would be indistinguishable from
 * a `forest_floor` bubble on the contact sheet. The heightfield draws `dirt` as
 * warm packed brown, and topsoil is the substance that means that.
 */
export const DIRT_STACK: readonly GroundBand[] = [
  { substance: Material.Topsoil, depthM: 0.35 },
  { substance: Material.Subsoil, depthM: 1.4 },
  { substance: Material.Hardpan, depthM: 2.6 },
  { substance: Material.Granite, depthM: Infinity },
];

/**
 * Worked stone paving: flags on a bedding course, over the ground it was laid on.
 *
 * A town street. The top band is thin on purpose — a flagstone is a hand's
 * width, and a cut through a street should show the paving as a LID over made
 * ground rather than as a metre of solid rock.
 */
export const PAVED_STACK: readonly GroundBand[] = [
  { substance: Material.Limestone, depthM: 0.22 },
  { substance: Material.Gravel, depthM: 0.6 },
  { substance: Material.Subsoil, depthM: 1.8 },
  { substance: Material.Granite, depthM: Infinity },
];

/**
 * Interior boards — described as the MADE GROUND UNDER them, because the
 * registry has no timber.
 *
 * This is an honest gap, not a choice. `SUBSTANCES` runs from litter to granite
 * and has no wood, so a floorboard cannot be named. A `floor` column therefore
 * gets the packed rubble a building sits on, and a cut through one shows that
 * rubble instead of a joist void. Recorded as a Remy call rather than papered
 * over: adding `Material.Wood` is a change to the shared voxel enum and every
 * module that switches on it.
 */
export const FLOOR_STACK: readonly GroundBand[] = [
  { substance: Material.Hardpan, depthM: 0.3 },
  { substance: Material.Subsoil, depthM: 1.5 },
  { substance: Material.Granite, depthM: Infinity },
];

/**
 * The ground under each biome id the STREAMED world can name.
 *
 * Total over the `terrainColor` palette — the vocabulary `biomeColor` tints the
 * heightfield from — so the bubble and the surface it lies in are answering the
 * same question from the same list.
 */
export const GROUND_BIOME_STACK: Readonly<Record<string, readonly GroundBand[]>> = {
  // Water bodies read as a BED, not as water: the volume is the solid under the
  // sheet, and the sheet is `WaterSystem`'s business.
  ocean: BIOME_GROUND[0],
  water: BIOME_GROUND[0],
  desert: BIOME_GROUND[1],
  plains: BIOME_GROUND[4],
  grassland: BIOME_GROUND[4],
  forest: BIOME_GROUND[6],
  forest_floor: BIOME_GROUND[6],
  jungle: BIOME_GROUND[7],
  tundra: BIOME_GROUND[10],
  wetland: BIOME_GROUND[12],
  swamp: BIOME_GROUND[12],
  ice: BIOME_GROUND[11],
  mountain: MOUNTAIN_STACK,
  dirt: DIRT_STACK,
  paved: PAVED_STACK,
  floor: FLOOR_STACK,
};

/** The stack under a streamed-world biome id, or an error. Never a guess. */
export function groundStackForWorldBiome(biomeId: string): readonly GroundBand[] {
  const stack = GROUND_BIOME_STACK[biomeId];
  if (!stack) {
    throw new Error(
      `No ground stack for streamed biome '${biomeId}' ` +
        `(known ids: ${Object.keys(GROUND_BIOME_STACK).join(', ')})`,
    );
  }
  return stack;
}

/** How deep the snow lies on a capped column. */
export const SNOW_CAP_M = 0.35;

/**
 * Put snow on top of a stack, and push everything else down under it.
 *
 * The depths in a `GroundBand` are absolute below the surface, so prepending a
 * band without SHIFTING the rest would quietly delete every horizon shallower
 * than the snow — a snow-capped grassland would lose its turf and read as snow
 * straight onto topsoil. Each finite depth moves down by the cap thickness;
 * infinity stays infinity.
 *
 * A stack that already starts in snow or ice (glacier) is returned untouched:
 * capping it would give it two snow bands and cost it its ice.
 */
export function withSnowCap(
  stack: readonly GroundBand[],
  capM: number = SNOW_CAP_M,
): readonly GroundBand[] {
  const top = stack[0]?.substance;
  if (top === Material.Snow || top === Material.Ice) return stack;
  return [
    { substance: Material.Snow, depthM: capM },
    ...stack.map((b) => ({
      substance: b.substance,
      depthM: Number.isFinite(b.depthM) ? b.depthM + capM : b.depthM,
    })),
  ];
}

/* ------------------------------------------------------------ the sampler */

/**
 * The pieces of a `GroundWorld` a column stack is decided from.
 *
 * Taken as plain arrays rather than the `GroundWorld` type so this module does
 * not import the bridge — see the file header.
 */
export interface ColumnBiomeGrid {
  cols: number;
  rows: number;
  /** World meters per grid cell. 1.524 (five feet) in every window today. */
  metersPerCell: number;
  biomeIds: readonly string[];
  /** Encoded 0..100 heights, row-major — the units the snow line is measured in. */
  heights: readonly number[];
  /** This window's snow line, encoded height units. */
  snowLineH: number;
}

/** One column's ground: which stack, and the name of the stack. */
export interface ColumnStack {
  /**
   * A stable name for this stack — the biome id, plus `+snow` when the column
   * is capped. The bubble counts these to pick ONE stack for its material, so
   * the name has to distinguish a snowy summit from a bare one.
   */
  key: string;
  stack: readonly GroundBand[];
}

/**
 * The snow band width the heightfield fades over, encoded height units.
 * Mirrors `SNOW_BAND` in `mountains/mountainTunables`.
 */
const SNOW_BAND = 12;

/**
 * How far apart the slope samples sit, world meters.
 *
 * The heightfield measures its snow-shedding slope on its own drawn lattice —
 * one vertex every 8 m — and a bubble that measured it on the 1.524 m artifact
 * grid would see far more slope, shed far more snow, and speckle the summit.
 * The run is the lattice, so the two agree.
 */
const SLOPE_RUN_M = 8;

/**
 * Steepness scale, matching `groundChunkLoader.SLOPE01_SCALE`.
 * Calibrated there so a linear `gradient * scale` meets the mesh's own
 * `1 - n.up` convention at a 45 degree ramp.
 */
const SLOPE01_SCALE = 0.2929;

/** How hard slope sheds snow. Mirrors the heightfield's `1 - slope01 * 3.2`. */
const SNOW_SHED = 3.2;

/**
 * Above this share of the heightfield's snow blend, the column is snow.
 *
 * The heightfield BLENDS toward white over the band; a voxel column cannot be
 * half snow, so it steps. Half is the only threshold that puts the step where
 * the blend crosses the halfway tone.
 */
const SNOW_STEP_T = 0.5;

/**
 * Which stack each column of ground is built from.
 *
 * `surfaceYAt` must be the height the terrain DRAWS (`streamedTerrainSurfaceY`),
 * not the artifact's detail surface — the slope that decides snow is the slope
 * the player can see, and the two differ by up to a metre over one bubble.
 */
export function makeColumnStackSampler(
  grid: ColumnBiomeGrid,
  surfaceYAt: (xM: number, zM: number) => number,
): (xM: number, zM: number) => ColumnStack {
  const { cols, rows, metersPerCell: mpc, biomeIds, heights, snowLineH } = grid;
  const clampX = (v: number) => (v < 0 ? 0 : v > cols - 1 ? cols - 1 : v);
  const clampY = (v: number) => (v < 0 ? 0 : v > rows - 1 ? rows - 1 : v);

  /* One `ColumnStack` object per key, not per column. A 256-square bubble asks
   * this 65,536 times and the answers repeat; allocating a fresh stack array for
   * each would cost more than the fill it feeds. */
  const cache = new Map<string, ColumnStack>();
  const resolve = (biomeId: string, snowy: boolean): ColumnStack => {
    const key = snowy ? `${biomeId}+snow` : biomeId;
    const hit = cache.get(key);
    if (hit) return hit;
    const base = groundStackForWorldBiome(biomeId);
    const made: ColumnStack = { key, stack: snowy ? withSnowCap(base) : base };
    cache.set(key, made);
    return made;
  };

  /** Encoded height, bilinear on the artifact grid — the heightfield's pass 1. */
  const encAt = (xM: number, zM: number): number => {
    const gx = clampX(xM / mpc);
    const gy = clampY(zM / mpc);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = clampX(x0 + 1);
    const y1 = clampY(y0 + 1);
    const fx = gx - x0;
    const fy = gy - y0;
    const h = (xx: number, yy: number): number => heights[yy * cols + xx] ?? 0;
    const top = h(x0, y0) * (1 - fx) + h(x1, y0) * fx;
    const bot = h(x0, y1) * (1 - fx) + h(x1, y1) * fx;
    return top * (1 - fy) + bot * fy;
  };

  return (xM: number, zM: number): ColumnStack => {
    // Nearest cell, exactly as `sampleGroundChunk` picks its biome.
    const bx = clampX(Math.round(xM / mpc));
    const by = clampY(Math.round(zM / mpc));
    const biomeId = biomeIds[by * cols + bx];
    if (biomeId === undefined) {
      throw new Error(
        `groundBiomeStack: no biome at grid cell (${bx}, ${by}) of ${cols}x${rows}`,
      );
    }

    const enc = encAt(xM, zM);
    if (enc < snowLineH) return resolve(biomeId, false);

    // The shed test, in world meters: a central difference over the terrain's
    // own lattice run, scaled to the mesh's steepness convention.
    const r = SLOPE_RUN_M;
    const gx = (surfaceYAt(xM + r, zM) - surfaceYAt(xM - r, zM)) / (2 * r);
    const gz = (surfaceYAt(xM, zM + r) - surfaceYAt(xM, zM - r)) / (2 * r);
    const slope01 = Math.min(1, Math.hypot(gx, gz) * SLOPE01_SCALE);
    const shed = Math.max(0, 1 - slope01 * SNOW_SHED);
    const t = Math.min(1, (enc - snowLineH) / SNOW_BAND) * shed;
    return resolve(biomeId, t >= SNOW_STEP_T);
  };
}

/**
 * The linear RGB a column's TOP band shows.
 *
 * The substance shader carries ONE band stack per material, so a bubble spanning
 * two biomes can only draw one set of strata. Its weathered top, though, takes a
 * per-vertex tint (`aTint`), and this is what that tint is built from: the ratio
 * between a column's own surface substance and the bubble stack's. A river bar
 * inside a grassland bubble then reads as sand instead of as turf.
 */
export function topColorOfStack(stack: readonly GroundBand[]): readonly [number, number, number] {
  return substance(stack[0].substance).rgb;
}
