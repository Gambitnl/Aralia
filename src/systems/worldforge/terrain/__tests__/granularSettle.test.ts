/**
 * Loose ground finding its angle of repose.
 *
 * Three things have to be true or the feature is a lie, and each is a test
 * below: matter is conserved to the CELL through a whole slump, the avalanche
 * terminates instead of cycling cells back and forth, and rock does not flow.
 * The fourth is what makes it a SUBSTANCE feature rather than a smoothing pass:
 * a flatter repose angle has to fan wider.
 */
import { describe, it, expect } from 'vitest';
import { Material, VoxelVolume } from '../voxelVolume';
import { beginSettle, isLooseMaterial, settleStep, settleToRest } from '../granularSettle';

const CELL = 0.25;

/** Count every non-air cell in a volume, per material and in total. */
function census(v: VoxelVolume): { total: number; byMaterial: Map<number, number> } {
  const byMaterial = new Map<number, number>();
  let total = 0;
  for (let z = 0; z < v.cells; z++) {
    for (let y = 0; y < v.cells; y++) {
      for (let x = 0; x < v.cells; x++) {
        const m = v.get(x, y, z);
        if (m === Material.Air) continue;
        total++;
        byMaterial.set(m, (byMaterial.get(m) ?? 0) + 1);
      }
    }
  }
  return { total, byMaterial };
}

/** Flat ground of one substance, solid from y=0 to `groundTop` inclusive. */
function ground(cells: number, groundTop: number, m: Material): VoxelVolume {
  const v = new VoxelVolume(cells);
  for (let z = 0; z < cells; z++) {
    for (let y = 0; y <= groundTop; y++) {
      for (let x = 0; x < cells; x++) v.set(x, y, z, m);
    }
  }
  return v;
}

/** A vertical-walled cylindrical bore, the shape a spell actually leaves. */
function bore(v: VoxelVolume, cx: number, cz: number, rCells: number, fromY: number, toY: number) {
  for (let y = toY; y <= fromY; y++) {
    for (let z = cz - rCells; z <= cz + rCells; z++) {
      for (let x = cx - rCells; x <= cx + rCells; x++) {
        const dx = x - cx;
        const dz = z - cz;
        if (dx * dx + dz * dz <= rCells * rCells) v.set(x, y, z, Material.Air);
      }
    }
  }
  return {
    min: [cx - rCells, toY, cz - rCells] as [number, number, number],
    max: [cx + rCells, fromY, cz + rCells] as [number, number, number],
  };
}

/** Topmost non-air cell of a column, or -1. */
function top(v: VoxelVolume, x: number, z: number): number {
  for (let y = v.cells - 1; y >= 0; y--) if (v.get(x, y, z) !== Material.Air) return y;
  return -1;
}

describe('who flows', () => {
  it('separates loose substances from rock-class ones', () => {
    // Granular and soft: these slide.
    for (const m of [
      Material.Topsoil, Material.Subsoil, Material.Sand, Material.Silt,
      Material.Gravel, Material.Clay, Material.Peat, Material.Litter, Material.Snow,
    ]) {
      expect(isLooseMaterial(m)).toBe(true);
    }
    // Rock, cemented, frozen, matted, and the two fluids: these do not.
    for (const m of [
      Material.Granite, Material.Limestone, Material.Sandstone, Material.Hardpan,
      Material.Permafrost, Material.Ice, Material.Turf, Material.Water, Material.Air,
    ]) {
      expect(isLooseMaterial(m)).toBe(false);
    }
  });
});

describe('conservation', () => {
  it('keeps the cell count exact through a full slump', () => {
    const v = ground(64, 39, Material.Topsoil);
    const before = census(v);
    const region = bore(v, 32, 32, 7, 39, 24);
    const afterCarve = census(v);
    expect(afterCarve.total).toBeLessThan(before.total); // the carve removed matter

    const r = settleToRest(v, region, CELL);
    expect(r).not.toBeNull();
    expect(r!.done).toBe(true);
    expect(r!.moved).toBeGreaterThan(0);

    const settled = census(v);
    // The slump moved matter; it did not create or destroy any.
    expect(settled.total).toBe(afterCarve.total);
    // And it moved the SUBSTANCE, not a generic cell: per-material counts hold.
    for (const [m, n] of afterCarve.byMaterial) {
      expect(settled.byMaterial.get(m) ?? 0).toBe(n);
    }
  });

  it('is conserved after EVERY time slice, not just at the end', () => {
    const v = ground(64, 39, Material.Sand);
    const region = bore(v, 32, 32, 7, 39, 26);
    const baseline = census(v).total;

    const f = beginSettle(v, region, CELL)!;
    expect(f).not.toBeNull();
    let guard = 0;
    let done = false;
    let slices = 0;
    while (!done && guard++ < 4096) {
      const r = settleStep(f, { cellsPerStep: 17, budgetMs: Infinity });
      done = r.done;
      slices++;
      // Lifting and setting down are one operation: there is no moment at
      // which a cell exists nowhere.
      expect(census(v).total).toBe(baseline);
    }
    expect(done).toBe(true);
    expect(slices).toBeGreaterThan(3); // it really was time-sliced
    expect(census(v).total).toBe(baseline);
  });

  it('conserves matter when the carve mixes substances', () => {
    // Soil over rock: the wall is soil, the floor the bore reaches is granite.
    const v = new VoxelVolume(64);
    for (let z = 0; z < 64; z++) {
      for (let x = 0; x < 64; x++) {
        for (let y = 0; y <= 39; y++) {
          v.set(x, y, z, y >= 32 ? Material.Topsoil : Material.Granite);
        }
      }
    }
    const region = bore(v, 32, 32, 6, 39, 30);
    const afterCarve = census(v);
    const r = settleToRest(v, region, CELL)!;
    const settled = census(v);
    expect(settled.total).toBe(afterCarve.total);
    expect(settled.byMaterial.get(Material.Granite)).toBe(
      afterCarve.byMaterial.get(Material.Granite),
    );
    expect(settled.byMaterial.get(Material.Topsoil)).toBe(
      afterCarve.byMaterial.get(Material.Topsoil),
    );
    // Soil reached the granite floor: the bore center is soil again.
    expect(v.get(32, 30, 32)).toBe(Material.Topsoil);
    expect(r.done).toBe(true);
  });
});

describe('repose convergence', () => {
  it('brings a vertical wall down to the substance angle', () => {
    const v = ground(64, 39, Material.Topsoil);
    const region = bore(v, 32, 32, 8, 39, 28);
    // Before: the rim column stands well over the floor beside it.
    const rimBefore = top(v, 32 - 9, 32) - top(v, 32 - 7, 32);
    expect(rimBefore).toBeGreaterThan(6);

    settleToRest(v, region, CELL);

    /* The physics claim, measured where it is made: the rise per cell up the
     * bowl wall is the substance's repose slope. Topsoil is 35 degrees, tan
     * 0.700. The band excludes both a vertical wall and the 45-degree
     * staircase a substance-blind smoothing pass would leave. */
    const inner = top(v, 32, 32);
    let outer = 32;
    while (outer < 60 && top(v, outer, 32) < 39) outer++;
    const mean = (top(v, outer, 32) - inner) / (outer - 32);
    expect(mean).toBeGreaterThan(0.55);
    expect(mean).toBeLessThan(0.85);

    /* And no adjacent pair is a cliff any more. The bound is two cells rather
     * than one because whole cells cannot draw a 0.70 slope: a column may
     * overhang its neighbour by up to the repose slope plus the one cell of
     * slack that keeps the grid's own staircase from being treated as a wall.
     * The eleven-cell sheer wall this started as is gone. */
    let worst = 0;
    for (let z = 20; z <= 44; z++) {
      for (let x = 20; x <= 44; x++) {
        const h = top(v, x, z);
        for (const [dx, dz] of [[1, 0], [0, 1]] as const) {
          const drop = Math.abs(h - top(v, x + dx, z + dz));
          if (drop > worst) worst = drop;
        }
      }
    }
    expect(worst).toBeLessThanOrEqual(2);
    expect(worst).toBeLessThan(rimBefore);
  });

  it('stops: extra slices after rest change nothing, and no cell cycles', () => {
    const v = ground(64, 39, Material.Sand);
    const region = bore(v, 32, 32, 7, 39, 27);
    const f = beginSettle(v, region, CELL)!;
    let guard = 0;
    let r = settleStep(f, { cellsPerStep: 512, budgetMs: Infinity });
    while (!r.done && guard++ < 4096) r = settleStep(f, { cellsPerStep: 512, budgetMs: Infinity });
    expect(r.done).toBe(true);
    const restedMoved = r.moved;
    const restedTops: number[] = [];
    for (let z = 16; z <= 48; z++) for (let x = 16; x <= 48; x++) restedTops.push(top(v, x, z));

    for (let i = 0; i < 10; i++) {
      const s = settleStep(f, { cellsPerStep: 512, budgetMs: Infinity });
      expect(s.changed).toBe(false);
      expect(s.moved).toBe(restedMoved);
      expect(s.waiting).toBe(0);
    }
    const again: number[] = [];
    for (let z = 16; z <= 48; z++) for (let x = 16; x <= 48; x++) again.push(top(v, x, z));
    expect(again).toEqual(restedTops);

    // And a FRESH field on the rested world finds nothing to shed.
    expect(beginSettle(v, region, CELL)).toBeNull();
  });

  it('finishes a deep bore in a handful of slices, not hundreds', () => {
    /* The pacing claim, and the reason this solver is an avalanche rather than
     * a diffusion: the first version needed twelve hundred sweeps on this
     * shape and was still churning on the live page after two minutes. */
    const v = ground(64, 39, Material.Silt);
    const region = bore(v, 32, 32, 9, 39, 20);
    const f = beginSettle(v, region, CELL)!;
    let slices = 0;
    let r = settleStep(f);
    slices++;
    while (!r.done) {
      r = settleStep(f);
      slices++;
      expect(slices).toBeLessThan(120);
    }
    expect(r.done).toBe(true);
    expect(r.moved).toBeGreaterThan(500);
    // Paced enough to WATCH: not one blocking snap.
    expect(slices).toBeGreaterThan(8);
  });
});

describe('rock immunity', () => {
  it('leaves a granite bore untouched — no field, no cost', () => {
    const v = ground(64, 39, Material.Granite);
    const region = bore(v, 32, 32, 8, 39, 26);
    const before = census(v);
    expect(beginSettle(v, region, CELL)).toBeNull();
    expect(settleToRest(v, region, CELL)).toBeNull();
    expect(census(v).total).toBe(before.total);
    // The wall is still sheer: the rim stands eleven cells over the floor.
    expect(top(v, 32, 32)).toBe(25);
    expect(top(v, 32, 32 - 9)).toBe(39);
  });

  it('keeps a granite overhang while a soil overhang slumps', () => {
    /** A lone tower of `m` standing in a hollow. */
    const tower = (m: Material): VoxelVolume => {
      const v = ground(48, 31, m);
      for (let z = 0; z < 48; z++) {
        for (let x = 0; x < 48; x++) {
          if (x >= 20 && x <= 27 && z >= 20 && z <= 27) continue;
          for (let y = 20; y <= 31; y++) v.set(x, y, z, Material.Air);
        }
      }
      return v;
    };
    const region = { min: [16, 20, 16] as const, max: [31, 31, 31] as const };

    const rock = tower(Material.Granite);
    expect(beginSettle(rock, region, CELL)).toBeNull();
    expect(top(rock, 24, 24)).toBe(31); // the granite tower still stands

    const soil = tower(Material.Subsoil);
    const beforeSoil = census(soil).total;
    const r = settleToRest(soil, region, CELL);
    expect(r).not.toBeNull();
    expect(r!.moved).toBeGreaterThan(0);
    expect(census(soil).total).toBe(beforeSoil);
    expect(top(soil, 24, 24)).toBeLessThan(31); // the soil tower slumped
  });

  it('lets loose material slide off a rock floor it cannot dissolve', () => {
    // A block of sand standing on granite. The granite never moves.
    const v = ground(64, 19, Material.Granite);
    for (let z = 28; z <= 36; z++) {
      for (let x = 28; x <= 36; x++) {
        for (let y = 20; y <= 32; y++) v.set(x, y, z, Material.Sand);
      }
    }
    const before = census(v);
    const r = settleToRest(v, { min: [28, 20, 28], max: [36, 32, 36] }, CELL)!;
    const after = census(v);
    expect(after.total).toBe(before.total);
    expect(after.byMaterial.get(Material.Granite)).toBe(before.byMaterial.get(Material.Granite));
    expect(after.byMaterial.get(Material.Sand)).toBe(before.byMaterial.get(Material.Sand));
    // The pile is lower and wider than the block it started as.
    expect(top(v, 32, 32)).toBeLessThan(32);
    expect(top(v, 26, 32)).toBeGreaterThan(19);
    expect(r.done).toBe(true);
  });

  it('will not push a cell into a roofed column', () => {
    /* A sand block under a granite lid one cell above the floor beside it: the
     * only downhill landing is sealed, so nothing moves and nothing is lost. */
    const v = ground(48, 19, Material.Granite);
    for (let z = 20; z <= 27; z++) {
      for (let x = 20; x <= 27; x++) {
        for (let y = 20; y <= 30; y++) v.set(x, y, z, Material.Sand);
      }
    }
    // Lid over every column around the block, one cell above the rock floor.
    for (let z = 14; z <= 33; z++) {
      for (let x = 14; x <= 33; x++) {
        if (x >= 20 && x <= 27 && z >= 20 && z <= 27) continue;
        v.set(x, 21, z, Material.Granite);
      }
    }
    const before = census(v);
    settleToRest(v, { min: [20, 20, 20], max: [27, 30, 27] }, CELL);
    expect(census(v).total).toBe(before.total);
  });
});

describe('substance awareness', () => {
  /** A block of `m` on granite, settled; returns the volume. */
  const settledBlock = (m: Material): VoxelVolume => {
    const v = ground(80, 19, Material.Granite);
    for (let z = 36; z <= 44; z++) {
      for (let x = 36; x <= 44; x++) {
        for (let y = 20; y <= 33; y++) v.set(x, y, z, m);
      }
    }
    settleToRest(v, { min: [36, 20, 36], max: [44, 33, 44] }, CELL);
    return v;
  };

  it('fans a flat-repose substance wider than a steep-repose one', () => {
    const runout = (m: Material): number => {
      const v = settledBlock(m);
      let far = 0;
      for (let x = 40; x < 80; x++) if (top(v, x, 40) > 19) far = x - 40;
      return far;
    };
    // Sand rests at 34 degrees, clay at 50. The flatter one has to travel.
    expect(runout(Material.Sand)).toBeGreaterThan(runout(Material.Clay));
  });

  it('reads the repose angle from the exposed substance, not from the brush', () => {
    // Same geometry, two substances: the steeper one keeps a taller pile.
    const peak = (m: Material): number => top(settledBlock(m), 40, 40);
    expect(peak(Material.Clay)).toBeGreaterThan(peak(Material.Sand));
  });
});
