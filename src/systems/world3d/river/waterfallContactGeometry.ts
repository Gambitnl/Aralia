/** Identifies the exact rock geometry shared by Film releases and Flow guards.
 * Saved surfaces can have a different property order after lossless decoding.
 * Explicit field order preserves the existing native identity strings without
 * changing geometry, checkpoint state, or the meaning of the contact guards. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/10/2026, 03:54:37
 * Dependents: systems/world3d/river/waterfallContactFilm.ts, systems/world3d/river/waterfallContactFlow.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ContactSurface } from './waterfallContactFlow';

// IDENTITY CACHE (2026-11-03, claude-fall-lips). The contact guards ask for a
// surface's identity for every parcel at every tick, and the string build was
// 12 % of the 73 s "native 40.233333 second source" test. The guards must still
// see any change to the rock, so the cache never trusts the object alone: it
// keeps the id and every coordinate it built the string from, and it returns
// the string only when all of them are still === equal. For numbers, === equal
// gives the same JSON text (0 and -0 both print "0"; NaN never matches, so it
// rebuilds). Any other shape, or any change, rebuilds the string as before.
interface CachedIdentity { id: string; numbers: number[]; identity: string }
const identities = new WeakMap<ContactSurface, CachedIdentity>();
const plainNumbers = (surface: ContactSurface): number[] | null => {
  const { vertices, normal } = surface;
  if (!Array.isArray(vertices) || !Array.isArray(normal) || normal.length !== 3) return null;
  const out: number[] = [];
  for (const vertex of vertices) {
    if (!Array.isArray(vertex) || vertex.length !== 3) return null;
    out.push(vertex[0], vertex[1], vertex[2]);
  }
  out.push(normal[0], normal[1], normal[2]);
  return out.every(value => typeof value === 'number') ? out : null;
};

// The hit test reads the live coordinates in place, so a hit allocates nothing.
const unchanged = (surface: ContactSurface, cached: CachedIdentity): boolean => {
  const { vertices, normal } = surface, numbers = cached.numbers;
  if (cached.id !== surface.id || !Array.isArray(vertices) || !Array.isArray(normal)
    || normal.length !== 3 || vertices.length * 3 + 3 !== numbers.length) return false;
  let k = 0;
  for (const vertex of vertices) {
    if (!Array.isArray(vertex) || vertex.length !== 3) return false;
    if (vertex[0] !== numbers[k++] || vertex[1] !== numbers[k++] || vertex[2] !== numbers[k++]) return false;
  }
  return normal[0] === numbers[k++] && normal[1] === numbers[k++] && normal[2] === numbers[k];
};

export function waterfallContactGeometryIdentity(surface: ContactSurface): string {
  const cached = identities.get(surface);
  if (cached && unchanged(surface, cached)) return cached.identity;
  const numbers = plainNumbers(surface);
  // Preserve the existing JSON number semantics, including its signed-zero
  // limitation. Exact lossless checkpoint comparison remains a separate gate.
  const identity = JSON.stringify({ id: surface.id, vertices: surface.vertices, normal: surface.normal });
  if (numbers && typeof surface.id === 'string') identities.set(surface, { id: surface.id, numbers, identity });
  return identity;
}
