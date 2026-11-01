/** Water in flight remembers its emission rate. Simulation time, not render
 * time, moves a flood front. The captured flight delay is an approximation
 * shared with the receiving solver; geometric age still ends at today's pool. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 10:23:35
 * Dependents: components/World3D/water/riverWaterfallView.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { riverFloodSourceAt, type RiverFloodPulseDescriptor } from './riverFloodSurge';

export function waterfallFloodActive(pulse: RiverFloodPulseDescriptor | null, timeS: number): boolean {
  if (!pulse) return false;
  const end = Math.min(pulse.stopS ?? Infinity, pulse.startS + pulse.durationS, pulse.cancelS === null ? Infinity : pulse.cancelS + pulse.cancelDurationS);
  return timeS >= pulse.startS && timeS < end + pulse.flightDelayS;
}

/** Q remains exact. Only the history coordinate stretches with the pool's
 * changing flight: crest age is zero and bottom age is the captured delay. */
export function waterfallFloodSection(pulse: RiverFloodPulseDescriptor, timeS: number, age: number, geometricFlightS: number, width: number, depth: number) {
  const historyScale = pulse.flightDelayS / Math.max(geometricFlightS, 1e-8);
  const emissionS = timeS - age * historyScale;
  const q = riverFloodSourceAt(pulse, emissionS);
  const derivative = riverFloodSourceDerivative(pulse, emissionS);
  const speed = q / (width * depth), speedAgeDerivative = -derivative * historyScale / (width * depth);
  const velocity = Math.hypot(speed,9.81*age);
  const centerYDerivative = depth * 6 * age * Math.exp(-6*age*age) - 9.81*age;
  const planeJacobian = (speed*(speed+age*speedAgeDerivative)-9.81*age*centerYDerivative)/Math.max(velocity,1e-8);
  // DEBT: Center-plane compensation omits the transverse term from rotating
  // thick sections. A short violent pulse can fold this coordinate system;
  // callers must report that limit rather than describe it as solved fluid flow.
  const valid = planeJacobian > 1e-5;
  // An invalid section retains the bounded native area instead of exploding.
  // This is an explicit diagnostic fallback, not a conservation claim.
  const area = valid ? q * historyScale / planeJacobian : q / Math.max(velocity,1e-8);
  return { q, speed, speedAgeDerivative, emissionS, historyScale, planeJacobian, area, valid };
}

/** Analytic derivative of the shared smooth rise/recession, including cancel.
 * It is needed when recovering a section on a trajectory with varying launch speed. */
export function riverFloodSourceDerivative(p: RiverFloodPulseDescriptor, t: number): number {
  const end = Math.min(p.startS + p.durationS, p.cancelS === null ? Infinity : p.cancelS + p.cancelDurationS);
  if (t >= (p.stopS ?? Infinity) || t <= p.startS || t >= end) return 0;
  if (p.cancelS !== null && t >= p.cancelS) {
    const u = (t - p.cancelS) / p.cancelDurationS;
    return -p.cancelExtraM3S * 6 * u * (1 - u) / p.cancelDurationS;
  }
  const age = t - p.startS, rise = p.durationS * .2, hold = p.durationS * .6, fall = p.durationS * .4;
  if (age < rise) { const u = age / rise; return p.extraPeakM3S * 6 * u * (1 - u) / rise; }
  if (age < hold) return 0;
  const u = (age - hold) / fall;
  return -p.extraPeakM3S * 6 * u * (1 - u) / fall;
}
