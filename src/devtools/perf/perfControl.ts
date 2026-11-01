/** Reversible measurement bypass for controlled diagnostic-overhead comparisons. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 05/10/2026, 04:17:39
 * Dependents: devtools/perf/PerfFpsText.tsx, devtools/perf/PerfOverlay.tsx, devtools/perf/PerfWindowBadge.tsx, devtools/perf/perfOverhead.ts, devtools/perf/perfRegistry.ts, devtools/perf/rendererProbe.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

let enabled = true;
const listeners = new Set<() => void>();

export function isPerfMeasurementEnabled(): boolean { return enabled; }

export function subscribePerfMeasurement(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Does not persist a preference or alter the scene, solver or renderer. */
export function setPerfMeasurementEnabled(value: boolean): void {
  if (value === enabled) return;
  enabled = value;
  for (const listener of listeners) listener();
}
