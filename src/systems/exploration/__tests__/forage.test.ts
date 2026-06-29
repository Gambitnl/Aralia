/**
 * Tests for the wilderness forage system (the loot affordance for coord_ tiles).
 */
import { describe, it, expect } from 'vitest';
import { forageWilderness, biomeToForageCategory } from '../forage';
import { ITEMS } from '../../../data/items';

describe('biomeToForageCategory', () => {
  it('maps raw biome ids onto forage categories', () => {
    expect(biomeToForageCategory('forest')).toBe('forest');
    expect(biomeToForageCategory('temperate_forest')).toBe('forest');
    expect(biomeToForageCategory('mountains')).toBe('rocky');
    expect(biomeToForageCategory('marsh')).toBe('wetland');
    expect(biomeToForageCategory('plains')).toBe('grassland');
  });

  it('collapses unknown / non-forageable biomes to default', () => {
    expect(biomeToForageCategory('city')).toBe('default');
    expect(biomeToForageCategory('ocean')).toBe('default');
    expect(biomeToForageCategory(undefined)).toBe('default');
  });
});

describe('forageWilderness', () => {
  it('is deterministic for the same tile + seed', () => {
    const a = forageWilderness({ worldSeed: 12345, x: 11, y: 8, biomeId: 'forest' });
    const b = forageWilderness({ worldSeed: 12345, x: 11, y: 8, biomeId: 'forest' });
    expect(a.itemIds).toEqual(b.itemIds);
  });

  it('varies between adjacent tiles', () => {
    const results = new Set<string>();
    for (let x = 0; x < 12; x++) {
      results.add(forageWilderness({ worldSeed: 7, x, y: 3, biomeId: 'forest' }).itemIds.join(','));
    }
    // Not all 12 adjacent tiles should produce the identical result.
    expect(results.size).toBeGreaterThan(1);
  });

  it('never returns more than 2 items and never duplicates an id', () => {
    for (let i = 0; i < 200; i++) {
      const { itemIds } = forageWilderness({ worldSeed: i * 31 + 1, x: i, y: i * 2, biomeId: 'rocky' });
      expect(itemIds.length).toBeLessThanOrEqual(2);
      expect(new Set(itemIds).size).toBe(itemIds.length);
    }
  });

  it('only ever yields ids that exist in the ITEMS registry', () => {
    for (let i = 0; i < 300; i++) {
      const biome = ['forest', 'wetland', 'desert', 'rocky', 'grassland', 'tundra', 'city'][i % 7];
      const { itemIds } = forageWilderness({ worldSeed: i + 5, x: i, y: 99 - i, biomeId: biome });
      for (const id of itemIds) {
        expect(ITEMS[id], `forage produced unknown item id "${id}"`).toBeDefined();
      }
    }
  });

  it('sometimes finds nothing and sometimes finds something (distribution sanity)', () => {
    let empty = 0;
    let nonEmpty = 0;
    for (let i = 0; i < 400; i++) {
      const { itemIds } = forageWilderness({ worldSeed: 1000 + i, x: i, y: i, biomeId: 'forest' });
      if (itemIds.length === 0) empty++;
      else nonEmpty++;
    }
    expect(empty).toBeGreaterThan(0);
    expect(nonEmpty).toBeGreaterThan(0);
  });
});
