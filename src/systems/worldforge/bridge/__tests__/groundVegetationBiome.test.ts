/**
 * @file groundVegetationBiome.test.ts — the ground loader hands the tree its
 * BIOME.
 *
 * Ground mode is the mode the game runs in, and its tree palette is three
 * greens hashed off the feature id — the same three in every biome on the map.
 * The grown-tree path therefore cannot read a biome off the color, and this
 * file pins the channel that replaced it.
 */
import { describe, it, expect } from 'vitest';
import { buildGroundVegetation, type GroundWorld } from '../groundChunkLoader';
import { partitionGrownTreeInstances } from '../../vegetation/treeInstancePartition';

/** The smallest GroundWorld `buildGroundVegetation` reads: grid + features. */
const makeGround = (treeBiome: string | undefined): GroundWorld => ({
  cols: 4,
  rows: 4,
  heights: new Array(16).fill(30),
  biomeIds: new Array(16).fill('grassland'),
  extentMetersX: 64,
  extentMetersZ: 64,
  features: [0, 1, 2, 3, 4, 5].map((i) => ({
    id: 100 + i,
    kind: 'tree',
    xM: 4 + i * 3,
    zM: 6 + i * 2,
  })),
  props: [],
  hostiles: [],
  hiddenSites: [],
  dungeonEntrances: [],
  rivers: [],
  roads: [],
  walls: [],
  waterBodies: [],
  decks: [],
  gatehouses: [],
  towns: [],
  buildings: [],
  rosters: [],
  occupants: [],
  treeBiome,
} as unknown as GroundWorld);

describe('buildGroundVegetation — biome channel', () => {
  it('stamps the window biome on every tree instance', () => {
    const { trees } = buildGroundVegetation(makeGround('Taiga'), 0, 0);
    const count = trees.positions.length / 3;
    expect(count).toBe(6);
    expect(trees.biomeTable).toEqual(['Taiga']);
    expect(trees.biomeCodes).toHaveLength(count);
    const buckets = partitionGrownTreeInstances(trees);
    expect(buckets.every((b) => b.biome === 'Taiga')).toBe(true);
    expect(buckets.reduce((n, b) => n + b.instanceIndices.length, 0)).toBe(count);
  });

  it('omits the channel when the window has no tree biome — no default biome', () => {
    const { trees } = buildGroundVegetation(makeGround(undefined), 0, 0);
    expect(trees.biomeCodes).toBeUndefined();
    expect(trees.biomeTable).toBeUndefined();
    // The grown path then fails loudly rather than inventing a biome.
    expect(() => partitionGrownTreeInstances(trees)).toThrow(/no biome channel/);
  });

  it('keys the cache on the biome, so a v1 payload cannot pose as a v2 one', () => {
    const taiga = buildGroundVegetation(makeGround('Taiga'), 0, 0).trees;
    const savanna = buildGroundVegetation(makeGround('Savanna'), 0, 0).trees;
    expect(taiga.cacheKey).toContain('gv2');
    expect(taiga.cacheKey).not.toBe(savanna.cacheKey);
  });
});
