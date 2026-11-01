/** A source-only flood pulse in simulation seconds. Downstream water is never reset. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 08/10/2026, 09:53:39
 * Dependents: components/World3D/water/riverLiveClient.ts, components/World3D/water/riverWaterfallView.ts, systems/world3d/river/riverLive.ts, systems/world3d/river/riverSourceHistory.ts, systems/world3d/river/riverWorker.ts, systems/world3d/river/waterfallFloodVisual.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RiverSourceStatus } from './riverSourceHistory';

export interface RiverFloodOptions { peakM3S?: number; durationS?: number }
/** Absolute simulation-time descriptor for q(sourceTime - emissionAge) rendering. */
export interface RiverFloodPulseDescriptor {
  startS: number; durationS: number; baseM3S: number; extraPeakM3S: number; flightDelayS: number;
  stopS?: number;
  cancelS: number | null; cancelExtraM3S: number; cancelDurationS: number;
}
export interface RiverFloodStatus {
  source?: RiverSourceStatus;
  phase: 'idle' | 'rising' | 'holding' | 'receding' | 'draining';
  baseM3S: number; peakM3S: number; sourceM3S: number; landingM3S: number;
  remainingS: number; flightDelayS: number; extraEmittedM3: number; extraLandedM3: number;
  /** Ideal airborne arrival integral; actual accepted solver volume can be lower. */
  extraArrivingM3: number;
  pulse: RiverFloodPulseDescriptor | null;
}
const smooth = (t: number) => { const q = Math.max(0, Math.min(1, t)); return q * q * (3 - 2 * q); };
const integral = (t: number) => { const q = Math.max(0, Math.min(1, t)); return q ** 3 - .5 * q ** 4; };
const bounded = (v: number | undefined, fallback: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v! : fallback));

/** The renderer and solver share one emission envelope, including cancellation. */
export function riverFloodSourceAt(pulse: RiverFloodPulseDescriptor, timeS: number): number {
  if (timeS >= (pulse.stopS ?? Infinity)) return pulse.baseM3S;
  const age = timeS - pulse.startS, end = Math.min(pulse.startS + pulse.durationS,
    pulse.cancelS === null ? Infinity : pulse.cancelS + pulse.cancelDurationS);
  if (age <= 0 || timeS >= end) return pulse.baseM3S;
  if (pulse.cancelS !== null && timeS >= pulse.cancelS) return pulse.baseM3S
    + pulse.cancelExtraM3S * (1 - smooth((timeS - pulse.cancelS) / pulse.cancelDurationS));
  const rise = pulse.durationS * .2, holdEnd = pulse.durationS * .6;
  return pulse.baseM3S + pulse.extraPeakM3S * (age < rise ? smooth(age / rise)
    : age < holdEnd ? 1 : 1 - smooth((age - holdEnd) / (pulse.durationS * .4)));
}

export class RiverFloodSurge {
  private startS = -Infinity;
  private stopS = Infinity;
  private durationS = 90;
  private emissionBaseM3S = 0;
  private extra = 0;
  private delayS = 0;
  private cancelS = Infinity;
  private cancelExtra = 0;
  private cancelDurationS = 0;

  /** Ignore a second start until the airborne tail has landed; this keeps one coherent pulse. */
  start(timeS: number, baseM3S: number, flightDelayS: number, options: RiverFloodOptions = {}): boolean {
    if (this.status(timeS, baseM3S).phase !== 'idle') return false;
    this.durationS = bounded(options.durationS, 90, 5, 600);
    this.emissionBaseM3S = baseM3S;
    this.extra = bounded(options.peakM3S, 60, baseM3S, Math.max(baseM3S, 120)) - baseM3S;
    this.stopS = Infinity; this.startS = timeS; this.delayS = bounded(flightDelayS, 0, 0, 30); this.cancelS = Infinity;
    return true;
  }

  /** Recede from the current source rate; the airborne and downstream tail continues. */
  cancel(timeS: number): void {
    if (!Number.isFinite(this.startS) || timeS >= this.endS() || timeS >= this.cancelS) return;
    this.cancelExtra = this.extraAt(timeS);
    this.cancelS = timeS;
    // A late cancellation must finish by the same end used by the rate and volume integral.
    this.cancelDurationS = Math.min(this.startS + this.durationS - timeS, 20, Math.max(1, this.durationS * .2));
  }

  /** Close the flood release immediately, retaining the already emitted tail. */
  stop(timeS: number): void { this.stopS = Math.min(this.stopS, timeS); }

  private endS(): number { return Math.min(this.stopS, this.startS + this.durationS, this.cancelS + this.cancelDurationS); }
  private naturalExtra(timeS: number): number {
    const age = timeS - this.startS, rise = this.durationS * .2, holdEnd = this.durationS * .6;
    if (age <= 0 || age >= this.durationS) return 0;
    return this.extra * (age < rise ? smooth(age / rise) : age < holdEnd ? 1 : 1 - smooth((age - holdEnd) / (this.durationS * .4)));
  }
  extraAt(timeS: number): number {
    if (timeS >= this.stopS) return 0;
    if (timeS >= this.cancelS) return timeS >= this.endS() ? 0 : this.cancelExtra * (1 - smooth((timeS - this.cancelS) / this.cancelDurationS));
    return this.naturalExtra(timeS);
  }
  /** Integral of added source volume; used for transparent emission/flight accounting. */
  emittedVolume(timeS: number): number {
    timeS = Math.min(timeS, this.stopS);
    const age = Math.max(0, Math.min(this.durationS, Math.min(timeS, this.cancelS) - this.startS));
    const rise = this.durationS * .2, hold = this.durationS * .4, fall = this.durationS * .4;
    const rising = this.extra * rise * integral(age / rise);
    const holding = this.extra * Math.max(0, Math.min(hold, age - rise));
    const f = Math.max(0, Math.min(fall, age - rise - hold));
    const falling = this.extra * (f - fall * integral(f / fall));
    const cancelled = Number.isFinite(this.cancelS) ? this.cancelExtra * (Math.max(0, Math.min(this.cancelDurationS, timeS - this.cancelS))
      - this.cancelDurationS * integral((timeS - this.cancelS) / this.cancelDurationS)) : 0;
    return Number.isFinite(this.startS) ? rising + holding + falling + cancelled : 0;
  }
  landingAt(timeS: number, baseM3S: number): number { return baseM3S + this.extraAt(timeS - this.delayS); }
  status(timeS: number, baseM3S: number): RiverFloodStatus {
    const age = timeS - this.startS, end = this.endS();
    const phase = this.extra === 0 || timeS >= end + this.delayS ? 'idle'
      : timeS >= end ? 'draining' : timeS >= this.cancelS || age >= this.durationS * .6 ? 'receding'
        : age >= this.durationS * .2 ? 'holding' : 'rising';
    return { phase, baseM3S, peakM3S: baseM3S + this.extra, sourceM3S: baseM3S + this.extraAt(timeS),
      landingM3S: this.landingAt(timeS, baseM3S), remainingS: phase === 'idle' ? 0 : Math.max(0, end + this.delayS - timeS),
      flightDelayS: this.delayS, extraEmittedM3: this.emittedVolume(timeS), extraLandedM3: this.emittedVolume(timeS - this.delayS),
      extraArrivingM3: this.emittedVolume(timeS - this.delayS),
      // Already airborne water keeps its emission baseline after ordinary source edits.
      pulse: Number.isFinite(this.startS) ? { stopS: Number.isFinite(this.stopS) ? this.stopS : undefined, startS: this.startS, durationS: this.durationS, baseM3S: this.emissionBaseM3S,
        extraPeakM3S: this.extra, flightDelayS: this.delayS, cancelS: Number.isFinite(this.cancelS) ? this.cancelS : null,
        cancelExtraM3S: this.cancelExtra, cancelDurationS: this.cancelDurationS } : null };
  }
}
