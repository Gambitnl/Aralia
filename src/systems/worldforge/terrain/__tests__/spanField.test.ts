/**
 * Packing the volume's spans flat, for a compute kernel.
 *
 * The claim under test is narrow and total: THE PACKED FIELD AND THE VOXELS
 * AGREE ABOUT WHAT IS SOLID. Everything else here — padding, fallback, the
 * bilinear floor — exists to serve that one claim, and the last test in the
 * file checks it exhaustively against `VoxelVolume.get` rather than against
 * my own idea of what the packer should have written.
 */
import { describe, it, expect } from 'vitest';
import { Material, VoxelVolume } from '../voxelVolume';
import { columnSpans, type SurfaceTarget } from '../volumeSurface';
import {
  SPAN_SKY,
  SPAN_SLOTS,
  packSpanField,
  resolveColumn,
  resolveSpanAt,
  spanFieldFromHeights,
  spanFieldToGrid,
} from '../spanField';

const CELL = 0.25;

/** Solid below `groundCell`, air above. */
function flat(cells = 32, groundCell = 16): SurfaceTarget {
  const volume = new VoxelVolume(cells);
  for (let z = 0; z < cells; z++) {
    for (let y = 0; y < groundCell; y++) {
      for (let x = 0; x < cells; x++) volume.set(x, y, z, Material.Granite);
    }
  }
  return { volume, cellM: CELL, originM: [0, 0, 0] };
}

/** A hill over the whole grid with a horizontal bore along x at rows [y0, y1). */
function bored(cells = 32, groundCell = 16, hillTop = 28, y0 = 18, y1 = 22): SurfaceTarget {
  const t = flat(cells, groundCell);
  for (let z = 0; z < cells; z++) {
    for (let y = groundCell; y < hillTop; y++) {
      for (let x = 0; x < cells; x++) t.volume.set(x, y, z, Material.Granite);
    }
  }
  const zMid = cells >> 1;
  for (let x = 0; x < cells; x++) {
    for (let y = y0; y < y1; y++) {
      for (let z = zMid - 2; z <= zMid + 2; z++) t.volume.set(x, y, z, Material.Air);
    }
  }
  return t;
}

const out = new Float32Array(2);
const scratch = new Float32Array(2);

describe('packSpanField', () => {
  it('writes the same spans volumeSurface reads, in the same order', () => {
    const t = bored();
    const f = packSpanField(t);
    const n = t.volume.cells;
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const spans = columnSpans(t, x, z);
        const base = (z * n + x) * f.slots * 2;
        for (let s = 0; s < Math.min(spans.length, f.slots); s++) {
          expect(f.data[base + s * 2]).toBeCloseTo(spans[s].floorY, 5);
          const ceil = Number.isFinite(spans[s].ceilY) ? spans[s].ceilY : SPAN_SKY;
          expect(f.data[base + s * 2 + 1]).toBeCloseTo(ceil, 5);
        }
        expect(f.count[z * n + x]).toBe(spans.length);
      }
    }
  });

  it('pads a short column by REPLICATING its last span, not by zeroing it', () => {
    /* The padding is not cosmetic. It is what lets the resolve fall back to
     * the deepest real span with no count and no branch — a zero pad would be
     * a floor at y = 0 and every particle would be clamped to it. */
    const f = packSpanField(flat());
    const base = 0;
    expect(f.data[base + 0]).toBeCloseTo(16 * CELL, 6);
    expect(f.data[base + 1]).toBe(SPAN_SKY);
    for (let s = 1; s < f.slots; s++) {
      expect(f.data[base + s * 2]).toBe(f.data[base]);
      expect(f.data[base + s * 2 + 1]).toBe(f.data[base + 1]);
    }
  });

  it('counts columns that overflow the slot budget, and keeps the TOP spans', () => {
    // Three stacked voids in one column: hill, bore, bore. Four spans, two slots.
    const t = flat(32, 8);
    for (let y = 8; y < 30; y++) t.volume.set(4, y, 4, Material.Granite);
    for (let y = 12; y < 14; y++) t.volume.set(4, y, 4, Material.Air);
    for (let y = 18; y < 20; y++) t.volume.set(4, y, 4, Material.Air);
    for (let y = 24; y < 26; y++) t.volume.set(4, y, 4, Material.Air);

    const spans = columnSpans(t, 4, 4);
    expect(spans.length).toBe(4);

    const f = packSpanField(t, 2);
    expect(f.overflow).toBe(1);
    const base = (4 * 32 + 4) * 4;
    expect(f.data[base]).toBeCloseTo(spans[0].floorY, 5);
    expect(f.data[base + 2]).toBeCloseTo(spans[1].floorY, 5);

    // Widening the field to 4 slots takes them all, with no overflow.
    const wide = packSpanField(t, 4);
    expect(wide.overflow).toBe(0);
    expect(wide.data[(4 * 32 + 4) * 8 + 6]).toBeCloseTo(spans[3].floorY, 5);
  });

  it('floors a column solid to the top at the top, and a hollow one at the base', () => {
    /* Two degenerate columns, both of which a heightfield also has to answer.
     *
     * Solid to the top: `columnSpans` reports one span floored at the volume
     * top, because its walk starts in a gap. That is right — the ground is
     * above what the volume can see — and needs no case here.
     *
     * Air throughout: no span at all, because a gap with no solid beneath it
     * is not a place water can lie. The packer floors it at the volume base;
     * see the comment there for why a floor must exist. */
    const cells = 16;
    const solid = new VoxelVolume(cells);
    for (let y = 0; y < cells; y++) solid.set(0, y, 0, Material.Granite);
    const t: SurfaceTarget = { volume: solid, cellM: CELL, originM: [0, -1, 0] };
    const f = packSpanField(t);
    expect(f.count[0]).toBe(1);
    expect(f.data[0]).toBeCloseTo(-1 + cells * CELL, 6);
    // Every other column is empty throughout.
    expect(f.bottomless).toBe(cells * cells - 1);
    expect(f.count[1]).toBe(0);
    expect(f.data[1 * 4]).toBeCloseTo(-1, 6);
  });
});

describe('resolveColumn', () => {
  const t = bored();
  const f = packSpanField(t);
  const n = t.volume.cells;
  const col = (n >> 1) * n + 4; // a column the bore passes through

  it('reads open sky above the hilltop', () => {
    resolveColumn(f.data, f.slots, col, 40 * CELL, out);
    expect(out[0]).toBeCloseTo(28 * CELL, 5);
    expect(out[1]).toBe(SPAN_SKY);
    expect(out[0]).toBeLessThanOrEqual(40 * CELL); // free
  });

  it('reads the tunnel from inside it', () => {
    resolveColumn(f.data, f.slots, col, 20 * CELL, out);
    expect(out[0]).toBeCloseTo(18 * CELL, 5);
    expect(out[1]).toBeCloseTo(22 * CELL, 5);
  });

  it('calls the rock ABOVE the tunnel solid, with the push pointing down', () => {
    const y = 25 * CELL;
    resolveColumn(f.data, f.slots, col, y, out);
    // The tunnel span is chosen (its floor is the highest at or below y) and y
    // is over its ceiling: solid, and the way out is DOWN.
    expect(out[1]).toBeCloseTo(22 * CELL, 5);
    expect(y).toBeGreaterThan(out[1]);
  });

  it('calls the rock BELOW the tunnel solid, with the push pointing up', () => {
    const y = 10 * CELL;
    resolveColumn(f.data, f.slots, col, y, out);
    // No floor at or below y, so the fallback is the deepest span — the tunnel.
    expect(out[0]).toBeCloseTo(18 * CELL, 5);
    expect(y).toBeLessThan(out[0]);
  });
});

describe('resolveSpanAt', () => {
  it('blends the floor across columns, exactly as the old height lookup did', () => {
    // A ramp: floor = x, one span per column.
    const n = 8;
    const heights = new Float32Array(n * n);
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) heights[z * n + x] = x;
    const data = spanFieldFromHeights(heights, n);
    resolveSpanAt(data, SPAN_SLOTS, n, 3.0, 100, 3.0, out, scratch);
    expect(out[0]).toBeCloseTo(2.5, 6); // sample space is offset half a cell
    resolveSpanAt(data, SPAN_SLOTS, n, 3.25, 100, 3.0, out, scratch);
    expect(out[0]).toBeCloseTo(2.75, 6);
    expect(out[1]).toBe(SPAN_SKY);
  });

  it('takes the ceiling from the NEAREST column, never a blend', () => {
    /* Blending would lerp a real roof against the SPAN_SKY of the open column
     * beside a tunnel mouth and put the roof half a million meters up. */
    const n = 4;
    const slots = 2;
    const data = new Float32Array(n * n * slots * 2);
    for (let col = 0; col < n * n; col++) {
      for (let s = 0; s < slots; s++) {
        data[(col * slots + s) * 2] = 0;
        data[(col * slots + s) * 2 + 1] = SPAN_SKY;
      }
    }
    // One roofed column at (1, 1).
    const roofed = 1 * n + 1;
    for (let s = 0; s < slots; s++) data[(roofed * slots + s) * 2 + 1] = 5;

    resolveSpanAt(data, slots, n, 1.6, 1, 1.6, out, scratch); // nearest is (1,1)
    expect(out[1]).toBe(5);
    resolveSpanAt(data, slots, n, 2.6, 1, 2.6, out, scratch); // nearest is (2,2)
    expect(out[1]).toBe(SPAN_SKY);
  });

  it('raises the floor into a wall beside a bore — the lateral confinement', () => {
    /* There is no separate side-wall test in either sim. Approaching the rock
     * beside a tunnel, the resolved floor climbs from the tunnel floor to the
     * hillside over it inside one cell, and the tangent plane of that step
     * points back into the passage. This asserts the step exists. */
    const t = bored();
    const f = packSpanField(t);
    const g = spanFieldToGrid(f, 0, CELL);
    const n = f.n;
    const zMid = n >> 1;
    const yIn = 20; // grid units, inside the bore

    resolveSpanAt(g, f.slots, n, 8.5, yIn, zMid + 0.5, out, scratch);
    const inside = out[0];
    resolveSpanAt(g, f.slots, n, 8.5, yIn, zMid + 4.5, out, scratch);
    const beside = out[0];
    expect(inside).toBeCloseTo(18, 4);
    expect(beside).toBeCloseTo(28, 4);
    expect(beside - inside).toBeGreaterThan(5);
  });
});

describe('spanFieldToGrid', () => {
  it('rescales heights and leaves the sky sentinel alone', () => {
    const f = packSpanField(bored());
    const g = spanFieldToGrid(f, 1, CELL);
    for (let i = 0; i < f.data.length; i += 2) {
      expect(g[i]).toBeCloseTo((f.data[i] - 1) / CELL, 4);
      if (f.data[i + 1] >= SPAN_SKY) expect(g[i + 1]).toBe(SPAN_SKY);
      else expect(g[i + 1]).toBeCloseTo((f.data[i + 1] - 1) / CELL, 4);
    }
  });
});

describe('the packed field and the voxels agree', () => {
  it('calls exactly the air cells free, everywhere, on a bored volume', () => {
    /* THE test. Not "does the packer write what I expect" but "does the thing
     * the kernel will read say the same as the thing the mesher draws". Every
     * cell center in the volume, checked against VoxelVolume.get.
     *
     * Cells the encoding is allowed to disagree about: none. A column that
     * overflows the slot budget would be one, so the volume is built to fit
     * and the assertion below proves it did. */
    const t = bored();
    const f = packSpanField(t);
    expect(f.overflow).toBe(0);
    const n = t.volume.cells;
    let checked = 0;
    let air = 0;
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const col = z * n + x;
        for (let y = 0; y < n; y++) {
          const yM = (y + 0.5) * CELL;
          resolveColumn(f.data, f.slots, col, yM, out);
          const free = out[0] <= yM && yM <= out[1];
          const isAir = t.volume.get(x, y, z) === Material.Air;
          expect(free).toBe(isAir);
          checked++;
          if (isAir) air++;
        }
      }
    }
    expect(checked).toBe(n ** 3);
    expect(air).toBeGreaterThan(0);
  });
});
