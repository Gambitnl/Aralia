/**
 * The bottom seal, and dropping it.
 *
 * A slab's floor is a flat plane of quads under ground that is solid all the
 * way down to it. It is a third of everything the land page draws and it can
 * never be seen from above. `suppressFloor` removes it — and these tests pin
 * the two properties that make that safe rather than merely cheap:
 *
 *   the SIDE WALLS survive intact, down to their bottom row, and
 *   nothing above the bottom plane changes by a single triangle.
 */
import { describe, it, expect } from 'vitest';
import { Material, VoxelVolume } from '../voxelVolume';
import { meshCellRange } from '../surfaceNets';

const GREY = () => [0.5, 0.5, 0.5] as const;

/** A solid slab: every cell filled, so the mesh is nothing but its own seal. */
function solidSlab(cells: number, cellsY: number): VoxelVolume {
  const v = new VoxelVolume(cells, cellsY);
  for (let z = 0; z < cells; z++) {
    for (let y = 0; y < cellsY; y++) {
      for (let x = 0; x < cells; x++) v.set(x, y, z, Material.Granite);
    }
  }
  return v;
}

/** Solid up to a sloping top, so there is a real drawn surface above the seal. */
function slopedSlab(cells: number, cellsY: number): VoxelVolume {
  const v = new VoxelVolume(cells, cellsY);
  for (let z = 0; z < cells; z++) {
    for (let x = 0; x < cells; x++) {
      const top = Math.min(cellsY - 1, Math.floor(cellsY * 0.4 + (x + z) * 0.25));
      for (let y = 0; y <= top; y++) v.set(x, y, z, Material.Granite);
    }
  }
  return v;
}

const meshAll = (v: VoxelVolume, suppress: boolean) =>
  meshCellRange(v, 1, [0, 0, 0], GREY, undefined, undefined, 1, suppress);

/** The lowest vertex in a mesh — how far down the skirt still reaches. */
function lowestY(positions: Float32Array): number {
  let lo = Infinity;
  for (let i = 1; i < positions.length; i += 3) if (positions[i] < lo) lo = positions[i];
  return lo;
}

describe('meshCellRange(suppressFloor)', () => {
  it('takes the whole bottom plane off a solid slab and leaves the four walls', () => {
    const v = solidSlab(16, 8);
    const kept = meshAll(v, false);
    const cut = meshAll(v, true);

    // A fully solid slab is six flat faces. Top and bottom are 16x16 cells of
    // two triangles each; the four walls are 16x8 each.
    const face = 16 * 16 * 2;
    const wall = 16 * 8 * 2;
    expect(kept.triangles).toBe(face * 2 + wall * 4);
    expect(cut.triangles).toBe(face + wall * 4);
    // The floor was 20% of this shape. On the real 480 m land tile it is 36%.
    expect(1 - cut.triangles / kept.triangles).toBeCloseTo(face / (face * 2 + wall * 4), 6);
  });

  it('keeps the walls watertight at their bottom row', () => {
    const v = solidSlab(16, 8);
    const kept = meshAll(v, false);
    const cut = meshAll(v, true);
    /* The wall's lowest quad joins vertices at the bottom lattice row to the
     * one above it. Had the suppression dropped those vertices the quads would
     * silently vanish and the slab would be open along its skirt — so the walls
     * must still REACH the bottom lattice row, which spans world y −1 to 0.
     *
     * The lowest point does move, by a quarter cell, and that is the rule
     * working rather than failing: a flat interior floor vertex averages its
     * crossings to the middle of the row (−0.5) and is exactly what goes; a
     * skirt vertex also has horizontal crossings and lands higher (−0.25). */
    expect(lowestY(kept.positions)).toBeCloseTo(-0.5, 6);
    const low = lowestY(cut.positions);
    expect(low).toBeGreaterThan(-1);
    expect(low).toBeLessThan(0);
  });

  it('changes nothing above the bottom plane', () => {
    const v = slopedSlab(24, 16);
    const kept = meshAll(v, false);
    const cut = meshAll(v, true);

    /* Same picture, one plane lighter. Compared as a SET of triangles keyed by
     * their three vertex positions, so vertex renumbering cannot make this pass
     * or fail on its own. */
    const tris = (m: typeof kept): Map<string, number> => {
      const out = new Map<string, number>();
      for (let t = 0; t < m.indices.length; t += 3) {
        const ys: number[] = [];
        const key = [0, 1, 2]
          .map((k) => {
            const i = m.indices[t + k];
            ys.push(m.positions[i * 3 + 1]);
            return `${m.positions[i * 3].toFixed(4)}/${m.positions[i * 3 + 1].toFixed(4)}/${m.positions[i * 3 + 2].toFixed(4)}`;
          })
          .sort()
          .join('|');
        out.set(key, Math.max(...ys));
      }
      return out;
    };
    const a = tris(kept);
    const b = tris(cut);
    // Nothing NEW appears, and nothing that survived moved.
    for (const k of b.keys()) expect(a.has(k)).toBe(true);
    // Everything lost lies wholly inside the bottom lattice row (world y −1..0),
    // which is where the volume's own seal is and the only place it is.
    const lost = [...a.entries()].filter(([k]) => !b.has(k));
    expect(lost.length).toBeGreaterThan(100);
    for (const [, highestVertexY] of lost) expect(highestVertexY).toBeLessThan(0);
  });

  it('is a per-y rule, so two chunks agree about their shared apron', () => {
    const v = slopedSlab(24, 16);
    const whole = meshAll(v, true);
    const lo = meshCellRange(v, 1, [0, 0, 0], GREY, undefined,
      { min: [0, 0, 0], max: [24, 7, 24] }, 1, true);
    const hi = meshCellRange(v, 1, [0, 0, 0], GREY, undefined,
      { min: [0, 8, 0], max: [24, 16, 24] }, 1, true);
    expect(lo.triangles + hi.triangles).toBe(whole.triangles);
  });

  it('leaves an interior hole in the bottom row alone', () => {
    /* A shaft bored to the floor leaves real interior faces at y = 1 and a real
     * rim at y = 0. Only the flat seal goes; the hole keeps its walls. */
    const v = solidSlab(16, 8);
    for (let z = 6; z <= 9; z++) for (let x = 6; x <= 9; x++) {
      for (let y = 0; y < 8; y++) v.set(x, y, z, Material.Air);
    }
    const cut = meshAll(v, true);
    const kept = meshAll(v, false);
    // The seal is now 16x16 minus the 4x4 hole.
    expect(kept.triangles - cut.triangles).toBe((16 * 16 - 4 * 4) * 2);
    // And the shaft's own four walls are still there, bottom row included.
    let lowShaftWall = 0;
    for (let i = 0; i < cut.positions.length; i += 3) {
      const [x, y, z] = [cut.positions[i], cut.positions[i + 1], cut.positions[i + 2]];
      if (y < 0.25 && x > 5 && x < 11 && z > 5 && z < 11) lowShaftWall++;
    }
    expect(lowShaftWall).toBeGreaterThan(0);
  });
});
