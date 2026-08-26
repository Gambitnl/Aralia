/**
 * Water-sheet triangle culling.
 *
 * Every test below is a shape that produced a visible fault on a real page:
 * a sheet through a crater wall, a blade across a spill lip, a shore that
 * ended in mid air under the old bed-relief rule, and the square bites the
 * 2 cm brim band chewed along a shelving shoreline. The fix for the last two
 * is geometric — the caller tucks shore vertices under the ground — so these
 * tests build their `levels` exactly the way the caller does.
 */
import { describe, it, expect } from 'vitest';
import {
  wetQuadIndices,
  steepFilmQuadIndices,
  filmContactFeather,
  DRY_M,
  RELIEF_PER_CELL,
  TUCK_M,
} from '../waterSheet';

/** Indices for an n-by-n grid, sized as the caller must size it. */
function buffer(n: number): Uint32Array {
  return new Uint32Array((n - 1) * (n - 1) * 6);
}

/**
 * Drawn-surface heights the way the caller builds them: bed plus depth on a
 * wet vertex; on a dry vertex the highest wet 4-neighbor's surface, tucked to
 * just under the vertex's own ground; its own bed with no wet neighbor.
 */
function pinnedLevels(depth: Float32Array, bed: Float32Array, n: number): Float32Array {
  const levels = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      if (depth[i] > DRY_M) {
        levels[i] = bed[i] + depth[i];
        continue;
      }
      let level = -Infinity;
      const take = (j: number) => {
        if (depth[j] > DRY_M) level = Math.max(level, bed[j] + depth[j]);
      };
      if (x > 0) take(i - 1);
      if (x < n - 1) take(i + 1);
      if (z > 0) take(i - n);
      if (z < n - 1) take(i + n);
      levels[i] = level === -Infinity ? bed[i] : Math.min(level, bed[i] - TUCK_M);
    }
  }
  return levels;
}

describe('wetQuadIndices', () => {
  it('draws nothing on dry ground', () => {
    const n = 8;
    const depth = new Float32Array(n * n);
    expect(wetQuadIndices(depth, n, buffer(n))).toBe(0);
  });

  it('draws every quad when the whole patch is flooded', () => {
    const n = 8;
    const depth = new Float32Array(n * n).fill(1);
    expect(wetQuadIndices(depth, n, buffer(n))).toBe((n - 1) * (n - 1) * 6);
  });

  it('treats a film thinner than DRY_M as dry', () => {
    // A film a few millimeters deep is spray, not a surface. Drawn, it becomes
    // a wide blue wash over ground that looks dry.
    const n = 4;
    const depth = new Float32Array(n * n).fill(DRY_M / 2);
    expect(wetQuadIndices(depth, n, buffer(n))).toBe(0);
  });

  it('never writes past the buffer the caller sized', () => {
    const n = 16;
    const depth = new Float32Array(n * n).fill(1);
    const out = buffer(n);
    expect(wetQuadIndices(depth, n, out)).toBe(out.length);
  });

  it('is strict without levels: any dry corner drops the quad', () => {
    /* The fallback for callers that pin nothing. A quad with a corner at its
     * own dry ground height stretches from the pool floor to wherever that
     * ground is, so nothing partly wet is safe to draw. */
    const n = 3;
    const depth = new Float32Array(n * n).fill(1);
    depth[0] = 0;
    const out = buffer(n);
    expect(wetQuadIndices(depth, n, out)).toBe(3 * 6);
    for (let i = 0; i < 3 * 6; i++) expect(out[i]).not.toBe(0);
  });

  it('keeps a pool and drops its shoreline under the strict rule', () => {
    const n = 6;
    const depth = new Float32Array(n * n);
    for (let z = 2; z <= 4; z++) for (let x = 2; x <= 4; x++) depth[z * n + x] = 0.8;
    const out = buffer(n);
    const count = wetQuadIndices(depth, n, out);
    expect(count).toBe(4 * 6); // the 2x2 block of quads inside the 3x3 pool

    // Every emitted vertex is a wet cell. Nothing on the bank is referenced.
    for (let i = 0; i < count; i++) expect(depth[out[i]]).toBeGreaterThan(DRY_M);
  });

  it('KEEPS a shallow shoreline on flat ground, so the edge is soft', () => {
    // On level ground a partly wet quad is what a soft waterline is made of.
    // The fringe tucks under the beach and the sheet dips gently to meet it.
    const n = 3;
    const depth = new Float32Array(n * n).fill(0.3);
    depth[0] = 0;
    const bed = new Float32Array(n * n); // dead flat
    const levels = pinnedLevels(depth, bed, n);
    expect(wetQuadIndices(depth, n, buffer(n), DRY_M, levels)).toBe(4 * 6);
  });

  it('KEEPS the shore quad against a steep bank — the terrain cuts the waterline', () => {
    /* THE floating-rim fix. A crater wall three meters high with a half-meter
     * pool at its foot. The old bed-relief rule dropped this quad and the
     * sheet ended in mid air one cell short of the wall. Pinned flat at the
     * water level, the quad runs INTO the bank, where the ground is above the
     * water, and the depth buffer draws the true waterline. */
    const n = 3;
    const depth = new Float32Array(n * n).fill(0.5);
    depth[0] = 0;
    const bed = new Float32Array(n * n);
    bed[0] = 3; // the bank towers over the pool
    const levels = pinnedLevels(depth, bed, n);
    expect(wetQuadIndices(depth, n, buffer(n), DRY_M, levels)).toBe(4 * 6);
    // The pin is untucked here: the bank is far above the level.
    expect(levels[0]).toBeCloseTo(0.5);
  });

  it('KEEPS the quad at a brim, tucked under the bank top — no chips, no z-fight', () => {
    /* The shore-chip regression. The old brim band dropped any quad whose dry
     * corner sat within 2 cm of the level, and a shelving shoreline grew
     * square bites as the pool level swept through bed heights. The tuck
     * replaces the cull: the quad stays, and its shore vertex ends strictly
     * below the ground so the coplanar z-fight cannot exist. */
    const n = 3;
    const depth = new Float32Array(n * n).fill(1);
    depth[0] = 0;
    const bed = new Float32Array(n * n);
    bed[0] = 1; // ground exactly at the water level
    const levels = pinnedLevels(depth, bed, n);
    expect(wetQuadIndices(depth, n, buffer(n), DRY_M, levels)).toBe(4 * 6);
    expect(levels[0]).toBeLessThan(bed[0]); // under the terrain skin
    expect(levels[0]).toBeCloseTo(1 - TUCK_M);
  });

  it('DROPS a deep flood front, so no curtain drapes down its face', () => {
    // A dam-break edge: a meter of water beside dry ground at the same bed
    // height. The tucked fringe would drape a steep curtain to the ground, and
    // the level test refuses the span.
    const n = 3;
    const depth = new Float32Array(n * n).fill(1.2);
    depth[0] = 0;
    const bed = new Float32Array(n * n); // flat: the front, not a bank
    const levels = pinnedLevels(depth, bed, n);
    expect(wetQuadIndices(depth, n, buffer(n), DRY_M, levels, 0.35)).toBe(3 * 6);
  });

  it('DROPS a cascading film down a steep wall when the caller opts in', () => {
    /* The deep-shaft confetti. A thin solver film running down a near-vertical
     * wall is all-wet in every corner while spanning a cell of height per
     * quad, and the unconditional all-wet rule drew it as scattered saturated
     * triangles down the bore. With the opt-in, the level test judges wet
     * quads too, and the cascade is refused while a level pool is untouched. */
    const n = 3;
    const depth = new Float32Array(n * n).fill(0.1); // a film, everywhere wet
    const bed = new Float32Array(n * n);
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) bed[z * n + x] = x * 2; // a wall
    const levels = pinnedLevels(depth, bed, n);
    // Without the opt-in the cascade draws (the old behavior, preserved).
    expect(wetQuadIndices(depth, n, buffer(n), DRY_M, levels, 0.7)).toBe(4 * 6);
    // With it, every draped quad is refused.
    expect(wetQuadIndices(depth, n, buffer(n), DRY_M, levels, 0.7, true)).toBe(0);
    // And a LEVEL pool with the opt-in still draws in full.
    const flatBed = new Float32Array(n * n);
    const flatLevels = pinnedLevels(depth, flatBed, n);
    expect(wetQuadIndices(depth, n, buffer(n), DRY_M, flatLevels, 0.7, true)).toBe(4 * 6);
  });

  it('DROPS the blade across a spill lip between two water levels', () => {
    /* A quad whose corners belong to different pools spans both levels and is
     * drawn as a sheet down the wall between them. The level test catches it:
     * the drawn surface is nowhere near level across that quad. */
    const n = 3;
    const depth = new Float32Array(n * n);
    const bed = new Float32Array(n * n);
    // Left column: a high pool. Right column: a low pool. Middle: the dry lip.
    for (let z = 0; z < n; z++) {
      bed[z * n + 0] = 4;
      depth[z * n + 0] = 0.5; // surface 4.5
      bed[z * n + 1] = 5; // the lip, dry, above both surfaces
      bed[z * n + 2] = 0;
      depth[z * n + 2] = 0.4; // surface 0.4
    }
    const levels = pinnedLevels(depth, bed, n);
    /* The high pool's shore quads survive: pinned flat at 4.5 against a lip
     * at 5, they are the bank case. The LOW pool's quads carry a lip vertex
     * pinned to the high pool's 4.5 — a 4-meter span, the blade — and the
     * level test drops them. Two quads on each side of the lip: two remain. */
    expect(wetQuadIndices(depth, n, buffer(n), DRY_M, levels, 0.7)).toBe(2 * 6);
  });
});

describe('a bank one voxel high', () => {
  it('holds water at its brim without a climb, at any cell size', () => {
    /* Water flush with a one-voxel bank once made the sheet climb it and draw
     * over the cut wall behind — then the guard against that chewed chips out
     * of every shelving shore. The tuck settles both: the quad draws to the
     * very rim, and its shore vertex sits under the bank top by construction. */
    const n = 3;
    for (const cellM of [0.25, 0.5, 1, 2]) {
      const depth = new Float32Array(n * n).fill(cellM);
      depth[0] = 0;
      const bed = new Float32Array(n * n);
      bed[0] = cellM; // exactly one voxel of bank, flush with the surface
      const levels = pinnedLevels(depth, bed, n);
      const count = wetQuadIndices(
        depth, n, buffer(n), DRY_M, levels, cellM * RELIEF_PER_CELL,
      );
      expect(count, `cell ${cellM} m`).toBe(4 * 6);
      expect(levels[0], `cell ${cellM} m`).toBeLessThan(bed[0]);
    }
  });

  it('is drawn into while the water sits below its top', () => {
    // The same bank with the pool half a voxel below the brim: a plain bank,
    // and the shore quad reaches it so the terrain can cut the waterline.
    const n = 3;
    const cellM = 1;
    const depth = new Float32Array(n * n).fill(cellM * 0.5);
    depth[0] = 0;
    const bed = new Float32Array(n * n);
    bed[0] = cellM;
    const levels = pinnedLevels(depth, bed, n);
    expect(
      wetQuadIndices(depth, n, buffer(n), DRY_M, levels, cellM * RELIEF_PER_CELL),
    ).toBe(4 * 6);
  });
});

describe('steepFilmQuadIndices', () => {
  it('draws exactly the all-wet quads the level sheet refused — a partition', () => {
    /* A steep flooded staircase: every quad all-wet, surfaces dropping a
     * whole cell per step. The sheet (with the steep cull on) refuses them
     * all; the film must pick up every one — together they are the whole
     * wet surface, with no quad drawn twice and none dropped. */
    const n = 4;
    const cellM = 1;
    const depth = new Float32Array(n * n).fill(0.3);
    const bed = new Float32Array(n * n);
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) bed[z * n + x] = (n - x) * 2;
    }
    const levels = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) levels[i] = bed[i] + depth[i];
    const sheet = wetQuadIndices(
      depth, n, buffer(n), DRY_M, levels, cellM * RELIEF_PER_CELL, true,
    );
    const film = steepFilmQuadIndices(
      depth, n, buffer(n), levels, cellM * RELIEF_PER_CELL,
    );
    expect(sheet).toBe(0);
    expect(film).toBe((n - 1) * (n - 1) * 6);
  });

  it('never draws a level pool quad — the sheet owns it', () => {
    const n = 4;
    const depth = new Float32Array(n * n).fill(0.5);
    const bed = new Float32Array(n * n);
    const levels = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) levels[i] = bed[i] + depth[i];
    expect(steepFilmQuadIndices(depth, n, buffer(n), levels, 0.7)).toBe(0);
  });

  it('refuses a LONE steep quad — no detached panes off a crest', () => {
    /* Round 6's crest artifact: one all-wet steep quad whose every neighbor
     * quad had a dry corner drew as a single translucent pane floating in
     * the air by the spill lip. A film continues the sheet; a quad nothing
     * connects to is spray, and its mass belongs to the unpictured term. */
    const n = 4;
    const depth = new Float32Array(n * n);
    // Exactly the 2x2 vertex block of quad (1,1) is wet — a lone quad.
    depth[1 * n + 1] = 0.3;
    depth[1 * n + 2] = 0.3;
    depth[2 * n + 1] = 0.3;
    depth[2 * n + 2] = 0.3;
    const bed = new Float32Array(n * n);
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) bed[z * n + x] = x * 2;
    const levels = pinnedLevels(depth, bed, n);
    expect(steepFilmQuadIndices(depth, n, buffer(n), levels, 0.7)).toBe(0);
  });

  it('feathers the wet contact line to zero and keeps the interior at one', () => {
    /* The round-7 sawtooth: film quads ended at full opacity on the bare
     * lattice edge past the last wet cell. The feather is the film
     * material's alpha source — 0 at any wet vertex with a dry 4-neighbor
     * (and on dry ground), 1 strictly inside the wet set — so the film's
     * silhouette dissolves at the wet-cell contact line. */
    const n = 5;
    const depth = new Float32Array(n * n);
    // A 3x3 wet block centered at (2,2): only its center is interior.
    for (let z = 1; z <= 3; z++) for (let x = 1; x <= 3; x++) depth[z * n + x] = 0.4;
    const out = new Float32Array(n * n);
    filmContactFeather(depth, n, out);
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        if (x === 2 && z === 2) expect(out[i], `interior ${x},${z}`).toBe(1);
        else expect(out[i], `edge/dry ${x},${z}`).toBe(0);
      }
    }
  });

  it('feathers the grid border: the patch edge is a contact line too', () => {
    const n = 3;
    const depth = new Float32Array(n * n).fill(1);
    const out = new Float32Array(n * n);
    filmContactFeather(depth, n, out);
    // Only the center of a flooded 3x3 has four wet neighbors; every border
    // vertex reads off-grid as dry and feathers to zero.
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        expect(out[z * n + x], `${x},${z}`).toBe(x === 1 && z === 1 ? 1 : 0);
      }
    }
  });

  it('never draws a shoreline quad — the pin-and-tuck rule owns those', () => {
    /* One dry corner on a steep bank. However steep the drawn surface, a
     * partly wet quad is a shoreline and the film must refuse it. */
    const n = 3;
    const depth = new Float32Array(n * n).fill(0.4);
    depth[0] = 0; // a dry bank corner
    const bed = new Float32Array(n * n);
    bed[0] = 5;
    const levels = pinnedLevels(depth, bed, n);
    expect(steepFilmQuadIndices(depth, n, buffer(n), levels, 0.7)).toBe(0);
  });
});
