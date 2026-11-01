/**
 * Solves the existing downward flight crossing shared by contact flow, source
 * support and impact-locus geometry. This dependency-free leaf breaks their
 * value-import cycle. Arithmetic, signed-zero results, unsupported-range errors
 * and the legacy export through waterfallContactFlow stay unchanged.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 02:10:57
 * Dependents: systems/world3d/river/waterfallContactFlow.ts, systems/world3d/river/waterfallImpactLocus.ts, systems/world3d/river/waterfallSourceSupport.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export function waterfallDownwardRoot(distance: number, speed: number, acceleration: number): number | null {
  if (![distance, speed, acceleration].every(Number.isFinite) || acceleration >= 0) throw Error('quadratic-flight-unsupported-range');
  if (distance < 0) return null;
  if (distance === 0 && speed <= 0) return 0;
  const a = acceleration * .5, discriminant = speed * speed - 4 * a * distance;
  if (!Number.isFinite(discriminant) || discriminant < 0 || (distance > 0 && discriminant === 0)) throw Error('quadratic-flight-unsupported-range');
  const q = -.5 * (speed + (speed < 0 ? -1 : 1) * Math.sqrt(discriminant));
  const roots = q === 0 ? [0] : [q / a, distance / q];
  const root = roots.filter(t => Number.isFinite(t) && t >= 0 && speed + acceleration * t <= 0).sort((l, r) => l - r)[0];
  if (root === undefined || (distance > 0 && root === 0)) throw Error('quadratic-flight-unsupported-range');
  return root;
}
