/** Readiness and frozen-state contract for the optional optical experiment.
 * A numerically solved field still needs spatial/angular and visual proof.
 * None of these checks grant permission to use it as a moving-water model. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 08:07:47
 * Dependents: components/World3D/water/riverWaterfallView.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface FrozenWaterfallSolarState {
  signature:string; visibilitySignature:string; bounceSignature:string;
  propagationDirection:readonly[number,number,number]; irradiance:readonly[number,number,number];
}
export interface FrozenWaterfallSolarProof extends FrozenWaterfallSolarState {
  relativePowerError:number; diffuseRelativePowerError:number;
  incoming:readonly[number,number,number];outgoing:readonly[number,number,number];absorbed:readonly[number,number,number];scattered:readonly[number,number,number];
  projectionSamples:number;projectionVectorMomentError:number;projectionTensorMomentError:number;
}
export interface FrozenWaterfallSource {
  sourceRGB: Float32Array;
  size: readonly [number, number, number];
  boundsMin: readonly [number, number, number]; boundsMax: readonly [number, number, number];
  frozenTime: number; camera: readonly [number, number, number];
  fieldSignature: string; lightingSignature: string;
  receipt: { ready: boolean; equationResidual: number; relativePowerError: number };
  solar?:FrozenWaterfallSolarProof;
}
export interface FrozenWaterfallState {
  time: number; camera: readonly [number, number, number]; fieldSignature: string; lightingSignature: string; sunZero: boolean;
  solar?:FrozenWaterfallSolarState;
}
function validSolarState(solar:FrozenWaterfallSolarState):boolean {
  return !!solar.signature&&!!solar.visibilitySignature&&!!solar.bounceSignature&&solar.propagationDirection.length===3&&solar.irradiance.length===3&&solar.propagationDirection.every(Number.isFinite)&&Math.abs(Math.hypot(...solar.propagationDirection)-1)<=1e-8&&solar.irradiance.every(v=>Number.isFinite(v)&&v>=0);
}
function validSolarProof(solar:FrozenWaterfallSolarProof):boolean {
  if(!validSolarState(solar)||![solar.relativePowerError,solar.diffuseRelativePowerError].every(v=>Number.isFinite(v)&&v>=0&&v<=1e-6)||!Number.isInteger(solar.projectionSamples)||solar.projectionSamples<=0||![solar.projectionVectorMomentError,solar.projectionTensorMomentError].every(v=>Number.isFinite(v)&&v>=0))return false;
  const vectors=[solar.incoming,solar.outgoing,solar.absorbed,solar.scattered];
  if(vectors.some(v=>v.length!==3||v.some(x=>!Number.isFinite(x)||x<0)))return false;
  // Recompute beam power from the actual receipt. A copied boolean or an
  // asserted small error cannot authorize a changed, unbalanced solar field.
  return solar.incoming.every((value,c)=>Math.abs(value-solar.outgoing[c]-solar.absorbed[c]-solar.scattered[c])/Math.max(value,1e-30)<=1e-6);
}
export function frozenWaterfallMismatch(proof: FrozenWaterfallSource, current: FrozenWaterfallState): string | null {
  if (!Number.isFinite(current.time) || current.camera.length !== 3 || current.camera.some(v => !Number.isFinite(v))) return 'Current frozen camera or time is invalid';
  if (proof.frozenTime !== current.time) return 'Frozen time changed';
  if (proof.camera.some((v, k) => Math.abs(v - current.camera[k]) > 1e-8)) return 'Frozen camera changed';
  if (proof.fieldSignature !== current.fieldSignature) return 'Frozen density or coefficient signature changed';
  if (proof.lightingSignature !== current.lightingSignature) return 'Frozen diffuse lighting signature changed';
  if(proof.solar){
    if(!validSolarProof(proof.solar)||!current.solar||!validSolarState(current.solar))return 'Solar proof requires a validated beam balance and signed current solar state';
    if((['signature','visibilitySignature','bounceSignature'] as const).some(key=>proof.solar![key]!==current.solar![key])||proof.solar.propagationDirection.some((v,k)=>v!==current.solar!.propagationDirection[k])||proof.solar.irradiance.some((v,k)=>v!==current.solar!.irradiance[k]))return 'Frozen solar direction, irradiance, opaque visibility or cliff bounce changed';
    if(current.sunZero!==current.solar.irradiance.every(v=>v===0))return 'Current sunlight flag disagrees with signed solar irradiance';
  }else if (!current.sunZero) return 'Diffuse-only proof requires shared sunlight set to zero';
  return null;
}
export function validateFrozenWaterfallSource(proof: FrozenWaterfallSource, current: FrozenWaterfallState): void {
  const vectors = [proof.size, proof.boundsMin, proof.boundsMax, proof.camera, current.camera];
  if (vectors.some(v => v.length !== 3 || v.some(x => !Number.isFinite(x))) || !Number.isFinite(proof.frozenTime)) throw new Error('Frozen source metadata must be finite');
  if (proof.size.some(v => !Number.isInteger(v) || v <= 0) || proof.boundsMax.some((v, k) => v <= proof.boundsMin[k])) throw new Error('Frozen source needs positive grid dimensions and extents');
  if (!(proof.sourceRGB instanceof Float32Array) || proof.sourceRGB.length !== proof.size.reduce((a, b) => a * b, 3)) throw new Error('Frozen source RGB storage mismatch');
  // Half-float storage supports portable linear 3D texture filtering. Reject
  // overflow instead of clipping an HDR source into an artificial white band.
  if (proof.sourceRGB.some(v => !Number.isFinite(v) || v < 0 || v > 65504)) throw new Error('Frozen source radiance must be finite, nonnegative and representable as half float');
  if (!proof.fieldSignature || !proof.lightingSignature || !proof.receipt.ready || ![proof.receipt.equationResidual, proof.receipt.relativePowerError].every(v => Number.isFinite(v) && v >= 0 && v <= 1e-6)) throw new Error('Frozen source must pass its unchanged residual and power thresholds');
  const mismatch = frozenWaterfallMismatch(proof, current); if (mismatch) throw new Error(mismatch);
}
