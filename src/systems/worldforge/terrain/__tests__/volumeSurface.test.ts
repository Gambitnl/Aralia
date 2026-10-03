/**
 * Reading a water bed out of a volume.
 *
 * Every test here is a case where "one height per column" gives a WRONG answer.
 * That is the whole justification for the file: if a heightfield could answer
 * these, the volume would not be needed and neither would this.
 */
import { describe, it, expect } from 'vitest';
import { Material, VoxelVolume } from '../voxelVolume';
import { columnSpans, volumeBed, clampToCeiling, SurfaceTarget } from '../volumeSurface';
import { voxelsToSurface } from '../surfaceNets';

const CELL = 0.25;

/** Solid below `groundCell`, air above. Top of the solid sits at groundCell * CELL. */
function flat(cells = 32, groundCell = 16): SurfaceTarget {
  const volume = new VoxelVolume(cells);
  for (let z = 0; z < cells; z++) {
    for (let y = 0; y < groundCell; y++) {
      for (let x = 0; x < cells; x++) volume.set(x, y, z, Material.Granite);
    }
  }
  return { volume, cellM: CELL, originM: [0, 0, 0] };
}

describe('columnSpans', () => {
  it('reads one open-sky span on plain ground', () => {
    const t = flat();
    const spans = columnSpans(t, 4, 4);
    expect(spans.length).toBe(1);
    expect(spans[0].floorY).toBeCloseTo(16 * CELL, 6);
    expect(spans[0].ceilY).toBe(Infinity);
    expect(spans[0].floorMaterial).toBe(Material.Granite);
  });

  it('reads TWO spans through a tunnel, top first', () => {
    /* The case that breaks a heightfield.
     *
     * A hill with a bore through it has two places water can lie. Ask this
     * column for "the ground height" and every single answer is wrong: the
     * topmost solid puts water on the tunnel's ROOF, the lowest floods the
     * rock. Only a list is right. */
    const t = flat(32, 16);
    for (let y = 16; y < 28; y++) t.volume.set(4, y, 4, Material.Granite); // a hill
    for (let y = 18; y < 22; y++) t.volume.set(4, y, 4, Material.Air); // bored through

    const spans = columnSpans(t, 4, 4);
    expect(spans.length).toBe(2);
    // Top first: the hilltop, open to the sky.
    expect(spans[0].floorY).toBeCloseTo(28 * CELL, 6);
    expect(spans[0].ceilY).toBe(Infinity);
    // Then the tunnel, with a real roof over it.
    expect(spans[1].floorY).toBeCloseTo(18 * CELL, 6);
    expect(spans[1].ceilY).toBeCloseTo(22 * CELL, 6);
  });

  it('reports the substance each floor is made of', () => {
    const t = flat();
    t.volume.set(4, 15, 4, Material.Clay);
    expect(columnSpans(t, 4, 4)[0].floorMaterial).toBe(Material.Clay);
  });

  it('ignores a gap with no floor under it', () => {
    // A gap that runs out the bottom of the bubble is not a place water can
    // lie. Emitting it would hand the solver a floor that is not there, and the
    // water would pour straight through.
    const t = flat(32, 16);
    for (let y = 0; y < 16; y++) t.volume.set(4, y, 4, Material.Air);
    expect(columnSpans(t, 4, 4).length).toBe(0);
  });

  it('returns nothing outside the volume', () => {
    expect(columnSpans(flat(), -1, 4).length).toBe(0);
    expect(columnSpans(flat(), 4, 999).length).toBe(0);
  });
});

describe('volumeBed', () => {
  it('reads a flat bed off flat ground', () => {
    const bed = volumeBed(flat());
    for (let i = 0; i < bed.bedY.length; i++) {
      expect(bed.bedY[i]).toBeCloseTo(16 * CELL, 6);
      expect(bed.ceilY[i]).toBe(Infinity);
    }
  });

  it('FOLLOWS a crater carved after the fill', () => {
    /* The reason to derive the bed from the volume rather than keep one beside
     * it. The heightfield version needed every carve applied twice — once to
     * the mesh, once to the solver — and the two could disagree. On the water
     * page they did: water ran along a trench that was never drawn. */
    const t = flat();
    for (let y = 12; y < 16; y++) {
      for (let z = 6; z < 10; z++) {
        for (let x = 6; x < 10; x++) t.volume.set(x, y, z, Material.Air);
      }
    }
    const bed = volumeBed(t);
    const n = t.volume.cells;
    expect(bed.bedY[8 * n + 8]).toBeCloseTo(12 * CELL, 6);
    expect(bed.bedY[2 * n + 2]).toBeCloseTo(16 * CELL, 6);
  });

  it('keeps the bed on the HILLTOP where a tunnel runs beneath', () => {
    // Open-air water belongs on the hill, not in the bore. The bore is a lower
    // span, and it is reached through columnSpans, not through the bed.
    const t = flat(32, 16);
    for (let y = 16; y < 28; y++) t.volume.set(4, y, 4, Material.Granite);
    for (let y = 18; y < 22; y++) t.volume.set(4, y, 4, Material.Air);
    const bed = volumeBed(t);
    expect(bed.bedY[4 * t.volume.cells + 4]).toBeCloseTo(28 * CELL, 6);
  });

  it('marks a column with no solid as bottomless rather than inventing a floor', () => {
    const t = flat(32, 16);
    for (let y = 0; y < 16; y++) t.volume.set(4, y, 4, Material.Air);
    const bed = volumeBed(t);
    expect(bed.bottomless[4 * t.volume.cells + 4]).toBe(1);
  });

  it('carries the floor substance, so drainage can differ across the patch', () => {
    const t = flat();
    t.volume.set(4, 15, 4, Material.Clay);
    const bed = volumeBed(t);
    expect(bed.floor[4 * t.volume.cells + 4]).toBe(Material.Clay);
  });
});

describe('clampToCeiling', () => {
  function roofed(): { bed: ReturnType<typeof volumeBed>; i: number } {
    const t = flat(32, 16);
    for (let y = 16; y < 28; y++) t.volume.set(4, y, 4, Material.Granite);
    for (let y = 18; y < 22; y++) t.volume.set(4, y, 4, Material.Air);
    // Read the tunnel span directly and stand a one-column bed on it.
    const spans = columnSpans(t, 4, 4);
    const bed = volumeBed(t);
    const i = 4 * t.volume.cells + 4;
    bed.bedY[i] = spans[1].floorY;
    bed.ceilY[i] = spans[1].ceilY;
    return { bed, i };
  }

  it('lets water rise freely under open sky', () => {
    const bed = volumeBed(flat());
    expect(clampToCeiling(bed, 0, 99)).toEqual({ kept: 99, overflow: 0 });
  });

  it('stops water at a roof and RETURNS the excess', () => {
    /* The solver was written for open ground and knows nothing about ceilings.
     * Running it on a volume creates roofed columns for the first time, and
     * without this a flooded tunnel fills past its roof and the surface is
     * drawn inside solid rock.
     *
     * The excess is returned, not discarded. Water that cannot rise has not
     * stopped existing — it must push elsewhere or wait. */
    const { bed, i } = roofed();
    const room = bed.ceilY[i] - bed.bedY[i];
    expect(room).toBeCloseTo(4 * CELL, 6);
    const r = clampToCeiling(bed, i, room + 0.5);
    expect(r.kept).toBeCloseTo(room, 6);
    expect(r.overflow).toBeCloseTo(0.5, 6);
  });

  it('conserves: kept plus overflow is always what came in', () => {
    const { bed, i } = roofed();
    for (const d of [0, 0.1, 0.5, 1, 7.25]) {
      const r = clampToCeiling(bed, i, d);
      expect(r.kept + r.overflow).toBeCloseTo(d, 9);
    }
  });
});

describe('the bed the water rests on', () => {
  /**
   * A hillside, as voxels.
   *
   * Each column is one cell taller than the one before it, which is what any
   * slope looks like once it is voxelized: a flight of flat 1 m terraces.
   */
  const hillside = (n: number) => {
    const vol = new VoxelVolume(n);
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const top = Math.min(n - 1, 4 + Math.floor(x / 2));
        for (let y = 0; y <= top; y++) vol.set(x, y, z, Material.Topsoil);
      }
    }
    return vol;
  };

  it('FLOATS the water when it reads the voxel column instead of the drawn ground', () => {
    /* The fault Remy caught: water sitting a metre above the hillside in
     * cell-shaped slabs. The mesher averages edge crossings, so the ground it
     * draws sits below the column top. A bed taken from the column top is
     * therefore above the ground everywhere the slope is not flat. */
    const n = 16;
    const cellM = 1;
    const originM = [0, 0, 0] as const;
    const vol = hillside(n);
    const mesh = voxelsToSurface(vol, cellM, originM, () => [0.5, 0.4, 0.3]);
    const bed = volumeBed({ volume: vol, cellM, originM });

    let floated = 0;
    let worstM = 0;
    for (let i = 0; i < n * n; i++) {
      const drawn = mesh.columnTopY[i];
      if (!Number.isFinite(drawn)) continue;
      const gap = bed.bedY[i] - drawn;
      if (gap > 0.01) {
        floated++;
        worstM = Math.max(worstM, gap);
      }
    }
    expect(floated).toBeGreaterThan(0);
    expect(worstM).toBeGreaterThan(0.2); // a real gap, not float noise
  });

  it('rests the water ON the drawn ground once the mesh height is supplied', () => {
    const n = 16;
    const cellM = 1;
    const originM = [0, 0, 0] as const;
    const vol = hillside(n);
    const mesh = voxelsToSurface(vol, cellM, originM, () => [0.5, 0.4, 0.3]);
    const bed = volumeBed({ volume: vol, cellM, originM }, mesh.columnTopY);

    for (let i = 0; i < n * n; i++) {
      const drawn = mesh.columnTopY[i];
      if (!Number.isFinite(drawn)) continue;
      // Never above the ground it is drawn on.
      expect(bed.bedY[i]).toBeLessThanOrEqual(drawn + 1e-6);
    }
  });

  it('never drops the bed a whole cell, so it cannot fall through the floor below', () => {
    const n = 16;
    const cellM = 1;
    const originM = [0, 0, 0] as const;
    const vol = hillside(n);
    const mesh = voxelsToSurface(vol, cellM, originM, () => [0.5, 0.4, 0.3]);
    const plain = volumeBed({ volume: vol, cellM, originM });
    const corrected = volumeBed({ volume: vol, cellM, originM }, mesh.columnTopY);

    for (let i = 0; i < n * n; i++) {
      expect(plain.bedY[i] - corrected.bedY[i]).toBeLessThan(cellM);
    }
  });

  it('SMOOTHS the terraces the solver used to pond on', () => {
    /* The blocky waterline and the perched puddles share this cause. A bed
     * quantized to whole cells is a flight of level shelves, and a level shelf
     * holds water. The drawn surface slopes, so it drains. */
    const n = 16;
    const cellM = 1;
    const originM = [0, 0, 0] as const;
    const vol = hillside(n);
    const mesh = voxelsToSurface(vol, cellM, originM, () => [0.5, 0.4, 0.3]);
    const plain = volumeBed({ volume: vol, cellM, originM });
    const corrected = volumeBed({ volume: vol, cellM, originM }, mesh.columnTopY);

    // Count neighbours across the slope that share an identical height.
    const flatPairs = (bedY: Float32Array) => {
      let flat = 0;
      const z = Math.floor(n / 2);
      for (let x = 2; x < n - 3; x++) {
        if (bedY[z * n + x] === bedY[z * n + x + 1]) flat++;
      }
      return flat;
    };
    expect(flatPairs(corrected.bedY)).toBeLessThan(flatPairs(plain.bedY));
  });
});
