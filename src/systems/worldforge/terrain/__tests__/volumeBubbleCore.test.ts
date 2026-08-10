/**
 * @file volumeBubbleCore.test.ts
 *
 * The worker itself cannot be tested — Web Workers do not exist in Node — so
 * every claim the worker relies on is asserted here instead, against the pure
 * functions it calls.
 *
 * Three of these tests exist because the failure they catch is INVISIBLE:
 *
 * - A snapshot that loses a brick produces a volume that still looks like
 *   ground, just with a hole somewhere nobody is standing.
 * - A slab plan that misses a slab produces a mesh that is still a mesh, just
 *   short of a piece.
 * - A rim blend that never crosses zero produces a bubble that still joins,
 *   just with a wall standing in open ground.
 */
import { describe, it, expect } from 'vitest';
import { VoxelVolume, Material, BRICK_ALLOCATED } from '../voxelVolume';
import { groundSource } from '../groundVolumeFromWorld';
import { materialAtDepth } from '../groundSolid';
import { voxelsToSurface } from '../surfaceNets';
import {
  fillBubble,
  rimBlendedSource,
  planSlabs,
  slabCounts,
  meshSlab,
  depthDatumFor,
  transfersOfFill,
  transfersOfSlab,
  slabsForEdit,
  slabKey,
  tintSlab,
  tintRatio,
  RIM_RAMP_M,
  RIM_SINK_M,
  BUBBLE_SLAB_CELLS,
  BUBBLE_SLAB_CELLS_Y,
} from '../volumeBubbleCore';
import { applyBrush } from '../voxelBrush';
import { AO_REACH_CELLS } from '../surfaceNets';
import { BIOME_GROUND, colorAtDepth } from '../materials';

/** A gentle slope, so the volume has a real boundary band to carry. */
const slope = groundSource((x, z) => 2 + x * 0.08 + z * 0.05);

describe('VoxelVolume snapshot', () => {
  it('round-trips every cell of a filled bubble', () => {
    const f = fillBubble(slope, 0, 0, 8, 0.25);
    const a = VoxelVolume.fromSnapshot(f.snapshot);
    const n = a.cells;
    // Re-fill an independent volume to compare against.
    const b = fillBubble(slope, 0, 0, 8, 0.25);
    const bv = VoxelVolume.fromSnapshot(b.snapshot);
    /* Counted, not asserted per cell. One `expect` per cell is 32,768 matcher
     * calls and times the test out; the count says the same thing and names
     * the first offender when it fails. */
    let mismatches = 0;
    let firstBad: string | null = null;
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++) {
          if (a.get(x, y, z) !== bv.get(x, y, z)) {
            mismatches++;
            firstBad ??= `${x},${y},${z}: ${a.get(x, y, z)} vs ${bv.get(x, y, z)}`;
          }
        }
      }
    }
    expect(firstBad).toBe(null);
    expect(mismatches).toBe(0);
  });

  it('round-trips a volume that has been CARVED, not only filled', () => {
    // A carve is what allocates mixed bricks, and a mixed brick is the only
    // thing in the snapshot that carries cells. A fill-only test can pass with
    // the cell path entirely broken.
    const f = fillBubble(slope, 0, 0, 8, 0.25);
    const vol = VoxelVolume.fromSnapshot(f.snapshot);
    for (let y = 10; y < 18; y++) {
      for (let z = 10; z < 18; z++) {
        for (let x = 10; x < 18; x++) vol.set(x, y, z, Material.Air);
      }
    }
    const back = VoxelVolume.fromSnapshot(vol.snapshot());
    const n = vol.cells;
    let mismatches = 0;
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++) if (back.get(x, y, z) !== vol.get(x, y, z)) mismatches++;
      }
    }
    expect(mismatches).toBe(0);
    expect(back.get(12, 12, 12)).toBe(Material.Air);
  });

  it('flags allocated bricks with a byte no Material can take', () => {
    const f = fillBubble(slope, 0, 0, 8, 0.25);
    expect(BRICK_ALLOCATED).toBe(255);
    // Every Material member is far below the sentinel, so a uniform brick can
    // never be mistaken for an allocated one.
    for (const u of f.snapshot.brickUniform) {
      expect(u === BRICK_ALLOCATED || u <= Material.Water).toBe(true);
    }
  });

  it('carries far less than the dense volume', () => {
    const f = fillBubble(slope, 0, 0, 8, 0.25);
    const dense = f.cellsPerEdge ** 3;
    const sent = f.snapshot.brickUniform.length + f.snapshot.brickCells.length;
    expect(sent).toBeLessThan(dense);
  });

  it('offers only transferable buffers', () => {
    const f = fillBubble(slope, 0, 0, 8, 0.25);
    for (const b of transfersOfFill(f)) expect(b).toBeInstanceOf(ArrayBuffer);
  });
});

describe('fillBubble', () => {
  it('captures the pre-carve column top from the VOXELS', () => {
    const f = fillBubble(slope, 0, 0, 8, 0.25);
    const n = f.cellsPerEdge;
    expect(f.originalTopY.length).toBe(n * n);
    // Every column of this slope is inside the bubble, so every column has a
    // top, and each is within one cell of the analytic surface it was filled
    // from.
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const wx = f.originM[0] + (x + 0.5) * f.cellM;
        const wz = f.originM[2] + (z + 0.5) * f.cellM;
        const want = slope.surfaceYAt(wx, wz);
        expect(Math.abs(f.originalTopY[z * n + x] - want)).toBeLessThanOrEqual(f.cellM * 1.5);
      }
    }
  });

  it('reports a fill time and a non-empty volume', () => {
    const f = fillBubble(slope, 0, 0, 8, 0.25);
    expect(f.solidCells).toBeGreaterThan(0);
    expect(f.fillMs).toBeGreaterThanOrEqual(0);
  });
});

describe('depthDatumFor', () => {
  it('holds the top surface AT the top surface, within the deadband', () => {
    const f = fillBubble(slope, 0, 0, 8, 0.25);
    const datum = depthDatumFor(f.originalTopY, f.originM, f.cellM, f.cellsPerEdge);
    const wx = f.originM[0] + 4;
    const wz = f.originM[2] + 4;
    // The datum sits BELOW the column top by three quarters of a cell, so a
    // top-surface vertex — which surface nets can place up to a cell low —
    // reads a depth at or near zero instead of banding across a horizon.
    const n = f.cellsPerEdge;
    const x = Math.floor((wx - f.originM[0]) / f.cellM);
    const z = Math.floor((wz - f.originM[2]) / f.cellM);
    expect(f.originalTopY[z * n + x] - datum(wx, wz)).toBeCloseTo(f.cellM * 0.75, 6);
  });
});

describe('rimBlendedSource', () => {
  const extent = 64;
  const cell = 0.25;
  const flat = groundSource(() => 10);
  const blended = rimBlendedSource(flat, 0, 0, extent, cell);

  it('lifts the core just over one cell, so the bubble covers the heightfield', () => {
    const lift = blended.surfaceYAt(0, 0) - 10;
    expect(lift).toBeGreaterThan(cell);
    expect(lift).toBeLessThan(cell * 2);
  });

  it('sinks the rim well under the heightfield', () => {
    const atRim = blended.surfaceYAt(extent / 2, 0) - 10;
    expect(atRim).toBeCloseTo(-RIM_SINK_M, 6);
  });

  it('crosses the heightfield exactly once, inside the ramp', () => {
    // The join is "whichever surface is higher wins". That reads as seamless
    // only if the two cross — a blend that stays above leaves a wall at the
    // rim, and one that stays below never shows the bubble at all.
    const r1 = extent / 2;
    const r0 = r1 - RIM_RAMP_M;
    let crossings = 0;
    let prev = blended.surfaceYAt(0, 0) - 10;
    for (let r = 0; r <= r1; r += 0.05) {
      const d = blended.surfaceYAt(r, 0) - 10;
      if (prev > 0 && d <= 0) {
        crossings++;
        expect(r).toBeGreaterThan(r0);
        expect(r).toBeLessThanOrEqual(r1);
      }
      prev = d;
    }
    expect(crossings).toBe(1);
  });

  it('is radial, so the join does not depend on which way the player faces', () => {
    const a = blended.surfaceYAt(20, 0);
    const b = blended.surfaceYAt(0, 20);
    const c = blended.surfaceYAt(Math.SQRT1_2 * 20, Math.SQRT1_2 * 20);
    expect(a).toBeCloseTo(b, 6);
    expect(a).toBeCloseTo(c, 6);
  });
});

describe('planSlabs', () => {
  it('covers every lattice cell exactly once', () => {
    const cells = 64;
    const cn = cells + 1;
    const slabs = planSlabs(cells);
    const seen = new Set<string>();
    for (const s of slabs) {
      const key = `${s.cx},${s.cy},${s.cz}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    const { xz, y } = slabCounts(cells);
    expect(slabs.length).toBe(xz * xz * y);
    // The last slab on each axis must reach the last lattice cell.
    expect((xz - 1) * BUBBLE_SLAB_CELLS).toBeLessThanOrEqual(cn - 1);
    expect(xz * BUBBLE_SLAB_CELLS).toBeGreaterThanOrEqual(cn);
    expect(y * BUBBLE_SLAB_CELLS_Y).toBeGreaterThanOrEqual(cn);
  });

  it('delivers the surface band before the buried rock', () => {
    const slabs = planSlabs(256);
    const { y } = slabCounts(256);
    const mid = (y - 1) / 2;
    // The fill centers the terrain surface at mid-bubble, so the first slab out
    // must be one of the middle y band — that is what puts ground on screen
    // while the rock underneath is still being meshed.
    expect(Math.abs(slabs[0].cy - mid)).toBeLessThanOrEqual(0.5);
    const firstY = Math.abs(slabs[0].cy - mid);
    const lastY = Math.abs(slabs[slabs.length - 1].cy - mid);
    expect(lastY).toBeGreaterThan(firstY);
  });
});

describe('meshSlab', () => {
  it('partitions the volume: the slabs sum to the whole-volume mesh', () => {
    // This is the claim that makes chunked delivery safe. If the slabs
    // overlapped, faces would be drawn twice; if they left a gap, the ground
    // would have a hole. Neither is visible in a screenshot of a hillside.
    const f = fillBubble(slope, 0, 0, 16, 0.5);
    const vol = VoxelVolume.fromSnapshot(f.snapshot);
    const datum = depthDatumFor(f.originalTopY, f.originM, f.cellM, f.cellsPerEdge);
    const color = (d: number) => materialAtDepth(d);
    const whole = voxelsToSurface(vol, f.cellM, f.originM, color, datum);
    let sum = 0;
    for (const s of planSlabs(f.cellsPerEdge)) {
      const m = meshSlab(vol, f.cellM, f.originM, color, datum, s);
      if (m) sum += m.triangles;
    }
    expect(sum).toBe(whole.triangles);
  });

  it('returns null for a slab with no surface in it', () => {
    // Big enough to hold several slabs on each axis — the sky above the slope
    // and the rock below it are both empty of boundary and must cost nothing.
    const f = fillBubble(slope, 0, 0, 64, 0.5);
    const vol = VoxelVolume.fromSnapshot(f.snapshot);
    const datum = depthDatumFor(f.originalTopY, f.originM, f.cellM, f.cellsPerEdge);
    const empties = planSlabs(f.cellsPerEdge)
      .map((s) => meshSlab(vol, f.cellM, f.originM, (d) => materialAtDepth(d), datum, s))
      .filter((m) => m === null);
    expect(empties.length).toBeGreaterThan(0);
  });

  it('offers only transferable buffers', () => {
    const f = fillBubble(slope, 0, 0, 16, 0.5);
    const vol = VoxelVolume.fromSnapshot(f.snapshot);
    const datum = depthDatumFor(f.originalTopY, f.originM, f.cellM, f.cellsPerEdge);
    const s = planSlabs(f.cellsPerEdge)
      .map((p) => meshSlab(vol, f.cellM, f.originM, (d) => materialAtDepth(d), datum, p))
      .find((m) => m !== null);
    expect(s).toBeTruthy();
    for (const b of transfersOfSlab(s!)) expect(b).toBeInstanceOf(ArrayBuffer);
  });
});

describe('per-column ground', () => {
  const forest = BIOME_GROUND[6];
  const marsh = BIOME_GROUND[12];

  it('fills each column from its OWN stack', () => {
    // The west half is marsh, the east half forest. One bubble, two grounds.
    const f = fillBubble(groundSource(() => 4), 0, 0, 8, 0.25, (x) => (x < 0 ? marsh : forest));
    const vol = VoxelVolume.fromSnapshot(f.snapshot);
    const n = f.cellsPerEdge;
    const topAt = (ix: number, iz: number): Material => {
      for (let y = n - 1; y >= 0; y--) {
        const m = vol.get(ix, y, iz);
        if (m !== Material.Air) return m;
      }
      return Material.Air;
    };
    // A column each side of the divide, well clear of it.
    expect(topAt(2, n / 2)).toBe(Material.Peat);
    expect(topAt(n - 3, n / 2)).toBe(Material.Litter);
  });

  it('a single stack still fills exactly as it did', () => {
    const a = fillBubble(slope, 0, 0, 8, 0.25, forest);
    const b = fillBubble(slope, 0, 0, 8, 0.25, () => forest);
    const va = VoxelVolume.fromSnapshot(a.snapshot);
    const vb = VoxelVolume.fromSnapshot(b.snapshot);
    expect(a.solidCells).toBe(b.solidCells);
    const n = a.cellsPerEdge;
    for (let z = 0; z < n; z += 7) {
      for (let y = 0; y < n; y += 7) {
        for (let x = 0; x < n; x += 7) expect(vb.get(x, y, z)).toBe(va.get(x, y, z));
      }
    }
  });
});

describe('the per-vertex top tint', () => {
  it('is 1 everywhere when no tint is supplied', () => {
    const t = tintSlab(new Float32Array([0, 0, 0, 1, 1, 1]));
    expect([...t]).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('reads the column under each vertex, not the slab', () => {
    const pos = new Float32Array([-5, 0, 0, 5, 0, 0]);
    const t = tintSlab(pos, (x) => (x < 0 ? [2, 2, 2] : [0.5, 0.5, 0.5]));
    expect([...t.slice(0, 3)]).toEqual([2, 2, 2]);
    expect([...t.slice(3, 6)]).toEqual([0.5, 0.5, 0.5]);
  });

  it('rides on the mesh, so a slab always carries one tint per vertex', () => {
    const f = fillBubble(slope, 0, 0, 16, 0.5);
    const vol = VoxelVolume.fromSnapshot(f.snapshot);
    const datum = depthDatumFor(f.originalTopY, f.originM, f.cellM, f.cellsPerEdge);
    const s = planSlabs(f.cellsPerEdge)
      .map((p) => meshSlab(vol, f.cellM, f.originM, (d) => materialAtDepth(d), datum, p, () => [1, 1, 1]))
      .find((m) => m !== null);
    expect(s!.tint.length).toBe(s!.positions.length);
  });

  it('is exactly 1 for a column that matches its reference', () => {
    expect(tintRatio([0.2, 0.3, 0.4], [0.2, 0.3, 0.4])).toEqual([1, 1, 1]);
  });
});

describe('slabsForEdit', () => {
  /**
   * The bug this pins: a cut exposes a floor that belongs to a slab which
   * meshed to NOTHING at build time, so it was never delivered and a caller
   * re-meshing "the slabs I am drawing" can never create it. Live, that reads
   * as a trench with no bottom — a hole straight through to the sky.
   */
  it('names buried slabs that hold no geometry yet', () => {
    const stack = BIOME_GROUND[6];
    const f = fillBubble(groundSource(() => 0), 0, 0, 64, 0.25, stack);
    const vol = VoxelVolume.fromSnapshot(f.snapshot);
    const datum = depthDatumFor(f.originalTopY.slice(), f.originM, f.cellM, f.cellsPerEdge);
    const mesh = (s: { cx: number; cy: number; cz: number }) =>
      meshSlab(vol, f.cellM, f.originM, (d) => colorAtDepth(d, stack), datum, s);

    const before = new Map<string, number>();
    for (const s of planSlabs(f.cellsPerEdge)) {
      const m = mesh(s);
      if (m) before.set(slabKey(s), m.triangles);
    }

    const topY = f.originalTopY[
      Math.floor((0 - f.originM[2]) / f.cellM) * f.cellsPerEdge +
        Math.floor((0 - f.originM[0]) / f.cellM)
    ];
    const r = applyBrush(
      { volume: vol, cellM: f.cellM, originM: f.originM },
      [0, topY, 0],
      { shape: 'ditch', mode: 'dig', radiusM: 3.5, heightM: 2.2, lengthM: 26, axis: 'x' },
      stack,
    );
    expect(r.changed).toBeGreaterThan(1000);

    const touched = slabsForEdit(f.cellsPerEdge, r.min, r.max, AO_REACH_CELLS + 1);
    expect(touched.length).toBeGreaterThan(0);

    // At least one named slab drew NOTHING before the cut and draws now. That
    // is the trench floor, and it is exactly what a drawn-slab list omits.
    const fresh = touched
      .map((s) => ({ key: slabKey(s), before: before.get(slabKey(s)) ?? 0, after: mesh(s)?.triangles ?? 0 }))
      .filter((e) => e.before === 0 && e.after > 0);
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.reduce((a, e) => a + e.after, 0)).toBeGreaterThan(1000);
  });

  it('covers every slab the edit bounds reach, and no more than it must', () => {
    const all = planSlabs(256);
    const one = slabsForEdit(256, [130, 130, 130], [132, 132, 132], 0);
    expect(one.map(slabKey)).toEqual(['2,2,2']);
    // Padding across a slab boundary pulls the neighbour in.
    const spread = slabsForEdit(256, [128, 130, 130], [132, 132, 132], 8);
    expect(spread.length).toBeGreaterThan(1);
    expect(spread.length).toBeLessThan(all.length);
  });
});
