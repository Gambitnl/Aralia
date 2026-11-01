/** The source gate owns emission history; closing it never removes water downstream. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/10/2026, 09:53:39
 * Dependents: components/World3D/water/riverWaterfallView.ts, systems/world3d/river/riverFloodSurge.ts, systems/world3d/river/riverLive.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { riverFloodSourceAt, type RiverFloodPulseDescriptor } from './riverFloodSurge';

export interface RiverSourceChange { timeS: number; q: number }
export interface RiverSourceStatus {
  paused: boolean;
  flightDelayS: number;
  changes: RiverSourceChange[];
  /** Fresh dry runs had no emission before their first recorded opening.
   * Omitted for an existing steady source, whose prehistory stays unchanged. */
  beforeFirstQ?: number;
}

/** Read the rate when this water was released, including edits made while paused. */
export function riverSourceAt(source: RiverSourceStatus, pulse: RiverFloodPulseDescriptor | null, timeS: number): number {
  let q = source.beforeFirstQ ?? source.changes[0]?.q ?? 0;
  for (const change of source.changes) {
    if (change.timeS > timeS) break;
    q = change.q;
  }
  if (q === 0) return 0;
  return q + (pulse ? Math.max(0, riverFloodSourceAt(pulse, timeS) - pulse.baseM3S) : 0);
}

export class RiverSourceHistory {
  paused = false;
  private changes: RiverSourceChange[] = [];
  private beforeFirstQ: number | undefined;
  get hasChanges(): boolean { return this.beforeFirstQ !== undefined || this.changes.length > 1; }
  /** Only a fresh run may establish zero prehistory. Source pause/restart
   * records normal events instead, so it never erases water already released. */
  beginDry(configuredQ: number): void {
    if (!Number.isFinite(configuredQ) || configuredQ < 0 || this.changes.length > 1 || this.changes.some(c=>c.timeS!==0))
      throw Error('Dry source history requires a fresh source');
    this.beforeFirstQ = 0;
    this.changes = [{timeS:0,q:this.paused?0:configuredQ}];
  }
  record(timeS: number, configuredQ: number): void {
    const q = this.paused ? 0 : configuredQ;
    if (this.changes.at(-1)?.q !== q) this.changes.push({ timeS, q });
    // Keep the predecessor too, so water released before the retained window
    // retains its opening. The flood delay is bounded to thirty seconds.
    while (this.changes.length > 2 && this.changes[1].timeS < timeS - 32) this.changes.shift();
  }
  status(flightDelayS: number): RiverSourceStatus {
    return { paused: this.paused, flightDelayS, changes: this.changes.map(change => ({ ...change })),
      ...(this.beforeFirstQ === undefined ? {} : {beforeFirstQ:this.beforeFirstQ}) };
  }
}
