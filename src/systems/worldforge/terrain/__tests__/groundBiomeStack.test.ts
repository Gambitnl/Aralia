import { describe, it, expect } from 'vitest';
import {
  GROUND_BIOME_STACK,
  groundStackForWorldBiome,
  makeColumnStackSampler,
  withSnowCap,
  topColorOfStack,
  MAX_STACK_BANDS,
  SNOW_CAP_M,
  type ColumnBiomeGrid,
} from '../groundBiomeStack';
import { MAX_BANDS } from '@/components/World3D/terrain/substanceGroundMaterial';
import { Material } from '../voxelVolume';
import { substanceAtDepth, BIOME_GROUND } from '../materials';
import { censusColumnStacks, tintRatio } from '../volumeBubbleCore';

/**
 * The streamed world's biome vocabulary, from `terrainColor.PALETTE` — the list
 * `biomeColor` tints the heightfield from. The bubble has to answer for every id
 * the surface it lies in can name, or a player walks somewhere and the ground
 * throws.
 */
const PALETTE_IDS = [
  'ocean', 'water', 'desert', 'plains', 'grassland', 'forest', 'jungle',
  'forest_floor', 'tundra', 'wetland', 'swamp', 'mountain', 'ice', 'dirt',
  'paved', 'floor',
];

describe('GROUND_BIOME_STACK', () => {
  it('is total over the streamed world biome vocabulary', () => {
    for (const id of PALETTE_IDS) {
      expect(groundStackForWorldBiome(id).length, id).toBeGreaterThan(1);
    }
    expect(Object.keys(GROUND_BIOME_STACK).sort()).toEqual([...PALETTE_IDS].sort());
  });

  it('throws on an id it does not know — no silent litter', () => {
    expect(() => groundStackForWorldBiome('lava')).toThrow(/No ground stack/);
    expect(() => groundStackForWorldBiome('')).toThrow(/No ground stack/);
  });

  it('reuses BIOME_GROUND wherever an FMG counterpart exists', () => {
    // A wetland bubble and a wetland arena must be made of the same peat.
    expect(GROUND_BIOME_STACK.wetland).toBe(BIOME_GROUND[12]);
    expect(GROUND_BIOME_STACK.desert).toBe(BIOME_GROUND[1]);
    expect(GROUND_BIOME_STACK.forest_floor).toBe(BIOME_GROUND[6]);
    expect(GROUND_BIOME_STACK.ice).toBe(BIOME_GROUND[11]);
  });

  it('every band ends deeper than the one above it, and the last is bedrock', () => {
    for (const id of PALETTE_IDS) {
      const stack = groundStackForWorldBiome(id);
      for (let i = 1; i < stack.length; i++) {
        expect(stack[i].depthM, `${id} band ${i}`).toBeGreaterThan(stack[i - 1].depthM);
      }
      expect(stack[stack.length - 1].depthM, id).toBe(Infinity);
    }
  });

  it('no stack has more bands than the shader can draw', () => {
    // A seventh band is DROPPED silently by the fragment loop, which is the
    // worst kind of wrong: the picture stays plausible.
    expect(MAX_STACK_BANDS).toBe(MAX_BANDS);
    for (const id of PALETTE_IDS) {
      expect(groundStackForWorldBiome(id).length, id).toBeLessThanOrEqual(MAX_STACK_BANDS);
      expect(withSnowCap(groundStackForWorldBiome(id)).length, `${id}+snow`)
        .toBeLessThanOrEqual(MAX_STACK_BANDS);
    }
  });

  it('the ground types Remy named are the substances he named', () => {
    const topOf = (id: string) => substanceAtDepth(0, groundStackForWorldBiome(id)).id;
    expect(topOf('wetland')).toBe(Material.Peat);
    expect(topOf('desert')).toBe(Material.Sand);
    expect(topOf('mountain')).toBe(Material.Gravel);
    expect(substanceAtDepth(1.2, groundStackForWorldBiome('mountain')).id).toBe(Material.Granite);
    expect(topOf('forest_floor')).toBe(Material.Litter);
    expect(topOf('ice')).toBe(Material.Snow);
  });
});

describe('withSnowCap', () => {
  it('pushes the horizons down instead of deleting them', () => {
    const capped = withSnowCap(GROUND_BIOME_STACK.grassland);
    expect(capped[0].substance).toBe(Material.Snow);
    expect(capped[0].depthM).toBe(SNOW_CAP_M);
    // Grassland's turf is 0.1 m thick and must still be 0.1 m thick, just lower.
    expect(capped[1].substance).toBe(GROUND_BIOME_STACK.grassland[0].substance);
    expect(capped[1].depthM).toBeCloseTo(0.1 + SNOW_CAP_M, 6);
    expect(capped[capped.length - 1].depthM).toBe(Infinity);
    // And the turf is still reachable, which is the whole point of the shift.
    expect(substanceAtDepth(SNOW_CAP_M + 0.05, capped).id).toBe(Material.Turf);
  });

  it('leaves a glacier alone rather than giving it two snows', () => {
    expect(withSnowCap(GROUND_BIOME_STACK.ice)).toBe(GROUND_BIOME_STACK.ice);
  });
});

/** A 4x4 grid, one metre per cell, so a column's biome is easy to place. */
function grid(biomeIds: string[], heights: number[], snowLineH = 55): ColumnBiomeGrid {
  return { cols: 4, rows: 4, metersPerCell: 1, biomeIds, heights, snowLineH };
}

describe('makeColumnStackSampler', () => {
  const flatLow = new Array(16).fill(10);

  it('gives each column the ground its own cell names', () => {
    const ids = new Array(16).fill('grassland');
    ids[2 * 4 + 2] = 'wetland';
    const at = makeColumnStackSampler(grid(ids, flatLow), () => 0);
    expect(at(0, 0).key).toBe('grassland');
    expect(at(2, 2).key).toBe('wetland');
    expect(substanceAtDepth(0, at(2, 2).stack).id).toBe(Material.Peat);
  });

  it('returns the SAME object for repeated columns of one ground', () => {
    // 65,536 columns per bubble ask this; a fresh stack array each would cost
    // more than the fill it feeds.
    const at = makeColumnStackSampler(grid(new Array(16).fill('desert'), flatLow), () => 0);
    expect(at(0, 0)).toBe(at(3, 3));
  });

  it('throws on a biome the registry does not know', () => {
    const ids = new Array(16).fill('grassland');
    ids[0] = 'lava';
    const at = makeColumnStackSampler(grid(ids, flatLow), () => 0);
    expect(() => at(0, 0)).toThrow(/No ground stack/);
  });

  it('caps a gentle summit with snow and leaves a steep face bare', () => {
    const ids = new Array(16).fill('mountain');
    // Well above the snow line, so the blend saturates and only slope decides.
    const high = new Array(16).fill(80);
    const flat = makeColumnStackSampler(grid(ids, high), () => 0);
    expect(flat(1, 1).key).toBe('mountain+snow');
    expect(substanceAtDepth(0, flat(1, 1).stack).id).toBe(Material.Snow);

    // A 1:1 face: slope01 = 0.293, shed = 1 - 0.293*3.2 < 0, so no snow holds.
    const cliff = makeColumnStackSampler(grid(ids, high), (x) => x);
    expect(cliff(1, 1).key).toBe('mountain');
  });

  it('leaves ground below the snow line uncapped however cold it looks', () => {
    const at = makeColumnStackSampler(grid(new Array(16).fill('mountain'), flatLow), () => 0);
    expect(at(1, 1).key).toBe('mountain');
  });
});

describe('tintRatio', () => {
  it('is exactly 1 where a column matches the bubble stack', () => {
    const top = topColorOfStack(GROUND_BIOME_STACK.grassland);
    expect(tintRatio(top, top)).toEqual([1, 1, 1]);
  });

  it('carries a sand bar out of a turf bubble', () => {
    const t = tintRatio(
      topColorOfStack(GROUND_BIOME_STACK.desert),
      topColorOfStack(GROUND_BIOME_STACK.grassland),
    );
    // Sand is far lighter than turf in every channel, so the top surface of a
    // sand column must be MULTIPLIED up, not left reading as grass.
    expect(t[0]).toBeGreaterThan(2);
    expect(t[1]).toBeGreaterThan(2);
    expect(t[2]).toBeGreaterThan(2);
  });
});

describe('censusColumnStacks', () => {
  it('picks the ground most of the bubble stands on, and reports the rest', () => {
    const ids = new Array(16).fill('grassland');
    // The whole left half is river bed.
    for (let z = 0; z < 4; z++) for (let x = 0; x < 2; x++) ids[z * 4 + x] = 'water';
    const at = makeColumnStackSampler(grid(ids, new Array(16).fill(10)), () => 0);
    // Centred on the dry half, 2 m across.
    const c = censusColumnStacks(at, 3, 2, 2);
    expect(c.dominant.key).toBe('grassland');
    expect(c.minorityShare).toBe(0);
    expect(c.sampled).toBeGreaterThan(0);

    // Centred on the bank: both grounds are present and the share says so.
    const straddle = censusColumnStacks(at, 2, 2, 4);
    expect(Object.keys(straddle.counts).sort()).toEqual(['grassland', 'water']);
    expect(straddle.minorityShare).toBeGreaterThan(0.2);
  });

  it('sums its counts to the columns it sampled', () => {
    const at = makeColumnStackSampler(grid(new Array(16).fill('dirt'), new Array(16).fill(5)), () => 0);
    const c = censusColumnStacks(at, 2, 2, 4);
    const total = Object.values(c.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(c.sampled);
  });
});
