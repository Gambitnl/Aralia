/**
 * Measures how the river worker spends its own wall-clock time. Solver steps,
 * field construction, edits and message submission stay separate from waiting
 * between slices. This is elapsed worker utilization, not hardware CPU usage.
 * The meter never changes the water or the worker's pacing decisions.
 *
 * 2026-10-21: a GPU slice awaits the page's device. That wait is idle worker
 * time, so it is reported as `waitMs` and is not part of `busyMs`.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 02:56:50
 * Dependents: components/World3D/water/riverLiveClient.ts, systems/world3d/river/riverWorker.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface RiverWorkReading {
  windowMs: number;
  busyMs: number;
  advanceMs: number;
  fieldMs: number;
  editMs: number;
  transferMs: number;
  /** Time a slice awaited the GPU device; not included in busyMs. */
  waitMs: number;
  slices: number;
  fields: number;
  busyShare: number;
  /** End of the latest completed window, on this worker's clock. */
  endedAt: number;
}

export class RiverWorkMeter {
  private startedAt: number;
  private busyMs = 0;
  private advanceMs = 0;
  private fieldMs = 0;
  private editMs = 0;
  private transferMs = 0;
  private waitMs = 0;
  private sliceWaitMs = 0;
  private sliceFieldMs = 0;
  private slices = 0;
  private fields = 0;
  reading: RiverWorkReading | null = null;

  constructor(now: number) { this.startedAt = now; }

  /** Device wait so far in the current slice (to keep it out of advanceMs). */
  get sliceWait(): number { return this.sliceWaitMs; }
  /** Field time so far in the current slice (a frame may overlap a device wait). */
  get sliceField(): number { return this.sliceFieldMs; }

  add(kind: 'advance' | 'field' | 'edit' | 'transfer' | 'wait', ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    if (kind === 'wait') { this.waitMs += ms; this.sliceWaitMs += ms; return; }
    if (kind === 'advance') this.advanceMs += ms;
    else if (kind === 'field') { this.fieldMs += ms; this.sliceFieldMs += ms; this.fields += 1; }
    else if (kind === 'edit') this.editMs += ms;
    else this.transferMs += ms;
  }

  finishSlice(start: number, end: number): void {
    this.busyMs += Math.max(0, end - start - this.sliceWaitMs);
    this.sliceWaitMs = 0;
    this.sliceFieldMs = 0;
    this.slices += 1;
    const windowMs = end - this.startedAt;
    if (windowMs < 1000) return;
    this.reading = {
      windowMs, busyMs: this.busyMs, advanceMs: this.advanceMs, fieldMs: this.fieldMs,
      editMs: this.editMs, transferMs: this.transferMs, waitMs: this.waitMs, slices: this.slices, fields: this.fields,
      busyShare: this.busyMs / windowMs, endedAt: end,
    };
    this.startedAt = end;
    this.busyMs = this.advanceMs = this.fieldMs = this.editMs = this.transferMs = this.waitMs = 0;
    this.slices = this.fields = 0;
  }
}
