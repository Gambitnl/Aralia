/**
 * Keeps bounded elapsed costs for the performance tool itself. These clocks
 * exclude the renderer and upload calls being observed. React reports render
 * duration separately; browser layout/paint and clock-call overhead still need
 * an external trace or a controlled tools-on/tools-off comparison.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 04:17:39
 * Dependents: devtools/perf/PerfOverlay.tsx, devtools/perf/rendererProbe.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { isPerfMeasurementEnabled } from './perfControl';

export type PerfOverheadKind = 'probe' | 'graphics bookkeeping' | 'inventory' | 'HUD sampling' | 'React render';
const WINDOW_MS = 10_000;
const CAPACITY = 4096;
const samples = new Map<PerfOverheadKind, Array<{ at: number; ms: number; calls: number }>>();

export function recordPerfOverhead(kind: PerfOverheadKind, ms: number, now?: number): void {
  if (!isPerfMeasurementEnabled()) return;
  now ??= performance.now();
  if (!Number.isFinite(ms) || ms < 0) return;
  let rows = samples.get(kind);
  if (!rows) { rows = []; samples.set(kind, rows); }
  // Aggregate very frequent graphics calls in 100 ms buckets. Retain the
  // real call count while avoiding a new retained object for every upload.
  const last = rows.at(-1);
  if (last && now - last.at < 100) { last.ms += ms; last.calls += 1; }
  else rows.push({ at: now, ms, calls: 1 });
  while (rows.length && (now - rows[0].at > WINDOW_MS || rows.length > CAPACITY)) rows.shift();
}

export function perfOverheadSnapshot(now = performance.now()): Array<{ kind: PerfOverheadKind; totalMs: number; calls: number; meanMs: number; windowMs: number }> {
  return [...samples].map(([kind, rows]) => {
    const current = rows.filter(row => now - row.at <= WINDOW_MS);
    const totalMs = current.reduce((sum, row) => sum + row.ms, 0);
    const calls = current.reduce((sum, row) => sum + row.calls, 0);
    return { kind, totalMs, calls, meanMs: calls ? totalMs / calls : 0, windowMs: WINDOW_MS };
  });
}

export function clearPerfOverhead(): void { samples.clear(); }

if (typeof window !== 'undefined') {
  (window as unknown as { __araliaPerfOverhead?: unknown }).__araliaPerfOverhead = {
    snapshot: perfOverheadSnapshot, reset: clearPerfOverhead,
  };
}
