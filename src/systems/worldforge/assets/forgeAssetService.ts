/**
 * @file forgeAssetService.ts — Worldforge runtime asset service (SPEC §7).
 *
 *   request(assetKey) → cached | generated
 *
 * Content-addressed local cache; a cache miss calls the injected generation
 * backend at runtime (decision #9). There is NO procedural-synthesis fallback:
 * if the asset is neither cached nor generatable, the request is unresolved
 * (async `request` rejects; sync `requestSync` returns undefined) and the
 * renderer keeps its own base material. `requestSync` never blocks the render
 * path — it returns the cached asset or nothing and warms the cache in the
 * background.
 *
 * What changed: new module (asset pipeline spine). Why: every consumer
 * (wall surfaces, faces, heraldry, signage) needs one resolver over the same
 * content-addressed cache + runtime generator.
 */
import { assetAddress } from './assetKey';
import type { AssetCache, AssetGenerator, ForgeAsset } from './types';

/** Default cache backend: a plain in-memory Map (per session). */
class MemoryAssetCache implements AssetCache {
  private readonly store = new Map<string, ForgeAsset>();
  get(address: string): ForgeAsset | undefined {
    return this.store.get(address);
  }
  set(address: string, asset: ForgeAsset): void {
    this.store.set(address, asset);
  }
  has(address: string): boolean {
    return this.store.has(address);
  }
}

export interface ForgeAssetServiceOptions {
  /** Content-addressed cache (defaults to an in-memory Map). */
  cache?: AssetCache;
  /** Runtime generation backend (omit to disable generation). */
  generator?: AssetGenerator;
  /** Whether the generator may be called this session. */
  online?: boolean;
}

export interface ForgeAssetService {
  /** Async resolve: cache → generate. Rejects if neither is available. */
  request(key: string): Promise<ForgeAsset>;
  /** Sync render-path resolve: cached asset or undefined; warms the cache. */
  requestSync(key: string): ForgeAsset | undefined;
  /** Resolves when all in-flight background generations settle. */
  idle(): Promise<void>;
}

export function createForgeAssetService(
  options: ForgeAssetServiceOptions = {},
): ForgeAssetService {
  const cache = options.cache ?? new MemoryAssetCache();
  const generator = options.generator;
  const online = options.online ?? false;

  // In-flight generations, keyed by address, so concurrent requests for the
  // same asset share one generator call (and `idle()` can await them all).
  const inFlight = new Map<string, Promise<ForgeAsset>>();

  async function generateInto(key: string, address: string): Promise<ForgeAsset> {
    const produced = await generator!.generate(key);
    if (!produced) {
      throw new Error(`ForgeAsset generation produced nothing for "${key}".`);
    }
    const stored: ForgeAsset = { ...produced, key, address, source: 'generated' };
    cache.set(address, stored);
    return stored;
  }

  function startGeneration(key: string, address: string): Promise<ForgeAsset> {
    const existing = inFlight.get(address);
    if (existing) return existing;
    const promise = generateInto(key, address).finally(() => {
      inFlight.delete(address);
    });
    inFlight.set(address, promise);
    return promise;
  }

  async function request(key: string): Promise<ForgeAsset> {
    const address = assetAddress(key);
    const cached = cache.get(address);
    if (cached) return { ...cached, source: 'cache' };
    if (generator && online) return startGeneration(key, address);
    throw new Error(`ForgeAsset "${key}" is not cached and no generator is available.`);
  }

  function requestSync(key: string): ForgeAsset | undefined {
    const address = assetAddress(key);
    const cached = cache.get(address);
    if (cached) return { ...cached, source: 'cache' };
    // Warm the cache in the background; the render path gets nothing this frame
    // and keeps its existing base material until the texture arrives.
    if (generator && online) void startGeneration(key, address).catch(() => undefined);
    return undefined;
  }

  async function idle(): Promise<void> {
    while (inFlight.size > 0) {
      await Promise.allSettled([...inFlight.values()]);
    }
  }

  return { request, requestSync, idle };
}
