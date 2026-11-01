/** Four-layer operators called by the attached Film's opt-in advancing model.
 * This is an experimental first-order common-depth Rusanov/sigma scheme, not a
 * translation of Basilisk. Hydrostatic pressure uses total depth; remapping
 * exchanges vertical inventory conservatively. No dry-depth floor is used.
 * Method context: https://basilisk.fr/src/layered/hydro.h and diffusion.h/remap.h.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 12/10/2026, 00:39:33
 * Dependents: systems/world3d/river/waterfallBackpressureObserver.ts, systems/world3d/river/waterfallContactFilm.ts, systems/world3d/river/waterfallContactFlow.ts, systems/world3d/river/waterfallLayeredFilmEnergyObserver.ts, systems/world3d/river/waterfallSourceSupport.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ContactVec3 } from './waterfallContactFlow';

export const FOUR_LAYER_FILM_MODE = 'four-layer-hydrostatic-v1' as const;
export const FILM_LAYER_COUNT = 4;
export const FILM_DYNAMIC_VISCOSITY = .001;
const rho = 1000;
const dot = (a: ContactVec3, b: ContactVec3) => a.reduce((s, v, k) => s + v * b[k], 0);
const zero = (): ContactVec3 => [0, 0, 0];
export interface FilmLayerColumn { volumes: number[]; momenta: ContactVec3[] }
export type FilmDiagnosticValue = number | string | boolean | null | FilmDiagnosticValue[] | { [key: string]: FilmDiagnosticValue };
export interface LayeredFilmFailureDiagnostic {
  kind: 'layered-film-rejected-stage'; reason: string; classification: string;
  stage: string; cell: number | null; layer: number | null; component: number | 'volume' | null; provisional: true;
  complete: boolean; truncatedPaths: string[];
  operands: { [key: string]: FilmDiagnosticValue };
}
export interface FilmDiagnosticContext { stage?: string; cell?: number; operands?: () => Record<string, unknown>; observeDiffusion?: (value:unknown)=>void }
// Only rejected work copies operands. Nonfinite numbers retain their identity
// in JSON, and this detached error travels through rollback without committing
// the rejected water or weakening any guard.
function diagnosticValue(value: unknown, truncated: string[], path = 'operands'): FilmDiagnosticValue {
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : Number.isFinite(value) ? value : Number.isNaN(value) ? 'NaN' : value > 0 ? '+Infinity' : '-Infinity';
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (value.length > 16 && truncated.length < 8) truncated.push(`${path}:kept16of${value.length}`);
    return value.slice(0, 16).map((v, k) => diagnosticValue(v, truncated, `${path}[${k}]`));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length > 40 && truncated.length < 8) truncated.push(`${path}:kept40of${entries.length}`);
    return Object.fromEntries(entries.slice(0, 40).map(([key, v]) => [key, diagnosticValue(v, truncated, `${path}.${key}`)]));
  }
  return String(value);
}
export class LayeredFilmStageFailure extends Error {
  readonly diagnostic: LayeredFilmFailureDiagnostic;
  constructor(reason: string, classification: string, column: FilmLayerColumn, layer: number | null, context: FilmDiagnosticContext = {}) {
    super(reason);
    this.name = 'LayeredFilmStageFailure';
    const found = layer === null ? -1 : column.momenta[layer]?.findIndex(p => classification === 'nonfinite-momentum' ? !Number.isFinite(p) : p !== 0) ?? -1;
    const component = classification.includes('volume') && classification !== 'zero-volume-nonzero-momentum' ? 'volume' : found < 0 ? null : found;
    const truncatedPaths: string[] = [];
    const operands = diagnosticValue({ volumes: column.volumes, momenta: column.momenta, ...context.operands?.() }, truncatedPaths) as LayeredFilmFailureDiagnostic['operands'];
    this.diagnostic = { kind: 'layered-film-rejected-stage', reason, classification, stage: context.stage ?? 'column-validation', cell: context.cell ?? null, layer, component, provisional: true,
      complete: truncatedPaths.length === 0, truncatedPaths, operands };
  }
}
export function layerKinetic(column: FilmLayerColumn): number {
  return column.volumes.reduce((sum, v, k) => sum + (v > 0 ? dot(column.momenta[k], column.momenta[k]) / (2 * rho * v) : 0), 0);
}
/** Observation only: preserve small squared momenta until division by mass.
 * The solver continues to use its original kinetic observer and all gates. */
export function observeLayerKineticFactored(column: FilmLayerColumn): number {
  validateLayerColumn(column);
  let total = scaledFilmNumber(0);
  column.volumes.forEach((v, k) => {
    if (v > 0) for (const p of column.momenta[k]) total = scaledFilmSum(total,
      scaledFilmProduct([scaledFilmNumber(p), scaledFilmNumber(p)], [scaledFilmNumber(2), scaledFilmNumber(rho), scaledFilmNumber(v)]));
  });
  return scaledFilmValue(total);
}
/** Range-safe finite-increment chain weight evaluation. Dry auxiliary velocity
 * is zero only for a validated zero-momentum endpoint. The observer retains
 * factors until the final sum, including products that underflow separately. */
export function observeFilmEnergyIncrement(before: FilmLayerColumn, after: FilmLayerColumn, layer: number, dV: number, dP: ContactVec3, area: number, bed: number, gn: number): number {
  validateLayerColumn(before); validateLayerColumn(after);
  let total = scaledFilmNumber(0);
  const term = (values: number[], divisors: number[] = []) => { total = scaledFilmSum(total, scaledFilmProduct(values.map(scaledFilmNumber), divisors.map(scaledFilmNumber))); };
  term([rho, bed, dV]);
  // Add total-depth endpoint contributions separately, avoiding an overflowing
  // intermediate sum before multiplication by a tiny transferred volume.
  for (const v of [...before.volumes, ...after.volumes]) term([rho, gn, v, dV], [2, area]);
  for (let axis = 0; axis < 3; axis++) {
    if (before.volumes[layer] > 0) term([before.momenta[layer][axis], dP[axis]], [2, rho, before.volumes[layer]]);
    if (after.volumes[layer] > 0) term([after.momenta[layer][axis], dP[axis]], [2, rho, after.volumes[layer]]);
    if (before.volumes[layer] > 0 && after.volumes[layer] > 0) term([-1, before.momenta[layer][axis], after.momenta[layer][axis], dV], [2, rho, before.volumes[layer], after.volumes[layer]]);
  }
  return scaledFilmValue(total);
}
export function validateLayerColumn(column: FilmLayerColumn, context: FilmDiagnosticContext = {}): void {
  if (column.volumes.length !== 4 || column.momenta.length !== 4) throw new LayeredFilmStageFailure('layered-film-column-shape', 'malformed-column', column, null, context);
  column.volumes.forEach((v, k) => {
    if (!(v >= 0) || !Number.isFinite(v)) throw new LayeredFilmStageFailure('layered-film-negative-volume', Number.isFinite(v) ? 'negative-volume' : 'nonfinite-volume', column, k, context);
    if (column.momenta[k].length !== 3 || !column.momenta[k].every(Number.isFinite)
      || (v === 0 && column.momenta[k].some(p => p !== 0))) throw new LayeredFilmStageFailure('layered-film-unsupported-momentum', column.momenta[k].length !== 3 ? 'malformed-momentum' : !column.momenta[k].every(Number.isFinite) ? 'nonfinite-momentum' : 'zero-volume-nonzero-momentum', column, k, context);
  });
}
/** Piecewise-constant overlap integration in the column's volume coordinate
 * (equivalent to height at fixed cell area). The final interval ends at total V,
 * retaining every positive tail; no velocity reset or residual energy work. */
export function remapFilmLayers(column: FilmLayerColumn, context: FilmDiagnosticContext = {}): { column: FilmLayerColumn; kineticLossSigned: number } {
  validateLayerColumn(column, { ...context, stage: 'remap-preflight' });
  const total = column.volumes.reduce((a, b) => a + b, 0);
  const edges = [0]; for (const v of column.volumes) edges.push(edges[edges.length - 1] + v);
  const next: FilmLayerColumn = { volumes: [], momenta: [] };
  for (let k = 0; k < 4; k++) {
    const lo = total * k / 4, hi = k === 3 ? total : total * (k + 1) / 4;
    const momentum = zero();
    for (let j = 0; j < 4; j++) {
      const overlap = Math.max(0, Math.min(hi, edges[j + 1]) - Math.max(lo, edges[j]));
      if (overlap > 0) for (let axis = 0; axis < 3; axis++) momentum[axis] += column.momenta[j][axis] * (overlap / column.volumes[j]);
    }
    next.volumes.push(hi - lo); next.momenta.push(momentum);
  }
  validateLayerColumn(next, { ...context, stage: 'remap-output', operands: () => ({ ...context.operands?.(), beforeColumn: column, edges,
    targetEdgesReconstructed: Array.from({ length: 5 }, (_, k) => k === 4 ? total : total * k / 4),
    overlapsReconstructed: Array.from({ length: 4 }, (_, k) => column.volumes.map((_, j) => Math.max(0, Math.min(k === 3 ? total : total * (k + 1) / 4, edges[j + 1]) - Math.max(total * k / 4, edges[j])))),
    momentumContributionsReconstructed: Array.from({ length: 4 }, (_, k) => column.volumes.map((_, j) => {
      const overlap = Math.max(0, Math.min(k === 3 ? total : total * (k + 1) / 4, edges[j + 1]) - Math.max(total * k / 4, edges[j]));
      return overlap > 0 ? column.momenta[j].map(p => p * (overlap / column.volumes[j])) : zero();
    })) }) });
  return { column: next, kineticLossSigned: layerKinetic(column) - layerKinetic(next) };
}
interface ScaledFilmNumber { mantissa: number; exponent: number }
export const KINETIC_EXACT_IMPACT_MODEL = 'kinetic-exact-v1' as const;
export type FirstImpactModel = 'hydraulic-be-v1' | typeof KINETIC_EXACT_IMPACT_MODEL;
function scaledFilmNumber(value: number): ScaledFilmNumber {
  if (value === 0) return { mantissa: value, exponent: 0 };
  let exponent = Math.floor(Math.log2(Math.abs(value)));
  if (exponent < -1022) {
    const raised = value * 2 ** 1022;
    exponent = Math.floor(Math.log2(Math.abs(raised)));
    return { mantissa: raised / 2 ** exponent, exponent: exponent - 1022 };
  }
  exponent = Math.min(1023, exponent);
  return { mantissa: value / 2 ** exponent, exponent };
}
function scaledFilmProduct(values: ScaledFilmNumber[], divisors: ScaledFilmNumber[] = []): ScaledFilmNumber {
  let mantissa = 1, exponent = 0;
  for (const value of values) { mantissa *= value.mantissa; exponent += value.exponent; const n = scaledFilmNumber(mantissa); mantissa = n.mantissa; exponent += n.exponent; }
  for (const value of divisors) { mantissa /= value.mantissa; exponent -= value.exponent; const n = scaledFilmNumber(mantissa); mantissa = n.mantissa; exponent += n.exponent; }
  return { mantissa, exponent };
}
function scaledFilmValue(value: ScaledFilmNumber): number {
  if (value.mantissa === 0) return value.mantissa;
  if (value.exponent < -1075) return value.mantissa < 0 ? -0 : 0;
  if (value.exponent < -1022) return (value.mantissa * 2 ** (value.exponent + 1074)) * Number.MIN_VALUE;
  if (value.exponent > 1023) return value.mantissa < 0 ? -Infinity : Infinity;
  return value.mantissa * 2 ** value.exponent;
}
function scaledFilmSum(a: ScaledFilmNumber, b: ScaledFilmNumber): ScaledFilmNumber {
  if (a.mantissa === 0) return b;
  if (b.mantissa === 0) return a;
  const exponent = Math.max(a.exponent, b.exponent);
  const n = scaledFilmNumber(a.mantissa * 2 ** (a.exponent - exponent) + b.mantissa * 2 ** (b.exponent - exponent));
  return { mantissa: n.mantissa, exponent: exponent + n.exponent };
}
/** The same physical backward-Euler stress balance, divided by a common scale
 * before conductance is formed. Vref=max(Vk), rk=Vk/Vref and mref=rho Vref.
 * L has wall coefficient2/r0, interfaces2/(r[k-1]+rk), and zero top stress.
 * With alpha=rho Vref²/(rho Vref²+mu dt A²), beta=1-alpha, solve
 * (alpha diag(r)+beta L)q=P*. Then P'=alpha r q and Jwall=-beta a0 q0.
 * The solve additionally normalizes P* by its largest component. Alpha stays
 * factored in binary exponents, so alpha*q and traction do not disappear merely
 * because alpha alone is below binary64 range. Actual unequal Vk are retained.
 * Final results below binary64 range still round to zero; no volume is deleted,
 * and no velocity reset, mass floor or inferred residual work is applied.
 */
export function diffuseFilmLayers(column: FilmLayerColumn, area: number, dt: number, context: FilmDiagnosticContext = {}) {
  validateLayerColumn(column, { ...context, stage: 'diffusion-preflight', operands: () => ({ ...context.operands?.(), area, dt }) });
  if (!(area > 0 && dt >= 0) || ![area, dt].every(Number.isFinite)) throw Error('layered-film-viscosity-clock');
  if (dt === 0 || column.volumes.every(v => v === 0)) return { column: structuredClone(column), wallImpulse: zero(), viscousLoss: 0, temporalLoss: 0, wallWork: 0 as const, momentumUnderflowComponents: 0, firstMomentumUnderflow: null, lossUnderflow: { viscous: null, temporal: null } };
  if (column.volumes.some(v => v === 0)) throw Error('layered-film-viscosity-unremapped-column');
  const Vref = Math.max(...column.volumes), r = column.volumes.map(v => v / Vref);
  const massScale = scaledFilmProduct([scaledFilmNumber(rho), scaledFilmNumber(Vref)]);
  const inertial = scaledFilmProduct([scaledFilmNumber(rho), scaledFilmNumber(Vref), scaledFilmNumber(Vref)]);
  const viscous = scaledFilmProduct([scaledFilmNumber(FILM_DYNAMIC_VISCOSITY), scaledFilmNumber(dt), scaledFilmNumber(area), scaledFilmNumber(area)]);
  const total = scaledFilmSum(inertial, viscous);
  const alpha = scaledFilmProduct([inertial], [total]), beta = scaledFilmProduct([viscous], [total]);
  const alphaValue = scaledFilmValue(alpha), betaValue = scaledFilmValue(beta);
  const a = [2 / r[0], ...r.slice(1).map((v, k) => 2 / (r[k] + v)), 0];
  const Pscale = Math.max(...column.momenta.flat().map(Math.abs)) || 1;
  const lower = r.map((_, k) => k ? -betaValue * a[k] : 0), upper = r.map((_, k) => k < 3 ? -betaValue * a[k + 1] : 0);
  const diagonal = r.map((v, k) => alphaValue * v + betaValue * (a[k] + a[k + 1]));
  const rhs = column.momenta.map(p => p.map(v => v / Pscale) as ContactVec3);
  let failureStage = diagonal.every(Number.isFinite) && a.every(Number.isFinite) && r.every(v => v > 0) ? 'diffusion-scaled-output' : 'diffusion-scaled-assembled';
  let failedElimination: Record<string, unknown> | null = null;
  for (let k = 1; k < 4; k++) {
    const ratio = lower[k] / diagonal[k - 1]; diagonal[k] -= ratio * upper[k - 1];
    for (let axis = 0; axis < 3; axis++) rhs[k][axis] -= ratio * rhs[k - 1][axis];
    if (failureStage === 'diffusion-scaled-output' && (!Number.isFinite(ratio) || !Number.isFinite(diagonal[k]) || !rhs[k].every(Number.isFinite))) {
      failureStage = 'diffusion-scaled-elimination'; failedElimination = { row: k, pivot: diagonal[k - 1], ratio, diagonal: diagonal[k], rhs: rhs[k] };
    }
  }
  const q = Array.from({ length: 4 }, zero);
  for (let k = 3; k >= 0; k--) for (let axis = 0; axis < 3; axis++) q[k][axis] = (rhs[k][axis] - (k < 3 ? upper[k] * q[k + 1][axis] : 0)) / diagonal[k];
  const evaluate = (values: number[], factors: ScaledFilmNumber[] = [], divisors: ScaledFilmNumber[] = []) => scaledFilmValue(scaledFilmProduct([...values.map(scaledFilmNumber), ...factors], divisors));
  const next = { volumes: [...column.volumes], momenta: q.map((row, k) => row.map(v => evaluate([Pscale, r[k], v], [alpha])) as ContactVec3) };
  const operands = () => ({ ...context.operands?.(), beforeColumn: column, area, dt, rho, mu: FILM_DYNAMIC_VISCOSITY, Vref, r, massScale, inertial, viscous, alpha, beta, a, Pscale, lower, upper,
    initialDiagonalReconstructed: r.map((v, k) => alphaValue * v + betaValue * (a[k] + a[k + 1])), originalRhs: column.momenta.map(p => p.map(v => v / Pscale)), eliminatedDiagonal: diagonal, rhs, failedElimination, q,
    divisionOperandsReconstructed: q.map((_, k) => rhs[k].map((v, axis) => ({ numerator: v - (k < 3 ? upper[k] * q[k + 1][axis] : 0), denominator: diagonal[k] }))) });
  validateLayerColumn(next, { ...context, stage: failureStage, operands });
  const wallImpulse = q[0].map(v => -evaluate([Pscale, a[0], v], [beta])) as ContactVec3;
  let viscousLossScaled = scaledFilmNumber(0), temporalLossScaled = scaledFilmNumber(0), momentumUnderflowComponents = 0;
  let firstMomentumUnderflow: { layer: number; component: number; momentumFactored: ScaledFilmNumber; velocityFactored: ScaledFilmNumber } | null = null;
  for (let k = 0; k < 4; k++) for (let axis = 0; axis < 3; axis++) {
    const shear = k ? q[k][axis] - q[k - 1][axis] : q[0][axis];
    viscousLossScaled = scaledFilmSum(viscousLossScaled, scaledFilmProduct([Pscale, Pscale, a[k], shear, shear].map(scaledFilmNumber).concat([alpha, beta]), [massScale]));
    // The BE velocity change is the actual local stress impulse from this same
    // equation. Subtracting rounded P' from P* could erase a representable loss
    // when weak stress leaves both stored momenta at the same binary64 value.
    const localStress = a[k] * shear + (k < 3 ? a[k + 1] * (q[k][axis] - q[k + 1][axis]) : 0);
    temporalLossScaled = scaledFilmSum(temporalLossScaled, scaledFilmProduct([Pscale, Pscale, localStress, localStress].map(scaledFilmNumber).concat([beta, beta]), [scaledFilmNumber(2), scaledFilmNumber(rho), scaledFilmNumber(column.volumes[k])]));
    if (next.momenta[k][axis] === 0 && q[k][axis] !== 0) {
      momentumUnderflowComponents++;
      if (!firstMomentumUnderflow) {
        const momentumFactored = scaledFilmProduct([scaledFilmNumber(Pscale), alpha, scaledFilmNumber(r[k]), scaledFilmNumber(q[k][axis])]);
        firstMomentumUnderflow = { layer: k, component: axis, momentumFactored, velocityFactored: scaledFilmProduct([momentumFactored], [scaledFilmNumber(rho), scaledFilmNumber(column.volumes[k])]) };
      }
    }
  }
  // Accumulate before the single final rounding: individually rounding tiny
  // loss terms can erase a representable total (including this captured tail).
  const viscousLoss = scaledFilmValue(viscousLossScaled), temporalLoss = scaledFilmValue(temporalLossScaled);
  if (![viscousLoss, temporalLoss, ...wallImpulse].every(Number.isFinite)) throw new LayeredFilmStageFailure('layered-film-nonfinite-stress', 'nonfinite-stress', next, null, { ...context, stage: failureStage, operands: () => ({ ...operands(), viscousLoss, temporalLoss, wallImpulse }) });
  const lossUnderflow = { viscous: viscousLoss === 0 && viscousLossScaled.mantissa !== 0 ? viscousLossScaled : null, temporal: temporalLoss === 0 && temporalLossScaled.mantissa !== 0 ? temporalLossScaled : null };
  // These stresses reconstruct the solved equation from its own factored
  // operands. They are observations, not extra applied momentum operations.
  if(context.observeDiffusion)try {
    const internalImpulses=[1,2,3].map(k=>({lower:k-1,upper:k,onLower:q[k].map((v,axis)=>evaluate([Pscale,a[k],v-q[k-1][axis]],[beta]))}));
    context.observeDiffusion({...operands(),wallImpulse,internalImpulses,stressQualification:'read-only reconstruction of solved equation',momentumUnderflowComponents,firstMomentumUnderflow,lossUnderflow});
  }catch(error){try{context.observeDiffusion({observationError:error instanceof Error?error.message:String(error)});}catch{/* Observation must not change the physical solve. */}}
  return { column: next, wallImpulse, viscousLoss, temporalLoss, wallWork: 0 as const, momentumUnderflowComponents, firstMomentumUnderflow, lossUnderflow };
}

/** Exact frozen actual-mass viscosity, with the same wall/interface stresses.
 * This changes time integration only. Full-cell wet area remains unqualified.
 * Modal decay, dissipation and wall traction retain binary scaling until final
 * storage; vanished momentum is reported with its factored value, never reset
 * by a velocity threshold. Unsupported eigensystem/range rejects the step. */
export function diffuseFilmLayersExact(column:FilmLayerColumn,area:number,dt:number,context:FilmDiagnosticContext={}) {
  const failure=(reason:string,operands:Record<string,unknown>={})=>new LayeredFilmStageFailure(reason,'exact-viscosity-failure',column,null,{...context,stage:reason,operands:()=>({...context.operands?.(),area,dt,rho,mu:FILM_DYNAMIC_VISCOSITY,...operands})});
  validateLayerColumn(column,context);
  if(!(area>0&&dt>=0)||![area,dt].every(Number.isFinite))throw Error('layered-film-viscosity-clock');
  if(dt===0||column.volumes.every(v=>v===0))return {...diffuseFilmLayers(column,area,dt,context),exact:undefined};
  if(column.volumes.some(v=>v===0))throw Error('layered-film-viscosity-unremapped-column');
  const Vref=Math.max(...column.volumes),r=column.volumes.map(v=>v/Vref),roots=r.map(Math.sqrt);
  const a=[2/r[0],...r.slice(1).map((v,k)=>2/(r[k]+v)),0];
  const B=r.map((v,i)=>r.map((_,j)=>i===j?(a[i]+a[i+1])/v:j===i+1?-a[j]/(roots[i]*roots[j]):i===j+1?-a[i]/(roots[i]*roots[j]):0));
  if(!B.flat().every(Number.isFinite)||r.some(v=>!(v>0)))throw failure('exact-viscosity-unsupported-mass-range',{Vref,r,a,B});
  const original=B.map(row=>[...row]),Q:number[][]=B.map((_,i)=>B.map((_,j)=>i===j?1:0)),scale=Math.max(...B.flat().map(Math.abs));
  // Fixed work bound and fixed scale-relative verification; no eigenvalue fit.
  for(let iteration=0;iteration<128;iteration++){
    let p=0,q=1;for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(Math.abs(B[i][j])>Math.abs(B[p][q])){p=i;q=j;}
    if(Math.abs(B[p][q])<=2e-15*scale)break;
    const theta=.5*Math.atan2(2*B[p][q],B[q][q]-B[p][p]),c=Math.cos(theta),s=Math.sin(theta),pp=B[p][p],qq=B[q][q],pq=B[p][q];
    for(let k=0;k<4;k++)if(k!==p&&k!==q){const kp=B[k][p],kq=B[k][q];B[k][p]=B[p][k]=c*kp-s*kq;B[k][q]=B[q][k]=s*kp+c*kq;}
    B[p][p]=c*c*pp-2*s*c*pq+s*s*qq;B[q][q]=s*s*pp+2*s*c*pq+c*c*qq;B[p][q]=B[q][p]=0;
    for(let k=0;k<4;k++){const kp=Q[k][p],kq=Q[k][q];Q[k][p]=c*kp-s*kq;Q[k][q]=s*kp+c*kq;}
  }
  const lambda=B.map((row,k)=>row[k]);let orthogonality=0,residual=0;
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){orthogonality=Math.max(orthogonality,Math.abs(Q.reduce((s,row)=>s+row[i]*row[j],0)-(i===j?1:0)));residual=Math.max(residual,Math.abs(original[i].reduce((s,v,k)=>s+v*Q[k][j],0)-Q[i][j]*lambda[j])/scale);}
  if(lambda.some(v=>!(v>0)||!Number.isFinite(v))||orthogonality>1e-12||residual>1e-12)throw failure('exact-viscosity-eigensystem',{Vref,r,a,original,Q,lambda,orthogonality,residual});
  const kappa=scaledFilmProduct([FILM_DYNAMIC_VISCOSITY,dt,area,area].map(scaledFilmNumber),[rho,Vref,Vref].map(scaledFilmNumber));
  const Pscale=Math.max(...column.momenta.flat().map(Math.abs))||1;
  const y=lambda.map((_,j)=>[0,1,2].map(axis=>Q.reduce((s,row,k)=>s+row[j]*(column.momenta[k][axis]/Pscale)/roots[k],0)));
  if(!y.flat().every(Number.isFinite))throw failure('exact-viscosity-modal-range',{Vref,r,Q,lambda,kappa,Pscale,y});
  const x=lambda.map(l=>scaledFilmValue(scaledFilmProduct([scaledFilmNumber(l),kappa])));
  // A 2^-4096 bound, multiplied by any two finite modal/input factors,
  // remains below storage range. This branch proves rounded storage zero;
  // it does not call the nonzero mathematical tail physically zero.
  const decayUpperBound=x.map(v=>v>4096*Math.LN2?{mantissa:1,exponent:-4096}:null);
  const decay=x.map((v,j)=>{if(decayUpperBound[j])return scaledFilmNumber(0);const exponent=Math.floor(-v/Math.LN2);return {mantissa:Math.exp(-v-exponent*Math.LN2),exponent};});
  const integral=lambda.map((l,j)=>x[j]<.5?scaledFilmProduct([kappa,scaledFilmNumber(x[j]===0?1:-Math.expm1(-x[j])/x[j])]):scaledFilmNumber(-Math.expm1(-x[j])/l));
  const loss=lambda.map((l,j)=>x[j]<.5?scaledFilmProduct([kappa,scaledFilmNumber(2*l),scaledFilmNumber(x[j]===0?1:-Math.expm1(-2*x[j])/(2*x[j]))]):scaledFilmNumber(-Math.expm1(-2*x[j])));
  let dissipation=scaledFilmNumber(0),momentumUnderflowComponents=0;
  let firstMomentumUnderflow:{layer:number;component:number;momentumFactored:ScaledFilmNumber;velocityFactored:ScaledFilmNumber;qualification:'evaluated-tail'|'absolute-tail-upper-bound'}|null=null;
  const next:FilmLayerColumn={volumes:[...column.volumes],momenta:column.momenta.map(()=>zero())};
  const momentumFactored:ScaledFilmNumber[][]=column.momenta.map(()=>[]);
  const momentumAbsoluteUpperBoundFactored:ScaledFilmNumber[][]=column.momenta.map(()=>[]);
  for(let k=0;k<4;k++)for(let axis=0;axis<3;axis++){
    let value=scaledFilmNumber(0);
    // Small changes add modal expm1 increments to the original stored P,
    // avoiding spurious identity reconstruction error in weak-stress regimes.
    if(Math.max(...x)<.5){value=scaledFilmNumber(column.momenta[k][axis]);for(let j=0;j<4;j++)value=scaledFilmSum(value,scaledFilmProduct([Pscale,roots[k],Q[k][j],y[j][axis],-lambda[j]].map(scaledFilmNumber).concat([integral[j]])));}
    else for(let j=0;j<4;j++)value=scaledFilmSum(value,scaledFilmProduct([Pscale,roots[k],Q[k][j],y[j][axis]].map(scaledFilmNumber).concat([decay[j]])));
    next.momenta[k][axis]=scaledFilmValue(value);
    momentumFactored[k][axis]=value;
    let upper=scaledFilmNumber(0);for(let j=0;j<4;j++)upper=scaledFilmSum(upper,scaledFilmProduct([Pscale,roots[k],Math.abs(Q[k][j]),Math.abs(y[j][axis])].map(scaledFilmNumber).concat([decayUpperBound[j]??decay[j]])));
    momentumAbsoluteUpperBoundFactored[k][axis]=upper;
    if(next.momenta[k][axis]===0&&upper.mantissa!==0){momentumUnderflowComponents++;const retained=value.mantissa!==0?value:upper;firstMomentumUnderflow??={layer:k,component:axis,momentumFactored:retained,velocityFactored:scaledFilmProduct([retained],[rho,column.volumes[k]].map(scaledFilmNumber)),qualification:value.mantissa!==0?'evaluated-tail':'absolute-tail-upper-bound'};}
  }
  for(let j=0;j<4;j++)for(let axis=0;axis<3;axis++)dissipation=scaledFilmSum(dissipation,scaledFilmProduct([.5,Pscale,Pscale,y[j][axis],y[j][axis]].map(scaledFilmNumber).concat([loss[j]]),[rho,Vref].map(scaledFilmNumber)));
  const wallImpulse=[0,1,2].map(axis=>{let sum=scaledFilmNumber(0);for(let j=0;j<4;j++)sum=scaledFilmSum(sum,scaledFilmProduct([-Pscale,a[0]/roots[0],Q[0][j],y[j][axis]].map(scaledFilmNumber).concat([integral[j]])));return scaledFilmValue(sum);}) as ContactVec3;
  let finalKineticFactored=scaledFilmNumber(0);
  let finalKineticAbsoluteUpperBoundFactored=scaledFilmNumber(0);
  for(let j=0;j<4;j++)for(let axis=0;axis<3;axis++)finalKineticFactored=scaledFilmSum(finalKineticFactored,scaledFilmProduct([.5,Pscale,Pscale,y[j][axis],y[j][axis]].map(scaledFilmNumber).concat([decay[j],decay[j]]),[rho,Vref].map(scaledFilmNumber)));
  for(let j=0;j<4;j++)for(let axis=0;axis<3;axis++){const upper=decayUpperBound[j]??decay[j];finalKineticAbsoluteUpperBoundFactored=scaledFilmSum(finalKineticAbsoluteUpperBoundFactored,scaledFilmProduct([.5,Pscale,Pscale,y[j][axis],y[j][axis]].map(scaledFilmNumber).concat([upper,upper]),[rho,Vref].map(scaledFilmNumber)));}
  const momentumBalanceResidual=[0,1,2].map(axis=>next.momenta.reduce((s,p,k)=>s+p[axis]-column.momenta[k][axis],0)-wallImpulse[axis]);
  const momentumBalanceTolerance=1e-10*(column.momenta.flat().reduce((s,v)=>s+Math.abs(v),0)+next.momenta.flat().reduce((s,v)=>s+Math.abs(v),0)+wallImpulse.reduce((s,v)=>s+Math.abs(v),0));
  if(momentumBalanceResidual.some(v=>!Number.isFinite(v)||Math.abs(v)>momentumBalanceTolerance))throw failure('exact-viscosity-evaluation-momentum',{next,wallImpulse,momentumBalanceResidual,momentumBalanceTolerance});
  validateLayerColumn(next,context);const viscousLoss=scaledFilmValue(dissipation),evaluationLossSigned=observeLayerKineticFactored(column)-observeLayerKineticFactored(next)-viscousLoss;
  const evaluationTolerance=1e-10*(observeLayerKineticFactored(column)+observeLayerKineticFactored(next)+viscousLoss);
  if(![viscousLoss,evaluationLossSigned,evaluationTolerance,...wallImpulse].every(Number.isFinite)||Math.abs(evaluationLossSigned)>evaluationTolerance)throw failure('exact-viscosity-evaluation-energy',{next,viscousLoss,evaluationLossSigned,evaluationTolerance,wallImpulse,lambda,kappa,x});
  const details={Vref,r,a,Q,lambda,kappa,x,orthogonality,residual,modalAmplitudes:y,Pscale,decay,decayUpperBound,integral,wallImpulse,viscousLoss,evaluationLossSigned,evaluationTolerance,momentumUnderflowComponents,firstMomentumUnderflow,momentumFactored,momentumAbsoluteUpperBoundFactored,finalKineticFactored,finalKineticAbsoluteUpperBoundFactored,momentumBalanceResidual,momentumBalanceTolerance,outputUnderflowBound:momentumAbsoluteUpperBoundFactored.map(row=>row.map(v=>scaledFilmValue(v)===0&&v.mantissa!==0?{absoluteTailUpperBoundFactored:v,absoluteRoundingErrorUpperBoundFactored:{mantissa:.5,exponent:-1074}}:null))};
  if(context.observeDiffusion)try{context.observeDiffusion(details);}catch{/* Observation never changes the physical subflow. */}
  return {column:next,wallImpulse,viscousLoss,temporalLoss:0,wallWork:0 as const,momentumUnderflowComponents,firstMomentumUnderflow,lossUnderflow:{viscous:viscousLoss===0&&dissipation.mantissa!==0?dissipation:null,temporal:null},exact:details};
}


/** At equal-height sigma faces, each layer has 1/4 of total hydrostatic
 * pressure. One signal bounds all layers and the total-depth gravity wave.
 * Energy flux is the centered physical hydrostatic flux minus Rusanov's
 * explicit energy jump, rather than physical work inferred from a residual. */
export function filmLayerFaceFlux(left: FilmLayerColumn, right: FilmLayerColumn, leftArea: number, rightArea: number, normal: ContactVec3, gn: number, bedPotential: number, context: { left?: FilmDiagnosticContext; right?: FilmDiagnosticContext } = {}) {
  validateLayerColumn(left, { ...context.left, stage: 'face-preflight' }); validateLayerColumn(right, { ...context.right, stage: 'face-preflight' });
  const H = [left, right].map((c, i) => c.volumes.reduce((a, b) => a + b, 0) / (i ? rightArea : leftArea));
  const velocity = [left, right].map(c => c.volumes.map((v, k) => v > 0 ? c.momenta[k].map(p => p / (rho * v)) as ContactVec3 : zero()));
  const a = Math.max(...velocity.flatMap(us => us.map(u => Math.abs(dot(u, normal))))) + Math.sqrt(gn * Math.max(...H));
  const physicalEnergy = [left, right].map((c, side) => c.volumes.reduce((s, v, k) => s + rho * v / (side ? rightArea : leftArea) * dot(velocity[side][k], normal) * (.5 * dot(velocity[side][k], velocity[side][k]) + bedPotential + gn * H[side]), 0));
  const energyDensity = [left, right].map((c, side) => layerKinetic(c) / (side ? rightArea : leftArea) + rho * (bedPotential * H[side] + .5 * gn * H[side] ** 2));
  const layers = left.volumes.map((_, k) => {
    const hl = left.volumes[k] / leftArea, hr = right.volumes[k] / rightArea;
    const ul = dot(velocity[0][k], normal), ur = dot(velocity[1][k], normal);
    const volumeFlux = .5 * (hl * ul + hr * ur) - .5 * a * (hr - hl);
    const advective = velocity[0][k].map((v, axis) => .5 * rho * (hl * ul * v + hr * ur * velocity[1][k][axis])) as ContactVec3;
    const pressure = normal.map(v => .25 * .25 * rho * gn * (H[0] ** 2 + H[1] ** 2) * v) as ContactVec3;
    const numerical = velocity[0][k].map((v, axis) => -.5 * a * rho * (hr * velocity[1][k][axis] - hl * v)) as ContactVec3;
    return { volumeFlux, centralVolumeFlux: .5 * (hl * ul + hr * ur), numericalVolumeFlux: -.5 * a * (hr - hl), advective, pressure, numerical, momentumFlux: advective.map((v, axis) => v + pressure[axis] + numerical[axis]) as ContactVec3, donorVelocity: velocity[volumeFlux >= 0 ? 0 : 1][k] };
  });
  return { layers, signal: a, energyFlux: .5 * (physicalEnergy[0] + physicalEnergy[1]) - .5 * a * (energyDensity[1] - energyDensity[0]), numericalEnergyFlux: -.5 * a * (energyDensity[1] - energyDensity[0]) };
}
