/**
 * Where water can lie on a voxel volume.
 *
 * The 2D water solver needs a bed: one height per column. A heightfield hands
 * that over for free, which is why the water page has been running on one. A
 * volume does not, and the difference is the entire reason the volume exists.
 *
 * A column of voxels is not one surface. Bore a tunnel through a hill and that
 * column has TWO places water can lie: the hillside on top, and the tunnel
 * floor underneath, with rock between them. Ask such a column for "the height
 * of the ground" and every answer is wrong. Take the topmost solid and water
 * sits on the tunnel's roof. Take the lowest and water floods the rock.
 *
 * So a column is read as a list of SPANS — each an open gap with a floor below
 * it and a ceiling above, or open sky. Water lives in a span, not on a height.
 *
 * The topmost span is the open-air one, and running the existing 2D solver on
 * its floor gives correct water everywhere a heightfield was already correct,
 * plus correct water inside a crater carved after the fact. Lower spans are
 * where tunnel water goes, and they are why this returns a list rather than a
 * number.
 */
import { Material, VoxelVolume } from './voxelVolume';

/** One open gap in a column, in world meters. */
export interface Span {
  /** Top of the solid below the gap. Water rests here. */
  floorY: number;
  /**
   * Bottom of the solid above the gap, or Infinity when the gap is open sky.
   *
   * This is what caps a flooded tunnel. Water in a closed span cannot rise past
   * it, and a solver that ignores it will happily push water through rock.
   */
  ceilY: number;
  /** The substance the floor is made of. Decides drainage and footing. */
  floorMaterial: Material;
}

export interface SurfaceTarget {
  volume: VoxelVolume;
  /** Cell size on X and Z, meters. */
  cellM: number;
  /**
   * Cell size on Y, meters. Defaults to `cellM` — the cubic volume every caller
   * had before the axes came apart. A bed read with the wrong vertical cell is
   * a bed at the wrong HEIGHT, which the water then sits on, so this is not an
   * optional nicety: it is the same number `meshCellRange` was given.
   */
  cellHM?: number;
  originM: readonly [number, number, number];
}

/**
 * Every open span in one column, ordered from the TOP down.
 *
 * Ordered top-first because the open-sky span is the one almost every caller
 * wants, so the common case is `spans[0]` and needs no search.
 */
export function columnSpans(t: SurfaceTarget, x: number, z: number): Span[] {
  const { volume, originM } = t;
  const cellHM = t.cellHM ?? t.cellM;
  const n = volume.cells;
  const nY = volume.cellsY;
  const out: Span[] = [];
  if (x < 0 || z < 0 || x >= n || z >= n) return out;

  /* Walk down, and close a span only when solid appears BENEATH it.
   *
   * A gap with no solid under it inside this volume is not a place water can
   * lie — it is a hole out the bottom of the bubble. Emitting it would give the
   * solver a floor that is not there, and the water would pour through. */
  let ceilY = Number.POSITIVE_INFINITY; // open sky above the first gap
  let inGap = true;
  for (let y = nY - 1; y >= 0; y--) {
    const m = volume.get(x, y, z);
    if (m === Material.Air) {
      if (!inGap) {
        // Just left solid on the way down: this solid is the ceiling below.
        inGap = true;
        ceilY = originM[1] + (y + 1) * cellHM;
      }
      continue;
    }
    if (inGap) {
      // Solid under a gap. That gap has a real floor, so it is a span.
      out.push({
        floorY: originM[1] + (y + 1) * cellHM,
        ceilY,
        floorMaterial: m,
      });
      inGap = false;
    }
  }
  return out;
}

export interface VolumeBed {
  /** Bed height per column, world meters, laid out z * n + x. */
  bedY: Float32Array;
  /**
   * Ceiling above the bed per column. Infinity where the column is open sky.
   *
   * Carried alongside the bed because a bed alone cannot say when a column is
   * roofed, and a roofed column is the one case a plain heightfield gets wrong.
   */
  ceilY: Float32Array;
  /** Floor substance per column, for drainage and footing. */
  floor: Uint8Array;
  /** True where the column had no solid at all — a hole through the bubble. */
  bottomless: Uint8Array;
  cells: number;
}

/** The open-air bed of ONE column, in world meters. */
export interface BedColumn {
  bedY: number;
  ceilY: number;
  floor: Material;
  bottomless: boolean;
}

/**
 * Read one column's open-air bed — the per-column heart of `volumeBed`,
 * exposed so an EDIT can re-read only the columns it touched. Re-reading the
 * whole 240² grid after every brush stroke was a third of a second on the
 * main thread, all of it spent on columns the brush never came near.
 */
export function bedColumn(
  t: SurfaceTarget,
  x: number,
  z: number,
  drawnTopY?: Float32Array,
): BedColumn {
  const n = t.volume.cells;
  const nY = t.volume.cellsY;
  const cellHM = t.cellHM ?? t.cellM;
  const floorOfBubble = t.originM[1];
  const spans = columnSpans(t, x, z);
  if (spans.length === 0) {
    /* No open span at all: either solid to the top, or empty throughout.
     *
     * Solid to the top means the bed is the top of the bubble. Empty
     * throughout means there is nothing to hold water, and the column is
     * marked bottomless so the caller can drain it rather than pretend a
     * floor exists at the bubble's base. */
    const solidAtTop = t.volume.get(x, nY - 1, z) !== Material.Air;
    return {
      bedY: solidAtTop ? floorOfBubble + nY * cellHM : floorOfBubble,
      ceilY: Number.POSITIVE_INFINITY,
      floor: solidAtTop ? t.volume.get(x, nY - 1, z) : Material.Air,
      bottomless: !solidAtTop,
    };
  }
  const top = spans[0];
  /* Rest the water on the surface that is DRAWN, not on the voxel column.
   *
   * The mesher averages edge crossings, so the drawn ground sits up to a
   * cell below the column top. A bed taken from the column top therefore
   * floats the water above the hillside by up to a whole cell, in
   * cell-shaped slabs — which is exactly what it did.
   *
   * Only the top span is corrected, and only downward by less than a cell.
   * A cave floor deep in the volume has its own drawn surface that this
   * height field knows nothing about, and clamping the drop keeps a
   * mismatch from ever pushing a bed through the floor below it. */
  const drawn = drawnTopY?.[z * n + x];
  const useDrawn =
    drawn !== undefined &&
    Number.isFinite(drawn) &&
    drawn < top.floorY &&
    top.floorY - drawn < cellHM;
  return {
    bedY: useDrawn ? (drawn as number) : top.floorY,
    ceilY: top.ceilY,
    floor: top.floorMaterial,
    bottomless: false,
  };
}

/**
 * Read the open-air bed of the whole volume, one pass.
 *
 * This is the surface the 2D solver runs on. It is derived from the voxels, so
 * a spell that carves the volume changes the bed with no separate bookkeeping —
 * which was the point. The heightfield version needed the carve applied twice,
 * once to the mesh and once to the solver, and the two could disagree.
 */
export function volumeBed(t: SurfaceTarget, drawnTopY?: Float32Array): VolumeBed {
  const n = t.volume.cells;
  const bedY = new Float32Array(n * n);
  const ceilY = new Float32Array(n * n);
  const floor = new Uint8Array(n * n);
  const bottomless = new Uint8Array(n * n);

  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const col = bedColumn(t, x, z, drawnTopY);
      bedY[i] = col.bedY;
      ceilY[i] = col.ceilY;
      floor[i] = col.floor;
      bottomless[i] = col.bottomless ? 1 : 0;
    }
  }
  return { bedY, ceilY, floor, bottomless, cells: n };
}

/**
 * Clamp a water depth so it cannot rise through the roof of a covered column.
 *
 * The 2D solver knows nothing about ceilings — it was written for open ground,
 * where there is no roof to hit. Running it on a volume introduces roofed
 * columns for the first time, and without this a flooded tunnel would fill past
 * its ceiling and the surface would be drawn inside solid rock.
 *
 * Returns the depth that did not fit, so the caller can bank it rather than
 * delete it. Water that cannot rise has not stopped existing; it must push
 * somewhere else or wait.
 */
export function clampToCeiling(bed: VolumeBed, index: number, depthM: number): {
  kept: number;
  overflow: number;
} {
  const room = bed.ceilY[index] - bed.bedY[index];
  if (!Number.isFinite(room) || depthM <= room) return { kept: depthM, overflow: 0 };
  return { kept: Math.max(0, room), overflow: depthM - Math.max(0, room) };
}
