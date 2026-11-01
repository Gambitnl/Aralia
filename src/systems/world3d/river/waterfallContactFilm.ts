/**
 * Stores water and physical tangential momentum on the first rock ledge.
 * Shared HLL face fluxes move that water, and open edges release only their
 * actual outgoing flux. Gravity and hydrostatic film pressure drive the flow.
 * The optional measured strike boundary transports two pressure-bearing impact
 * streams into different cells. It rejoins ordinary HLL as soon as supply ends.
 * DEBT: The depth-averaged, attached, single-layer approximation does not
 * resolve an impinging stagnation region, splashing, rupture or surface tension.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 12/10/2026, 18:52:17
 * Dependents: systems/world3d/river/waterfallContactFlow.ts, systems/world3d/river/waterfallMaterialReach.ts, systems/world3d/river/waterfallMaterialReachPort.ts, systems/world3d/river/waterfallSourceSupport.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ContactSurface, ContactVec3 } from './waterfallContactFlow';
import { waterfallContactGeometryIdentity } from './waterfallContactGeometry';
import { LayeredFilmStageFailure, type LayeredFilmFailureDiagnostic, FOUR_LAYER_FILM_MODE, diffuseFilmLayers, diffuseFilmLayersExact,KINETIC_EXACT_IMPACT_MODEL,type FirstImpactModel,filmLayerFaceFlux, layerKinetic, remapFilmLayers, validateLayerColumn, type FilmLayerColumn } from './waterfallLayeredFilm';
import { FilmBackpressureFailure, type FilmBackpressureObserver, type BackpressureGuardOperands } from './waterfallBackpressureObserver';
import type { FilmEnergyObserver } from './waterfallLayeredFilmEnergyObserver';
import type { FiniteSourceSample, FiniteSourceSupply } from './waterfallSourceSupport';
import {WaterfallFilmFront} from './waterfallFilmFront';
import type {WetFrontEvent} from './waterfallWetFront';

export type FilmMode = 'single-layer' | typeof FOUR_LAYER_FILM_MODE;
export interface LayeredFilmLedger {
  impingementApplicability?:{qualification:'UNQUALIFIED';maximumReceiverDepth:number;maximumHydrostaticToIncidentKineticHeadRatio:number;minimumIncidentNormalSpeed:number;fullCellWetArea:true};
  exactViscosityEvaluationLossSigned?:number;exactViscosityEvaluationLossPositive?:number;exactViscosityEvaluationGainMagnitude?:number;exactViscosityEvaluationTolerance?:number;
  momentumUnderflowComponents?: number;
  firstMomentumUnderflow?: NonNullable<ReturnType<typeof diffuseFilmLayers>['firstMomentumUnderflow']> & { cell: number; startTime: number; elapsed: number; substep: number } | null;
  lossUnderflowComponents?: number;
  firstLossUnderflow?: { kind: 'viscous' | 'temporal'; factored: { mantissa: number; exponent: number }; cell: number; startTime: number; elapsed: number; substep: number } | null;
  wallViscousImpulse: ContactVec3; wallWork: 0; viscousLoss: number; backwardEulerLoss: number;
  remapLossSigned: number; transportLossSigned: number; gravityIntegrationChangeSigned: number;
  sourceAdvectiveMomentum: ContactVec3; sourcePressureImpulse: ContactVec3; sourcePressureWork: number;
  sourceAdvectiveEnergy: number; outletEnergyFlux: number; outletNumericalEnergyFlux: number;
  sourceInsertionPotentialChangeSigned: number; sourcePrimitiveMixingLossSigned: number; sourcePressureIntegrationKineticChangeSigned: number;
  horizontalGravityLossPositive: number; horizontalGravityGainMagnitude: number; horizontalGravityNumericalTolerance: number;
  remapLossPositive: number; remapGainMagnitude: number; remapNumericalTolerance: number; completedSubsteps: number;
  numericalToleranceRelative: 1e-10;
  energyStatus: 'ENERGY_UNKNOWN';
}
export interface LayeredFilmState { mode: typeof FOUR_LAYER_FILM_MODE; columns: FilmLayerColumn[]; ledger: LayeredFilmLedger }
export interface LayeredFilmOutlet {
  version: typeof FOUR_LAYER_FILM_MODE; layers: { volume: number; velocity: ContactVec3 }[];
  advectiveMomentum: ContactVec3; pressureImpulse: ContactVec3; numericalMomentumCorrection: ContactVec3;
  profileKinetic: number; potential: number; pressureWork: number; energyFlux: number;
  numericalEnergyFlux: number; energyStatus: 'ENERGY_UNKNOWN';
}
const emptyColumn = (): FilmLayerColumn => ({ volumes: [0, 0, 0, 0], momenta: Array.from({ length: 4 }, () => [0, 0, 0] as ContactVec3) });
const emptyLayerLedger = (): LayeredFilmLedger => ({ momentumUnderflowComponents: 0, firstMomentumUnderflow: null, lossUnderflowComponents: 0, firstLossUnderflow: null, wallViscousImpulse: [0, 0, 0], wallWork: 0, viscousLoss: 0, backwardEulerLoss: 0, remapLossSigned: 0, transportLossSigned: 0, gravityIntegrationChangeSigned: 0, sourceAdvectiveMomentum: [0, 0, 0], sourcePressureImpulse: [0, 0, 0], sourcePressureWork: 0, sourceAdvectiveEnergy: 0, sourceInsertionPotentialChangeSigned: 0, sourcePrimitiveMixingLossSigned: 0, sourcePressureIntegrationKineticChangeSigned: 0, outletEnergyFlux: 0, outletNumericalEnergyFlux: 0, horizontalGravityLossPositive: 0, horizontalGravityGainMagnitude: 0, horizontalGravityNumericalTolerance: 0, remapLossPositive: 0, remapGainMagnitude: 0, remapNumericalTolerance: 0, completedSubsteps: 0, numericalToleranceRelative: 1e-10, energyStatus: 'ENERGY_UNKNOWN' });

/** Versioned terminal bytes cannot be restored or acknowledged as legacy
 * ballistic water. Validate their complete inventory before any owner changes. */
export function validateLayeredFilmOutlet(out: FilmOutflow): void {
  const row = out.layered;
  if (!row || row.version !== FOUR_LAYER_FILM_MODE || row.energyStatus !== 'ENERGY_UNKNOWN' || row.layers.length !== 4) throw Error('layered-film-terminal-version');
  const values = [out.volume, out.height, ...out.velocity, ...out.momentum, row.profileKinetic, row.potential, row.pressureWork, row.energyFlux, row.numericalEnergyFlux,
    ...row.advectiveMomentum, ...row.pressureImpulse, ...row.numericalMomentumCorrection, ...row.layers.flatMap(l => [l.volume, ...l.velocity])];
  if (!values.every(Number.isFinite) || !(out.volume > 0) || row.profileKinetic < 0 || row.layers.some(l => l.volume < 0 || l.velocity.length !== 3)) throw Error('layered-film-terminal-nonfinite');
  if (row.layers.reduce((sum, l) => sum + l.volume, 0) !== out.volume) throw Error('layered-film-terminal-volume-mismatch');
  const momentum = add(add(row.advectiveMomentum, row.pressureImpulse), row.numericalMomentumCorrection);
  if (momentum.some((p, axis) => p !== out.momentum[axis])) throw Error('layered-film-terminal-momentum-mismatch');
  const kinetic = row.layers.reduce((sum, l) => sum + .5 * rho * l.volume * dot(l.velocity, l.velocity), 0);
  if (kinetic !== row.profileKinetic) throw Error('layered-film-terminal-profile-mismatch');
}

export interface FilmCell { id: number; corners: [ContactVec3, ContactVec3, ContactVec3, ContactVec3]; center: ContactVec3; volume: number; height: number; velocity: ContactVec3; tangentialMomentum: ContactVec3 }
export interface FilmReleaseOrigin { surfaceId: string; geometryIdentity: string; face: number; edge: string; anchor: [number, number]; normal: ContactVec3 }
export interface FilmOutflow { layered?: LayeredFilmOutlet; origin?: FilmReleaseOrigin; face: number; edge: string; start: ContactVec3; end: ContactVec3; intervalStart: number; intervalEnd: number; time: number; volume: number; momentum: ContactVec3; velocity: ContactVec3; height: number }
/** Fixed, measured strike geometry. Knots retain every actual line bend; span
 * cuts retain the caller's incoming quadrature intervals without widening them. */
export interface FilmJunctionGeometry { subdivision?: '4x3-v1'; locus: ContactVec3[]; spanKnots?: number[] }
export interface FilmJunctionSegment { face: number; start: ContactVec3; end: ContactVec3; normal: ContactVec3; length: number; minusCell: number; plusCell: number }
export interface FilmJunctionPort { volume: number; momentum: ContactVec3; energy: number; height: number; velocity: ContactVec3 }
/** All transfers are integrated over this advance call, including pressure
 * traction and pressure work. They are not velocities deposited into one cell. */
export interface FilmJunctionTransfer { face: number; incomingVolume: number; incomingEnergy: number; reaction: ContactVec3; minus: FilmJunctionPort; plus: FilmJunctionPort }
export interface FilmReceipt { junctionIncomingEnergy: number; junctionOutgoingEnergy: number; volume: number; momentum: ContactVec3; capturedVolume: number; releasedVolume: number; normalReaction: ContactVec3; normalEnergyLoss: number; mixingEnergyLoss: number; depositionPotentialEnergyChange: number; numericalEnergyLossSigned: number; gravityImpulse: ContactVec3; supportImpulse: ContactVec3; normalGravity: number; tangentialGravity: ContactVec3; maximumCourant: number; substeps: number; failure: string | null }
export interface FilmSnapshot { rejectedStage?: LayeredFilmFailureDiagnostic; layered?: LayeredFilmState; surfaceId: string; nx: number; nz: number; cells: FilmCell[]; outflows: FilmOutflow[]; receipt: FilmReceipt }
export interface FilmState { rejectedStage?: LayeredFilmFailureDiagnostic; layered?: LayeredFilmState; junctionGeometry: FilmJunctionGeometry | null; originalNx: number; originalNz: number; junctionIncomingEnergy: number; junctionOutgoingEnergy: number; volumes: number[]; momenta: ContactVec3[]; capturedVolume: number; releasedVolume: number; normalReaction: ContactVec3; normalEnergyLoss: number; mixingEnergyLoss: number; depositionPotentialEnergyChange: number; numericalEnergyLossSigned: number; gravityImpulse: ContactVec3; supportImpulse: ContactVec3; maximumCourant: number; substeps: number; outflows: FilmOutflow[]; failure: string | null }
interface Face { anchor?: [number, number]; left: number; right: number; normal: ContactVec3; length: number; start: ContactVec3; end: ContactVec3; edge: string }
const rho = 1000, g: ContactVec3 = [0, -9.81, 0];
const add = (a: ContactVec3, b: ContactVec3): ContactVec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: ContactVec3, b: ContactVec3): ContactVec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: ContactVec3, n: number): ContactVec3 => [a[0] * n, a[1] * n, a[2] * n];
// Divide components directly: a positive subnormal mass can have an infinite
// reciprocal even when every momentum/mass quotient is a finite velocity.
const divide = (a: ContactVec3, n: number): ContactVec3 => [a[0] / n, a[1] / n, a[2] / n];
const dot = (a: ContactVec3, b: ContactVec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: ContactVec3, b: ContactVec3): ContactVec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: ContactVec3): ContactVec3 => mul(a, 1 / Math.hypot(...a));
const cloneOutflows = (outflows: FilmOutflow[]) => structuredClone(outflows);

export interface FilmState { firstImpactModel?:typeof KINETIC_EXACT_IMPACT_MODEL }
export interface FilmSnapshot { firstImpactModel?:typeof KINETIC_EXACT_IMPACT_MODEL }
export class WaterfallContactFilm {
  backpressureObserver?:FilmBackpressureObserver;
  // Optional one-shot raw observer. It never participates in rollback state,
  // force assembly, timestep selection, or the existing energy gates.
  energyObserver?: FilmEnergyObserver;
  private layered: LayeredFilmState | null = null;
  /** Original comparison-grid cell area; refined transport uses each true quad
   * area internally. Depths in snapshots always use that cell's actual area. */
  readonly area: number;
  readonly normalGravity: number;
  readonly tangentialGravity: ContactVec3;
  private readonly faces: Face[] = [];
  private readonly corners: FilmCell['corners'][] = [];
  private readonly centers: ContactVec3[] = [];
  private readonly areas: number[] = [];
  private originalNx: number;
  private originalNz: number;
  private junctionGeometry: FilmJunctionGeometry | null = null;
  private junctionFaces: number[] = [];
  private junctionIncomingEnergy = 0;
  private junctionOutgoingEnergy = 0;
  private volumes: number[];
  private momenta: ContactVec3[];
  private capturedVolume = 0;
  private releasedVolume = 0;
  private normalReaction: ContactVec3 = [0, 0, 0];
  private normalEnergyLoss = 0;
  private mixingEnergyLoss = 0;
  private depositionPotentialEnergyChange = 0;
  private numericalEnergyLossSigned = 0;
  private gravityImpulse: ContactVec3 = [0, 0, 0];
  private supportImpulse: ContactVec3 = [0, 0, 0];
  private maximumCourant = 0;
  private substeps = 0;
  private failure: string | null = null;
  private rejectedStage: LayeredFilmFailureDiagnostic | null = null;
  private outflows: FilmOutflow[] = [];
  get volume(): number { return this.volumes.reduce((sum, volume) => sum + volume, 0); }
  /** Reports only whether the strike geometry exists. Flow can check this
   * without copying numerical arrays or exposing any mutable geometry. */
  get hasJunctionGeometry(): boolean { return this.junctionGeometry !== null; }
  /** Exercise the new moving edge on these actual cells before coupling impact
   * supply. This separate owner starts from a declared wet reservoir, never
   * converts an old full-cell HLL snapshot into a guessed wet footprint. */
  createStraightFront(event: Omit<WetFrontEvent, 'normalGravity'>): WaterfallFilmFront {
    if (this.volume !== 0 || this.capturedVolume !== 0 || this.junctionGeometry || this.layered) throw Error('film-front-requires-fresh-grid');
    return new WaterfallFilmFront({corners:this.corners,nx:this.nx,nz:this.nz,normalGravity:this.normalGravity,tangentialGravity:this.tangentialGravity},event);
  }
  constructor(readonly surface: ContactSurface, public nx = 12, public nz = 16, readonly maximumSubsteps = 64, readonly cfl = .35, readonly mode: FilmMode = 'single-layer',readonly firstImpactModel:FirstImpactModel='hydraulic-be-v1') {
    if(firstImpactModel!=='hydraulic-be-v1'&&firstImpactModel!==KINETIC_EXACT_IMPACT_MODEL||firstImpactModel===KINETIC_EXACT_IMPACT_MODEL&&mode!==FOUR_LAYER_FILM_MODE)throw Error('film-first-impact-model');
    if (mode !== 'single-layer' && mode !== FOUR_LAYER_FILM_MODE) throw Error('film-mode-mismatch');
    if (![nx, nz, maximumSubsteps].every(v => Number.isInteger(v) && v > 0) || nx * nz > 4096 || !(cfl > 0 && cfl <= .45)) throw Error('Invalid bounded film grid');
    this.originalNx = nx; this.originalNz = nz;
    this.normalGravity = -dot(g, surface.normal);
    if (!(this.normalGravity > 0)) throw Error('Film requires a gravity-supported ledge');
    this.tangentialGravity = add(g, mul(surface.normal, this.normalGravity));
    const a = surface.vertices[0], u = sub(surface.vertices[1], a), v = sub(surface.vertices[3], a);
    this.area = Math.hypot(...cross(u, v)) / (nx * nz);
    this.volumes = Array(nx * nz).fill(0);
    this.momenta = Array.from({ length: nx * nz }, () => [0, 0, 0]);
    if (mode === FOUR_LAYER_FILM_MODE) this.layered = { mode, columns: Array.from({ length: nx * nz }, emptyColumn), ledger: emptyLayerLedger() };
    const point = (i: number, j: number): ContactVec3 => add(a, add(mul(u, i / nx), mul(v, j / nz)));
    // The quad is a parallelogram in its physical plane. Face lengths and
    // in-plane normals use that actual metric, rather than treating x/z as
    // orthogonal horizontal distances on a sloping rock.
    const ni = unit(sub(u, mul(unit(v), dot(u, unit(v)))));
    const nj = unit(sub(v, mul(unit(u), dot(v, unit(u)))));
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      this.corners.push([point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)]);
      this.centers.push(point(i + .5, j + .5));
      this.areas.push(this.area);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i <= nx; i++) {
      this.faces.push({ anchor: [i / nx, (j + .5) / nz], left: i > 0 ? j * nx + i - 1 : -1, right: i < nx ? j * nx + i : -1, normal: ni, length: Math.hypot(...v) / nz, start: point(i, j), end: point(i, j + 1), edge: i === 0 ? 'upstream' : i === nx ? 'downstream' : '' });
    }
    for (let j = 0; j <= nz; j++) for (let i = 0; i < nx; i++) {
      this.faces.push({ anchor: [(i + .5) / nx, j / nz], left: j > 0 ? (j - 1) * nx + i : -1, right: j < nz ? j * nx + i : -1, normal: nj, length: Math.hypot(...u) / nx, start: point(i, j), end: point(i + 1, j), edge: j === 0 ? 'across-negative' : j === nz ? 'across-positive' : '' });
    }
  }
  configureJunction(geometry: FilmJunctionGeometry): void {
    if (this.volume > 0 || this.capturedVolume > 0) throw Error('film-junction-geometry-after-admission');
    if (this.junctionGeometry) throw Error('film-junction-already-configured');
    if (geometry.subdivision !== undefined && geometry.subdivision !== '4x3-v1') throw Error('film-junction-subdivision');
    const crossSplit = geometry.subdivision ? 4 : 1, spanSplit = geometry.subdivision ? 3 : 1;
    const locus = geometry.locus.map(p => [...p] as ContactVec3);
    const [a, b, , d] = this.surface.vertices;
    if (locus.length < 2 || !locus.every((p, i) => p.every(Number.isFinite) && p[2] > a[2] && p[2] < d[2] && (!i || p[2] > locus[i - 1][2]) && Math.abs(dot(sub(p, a), this.surface.normal)) < 1e-8)) throw Error('film-junction-invalid-locus');
    const originalNx = this.nx, originalNz = this.nz;
    const column = Math.floor((locus[0][0] - a[0]) / (b[0] - a[0]) * originalNx);
    const x0 = a[0] + (b[0] - a[0]) * column / originalNx, x1 = a[0] + (b[0] - a[0]) * (column + 1) / originalNx;
    if (!(column >= 0 && column < originalNx) || !locus.every(p => p[0] > x0 && p[0] < x1)) throw Error('film-junction-crosses-columns');
    const cuts = geometry.spanKnots ?? [];
    if (!cuts.every(z => Number.isFinite(z) && z >= locus[0][2] && z <= locus[locus.length - 1][2])) throw Error('film-junction-invalid-span');
    const baseZs = [...new Set([...Array.from({ length: originalNz + 1 }, (_, j) => a[2] + (d[2] - a[2]) * j / originalNz), ...locus.map(p => p[2]), ...cuts])].sort((l, r) => l - r);
    // Refine the already source-aligned chart, not the original regular grid.
    // Every old strike bend and span cut survives. The fresh dry cells receive
    // newly integrated source flux; no old deposit is divided among children.
    const zs = spanSplit === 1 ? baseZs : baseZs.flatMap((z, j) => j === baseZs.length - 1
      ? [z] : Array.from({ length: spanSplit }, (_, k) => k === 0 ? z : z + (baseZs[j + 1] - z) * k / spanSplit));
    const nx = (originalNx + 1) * crossSplit, nz = zs.length - 1;
    if (nx * nz > 4096) throw Error('film-junction-grid-capacity');
    const strikeX = (z: number) => {
      if (z <= locus[0][2]) return locus[0][0];
      for (let k = 1; k < locus.length; k++) if (z <= locus[k][2]) return locus[k - 1][0] + (locus[k][0] - locus[k - 1][0]) * (z - locus[k - 1][2]) / (locus[k][2] - locus[k - 1][2]);
      return locus[locus.length - 1][0];
    };
    const u = sub(b, a), v = sub(d, a);
    const point = (i: number, j: number): ContactVec3 => {
      const coarseX = (k: number) => k === column + 1 ? strikeX(zs[j]) : a[0] + (b[0] - a[0]) * (k > column + 1 ? k - 1 : k) / originalNx;
      const parent = Math.floor(i / crossSplit), fraction = i % crossSplit / crossSplit;
      const x = fraction === 0 ? coarseX(parent) : coarseX(parent) + (coarseX(parent + 1) - coarseX(parent)) * fraction;
      return add(a, add(mul(u, (x - a[0]) / (b[0] - a[0])), mul(v, (zs[j] - a[2]) / (d[2] - a[2]))));
    };
    // Each fixed spatial knot is a mesh vertex. The two neighboring cells retain
    // separate water, and every added cut away from supplied impact is HLL.
    this.faces.length = this.corners.length = this.centers.length = this.areas.length = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const corners: FilmCell['corners'] = [point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)];
      const t0 = Math.hypot(...cross(sub(corners[1], corners[0]), sub(corners[2], corners[0]))) / 2;
      const t1 = Math.hypot(...cross(sub(corners[2], corners[0]), sub(corners[3], corners[0]))) / 2;
      const area = t0 + t1;
      if (!(area > 0)) throw Error('film-junction-degenerate-cell');
      this.corners.push(corners); this.areas.push(area);
      this.centers.push(divide(add(mul(add(add(corners[0], corners[1]), corners[2]), t0 / 3), mul(add(add(corners[0], corners[2]), corners[3]), t1 / 3)), area));
    }
    this.junctionFaces = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i <= nx; i++) {
      const start = point(i, j), end = point(i, j + 1);
      const face = this.faces.length;
      this.faces.push({ anchor: [i === 0 ? 0 : i === nx ? 1 : (start[0] - a[0]) / u[0], ((zs[j] + zs[j + 1]) * .5 - a[2]) / v[2]], left: i > 0 ? j * nx + i - 1 : -1, right: i < nx ? j * nx + i : -1, normal: unit(cross(this.surface.normal, sub(end, start))), length: Math.hypot(...sub(end, start)), start, end, edge: i === 0 ? 'upstream' : i === nx ? 'downstream' : '' });
      if (i === (column + 1) * crossSplit && zs[j] >= locus[0][2] && zs[j + 1] <= locus[locus.length - 1][2]) this.junctionFaces.push(face);
    }
    for (let j = 0; j <= nz; j++) for (let i = 0; i < nx; i++) {
      const start = point(i, j), end = point(i + 1, j);
      this.faces.push({ anchor: [((start[0] + end[0]) * .5 - a[0]) / u[0], j === 0 ? 0 : j === nz ? 1 : (zs[j] - a[2]) / v[2]], left: j > 0 ? (j - 1) * nx + i : -1, right: j < nz ? j * nx + i : -1, normal: unit(cross(sub(end, start), this.surface.normal)), length: Math.hypot(...sub(end, start)), start, end, edge: j === 0 ? 'across-negative' : j === nz ? 'across-positive' : '' });
    }
    this.nx = nx; this.nz = nz;
    this.volumes = Array(nx * nz).fill(0); this.momenta = Array.from({ length: nx * nz }, () => [0, 0, 0]);
    if (this.layered) this.layered.columns = Array.from({ length: nx * nz }, emptyColumn);
    this.junctionGeometry = { ...(geometry.subdivision ? { subdivision: geometry.subdivision } : {}), locus, spanKnots: [...cuts] };
  }
  junctionSegments(): FilmJunctionSegment[] {
    return this.junctionFaces.map(face => { const f = this.faces[face]; return { face, start: [...f.start], end: [...f.end], normal: [...f.normal], length: f.length, minusCell: f.left, plusCell: f.right }; });
  }
  capture(position: ContactVec3, volume: number, velocity: ContactVec3): { reaction: ContactVec3; normalEnergyLoss: number; mixingEnergyLoss: number } {
    // The experimental profile accepts the declared pressure-bearing junction;
    // point capture does not define its layer insertion or pressure work.
    if (this.layered) throw Error('layered-film-requires-junction-admission');
    if (!(volume > 0) || ![volume, ...position, ...velocity].every(Number.isFinite)) throw Error('Invalid film admission');
    const [a, b, , d] = this.surface.vertices;
    if (position[0] < a[0] - 1e-8 || position[0] > b[0] + 1e-8 || position[2] < a[2] - 1e-8 || position[2] > d[2] + 1e-8) throw Error('film-admission-outside-surface');
    const i = Math.min(this.nx - 1, Math.max(0, Math.floor((position[0] - a[0]) / (b[0] - a[0]) * this.nx)));
    const j = Math.min(this.nz - 1, Math.max(0, Math.floor((position[2] - a[2]) / (d[2] - a[2]) * this.nz)));
    let cell = j * this.nx + i;
    if (this.junctionGeometry) {
      cell = this.corners.findIndex(c => c.every((p, k) => {
        const next = c[(k + 1) % 4];
        return (next[0] - p[0]) * (position[2] - p[2]) - (next[2] - p[2]) * (position[0] - p[0]) >= -1e-8;
      }));
      if (cell < 0) throw Error('film-admission-outside-surface');
    }
    const normalSpeed = dot(velocity, this.surface.normal);
    const tangent = sub(velocity, mul(this.surface.normal, normalSpeed));
    const reaction = mul(this.surface.normal, -rho * volume * normalSpeed);
    const normalEnergyLoss = .5 * rho * volume * normalSpeed ** 2;
    const priorVolume = this.volumes[cell], previous = this.momenta[cell];
    const previousEnergy = priorVolume > 0 ? dot(previous, previous) / (2 * rho * priorVolume) : 0;
    const next = add(previous, mul(tangent, rho * volume));
    const mixingEnergyLoss = Math.max(0, previousEnergy + .5 * rho * volume * dot(tangent, tangent) - dot(next, next) / (2 * rho * (priorVolume + volume)));
    // DEBT: Cell-center deposition and creating a hydrostatic column change
    // potential energy. This signed insertion work is unresolved by point
    // impact capture; report it rather than hiding it in kinetic mixing loss.
    this.depositionPotentialEnergyChange += rho * volume * 9.81 * (this.centers[cell][1] - position[1])
      + rho * this.normalGravity * ((priorVolume + volume) ** 2 - priorVolume ** 2) / (2 * this.areas[cell]);
    this.volumes[cell] += volume; this.momenta[cell] = next;
    this.capturedVolume += volume; this.normalReaction = add(this.normalReaction, reaction);
    this.normalEnergyLoss += normalEnergyLoss; this.mixingEnergyLoss += mixingEnergyLoss;
    return { reaction, normalEnergyLoss, mixingEnergyLoss };
  }
  private velocity(cell: number): ContactVec3 { return cell >= 0 && this.volumes[cell] > 0 ? divide(this.momenta[cell], rho * this.volumes[cell]) : [0, 0, 0]; }
  /** Read the same actual-area/face wave rates used by the bounded update,
   * without advancing water or inferring capacity from a row width alone. */
  inspectWaveRates(transfers: readonly FilmJunctionTransfer[] = []): number[] {
    return this.waveRates(this.volumes.map((_, c) => this.velocity(c)), this.volumes.map((v, c) => v / this.areas[c]), transfers);
  }
  private waveRates(velocities: ContactVec3[], heights: number[], transfers: readonly FilmJunctionTransfer[]): number[] {
    const waveSum = Array(this.volumes.length).fill(0) as number[];
    for (const face of this.faces) {
      const signal = Math.max(...[face.left, face.right].filter(c => c >= 0).map(c => Math.abs(dot(velocities[c], face.normal)) + 2 * Math.sqrt(this.normalGravity * heights[c])));
      if (face.left >= 0) waveSum[face.left] += signal * face.length / this.areas[face.left];
      if (face.right >= 0) waveSum[face.right] += signal * face.length / this.areas[face.right];
    }
    for (const transfer of transfers) {
      const face = this.faces[transfer.face];
      if (!face || !this.junctionFaces.includes(transfer.face)) throw Error('film-junction-invalid-transfer');
      for (const [cell, port] of [[face.left, transfer.minus], [face.right, transfer.plus]] as [number, FilmJunctionPort][]) {
        if (port.volume === 0) continue;
        const signal = Math.hypot(...port.velocity) + 2 * Math.sqrt(this.normalGravity * port.height);
        waveSum[cell] += signal * face.length / this.areas[cell];
      }
    }
    return waveSum;
  }
  private energy(): number {
    let total = 0;
    for (let c = 0; c < this.volumes.length; c++) {
      const v = this.volumes[c], h = v / this.areas[c];
      total += (this.layered ? layerKinetic(this.layered.columns[c]) : v > 0 ? dot(this.momenta[c], this.momenta[c]) / (2 * rho * v) : 0) + rho * v * (9.81 * this.centers[c][1] + .5 * this.normalGravity * h);
    }
    return total;
  }
  advance(startTime: number, duration: number, transfers: FilmJunctionTransfer[] = [], finiteSupply?: FiniteSourceSupply): FilmOutflow[] {
    if (this.layered) return this.advanceLayered(startTime, duration, transfers, finiteSupply);
    if (finiteSupply) throw Error('finite-source-requires-layered-film');
    if (!(duration >= 0) || ![startTime, duration].every(Number.isFinite)) throw Error('Invalid film clock');
    // A dry ledge with no incoming port has nothing to evolve. Avoid copying
    // its state and solving empty faces until water actually arrives. This
    // uses exact zero, not a depth threshold: even the smallest owned volume
    // follows the normal update. Keep clock/port validation and the separate
    // layered source path intact. Substeps count work performed, not dry time.
    if (transfers.length === 0 && this.volumes.every(v => v === 0)
      && this.momenta.every(p => p.every(value => value === 0))) {
      this.outflows = []; this.failure = null;
      return [];
    }
    const saved = this.saveState(); this.outflows = []; this.failure = null;
    let elapsed = 0, steps = 0;
    try {
      const active = new Map<number, FilmJunctionTransfer>();
      for (const transfer of transfers) {
        if (!(duration > 0) || !this.junctionFaces.includes(transfer.face) || active.has(transfer.face) || !(transfer.incomingVolume > 0)) throw Error('film-junction-invalid-transfer');
        const numbers = [transfer.incomingVolume, transfer.incomingEnergy, ...transfer.reaction, ...[transfer.minus, transfer.plus].flatMap(p => [p.volume, p.energy, p.height, ...p.momentum, ...p.velocity])];
        if (!numbers.every(Number.isFinite) || [transfer.minus, transfer.plus].some(p => !(p.volume >= 0 && p.height >= 0) || (p.volume === 0 ? p.height !== 0 || p.energy !== 0 || p.momentum.some(v => v !== 0) : p.height === 0))) throw Error('film-junction-invalid-port');
        if (Math.abs(transfer.minus.volume + transfer.plus.volume - transfer.incomingVolume) > 1e-12 * transfer.incomingVolume) throw Error('film-junction-volume-balance');
        if (Math.abs(transfer.minus.energy + transfer.plus.energy - transfer.incomingEnergy) > 1e-10 * Math.max(1, Math.abs(transfer.incomingEnergy))) throw Error('film-junction-energy-balance');
        if (Math.hypot(...sub(transfer.reaction, mul(this.surface.normal, dot(transfer.reaction, this.surface.normal)))) > 1e-10 * Math.max(1, Math.hypot(...transfer.reaction))) throw Error('film-junction-tangential-wall-reaction');
        active.set(transfer.face, transfer);
      }
      let appliedFraction = 0;
      while (elapsed < duration - 1e-12) {
        if (steps >= this.maximumSubsteps) throw Error('film-cfl-capacity');
        const velocities = this.volumes.map((_, c) => this.velocity(c));
        const heights = this.volumes.map((v, c) => v / this.areas[c]);
        const waveSum = this.waveRates(velocities, heights, [...active.values()]);
        const maximum = Math.max(...waveSum);
        // Bound gravity's acceleration too: an initially motionless film must
        // not choose a whole long interval before its downslope speed grows.
        const dt = Math.min(duration - elapsed, .01, this.cfl / Math.max(1e-12, maximum));
        this.maximumCourant = Math.max(this.maximumCourant, maximum * dt);
        const beforeEnergy = this.energy();
        const deltaV = Array(this.volumes.length).fill(0) as number[];
        const deltaP: ContactVec3[] = Array.from({ length: this.volumes.length }, () => [0, 0, 0]);
        let outgoingEnergy = 0;
        let incomingEnergy = 0;
        const fraction = elapsed + dt >= duration - 1e-12 ? 1 - appliedFraction : dt / duration;
        for (const [faceId, face] of this.faces.entries()) {
          const transfer = active.get(faceId);
          if (transfer) {
            // A prescribed impact port is admissible only when every HLL wave
            // points into its receiving film. Returning information rejects the
            // whole step; forcing discharge through backpressure is forbidden.
            for (const [cell, port, sign] of [[face.left, transfer.minus, -1], [face.right, transfer.plus, 1]] as [number, FilmJunctionPort, number][]) {
              if (port.volume === 0) {
                if (heights[cell] > 0) throw Error('film-junction-backpressure');
                continue;
              }
              const normal = mul(face.normal, sign), up = dot(port.velocity, normal), ur = dot(velocities[cell], normal);
              const cp = Math.sqrt(this.normalGravity * port.height), cr = Math.sqrt(this.normalGravity * heights[cell]);
              const sl = Math.min(up - cp, heights[cell] > 0 ? ur - cr : up - cp);
              if (!(sl > 0)) throw Error('film-junction-backpressure');
              if (Math.abs(dot(port.velocity, this.surface.normal)) > 1e-10 * Math.max(1, Math.hypot(...port.velocity))) throw Error('film-junction-nontangential-port');
              const q = port.height * up * face.length * duration;
              if (Math.abs(q - port.volume) > 1e-10 * port.volume) throw Error('film-junction-port-flux-mismatch');
              const traction = add(mul(port.velocity, rho * port.volume), mul(normal, .5 * rho * this.normalGravity * port.height ** 2 * face.length * duration));
              if (Math.hypot(...sub(traction, port.momentum)) > 1e-10 * Math.max(1, Math.hypot(...port.momentum))) throw Error('film-junction-port-traction-mismatch');
              const energy = rho * port.volume * (.5 * dot(port.velocity, port.velocity) + this.normalGravity * port.height + 9.81 * (face.start[1] + face.end[1]) * .5);
              if (Math.abs(energy - port.energy) > 1e-10 * Math.max(1, Math.abs(energy))) throw Error('film-junction-port-energy-mismatch');
              deltaV[cell] += port.volume * fraction;
              deltaP[cell] = add(deltaP[cell], mul(port.momentum, fraction));
            }
            incomingEnergy += (transfer.minus.energy + transfer.plus.energy) * fraction;
            this.junctionIncomingEnergy += transfer.incomingEnergy * fraction;
            this.junctionOutgoingEnergy += (transfer.minus.energy + transfer.plus.energy) * fraction;
            this.normalReaction = add(this.normalReaction, mul(transfer.reaction, fraction));
            this.capturedVolume += transfer.incomingVolume * fraction;
            continue;
          }
          const l = face.left, r = face.right, hl = l >= 0 ? heights[l] : 0, hr = r >= 0 ? heights[r] : 0;
          if (hl === 0 && hr === 0) continue;
          const vl = l >= 0 ? velocities[l] : [0, 0, 0] as ContactVec3, vr = r >= 0 ? velocities[r] : [0, 0, 0] as ContactVec3;
          const ul = dot(vl, face.normal), ur = dot(vr, face.normal), cl = Math.sqrt(this.normalGravity * hl), cr = Math.sqrt(this.normalGravity * hr);
          // Same Davis/Toro wet/dry HLL structure as the native river solver.
          const sl = hl === 0 ? ur - 2 * cr : Math.min(ul - cl, hr > 0 ? ur - cr : ul - cl);
          const sr = hr === 0 ? ul + 2 * cl : Math.max(ur + cr, hl > 0 ? ul + cl : ur + cr);
          const ql = hl * ul, qr = hr * ur;
          const pl = ql * ul + .5 * this.normalGravity * hl ** 2, pr = qr * ur + .5 * this.normalGravity * hr ** 2;
          const inv = 1 / Math.max(1e-30, sr - sl);
          const fh = sl >= 0 ? ql : sr <= 0 ? qr : (sr * ql - sl * qr + sl * sr * (hr - hl)) * inv;
          const fn = sl >= 0 ? pl : sr <= 0 ? pr : (sr * pl - sl * pr + sl * sr * (qr - ql)) * inv;
          const donor = fh >= 0 ? vl : vr;
          const fp = add(mul(face.normal, fn), mul(sub(donor, mul(face.normal, dot(donor, face.normal))), fh));
          const amount = fh * face.length * dt, momentum = mul(fp, rho * face.length * dt);
          if (l >= 0) { deltaV[l] -= amount; deltaP[l] = sub(deltaP[l], momentum); }
          if (r >= 0) { deltaV[r] += amount; deltaP[r] = add(deltaP[r], momentum); }
          if (face.edge && ((r < 0 && amount > 0) || (l < 0 && amount < 0))) {
            const sign = r < 0 ? 1 : -1, volume = Math.abs(amount), outMomentum = mul(momentum, sign);
            const velocity = divide(outMomentum, rho * volume);
            const height = (r < 0 ? hl : hr);
            const start = add(face.start, mul(this.surface.normal, height * .5)), end = add(face.end, mul(this.surface.normal, height * .5));
            const [a, b, , d] = this.surface.vertices, anchor = face.anchor!;
            const bedY = a[1] + (b[1] - a[1]) * anchor[0] + (d[1] - a[1]) * anchor[1];
            // Match the retained release position used by flight and collision.
            // Separate products keep shallow clearance out of large-coordinate
            // subtraction; this does not reset outgoing kinetic energy.
            outgoingEnergy += rho * volume * .5 * dot(velocity, velocity) + rho * volume * 9.81 * bedY
              + rho * volume * 9.81 * this.surface.normal[1] * height * .5;
            // The supplying edge's exact parameter fixes its incidence. World
            // points alone lose a very shallow release's normal clearance.
            this.outflows.push({ origin: { surfaceId: this.surface.id, geometryIdentity: waterfallContactGeometryIdentity(this.surface), face: faceId, edge: face.edge, anchor: [...face.anchor!], normal: [...this.surface.normal] }, face: faceId, edge: `${this.surface.id}:${face.edge}`, start, end, intervalStart: startTime + elapsed, intervalEnd: startTime + elapsed + dt, time: startTime + elapsed + dt, volume, momentum: outMomentum, velocity, height });
            this.releasedVolume += volume;
          }
        }
        for (let c = 0; c < this.volumes.length; c++) {
          const volume = this.volumes[c] + deltaV[c];
          if (!(volume >= 0) || !Number.isFinite(volume)) throw Error('film-negative-volume');
          this.momenta[c] = add(add(this.momenta[c], deltaP[c]), mul(this.tangentialGravity, rho * (this.volumes[c] + volume) * .5 * dt));
          const massTime = rho * (this.volumes[c] + volume) * .5 * dt;
          this.gravityImpulse = add(this.gravityImpulse, mul(g, massTime));
          this.supportImpulse = add(this.supportImpulse, mul(this.surface.normal, this.normalGravity * massTime));
          this.volumes[c] = volume;
          if (!this.momenta[c].every(Number.isFinite) || (volume === 0 && Math.hypot(...this.momenta[c]) > 0)) throw Error('film-unsupported-momentum');
        }
        // Signed residual measures this discrete scheme, including transport,
        // pressure and time integration. It is never hidden as physical drag.
        this.numericalEnergyLossSigned += beforeEnergy + incomingEnergy - this.energy() - outgoingEnergy;
        appliedFraction += fraction;
        elapsed += dt; steps++; this.substeps++;
      }
    } catch (error) {
      this.restoreState(saved); this.failure = error instanceof Error ? error.message : 'film-failure';
      throw error;
    }
    return cloneOutflows(this.outflows);
  }
  /** The experimental profile shares this Film's actual geometry, pressure
   * ports and transaction. Horizontal faces start from remapped equal fractions;
   * per-layer conservative fluxes then evolve real persistent layer momenta.
   * Cell-center geometry and first-order source insertion remain unqualified.
   * Signed transport/time errors are numerical receipts, never inferred work. */
  private advanceLayered(startTime: number, duration: number, transfers: FilmJunctionTransfer[], finiteSupply?: FiniteSourceSupply): FilmOutflow[] {
    if (!(duration >= 0) || ![startTime, duration].every(Number.isFinite)) throw Error('Invalid film clock');
    const saved = this.saveState(), state = this.layered!, ledger = state.ledger;
    this.outflows = []; this.failure = null; this.rejectedStage = null;
    let elapsed = 0, steps = 0, appliedFraction = 0;
    const observer = this.energyObserver;
    const backpressure=this.backpressureObserver;
    backpressure?.beginTick(startTime,duration,{areas:this.areas,bedPotential:this.centers.map(c=>9.81*c[1]),gn:this.normalGravity,rho,faces:this.faces});
    observer?.beginTick(startTime, duration, { areas: this.areas, bedPotential: this.centers.map(c => 9.81 * c[1]), gn: this.normalGravity });
    try {
      if (finiteSupply && transfers.length) throw Error('finite-source-conflicting-legacy-transfers');
      if((finiteSupply?.firstImpactModel??'hydraulic-be-v1')!==this.firstImpactModel)throw Error('film-source-impact-model-mismatch');
      const active = new Map<number, FilmJunctionTransfer>();
      for (const transfer of transfers) {
        if (!(duration > 0) || !this.junctionFaces.includes(transfer.face) || active.has(transfer.face) || !(transfer.incomingVolume > 0)) throw Error('film-junction-invalid-transfer');
        const values = [transfer.incomingVolume, transfer.incomingEnergy, ...transfer.reaction, ...[transfer.minus, transfer.plus].flatMap(p => [p.volume, p.energy, p.height, ...p.momentum, ...p.velocity])];
        if (!values.every(Number.isFinite) || [transfer.minus, transfer.plus].some(p => !(p.volume >= 0 && p.height >= 0) || (p.volume === 0 ? p.height !== 0 || p.energy !== 0 || p.momentum.some(v => v !== 0) : p.height === 0))) throw Error('film-junction-invalid-port');
        if (Math.abs(transfer.minus.volume + transfer.plus.volume - transfer.incomingVolume) > 1e-12 * transfer.incomingVolume) throw Error('film-junction-volume-balance');
        if (Math.abs(transfer.minus.energy + transfer.plus.energy - transfer.incomingEnergy) > 1e-10 * Math.max(1, Math.abs(transfer.incomingEnergy))) throw Error('film-junction-energy-balance');
        if (Math.hypot(...sub(transfer.reaction, mul(this.surface.normal, dot(transfer.reaction, this.surface.normal)))) > 1e-10 * Math.max(1, Math.hypot(...transfer.reaction))) throw Error('film-junction-tangential-wall-reaction');
        active.set(transfer.face, transfer);
      }
      while (elapsed < duration - 1e-12) {
        if (steps >= this.maximumSubsteps) throw Error('film-cfl-capacity');
        // Use both neighboring profiles and total depth at each actual face.
        // A mean column speed cannot bound a fast top layer or neighboring wave.
        const rates = Array(this.volumes.length).fill(0) as number[];
        const fluxes = this.faces.map(face => {
          const l = face.left, r = face.right;
          const bed = 9.81 * (face.start[1] + face.end[1]) * .5;
          const flux = filmLayerFaceFlux(l >= 0 ? state.columns[l] : emptyColumn(), r >= 0 ? state.columns[r] : emptyColumn(), l >= 0 ? this.areas[l] : 1, r >= 0 ? this.areas[r] : 1, face.normal, this.normalGravity, bed, {
            left: { cell: l, operands: () => ({ face: this.faces.indexOf(face), side: 'left', area: l >= 0 ? this.areas[l] : 1, normal: face.normal }) },
            right: { cell: r, operands: () => ({ face: this.faces.indexOf(face), side: 'right', area: r >= 0 ? this.areas[r] : 1, normal: face.normal }) }
          });
          if (l >= 0) rates[l] += flux.signal * face.length / this.areas[l];
          if (r >= 0) rates[r] += flux.signal * face.length / this.areas[r];
          return flux;
        });
        for (const [id, transfer] of active) for (const [cell, port] of [[this.faces[id].left, transfer.minus], [this.faces[id].right, transfer.plus]] as [number, FilmJunctionPort][]) {
          if (port.volume > 0) rates[cell] += (Math.hypot(...port.velocity) + 2 * Math.sqrt(this.normalGravity * port.height)) * this.faces[id].length / this.areas[cell];
        }
        // Bound every possible incoming state through the rest of this outer
        // tick, including a leading support that has not entered yet. The
        // source's quadrature nodes alone cannot certify a maximum wave speed.
        // Future arriving material bounds depth in BOTH actual receivers. Its
        // kinetic speed and the resident layer speeds constrain every incident
        // ordinary face before dt is selected, including an initially dry grid.
        if(finiteSupply&&this.firstImpactModel===KINETIC_EXACT_IMPACT_MODEL){
          const predicted=new Map<number,{volume:number;speed:number}>();
          for(const bound of finiteSupply.cflBounds(startTime+elapsed,startTime+duration))for(const cell of [this.faces[bound.face].left,this.faces[bound.face].right]){const row=predicted.get(cell)??{volume:0,speed:0};row.volume+=bound.incomingVolumeBound!;row.speed=Math.max(row.speed,bound.incomingSpeedBound!);predicted.set(cell,row);}
          const signal=new Map<number,number>();for(const [cell,bound] of predicted){const resident=Math.max(...state.columns[cell].volumes.map((v,k)=>v>0?Math.hypot(...divide(state.columns[cell].momenta[k],rho*v)):0));const value=Math.max(resident,bound.speed)+Math.sqrt(this.normalGravity*(this.volumes[cell]+bound.volume)/this.areas[cell]);if(!Number.isFinite(value)||!(value>0))throw Error('kinetic-source-cfl-range');signal.set(cell,value);}
          for(const [id,face] of this.faces.entries()){const value=Math.max(fluxes[id].signal,signal.get(face.left)??0,signal.get(face.right)??0);for(const cell of [face.left,face.right])if(cell>=0)rates[cell]+=(value-fluxes[id].signal)*face.length/this.areas[cell];}
        }else if (finiteSupply) for (const bound of finiteSupply.cflBounds(startTime + elapsed, startTime + duration)) {
          const face = this.faces[bound.face];
          rates[face.left] += bound.signalLength / this.areas[face.left];
          rates[face.right] += bound.signalLength / this.areas[face.right];
        }
        const maximum = Math.max(...rates), dt = Math.min(duration - elapsed, .01, this.cfl / Math.max(1e-12, maximum));
        const finiteInterval = finiteSupply?.interval(startTime + elapsed, startTime + elapsed + dt);
        const finiteByFace = new Map<number, FiniteSourceSample[]>();
        for (const sample of finiteInterval?.samples ?? []) {
          if (!this.junctionFaces.includes(sample.face)) throw Error('finite-source-unknown-junction-face');
          const rows = finiteByFace.get(sample.face) ?? []; rows.push(sample); finiteByFace.set(sample.face, rows);
        }
        this.maximumCourant = Math.max(this.maximumCourant, maximum * dt);
        const before = this.energy(), next = structuredClone(state.columns);
        observer?.beginSubstep(steps, elapsed, dt, state.columns);
        backpressure?.beginSubstep(steps,startTime+elapsed,startTime+elapsed+dt,state.columns);
        const sourceBefore = { insertion: ledger.sourceInsertionPotentialChangeSigned, mixing: ledger.sourcePrimitiveMixingLossSigned, pressureIntegration: ledger.sourcePressureIntegrationKineticChangeSigned };
        const fraction = elapsed + dt >= duration - 1e-12 ? 1 - appliedFraction : dt / duration;
        let incomingEnergy = 0, outgoingEnergy = 0;
        for (const [faceId, face] of this.faces.entries()) {
          for (const sample of finiteByFace.get(faceId) ?? []) {
            this.applyFiniteSourceSample(sample, next, startTime + elapsed, startTime + elapsed + dt,backpressure?{sampleIndex:finiteInterval!.samples.indexOf(sample),ordinaryChordMeasure:finiteInterval!.ordinaryChordMeasure.get(faceId),coveredChordMeasure:face.length*dt-(finiteInterval!.ordinaryChordMeasure.get(faceId)??face.length*dt)}:undefined);
            incomingEnergy += sample.incoming.kinetic + sample.incoming.potential;
          }
          const transfer = active.get(faceId);
          if (transfer) {
            for (const [cell, port, sign] of [[face.left, transfer.minus, -1], [face.right, transfer.plus, 1]] as [number, FilmJunctionPort, number][]) {
              if (port.volume === 0) { if (this.volumes[cell] > 0) throw Error('film-junction-backpressure'); continue; }
              const normal = mul(face.normal, sign), up = dot(port.velocity, normal);
              const H = this.volumes[cell] / this.areas[cell];
              const slowest = Math.min(...state.columns[cell].volumes.map((v, k) => v > 0 ? dot(divide(state.columns[cell].momenta[k], rho * v), normal) : up));
              if (!(Math.min(up - Math.sqrt(this.normalGravity * port.height), H > 0 ? slowest - Math.sqrt(this.normalGravity * H) : up - Math.sqrt(this.normalGravity * port.height)) > 0)) throw Error('film-junction-backpressure');
              if (Math.abs(dot(port.velocity, this.surface.normal)) > 1e-10 * Math.max(1, Math.hypot(...port.velocity))) throw Error('film-junction-nontangential-port');
              if (Math.abs(port.height * up * face.length * duration - port.volume) > 1e-10 * port.volume) throw Error('film-junction-port-flux-mismatch');
              const advective = mul(port.velocity, rho * port.volume);
              const pressure = mul(normal, .5 * rho * this.normalGravity * port.height ** 2 * face.length * duration);
              if (Math.hypot(...sub(add(advective, pressure), port.momentum)) > 1e-10 * Math.max(1, Math.hypot(...port.momentum))) throw Error('film-junction-port-traction-mismatch');
              const bed = 9.81 * (face.start[1] + face.end[1]) * .5;
              const sourceWork = dot(pressure, port.velocity);
              const advectiveEnergy = rho * port.volume * (.5 * dot(port.velocity, port.velocity) + bed + .5 * this.normalGravity * port.height);
              if (Math.abs(advectiveEnergy + sourceWork - port.energy) > 1e-10 * Math.max(1, Math.abs(port.energy))) throw Error('film-junction-port-energy-mismatch');
              // Uniform incoming primitive velocity is a declared profile. Its
              // pressure traction is a separate applied boundary force, never
              // the P/(rho V) velocity used to initialize newly entering water.
              const priorSourceV = next[cell].volumes.reduce((sum, v) => sum + v, 0), incomingV = port.volume * fraction;
              const priorSourceK = layerKinetic(next[cell]);
              observer?.capture('sources', { face: faceId, cell, sign, normal, port, fraction, priorSourceColumn: next[cell], bed, cellBed: 9.81 * this.centers[cell][1], supplyingInterval: [startTime, startTime + duration], applicationInterval: [startTime + elapsed, startTime + elapsed + dt], sourceWork: sourceWork * fraction, advectiveEnergy: advectiveEnergy * fraction });
              for (let k = 0; k < 4; k++) {
                next[cell].volumes[k] += port.volume * fraction / 4;
                next[cell].momenta[k] = add(next[cell].momenta[k], mul(advective, fraction / 4));
                observer?.increment({ kind: 'source-primitive', cell, layer: k, volume: port.volume * fraction / 4, momentum: mul(advective, fraction / 4), face: faceId });
              }
              const primitiveSourceK = layerKinetic(next[cell]);
              observer?.sourceEndpoint('primitive', next[cell]);
              for (let k = 0; k < 4; k++) next[cell].momenta[k] = add(next[cell].momenta[k], mul(pressure, fraction / 4));
              if (observer) for (let k = 0; k < 4; k++) observer.increment({ kind: 'source-pressure', cell, layer: k, volume: 0, momentum: mul(pressure, fraction / 4), face: faceId });
              observer?.sourceEndpoint('pressure', next[cell]);
              // Direct local insertion diagnostics remain part of D_hg; they
              // are not credited back as physical work or deducted from losses.
              // In particular the port's bed and cell-center bed can differ.
              ledger.sourcePrimitiveMixingLossSigned += priorSourceK + .5 * rho * incomingV * dot(port.velocity, port.velocity) - primitiveSourceK;
              ledger.sourcePressureIntegrationKineticChangeSigned += layerKinetic(next[cell]) - primitiveSourceK;
              ledger.sourceInsertionPotentialChangeSigned += rho * incomingV * (9.81 * this.centers[cell][1] - bed)
                + .5 * rho * this.normalGravity * ((priorSourceV + incomingV) ** 2 - priorSourceV ** 2) / this.areas[cell]
                - .5 * rho * incomingV * this.normalGravity * port.height;
              ledger.sourceAdvectiveMomentum = add(ledger.sourceAdvectiveMomentum, mul(advective, fraction));
              ledger.sourcePressureImpulse = add(ledger.sourcePressureImpulse, mul(pressure, fraction));
              ledger.sourcePressureWork += sourceWork * fraction; ledger.sourceAdvectiveEnergy += advectiveEnergy * fraction;
            }
            incomingEnergy += transfer.incomingEnergy * fraction;
            this.junctionIncomingEnergy += transfer.incomingEnergy * fraction; this.junctionOutgoingEnergy += (transfer.minus.energy + transfer.plus.energy) * fraction;
            this.normalReaction = add(this.normalReaction, mul(transfer.reaction, fraction)); this.capturedVolume += transfer.incomingVolume * fraction;
            continue;
          }
          const flux = fluxes[faceId], factor = finiteInterval?.ordinaryChordMeasure.get(faceId) ?? face.length * dt;
          observer?.capture('faces', { face: faceId, left: face.left, right: face.right, normal: face.normal, length: face.length, factor, bed: 9.81 * (face.start[1] + face.end[1]) * .5, leftArea: face.left >= 0 ? this.areas[face.left] : 1, rightArea: face.right >= 0 ? this.areas[face.right] : 1, leftColumn: face.left >= 0 ? state.columns[face.left] : emptyColumn(), rightColumn: face.right >= 0 ? state.columns[face.right] : emptyColumn(), flux });
          if(backpressure)for(const cell of [face.left,face.right])if(cell>=0)backpressure.operation({cell,kind:'incident-face',face:faceId,geometry:face,factor,flux,leftColumn:face.left>=0?state.columns[face.left]:emptyColumn(),rightColumn:face.right>=0?state.columns[face.right]:emptyColumn()});
          for (let k = 0; k < 4; k++) {
            const amount = flux.layers[k].volumeFlux * factor, momentum = mul(flux.layers[k].momentumFlux, factor);
            if (face.left >= 0) { next[face.left].volumes[k] -= amount; next[face.left].momenta[k] = sub(next[face.left].momenta[k], momentum); }
            if (face.right >= 0) { next[face.right].volumes[k] += amount; next[face.right].momenta[k] = add(next[face.right].momenta[k], momentum); }
            if(backpressure)for(const [cell,sign] of [[face.left,-1],[face.right,1]])if(cell>=0)backpressure.operation({cell,kind:'actual-face-increment',face:faceId,layer:k,volume:sign*amount,momentum:mul(momentum,sign)});
            if (observer) for (const [cell, sign] of [[face.left, -1], [face.right, 1]]) if (cell >= 0) {
              const row = flux.layers[k];
              observer.increment({ kind: 'actual-face', cell, layer: k, volume: sign * amount, momentum: mul(momentum, sign), face: faceId });
              observer.increment({ kind: 'central', cell, layer: k, volume: sign * row.centralVolumeFlux * factor, momentum: mul(row.advective, sign * factor), face: faceId });
              observer.increment({ kind: 'rusanov', cell, layer: k, volume: sign * row.numericalVolumeFlux * factor, momentum: mul(row.numerical, sign * factor), face: faceId });
              observer.increment({ kind: 'hydrostatic-pressure', cell, layer: k, volume: 0, momentum: mul(row.pressure, sign * factor), face: faceId });
            }
          }
          if (face.edge) {
            const sign = face.right < 0 ? 1 : -1, cell = face.right < 0 ? face.left : face.right;
            const layers = flux.layers.map(row => ({ volume: sign * row.volumeFlux * factor, velocity: [...row.donorVelocity] as ContactVec3 }));
            if (layers.some(row => row.volume < 0)) throw Error('layered-film-open-edge-inflow');
            const volume = layers.reduce((sum, row) => sum + row.volume, 0);
            if (volume === 0) continue;
            const H = this.volumes[cell] / this.areas[cell], bed = 9.81 * (face.start[1] + face.end[1]) * .5;
            const advectiveMomentum = flux.layers.reduce((sum, row) => add(sum, mul(row.advective, sign * factor)), [0, 0, 0] as ContactVec3);
            const pressureImpulse = flux.layers.reduce((sum, row) => add(sum, mul(row.pressure, sign * factor)), [0, 0, 0] as ContactVec3);
            const numericalMomentumCorrection = flux.layers.reduce((sum, row) => add(sum, mul(row.numerical, sign * factor)), [0, 0, 0] as ContactVec3);
            const profileKinetic = layers.reduce((sum, row) => sum + .5 * rho * row.volume * dot(row.velocity, row.velocity), 0);
            const potential = layers.reduce((sum, row, k) => sum + rho * row.volume * (bed + this.normalGravity * H * (k + .5) / 4), 0);
            // Equal pressure shares are the conservative shared-gradient operator,
            // not the physical traction of each depth strip. Actual hydrostatic
            // pressure power uses p(z)=rho gn(H-z), especially after shear evolves.
            const pressureWork = state.columns[cell].volumes.reduce((sum, v, k) => {
              const u = v > 0 ? divide(state.columns[cell].momenta[k], rho * v) : [0, 0, 0] as ContactVec3;
              return sum + .5 * rho * v / this.areas[cell] * dot(u, mul(face.normal, sign)) * this.normalGravity * H * (1 - (k + .5) / 4) * factor;
            }, 0);
            const momentum = add(add(advectiveMomentum, pressureImpulse), numericalMomentumCorrection);
            const meanPrimitiveMomentum = layers.reduce((sum, row) => add(sum, mul(row.velocity, rho * row.volume)), [0, 0, 0] as ContactVec3);
            const start = add(face.start, mul(this.surface.normal, H * .5)), end = add(face.end, mul(this.surface.normal, H * .5));
            const energyFlux = sign * flux.energyFlux * factor, numericalEnergyFlux = sign * flux.numericalEnergyFlux * factor;
            this.outflows.push({ origin: { surfaceId: this.surface.id, geometryIdentity: waterfallContactGeometryIdentity(this.surface), face: faceId, edge: face.edge, anchor: [...face.anchor!], normal: [...this.surface.normal] }, face: faceId, edge: `${this.surface.id}:${face.edge}`, start, end, intervalStart: startTime + elapsed, intervalEnd: startTime + elapsed + dt, time: startTime + elapsed + dt, volume, momentum, velocity: divide(meanPrimitiveMomentum, rho * volume), height: H,
              layered: { version: FOUR_LAYER_FILM_MODE, layers, advectiveMomentum, pressureImpulse, numericalMomentumCorrection, profileKinetic, potential, pressureWork, energyFlux, numericalEnergyFlux, energyStatus: 'ENERGY_UNKNOWN' } });
            this.releasedVolume += volume; outgoingEnergy += energyFlux;
            observer?.capture('outlets', this.outflows[this.outflows.length - 1]);
            ledger.outletEnergyFlux += energyFlux; ledger.outletNumericalEnergyFlux += numericalEnergyFlux;
          }
        }
        observer?.horizontal(next, incomingEnergy, outgoingEnergy);
        backpressure?.stage('horizontal',next);
        next.forEach((column, cell) => validateLayerColumn(column, { stage: 'post-horizontal-source', cell, operands: () => ({
          startTime, elapsed, substep: steps, duration, dt, area: this.areas[cell], bed: 9.81 * this.centers[cell][1], gn: this.normalGravity, gt: this.tangentialGravity, rho, mu: .001, beforeColumn: state.columns[cell],
          incidentFaces: this.faces.flatMap((face, id) => face.left === cell || face.right === cell ? [{ face: id, left: face.left, right: face.right, normal: face.normal, length: face.length,
            bed: 9.81 * (face.start[1] + face.end[1]) * .5, factor: face.length * dt, orientation: face.left === cell ? -1 : 1,
            leftArea: face.left >= 0 ? this.areas[face.left] : 1, rightArea: face.right >= 0 ? this.areas[face.right] : 1,
            leftColumn: face.left >= 0 ? state.columns[face.left] : emptyColumn(), rightColumn: face.right >= 0 ? state.columns[face.right] : emptyColumn(),
            maximumNormalSpeedReconstructed: Math.max(...[face.left, face.right].flatMap(c => (c >= 0 ? state.columns[c] : emptyColumn()).volumes.map((v, k) => v > 0 ? Math.abs(dot(divide(state.columns[c].momenta[k], rho * v), face.normal)) : 0))),
            gravityWaveSpeedReconstructed: Math.sqrt(this.normalGravity * Math.max(face.left >= 0 ? this.volumes[face.left] / this.areas[face.left] : 0, face.right >= 0 ? this.volumes[face.right] / this.areas[face.right] : 0)),
            flux: fluxes[id], source: active.get(id) ?? null, sourceFraction: fraction,
            sourceAppliedReconstructed: active.has(id) ? [active.get(id)!.minus, active.get(id)!.plus].map((port, side) => ({
              cell: side === 0 ? face.left : face.right, order: 'for k0..3 add V then advective P; afterward for k0..3 add pressure P',
              quarterVolume: port.volume * fraction / 4, quarterAdvectiveMomentum: mul(mul(port.velocity, rho * port.volume), fraction / 4),
              quarterPressureImpulse: mul(mul(mul(face.normal, side === 0 ? -1 : 1), .5 * rho * this.normalGravity * port.height ** 2 * face.length * duration), fraction / 4)
            })) : null }] : [])
        }) })); state.columns = next; this.syncLayerTotals();
        const transportedEnergy = this.energy();
        observer?.oldStageEnergy(before, transportedEnergy);
        ledger.transportLossSigned += before + incomingEnergy - transportedEnergy - outgoingEnergy;
        for (let c = 0; c < next.length; c++) for (let k = 0; k < 4; k++) {
          const massTime = rho * next[c].volumes[k] * dt;
          next[c].momenta[k] = add(next[c].momenta[k], mul(this.tangentialGravity, massTime));
          observer?.gravityIncrement(c, k, mul(this.tangentialGravity, massTime));
          backpressure?.operation({cell:c,kind:'gravity',layer:k,massTime,momentum:mul(this.tangentialGravity,massTime)});
          this.gravityImpulse = add(this.gravityImpulse, mul(g, massTime)); this.supportImpulse = add(this.supportImpulse, mul(this.surface.normal, this.normalGravity * massTime));
        }
        this.syncLayerTotals(); const afterGravityEnergy = this.energy(), gravityChange = afterGravityEnergy - transportedEnergy; ledger.gravityIntegrationChangeSigned += gravityChange;
        observer?.gravity(next);
        backpressure?.stage('gravity',next);
        observer?.oldStageEnergy(before, transportedEnergy, afterGravityEnergy);
        // Screen each accepted substep without canceling a gain against another
        // substep's loss. The fixed relative numerical tolerance has no energy
        // floor and is not a formal roundoff bound or physical work. Positive
        // losses retain their full value for the parent's separate 5% screen.
        const hg = before + incomingEnergy - transportedEnergy - outgoingEnergy - gravityChange;
        const hgAllowance = 1e-10 * [before, incomingEnergy, transportedEnergy, outgoingEnergy, afterGravityEnergy, transportedEnergy].reduce((sum, v) => sum + Math.abs(v), 0);
        ledger.horizontalGravityLossPositive += Math.max(0, hg); ledger.horizontalGravityGainMagnitude += Math.max(0, -hg);
        ledger.horizontalGravityNumericalTolerance += hgAllowance;
        // A rejected native tick is not replayed. Preserve only this bounded
        // substep's causal operands in its error; rollback still rejects every
        // failed water state and restores all owned inventory and ledgers.
        const rejection = { startTime, elapsed, dt, beforeEnergy: before, incomingEnergy, transportedEnergy, outgoingEnergy, afterGravityEnergy,
          horizontalGravityChangeSigned: hg, numericalTolerance: hgAllowance,
          sourceInsertionPotentialChangeSigned: ledger.sourceInsertionPotentialChangeSigned - sourceBefore.insertion,
          sourcePrimitiveMixingLossSigned: ledger.sourcePrimitiveMixingLossSigned - sourceBefore.mixing,
          sourcePressureIntegrationKineticChangeSigned: ledger.sourcePressureIntegrationKineticChangeSigned - sourceBefore.pressureIntegration };
        if (-hg > hgAllowance) throw Error(`layered-film-horizontal-gravity-energy-gain:${JSON.stringify(rejection)}`);
        let remapLoss = 0;
        for (let c = 0; c < next.length; c++) {
          const remapped = remapFilmLayers(next[c], { cell: c, operands: () => ({ startTime, elapsed, substep: steps, duration, dt, area: this.areas[c], bed: 9.81 * this.centers[c][1], gn: this.normalGravity, gt: this.tangentialGravity, rho, mu: .001 }) }); remapLoss += remapped.kineticLossSigned;
          const remapAllowance = 1e-10 * (Math.abs(layerKinetic(next[c])) + Math.abs(layerKinetic(remapped.column)));
          ledger.remapLossPositive += Math.max(0, remapped.kineticLossSigned); ledger.remapGainMagnitude += Math.max(0, -remapped.kineticLossSigned); ledger.remapNumericalTolerance += remapAllowance;
          if (-remapped.kineticLossSigned > remapAllowance) throw Error(`layered-film-remap-energy-gain:${JSON.stringify({ ...rejection, column: c, beforeColumn: next[c], afterColumn: remapped.column, remapChangeSigned: remapped.kineticLossSigned, remapNumericalTolerance: remapAllowance })}`);
          let diffusionObservation:unknown;
          const diffuse=this.firstImpactModel===KINETIC_EXACT_IMPACT_MODEL?diffuseFilmLayersExact:diffuseFilmLayers;
          const diffused = diffuse(remapped.column, this.areas[c], dt, { cell: c, operands: () => ({ startTime, elapsed, substep: steps, duration, bed: 9.81 * this.centers[c][1], gn: this.normalGravity, gt: this.tangentialGravity }),observeDiffusion:backpressure?(value)=>{diffusionObservation=value;}:undefined });
          // Exact subflow evaluation error is numerical and counted once. It
          // is separate from physical modal dissipation and legacy BE loss.
          const exact=(diffused as ReturnType<typeof diffuseFilmLayersExact>).exact;
          if(exact){const loss=exact.evaluationLossSigned;ledger.exactViscosityEvaluationLossSigned=(ledger.exactViscosityEvaluationLossSigned??0)+loss;ledger.exactViscosityEvaluationLossPositive=(ledger.exactViscosityEvaluationLossPositive??0)+Math.max(0,loss);ledger.exactViscosityEvaluationGainMagnitude=(ledger.exactViscosityEvaluationGainMagnitude??0)+Math.max(0,-loss);ledger.exactViscosityEvaluationTolerance=(ledger.exactViscosityEvaluationTolerance??0)+exact.evaluationTolerance;this.numericalEnergyLossSigned+=loss;}
          backpressure?.vertical(c,next[c],remapped.column,diffused.column,diffusionObservation??(dt===0||remapped.column.volumes.every(v=>v===0)?{emptyOrZeroDt:true,wallImpulse:diffused.wallImpulse,internalImpulses:[],rangeFlags:diffused.lossUnderflow}:{observationError:'missing-diffusion-observation'}));
          observer?.vertical(c, next[c], remapped.column, diffused.column, remapped.kineticLossSigned, diffused.temporalLoss, diffused.viscousLoss);
          state.columns[c] = diffused.column; ledger.viscousLoss += diffused.viscousLoss; ledger.backwardEulerLoss += diffused.temporalLoss;
          // Binary64 cannot hold every physical tail momentum. Keep its water
          // and explicit wall reaction, and disclose final rounding without
          // calling it a dry cell, a velocity reset or accepted energy closure.
          ledger.momentumUnderflowComponents = (ledger.momentumUnderflowComponents ?? 0) + diffused.momentumUnderflowComponents;
          if (!ledger.firstMomentumUnderflow && diffused.firstMomentumUnderflow) ledger.firstMomentumUnderflow = { ...structuredClone(diffused.firstMomentumUnderflow), cell: c, startTime, elapsed, substep: steps };
          for (const kind of ['viscous', 'temporal'] as const) {
            const factored = diffused.lossUnderflow[kind];
            if (factored) {
              ledger.lossUnderflowComponents = (ledger.lossUnderflowComponents ?? 0) + 1;
              if (!ledger.firstLossUnderflow) ledger.firstLossUnderflow = { kind, factored: { ...factored }, cell: c, startTime, elapsed, substep: steps };
            }
          }
          ledger.wallViscousImpulse = add(ledger.wallViscousImpulse, diffused.wallImpulse); this.supportImpulse = add(this.supportImpulse, diffused.wallImpulse);
        }
        ledger.remapLossSigned += remapLoss; this.syncLayerTotals();
        backpressure?.completeSubstep();
        ledger.completedSubsteps++;
        this.numericalEnergyLossSigned += before + incomingEnergy - transportedEnergy - outgoingEnergy - gravityChange + remapLoss;
        if (![this.energy(), ...Object.values(ledger).flatMap(v => Array.isArray(v) ? v : typeof v === 'number' ? [v] : [])].every(Number.isFinite)) throw Error('layered-film-nonfinite-ledger');
        if (finiteInterval) finiteSupply!.accept(finiteInterval);
        elapsed += dt; appliedFraction += fraction; steps++; this.substeps++;
      }
    } catch (error) { observer?.finish(error instanceof Error ? error.message : 'film-failure'); backpressure?.finish(); this.restoreState(saved); this.failure = error instanceof Error ? error.message : 'film-failure'; this.rejectedStage = error instanceof LayeredFilmStageFailure ? structuredClone(error.diagnostic) : null; throw error; }
    observer?.finish();
    backpressure?.finish();
    return cloneOutflows(this.outflows);
  }
  /** Source samples keep their actual pressure traction and primitive kinetic
   * energy. Averaging their heights/velocities would change the nonlinear law.
   * True curved-strike measure is mapped conservatively to the existing chord
   * face's two cells; ordinary frozen transport uses only its uncovered measure.
   * The cell-center bed mismatch remains numerical insertion evidence.
   */
  private applyFiniteSourceSample(sample: FiniteSourceSample, next: FilmLayerColumn[], start: number, end: number,observation?:{sampleIndex:number;ordinaryChordMeasure:number|undefined;coveredChordMeasure:number}): void {
    // The opt-in source adds finite material to resident water. It supplies no
    // hydraulic port state or pressure/work; ordinary Film faces supply those
    // forces. This permits numerical subcritical receivers without qualifying
    // arbitrary submerged impact or the full-cell wetted-area approximation.
    if((sample.firstImpactModel??'hydraulic-be-v1')!==this.firstImpactModel)throw Error('film-source-impact-model-mismatch');
    const face = this.faces[sample.face], ledger = this.layered!.ledger, observer = this.energyObserver;
    for (const [cell, port] of [[face.left, sample.minus], [face.right, sample.plus]] as const) {
      if (!(port.volume > 0) || ![port.volume, port.height, port.profileKinetic, port.potential, port.pressureWork, ...port.velocity, ...port.pressureImpulse, ...port.advectiveMomentum].every(Number.isFinite)) throw Error('finite-source-invalid-port');
      const H = this.volumes[cell] / this.areas[cell], up = dot(port.velocity, port.normal);
      if(sample.firstImpactModel===KINETIC_EXACT_IMPACT_MODEL){
        const incomingVelocity=divide(sample.incoming.momentum,rho*sample.incoming.volume),vn=dot(incomingVelocity,this.surface.normal),head=.5*dot(incomingVelocity,incomingVelocity),ratio=this.normalGravity*H/head;
        if(!(vn<0&&head>0)||![vn,head,H,ratio].every(Number.isFinite))throw Error('kinetic-impingement-applicability-range');
        const previous=ledger.impingementApplicability;ledger.impingementApplicability={qualification:'UNQUALIFIED',maximumReceiverDepth:Math.max(previous?.maximumReceiverDepth??0,H),maximumHydrostaticToIncidentKineticHeadRatio:Math.max(previous?.maximumHydrostaticToIncidentKineticHeadRatio??0,ratio),minimumIncidentNormalSpeed:Math.min(previous?.minimumIncidentNormalSpeed??Infinity,-vn),fullCellWetArea:true};
      }
      const slowest = Math.min(...this.layered!.columns[cell].volumes.map((v,k) => v > 0 ? dot(divide(this.layered!.columns[cell].momenta[k], rho*v), port.normal) : up));
      if (sample.firstImpactModel!==KINETIC_EXACT_IMPACT_MODEL&&!(Math.min(up - Math.sqrt(this.normalGravity * port.height), H > 0 ? slowest - Math.sqrt(this.normalGravity * H) : up - Math.sqrt(this.normalGravity * port.height)) > 0)) {
        if(this.backpressureObserver&&observation)throw new FilmBackpressureFailure(this.backpressureObserver.reject(this.backpressureOperands(sample,cell,port,start,end,H,up,slowest,observation)));
        throw Error('film-junction-backpressure');
      }
      if(sample.firstImpactModel!==KINETIC_EXACT_IMPACT_MODEL&&this.backpressureObserver&&observation)this.backpressureObserver.pass(this.backpressureOperands(sample,cell,port,start,end,H,up,slowest,observation));
      if (Math.abs(dot(port.velocity, this.surface.normal)) > 1e-10 * Math.hypot(...port.velocity)) throw Error('film-junction-nontangential-port');
      const priorSourceV = next[cell].volumes.reduce((s,v) => s+v,0), priorSourceK = layerKinetic(next[cell]);
      observer?.capture('sources', { face: sample.face, cell, normal: port.normal, port, fraction: 1, priorSourceColumn: next[cell], bed: 9.81 * sample.position[1], cellBed: 9.81 * this.centers[cell][1], supplyingInterval: [start,end], applicationInterval: [start,end], sourceWork: port.pressureWork, advectiveEnergy: port.advectiveEnergy, originalId: sample.originalId, arrivalTimeMean: sample.arrivalTimeMean, measureLengthTime: sample.measureLengthTime });
      for (let k=0;k<4;k++) {
        next[cell].volumes[k] += port.volume / 4;
        next[cell].momenta[k] = add(next[cell].momenta[k], mul(port.advectiveMomentum, 1 / 4));
        observer?.increment({ kind: 'source-primitive', cell, layer: k, volume: port.volume/4, momentum: mul(port.advectiveMomentum,1/4), face: sample.face });
      }
      const primitiveSourceK = layerKinetic(next[cell]); observer?.sourceEndpoint('primitive',next[cell]);
      if(sample.firstImpactModel!==KINETIC_EXACT_IMPACT_MODEL)for (let k=0;k<4;k++) {
        next[cell].momenta[k] = add(next[cell].momenta[k], mul(port.pressureImpulse, 1 / 4));
        observer?.increment({ kind: 'source-pressure', cell, layer: k, volume: 0, momentum: mul(port.pressureImpulse,1/4), face: sample.face });
      }
      observer?.sourceEndpoint('pressure',next[cell]);
      ledger.sourcePrimitiveMixingLossSigned += priorSourceK + port.profileKinetic - primitiveSourceK;
      ledger.sourcePressureIntegrationKineticChangeSigned += layerKinetic(next[cell]) - primitiveSourceK;
      ledger.sourceInsertionPotentialChangeSigned += sample.firstImpactModel===KINETIC_EXACT_IMPACT_MODEL?rho*port.volume*(9.81*this.centers[cell][1]-9.81*sample.position[1])+rho*this.normalGravity*port.volume*(priorSourceV+port.volume/2)/this.areas[cell]:rho * port.volume * (9.81 * this.centers[cell][1] - 9.81 * sample.position[1])
        + .5 * rho * this.normalGravity * ((priorSourceV + port.volume) ** 2 - priorSourceV ** 2) / this.areas[cell] - .5 * rho * port.volume * this.normalGravity * port.height;
      ledger.sourceAdvectiveMomentum = add(ledger.sourceAdvectiveMomentum,port.advectiveMomentum); ledger.sourcePressureImpulse = add(ledger.sourcePressureImpulse,port.pressureImpulse);
      ledger.sourcePressureWork += port.pressureWork; ledger.sourceAdvectiveEnergy += port.advectiveEnergy;
      this.backpressureObserver?.operation({cell,kind:'source-applied',sample,port,start,end,afterAssembly:next[cell],layerVolumeIncrement:port.volume/4,layerAdvectiveMomentum:mul(port.advectiveMomentum,1/4),layerPressureImpulse:mul(port.pressureImpulse,1/4)});
    }
    this.junctionIncomingEnergy += sample.incoming.kinetic + sample.incoming.potential; this.junctionOutgoingEnergy += sample.minus.energy + sample.plus.energy;
    this.normalReaction = add(this.normalReaction,sample.reaction); this.capturedVolume += sample.incoming.volume;
  }
  private syncLayerTotals(): void {
    if (!this.layered) return;
    this.volumes = this.layered.columns.map(c => c.volumes.reduce((s, v) => s + v, 0));
    this.momenta = this.layered.columns.map(c => c.momenta.reduce((s, p) => add(s, p), [0, 0, 0] as ContactVec3));
  }
  private backpressureOperands(sample:FiniteSourceSample,cell:number,port:FiniteSourceSample['plus'],start:number,end:number,H:number,up:number,slowest:number,observation:{sampleIndex:number;ordinaryChordMeasure:number|undefined;coveredChordMeasure:number}):BackpressureGuardOperands {
    const face=this.faces[sample.face];
    return {cell,sampleIndex:observation.sampleIndex,side:port===sample.minus?'minus':'plus',sample,port,column:this.layered!.columns[cell],area:this.areas[cell],bed:9.81*this.centers[cell][1],gn:this.normalGravity,rho,H,up,slowest,mapping:{start,end,...observation,face,ledgeNormal:this.surface.normal,receiverOutwardConormal:mul(face.normal,cell===face.left?1:-1)}};
  }

  snapshot(): FilmSnapshot {
    let volume = 0, momentum: ContactVec3 = [0, 0, 0];
    const cells = this.volumes.map((v, c) => { volume += v; momentum = add(momentum, this.momenta[c]); return { id: c, corners: this.corners[c].map(p => [...p] as ContactVec3) as FilmCell['corners'], center: [...this.centers[c]] as ContactVec3, volume: v, height: v / this.areas[c], velocity: this.velocity(c), tangentialMomentum: [...this.momenta[c]] as ContactVec3 }; });
    return { ...(this.firstImpactModel===KINETIC_EXACT_IMPACT_MODEL?{firstImpactModel:KINETIC_EXACT_IMPACT_MODEL}:{}), ...(this.rejectedStage ? { rejectedStage: structuredClone(this.rejectedStage) } : {}), ...(this.layered ? { layered: structuredClone(this.layered) } : {}), surfaceId: this.surface.id, nx: this.nx, nz: this.nz, cells, outflows: cloneOutflows(this.outflows), receipt: { junctionIncomingEnergy: this.junctionIncomingEnergy, junctionOutgoingEnergy: this.junctionOutgoingEnergy, volume, momentum, capturedVolume: this.capturedVolume, releasedVolume: this.releasedVolume, normalReaction: [...this.normalReaction], normalEnergyLoss: this.normalEnergyLoss, mixingEnergyLoss: this.mixingEnergyLoss, depositionPotentialEnergyChange: this.depositionPotentialEnergyChange, numericalEnergyLossSigned: this.numericalEnergyLossSigned, gravityImpulse: [...this.gravityImpulse], supportImpulse: [...this.supportImpulse], normalGravity: this.normalGravity, tangentialGravity: [...this.tangentialGravity], maximumCourant: this.maximumCourant, substeps: this.substeps, failure: this.failure } };
  }
  saveState(): FilmState { return { ...(this.firstImpactModel===KINETIC_EXACT_IMPACT_MODEL?{firstImpactModel:KINETIC_EXACT_IMPACT_MODEL}:{}), ...(this.rejectedStage ? { rejectedStage: structuredClone(this.rejectedStage) } : {}), ...(this.layered ? { layered: structuredClone(this.layered) } : {}), junctionGeometry: this.junctionGeometry ? { ...(this.junctionGeometry.subdivision ? { subdivision: this.junctionGeometry.subdivision } : {}), locus: this.junctionGeometry.locus.map(p => [...p]), spanKnots: [...(this.junctionGeometry.spanKnots ?? [])] } : null, originalNx: this.originalNx, originalNz: this.originalNz, junctionIncomingEnergy: this.junctionIncomingEnergy, junctionOutgoingEnergy: this.junctionOutgoingEnergy, volumes: [...this.volumes], momenta: this.momenta.map(p => [...p]), capturedVolume: this.capturedVolume, releasedVolume: this.releasedVolume, normalReaction: [...this.normalReaction], normalEnergyLoss: this.normalEnergyLoss, mixingEnergyLoss: this.mixingEnergyLoss, depositionPotentialEnergyChange: this.depositionPotentialEnergyChange, numericalEnergyLossSigned: this.numericalEnergyLossSigned, gravityImpulse: [...this.gravityImpulse], supportImpulse: [...this.supportImpulse], maximumCourant: this.maximumCourant, substeps: this.substeps, outflows: cloneOutflows(this.outflows), failure: this.failure }; }
  restoreState(s: FilmState): void {
    if((s.firstImpactModel??'hydraulic-be-v1')!==this.firstImpactModel)throw Error('film-first-impact-state-mismatch');
    if (Boolean(s.layered) !== Boolean(this.layered) || s.layered && s.layered.mode !== this.mode) throw Error('film-state-mode-mismatch');
    for (const row of s.outflows) {
      if (this.layered) validateLayeredFilmOutlet(row);
      else if (row.layered) throw Error('film-state-mode-mismatch');
    }
    if (s.layered) {
      if (s.layered.columns.length !== s.volumes.length || s.momenta.length !== s.volumes.length || s.layered.ledger.wallWork !== 0 || s.layered.ledger.energyStatus !== 'ENERGY_UNKNOWN') throw Error('layered-film-state-shape');
      if (s.layered.ledger.numericalToleranceRelative !== 1e-10 || !Number.isSafeInteger(s.layered.ledger.completedSubsteps) || s.layered.ledger.completedSubsteps < 0) throw Error('layered-film-state-numerical-contract');
      for (const [key, expected] of Object.entries(emptyLayerLedger())) {
        const actual = s.layered.ledger[key as keyof LayeredFilmLedger];
        if ((key === 'momentumUnderflowComponents' || key === 'lossUnderflowComponents') && actual === undefined) continue;
        if (typeof expected === 'number' && (typeof actual !== 'number' || !Number.isFinite(actual))
          || Array.isArray(expected) && (!Array.isArray(actual) || actual.length !== 3 || !actual.every(Number.isFinite))) throw Error('layered-film-nonfinite-ledger');
      }
      const count = s.layered.ledger.momentumUnderflowComponents;
      if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) throw Error('layered-film-underflow-count');
      const lossCount = s.layered.ledger.lossUnderflowComponents, lossWitness = s.layered.ledger.firstLossUnderflow;
      if (lossCount !== undefined && (!Number.isSafeInteger(lossCount) || lossCount < 0)) throw Error('layered-film-underflow-count');
      if (lossWitness && (!['viscous', 'temporal'].includes(lossWitness.kind)
        || ![lossWitness.cell, lossWitness.substep].every(Number.isSafeInteger) || lossWitness.cell < 0 || lossWitness.cell >= s.layered.columns.length || lossWitness.substep < 0
        || ![lossWitness.startTime, lossWitness.elapsed, lossWitness.factored.mantissa].every(Number.isFinite) || !Number.isSafeInteger(lossWitness.factored.exponent))) throw Error('layered-film-underflow-witness');
      const witness = s.layered.ledger.firstMomentumUnderflow;
      for(const key of ['exactViscosityEvaluationLossSigned','exactViscosityEvaluationLossPositive','exactViscosityEvaluationGainMagnitude','exactViscosityEvaluationTolerance'] as const){const value=s.layered.ledger[key];if(value!==undefined&&(typeof value!=='number'||!Number.isFinite(value)||key!=='exactViscosityEvaluationLossSigned'&&value<0))throw Error('layered-film-exact-evaluation-ledger');}
      const applicability=s.layered.ledger.impingementApplicability;if(applicability&&(applicability.qualification!=='UNQUALIFIED'||applicability.fullCellWetArea!==true||![applicability.maximumReceiverDepth,applicability.maximumHydrostaticToIncidentKineticHeadRatio,applicability.minimumIncidentNormalSpeed].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)))throw Error('layered-film-impingement-applicability-ledger');
      if (witness && (![witness.cell, witness.layer, witness.component, witness.substep].every(Number.isSafeInteger)
        || witness.cell < 0 || witness.cell >= s.layered.columns.length || witness.layer < 0 || witness.layer > 3 || witness.component < 0 || witness.component > 2 || witness.substep < 0
        || ![witness.startTime, witness.elapsed, witness.momentumFactored.mantissa, witness.velocityFactored.mantissa].every(Number.isFinite)
        || ![witness.momentumFactored.exponent, witness.velocityFactored.exponent].every(Number.isSafeInteger))) throw Error('layered-film-underflow-witness');
      s.layered.columns.forEach((column, c) => {
        validateLayerColumn(column);
        const volume = column.volumes.reduce((sum, v) => sum + v, 0), momentum = column.momenta.reduce((sum, p) => add(sum, p), [0, 0, 0] as ContactVec3);
        if (volume !== s.volumes[c] || momentum.some((p, axis) => p !== s.momenta[c][axis])) throw Error('layered-film-state-total-mismatch');
        // Fixed pressure shares require every face evaluation to begin on the
        // same sigma grid. Accept only the actual cumulative quarter intervals;
        // restoration never silently remaps a different historical profile.
        if (column.volumes.some((v, k) => Math.abs(v - ((k === 3 ? volume : volume * (k + 1) / 4) - volume * k / 4)) > 8 * Number.EPSILON * volume)) throw Error('layered-film-state-nonsigma-column');
      });
      if (!Object.values(s.layered.ledger).flatMap(v => Array.isArray(v) ? v : typeof v === 'number' ? [v] : []).every(Number.isFinite)) throw Error('layered-film-nonfinite-ledger');
    }
    if (s.originalNx !== this.originalNx || s.originalNz !== this.originalNz) throw Error('film-state-grid-mismatch');
    if (s.junctionGeometry && !this.junctionGeometry) this.configureJunction(s.junctionGeometry);
    if (JSON.stringify(s.junctionGeometry) !== JSON.stringify(this.junctionGeometry) || s.volumes.length !== this.areas.length) throw Error('film-state-geometry-mismatch');
    this.junctionIncomingEnergy = s.junctionIncomingEnergy; this.junctionOutgoingEnergy = s.junctionOutgoingEnergy; this.volumes = [...s.volumes]; this.momenta = s.momenta.map(p => [...p]); this.capturedVolume = s.capturedVolume; this.releasedVolume = s.releasedVolume; this.normalReaction = [...s.normalReaction]; this.normalEnergyLoss = s.normalEnergyLoss; this.mixingEnergyLoss = s.mixingEnergyLoss; this.depositionPotentialEnergyChange = s.depositionPotentialEnergyChange; this.numericalEnergyLossSigned = s.numericalEnergyLossSigned; this.gravityImpulse = [...s.gravityImpulse]; this.supportImpulse = [...s.supportImpulse]; this.maximumCourant = s.maximumCourant; this.substeps = s.substeps; this.outflows = cloneOutflows(s.outflows); this.failure = s.failure;
    if (s.layered) this.layered = structuredClone(s.layered);
    this.rejectedStage = s.rejectedStage ? structuredClone(s.rejectedStage) : null;
  }
}
