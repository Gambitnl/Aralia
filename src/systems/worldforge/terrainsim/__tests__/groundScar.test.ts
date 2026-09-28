/**
 * @file groundScar.test.ts — the geometry half of the terrain sim.
 *
 * Proves the three visual shapes the board asks for are actually different
 * shapes in the data: a crater is a depression, a carve is a channel, and a
 * scorch is colour with no height at all.
 */
import { describe, it, expect } from 'vitest';
import {
  createGroundScar,
  createScarMark,
  groundScarHeightOffsetAt,
  makeScarHeightField,
  makeScarHeightFieldForGrid,
  scarDepthAt,
  scarFootprintWeight,
  scarMarkTintAt,
  scarReachM,
} from '../groundScar';
import { makeTerrainHeightSampler } from '../../../../components/BattleMap/terrain/terrainHeightSampler';
import { BATTLE_MAP_CELL_SIZE_FEET } from '../../../../config/mapConfig';
import type { BattleMapTile } from '../../../../types/combat';
import type { GroundScar } from '../types';

const at = (x: number, z: number) => ({ x, y: 0, z });

describe('scar footprint geometry', () => {
  it('a bowl is deepest at its centre and zero outside its radius', () => {
    const scar = createGroundScar({
      id: 'a',
      position: at(0, 0),
      shape: { kind: 'bowl', radiusM: 4 },
      depthM: 1,
      cause: 'blast',
      bornDay: 10,
    });

    expect(scarDepthAt(scar, 0, 0)).toBeCloseTo(1, 6);
    const mid = scarDepthAt(scar, 2, 0);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(scarDepthAt(scar, 4, 0)).toBe(0);
    expect(scarDepthAt(scar, 9, 0)).toBe(0);
    // Radially symmetric.
    expect(scarDepthAt(scar, 0, 2)).toBeCloseTo(mid, 10);
  });

  it('a channel reaches along its axis and not across it', () => {
    const shape = { kind: 'channel', radiusM: 1, halfLengthM: 6, angleRad: 0 } as const;
    // Along +X (the axis) the channel still bites at 5 m out.
    expect(scarFootprintWeight(shape, at(0, 0), 5, 0)).toBeCloseTo(1, 6);
    // Across the axis it is gone by 1 m.
    expect(scarFootprintWeight(shape, at(0, 0), 0, 1.2)).toBe(0);
    // And it ends past its half-length.
    expect(scarFootprintWeight(shape, at(0, 0), 7.5, 0)).toBe(0);
    expect(scarReachM(shape)).toBe(7);
  });

  it('a rotated channel follows its heading', () => {
    const shape = {
      kind: 'channel',
      radiusM: 1,
      halfLengthM: 6,
      angleRad: Math.PI / 2, // pointing along +Z
    } as const;
    expect(scarFootprintWeight(shape, at(0, 0), 0, 5)).toBeCloseTo(1, 6);
    expect(scarFootprintWeight(shape, at(0, 0), 5, 0)).toBe(0);
  });
});

describe('height field', () => {
  const crater = createGroundScar({
    id: 'crater',
    position: at(10, 10),
    shape: { kind: 'bowl', radiusM: 3 },
    depthM: 0.9,
    cause: 'blast',
    bornDay: 1,
  });
  const carve = createGroundScar({
    id: 'carve',
    position: at(-10, 0),
    shape: { kind: 'channel', radiusM: 1, halfLengthM: 5, angleRad: 0 },
    depthM: 1.4,
    cause: 'excavation',
    bornDay: 1,
  });

  it('returns a NEGATIVE offset inside a scar and zero on clean ground', () => {
    expect(groundScarHeightOffsetAt([crater, carve], 10, 10)).toBeCloseTo(-0.9, 6);
    expect(groundScarHeightOffsetAt([crater, carve], -10, 0)).toBeCloseTo(-1.4, 6);
    expect(groundScarHeightOffsetAt([crater, carve], 40, 40)).toBe(0);
  });

  it('overlapping scars take the deepest rather than summing into a well', () => {
    const second: GroundScar = { ...crater, id: 'crater2', depthM: 0.4 };
    expect(groundScarHeightOffsetAt([crater, second], 10, 10)).toBeCloseTo(-0.9, 6);
  });

  it('a raised lip is a negative depth and lifts the ground', () => {
    const mound = createGroundScar({
      id: 'mound',
      position: at(0, 0),
      shape: { kind: 'bowl', radiusM: 2 },
      depthM: -0.5,
      cause: 'excavation',
      bornDay: 1,
    });
    expect(groundScarHeightOffsetAt([mound], 0, 0)).toBeCloseTo(0.5, 6);
  });

  it('makeScarHeightField agrees with the direct sampler and short-circuits when empty', () => {
    const field = makeScarHeightField([crater, carve]);
    for (const [x, z] of [[10, 10], [11.5, 10], [-10, 0], [-6, 0], [40, 40]] as const) {
      expect(field(x, z)).toBeCloseTo(groundScarHeightOffsetAt([crater, carve], x, z), 10);
    }
    expect(makeScarHeightField([])(10, 10)).toBe(0);
  });

  it('the grid-space field converts tile coordinates to metres', () => {
    // 1.524 m per battle-map tile (5 ft). The crater centred at (10, 10) m is
    // therefore under tile (10 / 1.524, 10 / 1.524).
    const metersPerTile = 5 * 0.3048;
    const field = makeScarHeightFieldForGrid([crater], metersPerTile);
    expect(field(10 / metersPerTile, 10 / metersPerTile)).toBeCloseTo(-0.9, 6);
    expect(field(0, 0)).toBe(0);
  });
});

describe('battle-map surface integration', () => {
  // The one seam that makes a crater visible: the shared height sampler is the
  // single source of the combat map's ground surface, so a scar applied there
  // moves the heightfield, the grass, the scatter, and the voxel arena at once.
  function flatGrid(size: number): (BattleMapTile | null)[][] {
    return Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, x) => ({
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: 'grass',
        elevation: 0,
        movementCost: 1,
        blocksLoS: false,
        blocksMovement: false,
        decoration: 'none',
        effects: [],
      })) as unknown as (BattleMapTile | null)[],
    );
  }

  it('a crater lowers the rendered surface and clean tiles are unchanged', () => {
    const metersPerTile = BATTLE_MAP_CELL_SIZE_FEET * 0.3048;
    const grid = flatGrid(24);
    const crater = createGroundScar({
      id: 'c',
      // Centre the crater under tile (12, 12).
      position: at(12 * metersPerTile, 12 * metersPerTile),
      shape: { kind: 'bowl', radiusM: 3 },
      depthM: 1.1,
      cause: 'blast',
      bornDay: 1,
    });

    const plain = makeTerrainHeightSampler(grid, 24, 24, 42);
    const scarred = makeTerrainHeightSampler(grid, 24, 24, 42, {
      scarHeightOffsetM: makeScarHeightFieldForGrid([crater], metersPerTile),
    });

    expect(scarred(12, 12)).toBeCloseTo(plain(12, 12) - 1.1, 6);
    // Outside the 3 m radius (≈2 tiles) the surface is untouched.
    expect(scarred(20, 20)).toBeCloseTo(plain(20, 20), 10);
    // And omitting the option leaves the existing signature behaving as before.
    expect(makeTerrainHeightSampler(grid, 24, 24, 42)(12, 12)).toBeCloseTo(plain(12, 12), 10);
  });
});

describe('scar mark tint', () => {
  it('a fresh fire mark darkens the ground and clean ground is untouched', () => {
    const mark = createScarMark({
      id: 'm',
      position: at(0, 0),
      shape: { kind: 'patch', radiusM: 4 },
      cause: 'fire',
      bornDay: 1,
    });
    const [r, g, b] = scarMarkTintAt([mark], 0, 0);
    expect(r).toBeLessThan(0.35);
    expect(g).toBeLessThan(0.35);
    expect(b).toBeLessThan(0.35);
    expect(scarMarkTintAt([mark], 20, 20)).toEqual([1, 1, 1]);
  });

  it('a weathered mark fades toward clean ground but never disappears', () => {
    const fresh = createScarMark({
      id: 'm',
      position: at(0, 0),
      shape: { kind: 'patch', radiusM: 4 },
      cause: 'fire',
      bornDay: 1,
    });
    const old = { ...fresh, weathering: 1 };
    const freshTint = scarMarkTintAt([fresh], 0, 0)[0];
    const oldTint = scarMarkTintAt([old], 0, 0)[0];
    expect(oldTint).toBeGreaterThan(freshTint);
    expect(oldTint).toBeLessThan(1); // "a mark does not expire"
  });
});
