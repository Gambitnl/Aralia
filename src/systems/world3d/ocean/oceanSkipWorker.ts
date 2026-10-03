/**
 * @file oceanSkipWorker.ts — a thrown stone's run, computed off the main
 * thread.
 *
 * WHY A WORKER. One throw is 10,000 to 60,000 rigid-body steps with every
 * triangle of the stone clipped at the water twice a step, and on the lake
 * each water sample sums about 10,000 wave modes (`createSkipSeaWater`):
 * measured 0.3 to 4 s of CPU for the presets. On the main thread that
 * would freeze the sea for that long; here the sea keeps running and the
 * stone flies when its run arrives. The physics is `oceanSkipMath.ts`,
 * unchanged, so a run from here is the same run a test gets.
 *
 * THE PROTOCOL (plain data):
 *   in  { type: 'init', cascades, seed, n }  build the sea's own height
 *   out { type: 'ready', label, modes, varianceKept, buildMs }
 *   in  { type: 'throw', id, throw }         run one throw on that sea
 *   out { type: 'run', id, run, ms }         the SkipRun (samples transferred)
 *   out { type: 'error', id, message }       a failure, never a silent skip
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/09/2026, 09:55:33
 * Dependents: systems/world3d/ocean/oceanSkip.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/// <reference lib="webworker" />
import type { CascadeParams } from './oceanConfig';
import { createSkipSeaWater, simulateSkip, type SkipSeaWater, type SkipThrow } from './oceanSkipMath';

interface InitMsg { type: 'init'; cascades: CascadeParams[]; seed: number; n: number }
interface ThrowMsg { type: 'throw'; id: number; throw: SkipThrow }

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let water: SkipSeaWater | null = null;

ctx.onmessage = (e: MessageEvent<InitMsg | ThrowMsg>) => {
  const m = e.data;
  const id = m.type === 'throw' ? m.id : -1;
  try {
    if (m.type === 'init') {
      const t0 = performance.now();
      water = createSkipSeaWater(m.cascades, m.seed, m.n);
      ctx.postMessage({
        type: 'ready', label: water.label, modes: water.modes, varianceKept: water.varianceKept,
        buildMs: performance.now() - t0,
      });
      return;
    }
    if (m.type === 'throw') {
      if (!water) throw new Error('[ocean] The skip worker got a throw before its sea was built.');
      const t0 = performance.now();
      const run = simulateSkip(m.throw, water);
      ctx.postMessage({ type: 'run', id: m.id, run, ms: performance.now() - t0 }, [run.samples.buffer]);
    }
  } catch (err) {
    ctx.postMessage({ type: 'error', id, message: String(err instanceof Error ? err.stack ?? err.message : err) });
  }
};
