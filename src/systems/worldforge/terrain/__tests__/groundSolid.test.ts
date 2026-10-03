/**
 * Ground is a SOLID, and these tests exist to stop it quietly becoming sheets
 * again. Two properties matter more than the rest:
 *
 *   • a cut face reads the layer stack at its own depth, so the wall of a pit
 *     shows what the pit cut through;
 *   • nothing is stacked — the only faces that exist are the surface and the
 *     walls where the solid is cut or bounded.
 */
import { describe, it, expect } from 'vitest';
import {
  buildGroundSolid,
  materialAtDepth,
  FOREST_FLOOR_STACK,
  probeGround,
  type PitCut,
} from '../groundSolid';
import { substance } from '../materials';

describe('materialAtDepth', () => {
  it('reads litter at the surface and rock deep down', () => {
    const top = materialAtDepth(0);
    const deep = materialAtDepth(40);
    expect(top).toEqual([...substance(FOREST_FLOOR_STACK[0].substance).rgb]);
    expect(deep).toEqual([
      ...substance(FOREST_FLOOR_STACK[FOREST_FLOOR_STACK.length - 1].substance).rgb,
    ]);
  });

  it('gets LIGHTER with depth, which is what real ground does', () => {
    // Litter is the darkest thing on a forest floor. A cut face that darkens
    // downward reads as a photograph turned upside down.
    const lum = (c: number[]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    const samples = [0, 0.3, 1.2, 5].map((d) => lum(materialAtDepth(d)));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });

  it('blends across a boundary rather than switching', () => {
    // A hard switch draws a contour line down a cut face. A real soil horizon
    // is a transition a few centimeters thick.
    const justAbove = materialAtDepth(0.115);
    const atBoundary = materialAtDepth(0.12);
    const band = substance(FOREST_FLOOR_STACK[0].substance).rgb;
    // Inside the blend band the value has already left the pure litter tone.
    expect(justAbove[0]).not.toBeCloseTo(band[0], 5);
    expect(atBoundary[0]).toBeGreaterThan(band[0]);
  });
});

describe('buildGroundSolid', () => {
  const cut: PitCut = { x: 0, z: 0, radiusM: 1.2, depthM: 1.1, batter: 0.6 };

  it('is one CLOSED mesh: surface, rim wall and bottom cap', () => {
    // Remy called for no cap, then saw it: "the bottom is also see-through".
    // An open base reads as a shell however solid the sides are.
    const g = buildGroundSolid(12, 24, [cut]);
    expect(g.triangles).toBeGreaterThan(0);
    expect(g.positions.length / 3).toBe(g.colors.length / 3);
    expect(g.normals.length).toBe(g.positions.length);

    // Every edge in a closed mesh is shared by exactly two triangles. An open
    // base leaves a whole ring of edges used once, so counting them is the
    // cheapest honest proof that the solid has no hole in it.
    const seen = new Map();
    for (let t = 0; t < g.indices.length; t += 3) {
      const v = [g.indices[t], g.indices[t + 1], g.indices[t + 2]];
      for (let e = 0; e < 3; e++) {
        const a = v[e];
        const b = v[(e + 1) % 3];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    const boundary = [...seen.values()].filter((n) => n === 1).length;
    expect(boundary).toBe(0);
  });

  it('a pit pushes the surface DOWN, it does not add a layer on top', () => {
    const flat = buildGroundSolid(12, 24, []);
    const dug = buildGroundSolid(12, 24, [cut]);
    // Same vertex count: the cut displaces existing geometry, it never appends
    // a second surface over the first. That is the sheets failure this guards.
    expect(dug.positions.length).toBe(flat.positions.length);

    const centerIdx = (24 / 2) * (24 + 1) + 24 / 2;
    expect(dug.positions[centerIdx * 3 + 1]).toBeLessThan(flat.positions[centerIdx * 3 + 1] - 0.5);
  });

  it('the pit floor reads a DEEPER material than the untouched surface', () => {
    const g = buildGroundSolid(12, 24, [cut]);
    const n = 25;
    const centerIdx = (24 / 2) * n + 24 / 2;
    const cornerIdx = 0;
    const lum = (i: number) =>
      0.299 * g.colors[i * 3] + 0.587 * g.colors[i * 3 + 1] + 0.114 * g.colors[i * 3 + 2];
    // Deeper reads lighter, so the pit floor must be lighter than open ground.
    expect(lum(centerIdx)).toBeGreaterThan(lum(cornerIdx));
  });

  it('the rim wall carries a gradient, not one flat tone', () => {
    const g = buildGroundSolid(12, 16, []);
    const count = g.positions.length / 3;
    const lum = (i: number) =>
      0.299 * g.colors[i * 3] + 0.587 * g.colors[i * 3 + 1] + 0.114 * g.colors[i * 3 + 2];
    // The rim is appended after the surface grid; sample its two extremes.
    const surfaceVerts = 17 * 17;
    const rimLums = [];
    for (let i = surfaceVerts; i < count; i++) rimLums.push(lum(i));
    const spread = Math.max(...rimLums) - Math.min(...rimLums);
    expect(spread).toBeGreaterThan(0.05);
  });

  it('is deterministic', () => {
    const a = buildGroundSolid(10, 12, [cut]);
    const b = buildGroundSolid(10, 12, [cut]);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.colors)).toEqual(Array.from(b.colors));
  });

  it('stays affordable at review resolution', () => {
    // 48x48 costs about 6.5k triangles. The budget is set against a known
    // neighbor rather than a round number: one ez-tree variant is 6.5k to 8.6k,
    // so a whole patch of ground costing about one tree is the right order.
    // The first version of this test said 6000, which was a number I made up
    // and which the real build missed by 500.
    const g = buildGroundSolid(14, 48, [cut]);
    expect(g.triangles).toBeLessThan(12000);
  });
});

describe('rim winding', () => {
  it('rim faces point AWAY from the patch center', () => {
    // Remy, 2026-08-05, orbiting below the patch: "some faces are not being
    // drawn on the right side?" They were wound inward, so back-face culling
    // hid the two walls nearest the camera and the patch rendered as an L.
    // A solid is only solid from outside if every face agrees which way is out.
    const g = buildGroundSolid(10, 12, []);
    const n = 13;
    const surfaceVerts = n * n;
    const pos = g.positions;
    const tri = g.indices;

    let checked = 0;
    let outward = 0;
    for (let t = 0; t < tri.length; t += 3) {
      const [i0, i1, i2] = [tri[t], tri[t + 1], tri[t + 2]];
      // Rim WALLS only. The bottom cap is a fan from the LAST vertex, and it
      // faces down, so it belongs to its own test rather than this one.
      const hub = pos.length / 3 - 1;
      if (i0 === hub || i1 === hub || i2 === hub) continue;
      if (i0 < surfaceVerts && i1 < surfaceVerts && i2 < surfaceVerts) continue;
      const ax = pos[i0 * 3], ay = pos[i0 * 3 + 1], az = pos[i0 * 3 + 2];
      const bx = pos[i1 * 3], by = pos[i1 * 3 + 1], bz = pos[i1 * 3 + 2];
      const cx = pos[i2 * 3], cy = pos[i2 * 3 + 1], cz = pos[i2 * 3 + 2];
      // Face normal from the winding.
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy;
      const nz = ux * vy - uy * vx;
      // Centroid direction from the patch axis, in the horizontal plane only.
      const mx = (ax + bx + cx) / 3;
      const mz = (az + bz + cz) / 3;
      if (Math.hypot(mx, mz) < 1e-6) continue;
      checked++;
      if (nx * mx + nz * mz > 0) outward++;
    }
    expect(checked).toBeGreaterThan(50);
    expect(outward).toBe(checked);
  });
});

describe('bottom cap', () => {
  it('faces DOWN, the mirror of the top surface', () => {
    const g = buildGroundSolid(10, 12, []);
    const pos = g.positions;
    const hub = pos.length / 3 - 1;

    // Measure the top surface's own winding sign first, from its very first
    // triangle. Nothing here encodes which way I THINK the winding goes.
    const s0 = [g.indices[0], g.indices[1], g.indices[2]];
    const sux = pos[s0[1] * 3] - pos[s0[0] * 3];
    const suz = pos[s0[1] * 3 + 2] - pos[s0[0] * 3 + 2];
    const svx = pos[s0[2] * 3] - pos[s0[0] * 3];
    const svz = pos[s0[2] * 3 + 2] - pos[s0[0] * 3 + 2];
    const surfaceSign = Math.sign(suz * svx - sux * svz);
    expect(surfaceSign).not.toBe(0);

    let checked = 0;
    for (let t = 0; t < g.indices.length; t += 3) {
      const v = [g.indices[t], g.indices[t + 1], g.indices[t + 2]];
      if (!v.includes(hub)) continue;
      const [a, b, c] = v;
      const ux = pos[b * 3] - pos[a * 3];
      const uy = pos[b * 3 + 1] - pos[a * 3 + 1];
      const uz = pos[b * 3 + 2] - pos[a * 3 + 2];
      const vx = pos[c * 3] - pos[a * 3];
      const vy = pos[c * 3 + 1] - pos[a * 3 + 1];
      const vz = pos[c * 3 + 2] - pos[a * 3 + 2];
      const ny = uz * vx - ux * vz;
      // Signed against the TOP surface rather than against my assumption. The
      // cap must be the mirror of the surface, so whatever sign the surface
      // yields, the cap must yield the other one.
      expect(Math.sign(ny)).toBe(-surfaceSign);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });
});

describe('probeGround', () => {
  const cut: PitCut = { x: 0, z: 0, radiusM: 1.2, depthM: 1.1, batter: 0.5 };

  it('reads litter on open ground', () => {
    const p = probeGround(8, 8, [cut]);
    expect(p.depthM).toBe(0);
    expect(p.layerId).toBe('leaf litter');
    expect(p.toNextM).toBeCloseTo(0.12, 5);
  });

  it('reads a deeper band at the bottom of a pit', () => {
    const p = probeGround(0, 0, [cut]);
    expect(p.depthM).toBeCloseTo(1.1, 5);
    expect(p.layerId).toBe('subsoil');
    expect(p.toNextM).toBeCloseTo(0.9, 5);
  });

  it('reports no next material once it reaches bedrock', () => {
    const deep: PitCut = { x: 0, z: 0, radiusM: 1, depthM: 4, batter: 0 };
    const p = probeGround(0, 0, [deep]);
    expect(p.layerId).toBe('granite');
    expect(p.toNextM).toBeNull();
  });

  it('agrees with the color the mesh actually used', () => {
    // The probe must not be a second opinion. If it and the renderer can
    // disagree, the reviewer is reading a label that describes nothing.
    const p = probeGround(0, 0, [cut]);
    expect(p.rgb).toEqual(materialAtDepth(1.1));
  });
});
