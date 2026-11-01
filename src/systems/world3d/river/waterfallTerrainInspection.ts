/** Keeps one existing water run per visited landscape. Only the selected run
 * advances; switching pauses and preserves the previous water and accounting.
 * This changes inspection scheduling, not the contact solver or its timestep.
 * The separate all-course diagnostic remains available for lockstep comparisons. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 16:49:21
 * Dependents: systems/world3d/river/waterfallTerrainComparisons.worker.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { TERRAIN_COMPARISON_CASES, WaterfallTerrainComparisonRun, type TerrainComparisonWorkerRequest,
  type TerrainComparisonSnapshot, type TerrainComparisonId } from './waterfallTerrainComparisons';

export class WaterfallTerrainInspection {
  private readonly runs = new Map<TerrainComparisonId, WaterfallTerrainComparisonRun>();
  private selected: WaterfallTerrainComparisonRun | null = null;

  private commandGeneration = 0;

  /** Share one display snapshot across up to four real ticks, allowing queued
   * controls to run between ticks. A newer command cancels only unfinished
   * work; already committed water stays owned and no stale snapshot is sent.
   * The yield clock is separate from numerical CPU work. */
  async executeYielding(request: TerrainComparisonWorkerRequest,
    yieldControl: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 0))
  ): Promise<{ snapshot: TerrainComparisonSnapshot; yieldMs: number } | null> {
    const generation = ++this.commandGeneration;
    if (request.type === 'dispose') return null;
    if (request.type !== 'step') return { snapshot: this.execute(request), yieldMs: 0 };
    const ticks = request.ticks ?? 1;
    if (!Number.isInteger(ticks) || ticks < 1 || ticks > 4) throw Error('Invalid waterfall inspection tick count');
    const selected = this.selected;
    let yieldMs = 0;
    if (selected) for (let i = 0; i < ticks; i++) {
      if (generation !== this.commandGeneration) return null;
      if (!selected.advanceTick()) break;
      if (i + 1 < ticks) {
        const before = performance.now();
        await yieldControl();
        yieldMs += performance.now() - before;
      }
    }
    return generation === this.commandGeneration ? { snapshot: this.snapshot(), yieldMs } : null;
  }

  snapshot(): TerrainComparisonSnapshot {
    return this.selected?.snapshot() ?? { snapshots: [], reading: { physicalTime: 0, sourceOn: true,
      running: false, failure: null, lastStepMilliseconds: 0, cases: [], arrivals: [] } };
  }

  execute(request: TerrainComparisonWorkerRequest): TerrainComparisonSnapshot {
    if (request.type === 'select') {
      const profile = TERRAIN_COMPARISON_CASES.find(c => c.id === request.id);
      if (!profile) throw Error('Unknown waterfall inspection course');
      // Validate before changing the current run. Unvisited, dry courses need
      // no solver allocation; their solid landscape is already built separately.
      this.selected?.setRunning(false);
      let run = this.runs.get(profile.id);
      if (!run) { run = new WaterfallTerrainComparisonRun([profile]); this.runs.set(profile.id, run); }
      this.selected = run;
    }
    if (!this.selected) return this.snapshot();
    if (request.type === 'reset') return this.selected.reset();
    if (request.type === 'source' && typeof request.sourceOn === 'boolean') this.selected.setSourceOn(request.sourceOn);
    if (request.type === 'running' && typeof request.running === 'boolean') this.selected.setRunning(request.running);
    if (request.type === 'step') {
      const ticks = request.ticks ?? 1;
      if (!Number.isInteger(ticks) || ticks < 1 || ticks > 4) throw Error('Invalid waterfall inspection tick count');
      const start = performance.now();
      // A few unchanged fixed ticks can share one worker reply. Stop between
      // ticks after 8 ms so source/pause commands do not wait behind a backlog.
      // A slow individual tick remains indivisible and is reported honestly.
      // Copy the full public record only after the batch. Constructing one
      // before the first tick and after every intermediate tick delayed water
      // without contributing anything to the displayed committed state.
      for (let i = 0; i < ticks; i++) {
        if (!this.selected.advanceTick()) break;
        if (performance.now() - start >= 8) break;
      }
      return this.snapshot();
    }
    return this.snapshot();
  }
}
