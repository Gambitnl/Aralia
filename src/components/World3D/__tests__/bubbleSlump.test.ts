/**
 * @file bubbleSlump.test.ts — the slump inside the World3D bubble, and its lid.
 *
 * The bubble is not the sandbox. It is a 64 m CUBE of matter with the terrain
 * surface running through its middle, drawn as roughly a 30 cm lid over an
 * uncut heightfield (IMPL-6). Two consequences the sandbox never had:
 *
 *  - on steep ground a column near the cube's edge is EMPTY, because the land
 *    there is below the box. Steepest descent does not know that, and left
 *    unbounded it rolls a clod thirty metres down and sets it on the floor of
 *    the cube — under the heightfield, where the matter is gone for good;
 *  - the heightfield is never cut, so anything that leaves the lid is invisible
 *    as well as wrong. There is no frame in which the loss would show up.
 *
 * So the floor bound is not a tidiness feature; it is the thing that keeps the
 * conservation claim TRUE IN THE PICTURE and not only in the census. These
 * tests run the bubble's own fill and the bubble's own brush, and check both
 * halves: unbounded the matter leaves, bounded it does not, and both conserve.
 */
import { describe, it, expect } from 'vitest';
import { fillBubbleFromGround } from '@/systems/worldforge/terrain/groundVolumeFromWorld';
import { applyBrush } from '@/systems/worldforge/terrain/voxelBrush';
import { Material, VoxelVolume } from '@/systems/worldforge/terrain/voxelVolume';
import { DEFAULT_STACK } from '@/systems/worldforge/terrain/materials';
import { beginSettle, settleStep, settleToRest } from '@/systems/worldforge/terrain/granularSettle';

const EXTENT_M = 24;
const CELL_M = 0.25;

/**
 * A ridge that falls off a cliff — the shape the bound exists for.
 *
 * Flat ground over the west half of the footprint, then a drop far deeper than
 * the bubble's own half-height, so the columns east of the break have no matter
 * in the box at all. That is the void under the lid, reproduced exactly.
 */
function cliffSource(breakXM: number) {
  return {
    surfaceYAt: (xM: number): number => (xM < breakXM ? 100 : 40),
  };
}

/** Every non-air cell. */
function total(v: VoxelVolume): number {
  let n = 0;
  for (let z = 0; z < v.cells; z++) {
    for (let y = 0; y < v.cellsY; y++) {
      for (let x = 0; x < v.cells; x++) if (v.get(x, y, z) !== Material.Air) n++;
    }
  }
  return n;
}

/** Topmost non-air cell of a column, or -1. */
function top(v: VoxelVolume, x: number, z: number): number {
  for (let y = v.cellsY - 1; y >= 0; y--) if (v.get(x, y, z) !== Material.Air) return y;
  return -1;
}

/** The bubble's own fill, a trench cut into it, and where the cut reached. */
function bubbleWithTrench(breakXM: number) {
  const fill = fillBubbleFromGround(
    cliffSource(breakXM),
    breakXM - EXTENT_M / 4,
    0,
    EXTENT_M,
    CELL_M,
    DEFAULT_STACK,
  );
  /* A ditch along Z, the shape `__volBubble.carve` cuts by default: it follows
   * the ground down each column, so its walls are the full depth everywhere. */
  const r = applyBrush(
    { volume: fill.volume, cellM: fill.cellM, originM: fill.originM },
    [breakXM - 1.5, 100, 0],
    { shape: 'ditch', mode: 'dig', radiusM: 1.0, heightM: 2.0, lengthM: 8, axis: 'z' },
    DEFAULT_STACK,
  );
  return { fill, carve: r };
}

describe('the World3D bubble slumps inside its own lid', () => {
  it('unbounded, a slump beside the rim sheds matter into the void below the lid', () => {
    const { fill, carve } = bubbleWithTrench(0);
    expect(carve.changed).toBeGreaterThan(0);
    const before = total(fill.volume);

    const r = settleToRest(fill.volume, { min: carve.min, max: carve.max }, fill.cellM);
    expect(r).not.toBeNull();
    expect(r!.moved).toBeGreaterThan(0);
    // Cells are still conserved — the loss is a loss of VISIBILITY, not of mass.
    expect(total(fill.volume)).toBe(before);

    /* Matter is now standing in columns that held none: the cliff face has been
     * fed from above, thirty-odd cells below the ground the lid draws. */
    let intoTheVoid = 0;
    for (let z = 0; z < fill.cellsPerEdge; z++) {
      for (let x = 0; x < fill.cellsPerEdge; x++) {
        if (top(fill.volume, x, z) >= 0 && x > fill.cellsPerEdge * 0.55) intoTheVoid++;
      }
    }
    expect(intoTheVoid).toBeGreaterThan(0);
  });

  it('bounded by the floor of its own cut, nothing crosses the rim', () => {
    const { fill, carve } = bubbleWithTrench(0);
    const before = total(fill.volume);
    /* The bound the component sets: the lowest row the carve reached, less one
     * cell for the ground at the lip. See `SLUMP_FLOOR_MARGIN_CELLS`. */
    const floorCell = Math.max(0, carve.min[1] - 1);

    const f = beginSettle(
      fill.volume,
      { min: carve.min, max: carve.max },
      fill.cellM,
      { floorCell },
    );
    expect(f).not.toBeNull();
    let r = settleStep(f!, { cellsPerStep: 1 << 20, budgetMs: Infinity });
    while (!r.done) r = settleStep(f!, { cellsPerStep: 1 << 20, budgetMs: Infinity });

    // The trench walls still came in — the bound is not a way of doing nothing.
    expect(f!.moved).toBeGreaterThan(0);
    expect(total(fill.volume)).toBe(before);

    /* And every cell that moved is at or above the bound. Nothing is standing
     * in a column that was empty, anywhere in the window. */
    for (let z = 0; z < fill.cellsPerEdge; z++) {
      for (let x = 0; x < fill.cellsPerEdge; x++) {
        const t = top(fill.volume, x, z);
        if (t >= 0) expect(t).toBeGreaterThanOrEqual(floorCell);
      }
    }

    // The bound reports itself rather than being quietly right.
    expect(f!.floorCell).toBe(floorCell);
    expect(f!.blockedColumns).toBeGreaterThan(0);
    expect(f!.boundStops).toBeGreaterThan(0);
  });

  it('costs nothing where the bound cannot bite — a cut in the middle of the bubble', () => {
    /* The normal case, and the one the report has to name: a carve well inside
     * the core has no empty column within its padded window, so the bound
     * excludes no column and refuses no hop. The slump is the sandbox's slump.
     */
    const fill = fillBubbleFromGround(
      { surfaceYAt: () => 100 },
      0,
      0,
      EXTENT_M,
      CELL_M,
      DEFAULT_STACK,
    );
    const carve = applyBrush(
      { volume: fill.volume, cellM: fill.cellM, originM: fill.originM },
      [0, 100, 0],
      { shape: 'ditch', mode: 'dig', radiusM: 1.0, heightM: 2.0, lengthM: 8, axis: 'z' },
      DEFAULT_STACK,
    );
    const floorCell = Math.max(0, carve.min[1] - 1);
    const f = beginSettle(fill.volume, { min: carve.min, max: carve.max }, fill.cellM, {
      floorCell,
    });
    expect(f).not.toBeNull();
    let r = settleStep(f!, { cellsPerStep: 1 << 20, budgetMs: Infinity });
    while (!r.done) r = settleStep(f!, { cellsPerStep: 1 << 20, budgetMs: Infinity });
    expect(f!.moved).toBeGreaterThan(0);
    expect(f!.blockedColumns).toBe(0);
    expect(f!.boundStops).toBe(0);
  });
});
