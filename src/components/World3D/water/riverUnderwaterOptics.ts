/**
 * Physical limits for looking through the river from below its surface.
 * The water shader shares these constants; the reference calculations let
 * tests check the critical angle and reject unavailable scene information.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 06/10/2026, 01:35:06
 * Dependents: components/World3D/water/riverWaterMaterial.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const WATER_TO_AIR_IOR = 1.333;
export const UNDERWATER_TRACE_STEPS = 18;
export const UNDERWATER_TRACE_START = 0.12;
export const UNDERWATER_TRACE_GROWTH = 1.48;

/** Unpolarized dielectric reflection, including the water's critical angle. */
export function underwaterFresnel(cosIncident: number): number {
  const ci = Math.min(1, Math.max(0, cosIncident));
  const sinTransmittedSquared = WATER_TO_AIR_IOR ** 2 * (1 - ci ** 2);
  if (sinTransmittedSquared >= 1) return 1;
  const ct = Math.sqrt(1 - sinTransmittedSquared);
  const rs = (WATER_TO_AIR_IOR * ci - ct) / (WATER_TO_AIR_IOR * ci + ct);
  const rp = (ci - WATER_TO_AIR_IOR * ct) / (ci + WATER_TO_AIR_IOR * ct);
  return (rs ** 2 + rp ** 2) * 0.5;
}

/** Screen edges and objects in front of the interface cannot supply a ray hit. */
export function underwaterSceneSampleValid(sample: {
  clipW: number; u: number; v: number; rayDistance: number;
  sceneY: number; interfaceY: number; transmitted: boolean;
}): boolean {
  return Object.values(sample).every(value => typeof value !== 'number' || Number.isFinite(value))
    && sample.clipW > 0
    && sample.u > 0.002 && sample.u < 0.998 && sample.v > 0.002 && sample.v < 0.998
    && sample.rayDistance > 0.02
    && (sample.transmitted ? sample.sceneY > sample.interfaceY + 0.02 : sample.sceneY < sample.interfaceY - 0.02);
}
