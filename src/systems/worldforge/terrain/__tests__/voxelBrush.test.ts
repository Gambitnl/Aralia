/**
 * Ground shaping.
 *
 * The tests that matter are the ones that separate a real earthwork from a
 * region subtraction. A ditch that does not follow a slope is a box; a mound
 * that is one flat tone is clay dropped on a lawn. Both would pass a naive
 * "did any cells change" check, so neither is tested that way here.
 */
import { describe, it, expect } from 'vitest';
import { Material, VoxelVolume } from '../voxelVolume';
import { applyBrush, topSolidCell, BrushTarget } from '../voxelBrush';

const CELL = 0.25;

/** Solid below `groundCell`, air above. */
function flat(cells = 48, groundCell = 24): BrushTarget {
  const volume = new VoxelVolume(cells);
  for (let z = 0; z < cells; z++) {
    for (let y = 0; y < groundCell; y++) {
      for (let x = 0; x < cells; x++) volume.set(x, y, z, Material.Granite);
    }
  }
  return { volume, cellM: CELL, originM: [0, 0, 0] };
}

/** Ground that rises toward +x, one cell per two columns. */
function slope(cells = 48): BrushTarget {
  const volume = new VoxelVolume(cells);
  for (let z = 0; z < cells; z++) {
    for (let x = 0; x < cells; x++) {
      const top = 12 + Math.floor(x / 2);
      for (let y = 0; y < Math.min(top, cells); y++) volume.set(x, y, z, Material.Granite);
    }
  }
  return { volume, cellM: CELL, originM: [0, 0, 0] };
}

const midM = (c: number) => (c + 0.5) * CELL;

describe('sphere', () => {
  it('digs a round hole and leaves the corners solid', () => {
    const t = flat();
    const c = 24;
    applyBrush(t, [midM(c), midM(20), midM(c)], { shape: 'sphere', mode: 'dig', radiusM: 1 });
    // Center is gone.
    expect(t.volume.get(c, 20, c)).toBe(Material.Air);
    /* A corner of the bounding box is NOT, or the brush is a box.
     *
     * The corner must be sampled BELOW the ground line. My first version used
     * y + r, which is above the surface and already air — so the assertion held
     * no matter what the brush did. The box test below had the same fault and
     * passed for the same non-reason. */
    const r = Math.round(1 / CELL);
    expect(t.volume.get(c + r, 20 - r, c + r)).not.toBe(Material.Air);
  });

  it('raises a mound that is layered, not one flat tone', () => {
    /* The fault a single-material fill has. New ground must grow litter on top
     * and heavier material underneath, or it reads as clay dropped on a lawn. */
    const t = flat();
    const c = 24;
    applyBrush(t, [midM(c), midM(24), midM(c)], { shape: 'sphere', mode: 'raise', radiusM: 1.2 });
    const top = topSolidCell(t.volume, c, c);
    expect(top).toBeGreaterThan(23);
    expect(t.volume.get(c, top, c)).toBe(Material.Litter);
    expect(t.volume.get(c, top - 6, c)).not.toBe(Material.Litter);
  });
});

describe('box', () => {
  it('digs square corners, unlike a sphere', () => {
    const t = flat();
    const c = 24;
    applyBrush(t, [midM(c), midM(20), midM(c)], { shape: 'box', mode: 'dig', radiusM: 1 });
    // Sampled below the ground line, so the assertion means something.
    const r = Math.round(1 / CELL);
    expect(t.volume.get(c + r, 20 - r, c + r)).toBe(Material.Air);
  });
});

describe('ditch', () => {
  it('FOLLOWS a slope instead of cutting one flat box', () => {
    /* The whole reason ditches are surface-relative. Cut as a box, a trench
     * across a slope surfaces at the uphill end and buries itself downhill. */
    const t = slope();
    const before: number[] = [];
    for (let x = 16; x < 32; x++) before.push(topSolidCell(t.volume, x, 24));

    applyBrush(t, [midM(24), midM(20), midM(24)], {
      shape: 'ditch',
      mode: 'dig',
      radiusM: 0.5,
      heightM: 1,
      lengthM: 6,
      axis: 'x',
    });

    const after: number[] = [];
    for (let x = 16; x < 32; x++) after.push(topSolidCell(t.volume, x, 24));

    // Every column along the run got lower...
    for (let i = 0; i < before.length; i++) {
      expect(after[i], `column ${16 + i}`).toBeLessThan(before[i]);
    }
    // ...and the trench floor still RISES with the hill, because it followed it.
    expect(after[after.length - 1]).toBeGreaterThan(after[0]);
  });

  it('leaves ground outside its width untouched', () => {
    const t = flat();
    const before = topSolidCell(t.volume, 24, 40);
    applyBrush(t, [midM(24), midM(20), midM(24)], {
      shape: 'ditch', mode: 'dig', radiusM: 0.5, heightM: 1, lengthM: 6, axis: 'x',
    });
    expect(topSolidCell(t.volume, 24, 40)).toBe(before);
  });

  it('runs along z when told to', () => {
    const t = flat();
    applyBrush(t, [midM(24), midM(20), midM(24)], {
      shape: 'ditch', mode: 'dig', radiusM: 0.5, heightM: 1, lengthM: 6, axis: 'z',
    });
    const along = topSolidCell(t.volume, 24, 30);
    const across = topSolidCell(t.volume, 30, 24);
    expect(along).toBeLessThan(23); // cut runs this way
    expect(across).toBe(23); // and not that way
  });
});

describe('hill', () => {
  it('rises from the ground it stands on, following a slope', () => {
    const t = slope();
    const beforeLow = topSolidCell(t.volume, 20, 24);
    const beforeHigh = topSolidCell(t.volume, 28, 24);
    applyBrush(t, [midM(24), midM(20), midM(24)], {
      shape: 'hill', mode: 'raise', radiusM: 1, heightM: 1, lengthM: 2,
    });
    expect(topSolidCell(t.volume, 20, 24)).toBeGreaterThan(beforeLow);
    expect(topSolidCell(t.volume, 28, 24)).toBeGreaterThan(beforeHigh);
    // The hill sits ON the slope, so its downhill end stays lower.
    expect(topSolidCell(t.volume, 20, 24)).toBeLessThan(topSolidCell(t.volume, 28, 24));
  });
});

describe('safety', () => {
  it('reports nothing when the brush misses the volume entirely', () => {
    const t = flat();
    const r = applyBrush(t, [-500, -500, -500], { shape: 'sphere', mode: 'dig', radiusM: 1 });
    expect(r.changed).toBe(0);
  });

  it('does not corrupt the volume when it straddles the edge', () => {
    /* A brush at the boundary writes out of range on one side. Before `set` was
     * bounds-checked, those writes landed in a REAL brick up to eight cells
     * away, so a cut at the edge silently changed ground elsewhere. */
    const t = flat(48, 24);
    const far = topSolidCell(t.volume, 40, 40);
    applyBrush(t, [midM(0), midM(23), midM(0)], { shape: 'sphere', mode: 'dig', radiusM: 1.5 });
    expect(topSolidCell(t.volume, 40, 40)).toBe(far);
  });

  it('reports the cell bounds it touched', () => {
    const t = flat();
    const r = applyBrush(t, [midM(24), midM(20), midM(24)], {
      shape: 'sphere', mode: 'dig', radiusM: 1,
    });
    expect(r.changed).toBeGreaterThan(0);
    expect(r.min[0]).toBeLessThanOrEqual(24);
    expect(r.max[0]).toBeGreaterThanOrEqual(24);
  });
});
