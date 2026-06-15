/**
 * @file integration.test.ts
 *
 * This file verifies the integration between `ForgeAssetService`, `AssetGenerator` (backend),
 * and `AssetCache` (IndexedDB persistent cache) under the Worldforge subsystem.
 *
 * The integration test validates:
 * 1. Cache miss to generation: Requesting a new key calls the backend generator,
 *    updates the synchronous mirror, and writes through to IndexedDB.
 * 2. Cache hit: Subsequent requests for the same key are resolved instantly from the cache,
 *    without invoking the backend generator.
 * 3. Persistence validation: A reload/reopen scenario where we shut down, rebuild the service
 *    with a new cache pointing to the same DB, open it (which hydrates it), and confirm
 *    the previously generated assets resolve instantly from the cache.
 *
 * Test target: src/systems/worldforge/assets/forgeAssetService.ts, imageGenBackend.ts, indexedDbCache.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createForgeAssetService } from '../forgeAssetService';
import { createImageGenBackend } from '../imageGenBackend';
import { IndexedDbAssetCache } from '../indexedDbCache';
import { assetAddress } from '../assetKey';

// ============================================================================
// Mock IndexedDB Registry & Classes (Duplicated for Isolation)
// ============================================================================
// In-memory IndexedDB simulator.
// ============================================================================

const mockDBRegistry = new Map<string, Map<string, Map<string, any>>>();

class MockIDBRequest<T> {
  result!: T;
  error: Error | null = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onupgradeneeded: (() => void) | null = null;

  fireSuccess(result: T) {
    this.result = result;
    if (this.onsuccess) this.onsuccess();
  }

  fireUpgrade(result: T) {
    this.result = result;
    if (this.onupgradeneeded) this.onupgradeneeded();
  }

  fireError(err: Error) {
    this.error = err;
    if (this.onerror) this.onerror();
  }
}

class MockIDBObjectStore {
  private readonly dataMap: Map<string, any>;
  constructor(dataMap: Map<string, any>) {
    this.dataMap = dataMap;
  }

  put(item: any) {
    const key = item.address;
    this.dataMap.set(key, item);
    const req = new MockIDBRequest<string>();
    setTimeout(() => req.fireSuccess(key), 0);
    return req;
  }

  openCursor() {
    const req = new MockIDBRequest<any>();
    const keys = Array.from(this.dataMap.keys());
    let index = 0;

    const trigger = () => {
      if (index < keys.length) {
        req.fireSuccess({
          value: this.dataMap.get(keys[index]),
          continue: () => {
            index++;
            setTimeout(trigger, 0);
          },
        });
      } else {
        req.fireSuccess(null);
      }
    };

    setTimeout(trigger, 0);
    return req;
  }
}

class MockIDBDatabase {
  private readonly storesMap: Map<string, Map<string, any>>;
  objectStoreNames = {
    contains: (name: string) => this.storesMap.has(name),
  };

  constructor(storesMap: Map<string, Map<string, any>>) {
    this.storesMap = storesMap;
  }

  createObjectStore(name: string) {
    if (!this.storesMap.has(name)) {
      this.storesMap.set(name, new Map());
    }
    return new MockIDBObjectStore(this.storesMap.get(name)!);
  }

  transaction(storeNames: string | string[], mode: string) {
    return {
      objectStore: (name: string) => {
        const storeMap = this.storesMap.get(name);
        if (!storeMap) throw new Error(`Object store "${name}" not found.`);
        return new MockIDBObjectStore(storeMap);
      },
      error: null,
    };
  }

  close() {}
}

class MockIDBFactory {
  open(name: string, version?: number) {
    const req = new MockIDBRequest<MockIDBDatabase>();

    setTimeout(() => {
      let storesMap = mockDBRegistry.get(name);
      let isUpgradeNeeded = false;
      if (!storesMap) {
        storesMap = new Map();
        mockDBRegistry.set(name, storesMap);
        isUpgradeNeeded = true;
      }

      const db = new MockIDBDatabase(storesMap);
      if (isUpgradeNeeded) {
        req.fireUpgrade(db);
      }
      req.fireSuccess(db);
    }, 0);

    return req as any;
  }
}

// ============================================================================
// Setup and Teardown
// ============================================================================

const originalIndexedDB = globalThis.indexedDB;

beforeEach(() => {
  mockDBRegistry.clear();
  globalThis.indexedDB = new MockIDBFactory() as any;
});

afterEach(() => {
  globalThis.indexedDB = originalIndexedDB;
});

// ============================================================================
// Integration Test Suite
// ============================================================================

describe('Worldforge Assets Integration: Generator + IndexedDB Cache + Service', () => {
  it('handles misses, generations, caching, and persistence correctly', async () => {
    // 1. Setup mock fetch for the backend generator
    const mockResponse = {
      predictions: [
        {
          bytesBase64Encoded: 'Y2FjaGVkLWJ5dGVz', // Base64 for "cached-bytes"
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    // 2. Initialize IndexedDB cache
    const cache1 = new IndexedDbAssetCache('integration-db', 'assets');
    await cache1.open();

    // 3. Initialize generator backend
    const backend = createImageGenBackend({
      fetch: mockFetch,
      apiKey: 'integration-test-key',
    });

    // 4. Create ForgeAssetService
    const service1 = createForgeAssetService({
      cache: cache1,
      generator: backend,
      online: true,
    });

    // 5. Request a new asset (this should be a cache miss)
    const assetKey = 'texture/wall/plaster/weathered';
    const asset1 = await service1.request(assetKey);

    // Verify it was generated.
    expect(asset1.source).toBe('generated');
    expect(asset1.imageUri).toBe('data:image/png;base64,Y2FjaGVkLWJ5dGVz');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verify it is present in the synchronous mirror.
    expect(cache1.has(assetAddress(assetKey))).toBe(true);

    // 6. Request the same asset again (should resolve from cache)
    const asset2 = await service1.request(assetKey);
    expect(asset2.source).toBe('cache');
    expect(mockFetch).toHaveBeenCalledTimes(1); // Fetch not called again.

    // Allow database background writes to resolve.
    await new Promise((r) => setTimeout(r, 10));

    // 7. Shut down service and cache to simulate reload.
    cache1.close();

    // 8. Re-open database with a new cache and service instance (persistence test)
    const cache2 = new IndexedDbAssetCache('integration-db', 'assets');
    await cache2.open(); // Triggers hydration from mock IndexedDB.

    const service2 = createForgeAssetService({
      cache: cache2,
      generator: backend,
      online: true,
    });

    // Requesting the key should immediately resolve from cache without calling the generator.
    const asset3 = await service2.request(assetKey);
    expect(asset3.source).toBe('cache');
    expect(mockFetch).toHaveBeenCalledTimes(1); // Fetch calls remain at 1.

    cache2.close();
  });
});
