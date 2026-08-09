/**
 * @file groundVolumeFromWorld.ts — the missing link.
 *
 * Everything built for volume ground so far ran on `benchHeightM`, a noise
 * function written to measure memory. It is not Aralia's terrain. The fluid
 * proof, the bubble measurement and the MPM port all simulate against invented
 * ground, so none of them says anything about the world a player walks.
 *
 * Remy, 2026-08-07: "we need ground with a volume."
 *
 * This file fills a voxel volume from the LIVE GroundWorld — the same object
 * the streamed 3D world meshes, with its real heights, its carved river beds
 * and its town pads. From here on, a cut shows what the ground at that place is
 * actually made of, and water runs down a hillside somebody can recognize.
 *
 * WHAT A VOLUME NEEDS THAT A HEIGHTFIELD DOES NOT
 *
 * A heightfield answers "how high is the ground here". A volume answers "is
 * THIS POINT solid", which is a different question and the only one a fluid or
 * a tunnel can use. Filling one from the other is therefore a widening: every
 * column becomes solid from the bedrock up to its surface height, and the layer
 * stack decides what each cell is made of by its depth below that surface.
 *
 * The widening is lossy in one direction only. A heightfield cannot describe an
 * overhang, so a volume built from one has none — until something cuts it. That
 * is the point: the volume can hold a tunnel the heightfield could never store.
 */
import { Material, VoxelVolume } from './voxelVolume';
import { GroundBand, DEFAULT_STACK, substanceAtDepth } from './materials';

/** Just enough of GroundWorld to fill from. Keeps this file off the bridge. */
export interface GroundHeightSource {
  /** Surface height in world meters at a world point. */
  surfaceYAt(xM: number, zM: number): number;
  /** Material name at a world point, from the biome grid. Optional. */
  materialAt?(xM: number, zM: number): string | undefined;
}

export interface BubbleFill {
  volume: VoxelVolume;
  /** World position of cell (0,0,0), meters. */
  originM: readonly [number, number, number];
  cellM: number;
  cellsPerEdge: number;
  fillMs: number;
  /** Cells that hold matter. Reported so a caller can see the bubble is not empty. */
  solidCells: number;
}

/* The string-to-material switch that used to live here is gone.
 *
 * It mapped layer names — 'litter', 'topsoil' — onto voxel values, and anything
 * it did not recognize became bedrock. That silent default is what made a
 * per-biome stack impossible: adding sand or peat produced granite and no
 * error. A `GroundBand` now names its `Material` directly, so there is nothing
 * left to translate and nothing left to guess wrong.
 */

/**
 * How many cells a bubble of this size will have along one edge.
 *
 * Exported because the cost of a fill is this number CUBED, and a caller that
 * offers the user a choice of sizes has to know the cost before it commits to
 * one. Deriving it a second time in the caller is how a size picker ends up
 * disagreeing with the thing it sizes.
 *
 * The multiple of 8 is the brick edge in `VoxelVolume`, which rejects anything
 * else.
 */
export function bubbleCellsPerEdge(extentM: number, cellM: number): number {
  return Math.round(extentM / cellM / 8) * 8;
}

/**
 * Fill a bubble of voxels from real world ground.
 *
 * `centerXM`/`centerZM` are world meters — where the player stands. The bubble
 * is centered on that point horizontally, and vertically on the ground beneath
 * it, so the surface sits mid-bubble where a walking player puts it rather than
 * at the floor where an arbitrary origin would.
 *
 * Cost is dominated by the height sample, one per column. The measured fill for
 * a 64 m bubble at 25 cm is a few hundred milliseconds, which is why the ADR
 * requires this to run in a worker ahead of the player rather than on arrival.
 */
export function fillBubbleFromGround(
  src: GroundHeightSource,
  centerXM: number,
  centerZM: number,
  extentM: number,
  cellM: number,
  stack: readonly GroundBand[] = DEFAULT_STACK,
): BubbleFill {
  const t0 = Date.now();
  const cellsPerEdge = bubbleCellsPerEdge(extentM, cellM);
  const vol = new VoxelVolume(cellsPerEdge);

  const half = (cellsPerEdge * cellM) / 2;
  const originX = centerXM - half;
  const originZ = centerZM - half;
  // Vertical origin from the ground under the center, so the surface lands in
  // the middle of the bubble. A fixed origin would bury the bubble in a valley
  // and float it over a peak.
  const centerGround = src.surfaceYAt(centerXM, centerZM);
  const originY = centerGround - half;

  let solidCells = 0;
  for (let z = 0; z < cellsPerEdge; z++) {
    const wz = originZ + z * cellM;
    for (let x = 0; x < cellsPerEdge; x++) {
      const wx = originX + x * cellM;
      const surface = src.surfaceYAt(wx, wz);
      const topCell = Math.floor((surface - originY) / cellM);
      if (topCell < 0) continue;
      const yMax = Math.min(cellsPerEdge - 1, topCell);
      for (let y = 0; y <= yMax; y++) {
        const depth = surface - (originY + y * cellM);
        vol.set(x, y, z, substanceAtDepth(depth, stack).id);
        solidCells++;
      }
    }
  }
  vol.compact();

  return {
    volume: vol,
    originM: [originX, originY, originZ],
    cellM,
    cellsPerEdge,
    fillMs: Date.now() - t0,
    solidCells,
  };
}

/**
 * Adapt a GroundWorld into the height source above.
 *
 * Taken as a callback pair rather than the GroundWorld type so this module
 * does not import the bridge. `groundChunkLoader` is one of the largest files
 * in the repo and pulling it in would make every volume test load the town
 * generator.
 */
export function groundSource(
  surfaceYAt: (xM: number, zM: number) => number,
  materialAt?: (xM: number, zM: number) => string | undefined,
): GroundHeightSource {
  return { surfaceYAt, materialAt };
}
