/**
 * Volume ground, filled from a height source and turned into a surface.
 *
 * The property that matters most: a volume must be able to hold something a
 * heightfield cannot. Every other test here supports that one.
 */
import { describe, it, expect } from 'vitest';
import { Material, VoxelVolume } from '../voxelVolume';
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
    expect(f.volume.get(8, surfCell - 12, 8)).toBe(Material.Granite);
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

describe('the surface FACES OUT', () => {
  /* The second test that was missing, and the reason an inside-out mesh shipped.
   *
   * "Closed" above proves the surface is a solid rather than a sheet. It says
   * nothing about which SIDE of that solid is the front, and for a long time
   * every face was wound the wrong way round: the winding normal of a flat
   * ground top pointed DOWN into the rock, and the face-averaged vertex normals
   * pointed down with it.
   *
   * Nothing caught it because every material that draws this mesh is
   * `DoubleSide` — an inverted winding is invisible to the culler, and three.js
   * flips the shading normal on a back face, so it was invisible to the light
   * too. It was NOT invisible to the two things that read the normal as a
   * direction: the baked AO fan is cast along it, and the substance shader
   * steps back along it to find the cell behind a face.
   */

  /** Solid below `topY`, air above, at a coarse cell so the counts stay small. */
  function slab(topY = 4, extentM = 8, cellM = 0.5) {
    return fillBubbleFromGround(groundSource(() => topY), 0, 0, extentM, cellM);
  }

  /**
   * Split the faces into those with air in FRONT and solid BEHIND (correct) and
   * those with it the other way round (inverted).
   *
   * Orientation-agnostic on purpose: it asks the VOLUME what is on each side of
   * the face rather than assuming which way any particular surface should look,
   * so it holds for a ground top, a pit floor, a wall and the bubble's own seal
   * alike.
   */
  function faceSides(
    m: { indices: Uint32Array; positions: Float32Array },
    v: VoxelVolume,
    originM: readonly [number, number, number],
    cellM: number,
  ): { correct: number; inverted: number; ambiguous: number } {
    let correct = 0;
    let inverted = 0;
    let ambiguous = 0;
    for (let t = 0; t < m.indices.length; t += 3) {
      const p = (k: number, c: number) => m.positions[m.indices[t + k] * 3 + c];
      const c0 = [0, 1, 2].map((c) => (p(0, c) + p(1, c) + p(2, c)) / 3);
      const u = [0, 1, 2].map((c) => p(1, c) - p(0, c));
      const w = [0, 1, 2].map((c) => p(2, c) - p(0, c));
      const n = [
        u[1] * w[2] - u[2] * w[1],
        u[2] * w[0] - u[0] * w[2],
        u[0] * w[1] - u[1] * w[0],
      ];
      const len = Math.hypot(n[0], n[1], n[2]);
      if (len < 1e-9) {
        ambiguous++;
        continue;
      }
      // Step three quarters of a cell each way — past the smoothing offset a
      // surface-nets vertex carries, but not into the next cell but one.
      const at = (sign: number) =>
        v.get(
          Math.floor((c0[0] + (n[0] / len) * sign * cellM * 0.75 - originM[0]) / cellM),
          Math.floor((c0[1] + (n[1] / len) * sign * cellM * 0.75 - originM[1]) / cellM),
          Math.floor((c0[2] + (n[2] / len) * sign * cellM * 0.75 - originM[2]) / cellM),
        ) !== Material.Air;
      const front = at(1);
      const back = at(-1);
      if (front === back) ambiguous++;
      else if (back) correct++;
      else inverted++;
    }
    return { correct, inverted, ambiguous };
  }

  it('winds every face toward the AIR, not into the ground', () => {
    const f = slab();
    const m = voxelsToSurface(f.volume, f.cellM, f.originM, (d) => materialAtDepth(d));
    const s = faceSides(m, f.volume, f.originM, f.cellM);
    expect(s.correct).toBeGreaterThan(0);
    // A handful of faces sit where the rim jitter has moved a vertex far enough
    // that a three-quarter-cell probe lands in the wrong cell. The claim is that
    // inversion is the rare exception and not, as it was, the rule.
    expect(s.inverted).toBeLessThan(s.correct * 0.02);
  });

  it('points the vertex normals of a flat ground top UPWARD', () => {
    const f = slab();
    const m = voxelsToSurface(f.volume, f.cellM, f.originM, (d) => materialAtDepth(d));
    let up = 0;
    let down = 0;
    for (let i = 0; i < m.positions.length / 3; i++) {
      // Only the undisturbed top surface; the bubble's own floor and sides
      // legitimately face elsewhere.
      if (Math.abs(m.positions[i * 3 + 1] - 4) > f.cellM) continue;
      if (m.normals[i * 3 + 1] > 0.5) up++;
      else if (m.normals[i * 3 + 1] < -0.5) down++;
    }
    expect(up).toBeGreaterThan(0);
    expect(down).toBe(0);
  });

  it('bakes AO near 1 on open ground, because the fan is cast at the SKY', () => {
    /* The measurable cost of the inverted winding, and the reason it was worth
     * finding: the fan follows the vertex normal, so a downward normal probed
     * straight into the rock and every probe came back occluded. Open, flat,
     * unshadowed ground baked to AO 0.054 — and the substance shader multiplies
     * albedo by `mix(0.48, 1, ao^1.1)`, so the whole volume drew at about half
     * the brightness it should. */
    const f = slab();
    const m = voxelsToSurface(f.volume, f.cellM, f.originM, (d) => materialAtDepth(d));
    let n = 0;
    let sum = 0;
    for (let i = 0; i < m.positions.length / 3; i++) {
      if (Math.abs(m.positions[i * 3 + 1] - 4) > f.cellM) continue;
      // Skip the rim, where the bubble's own side wall genuinely occludes.
      if (Math.abs(m.positions[i * 3]) > 2 || Math.abs(m.positions[i * 3 + 2]) > 2) continue;
      n++;
      sum += m.ao[i];
    }
    expect(n).toBeGreaterThan(0);
    expect(sum / n).toBeGreaterThan(0.95);
  });

  it('faces the floor of a CUT upward, so a trench has something to stand on', () => {
    const f = slab();
    const n = f.cellsPerEdge;
    const mid = Math.floor(n / 2);
    const surfaceCell = Math.floor((4 - f.originM[1]) / f.cellM);
    const floorCell = surfaceCell - 4;
    for (let y = surfaceCell; y > floorCell; y--) {
      for (let z = mid - 3; z <= mid + 3; z++) {
        for (let x = mid - 3; x <= mid + 3; x++) f.volume.set(x, y, z, Material.Air);
      }
    }
    const m = voxelsToSurface(f.volume, f.cellM, f.originM, (d) => materialAtDepth(d));
    const floorY = f.originM[1] + (floorCell + 1) * f.cellM;
    let up = 0;
    let down = 0;
    for (let t = 0; t < m.indices.length; t += 3) {
      const p = (k: number, c: number) => m.positions[m.indices[t + k] * 3 + c];
      const cy = (p(0, 1) + p(1, 1) + p(2, 1)) / 3;
      if (Math.abs(cy - floorY) > f.cellM * 0.6) continue;
      // Inside the trench only, clear of its walls.
      const cx = (p(0, 0) + p(1, 0) + p(2, 0)) / 3;
      const cz = (p(0, 2) + p(1, 2) + p(2, 2)) / 3;
      if (Math.abs(cx) > 1 || Math.abs(cz) > 1) continue;
      const u = [0, 1, 2].map((c) => p(1, c) - p(0, c));
      const w = [0, 1, 2].map((c) => p(2, c) - p(0, c));
      const ny = u[2] * w[0] - u[0] * w[2];
      if (ny > 1e-9) up++;
      else if (ny < -1e-9) down++;
    }
    expect(up).toBeGreaterThan(0);
    expect(down).toBe(0);
  });
});

describe('writes outside the volume', () => {
  /* The regression the ADR claimed was already covered.
   *
   * `get` was bounds-checked and `set` was not. A negative index does not fall
   * off the array — it lands inside a real brick up to eight cells away, so one
   * out-of-range write silently changed an in-range cell. Carve loops run
   * center plus or minus a radius, so the first spell near a bubble edge would
   * have hit this.
   */
  it('does not corrupt a DIFFERENT cell', () => {
    const v = new VoxelVolume(16);
    for (let z = 0; z < 16; z++) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) v.set(x, y, z, Material.Air);
      }
    }
    // Every out-of-range write below must change nothing at all.
    v.set(-1, 0, 8, Material.Granite);
    v.set(0, -1, 8, Material.Granite);
    v.set(8, 8, -1, Material.Granite);
    v.set(16, 8, 8, Material.Granite);
    v.set(8, 16, 8, Material.Granite);
    v.set(8, 8, 16, Material.Granite);

    for (let z = 0; z < 16; z++) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          expect(v.get(x, y, z), `cell ${x},${y},${z}`).toBe(Material.Air);
        }
      }
    }
  });

  it('reads back Air outside, in both directions', () => {
    const v = new VoxelVolume(16);
    expect(v.get(-1, 0, 0)).toBe(Material.Air);
    expect(v.get(16, 0, 0)).toBe(Material.Air);
  });
});

describe('the bubble goes SLAB', () => {
  /* Ground is wide and thin, and a cube spends its whole budget on the two axes
   * that carry the least information. These tests pin the two halves of that
   * change: a caller that says nothing still gets the exact cube it always got,
   * and a caller that asks for a slab gets a volume whose vertical arithmetic is
   * in `cellHM` everywhere rather than in `cellM`.
   *
   * The trap this guards is silent: a slab built with cubic Y arithmetic looks
   * plausible — solid below, air above — but every depth is wrong by the cell
   * ratio, so the strata band at the wrong height and the water bed sits at the
   * wrong level. Nothing throws. */

  it('defaults to the cube every caller had', () => {
    const f = fillBubbleFromGround(slope, 0, 0, 8, 0.25);
    expect(f.cellsY).toBe(f.cellsPerEdge);
    expect(f.cellHM).toBe(f.cellM);
  });

  it('a stated height and vertical cell decide the vertical lattice alone', () => {
    const f = fillBubbleFromGround(slope, 0, 0, 32, 1, undefined, { heightM: 16, cellHM: 0.5 });
    expect(f.cellsPerEdge).toBe(32); // 32 m at 1 m — unmoved by the height
    expect(f.cellsY).toBe(32); // 16 m at 0.5 m
    expect(f.volume.cells).toBe(32);
    expect(f.volume.cellsY).toBe(32);
    expect(f.cellHM).toBe(0.5);
  });

  it('centers the surface on the bubble s OWN half height, not the horizontal one', () => {
    // Flat ground at y = 100, a 240 m wide slab only 32 m tall. A cube would put
    // the origin 120 m down; the slab must put it 16 m down, or the whole world
    // is built under the floor.
    const flat100 = groundSource(() => 100);
    const f = fillBubbleFromGround(flat100, 0, 0, 240, 1, undefined, { heightM: 32 });
    expect(f.cellsY).toBe(32);
    expect(f.originM[1]).toBeCloseTo(100 - 16, 6);
    // The surface lands in the middle row, not clipped at the top or the floor.
    // The origin row is 16 m down, so the surface itself is cell 16 and the
    // first air is 17 — a cube would have put the ground at row 120.
    const mid = f.cellsPerEdge >> 1;
    expect(f.volume.get(mid, 16, mid)).not.toBe(Material.Air);
    expect(f.volume.get(mid, 17, mid)).toBe(Material.Air);
  });

  it('measures DEPTH in vertical cells, so the strata do not stretch', () => {
    /* The bug this pins: with `cellM` used for the vertical walk, a 0.25 m
     * vertical cell would report a depth four times too large at 1 m horizontal
     * cells, and the litter band (12 cm) would vanish under one voxel of
     * "subsoil" everywhere. */
    const flat = groundSource(() => 0);
    const f = fillBubbleFromGround(flat, 0, 0, 16, 1, undefined, { heightM: 8, cellHM: 0.25 });
    expect(f.cellsY).toBe(32);
    const top = 16; // origin is 4 m down at 0.25 m cells, so the surface is row 16
    expect(f.volume.get(4, top + 1, 4)).toBe(Material.Air);
    // Depth 0.125 m at the top cell is litter; a cubic walk would have read
    // 0.5 m here and returned topsoil.
    expect(f.volume.get(4, top, 4)).toBe(Material.Litter);
  });

  it('a slab that cannot hold the relief clips at the top rather than corrupting', () => {
    // 40 m of relief into an 8 m slab: the columns that overflow stop at the
    // last row instead of writing past the end.
    const steep = groundSource((x) => x * 4);
    const f = fillBubbleFromGround(steep, 0, 0, 16, 1, undefined, { heightM: 8 });
    expect(f.cellsY).toBe(8);
    for (let x = 0; x < f.cellsPerEdge; x++) {
      expect(f.volume.get(x, f.cellsY, 4)).toBe(Material.Air); // one past the end
    }
    expect(f.volume.get(f.cellsPerEdge - 1, f.cellsY - 1, 4)).not.toBe(Material.Air);
  });

  it('never builds a volume with no room for a surface', () => {
    const f = fillBubbleFromGround(slope, 0, 0, 8, 0.25, undefined, { heightM: 0.5, cellHM: 1 });
    expect(f.cellsY).toBe(8); // one brick, the smallest thing that can hold a boundary
  });

  it('meshes a slab, and the mesh spans the slab s own height', () => {
    const flat = groundSource(() => 0);
    const f = fillBubbleFromGround(flat, 0, 0, 32, 1, undefined, { heightM: 8, cellHM: 0.5 });
    const m = voxelsToSurface(f.volume, f.cellM, f.originM, materialAtDepth, undefined, f.cellHM);
    expect(m.triangles).toBeGreaterThan(0);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 1; i < m.positions.length; i += 3) {
      if (m.positions[i] < lo) lo = m.positions[i];
      if (m.positions[i] > hi) hi = m.positions[i];
    }
    // Origin is 4 m below the flat ground; the mesh reaches from the sealed
    // floor to the ground and no further. A cubic mesher would have run the
    // lattice to 16 m of vertical cells and put the floor at -16.
    expect(lo).toBeGreaterThan(-5);
    expect(hi).toBeLessThan(1);
    expect(hi - lo).toBeGreaterThan(3);
  });

  it('the SLAB IS THE SEAL DIVIDEND: the same ground, fewer buried triangles', () => {
    /* ADR 0002 open item 2 — 69% of the bubble's triangles are an invisible
     * seal. Option A is to stop building a cube. This is that claim as a test:
     * same width, same cell, same terrain, a shorter volume, and strictly fewer
     * triangles for the SAME visible surface. */
    const cube = fillBubbleFromGround(slope, 0, 0, 32, 1);
    const slab = fillBubbleFromGround(slope, 0, 0, 32, 1, undefined, { heightM: 8 });
    const mc = voxelsToSurface(cube.volume, cube.cellM, cube.originM, materialAtDepth);
    const ms = voxelsToSurface(slab.volume, slab.cellM, slab.originM, materialAtDepth, undefined, slab.cellHM);
    expect(ms.triangles).toBeLessThan(mc.triangles);
  });
});
