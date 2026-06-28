/**
 * @file provisionCache.ts — E4: resupply caches / depots (pure data model).
 *
 * A cache is a stash of rations/water the player drops at a discovered world
 * cell (and, later, town stock) and recovers later. Caches are reachability
 * anchors: a depot inside the current supply horizon re-seeds the ring, so a
 * chain of caches extends effective range. This module owns the cache list, the
 * map queries, and the reach-budget a depot grants. The actual inventory item
 * transfer on drop/recover is applied by the reducer/App layer (ADD/REMOVE_ITEM).
 *
 * New standalone file (no edits to shared, concurrently-edited modules). Pure:
 * no React/DOM/state.
 */
import type { ProvisionResource } from './provisioning';

/** A dropped stash of provisions positioned on the world atlas. */
export interface ProvisionCache {
  /** Stable unique id. */
  id: string;
  /** Atlas Voronoi cell the cache sits in (for reach/reseed queries). */
  atlasCell: number;
  /** Graph-space position, for the map pin. */
  x: number;
  y: number;
  /** Ration-days stored. */
  rations: number;
  /** Water-days stored. */
  water: number;
  /** Optional player label. */
  label?: string;
  /** Game-day the cache was created (for UI/aging). */
  createdDay?: number;
}

/** Append a cache (immutably). */
export function addCache(caches: readonly ProvisionCache[], cache: ProvisionCache): ProvisionCache[] {
  return [...caches, cache];
}

/** Remove a cache by id (immutably). */
export function removeCache(caches: readonly ProvisionCache[], id: string): ProvisionCache[] {
  return caches.filter((c) => c.id !== id);
}

/** The cache stored at a given atlas cell, or undefined. */
export function cacheAtCell(caches: readonly ProvisionCache[], atlasCell: number): ProvisionCache | undefined {
  return caches.find((c) => c.atlasCell === atlasCell);
}

/**
 * Caches whose cell falls inside a reachable set — the depots the party can
 * actually get to on current supplies, and thus the ones that re-seed the ring
 * (E4 ↔ E2). The caller runs reachability again from each to extend the horizon.
 */
export function reachableCaches(
  caches: readonly ProvisionCache[],
  reachableCellIds: ReadonlySet<number>,
): ProvisionCache[] {
  return caches.filter((c) => reachableCellIds.has(c.atlasCell));
}

/** Travel-days a cache's stored resource grants `consumers` people (floored). */
export function cacheReachDays(cache: ProvisionCache, resource: ProvisionResource, consumers: number): number {
  if (consumers <= 0) return 0;
  const stored = resource === 'food' ? cache.rations : cache.water;
  return Math.floor(stored / consumers);
}
