/**
 * The bounded particle domain, as arithmetic.
 *
 * These tests ask what the JOIN depends on, not whether the water looks good —
 * that judgment belongs on the page, in front of eyes. What has to be true on
 * paper is that the budget is a real ceiling, that particles stay inside the
 * box, that the ground is solid, and above all that the live COUNT moves only
 * where this file says it does: `waterHandoff` prices volume at
 * `live * quantum`, so a particle that appears or vanishes without passing
 * through spawn or drain is water appearing or vanishing.
 */
import { describe, expect, it } from 'vitest';
import {
  MPM_REST_DENSITY,
  createDomain,
  drainAll,
  drainSettled,
  spawnBall,
  stepDomain,
} from '../mpmDomain';
import { Material, VoxelVolume } from '../voxelVolume';
import type { SurfaceTarget } from '../volumeSurface';
import { packSpanField, spanFieldFromHeights, spanFieldToGrid } from '../spanField';

function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function flat(n = 20, capacity = 600) {
  return createDomain({
    n,
    dxM: 0.5,
    originM: [0, 0, 0],
    capacity,
    floorYAt: () => 0,
  });
}

describe('the budget', () => {
  it('is a hard ceiling, and reports what it could not take', () => {
    const d = flat(16, 100);
    expect(spawnBall(d, 60, [8, 10, 8], 2, [0, 0, 0], rng(1))).toBe(60);
    // The second ask overruns: 40 fit, and the caller MUST learn that, because
    // it already debited the sheet for all 60.
    expect(spawnBall(d, 60, [8, 10, 8], 2, [0, 0, 0], rng(2))).toBe(40);
    expect(d.live).toBe(100);
  });

  it('never lets a step change the live count', () => {
    const d = flat();
    spawnBall(d, 300, [10, 14, 10], 3, [0, -0.5, 0], rng(3));
    for (let i = 0; i < 40; i++) {
      stepDomain(d);
      expect(d.live).toBe(300);
    }
  });
});

describe('the box holds', () => {
  it('keeps every particle inside the domain and out of the ground', () => {
    const d = flat(20, 500);
    // Fire hard at a corner: the walls and the floor are what stop it.
    spawnBall(d, 400, [10, 14, 10], 3, [1.2, -1.5, 1.2], rng(4));
    for (let i = 0; i < 120; i++) stepDomain(d);
    const floorG = 0; // originM.y = 0, floor at y = 0 world
    for (let p = 0; p < d.live; p++) {
      for (let k = 0; k < 3; k++) {
        expect(d.pos[p * 3 + k]).toBeGreaterThanOrEqual(1 - 1e-4);
        expect(d.pos[p * 3 + k]).toBeLessThanOrEqual(d.n - 2 + 1e-4);
      }
      // The hard clamp puts a particle half a cell above the floor at worst.
      expect(d.pos[p * 3 + 1]).toBeGreaterThanOrEqual(floorG + 0.5 - 1e-4);
      expect(Number.isFinite(d.vel[p * 3 + 1])).toBe(true);
    }
  });

  it('runs down a slope instead of sliding up it', () => {
    /* The round-3 fault this file inherits a fix for: a vertical-clamp floor
     * deletes gravity's along-slope component and pumps energy in at every
     * step, so water climbs. Tangent-plane projection can only shrink speed. */
    const d = createDomain({
      n: 24,
      dxM: 0.5,
      originM: [0, 0, 0],
      capacity: 400,
      // Ground falls away with +x.
      floorYAt: (xM) => 4 - xM * 0.4,
    });
    spawnBall(d, 300, [12, 14, 12], 2, [0, 0, 0], rng(5));
    const startX = () => {
      let s = 0;
      for (let p = 0; p < d.live; p++) s += d.pos[p * 3];
      return s / d.live;
    };
    const x0 = startX();
    for (let i = 0; i < 150; i++) stepDomain(d);
    // Downhill is +x. It must have moved that way, and not the other.
    expect(startX()).toBeGreaterThan(x0);
  });
});

describe('the lifecycle', () => {
  it('drains a pool that has come to rest, and empties completely', () => {
    const d = flat(20, 800);
    spawnBall(d, 500, [10, 14, 10], 3, [0, 0, 0], rng(6));
    const out = new Float32Array(2000);
    let drained = 0;
    for (let i = 0; i < 600; i++) {
      stepDomain(d);
      drained += drainSettled(d, out);
    }
    // Everything that fell in eventually stops being a splash.
    expect(drained).toBeGreaterThan(450);
    expect(d.live + drained).toBe(500);
  });

  it('reports world coordinates a caller can turn into sheet cells', () => {
    const d = createDomain({
      n: 16,
      dxM: 0.5,
      originM: [100, 0, 200],
      capacity: 100,
      floorYAt: () => 0,
    });
    spawnBall(d, 40, [8, 8, 8], 1, [0, 0, 0], rng(7));
    const out = new Float32Array(200);
    const got = drainAll(d, out);
    expect(got).toBe(40);
    for (let k = 0; k < got; k++) {
      // The domain spans 100..108 in x and 200..208 in z.
      expect(out[k * 2]).toBeGreaterThan(100);
      expect(out[k * 2]).toBeLessThan(108);
      expect(out[k * 2 + 1]).toBeGreaterThan(200);
      expect(out[k * 2 + 1]).toBeLessThan(208);
    }
  });

  it('drains in batches when the output buffer is smaller than the pool', () => {
    // A caller with a fixed buffer must not silently lose the overflow — the
    // remainder stays live and comes out on the next call.
    const d = flat(16, 200);
    spawnBall(d, 150, [8, 8, 8], 2, [0, 0, 0], rng(8));
    const small = new Float32Array(100); // 50 pairs
    expect(drainAll(d, small)).toBe(50);
    expect(d.live).toBe(100);
    expect(drainAll(d, small)).toBe(50);
    expect(d.live).toBe(50);
    expect(drainAll(d, small)).toBe(50);
    expect(d.live).toBe(0);
  });

  it('leaves a stepped domain with no NaN anywhere', () => {
    // MLS-MPM divides by density. A single zero-mass node reached without the
    // guard poisons the whole field, and NaN water is invisible until the
    // ledger prints NaN too.
    const d = flat(18, 300);
    spawnBall(d, 200, [9, 13, 9], 2.5, [0.5, -1, -0.5], rng(9));
    for (let i = 0; i < 200; i++) stepDomain(d);
    for (let p = 0; p < d.live * 3; p++) {
      expect(Number.isFinite(d.pos[p])).toBe(true);
      expect(Number.isFinite(d.vel[p])).toBe(true);
    }
  });
});

describe('rest density', () => {
  it('is the count that fills one cell, which is what prices a particle', () => {
    // Not a tautology: `waterHandoff.particleVolumeM3` divides by this exact
    // constant, so if it ever drifts from the kernel's own value the ledger
    // drifts with it and nothing else in the suite would notice.
    expect(MPM_REST_DENSITY).toBe(4);
  });
});

/**
 * IMPL-3 — the tunnel. ADR 0002 open item 2.
 *
 * Everything above runs on ONE floor per column, which is the heightfield the
 * volume exists to replace. These tests build a real `VoxelVolume`, bore a
 * passage through a block of rock, pack it with `packSpanField`, and ask the
 * three questions a span collision has to answer: does water get IN, does it
 * come OUT the far side, and does any of it end up inside stone.
 *
 * The solid check is against `VoxelVolume.get` — the voxels themselves, not
 * the packed field. A packer that agreed with a kernel that agreed with it
 * would prove nothing.
 */
describe('water in a bored tunnel', () => {
  const N = 40;
  const DX = 0.5;
  /** Ground top, in cells. Also the tunnel floor: the passage runs in level. */
  const GROUND = 8;
  /** The rock block, in cells along x. */
  const BLOCK0 = 12;
  const BLOCK1 = 28;
  const BLOCK_TOP = 30;
  /** The bore: cells along z and y. */
  const TZ0 = 18;
  const TZ1 = 23;
  const TCEIL = 13;

  function boredWorld() {
    const volume = new VoxelVolume(N);
    for (let z = 0; z < N; z++)
      for (let x = 0; x < N; x++)
        for (let y = 0; y < GROUND; y++) volume.set(x, y, z, Material.Granite);
    for (let z = 0; z < N; z++)
      for (let x = BLOCK0; x < BLOCK1; x++)
        for (let y = GROUND; y < BLOCK_TOP; y++) volume.set(x, y, z, Material.Granite);
    for (let z = TZ0; z < TZ1; z++)
      for (let x = BLOCK0; x < BLOCK1; x++)
        for (let y = GROUND; y < TCEIL; y++) volume.set(x, y, z, Material.Air);
    const t: SurfaceTarget = { volume, cellM: DX, originM: [0, 0, 0] };
    const field = packSpanField(t);
    expect(field.overflow).toBe(0);
    return { volume, field };
  }

  function domainOn(field: ReturnType<typeof packSpanField>, capacity = 500) {
    return createDomain({
      n: N,
      dxM: DX,
      originM: [0, 0, 0],
      capacity,
      floorYAt: () => 0, // unused: spanG wins
      spanG: spanFieldToGrid(field, 0, DX),
      slots: field.slots,
    });
  }

  /** How many live particles sit in a cell the volume calls solid. */
  function buried(d: ReturnType<typeof createDomain>, volume: VoxelVolume): number {
    let n = 0;
    for (let p = 0; p < d.live; p++) {
      const cx = Math.floor(d.pos[p * 3]);
      const cy = Math.floor(d.pos[p * 3 + 1]);
      const cz = Math.floor(d.pos[p * 3 + 2]);
      if (cx < 0 || cy < 0 || cz < 0 || cx >= N || cy >= N || cz >= N) continue;
      if (volume.get(cx, cy, cz) !== Material.Air) n++;
    }
    return n;
  }

  it('lets a jet enter the mouth, run the passage, and leave the far end', () => {
    /* THE demonstration, as arithmetic. The old height buffer floors this
     * column at the top of the block, thirty cells up, so a jet aimed at the
     * mouth is stopped by a wall of nothing at all. */
    const { volume, field } = boredWorld();
    const d = domainOn(field);
    // A ball just west of the block, on the ground, thrown at the mouth.
    spawnBall(d, 150, [9, GROUND + 2.5, (TZ0 + TZ1) / 2], 2.2, [2.2, 0, 0], rng(31));

    let deepest = 0;
    let insideEver = 0;
    for (let i = 0; i < 400; i++) {
      stepDomain(d);
      expect(buried(d, volume)).toBe(0);
      let inside = 0;
      for (let p = 0; p < d.live; p++) {
        const x = d.pos[p * 3];
        if (x > deepest) deepest = x;
        if (x > BLOCK0 && x < BLOCK1) inside++;
      }
      if (inside > insideEver) insideEver = inside;
    }

    // It got in.
    expect(insideEver).toBeGreaterThan(50);
    // And out the far mouth: the block ends at cell 28.
    expect(deepest).toBeGreaterThan(BLOCK1 + 1);

    let out = 0;
    for (let p = 0; p < d.live; p++) if (d.pos[p * 3] > BLOCK1) out++;
    expect(out).toBeGreaterThan(20);
  });

  it('never puts a particle inside rock, and never loses one', () => {
    const { volume, field } = boredWorld();
    const d = domainOn(field);
    spawnBall(d, 150, [9, GROUND + 2.5, (TZ0 + TZ1) / 2], 2.2, [2.2, 0.4, 0], rng(32));
    for (let i = 0; i < 400; i++) {
      stepDomain(d);
      expect(d.live).toBe(150);
      expect(buried(d, volume)).toBe(0);
    }
    for (let p = 0; p < d.live * 3; p++) expect(Number.isFinite(d.pos[p])).toBe(true);
  });

  it('holds the roof: water fired UP inside the passage stays under it', () => {
    /* The half of the span test a height buffer cannot even express. Without a
     * ceiling the jet simply rises through the block and stands on top of the
     * hill, which is what the old kernel does with the SAME voxels. */
    const { volume, field } = boredWorld();
    const d = domainOn(field);
    spawnBall(d, 120, [20, GROUND + 2.2, (TZ0 + TZ1) / 2], 2.0, [0, 4, 0], rng(33));
    let highest = 0;
    for (let i = 0; i < 200; i++) {
      stepDomain(d);
      expect(buried(d, volume)).toBe(0);
      for (let p = 0; p < d.live; p++) highest = Math.max(highest, d.pos[p * 3 + 1]);
    }
    // The bore's ceiling is at cell 13; the block's top is at 30.
    expect(highest).toBeLessThan(TCEIL);
  });

  it('is IMPOSSIBLE with one height per column — the claim, as arithmetic', () => {
    /* THE BEFORE. Same world, same jet, same everything, except the domain is
     * given the collision this change replaced: ONE floor per column, taken
     * the only way a heightfield can take it — the top of the solid.
     *
     * Over the block that floor is the block's roof, thirty cells up, so the
     * bore is sealed by a wall that is not in the voxels at all. This is not a
     * regression guard; it is the measurement that says the feature is a
     * feature. Without it, "water enters the tunnel" is a claim about a number
     * that might always have been reachable. */
    const { volume, field } = boredWorld();
    const heights = new Float32Array(N * N);
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        let top = 0;
        for (let y = N - 1; y >= 0; y--) {
          if (volume.get(x, y, z) !== Material.Air) {
            top = y + 1;
            break;
          }
        }
        heights[z * N + x] = top; // grid units: the heightfield's only answer
      }
    }
    const d = createDomain({
      n: N,
      dxM: DX,
      originM: [0, 0, 0],
      capacity: 500,
      floorYAt: () => 0,
      spanG: spanFieldFromHeights(heights, N, field.slots),
      slots: field.slots,
    });
    spawnBall(d, 150, [9, GROUND + 2.5, (TZ0 + TZ1) / 2], 2.2, [2.2, 0, 0], rng(31));
    let deepest = 0;
    for (let i = 0; i < 400; i++) {
      stepDomain(d);
      for (let p = 0; p < d.live; p++) deepest = Math.max(deepest, d.pos[p * 3]);
    }
    // The jet piles against the face of the block and stops. Nothing crosses.
    expect(deepest).toBeLessThan(BLOCK0 + 2);
  });

  it('is the SAME arithmetic as the height path on a column with one span', () => {
    /* The regression that matters most: 95% of columns in every measured world
     * have exactly one span, and none of them may move a millimetre. Two
     * domains, one built from a height function and one from a packed volume
     * describing the same flat ground, stepped side by side. */
    const volume = new VoxelVolume(24);
    for (let z = 0; z < 24; z++)
      for (let x = 0; x < 24; x++)
        for (let y = 0; y < 8; y++) volume.set(x, y, z, Material.Granite);
    const field = packSpanField({ volume, cellM: DX, originM: [0, 0, 0] });

    const spec = { n: 24, dxM: DX, originM: [0, 0, 0] as [number, number, number], capacity: 300 };
    const a = createDomain({ ...spec, floorYAt: () => 8 * DX });
    const b = createDomain({
      ...spec,
      floorYAt: () => 0,
      spanG: spanFieldToGrid(field, 0, DX),
      slots: field.slots,
    });
    spawnBall(a, 200, [12, 14, 12], 2, [0.6, -1, 0.3], rng(34));
    spawnBall(b, 200, [12, 14, 12], 2, [0.6, -1, 0.3], rng(34));
    for (let i = 0; i < 120; i++) {
      stepDomain(a);
      stepDomain(b);
    }
    for (let p = 0; p < 200 * 3; p++) expect(b.pos[p]).toBeCloseTo(a.pos[p], 5);
  });
});
