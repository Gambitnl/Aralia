/**
 * Cloth atlas data (character cloth+armor slice 1c, 2026-11-04).
 *
 * The GPU solve reads these texels blind, so a wrong entry is a silent tear
 * or a stiff sheet. The checks pin the layout clothShaders.ts relies on: each
 * constraint stored once, slack only below the top two rows, tubes wrapping,
 * pins and garment slots in meta, and a packer that fails loudly when full.
 */
import { describe, expect, it } from 'vitest';
import { ATLAS_SIZE, ClothAtlasPacker, clearGarment, createAtlasData, texelUv, writeGarment } from '../three/cloth/clothAtlas';
import type { ClothPanel } from '../three/cloth/garmentPanels';

/** A flat test sheet: cols x rows points 0.1 m apart in the XY plane. */
function sheet(cols: number, rows: number, wrap = false, slack = 1.2): ClothPanel {
  const rest = new Float32Array(cols * rows * 3);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) rest.set([c * 0.1, -r * 0.1, 0], (r * cols + c) * 3);
  return { kind: 'cape', rows, cols, wrap, rest, pins: [{ index: 0, bone: 'chest' }], slack, bend: 0.03, colliders: [] };
}

const texel = (x: number, y: number): number => (y * ATLAS_SIZE + x) * 4;

describe('cloth atlas', () => {
  it('stores each constraint once, with slack only below the top two rows', () => {
    const data = createAtlasData();
    const panel = sheet(5, 4);
    const region = new ClothAtlasPacker().allocate(5, 4);
    const pins = new Int32Array(20).fill(-1);
    pins[0] = 7;
    writeGarment(data, region, panel, 3, pins);
    // row 0: taut across (0.1), row 2: slack across (0.12); down is never slack
    expect(data.rest[texel(region.x + 1, region.y)]).toBeCloseTo(0.1, 6);
    expect(data.rest[texel(region.x + 1, region.y + 2)]).toBeCloseTo(0.12, 6);
    expect(data.rest[texel(region.x + 1, region.y + 2) + 1]).toBeCloseTo(0.1, 6);
    // open edges: no right constraint on the last column, no down on the last row
    expect(data.rest[texel(region.x + 4, region.y)]).toBe(-1);
    expect(data.rest[texel(region.x, region.y + 3) + 1]).toBe(-1);
    // bend two apart, stiffness carried
    expect(data.rest2[texel(region.x, region.y)]).toBeCloseTo(0.2, 6);
    expect(data.rest2[texel(region.x, region.y) + 2]).toBeCloseTo(0.03, 6);
    // grid + meta
    expect(Array.from(data.grid.subarray(texel(region.x + 2, region.y + 1), texel(region.x + 2, region.y + 1) + 4))).toEqual([2, 1, 5, 4]);
    expect(data.meta[texel(region.x, region.y)]).toBe(3);
    expect(data.meta[texel(region.x, region.y) + 1]).toBe(7);
    expect(data.meta[texel(region.x + 1, region.y) + 1]).toBe(-1);
    expect(data.meta[texel(region.x + 1, region.y) + 2]).toBe(1);
  });

  it('wraps a tube: the last column joins the first, and cols is stored negative', () => {
    const data = createAtlasData();
    const panel = sheet(6, 3, true);
    const region = new ClothAtlasPacker().allocate(6, 3);
    writeGarment(data, region, panel, 0, new Int32Array(18).fill(-1));
    // last column's right neighbor is column 0, 0.5 m away in this flat test
    expect(data.rest[texel(region.x + 5, region.y)]).toBeCloseTo(0.5, 6);
    expect(data.grid[texel(region.x, region.y) + 2]).toBe(-6);
  });

  it('clears a region back to unused', () => {
    const data = createAtlasData();
    const region = new ClothAtlasPacker().allocate(4, 4);
    writeGarment(data, region, sheet(4, 4), 1, new Int32Array(16).fill(-1));
    clearGarment(data, region);
    expect(data.meta[texel(region.x + 1, region.y + 1) + 2]).toBe(0);
    expect(data.meta[texel(region.x + 1, region.y + 1)]).toBe(-1);
  });

  it('packs shelves, reuses freed space, and throws when full', () => {
    const p = new ClothAtlasPacker();
    const a = p.allocate(100, 30);
    const b = p.allocate(100, 30);
    expect(b.x).toBe(100);
    expect(b.y).toBe(a.y);
    p.release(a);
    const c = p.allocate(90, 25);
    expect([c.x, c.y]).toEqual([a.x, a.y]);
    const q = new ClothAtlasPacker();
    expect(() => {
      for (let i = 0; i < 1000; i++) q.allocate(200, 30);
    }).toThrow(/full/);
    expect(() => q.allocate(ATLAS_SIZE + 1, 4)).toThrow(/larger/);
  });

  it('gives texel-center UVs', () => {
    expect(texelUv({ x: 2, y: 3, cols: 4, rows: 4 }, 1, 1)).toEqual([3.5 / ATLAS_SIZE, 4.5 / ATLAS_SIZE]);
  });
});
