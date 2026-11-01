/** Samples the constant-gravity source strike curve on the actual ledge.
 * Straight mesh segments approximate this curved locus; source-bin remapping
 * remains quadrature, not exact finite-sheet interception. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 02:10:57
 * Dependents: systems/world3d/river/waterfallContactFlow.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ContactSource, ContactSurface, ContactVec3 } from './waterfallContactFlow';
import { waterfallDownwardRoot } from './waterfallFlightRoots';

export function waterfallImpactLocus(source: ContactSource, surface: ContactSurface, dt: number, maxSteps: number, spatial: { rowCount: number; spanKnots: readonly number[] }): ContactVec3[] {
  const g = 9.81, u = source.speed, yb = (source.top ?? 78) - source.depth / 2;
  const n = surface.normal, a = -n[0] / n[1], b = -n[2] / n[1];
  const c = surface.vertices[0][1] - a * surface.vertices[0][0] - b * surface.vertices[0][2];
  if (![dt, u, a, b, c].every(Number.isFinite) || dt <= 0 || !(u > 0)) throw Error('impact-locus-invalid-source');
  const z0 = -source.width / 2, z1 = source.width / 2;
  if (!Number.isInteger(spatial.rowCount) || spatial.rowCount <= 0 || !spatial.spanKnots.every(z => Number.isFinite(z) && z >= z0 && z <= z1)) throw Error('impact-locus-invalid-spatial-knots');
  const [ledgeStart, , , ledgeEnd] = surface.vertices;
  const rows = Array.from({ length: spatial.rowCount + 1 }, (_, j) => ledgeStart[2] + (ledgeEnd[2] - ledgeStart[2]) * j / spatial.rowCount);
  // Mesh identity depends only on spatial support. Arrival time partitions
  // change supplied flux, never manufacture globally thin film rows. Exact
  // coincident cuts share a vertex; merely nearby cuts are never merged.
  const candidates = [...new Set([z0, z1, ...spatial.spanKnots, ...rows.filter(z => z >= z0 && z <= z1)])].sort((l, r) => l - r);
  const pointAt = (z: number): ContactVec3 => {
    const time = waterfallDownwardRoot(yb - c - b * z, -a * u, -g);
    if (time === null || time > maxSteps * dt) throw Error('impact-locus-flight-capacity');
    const x = u * time;
    if (x <= surface.vertices[0][0] || x >= surface.vertices[1][0]) throw Error('impact-locus-outside-ledge');
    return [x, c + a * x + b * z, z];
  };
  return candidates.map(pointAt);
}
