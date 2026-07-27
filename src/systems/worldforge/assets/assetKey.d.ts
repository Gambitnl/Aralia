/** A structured view of a semantic asset key. */
export interface ParsedAssetKey {
    /** The asset family: `texture` | `face` | `heraldry` | `signage` | … */
    readonly kind: string;
    /** What the asset depicts: `wall`, `human`, `state-17`, … */
    readonly subject: string;
    /** Zero or more refining descriptors (`plaster`, `weathered`, `temperate`). */
    readonly descriptors: readonly string[];
}
/**
 * Normalize a raw key: lowercase, trim each segment, drop empty segments
 * (which collapses repeated `//` and trailing/leading slashes). Canonical
 * form is what gets hashed, so cosmetically-different keys share a cache slot.
 */
export declare function canonicalizeAssetKey(raw: string): string;
/**
 * Parse a semantic key into kind/subject/descriptors. Requires at least a
 * kind AND a subject — a kind alone is not addressable.
 */
export declare function parseAssetKey(raw: string): ParsedAssetKey;
/**
 * Content address for a key: FNV-1a (32-bit) of the canonical form, as an
 * 8-char zero-padded hex string. This is the cache key — content-addressed
 * per SPEC §7, so identical assets dedupe regardless of request order.
 */
export declare function assetAddress(raw: string): string;
