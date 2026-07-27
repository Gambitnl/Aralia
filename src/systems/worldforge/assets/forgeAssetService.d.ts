import type { AssetCache, AssetGenerator, ForgeAsset } from './types';
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
export declare function createForgeAssetService(options?: ForgeAssetServiceOptions): ForgeAssetService;
