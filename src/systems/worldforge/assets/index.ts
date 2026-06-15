/**
 * @file Worldforge asset & material pipeline (SPEC §7).
 *
 * Build-order item 8 (asset half): runtime AI-gen + content-addressed cache.
 * The ForgeAssetService resolves a semantic asset key to an AI-generated
 * texture the renderers consume, calling the injected generation backend on a
 * cache miss. No procedural-synthesis fallback — an unresolved asset leaves
 * the renderer on its own base material.
 */
export * from './types';
export * from './assetKey';
export * from './forgeAssetService';
export * from './imageGenBackend';
export * from './indexedDbCache';

