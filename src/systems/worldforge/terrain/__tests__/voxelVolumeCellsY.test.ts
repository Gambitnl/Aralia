/**
 * The volume's axes came apart: X and Z keep `cells`, Y gets `cellsY`.
 *
 * Two things have to be true at once and neither is visible from a picture.
 * First, a CUBIC volume must behave exactly as it did — every consumer in the
 * campaign was written against `vol.cells` as a Y bound, and the split is only
 * safe because it defaults back to that. Second, a FLAT volume must bound Y at
 * `cellsY` on every path: a write past the top used to land inside a real brick
 * (the bug the explicit guards on `get`/`set` were added for), and the split
 * reintroduces exactly that hazard on a new axis.
 */
import { describe, it, expect } from 'vitest';
import { VoxelVolume, Material, BRICK } from '../voxelVolume';
import { columnSpans, volumeBed } from '../volumeSurface';
import { applyBrush, topSolidCell } from '../voxelBrush';
import { raycastVoxels } from '../voxelRay';
import { voxelsToSurface } from '../surfaceNets';
import { DEFAULT_STACK } from '../materials';

describe('VoxelVolume with an independent vertical resolution', () => {
  it('defaults to cubic, so nothing written before the split moved', () => {
    const v = new VoxelVolume(32);
    expect(v.cellsY).toBe(32);
    expect(v.bricksY).toBe(32 / BRICK);
  });

  it('rejects a vertical size that is not a whole number of bricks', () => {
    expect(() => new VoxelVolume(32, 12)).toThrow();
  });

  it('bounds Y at cellsY on read AND on write', () => {
    const v = new VoxelVolume(32, 16);
    expect(v.get(0, 16, 0)).toBe(Material.Air);
    expect(v.get(0, 15, 0)).toBe(Material.Air);
    // A write past the top must be a no-op, not a write into some other brick.
    v.set(5, 16, 5, Material.Granite);
    v.set(5, 99, 5, Material.Granite);
    for (let y = 0; y < 16; y++) expect(v.get(5, y, 5)).toBe(Material.Air);
  });

  it('snapshots and restores its own height', () => {
    const v = new VoxelVolume(16, 8);
    v.set(3, 4, 3, Material.Clay);
    const back = VoxelVolume.fromSnapshot(v.snapshot());
    expect(back.cells).toBe(16);
    expect(back.cellsY).toBe(8);
    expect(back.get(3, 4, 3)).toBe(Material.Clay);
  });

  it('reads an OLD snapshot — one with no cellsY — as cubic', () => {
    const v = new VoxelVolume(16);
    v.set(2, 9, 2, Material.Sand);
    const s = v.snapshot();
    delete (s as { cellsY?: number }).cellsY;
    const back = VoxelVolume.fromSnapshot(s);
    expect(back.cellsY).toBe(16);
    expect(back.get(2, 9, 2)).toBe(Material.Sand);
  });

  it('counts dense bytes over its real extent, not over a cube', () => {
    expect(new VoxelVolume(16, 8).stats().denseBytes).toBe(16 * 16 * 8);
  });
});

/** A flat volume filled to a flat top, the arena's shape in miniature. */
function slab(cells = 32, cellsY = 16, topCell = 9): VoxelVolume {
  const v = new VoxelVolume(cells, cellsY);
  for (let z = 0; z < cells; z++) {
    for (let x = 0; x < cells; x++) {
      for (let y = 0; y <= topCell; y++) v.set(x, y, z, Material.Subsoil);
    }
  }
  return v;
}

describe('every consumer reads the vertical lattice, not the horizontal one', () => {
  const CELL_M = 0.5;
  const CELL_HM = 0.15;
  const ORIGIN = [0, -1, 0] as const;

  it('topSolidCell finds the top of a SHORT volume', () => {
    expect(topSolidCell(slab(), 4, 4)).toBe(9);
  });

  it('columnSpans measures its floor in vertical cells', () => {
    const v = slab();
    const spans = columnSpans({ volume: v, cellM: CELL_M, cellHM: CELL_HM, originM: ORIGIN }, 4, 4);
    expect(spans).toHaveLength(1);
    // Ten solid cells of 0.15 m each, from y = -1.
    expect(spans[0].floorY).toBeCloseTo(-1 + 10 * CELL_HM, 6);
    expect(spans[0].ceilY).toBe(Number.POSITIVE_INFINITY);
  });

  it('the bed a volume derives is at the vertical-cell height', () => {
    const bed = volumeBed({ volume: slab(), cellM: CELL_M, cellHM: CELL_HM, originM: ORIGIN });
    expect(bed.bedY[4 * 32 + 4]).toBeCloseTo(-1 + 10 * CELL_HM, 6);
  });

  it('a ray reports METRES, whatever the vertical cell is', () => {
    const v = slab();
    const top = -1 + 10 * CELL_HM;
    const hit = raycastVoxels(
      { volume: v, cellM: CELL_M, cellHM: CELL_HM, originM: ORIGIN },
      [4, top + 3, 4],
      [0, -1, 0],
    );
    expect(hit).not.toBeNull();
    expect(hit!.distanceM).toBeCloseTo(3, 1);
    expect(hit!.normal).toEqual([0, 1, 0]);
  });

  it('a cubic volume rays exactly as it always did', () => {
    const v = slab(32, 32, 9);
    const cubic = raycastVoxels({ volume: v, cellM: CELL_M, originM: ORIGIN }, [4, 8, 4], [0, -1, 0]);
    const spelled = raycastVoxels(
      { volume: v, cellM: CELL_M, cellHM: CELL_M, originM: ORIGIN },
      [4, 8, 4],
      [0, -1, 0],
    );
    expect(spelled).toEqual(cubic);
  });

  it('the mesher fills a SHORT volume rather than running off its top', () => {
    const v = slab();
    const mesh = voxelsToSurface(
      v,
      CELL_M,
      ORIGIN,
      () => [0.5, 0.4, 0.3],
      () => -1 + 10 * CELL_HM,
      CELL_HM,
    );
    expect(mesh.triangles).toBeGreaterThan(0);
    // Nothing is drawn above the volume's own roof.
    let maxY = -Infinity;
    for (let i = 1; i < mesh.positions.length; i += 3) {
      if (mesh.positions[i] > maxY) maxY = mesh.positions[i];
    }
    expect(maxY).toBeLessThanOrEqual(-1 + 16 * CELL_HM + 1e-3);
    // And the drawn top sits within a cell of the real one.
    const top = mesh.columnTopY[16 * 32 + 16];
    expect(Math.abs(top - (-1 + 10 * CELL_HM))).toBeLessThan(CELL_HM * 1.5);
  });

  it('a brush cannot write past the roof of a short volume', () => {
    const v = slab();
    const res = applyBrush(
      { volume: v, cellM: CELL_M, cellHM: CELL_HM, originM: ORIGIN },
      [8, -1 + 10 * CELL_HM, 8],
      { shape: 'sphere', mode: 'raise', radiusM: 2 },
      DEFAULT_STACK,
    );
    expect(res.max[1]).toBeLessThan(v.cellsY);
  });
});
