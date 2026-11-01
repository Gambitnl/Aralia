/** Measures the inherited solver's corrective pushes without calling them rock
 * dissipation. These receipts describe numerical operations, not their accuracy.
 * The live receiver must still check reconstructed volume, leakage and exits.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 12/10/2026, 14:08:00
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { StorageBufferAttribute } from 'three/webgpu';
import { MPM_REST_DENSITY, simSecondsPerUnit, type FlipParams } from './flipCompute';

export function physicalFlipUnits(dx: number, dynamicViscosityPaS = .001) {
  if (!(dx > 0) || !Number.isFinite(dx) || dynamicViscosityPaS < 0 || !Number.isFinite(dynamicViscosityPaS)) {
    throw Error('Invalid physical water units');
  }
  const time = simSecondsPerUnit(dx), mass = 1000 * dx ** 3 / MPM_REST_DENSITY;
  const speed = dx / time;
  return { time, mass, speed, impulse: mass * speed, energy: mass * speed ** 2,
    viscosity: dynamicViscosityPaS * dx * time / mass };
}

export function createFlipContactObservations(params: FlipParams) {
  return {
    grid: new StorageBufferAttribute(new Float32Array(params.n ** 3 * 4), 4),
    particle: new StorageBufferAttribute(new Float32Array(params.count * 4), 4),
    position: new StorageBufferAttribute(new Float32Array(params.count * 4), 4),
  };
}

/** Consume actual GPU buffers after one completed step. Keep signed energy
 * change and absolute correction totals separate; opposing errors must not hide.
 * The values are net changes within each grid/particle stage. Sequential
 * floor/roof operations can cancel internally; this is not a bound on every
 * individual correction or on their error. Unqualified contact stays unqualified.
 * Position correction reports gravitational energy only. It is not a complete
 * thermodynamic work calculation or permission to close an energy residual.
 */
export function readFlipContactObservations(params: FlipParams, data: {
  grid: ArrayLike<number>; particle: ArrayLike<number>; position: ArrayLike<number>;
}) {
  if (data.grid.length !== params.n ** 3 * 4 || data.particle.length !== params.count * 4
      || data.position.length !== params.count * 4) throw Error('Contact readback shape mismatch');
  const units = physicalFlipUnits(params.dx);
  const impulse = (values: ArrayLike<number>) => {
    const momentumNs = [0, 0, 0]; let kineticJ = 0, absoluteKineticJ = 0, absoluteImpulseNs = 0;
    for (let i = 0; i < values.length; i += 4) {
      for (let k = 0; k < 4; k++) if (!Number.isFinite(values[i + k])) throw Error('Nonfinite contact observation');
      for (let k = 0; k < 3; k++) momentumNs[k] += values[i + k] * units.impulse;
      absoluteImpulseNs += Math.hypot(values[i], values[i + 1], values[i + 2]) * units.impulse;
      const energy = values[i + 3] * units.energy;
      kineticJ += energy; absoluteKineticJ += Math.abs(energy);
    }
    return { momentumNs, kineticJ, absoluteKineticJ, absoluteImpulseNs };
  };
  let potentialJ = 0, absolutePotentialJ = 0, maximumDisplacementM = 0;
  for (let i = 0; i < data.position.length; i += 4) {
    for (let k = 0; k < 4; k++) if (!Number.isFinite(data.position[i + k])) throw Error('Nonfinite position correction');
    maximumDisplacementM = Math.max(maximumDisplacementM,
      Math.hypot(data.position[i], data.position[i + 1], data.position[i + 2]) * params.dx);
    const energy = data.position[i + 3] * units.energy;
    potentialJ += energy; absolutePotentialJ += Math.abs(energy);
  }
  return { grid: impulse(data.grid), particle: impulse(data.particle),
    position: { potentialJ, absolutePotentialJ, maximumDisplacementM } };
}
