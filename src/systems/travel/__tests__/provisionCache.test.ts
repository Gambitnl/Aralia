import { describe, it, expect } from 'vitest';
import {
  addCache,
  removeCache,
  cacheAtCell,
  reachableCaches,
  cacheReachDays,
  type ProvisionCache,
} from '../provisionCache';

/**
 * E4 — resupply caches/depots. Pure data model + queries for stashes the player
 * drops on the world map (and, later, town stock). The reducer/App layer applies
 * the inventory item transfers; this module just owns the cache list + the
 * queries the map UI and the ring-reseed need. New file so it never collides
 * with shared files other live sessions are editing.
 */
const cache = (over: Partial<ProvisionCache> = {}): ProvisionCache => ({
  id: 'c1', atlasCell: 10, x: 5, y: 7, rations: 6, water: 4, ...over,
});

describe('addCache / removeCache (immutable)', () => {
  it('appends a cache without mutating the input', () => {
    const before: ProvisionCache[] = [];
    const after = addCache(before, cache());
    expect(after).toHaveLength(1);
    expect(before).toHaveLength(0);
  });
  it('removes a cache by id', () => {
    const list = [cache({ id: 'a' }), cache({ id: 'b' })];
    expect(removeCache(list, 'a').map((c) => c.id)).toEqual(['b']);
  });
});

describe('cacheAtCell', () => {
  it('finds the cache stored at a given atlas cell', () => {
    const list = [cache({ id: 'a', atlasCell: 3 }), cache({ id: 'b', atlasCell: 9 })];
    expect(cacheAtCell(list, 9)?.id).toBe('b');
    expect(cacheAtCell(list, 99)).toBeUndefined();
  });
});

describe('reachableCaches (E4 ↔ E2 reseed)', () => {
  it('returns only caches whose cell is in the reachable set', () => {
    const list = [cache({ id: 'near', atlasCell: 2 }), cache({ id: 'far', atlasCell: 88 })];
    const reach = new Set<number>([0, 1, 2, 3]);
    expect(reachableCaches(list, reach).map((c) => c.id)).toEqual(['near']);
  });
});

describe('cacheReachDays', () => {
  it('is the cache resource divided by consumers, floored', () => {
    expect(cacheReachDays(cache({ rations: 12 }), 'food', 4)).toBe(3);
    expect(cacheReachDays(cache({ water: 9 }), 'water', 2)).toBe(4);
  });
  it('is 0 with no consumers (defensive)', () => {
    expect(cacheReachDays(cache({ rations: 12 }), 'food', 0)).toBe(0);
  });
});
