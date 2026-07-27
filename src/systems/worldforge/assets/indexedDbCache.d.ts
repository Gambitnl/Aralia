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
export declare class IndexedDbAssetCache implements AssetCache {
    private readonly mirror;
    private db;
    private readonly dbName;
    private readonly storeName;
    private openPromise;
    constructor(dbName?: string, storeName?: string);
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
    open(): Promise<void>;
    /**
     * Synchronously checks if an asset exists in the cache by address.
     */
    has(address: string): boolean;
    /**
     * Synchronously retrieves an asset by address.
     */
    get(address: string): ForgeAsset | undefined;
    /**
     * Caches an asset. Updates the in-memory mirror immediately and schedules
     * a write-through transaction to IndexedDB in the background.
     */
    set(address: string, asset: ForgeAsset): void;
    /**
     * Closes the database connection.
     * Clears the in-memory mirror and resets open state.
     */
    close(): void;
}
