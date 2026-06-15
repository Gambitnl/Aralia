/**
 * @file indexedDbCache.test.ts
 *
 * This file tests the IndexedDB-backed persistent asset cache for Worldforge.
 *
 * Since Node/JSDOM environments lack a native IndexedDB implementation, we implement
 * a lightweight, database-spec compliant Mock IndexedDB registry in memory. This mock
 * registry simulates connection state, schema upgrades, transactions, read/write locks,
 * and cursor hydration.
 *
 * Tested features:
 * 1. Synchronous mirror: Verifying set-get operations reflect instantly.
 * 2. Asynchronous write-through: Verifying that items are persisted to the mock database.
 * 3. Persistence across reopens: Closing a connection and opening a new instance with the
 *    same database name hydrates the previously stored data.
 * 4. Content-addressed deduplication: Verifying that keys canonicalizing to the same FNV-1a
 *    address reside in the same physical slot.
 *
 * Test target: src/systems/worldforge/assets/indexedDbCache.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDbAssetCache } from '../indexedDbCache';
import { assetAddress } from '../assetKey';
import type { ForgeAsset } from '../types';

// ============================================================================
// Mock IndexedDB Registry & Classes
// ============================================================================
// Simulates the behavior of standard IndexedDB calls in-memory.
// ============================================================================

// Global registry of databases, keyed by database name -> store name -> key-value map.
// This survives across individual IndexedDbAssetCache closes/reopens, simulating storage.
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
    // We key by the 'address' property per keyPath configuration.
    const key = item.address;
    this.dataMap.set(key, item);
    const req = new MockIDBRequest<string>();
    // Execute asynchronously to simulate real browser thread schedules.
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
  // Inject our custom mock IndexedDB factory.
  globalThis.indexedDB = new MockIDBFactory() as any;
});

afterEach(() => {
  // Restore default global state.
  globalThis.indexedDB = originalIndexedDB;
});

// ============================================================================
// Test Suite: IndexedDB Cache
// ============================================================================

describe('IndexedDbAssetCache', () => {
  it('performs synchronous set-get and checks presence immediately', async () => {
    const cache = new IndexedDbAssetCache('test-db', 'assets');
    await cache.open();

    const sampleAsset: ForgeAsset = {
      key: 'texture/wall/plaster',
      address: assetAddress('texture/wall/plaster'),
      source: 'generated',
      imageUri: 'data:image/png;base64,123',
    };

    cache.set(sampleAsset.address, sampleAsset);

    // Sync check should return true immediately due to the mirror.
    expect(cache.has(sampleAsset.address)).toBe(true);
    expect(cache.get(sampleAsset.address)).toEqual(sampleAsset);

    // Wait for write-through to finish to make sure no errors occur in background.
    await new Promise((r) => setTimeout(r, 10));
    cache.close();
  });

  it('survives a simulated reopen (persists to mock IndexedDB storage)', async () => {
    // 1. Open first cache instance and save an asset.
    const cache1 = new IndexedDbAssetCache('persistence-db', 'assets');
    await cache1.open();

    const sampleAsset: ForgeAsset = {
      key: 'texture/floor/wood',
      address: assetAddress('texture/floor/wood'),
      source: 'generated',
      imageUri: 'data:image/png;base64,woodbytes',
    };

    cache1.set(sampleAsset.address, sampleAsset);

    // Wait for write-through execution.
    await new Promise((r) => setTimeout(r, 10));
    cache1.close(); // Closes connection & clears in-memory map.

    // 2. Open second cache instance targeting the same mock database.
    const cache2 = new IndexedDbAssetCache('persistence-db', 'assets');
    // opening should trigger hydration.
    await cache2.open();

    // Verifying it has loaded the asset from IndexedDB back into the mirror.
    expect(cache2.has(sampleAsset.address)).toBe(true);
    expect(cache2.get(sampleAsset.address)).toEqual({
      ...sampleAsset,
      address: sampleAsset.address,
    });

    cache2.close();
  });

  it('performs content-addressed deduplication (cosmetically different keys, same slot)', async () => {
    const cache = new IndexedDbAssetCache('dedupe-db', 'assets');
    await cache.open();

    const asset1: ForgeAsset = {
      key: 'Texture/Wall/Plaster',
      address: assetAddress('Texture/Wall/Plaster'),
      source: 'generated',
      imageUri: 'data:image/png;base64,plaster',
    };

    // Save under the capitalized key.
    cache.set(asset1.address, asset1);

    // Fetch using a canonical equivalent key containing extra slashes and casing.
    const canonAddress = assetAddress('texture//wall/plaster/');
    expect(canonAddress).toBe(asset1.address); // Addresses must match.
    expect(cache.has(canonAddress)).toBe(true);
    expect(cache.get(canonAddress)).toEqual(asset1);

    cache.close();
  });
});
