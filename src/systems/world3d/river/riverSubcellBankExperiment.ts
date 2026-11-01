/**
 * A bounded numerical preparation slice for the fixed native bank experiment.
 * It preserves each subcell's volume and physical horizontal momentum, shares
 * one native-family HLL flux per face, and commits only a complete valid update.
 * Actual frozen drawn-bed integration must be supplied by the geometry owner;
 * these contracts do not turn sampled scalar bottoms into exact terrain.
 * No station, production solver, capture, pulse or drain is connected here.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/10/2026, 08:49:50
 * Dependents: systems/world3d/river/riverBankCavityExperiment.ts, systems/world3d/river/riverTerrainBankGeometry.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { G } from './riverSolver';

export const BANK_LIMITS = Object.freeze({ cells: 16384, faces: 33024, faceNodes: 32 });
export interface BankCellMeasure {
  readonly etaM: number;
  readonly representedVolumeM3: number;
  /** Integral of b*h + h²/2 over plan area, not the coarse bed times volume. */
  readonly potentialIntegralM4: number;
  readonly depthSquaredIntegralM4: number;
  readonly wetAreaM2: number;
  readonly volumeErrorM3: number;
  readonly potentialErrorM4: number;
  readonly basinResolved: true;
}
export interface BankCellGeometry {
  readonly id: number;
  readonly areaM2: number;
  /** Bounded inversion of the certified static volume/level integral. The
   * provider must reject unresolved basins and enforce its own fixed work cap.
   */
  readonly measureVolume: (volumeM3: number) => BankCellMeasure;
}
export interface BankFaceNode {
  readonly weightM: number;
  readonly bedLeftM: number;
  readonly bedRightM: number;
  readonly depthLeftM: number;
  readonly depthRightM: number;
}
export interface BankFaceMeasure {
  readonly nodes: readonly BankFaceNode[];
  readonly lengthErrorM: number;
  readonly depthErrorM: number;
  /** Declared quadrature uncertainty, not a claim of exact HLL integration. */
  readonly fluxVolumeErrorM3S: number;
  readonly fluxMomentumErrorN: number;
}
export interface BankFaceGeometry {
  readonly id: number;
  readonly left: number;
  /** Null is a closed reflecting wall in this preparation slice. */
  readonly right: number | null;
  readonly nx: number;
  readonly nz: number;
  readonly lengthM: number;
  readonly normalSpacingM: number;
  readonly measureFace: (etaLeftM: number, etaRightM: number) => BankFaceMeasure;
}
export interface BankGeometry {
  readonly geometryId: string;
  readonly method: string;
  readonly sourceHashes: Readonly<Record<string, string>>;
  readonly singleValuedBed: true;
  /** New terrain adapters may execute a diagnostic quadrature without claiming
   * a certified HLL integration-error bound. Keep that limit on the receipt. */
  readonly faceQuadratureStatus?: 'UNQUALIFIED';
  readonly cells: readonly BankCellGeometry[];
  /** Each unique face once, including every closed boundary face. The provider
   * certifies actual footprint coverage; normal closure alone cannot prove it.
   */
  readonly faces: readonly BankFaceGeometry[];
}
export interface BankState {
  readonly runId: string;
  readonly geometryId: string;
  readonly revision: number;
  readonly stateId: string;
  readonly timeS: number;
  readonly volumeM3: readonly number[];
  /** Physical kg m/s; captured hu/hv become rho * parent area * hu/hv. */
  readonly pxKgMS: readonly number[];
  readonly pzKgMS: readonly number[];
}
export interface BankCellResponse {
  readonly cellId: number;
  readonly volumeM3: number;
  readonly wetAreaM2: number;
  readonly grossOutflowM3S: number;
  readonly grossIncomingM3S: number;
  readonly faceWaveResponseM2S: number;
  readonly faceVolumeResponseM3S: number;
  readonly wetAreaBoundS: number;
  readonly volumeResponseBoundS: number;
  readonly outflowBoundS: number;
}
export interface BankTimestepContext {
  readonly requestedDtS: number;
  readonly cells: readonly BankCellResponse[];
  readonly rawVolumeBoundS: number;
  readonly diagnosticBoundS: number;
}
/** The owner freezes the generalized storage/face response rule before a run. */
export type BankTimestepPolicy = (context: BankTimestepContext) => number;
export interface BankFaceLedger {
  readonly faceId: number;
  readonly left: number;
  readonly right: number | null;
  readonly signedVolumeM3: number;
  readonly hllPxKgMS: number;
  readonly hllPzKgMS: number;
  readonly correctionLeft: readonly [number, number];
  readonly correctionRight: readonly [number, number];
  readonly bedReactionLeft: readonly [number, number];
  readonly bedReactionRight: readonly [number, number];
}
export interface BankTransaction {
  readonly before: BankState;
  readonly after: BankState;
  readonly dtS: number;
  readonly timestep: BankTimestepContext;
  readonly transfers: readonly BankFaceLedger[];
  readonly potentialChangeJ: number;
  readonly kineticChangeJ: number;
  readonly volumeIntegrationErrorM3: number;
  readonly potentialIntegrationErrorJ: number;
  readonly faceVolumeTransferErrorM3: number;
  readonly faceMomentumTransferErrorKgMS: number;
  readonly energyStatus: 'ENERGY_UNKNOWN';
  readonly faceQuadratureStatus: 'DECLARED' | 'UNQUALIFIED';
  /** A certified corner interval replaces only its shrinking donor restriction.
   * Other owners retain their ordinary diagnostic bounds. This is not a general
   * stability proof or permission to bypass the ordinary bounds elsewhere. */
  readonly cornerEvent?: {
    readonly donor: number;
    readonly receiver: number;
    readonly terminal: boolean;
    readonly deltaBeforeM: number;
    readonly deltaAfterM: number;
    readonly sharedVolumeM3: number;
    readonly pressureImpulseKgMS: readonly [number, number];
    readonly receiverMaximumLevelM: number;
    readonly edgeMinimumM: number;
    readonly receiverIntegration: 'EXPLICIT_FIRST_ORDER';
  };
}
export type BankPreparation = { readonly ok: true; readonly transaction: BankTransaction }
  | { readonly ok: false; readonly reason: string; readonly state: BankState };

const finite = (x: number) => Number.isFinite(x);
function requireBank(ok: boolean, reason: string): asserts ok { if (!ok) throw new Error(reason); }

/** Same Davis/Toro wave and upwind tangent formulas as riverSolver's private HLL.
 * Only exactly zero point depth is dry here: no native display/dry cutoff.
 */
export function bankHll(hL: number, uL: number, vL: number, hR: number, uR: number, vR: number) {
  requireBank([hL, uL, vL, hR, uR, vR].every(finite) && hL >= 0 && hR >= 0, 'Invalid HLL point state');
  // A partly wet owner carries one velocity, but its dry face samples contain
  // no water or waves. Do not charge their dry length against the tiny wet area.
  // This exact-zero case neither discards thin water nor changes wet fluxes.
  if (hL === 0 && hR === 0) return { mass: 0, normal: 0, tangent: 0, speed: 0 };
  // Equal states have the physical flux exactly. Evaluating the two-wave
  // quotient instead adds rounding forces at a motionless reflecting wall.
  // Preserve zero transverse momentum structurally before testing a one-way
  // drying event; do not erase a small momentum after it has been generated.
  if (hL === hR && uL === uR && vL === vR) {
    const mass = hL * uL;
    return { mass, normal: mass * uL + G * hL ** 2 / 2,
      tangent: mass * vL, speed: Math.abs(uL) + Math.sqrt(G * hL) };
  }
  const cL = Math.sqrt(G * hL), cR = Math.sqrt(G * hR);
  let sL: number, sR: number;
  if (hL === 0) { sL = uR - 2 * cR; sR = uR + cR; }
  else if (hR === 0) { sL = uL - cL; sR = uL + 2 * cL; }
  else { sL = Math.min(uL - cL, uR - cR); sR = Math.max(uL + cL, uR + cR); }
  const qL = hL * uL, qR = hR * uR;
  const pL = qL * uL + G * hL ** 2 / 2, pR = qR * uR + G * hR ** 2 / 2;
  let mass: number, normal: number;
  if (sL >= 0) { mass = qL; normal = pL; }
  else if (sR <= 0) { mass = qR; normal = pR; }
  else {
    mass = (sR * qL - sL * qR + sL * sR * (hR - hL)) / (sR - sL);
    normal = (sR * pL - sL * pR + sL * sR * (qR - qL)) / (sR - sL);
  }
  const tangent = mass > 0 ? mass * vL : mass * vR;
  requireBank([mass, normal, tangent].every(finite), 'Nonfinite HLL flux');
  return { mass, normal, tangent, speed: Math.max(Math.abs(sL), Math.abs(sR)) };
}

export function createBankState(runId: string, geometryId: string, volumeM3: readonly number[], pxKgMS: readonly number[], pzKgMS: readonly number[], revision = 0, timeS = 0): BankState {
  requireBank(runId.length > 0 && geometryId.length > 0 && Number.isSafeInteger(revision) && revision >= 0 && finite(timeS) && timeS >= 0, 'Invalid state identity');
  requireBank(volumeM3.length > 0 && volumeM3.length <= BANK_LIMITS.cells && pxKgMS.length === volumeM3.length && pzKgMS.length === volumeM3.length, 'Invalid state lengths');
  for (let i = 0; i < volumeM3.length; i++) {
    const v = volumeM3[i];
    requireBank(finite(v) && v >= 0 && finite(pxKgMS[i]) && finite(pzKgMS[i]) && (v > 0 || (pxKgMS[i] === 0 && pzKgMS[i] === 0)), 'Invalid raw inventory/momentum');
  }
  return Object.freeze({ runId, geometryId, revision, stateId: `${runId}:${geometryId}:${revision}`, timeS,
    volumeM3: Object.freeze([...volumeM3]), pxKgMS: Object.freeze([...pxKgMS]), pzKgMS: Object.freeze([...pzKgMS]) });
}
function measure(cell: BankCellGeometry, volume: number) {
  const m = cell.measureVolume(volume);
  requireBank(m.basinResolved === true && [m.etaM, m.representedVolumeM3, m.potentialIntegralM4, m.depthSquaredIntegralM4, m.wetAreaM2, m.volumeErrorM3, m.potentialErrorM4].every(finite), 'Unavailable geometry integral');
  requireBank(m.representedVolumeM3 >= 0 && m.wetAreaM2 >= 0 && m.wetAreaM2 <= cell.areaM2 && m.volumeErrorM3 >= 0 && m.potentialErrorM4 >= 0 && m.depthSquaredIntegralM4 >= 0, 'Invalid geometry measure');
  requireBank(Math.abs(m.representedVolumeM3 - volume) <= m.volumeErrorM3 && (volume === 0 ? m.wetAreaM2 === 0 && m.potentialIntegralM4 === 0 : m.wetAreaM2 > 0), 'Geometry/storage mismatch');
  return m;
}

/** Computes all face transfers and matched reactions without touching state.
 * The physical source is H+C+B. B already contains internal bed-jump reaction;
 * no extra jump source is added. All failures discard the entire transaction.
 */
export function prepareBankTransaction(geometry: BankGeometry, state: BankState, rhoKgM3: number, requestedDtS: number, timestepPolicy: BankTimestepPolicy): BankPreparation {
  try {
    // Structural callers receive the same raw-state validation as constructors;
    // dry momentum must never disappear behind the zero-volume velocity branch.
    requireBank(Number.isSafeInteger(state.revision) && state.revision >= 0 && finite(state.timeS) && state.timeS >= 0, 'Invalid structural state identity');
    const validated = createBankState(state.runId, state.geometryId, state.volumeM3, state.pxKgMS, state.pzKgMS, state.revision, state.timeS);
    requireBank(state.stateId === validated.stateId, 'Invalid committed state identity');
    requireBank(geometry.geometryId === state.geometryId && geometry.singleValuedBed === true && geometry.method.length > 0 && Object.keys(geometry.sourceHashes).length > 0, 'Geometry provenance mismatch');
    const count = geometry.cells.length;
    requireBank(count === state.volumeM3.length && count <= BANK_LIMITS.cells && geometry.faces.length > 0 && geometry.faces.length <= BANK_LIMITS.faces && finite(rhoKgM3) && rhoKgM3 > 0 && finite(requestedDtS) && requestedDtS > 0, 'Invalid bounded step');
    geometry.cells.forEach((c, i) => requireBank(c.id === i && finite(c.areaM2) && c.areaM2 > 0, 'Cell IDs/areas must match bounded state order'));
    const measures = geometry.cells.map((c, i) => measure(c, state.volumeM3[i]));
    const velocity = state.volumeM3.map((v, i) => v === 0 ? [0, 0] : [state.pxKgMS[i] / (rhoKgM3 * v), state.pzKgMS[i] / (rhoKgM3 * v)]);
    requireBank(velocity.flat().every(finite), 'Nonfinite raw velocity');
    const out = Array(count).fill(0) as number[], incoming = Array(count).fill(0) as number[], response = Array(count).fill(0) as number[], volumeResponse = Array(count).fill(0) as number[];
    let faceVolumeError = 0, faceMomentumError = 0;
    const closureX = Array(count).fill(0) as number[], closureZ = Array(count).fill(0) as number[];
    const incidenceX = Array(count).fill(0) as number[], incidenceZ = Array(count).fill(0) as number[];
    const rates: BankFaceLedger[] = [], ids = new Set<number>();
    for (const face of geometry.faces) {
      requireBank(Number.isSafeInteger(face.id) && !ids.has(face.id) && Number.isSafeInteger(face.left) && face.left >= 0 && face.left < count && (face.right === null || (Number.isSafeInteger(face.right) && face.right >= 0 && face.right < count && face.right !== face.left)), 'Invalid/duplicate face ownership');
      ids.add(face.id);
      requireBank((Math.abs(face.nx) === 1 && face.nz === 0) || (Math.abs(face.nz) === 1 && face.nx === 0), 'Cartesian unit face normal required');
      requireBank(finite(face.lengthM) && face.lengthM > 0 && finite(face.normalSpacingM) && face.normalSpacingM > 0, 'Invalid face geometry');
      const L = face.left, R = face.right;
      const f = face.measureFace(measures[L].etaM, R === null ? measures[L].etaM : measures[R].etaM);
      requireBank(f.nodes.length > 0 && f.nodes.length <= BANK_LIMITS.faceNodes && [f.lengthErrorM, f.depthErrorM, f.fluxVolumeErrorM3S, f.fluxMomentumErrorN].every(x => finite(x) && x >= 0), 'Invalid bounded face integration');
      faceVolumeError += f.fluxVolumeErrorM3S; faceMomentumError += f.fluxMomentumErrorN;
      requireBank(Math.abs(f.nodes.reduce((s, p) => s + p.weightM, 0) - face.lengthM) <= f.lengthErrorM, 'Incomplete face coverage');
      closureX[L] += face.nx * face.lengthM; closureZ[L] += face.nz * face.lengthM;
      incidenceX[L] += Math.abs(face.nx); incidenceZ[L] += Math.abs(face.nz);
      if (R !== null) {
        closureX[R] -= face.nx * face.lengthM; closureZ[R] -= face.nz * face.lengthM;
        incidenceX[R] += Math.abs(face.nx); incidenceZ[R] += Math.abs(face.nz);
      }
      let volumeRate = 0, pxRate = 0, pzRate = 0;
      const correctionLeft: [number, number] = [0, 0], correctionRight: [number, number] = [0, 0], bedReactionLeft: [number, number] = [0, 0], bedReactionRight: [number, number] = [0, 0];
      for (const p of f.nodes) {
        requireBank([p.weightM, p.bedLeftM, p.bedRightM, p.depthLeftM, p.depthRightM].every(finite) && p.weightM > 0 && p.depthLeftM >= 0 && p.depthRightM >= 0, 'Invalid face quadrature node');
        const etaR = R === null ? measures[L].etaM : measures[R].etaM;
        requireBank(Math.abs(p.depthLeftM - Math.max(measures[L].etaM - p.bedLeftM, 0)) <= f.depthErrorM && Math.abs(p.depthRightM - Math.max(etaR - p.bedRightM, 0)) <= f.depthErrorM, 'One-sided depth mismatch');
        if (R === null) requireBank(p.bedLeftM === p.bedRightM && p.depthLeftM === p.depthRightM, 'Reflecting wall geometry must match');
        const unL = velocity[L][0] * face.nx + velocity[L][1] * face.nz, utL = -velocity[L][0] * face.nz + velocity[L][1] * face.nx;
        const unR = R === null ? -unL : velocity[R][0] * face.nx + velocity[R][1] * face.nz;
        const utR = R === null ? utL : -velocity[R][0] * face.nz + velocity[R][1] * face.nx;
        // Nonnegative hydrostatic point support is geometry, not an inventory clamp.
        const sharedBed = Math.max(p.bedLeftM, p.bedRightM);
        const hL = Math.max(measures[L].etaM - sharedBed, 0), hR = Math.max(etaR - sharedBed, 0);
        requireBank((state.volumeM3[L] > 0 || p.depthLeftM === 0) && (R === null || state.volumeM3[R] > 0 || p.depthRightM === 0), 'Dry inventory has wet face geometry');
        const hll = bankHll(hL, unL, utL, hR, unR, utR), w = p.weightM;
        const massRate = w * hll.mass;
        requireBank(R !== null || massRate === 0, 'Nonzero reflecting-wall mass flux');
        if (massRate > 0) { out[L] += massRate; if (R !== null) incoming[R] += massRate; }
        else { incoming[L] -= massRate; if (R !== null) out[R] -= massRate; }
        volumeRate += massRate;
        pxRate += rhoKgM3 * w * (hll.normal * face.nx - hll.tangent * face.nz);
        pzRate += rhoKgM3 * w * (hll.normal * face.nz + hll.tangent * face.nx);
        response[L] += w * hll.speed; volumeResponse[L] += w * hL * hll.speed;
        if (R !== null) { response[R] += w * hll.speed; volumeResponse[R] += w * hR * hll.speed; }
        const rawL = G * p.depthLeftM ** 2 / 2, rawR = G * p.depthRightM ** 2 / 2, starL = G * hL ** 2 / 2, starR = G * hR ** 2 / 2;
        for (const [j, normal] of [face.nx, face.nz].entries()) {
          correctionLeft[j] -= rhoKgM3 * w * (rawL - starL) * normal;
          bedReactionLeft[j] += rhoKgM3 * w * rawL * normal;
          if (R !== null) { correctionRight[j] += rhoKgM3 * w * (rawR - starR) * normal; bedReactionRight[j] -= rhoKgM3 * w * rawR * normal; }
        }
      }
      rates.push({ faceId: face.id, left: L, right: R, signedVolumeM3: volumeRate, hllPxKgMS: pxRate, hllPzKgMS: pzRate, correctionLeft, correctionRight, bedReactionLeft, bedReactionRight });
    }
    // The 1e-12 m closure threshold checks summation/topology arithmetic only;
    // it is neither a terrain approximation bound nor a physical error budget.
    requireBank(incidenceX.every(x => x > 0) && incidenceZ.every(x => x > 0) && closureX.every(x => Math.abs(x) <= 1e-12) && closureZ.every(x => Math.abs(x) <= 1e-12), 'Missing closed cell faces');
    requireBank(out.every((q, i) => state.volumeM3[i] > 0 || q === 0), 'Dry state has outgoing volume');
    const rawVolumeBoundS = Math.min(...out.map((q, i) => q > 0 ? state.volumeM3[i] / q : Infinity));
    // These three finite diagnostic safeguards are not a nonlinear stability or
    // entropy theorem. Dry zero-momentum cells skip their own ratios to flood.
    const cells = Object.freeze(out.map((q, i) => {
      const dry = state.volumeM3[i] === 0;
      return Object.freeze({ cellId: i, volumeM3: state.volumeM3[i], wetAreaM2: measures[i].wetAreaM2, grossOutflowM3S: q, grossIncomingM3S: incoming[i], faceWaveResponseM2S: response[i], faceVolumeResponseM3S: volumeResponse[i],
        wetAreaBoundS: !dry && response[i] > 0 ? 0.25 * measures[i].wetAreaM2 / response[i] : Infinity,
        volumeResponseBoundS: !dry && volumeResponse[i] > 0 ? 0.25 * state.volumeM3[i] / volumeResponse[i] : Infinity,
        outflowBoundS: !dry && q > 0 ? 0.9 * state.volumeM3[i] / q : Infinity });
    }));
    const diagnosticBoundS = Math.min(requestedDtS, ...cells.flatMap(c => [c.wetAreaBoundS, c.volumeResponseBoundS, c.outflowBoundS]));
    const timestep = Object.freeze({ requestedDtS, rawVolumeBoundS, diagnosticBoundS, cells });
    const selected = timestepPolicy(timestep);
    requireBank(finite(selected) && selected > 0 && selected <= diagnosticBoundS && selected <= rawVolumeBoundS, 'Invalid/diagnostic-unsafe timestep');
    requireBank(state.timeS + selected > state.timeS, 'Unresolved timestep at simulation-clock precision');
    const volumes = [...state.volumeM3], px = [...state.pxKgMS], pz = [...state.pzKgMS];
    const transfers = rates.map(r => {
      const q = r.signedVolumeM3 * selected, fx = r.hllPxKgMS * selected, fz = r.hllPzKgMS * selected;
      volumes[r.left] -= q; px[r.left] += -fx + selected * (r.correctionLeft[0] + r.bedReactionLeft[0]); pz[r.left] += -fz + selected * (r.correctionLeft[1] + r.bedReactionLeft[1]);
      if (r.right !== null) { volumes[r.right] += q; px[r.right] += fx + selected * (r.correctionRight[0] + r.bedReactionRight[0]); pz[r.right] += fz + selected * (r.correctionRight[1] + r.bedReactionRight[1]); }
      return Object.freeze({ ...r, signedVolumeM3: q, hllPxKgMS: fx, hllPzKgMS: fz,
        correctionLeft: Object.freeze(r.correctionLeft.map(x => x * selected)) as readonly [number, number], correctionRight: Object.freeze(r.correctionRight.map(x => x * selected)) as readonly [number, number],
        bedReactionLeft: Object.freeze(r.bedReactionLeft.map(x => x * selected)) as readonly [number, number], bedReactionRight: Object.freeze(r.bedReactionRight.map(x => x * selected)) as readonly [number, number] });
    });
    const after = createBankState(state.runId, state.geometryId, volumes, px, pz, state.revision + 1, state.timeS + selected);
    const nextMeasures = geometry.cells.map((c, i) => measure(c, after.volumeM3[i]));
    const kinetic = (s: BankState) => s.volumeM3.reduce((sum, v, i) => sum + (v === 0 ? 0 : (s.pxKgMS[i] ** 2 + s.pzKgMS[i] ** 2) / (2 * rhoKgM3 * v)), 0);
    const potential = (ms: BankCellMeasure[]) => rhoKgM3 * G * ms.reduce((sum, m) => sum + m.potentialIntegralM4, 0);
    const potentialChangeJ = potential(nextMeasures) - potential(measures), kineticChangeJ = kinetic(after) - kinetic(state);
    requireBank([potentialChangeJ, kineticChangeJ, faceVolumeError, faceMomentumError].every(finite), 'Nonfinite energy/uncertainty observation');
    const volumeIntegrationErrorM3 = [...measures, ...nextMeasures].reduce((s, m) => s + m.volumeErrorM3, 0);
    const potentialIntegrationErrorJ = rhoKgM3 * G * [...measures, ...nextMeasures].reduce((s, m) => s + m.potentialErrorM4, 0);
    const faceVolumeTransferErrorM3 = selected * faceVolumeError, faceMomentumTransferErrorKgMS = selected * faceMomentumError;
    requireBank([volumeIntegrationErrorM3, potentialIntegrationErrorJ, faceVolumeTransferErrorM3, faceMomentumTransferErrorKgMS].every(x => finite(x) && x >= 0), 'Nonfinite aggregate uncertainty');
    return { ok: true, transaction: Object.freeze({ before: state, after, dtS: selected, timestep, transfers: Object.freeze(transfers), potentialChangeJ, kineticChangeJ, volumeIntegrationErrorM3, potentialIntegrationErrorJ, faceVolumeTransferErrorM3, faceMomentumTransferErrorKgMS, energyStatus: 'ENERGY_UNKNOWN', faceQuadratureStatus: geometry.faceQuadratureStatus ?? 'DECLARED' }) };
  } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : String(error), state }; }
}

/** A stale proposal cannot replace a newer committed observation or screenshot. */
export function commitBankTransaction(current: BankState, transaction: BankTransaction): BankState {
  requireBank(current === transaction.before && current.stateId === transaction.before.stateId, 'Stale bank transaction');
  return transaction.after;
}
