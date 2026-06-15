// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/06/2026, 01:38:11
 * Dependents: systems/worldforge/assets/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file indexedDbCache.ts
 *
 * This file implements a persistent, content-addressed asset cache backed by IndexedDB.
 *
 * Because generating assets (especially images via AI models) is slow and costly, we need
 * to cache them persistently so they survive browser reloads. However, the game's render loop
 * needs synchronous checks to decide if a texture is already available to apply immediately.
 *
 * To satisfy both constraints, this cache maintains a synchronous, in-memory Map mirror.
 * - On startup, `open()` is called to connect to IndexedDB and load ("hydrate") all stored assets into memory.
 * - Synchronous reads (`get` and `has`) check the in-memory mirror directly and return instantly.
 * - Synchronous writes (`set`) update the in-memory mirror instantly and trigger an asynchronous write-through to IndexedDB.
 *
 * Called by: Worldforge initialization or createForgeAssetService parameters.
 * Depends on: types.ts for AssetCache and ForgeAsset definitions, and the browser's native IndexedDB API.
 */

import type { AssetCache, ForgeAsset } from './types';

// ============================================================================
// Persistent Cache Implementation
// ============================================================================
// Implements the AssetCache interface with IndexedDB persistent storage.
// Hydrates an in-memory mirror for instantaneous synchronous lookups.
// ============================================================================

export class IndexedDbAssetCache implements AssetCache {
  // Synchronous in-memory mirror holding all hydrated assets.
  private readonly mirror = new Map<string, ForgeAsset>();
  // Cached active IndexedDB connection.
  private db: IDBDatabase | null = null;
  // Database properties.
  private readonly dbName: string;
  private readonly storeName: string;
  // A promise reference so concurrent open calls share the same hydration process.
  private openPromise: Promise<void> | null = null;

  constructor(dbName = 'WorldforgeAssets', storeName = 'assets') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  /**
   * Opens the IndexedDB connection and hydrates the in-memory mirror.
   *
   * HYDRATION CONTRACT:
   * Consumers MUST await this method before using the synchronous get/has methods.
   * If not awaited, synchronous queries will fail to read existing database items,
   * leading to duplicate generation requests.
   *
   * @returns A promise that resolves once the database is open and the mirror is fully hydrated.
   */
  async open(): Promise<void> {
    // If we are already opening or have opened, return the existing promise.
    if (this.openPromise) return this.openPromise;

    this.openPromise = new Promise<void>((resolve, reject) => {
      // open request to indexedDB
      const request = indexedDB.open(this.dbName, 1);

      // Upgrade schema if this is the first initialization of the database.
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          // Key by 'address' (our content address) for quick direct lookups.
          db.createObjectStore(this.storeName, { keyPath: 'address' });
        }
      };

      // Handle successful database opening.
      request.onsuccess = () => {
        const db = request.result;
        this.db = db;

        // Perform read-only transaction to load all existing assets into the in-memory mirror.
        try {
          const transaction = db.transaction(this.storeName, 'readonly');
          const store = transaction.objectStore(this.storeName);
          const cursorRequest = store.openCursor();

          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (cursor) {
              const asset = cursor.value as ForgeAsset;
              // Add to synchronous mirror.
              this.mirror.set(asset.address, asset);
              cursor.continue();
            } else {
              // Cursor is done, hydration complete.
              resolve();
            }
          };

          cursorRequest.onerror = () => {
            reject(cursorRequest.error || new Error('Failed to read from object store.'));
          };
        } catch (err) {
          // If transaction creation fails (e.g. store missing), reject.
          reject(err);
        }
      };

      // Handle connection errors.
      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB database.'));
      };
    });

    return this.openPromise;
  }

  /**
   * Synchronously checks if an asset exists in the cache by address.
   */
  has(address: string): boolean {
    return this.mirror.has(address);
  }

  /**
   * Synchronously retrieves an asset by address.
   */
  get(address: string): ForgeAsset | undefined {
    return this.mirror.get(address);
  }

  /**
   * Caches an asset. Updates the in-memory mirror immediately and schedules
   * a write-through transaction to IndexedDB in the background.
   */
  set(address: string, asset: ForgeAsset): void {
    // 1. Immediately store in mirror so future synchronous reads in the current frame resolve it.
    this.mirror.set(address, asset);

    // 2. Schedule asynchronous write-through to IndexedDB if database is open.
    if (!this.db) {
      console.warn(
        `IndexedDbAssetCache: Attempted to cache "${address}" before IndexedDB was opened. Stored only in-memory.`,
      );
      return;
    }

    try {
      const transaction = this.db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      // Ensure the key (address) is present and correct in the stored object.
      store.put({ ...asset, address });
    } catch (err) {
      console.error(
        `IndexedDbAssetCache: Failed to write "${address}" to IndexedDB:`,
        err,
      );
    }
  }

  /**
   * Closes the database connection.
   * Clears the in-memory mirror and resets open state.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.openPromise = null;
    this.mirror.clear();
  }
}
