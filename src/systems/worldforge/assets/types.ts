/**
 * @file types.ts — shared Worldforge asset types (SPEC §7).
 *
 * A ForgeAsset is the AI-generated surface detail the renderers consume,
 * addressed by a semantic key and stored in a content-addressed cache. There
 * is no procedural-synthesis fallback layer: a cache miss either resolves via
 * the generation backend or returns nothing, and the renderer keeps its own
 * existing base material (role tints, terrain palette) until a texture lands.
 */

/** Where a resolved asset came from — its provenance. */
export type AssetSource = 'generated' | 'cache';

/** A resolved AI-generated material/texture asset. */
export interface ForgeAsset {
  /** Canonical key (lowercased, slash-delimited). */
  readonly key: string;
  /** Content address (FNV-1a hex) — the cache slot. */
  readonly address: string;
  /** Provenance of this resolution. */
  readonly source: AssetSource;
  /** The generated surface detail (data/blob/remote URI). */
  readonly imageUri: string;
  /** Optional PBR scalars the generator may emit alongside the image. */
  readonly baseColorHex?: string;
  readonly roughness?: number;
  readonly metalness?: number;
}

/**
 * A generation backend. The real implementation calls the runtime image
 * service (decision #9); tests inject a stub. Returning `null` means "no asset
 * produced" — the service surfaces that as an unresolved request rather than
 * substituting a synthetic material.
 */
export interface AssetGenerator {
  generate(key: string): Promise<ForgeAsset | null>;
}

/** Content-addressed cache backend. Default is an in-memory Map (see service). */
export interface AssetCache {
  get(address: string): ForgeAsset | undefined;
  set(address: string, asset: ForgeAsset): void;
  has(address: string): boolean;
}
