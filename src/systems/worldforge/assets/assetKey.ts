/**
 * @file assetKey.ts — Worldforge semantic asset keys + content addressing.
 *
 * Spec: docs/projects/worldforge/SPEC.md §7 (asset & material pipeline).
 * Asset keys are SEMANTIC and slash-delimited:
 *
 *   texture/wall/plaster/weathered/temperate
 *   face/human/female/40s/sun-worn
 *   heraldry/state-17
 *
 * Convention: segment[0] = KIND, segment[1] = SUBJECT, segment[2..] =
 * DESCRIPTORS. The content address is FNV-1a (hex) of the CANONICAL key, so
 * the cache is content-addressed and a future worker/WASM port reproduces the
 * same addresses bit-for-bit (same rationale as seedPath.fnv1a).
 *
 * What changed: new module (build-order item 8 — the asset pipeline spine).
 * Why: the ForgeAssetService needs a stable, parseable key vocabulary and a
 * deterministic cache address before any generation or fallback can exist.
 * Preserved: reuses fnv1a from seedPath (one hash for the whole subsystem).
 */
import { fnv1a } from '../seedPath';

/** A structured view of a semantic asset key. */
export interface ParsedAssetKey {
  /** The asset family: `texture` | `face` | `heraldry` | `signage` | … */
  readonly kind: string;
  /** What the asset depicts: `wall`, `human`, `state-17`, … */
  readonly subject: string;
  /** Zero or more refining descriptors (`plaster`, `weathered`, `temperate`). */
  readonly descriptors: readonly string[];
}

const SEPARATOR = '/';

/**
 * Normalize a raw key: lowercase, trim each segment, drop empty segments
 * (which collapses repeated `//` and trailing/leading slashes). Canonical
 * form is what gets hashed, so cosmetically-different keys share a cache slot.
 */
export function canonicalizeAssetKey(raw: string): string {
  return raw
    .split(SEPARATOR)
    .map((segment) => segment.trim().toLowerCase())
    .filter((segment) => segment.length > 0)
    .join(SEPARATOR);
}

/**
 * Parse a semantic key into kind/subject/descriptors. Requires at least a
 * kind AND a subject — a kind alone is not addressable.
 */
export function parseAssetKey(raw: string): ParsedAssetKey {
  const canonical = canonicalizeAssetKey(raw);
  const segments = canonical.split(SEPARATOR).filter((s) => s.length > 0);
  if (segments.length < 2) {
    throw new Error(
      `Invalid asset key "${raw}": need at least kind/subject (got ${segments.length} segment(s)).`,
    );
  }
  const [kind, subject, ...descriptors] = segments;
  return { kind, subject, descriptors };
}

/**
 * Content address for a key: FNV-1a (32-bit) of the canonical form, as an
 * 8-char zero-padded hex string. This is the cache key — content-addressed
 * per SPEC §7, so identical assets dedupe regardless of request order.
 */
export function assetAddress(raw: string): string {
  return fnv1a(canonicalizeAssetKey(raw)).toString(16).padStart(8, '0');
}
