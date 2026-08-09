/**
 * A body moving against the volume.
 *
 * The failure these tests exist to prevent is not "the character looks wrong".
 * It is "the character is somewhere it cannot be" — inside rock, or through a
 * wall, or falling forever. Each of those is unrecoverable in play, so each
 * gets a test that states it as an absolute rather than as a tolerance.
 */
import { describe, it, expect } from 'vitest';
import { Material, VoxelVolume } from '../voxelVolume';
import { capsuleOverlaps, moveCapsule, CollideTarget, CapsuleBody } from '../voxelCollide';

const CELL = 0.25;
/** Roughly a person: 40 cm across, 1.8 m tall. */
const PERSON: CapsuleBody = { radiusM: 0.2, heightM: 1.8 };

/** Solid below `groundCell`, air above. Ground top sits at groundCell * CELL. */
function flatWorld(cells = 64, groundCell = 16): CollideTarget {
  const volume = new VoxelVolume(cells);
  for (let z = 0; z < cells; z++) {
    for (let y = 0; y < groundCell; y++) {
      for (let x = 0; x < cells; x++) volume.set(x, y, z, Material.Granite);
    }
  }
  return { volume, cellM: CELL, originM: [0, 0, 0] };
}

const GROUND_Y = 16 * CELL; // 4 m

/** Raise a block of columns to `topCell`, making a ledge or a wall. */
function raise(t: CollideTarget, x0: number, x1: number, topCell: number): void {
  for (let z = 0; z < t.volume.cells; z++) {
    for (let x = x0; x <= x1; x++) {
      for (let y = 16; y < topCell; y++) t.volume.set(x, y, z, Material.Granite);
    }
  }
}

describe('capsuleOverlaps', () => {
  it('is clear when the body stands on the ground', () => {
    expect(capsuleOverlaps(flatWorld(), [4, GROUND_Y, 4], PERSON)).toBe(false);
  });

  it('reports overlap when the body is sunk into the ground', () => {
    expect(capsuleOverlaps(flatWorld(), [4, GROUND_Y - 0.1, 4], PERSON)).toBe(true);
  });

  it('is clear when the body is above the ground', () => {
    expect(capsuleOverlaps(flatWorld(), [4, GROUND_Y + 0.5, 4], PERSON)).toBe(false);
  });
});

describe('standing', () => {
  it('lands on the surface and stays there', () => {
    const t = flatWorld();
    let pos: [number, number, number] = [4, GROUND_Y + 2, 4];
    for (let i = 0; i < 60; i++) {
      pos = moveCapsule(t, pos, PERSON, [0, -0.15, 0]).positionM;
    }
    expect(pos[1]).toBeCloseTo(GROUND_Y, 2);
    expect(moveCapsule(t, pos, PERSON, [0, 0, 0]).grounded).toBe(true);
  });

  it('does not SINK over many frames', () => {
    /* The slow failure. A body that loses a fraction of a millimeter per frame
     * looks perfect for a minute and is knee-deep in rock after an hour. The
     * check is that the floor height is identical, not merely close. */
    const t = flatWorld();
    let pos: [number, number, number] = [4, GROUND_Y, 4];
    for (let i = 0; i < 20; i++) pos = moveCapsule(t, pos, PERSON, [0, -0.05, 0]).positionM;
    const settled = pos[1];
    for (let i = 0; i < 400; i++) pos = moveCapsule(t, pos, PERSON, [0, -0.05, 0]).positionM;
    expect(pos[1]).toBe(settled);
  });

  it('reports grounded when standing still, not only after a fall', () => {
    // Deriving "grounded" from the last move being cut short is wrong whenever
    // the vertical delta is zero, which is most frames a body stands still.
    const t = flatWorld();
    expect(moveCapsule(t, [4, GROUND_Y, 4], PERSON, [0, 0, 0]).grounded).toBe(true);
  });

  it('is NOT grounded in mid air', () => {
    const t = flatWorld();
    expect(moveCapsule(t, [4, GROUND_Y + 3, 4], PERSON, [0, 0, 0]).grounded).toBe(false);
  });
});

describe('walls', () => {
  it('stops at a wall instead of entering it', () => {
    const t = flatWorld();
    raise(t, 40, 44, 32); // a 4 m wall from x = 10 m
    const r = moveCapsule(t, [8, GROUND_Y, 4], PERSON, [4, 0, 0]);
    expect(r.blocked).toBe(true);
    expect(r.positionM[0]).toBeLessThan(10);
    expect(capsuleOverlaps(t, r.positionM, PERSON)).toBe(false);
  });

  it('does not TUNNEL through a thin wall at speed', () => {
    /* The bug that only appears when it matters. A single large move tested at
     * its endpoint alone starts in front of a wall and ends behind it, with
     * nothing wrong at either place. Here the wall is one cell thick and the
     * move is 40 m in one call. */
    const t = flatWorld(64, 16);
    for (let z = 0; z < 64; z++) {
      for (let y = 16; y < 32; y++) t.volume.set(40, y, z, Material.Granite);
    }
    const r = moveCapsule(t, [1, GROUND_Y, 4], PERSON, [40, 0, 0]);
    expect(r.positionM[0]).toBeLessThan(10 * CELL * 4); // still short of the wall
    expect(r.positionM[0]).toBeLessThan(10);
    expect(capsuleOverlaps(t, r.positionM, PERSON)).toBe(false);
  });

  it('SLIDES along a wall rather than stopping dead', () => {
    // Separating the axes is what buys this. A body pushed diagonally into a
    // wall keeps the component the wall does not block.
    const t = flatWorld();
    raise(t, 40, 44, 32);
    const r = moveCapsule(t, [9, GROUND_Y, 4], PERSON, [2, 0, 2]);
    expect(r.positionM[2]).toBeCloseTo(6, 2); // full travel along z
    expect(r.positionM[0]).toBeLessThan(10); // blocked along x
  });
});

describe('ledges', () => {
  it('steps UP a one-cell lip', () => {
    // At 25 cm cells the ground is full of these. A body that catches on every
    // one of them reads as broken, not as solid.
    const t = flatWorld();
    raise(t, 40, 63, 17); // a 25 cm step at x = 10 m
    const r = moveCapsule(t, [9.5, GROUND_Y, 4], PERSON, [1.2, 0, 0]);
    expect(r.positionM[0]).toBeGreaterThan(10.4);
    expect(r.positionM[1]).toBeCloseTo(17 * CELL, 2);
    expect(capsuleOverlaps(t, r.positionM, PERSON)).toBe(false);
  });

  it('is stopped by a step too TALL to climb', () => {
    const t = flatWorld();
    raise(t, 40, 63, 24); // 2 m
    const r = moveCapsule(t, [9.5, GROUND_Y, 4], PERSON, [1.2, 0, 0]);
    expect(r.blocked).toBe(true);
    expect(r.positionM[0]).toBeLessThan(10);
    expect(r.positionM[1]).toBeCloseTo(GROUND_Y, 4);
  });

  it('does not float up a wall it failed to clear', () => {
    // The step-up must roll back completely when the climb gains nothing.
    const t = flatWorld();
    raise(t, 40, 63, 24);
    let pos: [number, number, number] = [9.5, GROUND_Y, 4];
    for (let i = 0; i < 40; i++) pos = moveCapsule(t, pos, PERSON, [0.3, -0.05, 0]).positionM;
    expect(pos[1]).toBeCloseTo(GROUND_Y, 4);
  });
});

describe('the movement a heightfield cannot allow', () => {
  it('walks THROUGH a tunnel, with solid rock overhead', () => {
    /* The payoff, and the reason collision had to be rebuilt on the volume.
     * Against a height buffer this body walks over the hill, because a height
     * buffer has one surface per column. Against the volume it walks into the
     * hill and comes out the other side. */
    // 96 cells = 24 m across. At 64 cells the world ends at 15.75 m and the
    // body walked off the edge of the volume and fell — a fixture fault that
    // looked exactly like the collision failing.
    const t = flatWorld(96, 16);
    // A hill from x = 8 m to x = 14 m, 3 m tall.
    raise(t, 32, 56, 28);
    // Bore a 2 m tunnel through it at the original ground level.
    for (let x = 32; x <= 56; x++) {
      for (let y = 16; y < 24; y++) {
        for (let z = 14; z <= 18; z++) t.volume.set(x, y, z, Material.Air);
      }
    }
    const zMid = 16 * CELL + CELL / 2;

    let pos: [number, number, number] = [7, GROUND_Y, zMid];
    for (let i = 0; i < 60; i++) {
      pos = moveCapsule(t, pos, PERSON, [0.2, -0.1, 0]).positionM;
    }

    // It got past the far side of the hill.
    expect(pos[0]).toBeGreaterThan(14.5);
    // And it stayed at tunnel level rather than climbing over the top.
    expect(pos[1]).toBeCloseTo(GROUND_Y, 2);
    expect(capsuleOverlaps(t, pos, PERSON)).toBe(false);
  });

  it('bumps its head on the tunnel roof', () => {
    const t = flatWorld(64, 16);
    raise(t, 32, 56, 28);
    for (let x = 32; x <= 56; x++) {
      for (let y = 16; y < 24; y++) {
        for (let z = 14; z <= 18; z++) t.volume.set(x, y, z, Material.Air);
      }
    }
    const zMid = 16 * CELL + CELL / 2;
    const r = moveCapsule(t, [10, GROUND_Y, zMid], PERSON, [0, 3, 0]);
    // The bore is 2 m tall and the body is 1.8 m, so it can rise 20 cm at most.
    expect(r.positionM[1]).toBeLessThan(GROUND_Y + 0.25);
    expect(capsuleOverlaps(t, r.positionM, PERSON)).toBe(false);
  });

  it('falls into a pit carved after the ground was built', () => {
    const t = flatWorld();
    for (let x = 30; x < 40; x++) {
      for (let z = 30; z < 40; z++) {
        for (let y = 8; y < 16; y++) t.volume.set(x, y, z, Material.Air);
      }
    }
    let pos: [number, number, number] = [35 * CELL + CELL / 2, GROUND_Y + 0.5, 35 * CELL + CELL / 2];
    for (let i = 0; i < 80; i++) pos = moveCapsule(t, pos, PERSON, [0, -0.1, 0]).positionM;
    expect(pos[1]).toBeCloseTo(8 * CELL, 2);
  });
});
