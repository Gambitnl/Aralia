/**
 * Rays against the volume.
 *
 * The tests that matter are the ones a heightfield would also pass, and the one
 * it cannot. The last block is the second kind: a ray that travels THROUGH the
 * ground and out the far side of a tunnel. That is the whole reason the volume
 * exists, so it is the reason the ray exists too.
 */
import { describe, it, expect } from 'vitest';
import { Material, VoxelVolume } from '../voxelVolume';
import { raycastVoxels, groundBelow, RayTarget } from '../voxelRay';

/** Solid below `groundCell`, air above. Cell size 0.5 m, origin at the corner. */
function flatWorld(cells = 32, groundCell = 16): RayTarget {
  const volume = new VoxelVolume(cells);
  for (let z = 0; z < cells; z++) {
    for (let y = 0; y < groundCell; y++) {
      for (let x = 0; x < cells; x++) volume.set(x, y, z, Material.Granite);
    }
  }
  return { volume, cellM: 0.5, originM: [0, 0, 0] };
}

describe('raycastVoxels', () => {
  it('finds the ground under a ray fired straight down', () => {
    const t = flatWorld();
    // Solid fills cells 0..15, so the top face sits at y = 16 * 0.5 = 8 m.
    const hit = raycastVoxels(t, [4, 12, 4], [0, -1, 0]);
    expect(hit).not.toBeNull();
    expect(hit!.pointM[1]).toBeCloseTo(8, 5);
    expect(hit!.distanceM).toBeCloseTo(4, 5);
    expect(hit!.normal).toEqual([0, 1, 0]);
  });

  it('reports distance in METERS, whatever length the direction has', () => {
    // A caller that passes an unnormalized direction is common and the bug it
    // causes is quiet: every distance comes back scaled and nothing throws.
    const t = flatWorld();
    const a = raycastVoxels(t, [4, 12, 4], [0, -1, 0])!;
    const b = raycastVoxels(t, [4, 12, 4], [0, -37, 0])!;
    expect(b.distanceM).toBeCloseTo(a.distanceM, 6);
  });

  it('misses when it is fired at the sky', () => {
    expect(raycastVoxels(flatWorld(), [4, 12, 4], [0, 1, 0])).toBeNull();
  });

  it('misses when the solid is out of range', () => {
    const t = flatWorld();
    expect(raycastVoxels(t, [4, 12, 4], [0, -1, 0], 2)).toBeNull();
  });

  it('starts outside the volume and still finds the ground', () => {
    // A camera is never inside the bubble. If the march had to begin at the ray
    // origin, the cost of a pick would grow with how far back the camera sits.
    const t = flatWorld();
    const hit = raycastVoxels(t, [4, 400, 4], [0, -1, 0], 1000);
    expect(hit).not.toBeNull();
    expect(hit!.pointM[1]).toBeCloseTo(8, 4);
  });

  it('returns null when it never meets the volume at all', () => {
    const t = flatWorld();
    expect(raycastVoxels(t, [-50, 400, -50], [0, -1, 0], 1000)).toBeNull();
  });

  it('reports a SIDE normal when it comes in sideways', () => {
    const t = flatWorld();
    // Fired along +x well below the surface, so it enters through a side face.
    const hit = raycastVoxels(t, [-4, 4, 4], [1, 0, 0], 100);
    expect(hit).not.toBeNull();
    expect(hit!.normal).toEqual([-1, 0, 0]);
  });

  it('hits at once, with no face, when it starts buried in solid', () => {
    // The tempting alternative reports the face the ray LEAVES through, which
    // reads as a hit on the far side of the wall the camera is already inside.
    const t = flatWorld();
    const hit = raycastVoxels(t, [4, 2, 4], [1, 0, 0]);
    expect(hit).not.toBeNull();
    expect(hit!.distanceM).toBe(0);
    expect(hit!.normal).toEqual([0, 0, 0]);
  });

  it('does not slip between cells at a grazing angle', () => {
    /* The fault a fixed step size has and a grid march does not.
     *
     * A ray that is nearly parallel to the ground crosses many cells per unit
     * of height, so a point sampled every so many centimeters can step over a
     * one-cell lip entirely. Every one of these must find solid. */
    const t = flatWorld();
    // Start 5 cm above the surface. The volume is only 16 m across, so a
    // shallower launch would leave through the far side before it ever reached
    // the ground — a miss the ray is right about and the test would be wrong to
    // call a bug.
    for (const slope of [0.01, 0.03, 0.08, 0.25]) {
      const hit = raycastVoxels(t, [0.1, 8.05, 4], [1, -slope, 0], 400);
      expect(hit, `slope ${slope}`).not.toBeNull();
    }
  });

  it('reports the material it struck, not just a distance', () => {
    const t = flatWorld();
    t.volume.set(8, 15, 8, Material.Topsoil);
    const hit = raycastVoxels(t, [2.25, 12, 2.25], [0, -1, 0])!;
    expect(hit.cell[1]).toBe(15);
    expect(hit.material).toBe(Material.Granite);
    // The doctored cell reports its own material, not the bulk one.
    // Cell 8 sits at 4.25 m, not 8.25 m. Meters in, cells out.
    const doctored = raycastVoxels(t, [4.25, 12, 4.25], [0, -1, 0])!;
    expect(doctored.cell).toEqual([8, 15, 8]);
    expect(doctored.material).toBe(Material.Topsoil);
  });
});

describe('the query a heightfield cannot answer', () => {
  it('passes THROUGH a tunnel and hits the far wall', () => {
    /* The payoff. Against a height buffer this ray stops at the hillside,
     * because a height buffer has one surface per column and no notion of a
     * space behind it. Against the volume it flies down the bore. */
    const t = flatWorld(32, 16);
    const n = 32;
    // Bore a tunnel along +x at height cells 8..10, leaving rock beyond x = 24.
    for (let x = 0; x < 24; x++) {
      for (let y = 8; y <= 10; y++) {
        for (let z = 14; z <= 16; z++) t.volume.set(x, y, z, Material.Air);
      }
    }
    const yMid = 9.5 * 0.5;
    const zMid = 15.5 * 0.5;
    const hit = raycastVoxels(t, [-2, yMid, zMid], [1, 0, 0], 100);
    expect(hit).not.toBeNull();
    // It stopped at the tunnel's end wall, not at the hillside it entered.
    expect(hit!.cell[0]).toBe(24);
    expect(hit!.normal).toEqual([-1, 0, 0]);
  });

  it('finds the tunnel ROOF when fired upward from inside', () => {
    const t = flatWorld(32, 16);
    for (let x = 4; x < 24; x++) {
      for (let y = 8; y <= 10; y++) {
        for (let z = 14; z <= 16; z++) t.volume.set(x, y, z, Material.Air);
      }
    }
    // Cell (10, 9, 15) in meters. Writing 15.25 here put the probe at cell 30,
    // outside the bore and buried in rock — the same slip twice below.
    const hit = raycastVoxels(t, [10.5 * 0.5, 9.5 * 0.5, 15.5 * 0.5], [0, 1, 0], 50);
    expect(hit).not.toBeNull();
    expect(hit!.cell[1]).toBe(11);
    expect(hit!.normal).toEqual([0, -1, 0]);
  });
});

describe('groundBelow', () => {
  it('reads the surface under a point', () => {
    const hit = groundBelow(flatWorld(), 4, 20, 4);
    expect(hit!.pointM[1]).toBeCloseTo(8, 5);
  });

  it('lands on the tunnel FLOOR when the point is inside a tunnel', () => {
    // A spawn point or a dropped item inside a tunnel must rest on its floor,
    // not on the hillside far above it.
    const t = flatWorld(32, 16);
    for (let x = 4; x < 24; x++) {
      for (let y = 8; y <= 10; y++) {
        for (let z = 14; z <= 16; z++) t.volume.set(x, y, z, Material.Air);
      }
    }
    const hit = groundBelow(t, 10.5 * 0.5, 9.5 * 0.5, 15.5 * 0.5)!;
    // The bore's floor is the top of cell 7, at 8 * 0.5 = 4 m.
    expect(hit.pointM[1]).toBeCloseTo(4, 5);
  });
});
