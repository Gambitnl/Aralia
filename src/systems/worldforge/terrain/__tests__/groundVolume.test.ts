/**
 * Volume ground, filled from a height source and turned into a surface.
 *
 * The property that matters most: a volume must be able to hold something a
 * heightfield cannot. Every other test here supports that one.
 */
import { describe, it, expect } from 'vitest';
import { Material } from '../voxelVolume';
import { fillBubbleFromGround, groundSource } from '../groundVolumeFromWorld';
import { voxelsToSurface } from '../surfaceNets';
import { materialAtDepth } from '../groundSolid';

/** A slope, so the fill has real relief rather than a flat slab. */
const slope = groundSource((x, z) => x * 0.08 + z * 0.03);

describe('fillBubbleFromGround', () => {
  it('fills solid below the surface and air above it', () => {
    const f = fillBubbleFromGround(slope, 0, 0, 8, 0.25);
    const { volume: v, originM, cellM, cellsPerEdge } = f;

    let checked = 0;
    for (let z = 2; z < cellsPerEdge - 2; z += 5) {
      for (let x = 2; x < cellsPerEdge - 2; x += 5) {
        const wx = originM[0] + x * cellM;
        const wz = originM[2] + z * cellM;
        const surface = slope.surfaceYAt(wx, wz);
        const surfCell = Math.floor((surface - originM[1]) / cellM);
        if (surfCell < 2 || surfCell > cellsPerEdge - 3) continue;
        expect(v.get(x, surfCell - 1, z)).not.toBe(Material.Air);
        expect(v.get(x, surfCell + 2, z)).toBe(Material.Air);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('centers the surface in the bubble rather than at its floor', () => {
    // A fixed vertical origin buries the bubble in a valley and floats it over
    // a peak. The ground under the center must land near the middle.
    const f = fillBubbleFromGround(slope, 40, 40, 16, 0.5);
    const centerGround = slope.surfaceYAt(40, 40);
    const mid = f.originM[1] + (f.cellsPerEdge * f.cellM) / 2;
    expect(Math.abs(centerGround - mid)).toBeLessThan(f.cellM * 2);
  });

  it('layers by depth: litter on top, bedrock deep', () => {
    const flat = groundSource(() => 0);
    const f = fillBubbleFromGround(flat, 0, 0, 8, 0.25);
    const surfCell = Math.floor((0 - f.originM[1]) / f.cellM);
    expect(f.volume.get(8, surfCell, 8)).toBe(Material.Litter);
    expect(f.volume.get(8, surfCell - 12, 8)).toBe(Material.Bedrock);
  });

  it('reports the work it did', () => {
    const f = fillBubbleFromGround(slope, 0, 0, 8, 0.25);
    expect(f.solidCells).toBeGreaterThan(1000);
    expect(f.cellsPerEdge % 8).toBe(0);
  });
});

describe('voxelsToSurface', () => {
  it('produces a mesh with matching attribute counts', () => {
    const f = fillBubbleFromGround(slope, 0, 0, 8, 0.25);
    const m = voxelsToSurface(f.volume, f.cellM, f.originM, (d) => materialAtDepth(d));
    expect(m.triangles).toBeGreaterThan(100);
    expect(m.positions.length).toBe(m.normals.length);
    expect(m.positions.length).toBe(m.colors.length);
  });

  it('is SMOOTHER than the voxel grid it came from', () => {
    // The whole reason for surface nets over blocky extraction. A staircase
    // puts every vertex on a cell boundary; a smoothed surface does not.
    const f = fillBubbleFromGround(slope, 0, 0, 8, 0.25);
    const m = voxelsToSurface(f.volume, f.cellM, f.originM, (d) => materialAtDepth(d));
    let offLattice = 0;
    for (let i = 0; i < m.positions.length; i += 3) {
      const yInCells = (m.positions[i + 1] - f.originM[1]) / f.cellM;
      if (Math.abs(yInCells - Math.round(yInCells)) > 0.02) offLattice++;
    }
    expect(offLattice).toBeGreaterThan(m.positions.length / 3 / 4);
  });

  it('colors a cut face by DEPTH, so a pit wall grades', () => {
    // Dig a shaft into a flat bubble, then read the wall colors. Deeper reads
    // lighter, which is the signature the shell established.
    const flat = groundSource(() => 0);
    const f = fillBubbleFromGround(flat, 0, 0, 8, 0.25);
    const surfCell = Math.floor((0 - f.originM[1]) / f.cellM);
    for (let y = surfCell; y > surfCell - 8; y--) {
      for (let z = 12; z < 20; z++) {
        for (let x = 12; x < 20; x++) f.volume.set(x, y, z, Material.Air);
      }
    }
    const m = voxelsToSurface(f.volume, f.cellM, f.originM, (d) => materialAtDepth(d), () => 0);
    const lum = (i: number) =>
      0.299 * m.colors[i * 3] + 0.587 * m.colors[i * 3 + 1] + 0.114 * m.colors[i * 3 + 2];
    let top = -1;
    let deep = -1;
    for (let i = 0; i < m.positions.length / 3; i++) {
      const y = m.positions[i * 3 + 1];
      if (y > -0.1 && top < 0) top = lum(i);
      if (y < -1.5 && deep < 0) deep = lum(i);
    }
    expect(top).toBeGreaterThan(0);
    expect(deep).toBeGreaterThan(top);
  });

  it('is deterministic', () => {
    const a = fillBubbleFromGround(slope, 0, 0, 8, 0.25);
    const b = fillBubbleFromGround(slope, 0, 0, 8, 0.25);
    const ma = voxelsToSurface(a.volume, a.cellM, a.originM, (d) => materialAtDepth(d));
    const mb = voxelsToSurface(b.volume, b.cellM, b.originM, (d) => materialAtDepth(d));
    expect(Array.from(ma.positions)).toEqual(Array.from(mb.positions));
  });
});

describe('the property a heightfield cannot have', () => {
  it('holds a TUNNEL: air with solid above and below', () => {
    // This is the whole argument for volume. A heightfield stores one height
    // per column and physically cannot describe this state.
    const flat = groundSource(() => 0);
    const f = fillBubbleFromGround(flat, 0, 0, 8, 0.25);
    const surfCell = Math.floor((0 - f.originM[1]) / f.cellM);
    const tunnelY = surfCell - 6;

    for (let x = 4; x < 28; x++) {
      for (let y = tunnelY; y < tunnelY + 3; y++) {
        for (let z = 14; z < 18; z++) f.volume.set(x, y, z, Material.Air);
      }
    }

    expect(f.volume.get(16, tunnelY + 1, 16)).toBe(Material.Air);
    expect(f.volume.get(16, tunnelY + 4, 16)).not.toBe(Material.Air);
    expect(f.volume.get(16, tunnelY - 2, 16)).not.toBe(Material.Air);

    // And the surface builder draws its roof, so a player would see it.
    const m = voxelsToSurface(f.volume, f.cellM, f.originM, (d) => materialAtDepth(d), () => 0);
    const roofY = f.originM[1] + (tunnelY + 3) * f.cellM;
    let roofVerts = 0;
    for (let i = 0; i < m.positions.length; i += 3) {
      const y = m.positions[i + 1];
      const z = m.positions[i + 2];
      if (Math.abs(y - roofY) < f.cellM && z > f.originM[2] + 13 * f.cellM) roofVerts++;
    }
    expect(roofVerts).toBeGreaterThan(10);
  });
});

describe('the volume is CLOSED', () => {
  /* The test that was missing, and the reason a hollow shell shipped.
   *
   * Every earlier test here asked about the mesh's contents: counts, smoothness,
   * color, determinism. None asked about its TOPOLOGY, so a surface with no
   * floor and no sides passed all of them. Viewed from above it was flawless.
   *
   * A closed surface has every edge shared by exactly two triangles. One user
   * means a hole; more than two means a fold. This is the only claim that
   * distinguishes a solid from a sheet, which is the whole point of the file. */
  function openEdges(m: { indices: Uint32Array; positions: Float32Array }): number {
    // Key by POSITION, not by index — surface nets shares vertices, but a
    // keying mistake would report a false hole, and welding by position is
    // immune to it.
    const key = (i: number) => {
      const p = i * 3;
      return `${m.positions[p].toFixed(4)},${m.positions[p + 1].toFixed(4)},${m.positions[p + 2].toFixed(4)}`;
    };
    const use = new Map<string, number>();
    for (let t = 0; t < m.indices.length; t += 3) {
      const k = [key(m.indices[t]), key(m.indices[t + 1]), key(m.indices[t + 2])];
      for (let e = 0; e < 3; e++) {
        const pair = [k[e], k[(e + 1) % 3]].sort().join('|');
        use.set(pair, (use.get(pair) ?? 0) + 1);
      }
    }
    let open = 0;
    for (const count of use.values()) if (count !== 2) open++;
    return open;
  }

  it('has no boundary edge: a floor and four sides, not just a lid', () => {
    const f = fillBubbleFromGround(groundSource(() => 4), 0, 0, 8, 0.5);
    const m = voxelsToSurface(f.volume, f.cellM, f.originM, (d) => materialAtDepth(d));
    expect(m.indices.length).toBeGreaterThan(0);
    expect(openEdges(m)).toBe(0);
  });

  it('stays closed after a cut, which is when it matters', () => {
    // A crater carved inside solid ground must remain enclosed. When the volume
    // had no floor, this crater rendered as a lit dome apparently floating
    // inside the ground — visible only by orbiting underneath.
    const f = fillBubbleFromGround(groundSource(() => 4), 0, 0, 8, 0.5);
    const n = f.cellsPerEdge;
    const mid = Math.floor(n / 2);
    const surfaceCell = Math.floor((4 - f.originM[1]) / f.cellM);
    for (let y = surfaceCell; y > surfaceCell - 3; y--) {
      for (let z = mid - 2; z <= mid + 2; z++) {
        for (let x = mid - 2; x <= mid + 2; x++) f.volume.set(x, y, z, Material.Air);
      }
    }
    const m = voxelsToSurface(f.volume, f.cellM, f.originM, (d) => materialAtDepth(d));
    expect(openEdges(m)).toBe(0);
  });
});
