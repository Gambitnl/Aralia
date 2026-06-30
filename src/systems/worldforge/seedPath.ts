/**
 * @file seedPath.ts — Worldforge hierarchical seed paths.
 *
 * Spec: docs/projects/worldforge/SPEC.md §4. Every layer artifact is
 * addressed by a seed path like:
 *
 *   wf:1337/cell:71-8/local:2-1/bldg:14
 *
 * The path IS the identity: any artifact regenerates in isolation from its
 * path, and sibling artifacts get statistically independent randomness.
 * Determinism contract (decision #14, deterministic base + delta): the
 * mapping path → seed is FROZEN. Changing fnv1a or the mapping below after
 * worlds ship is a save-breaking event; golden tests pin exact values.
 *
 * What changed: new module (build-order item 1).
 * Why: the repo's existing pattern (worldSeed + magic offsets like 7777/8888)
 * doesn't scale to a five-layer hierarchy with unbounded children.
 * Preserved: SeededRandom (Park-Miller) remains the RNG; we only derive its
 * seed differently. Existing offset-based systems are untouched.
 */
import { SeededRandom } from '../../utils/random/seededRandom';

/** A hierarchical seed path. Treat as opaque; build via the helpers below. */
export type SeedPath = string;

const ROOT_PREFIX = 'wf';
const SEPARATOR = '/';

/**
 * Segments may not contain the separator; everything else is allowed but
 * keep them short and stable — they are persistence-facing identity.
 */
function assertValidSegment(segment: string): void {
  if (!segment || segment.includes(SEPARATOR)) {
    throw new Error(`Invalid seed path segment: "${segment}"`);
  }
}

/** Root path for a world: `wf:<worldSeed>`. */
export function rootSeedPath(worldSeed: number): SeedPath {
  return `${ROOT_PREFIX}:${worldSeed >>> 0}`;
}

/**
 * Recover the numeric world seed from any path's root segment (`wf:<seed>`).
 * Stable across every artifact in the world — used where a generator needs the
 * GLOBAL world seed (not its per-artifact path) so sibling artifacts share one
 * world-position field (Stage 5 seamless terrain). Returns 0 for a malformed root.
 */
export function worldSeedFromPath(path: SeedPath): number {
  const root = path.split(SEPARATOR, 1)[0]; // e.g. "wf:1337"
  const n = Number(root.slice(ROOT_PREFIX.length + 1)); // after "wf:"
  return Number.isFinite(n) ? n >>> 0 : 0;
}

/** Child path: append one segment (e.g. `cell:71-8`, `bldg:14`). */
export function childSeedPath(parent: SeedPath, segment: string): SeedPath {
  assertValidSegment(segment);
  return `${parent}${SEPARATOR}${segment}`;
}

/** Convenience: root + many segments in one call. */
export function makeSeedPath(worldSeed: number, ...segments: string[]): SeedPath {
  return segments.reduce(
    (path, segment) => childSeedPath(path, segment),
    rootSeedPath(worldSeed),
  );
}

/**
 * FNV-1a 32-bit hash. Chosen for: trivially portable (a future worker/WASM
 * port must reproduce it bit-for-bit), well-distributed for short strings,
 * and dependency-free. FROZEN — see file header.
 */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Map a seed path into the Park-Miller domain [1, 2147483646] expected by
 * SeededRandom (which treats seed % 2147483647 and rejects 0).
 */
export function seedFromPath(path: SeedPath): number {
  return (fnv1a(path) % 2147483646) + 1;
}

/** A SeededRandom whose stream is fully determined by the path. */
export function rngFromPath(path: SeedPath): SeededRandom {
  return new SeededRandom(seedFromPath(path));
}

/**
 * Named sub-stream: lets one generator draw independent randomness per
 * concern (`rngFromPath(streamPath(path, 'vegetation'))`) so adding draws to
 * one concern never perturbs another — the same stability property the old
 * magic-offset pattern provided, made hierarchical.
 */
export function streamPath(path: SeedPath, streamName: string): SeedPath {
  return childSeedPath(path, `s:${streamName}`);
}
