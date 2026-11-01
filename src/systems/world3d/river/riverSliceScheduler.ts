/**
 * Keeps one next solver slice pending. Paused workers wait briefly between
 * slices; a resume or edit replaces that wait instead of adding another loop.
 * This preserves immediate fast settling and the existing eight-ms idle wait.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 03:28:50
 * Dependents: systems/world3d/river/riverWorker.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export class RiverSliceScheduler {
  private queued = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private readonly post: () => void) {}

  soon(): void {
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    if (this.queued) return;
    this.queued = true;
    this.post();
  }

  beginSlice(): void { this.queued = false; }

  idle(): void {
    if (this.queued || this.timer !== null) return;
    this.timer = setTimeout(() => { this.timer = null; this.soon(); }, 8);
  }
}
