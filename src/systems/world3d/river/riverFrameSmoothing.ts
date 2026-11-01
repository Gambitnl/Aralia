/**
 * Smooths the river's display fields without allocating a second full map.
 * LiveRiver calls this after physical steps. It preserves the old Float32
 * mean rounding, smoothing weights and accumulator reset, so water motion,
 * rendering cadence and the outgoing display fields keep their behavior.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/10/2026, 08:41:43
 * Dependents: systems/world3d/river/riverLive.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

interface AccumulatedRiverFrame {
  sh: Float64Array;
  shu: Float64Array;
  shv: Float64Array;
  su2: Float64Array;
}
interface SmoothedRiverFrame {
  h: Float32Array;
  qu: Float32Array;
  qv: Float32Array;
  q2: Float32Array;
}

/**
 * The same smoothing over the listed cells only (2026-10-22, GG-430). Every
 * other cell must hold zero integrals and zero display values: the full pass
 * leaves such a cell at exactly zero, so the result is the same.
 */
export function smoothRiverFrameAt(
  acc: AccumulatedRiverFrame, display: SmoothedRiverFrame,
  span: number, weight: number, rmsWeight: number, cells: ArrayLike<number>,
): void {
  if (!(span > 0)) return;
  for (let k = 0; k < cells.length; k += 1) {
    const c = cells[k];
    const mass = acc.sh[c];
    const h = Math.fround(mass / span);
    let u = 0, v = 0, rms = 0;
    if (mass > 1e-6) {
      const meanU = acc.shu[c] / mass, meanV = acc.shv[c] / mass;
      u = Math.fround(meanU);
      v = Math.fround(meanV);
      rms = Math.fround(Math.sqrt(Math.max(0, acc.su2[c] / mass - meanU * meanU - meanV * meanV)));
    }
    display.h[c] += weight * (h - display.h[c]);
    display.qu[c] += weight * (h * u - display.qu[c]);
    display.qv[c] += weight * (h * v - display.qv[c]);
    const q2 = h * (u * u + v * v + rms * rms);
    display.q2[c] += rmsWeight * (q2 - display.q2[c]);
    acc.sh[c] = 0;
    acc.shu[c] = 0;
    acc.shv[c] = 0;
    acc.su2[c] = 0;
  }
}

export function smoothRiverFrame(
  acc: AccumulatedRiverFrame, display: SmoothedRiverFrame,
  span: number, weight: number, rmsWeight: number,
): void {
  if (!(span > 0)) return;
  for (let c = 0; c < acc.sh.length; c += 1) {
    const mass = acc.sh[c];
    // meanOfAverage previously stored all four means in Float32 arrays.
    // Keep those exact rounding points while removing the temporary maps.
    const h = Math.fround(mass / span);
    let u = 0, v = 0, rms = 0;
    if (mass > 1e-6) {
      const meanU = acc.shu[c] / mass, meanV = acc.shv[c] / mass;
      u = Math.fround(meanU);
      v = Math.fround(meanV);
      rms = Math.fround(Math.sqrt(Math.max(0, acc.su2[c] / mass - meanU * meanU - meanV * meanV)));
    }
    display.h[c] += weight * (h - display.h[c]);
    display.qu[c] += weight * (h * u - display.qu[c]);
    display.qv[c] += weight * (h * v - display.qv[c]);
    const q2 = h * (u * u + v * v + rms * rms);
    display.q2[c] += rmsWeight * (q2 - display.q2[c]);
    // A formerly wet display cell must still decay when its current mean
    // is dry. Visit every cell and clear every accumulator as before.
    acc.sh[c] = 0;
    acc.shu[c] = 0;
    acc.shv[c] = 0;
    acc.su2[c] = 0;
  }
}
