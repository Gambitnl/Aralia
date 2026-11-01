/**
 * Carries finite amounts of water over explicit rock ledges.
 * The preview reads these parcels and these same rock polygons. Gravity and
 * inelastic rock contacts change their motion; source discharge admits water.
 * The first ledge owns a pressure-bearing film; its actual edge flux releases
 * finite outflow packets. Incoming source-width bins carry explicit material
 * intervals; their center contact and the lower flight remain coarse samples.
 * The optional junction mode redirects first source impacts into separate
 * pressure-bearing film ports. Absorption remains the comparison default.
 * Independent terrain comparisons can supply fixed, validated rock quads;
 * the native default still generates its original three source-scaled ledges.
 * Optional original-release routing retains exact Film flux before aggregation;
 * claimed water stays owned here until an atomic external admission succeeds.
 * DEBT: This is a coarse contact/film prototype, not a continuum fluid solver.
 * Nonpenetration applies to parcel centers, not to any displayed parcel radius.
 * There is no free-flight liquid pressure, air coupling, viscosity or breakup.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 25/10/2026, 02:10:57
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx, components/World3D/water/riverWaterfallView.ts, components/World3D/water/waterfallAttachedFilmView.ts, components/World3D/water/waterfallComparisonLandscape.ts, components/World3D/water/waterfallContactView.ts, components/World3D/water/waterfallTerrainComparisonView.ts, systems/world3d/river/riverLive.ts, systems/world3d/river/waterfallBackpressureObserver.ts, systems/world3d/river/waterfallContactFilm.ts, systems/world3d/river/waterfallContactGeometry.ts, systems/world3d/river/waterfallFilmFront.ts, systems/world3d/river/waterfallImpactLocus.ts, systems/world3d/river/waterfallLayeredFilm.ts, systems/world3d/river/waterfallLayeredFilmEnergyObserver.ts, systems/world3d/river/waterfallMaterialReachPort.ts, systems/world3d/river/waterfallPresentationSnapshot.ts, systems/world3d/river/waterfallSourceContact.ts, systems/world3d/river/waterfallSourceSupport.ts, systems/world3d/river/waterfallTerrainComparisons.ts, systems/world3d/river/waterfallTerrainProfiles.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { waterfallDownwardRoot } from './waterfallFlightRoots';
import { WaterfallContactFilm, validateLayeredFilmOutlet, type FilmMode, type FilmSnapshot, type FilmState, type FilmOutflow, type FilmJunctionTransfer, type FilmReleaseOrigin } from './waterfallContactFilm';
import { FINITE_SOURCE_SUPPORT_MODE, FiniteSourceSupply, FiniteSourceQuadratureFailure, WaterfallSourceSupport, emptySourceSupportMoments, addSourceSupportMoments, type SourceSupportCarrier, type SourceSupportMoments, type FiniteSourceStepReceipt, type FiniteSourceFailureDiagnostic } from './waterfallSourceSupport';
import type { FilmEnergyObserver } from './waterfallLayeredFilmEnergyObserver';
import { FilmBackpressureFailure, type FilmBackpressureObserver, type FilmBackpressureDiagnostic } from './waterfallBackpressureObserver';
import { LayeredFilmStageFailure, type LayeredFilmFailureDiagnostic, FOUR_LAYER_FILM_MODE,KINETIC_EXACT_IMPACT_MODEL,type FirstImpactModel,layerKinetic } from './waterfallLayeredFilm';
import { waterfallImpactLocus } from './waterfallImpactLocus';
import { solveWaterfallImpactJunction } from './waterfallImpactJunction';
import { waterfallContactGeometryIdentity } from './waterfallContactGeometry';
export type ContactVec3 = [number, number, number];
export interface ContactSurface { id: string; vertices: [ContactVec3, ContactVec3, ContactVec3, ContactVec3]; normal: ContactVec3 }
export interface ContactSource { q: number; width: number; depth: number; speed: number; top?: number; pool?: number }
export interface SheetRelease { edge: string; start: ContactVec3; end: ContactVec3; intervalStart: number; intervalEnd: number; velocity: ContactVec3; birthTime: number }
export interface ContactReleaseLocal extends FilmReleaseOrigin { clearance: number; displacement: ContactVec3; referenceTime: number }
/** A point packet constrained to one finite lower quad, not a lower water film. */
export interface ContactSupport { surfaceId: string; geometryIdentity: string; coordinate: [number, number]; velocity: [number, number]; referenceTime: number }
export interface ContactParcel { support?: ContactSupport; motionRevision?: number; releaseLocal?: ContactReleaseLocal; id: number; position: ContactVec3; velocity: ContactVec3; volume: number; birth: number; contactCount: number; contactEnergy: number; sheetRelease?: SheetRelease; sourceRelease?: SheetRelease; sourceSection?: { width: number; depth: number; speed: number; top: number } }
export interface ContactParcel { sourceSupport?: SourceSupportCarrier }

// Rollback and display copy these tiny records thousands of times per tick.
// Copy ordinary coordinates directly instead of invoking the browser's generic
// graph cloner for each parcel. Extended, sparse or aliased records retain the
// old clone path, so diagnostics and future metadata keep their full meaning.
function plainCoordinate(value: unknown, size: number): value is number[] {
  if (!Array.isArray(value) || value.length !== size || Object.keys(value).length !== size
    || Object.getOwnPropertySymbols(value).length) return false;
  for (let i = 0; i < size; i++) if (!Object.hasOwn(value, i) || typeof value[i] !== 'number') return false;
  return true;
}
function copyReleaseCoordinates(value: ContactReleaseLocal): ContactReleaseLocal {
  if (Object.keys(value).length !== 9 || Object.getOwnPropertySymbols(value).length
    || typeof value.surfaceId !== 'string' || typeof value.geometryIdentity !== 'string' || typeof value.edge !== 'string'
    || typeof value.face !== 'number' || typeof value.clearance !== 'number' || typeof value.referenceTime !== 'number'
    || !plainCoordinate(value.anchor, 2) || !plainCoordinate(value.normal, 3) || !plainCoordinate(value.displacement, 3)
    || value.normal === value.displacement) return structuredClone(value);
  return { ...value, anchor: [...value.anchor], normal: [...value.normal], displacement: [...value.displacement] };
}
function copySupportCoordinates(value: ContactSupport): ContactSupport {
  if (Object.keys(value).length !== 5 || Object.getOwnPropertySymbols(value).length
    || typeof value.surfaceId !== 'string' || typeof value.geometryIdentity !== 'string' || typeof value.referenceTime !== 'number'
    || !plainCoordinate(value.coordinate, 2) || !plainCoordinate(value.velocity, 2)
    || value.coordinate === value.velocity) return structuredClone(value);
  return { ...value, coordinate: [...value.coordinate], velocity: [...value.velocity] };
}
// Opt-in final spatial test; the live/default solver retains its existing mesh.
export interface ContactOptions { firstImpactModel?:FirstImpactModel; filmSubdivision?: 'none' | '4x3-v1' }
export interface ContactFlowState { firstImpactModel?:typeof KINETIC_EXACT_IMPACT_MODEL; filmSubdivision?: '4x3-v1' }
export interface ContactReceipt { firstImpactModel?:typeof KINETIC_EXACT_IMPACT_MODEL; filmSubdivision?: '4x3-v1' }
export interface ContactFiniteSourceReceipt {
  mode: typeof FINITE_SOURCE_SUPPORT_MODE; delivered: SourceSupportMoments; remaining: SourceSupportMoments;
  firstArrival: number | null; lastArrival: number | null; lastTickSteps: FiniteSourceStepReceipt[];
  betaRelativeDeviationMaximum: number; mappedChordPositionMoment: ContactVec3; curveToChordPositionMoment: ContactVec3;
  curveToChordBedPotentialChange: number;
  cumulativeClosureEnergyDifference: number; cumulativeDeliveredIncomingKinetic: number;
  qualification: 'midsurface-birth-span-support';
}
export interface ContactReceipt { sourceSupport?: ContactFiniteSourceReceipt }
export interface ContactFlowState { sourceSupportMode?: typeof FINITE_SOURCE_SUPPORT_MODE; sourceSupportReceipt?: ContactFiniteSourceReceipt }
export interface ContactArrival { time: number; volume: number; momentum: ContactVec3; weightedPosition: ContactVec3; position: ContactVec3; velocity: ContactVec3 }
export interface ContactAdvance { time: number; volume: number; momentum: ContactVec3; weightedPosition: ContactVec3; arrivals: ContactArrival[] }
export interface ContactReceipt {
  originalReleaseOwnership?: ContactOriginalReleaseReceipt;
  support?: ContactSupportReceipt;
  airborneTrajectory?: 'constant-gravity';
  junctionRemap: ContactJunctionRemap;
  failureDiagnostic: ContactJunctionFailureDiagnostic | LayeredFilmFailureDiagnostic | FiniteSourceFailureDiagnostic | FilmBackpressureDiagnostic | null;
  energy: ContactEnergyReceipt;
  time: number; emittedVolume: number; airborneVolume: number; filmVolume: number; totalOwnedVolume: number; landedVolume: number; budgetError: number;
  emittedMomentum: ContactVec3; airborneMomentum: ContactVec3; landedMomentum: ContactVec3;
  filmMomentum: ContactVec3; totalOwnedMomentum: ContactVec3; releaseMixingEnergyLoss: number;
  gravityImpulse: ContactVec3; rockImpulse: ContactVec3; contactCount: number; contactEnergy: number;
  surfaceContactCounts: Record<string, number>;
  ticks: number; lastAdvanceSteps: number; lastAdvanceMilliseconds: number; lagSeconds: number;
  failure: string | null; parcelCount: number;
}
export interface ContactSupportCounters { impulse: ContactVec3; kineticChange: number; potentialChange: number; conversionKineticChange: number; conversionPotentialChange: number }
export interface ContactSupportReceipt extends ContactSupportCounters { volume: number; momentum: ContactVec3; kinetic: number; potential: number; wallImpulse: ContactVec3; theoreticalWork: 0; numericalEnergyChangeSigned: number }
export interface ContactJunctionFailureDiagnostic { tickTime: number; parcel: ContactParcel; hit: ContactVec3; fraction: number }
/** Coarse source-bin remap measurements, not exact support proofs. */
/** One-tick observation copies the arrival data that ordinary source admission
 * consumes. It is separate from water ownership and never restores physics. */
export interface ContactFilmEnergyObservationContext {
  tick: number; startTime: number; duration: number; maximumSourceRows: 20000;
  sourceCollectionComplete: boolean; closed: boolean; originalFailure: string | null; error: string | null;
  sourceEvents: { parcel: ContactParcel; position: ContactVec3; arrivalTime: number;
    segment: ReturnType<WaterfallContactFilm['junctionSegments']>[number];
    transferIndex: number; transfer: FilmJunctionTransfer }[];
}
export interface ContactJunctionRemap { qualification: 'source-bin-quadrature-unqualified'; volume: number; incomingPositionMoment: ContactVec3; portPositionMoment: ContactVec3; incomingPotential: number; portBedPotential: number; /** Numerical bed minus actual arrival potential; spatial approximation, not external work. */ mappingPotentialChange: number; arrivalTimeMoment: number; maximumAdmissionTimingUncertainty: number }
class JunctionArrivalFailure extends Error {
  constructor(readonly diagnostic: ContactJunctionFailureDiagnostic) { super('impact-junction-nonsource-arrival'); }
}
/** Joules at world y=0. Signed changes describe the existing discrete model;
 * the unexplained residual is never presented as physical dissipation. */
export interface ContactEnergyCounters {
  inputKinetic: number; inputPotential: number; outgoingKinetic: number; outgoingPotential: number;
  gravityKickKineticChange: number; airborneTransportPotentialChange: number;
  contactPositionPotentialChange: number; receiverProjectionPotentialChange: number;
}
export interface ContactEnergyReceipt extends ContactEnergyCounters {
  pendingReleaseKinetic?: number; pendingReleasePotential?: number; exportedReleaseKinetic?: number; exportedReleasePotential?: number;
  junctionIncomingEnergy: number; junctionOutgoingEnergy: number; junctionEnergyDiscrepancy: number;
  datumY: 0; airborneKinetic: number; airbornePotential: number; filmKinetic: number; filmPotential: number;
  airborneIntegrationEnergyChangeSigned: number; filmNumericalEnergyLossSigned: number;
  captureNormalEnergyLoss: number; lowerContactNormalEnergyLoss: number; captureMixingEnergyLoss: number;
  depositionPotentialEnergyChange: number; releaseMixingEnergyLoss: number; unexplainedResidual: number;
}
export interface ContactSnapshot { parcels: ContactParcel[]; surfaces: ContactSurface[]; film: FilmSnapshot | null; receipt: ContactReceipt }
export interface ContactFlowState { originalReleaseOwnership?: ContactOriginalReleaseState; fixedSourceShape?: string | null; supportCounters?: ContactSupportCounters; impactMode: 'absorb' | 'junction'; junctionSource: string | null; snapshot: ContactSnapshot; nextId: number; targetTime: number; startTime: number; dt: number; filmState: FilmState | null; filmSurface: ContactSurface | null; releaseMixingEnergyLoss: number; energyCounters: ContactEnergyCounters }
/** Stable identity includes owner, parent tick and original substep/face.
 * The supplying surface and every original interval/provenance field are copied. */
export interface ContactOriginalFilmRelease { id:string; outflow:FilmOutflow; support:ContactSurface }
export interface ContactOriginalReleaseRouting {
  ownerId:string;
  capacity:number;
  /** Pure selection only. External staging uses committed pending records
   * after advanceTo returns; a later failure can roll back this whole tick. */
  select(records:readonly ContactOriginalFilmRelease[]):readonly string[];
}
export interface ContactOriginalReleaseState {
  ownerId:string; pending:ContactOriginalFilmRelease[];
  exportedVolume:number; exportedMomentum:ContactVec3; exportedKinetic:number; exportedPotential:number; acknowledgedCount:number;
}
export interface ContactOriginalReleaseReceipt extends Omit<ContactOriginalReleaseState,'pending'> {
  pendingCount:number; pendingVolume:number; pendingMomentum:ContactVec3;
}
export interface ContactOriginalReleaseReceiver {
  checkpoint():unknown;
  /** Synchronous admission only. The caller coordinates this source-cut
   * epoch with external transport and restores both owners together if a
   * surrounding receiver transaction is rolled back. No arrival is implied. */
  admit(records:readonly ContactOriginalFilmRelease[]):void;
  restore(checkpoint:unknown):void;
}
// Optional version tags leave legacy checkpoint and receipt bytes unchanged.
export interface ContactSourceSpan { readonly z0: number; readonly z1: number }
/** Optional fixed-terrain absorb inlet intervals. Native contiguous/junction
 * admission remains unchanged; separated widths carry their own source edges. */
export interface ContactOptions { filmMode?: FilmMode; sourceSpans?: readonly ContactSourceSpan[]; sourceSupportMode?: 'midpoint' | typeof FINITE_SOURCE_SUPPORT_MODE }
export interface ContactFlowState { sourceSpans?: readonly ContactSourceSpan[] }
export interface ContactFlowState { filmMode?: typeof FOUR_LAYER_FILM_MODE }
export interface ContactOriginalReleaseState { exportedLayeredEnergyDifference?: number }
export interface ContactEnergyReceipt { filmViscousLoss?: number; filmBackwardEulerLoss?: number; layeredTerminalEnergyDifference?: number; layeredEnergyStatus?: 'ENERGY_UNKNOWN' }
// A failed numerical tick needs these stored fields, not the display's film
// cells, derived energy totals or parcel summary. The restore map is shared
// with public checkpoints so private rollback preserves its existing arithmetic.
type ContactRollbackState = Omit<ContactFlowState, 'snapshot'> & {
  snapshot: Pick<ContactSnapshot, 'parcels' | 'surfaces'> & {
    receipt: Pick<ContactReceipt, 'ticks' | 'emittedVolume' | 'landedVolume' | 'emittedMomentum' | 'landedMomentum' | 'gravityImpulse' | 'rockImpulse' | 'contactCount' | 'contactEnergy' | 'surfaceContactCounts' | 'failure' | 'lastAdvanceSteps' | 'lastAdvanceMilliseconds' | 'failureDiagnostic' | 'junctionRemap'>;
  };
};
declare const contactTransactionCheckpoint: unique symbol;
/** An opaque outer-transaction token, valid only for the Flow that created it.
 * Restoration copies its fields, so a retained token can safely restore again. */
export interface ContactTransactionCheckpoint { readonly [contactTransactionCheckpoint]: true }
export type WaterfallContactSnapshot = ContactSnapshot;
export type WaterfallContactSource = ContactSource;
export type WaterfallContactArrival = ContactAdvance;
export interface ContactOptions { originalReleaseRouting?:ContactOriginalReleaseRouting; startTime: number; dt?: number; maxStepsPerAdvance?: number; maxParcels?: number; parcelsPerStep?: number; impactMode?: 'absorb' | 'junction'; /** Fixed physical quads for independent terrain diagnostics. */ surfaces?: readonly ContactSurface[] }
const density = 1000, gravity = 9.81, epsilon = 1e-8;
const add = (a: ContactVec3, b: ContactVec3): ContactVec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: ContactVec3, b: ContactVec3): ContactVec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: ContactVec3, n: number): ContactVec3 => [a[0] * n, a[1] * n, a[2] * n];
// Tiny conserved releases still have finite centers and velocities. Avoid an
// overflowing reciprocal when recovering those values from weighted totals.
const divide = (a: ContactVec3, n: number): ContactVec3 => [a[0] / n, a[1] / n, a[2] / n];
const dot = (a: ContactVec3, b: ContactVec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: ContactVec3): ContactVec3 => scale(v, 1 / Math.hypot(...v));

/** Match Film's release energy arithmetic using the retained supplying chart.
 * Adding tiny normal clearance to world-space endpoints can round it away;
 * separate bed and clearance products preserve that source contribution. */
function originalFilmReleaseEnergy(record:ContactOriginalFilmRelease):{kinetic:number;potential:number} {
  const o=record.outflow,anchor=o.origin!.anchor,[a,b,,d]=record.support.vertices;
  if (o.layered) return { kinetic: o.layered.profileKinetic, potential: o.layered.potential };
  const bedY=a[1]+(b[1]-a[1])*anchor[0]+(d[1]-a[1])*anchor[1];
  return {kinetic:density*o.volume*.5*dot(o.velocity,o.velocity),potential:density*o.volume*gravity*bedY+density*o.volume*gravity*record.support.normal[1]*o.height*.5};
}

// These are the physical contact surfaces, not an invisible collision scaffold.
// Heights and across-width extent scale together when the source shape changes.
export function getWaterfallContactSurfaces(top = 78, pool = 18, width = 10): ContactSurface[] {
  const heightScale = (top - pool) / 60, acrossScale = width / 10;
  return [[-.5, 8, 64, -.65, .22], [9, 20, 47, -.60, -.20], [18, 31, 32, -.40, .16]].map((row, index) => {
    const [x0, x1, y0, forwardSlope, crossSlope] = row;
    const point = (x: number, z: number): ContactVec3 => [x, pool + (y0 - 18 + forwardSlope * (x - x0) + crossSlope * z / acrossScale) * heightScale, z];
    const z = 12 * acrossScale;
    return { id: `contact-ledge-${index + 1}`, vertices: [point(x0, -z), point(x1, -z), point(x1, z), point(x0, z)], normal: unit([-forwardSlope * heightScale, 1, -crossSlope * heightScale / acrossScale]) };
  });
}
export const WATERFALL_CONTACT_SURFACES = getWaterfallContactSurfaces();

// Only terrain copied and deeply frozen by this owner enters this table. Reuse
// its exact identity without serializing unchanged rock for every water packet.
// Caller-owned and changing terrain still recomputes identity on every guard.
const fixedGeometryIdentities = new WeakMap<ContactSurface, string>();

/** The existing sweep and support chart require rectangular X/Z footprints.
 * Copy and freeze all coordinates so caller edits cannot move owned water's rock. */
function fixedContactTerrain(input: readonly ContactSurface[]): ContactSurface[] {
  if (!input.length) throw Error('invalid-contact-terrain');
  const ids = new Set<string>();
  const copy = structuredClone(input) as ContactSurface[];
  for (const surface of copy) {
    if (!surface.id || ids.has(surface.id) || surface.vertices.length !== 4 || surface.normal.length !== 3
      || ![...surface.normal, ...surface.vertices.flat()].every(Number.isFinite)
      || surface.vertices.some(v => v.length !== 3) || surface.normal[1] <= 0
      || Math.abs(Math.hypot(...surface.normal) - 1) > 1e-8) throw Error('invalid-contact-terrain');
    ids.add(surface.id);
    const [a, b, c, d] = surface.vertices, e = sub(b, a), f = sub(d, a);
    if (!(b[0] > a[0] && d[2] > a[2]) || b[2] !== a[2] || d[0] !== a[0]
      || c[0] !== b[0] || c[2] !== d[2]
      || Math.abs(c[1] - (b[1] + d[1] - a[1])) > 1e-8
      || Math.abs(dot(e, surface.normal)) > 1e-8 * Math.hypot(...e)
      || Math.abs(dot(f, surface.normal)) > 1e-8 * Math.hypot(...f)) throw Error('invalid-contact-terrain');
    surface.vertices.forEach(Object.freeze); Object.freeze(surface.vertices);
    Object.freeze(surface.normal); Object.freeze(surface);
    fixedGeometryIdentities.set(surface, waterfallContactGeometryIdentity(surface));
  }
  Object.freeze(copy);
  return copy;
}
const terrainIdentity = (surfaces: readonly ContactSurface[]) => JSON.stringify(surfaces.map(waterfallContactGeometryIdentity));

/** Sweeps a center against the upward face. A parcel crossing from the back
 * cannot bounce off the underside. Testing the entire segment prevents a fast
 * fall from skipping a ledge between two displayed frames. */
export function sweepWaterfallContact(start: ContactVec3, end: ContactVec3, surface: ContactSurface): { fraction: number; position: ContactVec3 } | null {
  // Most candidate rock faces are rejected here. Keep the exact subtraction,
  // multiplication and left-to-right addition order while avoiding two temporary
  // vectors per face; contact boundaries and the resulting water path stay unchanged.
  const origin = surface.vertices[0], normal = surface.normal;
  const distance0 = (start[0] - origin[0]) * normal[0] + (start[1] - origin[1]) * normal[1] + (start[2] - origin[2]) * normal[2];
  const distance1 = (end[0] - origin[0]) * normal[0] + (end[1] - origin[1]) * normal[1] + (end[2] - origin[2]) * normal[2];
  if (distance0 < -epsilon || distance1 >= 0 || distance0 <= distance1) return null;
  const fraction = Math.max(0, distance0 / (distance0 - distance1));
  const position: ContactVec3 = [start[0] + (end[0] - start[0]) * fraction,
    start[1] + (end[1] - start[1]) * fraction, start[2] + (end[2] - start[2]) * fraction];
  const [a, b, c] = surface.vertices;
  // A tolerance on plane crossing must not enlarge the rock footprint. Tiny
  // released edge flux can already lie outside the physical face by the time
  // it crosses the plane; padding support would recapture that owned water.
  if (position[0] < a[0] || position[0] > b[0] || position[2] < a[2] || position[2] > c[2]) return null;
  return { fraction, position };
}

/** The fixed-rock sweep reads a private numeric table instead of repeatedly
 * walking frozen vertex objects. Slots are origin XYZ, normal XYZ, maximum X/Z.
 * Keep the exact operation order and footprint checks of sweepWaterfallContact;
 * release-local contacts still use their existing guarded coordinate frame. */
function sweepPackedContact(start: ContactVec3, end: ContactVec3, plane: Float64Array): { fraction: number; position: ContactVec3 } | null {
  // Most candidate rock faces are rejected here. Keep the exact subtraction,
  // multiplication and left-to-right addition order while avoiding two temporary
  // vectors per face; contact boundaries and the resulting water path stay unchanged.

  const distance0 = (start[0] - plane[0]) * plane[3] + (start[1] - plane[1]) * plane[4] + (start[2] - plane[2]) * plane[5];
  const distance1 = (end[0] - plane[0]) * plane[3] + (end[1] - plane[1]) * plane[4] + (end[2] - plane[2]) * plane[5];
  if (distance0 < -epsilon || distance1 >= 0 || distance0 <= distance1) return null;
  const fraction = Math.max(0, distance0 / (distance0 - distance1));
  const position: ContactVec3 = [start[0] + (end[0] - start[0]) * fraction,
    start[1] + (end[1] - start[1]) * fraction, start[2] + (end[2] - start[2]) * fraction];

  // A tolerance on plane crossing must not enlarge the rock footprint. Tiny
  // released edge flux can already lie outside the physical face by the time
  // it crosses the plane; padding support would recapture that owned water.
  if (position[0] < plane[0] || position[0] > plane[6] || position[2] < plane[2] || position[2] > plane[7]) return null;
  return { fraction, position };
}

function releaseLocalPosition(local: ContactReleaseLocal, surface: ContactSurface): ContactVec3 {
  const [a, b, , d] = surface.vertices;
  const anchor = add(a, add(scale(sub(b, a), local.anchor[0]), scale(sub(d, a), local.anchor[1])));
  return add(anchor, add(scale(local.normal, local.clearance), local.displacement));
}
function releaseLocalHeightParts(local: ContactReleaseLocal, surface: ContactSurface): [number, number] {
  const [a, b, , d] = surface.vertices;
  return [a[1] + (b[1] - a[1]) * local.anchor[0] + (d[1] - a[1]) * local.anchor[1], local.normal[1] * local.clearance + local.displacement[1]];
}

/** Only the supplying ledge uses this retained coordinate frame. It survives
 * departure, so a later genuine inward return remains eligible for contact. */
export function sweepWaterfallReleaseLocal(local: ContactReleaseLocal, drift: ContactVec3, surface: ContactSurface): { fraction: number; position: ContactVec3 } | null {
  if (local.surfaceId !== surface.id || local.geometryIdentity !== (fixedGeometryIdentities.get(surface) ?? waterfallContactGeometryIdentity(surface))
    || !local.normal.every((n, i) => n === surface.normal[i]) || ![local.clearance, local.referenceTime, ...local.anchor, ...local.displacement, ...drift].every(Number.isFinite)
    || local.clearance < 0 || local.anchor.some(p => p < 0 || p > 1)
    || (local.edge === 'upstream' ? local.anchor[0] !== 0 : local.edge === 'downstream' ? local.anchor[0] !== 1 : local.edge === 'across-negative' ? local.anchor[1] !== 0 : local.edge === 'across-positive' ? local.anchor[1] !== 1 : true)) throw Error('release-local-stale-or-invalid');
  const n = local.normal, offset = add(scale(n, local.clearance), local.displacement);
  if (!offset.every(Number.isFinite) || (local.clearance > 0 && n.some(component => component !== 0 && component * local.clearance === 0))) throw Error('release-local-unsupported-intersection-range');
  // dot(n,n) preserves the release-direction convention without pretending
  // that its stored normalized vector has mathematically exact unit length.
  const d0 = dot(n, n) * local.clearance + dot(n, local.displacement), delta = dot(n, drift), d1 = d0 + delta;
  if (d0 < 0 || d1 >= 0 || delta >= 0) return null;
  const fraction = d0 / -delta;
  if (![d0, delta, d1, fraction].every(Number.isFinite) || (d0 > 0 && fraction === 0)
    || (fraction > 0 && drift.some(component => component !== 0 && component * fraction === 0))) throw Error('release-local-unsupported-intersection-range');
  const hitOffset = add(offset, scale(drift, fraction)), [a, b, , d] = surface.vertices;
  const dx = b[0] - a[0], dz = d[2] - a[2];
  // These signs are tested before a large world coordinate is added. An
  // outgoing sub-ULP crossing cannot round back onto the supplying edge.
  if (local.anchor[0] * dx + hitOffset[0] < 0 || (1 - local.anchor[0]) * dx - hitOffset[0] < 0
    || local.anchor[1] * dz + hitOffset[2] < 0 || (1 - local.anchor[1]) * dz - hitOffset[2] < 0) return null;
  return { fraction, position: releaseLocalPosition({ ...local, displacement: add(local.displacement, scale(drift, fraction)) }, surface) };
}

/** The junction experiment uses one constant-gravity path for motion and all
 * event queries. The absorption comparison keeps its original kick/drift. */
export function waterfallFlightDisplacement(velocity: ContactVec3, time: number): ContactVec3 {
  return [velocity[0] * time, velocity[1] * time - .5 * gravity * time * time, velocity[2] * time];
}
/** Stable quadratic roots avoid subtracting nearly equal values at a shallow
 * release. JS has no guaranteed fused multiply-add: unsupported ranges stop. */
export { waterfallDownwardRoot } from './waterfallFlightRoots';
/** Earliest inside-to-outside crossing. A tangent touch staying inside is not
 * an exit. Zero speed at an edge with outward acceleration leaves immediately. */
export function waterfallSupportExitRoot(distance: number, speed: number, acceleration: number): number | null {
  if (![distance, speed, acceleration].every(Number.isFinite) || distance < 0) throw Error('support-unsupported-range');
  if (distance === 0 && (speed < 0 || speed === 0 && acceleration < 0)) return 0;
  if (acceleration === 0) {
    if (speed >= 0) return null;
    const time = -distance / speed;
    if (!Number.isFinite(time) || distance > 0 && time === 0) throw Error('support-unsupported-range');
    return time;
  }
  const a = .5 * acceleration, discriminant = speed * speed - 4 * a * distance;
  if (!Number.isFinite(discriminant)) throw Error('support-unsupported-range');
  if (discriminant <= 0) return null;
  const q = -.5 * (speed + (speed < 0 ? -1 : 1) * Math.sqrt(discriminant));
  const roots = q === 0 ? [0] : [q / a, distance / q];
  const time = roots.filter(t => Number.isFinite(t) && t >= 0 && speed + acceleration * t < 0).sort((a, b) => a - b)[0];
  if (distance > 0 && time === 0) throw Error('support-unsupported-range');
  return time ?? null;
}
function supportBasis(surface: ContactSurface): [ContactVec3, ContactVec3] {
  return [sub(surface.vertices[1], surface.vertices[0]), sub(surface.vertices[3], surface.vertices[0])];
}
function supportComponents(vector: ContactVec3, surface: ContactSurface): [number, number] {
  const [e, f] = supportBasis(surface), ee = dot(e, e), ef = dot(e, f), ff = dot(f, f), determinant = ee * ff - ef * ef;
  if (!(determinant > 0) || !Number.isFinite(determinant)) throw Error('support-unsupported-range');
  const ev = dot(e, vector), fv = dot(f, vector);
  return [(ff * ev - ef * fv) / determinant, (ee * fv - ef * ev) / determinant];
}
function supportVector(components: [number, number], surface: ContactSurface): ContactVec3 {
  const [e, f] = supportBasis(surface); return add(scale(e, components[0]), scale(f, components[1]));
}
function validateSupport(support: ContactSupport, surface: ContactSurface): void {
  if (support.surfaceId !== surface.id || support.geometryIdentity !== waterfallContactGeometryIdentity(surface)
    || ![support.referenceTime, ...support.coordinate, ...support.velocity].every(Number.isFinite)
    || support.coordinate.some(c => c < 0 || c > 1)) throw Error('support-stale-or-invalid');
}
/** Same chart trajectory for motion, accounting and presentation. The caller
 * supplies a local duration; no global timestamp subtraction defines an event. */
export function waterfallSupportedPosition(support: ContactSupport, surface: ContactSurface, time = 0): ContactVec3 {
  validateSupport(support, surface);
  const acceleration = supportComponents([0, -gravity, 0], surface);
  const coordinate = support.coordinate.map((c, i) => c + support.velocity[i] * time + .5 * acceleration[i] * time * time) as [number, number];
  return add(surface.vertices[0], supportVector(coordinate, surface));
}
function supportDeparture(support: ContactSupport, surface: ContactSurface): { time: number; edges: number[] } | null {
  validateSupport(support, surface);
  const a = supportComponents([0, -gravity, 0], surface), roots = [0, 1, 2, 3].map(edge => {
    const axis = edge >> 1, sign = edge % 2 === 0 ? 1 : -1;
    return waterfallSupportExitRoot(edge % 2 === 0 ? support.coordinate[axis] : 1 - support.coordinate[axis], sign * support.velocity[axis], sign * a[axis]);
  });
  const times = roots.filter((t): t is number => t !== null);
  if (!times.length) return null;
  const time = Math.min(...times);
  return { time, edges: roots.flatMap((t, i) => t === time ? [i] : []) };
}
function sweepSupportedPlane(support: ContactSupport, supplying: ContactSurface, duration: number, surface: ContactSurface): { time: number; position: ContactVec3 } | null {
  const start = waterfallSupportedPosition(support, supplying), velocity = supportVector(support.velocity, supplying);
  const acceleration = supportVector(supportComponents([0, -gravity, 0], supplying), supplying);
  const N: ContactVec3 = [surface.normal[0] / surface.normal[1], 1, surface.normal[2] / surface.normal[1]];
  const distance = dot(sub(start, surface.vertices[0]), N), speed = dot(velocity, N), normalAcceleration = dot(acceleration, N);
  if (distance < 0) return null;
  const time = waterfallSupportExitRoot(distance, speed, normalAcceleration);
  if (time === null || time >= duration) return null;
  const drift = add(scale(velocity, time), scale(acceleration, .5 * time * time)), [a, b, c] = surface.vertices;
  const x = start[0] - a[0] + drift[0], z = start[2] - a[2] + drift[2];
  if (x < 0 || x > b[0] - a[0] || z < 0 || z > c[2] - a[2]) return null;
  return { time, position: add(start, drift) };
}
export function sweepWaterfallQuadratic(start: ContactVec3, velocity: ContactVec3, duration: number, surface: ContactSurface, local?: ContactReleaseLocal): { time: number; position: ContactVec3 } | null {
  // Reuse the frame's validation without changing it or granting an exemption.
  if (local) sweepWaterfallReleaseLocal(local, [0, 0, 0], surface);
  const n = surface.normal, N: ContactVec3 = [n[0] / n[1], 1, n[2] / n[1]];
  const distance = local ? dot(N, n) * local.clearance + dot(N, local.displacement) : dot(sub(start, surface.vertices[0]), N);
  const time = waterfallDownwardRoot(distance, dot(N, velocity), -gravity);
  // An endpoint touch belongs to the next interval, as in the comparison.
  if (time === null || time >= duration) return null;
  const drift = waterfallFlightDisplacement(velocity, time);
  if (!drift.every(Number.isFinite) || (time > 0 && velocity.some((v, i) => v !== 0 && i !== 1 && drift[i] === 0))) throw Error('quadratic-flight-unsupported-range');
  let position: ContactVec3;
  if (local) {
    const offset = add(scale(n, local.clearance), add(local.displacement, drift)), [a, b, , d] = surface.vertices;
    const dx = b[0] - a[0], dz = d[2] - a[2];
    if (local.anchor[0] * dx + offset[0] < 0 || (1 - local.anchor[0]) * dx - offset[0] < 0
      || local.anchor[1] * dz + offset[2] < 0 || (1 - local.anchor[1]) * dz - offset[2] < 0) return null;
    // A zero-gap finite-edge departure is outside immediately after t=0.
    // This excludes that touch only; positive-time inward returns still query
    // the supplying quad with the same retained local provenance.
    if (time === 0 && ((local.anchor[0] * dx + offset[0] === 0 && velocity[0] < 0)
      || ((1 - local.anchor[0]) * dx - offset[0] === 0 && velocity[0] > 0)
      || (local.anchor[1] * dz + offset[2] === 0 && velocity[2] < 0)
      || ((1 - local.anchor[1]) * dz - offset[2] === 0 && velocity[2] > 0))) return null;
    position = releaseLocalPosition({ ...local, displacement: add(local.displacement, drift) }, surface);
  } else {
    const [a, b, c] = surface.vertices;
    const x = start[0] - a[0] + drift[0], z = start[2] - a[2] + drift[2];
    if (x < 0 || x > b[0] - a[0] || z < 0 || z > c[2] - a[2]) return null;
    position = add(start, drift);
  }
  return { time, position };
}

export class WaterfallContactFlow {
  // Weak keys let accepted outer ticks drop their tokens without retaining water copies.
  private borrowedTickCheckpoint: ContactRollbackState | null = null;
  private readonly transactionCheckpoints = new WeakMap<ContactTransactionCheckpoint, ContactRollbackState>();
  private readonly options: Required<Omit<ContactOptions, 'surfaces' | 'originalReleaseRouting' | 'sourceSpans'>>;
  private readonly originalReleaseRouting:ContactOriginalReleaseRouting | undefined;
  private originalReleaseOwnership:ContactOriginalReleaseState | undefined;
  private releaseOwnershipBusy=false;
  private readonly fixedTerrainIdentity: string | null;
  private readonly sourceSpans: readonly ContactSourceSpan[] | null;
  private fixedSourceShape: string | null = null;
  // Fixed terrain is immutable across rollback. Its private numeric copy cannot
  // become stale when a public snapshot or the caller's input is changed.
  private packedPlanes: Float64Array[] | null = null;
  private parcels: ContactParcel[] = [];
  private sourceSupportReceipt: ContactFiniteSourceReceipt | null = null;
  private surfaces = getWaterfallContactSurfaces();
  private film: WaterfallContactFilm | null = null;
  private filmEnergyContext: ContactFilmEnergyObservationContext | null = null;
  private releaseMixingEnergyLoss = 0;
  private supportCounters: ContactSupportCounters = { impulse: [0, 0, 0], kineticChange: 0, potentialChange: 0, conversionKineticChange: 0, conversionPotentialChange: 0 };
  private energyCounters: ContactEnergyCounters = { inputKinetic: 0, inputPotential: 0, outgoingKinetic: 0, outgoingPotential: 0, gravityKickKineticChange: 0, airborneTransportPotentialChange: 0, contactPositionPotentialChange: 0, receiverProjectionPotentialChange: 0 };
  private tick = 0;
  private nextId = 0;
  private emittedVolume = 0;
  private landedVolume = 0;
  private emittedMomentum: ContactVec3 = [0, 0, 0];
  private landedMomentum: ContactVec3 = [0, 0, 0];
  private gravityImpulse: ContactVec3 = [0, 0, 0];
  private rockImpulse: ContactVec3 = [0, 0, 0];
  private contactCount = 0;
  private contactEnergy = 0;
  private surfaceContactCounts: Record<string, number> = {};
  private failure: string | null = null;
  private failureDiagnostic: ContactJunctionFailureDiagnostic | LayeredFilmFailureDiagnostic | FiniteSourceFailureDiagnostic | FilmBackpressureDiagnostic | null = null;
  private junctionSource: string | null = null;
  private junctionRemap: ContactJunctionRemap = { qualification: 'source-bin-quadrature-unqualified', volume: 0, incomingPositionMoment: [0, 0, 0], portPositionMoment: [0, 0, 0], incomingPotential: 0, portBedPotential: 0, mappingPotentialChange: 0, arrivalTimeMoment: 0, maximumAdmissionTimingUncertainty: 0 };
  private lastAdvanceSteps = 0;
  private lastAdvanceMilliseconds = 0;
  private targetTime: number;
  constructor(options: ContactOptions) {
    const { surfaces, originalReleaseRouting, sourceSpans, ...flowOptions } = options;
    if(originalReleaseRouting && (!originalReleaseRouting.ownerId.trim()||!Number.isSafeInteger(originalReleaseRouting.capacity)||originalReleaseRouting.capacity<1||typeof originalReleaseRouting.select!=='function'))throw Error('Invalid original Film release routing');
    this.originalReleaseRouting=originalReleaseRouting?{...originalReleaseRouting}:undefined;
    this.originalReleaseOwnership=originalReleaseRouting?{ownerId:originalReleaseRouting.ownerId,pending:[],exportedVolume:0,exportedMomentum:[0,0,0],exportedKinetic:0,exportedPotential:0,acknowledgedCount:0}:undefined;
    this.options = { dt: 1 / 120, maxStepsPerAdvance: 120, maxParcels: 20000, parcelsPerStep: 24, impactMode: 'absorb', filmMode: 'single-layer', sourceSupportMode: 'midpoint',firstImpactModel:'hydraulic-be-v1', filmSubdivision:'none', ...flowOptions };
    this.options.firstImpactModel??='hydraulic-be-v1';
    this.options.filmSubdivision ??= 'none';
    if (this.options.filmSubdivision !== 'none' && (this.options.filmSubdivision !== '4x3-v1' || this.options.firstImpactModel !== KINETIC_EXACT_IMPACT_MODEL)) throw Error('film-subdivision-requires-kinetic-impact');
    if(this.options.firstImpactModel!=='hydraulic-be-v1'&&this.options.firstImpactModel!==KINETIC_EXACT_IMPACT_MODEL||this.options.firstImpactModel===KINETIC_EXACT_IMPACT_MODEL&&(this.options.sourceSupportMode!==FINITE_SOURCE_SUPPORT_MODE||this.options.filmMode!==FOUR_LAYER_FILM_MODE||this.options.impactMode!=='junction'))throw Error('kinetic-exact-requires-finite-layered-junction');
    if (this.options.sourceSupportMode !== 'midpoint' && this.options.sourceSupportMode !== FINITE_SOURCE_SUPPORT_MODE) throw Error('source-support-mode-mismatch');
    if (this.options.sourceSupportMode === FINITE_SOURCE_SUPPORT_MODE) {
      if (this.options.impactMode !== 'junction' || this.options.filmMode !== FOUR_LAYER_FILM_MODE || surfaces || sourceSpans) throw Error('finite-source-requires-native-layered-junction');
      this.sourceSupportReceipt = { mode: FINITE_SOURCE_SUPPORT_MODE, delivered: emptySourceSupportMoments(), remaining: emptySourceSupportMoments(), firstArrival: null, lastArrival: null, lastTickSteps: [], betaRelativeDeviationMaximum: 0, mappedChordPositionMoment: [0,0,0], curveToChordPositionMoment: [0,0,0], curveToChordBedPotentialChange: 0, cumulativeClosureEnergyDifference: 0, cumulativeDeliveredIncomingKinetic: 0, qualification: 'midsurface-birth-span-support' };
    }
    if (this.options.filmMode !== 'single-layer' && this.options.filmMode !== FOUR_LAYER_FILM_MODE) throw Error('film-mode-mismatch');
    if (this.options.filmMode === FOUR_LAYER_FILM_MODE && (this.options.impactMode !== 'junction' || !originalReleaseRouting)) throw Error('layered-film-requires-junction-and-terminal-owner');
    if (this.options.filmMode === FOUR_LAYER_FILM_MODE) this.originalReleaseOwnership!.exportedLayeredEnergyDifference = 0;
    this.fixedTerrainIdentity = surfaces ? terrainIdentity(this.surfaces = fixedContactTerrain(surfaces)) : null;
    // Only the owner-frozen terrain gets a private numeric copy. Dynamic terrain
    // continues reading current surfaces; all faces and exact arithmetic remain.
    if (surfaces) this.packedPlanes = this.surfaces.map(s => new Float64Array([...s.vertices[0], ...s.normal, s.vertices[1][0], s.vertices[2][2]]));
    if (!Number.isFinite(options.startTime) || !(this.options.dt > 0) || !Number.isFinite(this.options.dt)
      || ![this.options.maxStepsPerAdvance, this.options.maxParcels, this.options.parcelsPerStep].every(n => Number.isInteger(n) && n > 0)) throw new Error('Invalid contact flow options');
    if (sourceSpans && (!surfaces || this.options.impactMode !== 'absorb' || !sourceSpans.length || this.options.parcelsPerStep < sourceSpans.length
      || sourceSpans.some((s,i) => ![s.z0,s.z1,s.z1-s.z0].every(Number.isFinite) || !(s.z1 > s.z0) || i > 0 && s.z0 < sourceSpans[i-1].z1)
      || !Number.isFinite(sourceSpans.reduce((sum,s) => sum+s.z1-s.z0,0)))) throw Error('invalid-fixed-terrain-source-spans');
    this.sourceSpans = sourceSpans ? Object.freeze(sourceSpans.map(s => Object.freeze({z0:s.z0,z1:s.z1}))) : null;
    this.targetTime = options.startTime;
  }
  get time(): number { return this.options.startTime + this.tick * this.options.dt; }
  private get nextTime(): number { return this.options.startTime + (this.tick + 1) * this.options.dt; }
  get failureReason(): string | null { return this.failure; }
  /** Arm one already-initialized Film tick for diagnosis. This does not enter
   * saveState or alter source admission, stepping, rollback or energy gates. */
  armFilmEnergyObservation(observer: FilmEnergyObserver): void {
    if (!this.film || this.options.filmMode !== FOUR_LAYER_FILM_MODE || this.filmEnergyContext)
      throw Error('film-energy-observer-requires-initialized-unused-four-layer-flow');
    this.filmEnergyContext = { tick: this.tick, startTime: this.time, duration: this.options.dt,
      maximumSourceRows: 20000, sourceCollectionComplete: false, closed: false, originalFailure: null, error: null, sourceEvents: [] };
    this.film.energyObserver = observer;
  }
  /** One attempted finite-source tick; witness state stays outside rollback. */
  armBackpressureObservation(observer:FilmBackpressureObserver):void {
    if(!this.film||this.options.sourceSupportMode!==FINITE_SOURCE_SUPPORT_MODE||this.film.backpressureObserver)throw Error('backpressure-observer-requires-initialized-unused-finite-source-flow');
    this.film.backpressureObserver=observer;
  }
  getFilmEnergyObservationContext(): ContactFilmEnergyObservationContext | null {
    return this.filmEnergyContext ? structuredClone(this.filmEnergyContext) : null;
  }
  get totalOwnedVolume(): number { return this.parcels.reduce((sum, p) => sum + p.volume, 0) + (this.film?.volume ?? 0) + (this.originalReleaseOwnership?.pending.reduce((sum,p)=>sum+p.outflow.volume,0)??0); }
  get pendingOriginalFilmReleases():ContactOriginalFilmRelease[] { return structuredClone(this.originalReleaseOwnership?.pending??[]); }

  /** Exact originals leave Flow only after the external receiver succeeds.
   * Failed/mutating receivers cannot consume or modify pending water. Missing,
   * duplicate and altered acknowledgments fail before any external mutation. */
  acknowledgeOriginalFilmReleases(records:readonly ContactOriginalFilmRelease[],receiver:ContactOriginalReleaseReceiver):void {
    if(this.releaseOwnershipBusy)throw Error('Original release ownership operation is reentrant');
    const state=this.originalReleaseOwnership;
    if(!state||!records.length||new Set(records.map(r=>r.id)).size!==records.length)throw Error('Invalid original release acknowledgment');
    const requested=structuredClone([...records]);
    for(const r of requested){const original=state.pending.find(p=>p.id===r.id);if(!original||JSON.stringify(original)!==JSON.stringify(r))throw Error('Missing or altered pending original release');}
    // Compute the entire finite source debit before any external admission.
    // Neither a receiver checkpoint nor admission may reenter this ownership
    // operation; otherwise the same originals could be exported twice.
    let exportedVolume=state.exportedVolume,exportedMomentum:ContactVec3=[...state.exportedMomentum],exportedKinetic=state.exportedKinetic,exportedPotential=state.exportedPotential;
    for(const r of requested){const o=r.outflow,energy=originalFilmReleaseEnergy(r);exportedVolume+=o.volume;exportedMomentum=add(exportedMomentum,o.momentum);exportedKinetic+=energy.kinetic;exportedPotential+=energy.potential;}
    const acknowledgedCount=state.acknowledgedCount+requested.length;
    const exportedLayeredEnergyDifference = (state.exportedLayeredEnergyDifference ?? 0) + requested.reduce((sum, r) => sum + (r.outflow.layered ? r.outflow.layered.energyFlux - r.outflow.layered.profileKinetic - r.outflow.layered.potential : 0), 0);
    if (!Number.isFinite(exportedLayeredEnergyDifference)) throw Error('Original release exported layered energy exceeds finite capacity');
    if(![exportedVolume,...exportedMomentum,exportedKinetic,exportedPotential].every(Number.isFinite)||!Number.isSafeInteger(acknowledgedCount))throw Error('Original release exported accounting exceeds finite capacity');
    this.releaseOwnershipBusy=true;
    try{
      const checkpoint=receiver.checkpoint();
      try{const result:unknown=receiver.admit(structuredClone(requested));if(result&&typeof (result as {then?:unknown}).then==='function')throw Error('Original release admission must be synchronous');}catch(error){receiver.restore(checkpoint);throw error;}
      state.exportedVolume=exportedVolume;state.exportedMomentum=exportedMomentum;state.exportedKinetic=exportedKinetic;state.exportedPotential=exportedPotential;state.acknowledgedCount=acknowledgedCount;
      if (this.options.filmMode === FOUR_LAYER_FILM_MODE) state.exportedLayeredEnergyDifference = exportedLayeredEnergyDifference;
      const ids=new Set(requested.map(r=>r.id));state.pending=state.pending.filter(p=>!ids.has(p.id));
    }finally{this.releaseOwnershipBusy=false;}
  }

  advanceTo(time: number, sourceAt: (time: number) => ContactSource): ContactAdvance {
    if(this.releaseOwnershipBusy)throw Error('Original release ownership operation is reentrant');
    const arrival: ContactAdvance = { time: this.time, volume: 0, momentum: [0, 0, 0], weightedPosition: [0, 0, 0], arrivals: [] };
    if (!Number.isFinite(time) || time < this.time - epsilon) throw new Error('Contact flow clock must advance');
    this.targetTime = time;
    const started = performance.now();
    this.lastAdvanceSteps = 0;
    while (this.nextTime <= time + epsilon && this.lastAdvanceSteps < this.options.maxStepsPerAdvance) {
      // Midpoint source integration has fixed, documented time resolution. A
      // source-off tick adds nothing, while previously admitted water keeps moving.
      const source = sourceAt(this.time + this.options.dt / 2);
      if (![source.q, source.width, source.depth, source.speed, source.top ?? 78, source.pool ?? 18].every(Number.isFinite)
        || source.q < 0 || source.width <= 0 || source.depth <= 0 || source.speed < 0 || (source.top ?? 78) <= (source.pool ?? 18)) {
        this.failure = 'invalid-source'; break;
      }
      if (this.sourceSpans && Math.abs(this.sourceSpans.reduce((sum,s)=>sum+(s.z1-s.z0),0)-source.width) > 1e-12*source.width) {
        this.failure = 'source-spans-wet-width-mismatch'; break;
      }
      if (source.q > 0 && this.parcels.length + this.options.parcelsPerStep > this.options.maxParcels) {
        // Stop before admission. No water is silently deleted to meet the cap.
        this.failure = 'parcel-capacity'; break;
      }
      this.failure = null;
      this.failureDiagnostic = null;
      // Fixed fixtures keep their rock even with the tap off. Changing the
      // source height, width or collector plane requires a fresh experiment.
      const shape = JSON.stringify([source.width, source.top ?? 78, source.pool ?? 18]);
      if (this.fixedTerrainIdentity && this.fixedSourceShape && shape !== this.fixedSourceShape) { this.failure = 'fixed-terrain-source-change-requires-fresh-run'; break; }
      const surfaces = this.fixedTerrainIdentity ? this.surfaces : getWaterfallContactSurfaces(source.top ?? 78, source.pool ?? 18, source.width);
      if (this.film && JSON.stringify(this.film.surface.vertices) !== JSON.stringify(surfaces[0].vertices)) { this.failure = 'film-geometry-change-requires-fresh-run'; break; }
      this.surfaces = surfaces;
      if (!this.film) this.film = new WaterfallContactFilm(this.surfaces[0], 12, 16, 64, .35, this.options.filmMode,this.options.firstImpactModel);
      const checkpoint = this.borrowedTickCheckpoint ?? this.saveRollbackState();
      if (this.fixedTerrainIdentity) this.fixedSourceShape = shape;
      const tickArrival: ContactAdvance = { time: this.time, volume: 0, momentum: [0, 0, 0], weightedPosition: [0, 0, 0], arrivals: [] };
      try {
        // First-order split: existing film moves first; new impacts join it for
        // the next tick. Newly released packets begin ballistic travel next
        // tick. This declares a maximum one-tick transfer timing uncertainty.
        let releases: FilmOutflow[];
        if (this.options.impactMode === 'junction') {
          const signature = JSON.stringify([source.width, source.depth, source.speed, source.top ?? 78, source.pool ?? 18]);
          if (source.q > 0 && this.junctionSource && signature !== this.junctionSource) throw Error('impact-junction-source-change-requires-fresh-run');
          if (!this.film.hasJunctionGeometry && source.q > 0) {
            const spanKnots = Array.from({ length: this.options.parcelsPerStep + 1 }, (_, i) => (i / this.options.parcelsPerStep - .5) * source.width);
            const locus = waterfallImpactLocus(source, this.surfaces[0], this.options.dt, this.options.maxParcels, { rowCount: this.film.nz, spanKnots });
            this.film.configureJunction({ ...(this.options.filmSubdivision === '4x3-v1' ? { subdivision: '4x3-v1' as const } : {}), locus, spanKnots });
            this.junctionSource = signature;
          }
          // Prospective junction split: collect owned impacts first, then feed
          // the two pressure-bearing boundary fluxes over this same interval.
          // Arrival admission has at most dt timing uncertainty; new releases
          // still start their ballistic flight on the following tick.
          this.emit(source);
          const transfers: FilmJunctionTransfer[] = [];
          this.moveQuadratic(source.pool ?? 18, tickArrival, transfers);
          if (this.filmEnergyContext?.tick === this.tick) this.filmEnergyContext.sourceCollectionComplete = true;
          if (this.options.sourceSupportMode === FINITE_SOURCE_SUPPORT_MODE) {
            const records = this.parcels.filter(p => p.sourceSupport).map(p => {
              if (!p.sourceRelease || p.sourceSupport!.cursorTime !== this.time) throw Error('source-support-stale-carrier');
              return { id: p.id, model: new WaterfallSourceSupport(p.sourceRelease,p.sourceSupport!.originalVolume,this.film!.surface) };
            });
            this.film.backpressureObserver?.tick(this.tick);
            const supply = new FiniteSourceSupply(records,this.film.junctionSegments(),1e-6,this.sourceSupportReceipt!.cumulativeClosureEnergyDifference,this.sourceSupportReceipt!.cumulativeDeliveredIncomingKinetic,Boolean(this.film.backpressureObserver),this.options.firstImpactModel);
            releases = this.film.advance(this.time,this.options.dt,[],supply);
            this.commitFiniteSourceSupply(supply,source);
          } else releases = this.film.advance(this.time, this.options.dt, transfers);
          // The pressure junction supplies a wall reaction separate from film
          // support. Count each accepted transfer once; rollback owns this too.
          for (const transfer of transfers) this.rockImpulse = add(this.rockImpulse, transfer.reaction);
        } else {
          releases = this.film.advance(this.time, this.options.dt);
          this.emit(source);
          this.move(source.pool ?? 18, tickArrival);
        }
        releases=this.aggregateReleases(this.routeOriginalFilmReleases(releases));
        if (this.parcels.length + releases.length > this.options.maxParcels) throw Error('parcel-capacity');
        this.releaseFilm(releases);
      } catch (error) {
        if (this.filmEnergyContext?.tick === this.tick) { this.filmEnergyContext.closed = true; this.filmEnergyContext.originalFailure = error instanceof Error ? error.message : 'film-failure'; }
        this.restoreRollbackState(checkpoint); this.failure = error instanceof Error ? error.message : 'film-failure';
        this.failureDiagnostic = error instanceof JunctionArrivalFailure || error instanceof LayeredFilmStageFailure || error instanceof FiniteSourceQuadratureFailure || error instanceof FilmBackpressureFailure ? structuredClone(error.diagnostic) : null; break;
      }
      if (this.filmEnergyContext?.tick === this.tick) this.filmEnergyContext.closed = true;
      arrival.volume += tickArrival.volume; arrival.momentum = add(arrival.momentum, tickArrival.momentum);
      arrival.weightedPosition = add(arrival.weightedPosition, tickArrival.weightedPosition);
      arrival.arrivals.push(...tickArrival.arrivals);
      this.tick++;
      this.lastAdvanceSteps++;
    }
    arrival.time = this.time;
    this.lastAdvanceMilliseconds = performance.now() - started;
    return arrival;
  }

  private emit(source: ContactSource): void {
    if (source.q === 0) return;
    const n = this.options.parcelsPerStep, volume = source.q * this.options.dt / n;
    // Assign at least one bin to each actual inlet, then subdivide the widest
    // remaining bin. Gaps never receive water and do not count as wet width.
    const bins: ContactSourceSpan[] = [];
    if (this.sourceSpans) {
      const counts = this.sourceSpans.map(()=>1);
      for (let count=counts.length;count<n;count++) {
        let widest=0;
        for(let j=1;j<counts.length;j++) if((this.sourceSpans[j].z1-this.sourceSpans[j].z0)/counts[j] > (this.sourceSpans[widest].z1-this.sourceSpans[widest].z0)/counts[widest]) widest=j;
        counts[widest]++;
      }
      this.sourceSpans.forEach((s,j)=>{for(let k=0;k<counts[j];k++)bins.push({z0:k===0?s.z0:s.z0+(s.z1-s.z0)*k/counts[j],z1:k===counts[j]-1?s.z1:s.z0+(s.z1-s.z0)*(k+1)/counts[j]});});
    }
    const spanVolumes: number[] = [];
    if (bins.length) {
      const wetWidth = this.sourceSpans!.reduce((sum,s)=>sum+(s.z1-s.z0),0);
      let planned = 0;
      for (let i=0;i<n;i++) {
        const v = i===n-1 ? source.q*this.options.dt-planned : source.q*this.options.dt*(bins[i].z1-bins[i].z0)/wetWidth;
        if (!(bins[i].z1 > bins[i].z0 && v > 0) || !Number.isFinite(v)) throw Error('unsupported-source-span-admission');
        spanVolumes.push(v); planned += v;
      }
    }
    for (let i = 0; i < n; i++) {
      // Each bin owns its entire supplied width and one actual birth interval.
      // Adjacency comes from the coherent inlet's support, not proximity to
      // point samples. Native use has six bins; changing n only subdivides it.
      const z0 = bins.length ? bins[i].z0 : (i / n - .5) * source.width, z1 = bins.length ? bins[i].z1 : ((i + 1) / n - .5) * source.width;
      // The final bin receives only the arithmetic remainder of the declared
      // total admission. Other bins are weighted by actual wet interval width.
      const binVolume = bins.length ? spanVolumes[i] : volume;
      const y = (source.top ?? 78) - source.depth * .5, birth = this.time + this.options.dt * .5;
      const parcel: ContactParcel = { id: this.nextId++, position: [0, y, bins.length ? z0 + (z1 - z0) * .5 : (z0 + z1) * .5], velocity: [source.speed, 0, 0], volume: binVolume, birth, contactCount: 0, contactEnergy: 0,
        sourceRelease: { edge: `source:${i}`, start: [0, y, z0], end: [0, y, z1], intervalStart: this.time, intervalEnd: this.time + this.options.dt, velocity: [source.speed, 0, 0], birthTime: birth },
        sourceSection: { width: source.width, depth: source.depth, speed: source.speed, top: source.top ?? 78 } };
      if (this.options.sourceSupportMode === FINITE_SOURCE_SUPPORT_MODE) parcel.sourceSupport = { mode: FINITE_SOURCE_SUPPORT_MODE, originalVolume: binVolume, cursorTime: this.time, moments: emptySourceSupportMoments() };
      this.parcels.push(parcel);
      this.emittedVolume += binVolume;
      this.emittedMomentum = add(this.emittedMomentum, scale(parcel.velocity, binVolume * density));
      // Measure the actual midpoint birth state, before its first gravity kick.
      this.energyCounters.inputKinetic += .5 * density * binVolume * dot(parcel.velocity, parcel.velocity);
      this.energyCounters.inputPotential += density * binVolume * gravity * parcel.position[1];
    }
  }

  /** Commit born-and-unarrived source moments only after Film succeeds. The
   * surrounding Flow checkpoint also rolls this commit back if outlet routing
   * fails. Endpoint moments plus delivered moments account gravity once; mean
   * velocities are presentation only and never replace the kinetic moment.
   */
  private commitFiniteSourceSupply(supply: FiniteSourceSupply, source: ContactSource): void {
    const receipt = this.sourceSupportReceipt!, remaining = emptySourceSupportMoments();
    const models = new Map(supply.records.map(r => [r.id,r.model]));
    const active: ContactParcel[] = [];
    for (const parcel of this.parcels) {
      const carrier = parcel.sourceSupport;
      if (!carrier) { active.push(parcel); continue; }
      const model = models.get(parcel.id)!;
      const before = carrier.moments, after = model.remaining(this.nextTime), incoming = supply.byOriginal.get(parcel.id) ?? emptySourceSupportMoments();
      const newborn = parcel.sourceRelease!.intervalStart === this.time;
      const admitted = newborn ? carrier.originalVolume : 0;
      if (Math.abs(before.volume + admitted - after.volume - incoming.volume) > 1e-10 * carrier.originalVolume) throw Error('source-support-ownership-volume');
      const initialVelocity = parcel.sourceRelease!.velocity, y = parcel.sourceRelease!.start[1];
      for (let k=0;k<3;k++) this.gravityImpulse[k] += after.momentum[k] + incoming.momentum[k] - before.momentum[k] - density*admitted*initialVelocity[k];
      this.energyCounters.gravityKickKineticChange += after.kinetic + incoming.kinetic - before.kinetic - .5*density*admitted*dot(initialVelocity,initialVelocity);
      this.energyCounters.airborneTransportPotentialChange += after.potential + incoming.potential - before.potential - density*gravity*admitted*y;
      if (incoming.volume > 0 && parcel.contactCount === 0) {
        parcel.contactCount++; this.contactCount++; this.surfaceContactCounts[this.film!.surface.id] = (this.surfaceContactCounts[this.film!.surface.id] ?? 0)+1;
      }
      receipt.firstArrival = Math.min(receipt.firstArrival ?? Infinity,model.firstArrival);
      receipt.lastArrival = Math.max(receipt.lastArrival ?? -Infinity,model.lastArrival);
      const nominalBeta = source.q > 0 ? source.q/source.width : model.beta;
      receipt.betaRelativeDeviationMaximum = Math.max(receipt.betaRelativeDeviationMaximum,Math.abs(model.beta-nominalBeta)/nominalBeta);
      if (after.volume > 0) {
        parcel.volume = after.volume; parcel.position = after.positionMoment.map(v => v/after.volume) as ContactVec3;
        parcel.velocity = after.momentum.map(p => (p/after.volume)/density) as ContactVec3;
        carrier.cursorTime = this.nextTime; carrier.moments = after; active.push(parcel); addSourceSupportMoments(remaining,after);
      }
    }
    this.parcels = active; this.rockImpulse = add(this.rockImpulse,supply.reaction);
    addSourceSupportMoments(receipt.delivered,supply.delivered); receipt.remaining = remaining; receipt.lastTickSteps = structuredClone(supply.steps);
    receipt.cumulativeClosureEnergyDifference += supply.steps.reduce((sum,step)=>sum+step.closureEnergyDifference,0);
    receipt.cumulativeDeliveredIncomingKinetic += supply.delivered.kinetic;
    receipt.mappedChordPositionMoment = add(receipt.mappedChordPositionMoment,supply.mappedChordPositionMoment);
    receipt.curveToChordPositionMoment = add(receipt.curveToChordPositionMoment,supply.curveToChordPositionMoment);
    receipt.curveToChordBedPotentialChange += supply.curveToChordBedPotentialChange;
    const remap = this.junctionRemap;
    remap.volume += supply.delivered.volume; remap.incomingPositionMoment = add(remap.incomingPositionMoment,supply.delivered.positionMoment);
    remap.portPositionMoment = add(remap.portPositionMoment,supply.delivered.positionMoment);
    remap.incomingPotential += supply.delivered.potential; remap.portBedPotential += supply.delivered.potential;
    remap.arrivalTimeMoment += supply.delivered.arrivalTimeMoment; remap.maximumAdmissionTimingUncertainty = this.options.dt;
  }

  private advanceSupport(parcel: ContactParcel, duration: number, intervalStart: number, elapsed: number, pool: number): { time: number; departure: boolean; pool: boolean; hit?: { surface: ContactSurface; hit: { time: number; position: ContactVec3 } } } {
    const support = parcel.support!, surface = this.surfaces.find(s => s.id === support.surfaceId);
    if (!surface) throw Error('support-missing-surface');
    validateSupport(support, surface);
    if (support.referenceTime !== intervalStart + elapsed) throw Error('support-reference-time-mismatch');
    const mass = density * parcel.volume, acceleration = supportComponents([0, -gravity, 0], surface);
    const start = waterfallSupportedPosition(support, surface), velocity = supportVector(support.velocity, surface), worldAcceleration = supportVector(acceleration, surface);
    const departure = supportDeparture(support, surface);
    const hits = this.surfaces.filter(s => s.id !== surface.id).map(s => ({ surface: s, hit: sweepSupportedPlane(support, surface, duration, s) }))
      .filter((entry): entry is { surface: ContactSurface; hit: { time: number; position: ContactVec3 } } => entry.hit !== null).sort((a, b) => a.hit.time - b.hit.time);
    if (hits.length > 1 && hits[0].hit.time === hits[1].hit.time || hits[0] && departure && hits[0].hit.time === departure.time) throw Error('support-simultaneous-distinct-plane-contact');
    const poolTime = start[1] <= pool ? 0 : waterfallSupportExitRoot(start[1] - pool, velocity[1], worldAcceleration[1]);
    const time = Math.min(duration, departure?.time ?? Infinity, hits[0]?.hit.time ?? Infinity, poolTime ?? Infinity);
    const kineticBefore = .5 * mass * dot(velocity, velocity);
    const drift = add(scale(velocity, time), scale(worldAcceleration, .5 * time * time));
    if (![time, ...drift].every(Number.isFinite) || time > 0 && velocity.some(v => v !== 0 && v * time === 0)) throw Error('support-unsupported-range');
    support.coordinate = support.coordinate.map((c, i) => c + support.velocity[i] * time + .5 * acceleration[i] * time * time) as [number, number];
    support.velocity = support.velocity.map((v, i) => v + acceleration[i] * time) as [number, number];
    support.referenceTime = intervalStart + (elapsed + time);
    // Continuous normal reaction is external momentum, with zero theoretical
    // work. Actual chart K/P changes remain signed arithmetic measurements.
    parcel.velocity = supportVector(support.velocity, surface);
    this.supportCounters.kineticChange += .5 * mass * dot(parcel.velocity, parcel.velocity) - kineticBefore;
    this.supportCounters.potentialChange += mass * gravity * drift[1];
    const impulse = scale(sub(worldAcceleration, [0, -gravity, 0]), mass * time);
    this.supportCounters.impulse = add(this.supportCounters.impulse, impulse);
    this.gravityImpulse[1] -= mass * gravity * time; this.rockImpulse = add(this.rockImpulse, impulse);
    const exits = departure !== null && time === departure.time;
    // At a computed root, retain the constructing boundary exactly. Measure
    // its arithmetic conversion, rather than introducing a clearance/nudge.
    const unsnapped = add(surface.vertices[0], supportVector(support.coordinate, surface));
    if (exits) for (const edge of departure.edges) support.coordinate[edge >> 1] = edge % 2;
    validateSupport(support, surface);
    parcel.position = waterfallSupportedPosition(support, surface);
    const conversionPotential = mass * gravity * (parcel.position[1] - start[1]) - mass * gravity * drift[1];
    this.supportCounters.conversionPotentialChange += conversionPotential;
    this.energyCounters.contactPositionPotentialChange += conversionPotential;
    // Keep the unused unsnapped construction finite even when the root lies
    // at an exact corner; no second normal or impact belongs to that corner.
    if (!unsnapped.every(Number.isFinite)) throw Error('support-unsupported-range');
    if (exits) {
      const edge = departure.edges[0], labels = ['upstream', 'downstream', 'across-negative', 'across-positive'];
      parcel.releaseLocal = { surfaceId: surface.id, geometryIdentity: waterfallContactGeometryIdentity(surface), face: -1, edge: labels[edge], anchor: [...support.coordinate], normal: [...surface.normal], clearance: 0, displacement: [0, 0, 0], referenceTime: support.referenceTime };
      parcel.support = undefined; parcel.motionRevision = (parcel.motionRevision ?? 0) + 1;
    }
    return { time, departure: exits, pool: poolTime !== null && time === poolTime, hit: hits[0]?.hit.time === time ? hits[0] : undefined };
  }

  private moveQuadratic(pool: number, arrival: ContactAdvance, transfers: FilmJunctionTransfer[]): void {
    const active: ContactParcel[] = [], dt = this.options.dt;
    for (const parcel of this.parcels) {
      // Finite source carriers use their original birth/span measure. Applying
      // the midpoint path here would double their gravity and consume the tail.
      if (parcel.sourceSupport) { active.push(parcel); continue; }
      const mass = density * parcel.volume;
      // Ownership, rather than subtraction of world-clock timestamps, defines
      // flight age: current source bins own half a tick; committed packets a
      // full tick. Film packets share the previous parent-tick-end reference.
      const newborn = parcel.sourceRelease?.intervalStart === this.time;
      if (!newborn && parcel.birth > this.nextTime) throw Error('quadratic-flight-future-birth');
      const duration = newborn ? dt * .5 : dt;
      const intervalStart = newborn ? parcel.birth : this.time;
      if (parcel.releaseLocal && Math.abs(parcel.releaseLocal.referenceTime - intervalStart) > 1e-12) throw Error('release-local-reference-time-mismatch');
      if (parcel.support && parcel.releaseLocal) throw Error('support-conflicting-ownership');
      if (parcel.support && parcel.support.referenceTime !== intervalStart) throw Error('support-reference-time-mismatch');
      let remaining = duration, elapsed = 0, consumed = false;
      const travel = (time: number) => {
        const drift = waterfallFlightDisplacement(parcel.velocity, time), before = .5 * mass * dot(parcel.velocity, parcel.velocity);
        if (!drift.every(Number.isFinite)) throw Error('quadratic-flight-unsupported-range');
        this.energyCounters.airborneTransportPotentialChange += mass * gravity * drift[1];
        parcel.velocity = [parcel.velocity[0], parcel.velocity[1] - gravity * time, parcel.velocity[2]];
        this.energyCounters.gravityKickKineticChange += .5 * mass * dot(parcel.velocity, parcel.velocity) - before;
        this.gravityImpulse[1] -= mass * gravity * time;
        if (parcel.releaseLocal) {
          const local = parcel.releaseLocal, surface = this.surfaces.find(s => s.id === local.surfaceId);
          if (!surface) throw Error('release-local-missing-surface');
          local.displacement = add(local.displacement, drift); local.referenceTime += time;
          parcel.position = releaseLocalPosition(local, surface);
        } else parcel.position = add(parcel.position, drift);
        elapsed += time; remaining -= time;
      };
      for (let contact = 0; contact < 4 && remaining > 0; contact++) {
        let first: { surface: ContactSurface; hit: { time: number; position: ContactVec3 } } | undefined;
        let fraction: number;
        if (parcel.support) {
          const event = this.advanceSupport(parcel, remaining, intervalStart, elapsed, pool);
          elapsed += event.time; remaining -= event.time;
          if (event.pool) {
            const position: ContactVec3 = [parcel.position[0], pool, parcel.position[2]], momentum = scale(parcel.velocity, mass);
            this.energyCounters.receiverProjectionPotentialChange += mass * gravity * (pool - parcel.position[1]);
            const item: ContactArrival = { time: intervalStart + elapsed, volume: parcel.volume, momentum, weightedPosition: scale(position, parcel.volume), position, velocity: [...parcel.velocity] };
            this.energyCounters.outgoingKinetic += .5 * mass * dot(parcel.velocity, parcel.velocity); this.energyCounters.outgoingPotential += mass * gravity * pool;
            arrival.arrivals.push(item); arrival.volume += item.volume; arrival.momentum = add(arrival.momentum, momentum); arrival.weightedPosition = add(arrival.weightedPosition, item.weightedPosition);
            this.landedVolume += item.volume; this.landedMomentum = add(this.landedMomentum, momentum); consumed = true; remaining = 0; break;
          }
          if (event.departure) continue;
          if (!event.hit) { parcel.support!.referenceTime = this.nextTime; break; }
          first = event.hit; fraction = event.time / (remaining + event.time);
        } else {
        const local = parcel.releaseLocal, supplying = local ? this.surfaces.find(s => s.id === local.surfaceId) : undefined;
        if (local && !supplying) throw Error('release-local-missing-surface');
        const heights = local ? releaseLocalHeightParts(local, supplying!) : null;
        const poolDistance = heights ? heights[0] - pool + heights[1] : parcel.position[1] - pool;
        const poolTime = poolDistance <= 0 ? 0 : waterfallDownwardRoot(poolDistance, parcel.velocity[1], -gravity);
        const hits = this.surfaces.map(surface => ({ surface, hit: sweepWaterfallQuadratic(parcel.position, parcel.velocity, remaining, surface, local?.surfaceId === surface.id ? local : undefined) }))
          .filter((entry): entry is { surface: ContactSurface; hit: { time: number; position: ContactVec3 } } => entry.hit !== null).sort((a, b) => a.hit.time - b.hit.time);
        if (hits.length > 1 && hits[0].hit.time === hits[1].hit.time) throw Error('support-simultaneous-distinct-plane-contact');
        first = hits[0];
        if (poolTime !== null && poolTime <= remaining && (!first || poolTime < first.hit.time)) {
          travel(poolTime);
          const actualHeight = parcel.releaseLocal ? releaseLocalHeightParts(parcel.releaseLocal, supplying!) : null;
          this.energyCounters.receiverProjectionPotentialChange += mass * gravity * (actualHeight ? pool - actualHeight[0] - actualHeight[1] : pool - parcel.position[1]);
          const position: ContactVec3 = [parcel.position[0], pool, parcel.position[2]], momentum = scale(parcel.velocity, mass);
          const item: ContactArrival = { time: intervalStart + elapsed, volume: parcel.volume, momentum, weightedPosition: scale(position, parcel.volume), position, velocity: [...parcel.velocity] };
          this.energyCounters.outgoingKinetic += .5 * mass * dot(parcel.velocity, parcel.velocity);
          this.energyCounters.outgoingPotential += mass * gravity * pool;
          arrival.arrivals.push(item); arrival.volume += item.volume; arrival.momentum = add(arrival.momentum, momentum); arrival.weightedPosition = add(arrival.weightedPosition, item.weightedPosition);
          this.landedVolume += item.volume; this.landedMomentum = add(this.landedMomentum, momentum);
          consumed = true; remaining = 0; break;
        }
        if (!first) {
          travel(remaining);
          // Partial travel retains its event epoch. Only a completed flight
          // commits to the canonical endpoint; repeated += dt drifts away
          // from startTime + tick * dt at large world-clock epochs.
          if (parcel.releaseLocal) parcel.releaseLocal.referenceTime = this.nextTime;
          break;
        }
        const eventTime = first.hit.time;
        fraction = eventTime / remaining;
        travel(eventTime);
        }
        if (!first) throw Error('support-unresolved-event');
        const previous: ContactVec3 = [...parcel.velocity];
        if (first.surface.id === this.surfaces[0].id && this.film) {
          if (!parcel.sourceRelease) throw new JunctionArrivalFailure({ tickTime: this.time, parcel: structuredClone(parcel), hit: [...first.hit.position], fraction });
          this.collectJunctionImpact(parcel, first.hit.position, intervalStart + elapsed, transfers);
          this.contactCount++; this.surfaceContactCounts[first.surface.id] = (this.surfaceContactCounts[first.surface.id] ?? 0) + 1;
          consumed = true; remaining = 0; break;
        }
        // One declared inelastic lower impact, then persistent frictionless
        // support. This is a point/quadrature trajectory, not a new water film.
        parcel.releaseLocal = undefined;
        parcel.support = undefined;
        parcel.velocity = sub(previous, scale(first.surface.normal, Math.min(0, dot(previous, first.surface.normal))));
        this.rockImpulse = add(this.rockImpulse, scale(sub(parcel.velocity, previous), mass));
        const loss = Math.max(0, .5 * mass * (dot(previous, previous) - dot(parcel.velocity, parcel.velocity)));
        parcel.contactEnergy += loss; this.contactEnergy += loss; parcel.contactCount++; this.contactCount++;
        this.surfaceContactCounts[first.surface.id] = (this.surfaceContactCounts[first.surface.id] ?? 0) + 1;
        const support: ContactSupport = { surfaceId: first.surface.id, geometryIdentity: waterfallContactGeometryIdentity(first.surface), coordinate: [(first.hit.position[0] - first.surface.vertices[0][0]) / (first.surface.vertices[1][0] - first.surface.vertices[0][0]), (first.hit.position[2] - first.surface.vertices[0][2]) / (first.surface.vertices[3][2] - first.surface.vertices[0][2])], velocity: supportComponents(parcel.velocity, first.surface), referenceTime: intervalStart + elapsed };
        validateSupport(support, first.surface);
        const projectedVelocity = parcel.velocity;
        parcel.velocity = supportVector(support.velocity, first.surface);
        const conversionKinetic = .5 * mass * (dot(parcel.velocity, parcel.velocity) - dot(projectedVelocity, projectedVelocity));
        this.supportCounters.conversionKineticChange += conversionKinetic;
        this.rockImpulse = add(this.rockImpulse, scale(sub(parcel.velocity, projectedVelocity), mass));
        parcel.position = waterfallSupportedPosition(support, first.surface);
        this.supportCounters.conversionPotentialChange += mass * gravity * (parcel.position[1] - first.hit.position[1]);
        this.energyCounters.contactPositionPotentialChange += mass * gravity * (parcel.position[1] - first.hit.position[1]);
        if (first.surface.normal[1] > 0) parcel.support = support;
        parcel.motionRevision = (parcel.motionRevision ?? 0) + 1;
      }
      if (remaining > 0) throw Error('quadratic-flight-contact-capacity');
      if (!consumed) {
        if (parcel.support) parcel.support.referenceTime = this.nextTime;
        if (parcel.releaseLocal) parcel.releaseLocal.referenceTime = this.nextTime;
        active.push(parcel);
      }
    }
    this.parcels = active;
  }

  private move(pool: number, arrival: ContactAdvance, transfers?: FilmJunctionTransfer[]): void {
    const active: ContactParcel[] = [], dt = this.options.dt;
    for (const parcel of this.parcels) {
      const mass = parcel.volume * density;
      // A new source strip represents uniform births over this tick by its
      // temporal midpoint. Advance that center for half a tick, retaining an
      // explicit O(dt²) gravity centroid approximation. Finite strip edges can
      // meet rock earlier/later; only center contact is resolved in this model.
      // Committed film releases own a full fixed tick. Their epoch must match
      // before mutation; timestamp subtraction must not shorten that flight.
      // Source midpoint and other legacy comparison packets retain their age rule.
      const transportDt = parcel.releaseLocal ? dt : Math.min(dt, Math.max(0, this.time + dt - parcel.birth));
      if (parcel.releaseLocal && Math.abs(parcel.releaseLocal.referenceTime - this.time) > 1e-12) throw Error('release-local-reference-time-mismatch');
      const kineticBeforeKick = .5 * mass * dot(parcel.velocity, parcel.velocity);
      parcel.velocity[1] -= gravity * transportDt;
      this.energyCounters.gravityKickKineticChange += .5 * mass * dot(parcel.velocity, parcel.velocity) - kineticBeforeKick;
      this.gravityImpulse[1] -= mass * gravity * transportDt;
      let remaining = transportDt;
      let captured = false;
      // A fixed upper bound keeps work predictable. These disjoint ledges need
      // at most one new face per tick; repeated near-zero contacts stay bounded.
      for (let contact = 0; contact < 4 && remaining > 1e-12; contact++) {
        const drift = scale(parcel.velocity, remaining), end = add(parcel.position, drift);
        const supplying = parcel.releaseLocal ? this.surfaces.find(s => s.id === parcel.releaseLocal!.surfaceId) : undefined;
        if (parcel.releaseLocal && !supplying) throw Error('release-local-missing-surface');
        // Visit every face in its original order, including release-local guards.
        // Keep the earliest hit directly; strict comparison preserves the stable
        // sort's first-face choice for equal fractions without allocating/sorting
        // a temporary array for every airborne parcel.
        let first: { surface: ContactSurface; hit: { fraction: number; position: ContactVec3 } } | undefined;
        for (let face = 0; face < this.surfaces.length; face++) {
          const surface = this.surfaces[face];
          const hit = parcel.releaseLocal && surface.id === parcel.releaseLocal.surfaceId
            ? sweepWaterfallReleaseLocal(parcel.releaseLocal, drift, surface) : this.packedPlanes ? sweepPackedContact(parcel.position, end, this.packedPlanes[face]) : sweepWaterfallContact(parcel.position, end, surface);
          if (hit && (!first || hit.fraction < first.hit.fraction)) first = { surface, hit };
        }
        if (!first) {
          this.energyCounters.airborneTransportPotentialChange += mass * gravity * (parcel.releaseLocal ? drift[1] : end[1] - parcel.position[1]);
          if (parcel.releaseLocal) {
            parcel.releaseLocal.displacement = add(parcel.releaseLocal.displacement, drift);
            parcel.releaseLocal.referenceTime = this.nextTime;
            parcel.position = releaseLocalPosition(parcel.releaseLocal, supplying!);
          } else parcel.position = end;
          remaining = 0; break;
        }
        this.energyCounters.airborneTransportPotentialChange += mass * gravity * (parcel.releaseLocal ? drift[1] * first.hit.fraction : first.hit.position[1] - parcel.position[1]);
        const previous = parcel.velocity;
        if (first.surface.id === this.surfaces[0].id && this.film) {
          if (transfers) {
            if (!parcel.sourceRelease) throw new JunctionArrivalFailure({ tickTime: this.time, parcel: structuredClone(parcel), hit: [...first.hit.position], fraction: first.hit.fraction });
            this.collectJunctionImpact(parcel, first.hit.position, this.time + dt - transportDt + transportDt * first.hit.fraction, transfers);
            this.contactCount++; this.surfaceContactCounts[first.surface.id] = (this.surfaceContactCounts[first.surface.id] ?? 0) + 1;
            captured = true; remaining = 0; break;
          }
          const capture = this.film.capture(first.hit.position, parcel.volume, previous);
          this.rockImpulse = add(this.rockImpulse, capture.reaction);
          this.contactEnergy += capture.normalEnergyLoss;
          this.contactCount++; this.surfaceContactCounts[first.surface.id] = (this.surfaceContactCounts[first.surface.id] ?? 0) + 1;
          captured = true; remaining = 0; break;
        }
        // A real event owns the change of frame. Ownership transfer above
        // removes the parcel; this continuing contact invalidates its old frame.
        parcel.releaseLocal = undefined;
        const normalSpeed = dot(previous, first.surface.normal);
        parcel.velocity = sub(previous, scale(first.surface.normal, Math.min(0, normalSpeed)));
        const impulse = scale(sub(parcel.velocity, previous), mass);
        this.rockImpulse = add(this.rockImpulse, impulse);
        const dissipated = Math.max(0, .5 * mass * (dot(previous, previous) - dot(parcel.velocity, parcel.velocity)));
        parcel.contactEnergy += dissipated; this.contactEnergy += dissipated;
        parcel.contactCount++; this.contactCount++;
        this.surfaceContactCounts[first.surface.id] = (this.surfaceContactCounts[first.surface.id] ?? 0) + 1;
        parcel.position = add(first.hit.position, scale(first.surface.normal, epsilon));
        this.energyCounters.contactPositionPotentialChange += mass * gravity * (parcel.position[1] - first.hit.position[1]);
        remaining *= 1 - first.hit.fraction;
      }
      if (captured) continue;
      const localHeight = parcel.releaseLocal ? releaseLocalHeightParts(parcel.releaseLocal, this.surfaces.find(s => s.id === parcel.releaseLocal!.surfaceId)!) : null;
      if (localHeight ? localHeight[0] - pool + localHeight[1] <= 0 : parcel.position[1] <= pool) {
        // Each arrival removes one parcel exactly once. Volume-weighted position
        // and physical momentum are returned for the caller's receiver policy.
        const position: ContactVec3 = [parcel.position[0], pool, parcel.position[2]];
        // Receiver energy uses its actual projected pool position and unchanged
        // velocity. Keep this insertion work separate from integration error.
        this.energyCounters.receiverProjectionPotentialChange += mass * gravity * (localHeight ? pool - localHeight[0] - localHeight[1] : position[1] - parcel.position[1]);
        this.energyCounters.outgoingKinetic += .5 * mass * dot(parcel.velocity, parcel.velocity);
        this.energyCounters.outgoingPotential += mass * gravity * position[1];
        const item: ContactArrival = { time: this.time + dt, volume: parcel.volume, momentum: scale(parcel.velocity, mass), weightedPosition: scale(position, parcel.volume), position, velocity: [...parcel.velocity] };
        arrival.arrivals.push(item); arrival.volume += item.volume;
        arrival.momentum = add(arrival.momentum, item.momentum);
        arrival.weightedPosition = add(arrival.weightedPosition, item.weightedPosition);
        this.landedVolume += item.volume; this.landedMomentum = add(this.landedMomentum, item.momentum);
      } else active.push(parcel);
    }
    this.parcels = active;
  }

  private collectJunctionImpact(parcel: ContactParcel, position: ContactVec3, arrivalTime: number, transfers: FilmJunctionTransfer[]): void {
    if (!this.film || !parcel.sourceRelease) throw Error('impact-junction-nonsource-arrival');
    const z0 = parcel.sourceRelease.start[2], z1 = parcel.sourceRelease.end[2];
    let allocated = 0;
    for (const segment of this.film.junctionSegments()) {
      // The film reconstructs physical plane vertices from exact supplied span
      // cuts. Recover coincident source boundaries within floating roundoff so
      // a nominally zero neighboring-bin overlap cannot create a second port.
      const spanZ = (z: number) => Math.abs(z - z0) < 1e-12 ? z0 : Math.abs(z - z1) < 1e-12 ? z1 : z;
      const overlap = Math.max(0, Math.min(z1, spanZ(segment.end[2])) - Math.max(z0, spanZ(segment.start[2])));
      if (overlap === 0) continue;
      // DEBT: Six source bins are spatial/time quadrature. Their actual center
      // velocity, position first moment and arrival potential are remapped by
      // source-z overlap, not line arclength. No exact sheet-support claim or
      // compensating energy is hidden in this transfer.
      const volume = parcel.volume * overlap / (z1 - z0), duration = this.options.dt;
      const e = unit(sub(segment.end, segment.start)), t = segment.normal, n = this.film.surface.normal;
      const ve = dot(parcel.velocity, e), vt = dot(parcel.velocity, t), vn = dot(parcel.velocity, n);
      const bedY = (segment.start[1] + segment.end[1]) / 2;
      // Incoming V, vector momentum and total mechanical energy stay at the
      // analytic event. The outgoing pressure head pays for the numerical
      // chord's bed potential; mapping is not compensated after the solve.
      const actualSpecificEnergy = .5 * dot(parcel.velocity, parcel.velocity) + gravity * position[1];
      const H = actualSpecificEnergy - gravity * bedY - .5 * ve * ve;
      const solved = solveWaterfallImpactJunction({ q: volume / duration / segment.length, ve, vt, vn, gn: gravity * n[1], H, density, span: segment.length, duration });
      if (!solved.ok) throw Error(`impact-junction-${solved.reason}`);
      const port = (p: typeof solved.plus, sign: number) => {
        const portVolume = p.q * segment.length * duration;
        const velocity = add(scale(e, ve), scale(t, sign * p.s));
        const traction = density * duration * segment.length * (.5 * gravity * n[1] * p.h * p.h);
        return { volume: portVolume, velocity, height: p.h,
          momentum: add(scale(velocity, density * portVolume), scale(t, sign * traction)),
          energy: density * portVolume * (.5 * dot(velocity, velocity) + gravity * bedY + gravity * n[1] * p.h) };
      };
      const minus = port(solved.minus, -1), plus = port(solved.plus, 1);
      const incomingEnergy = density * volume * (.5 * dot(parcel.velocity, parcel.velocity) + gravity * position[1]);
      transfers.push({ face: segment.face, incomingVolume: volume, incomingEnergy, minus, plus,
        reaction: sub(add(minus.momentum, plus.momentum), scale(parcel.velocity, density * volume)) });
      // Only an explicitly armed diagnostic keeps original arrival provenance.
      // A copy failure marks observation incomplete without rejecting water or
      // changing the existing numerical update. The runner must stop on it.
      const observation = this.filmEnergyContext;
      if (observation && observation.tick === this.tick && !observation.closed && !observation.sourceCollectionComplete && !observation.error) {
        try {
          if (observation.sourceEvents.length >= observation.maximumSourceRows) observation.error = 'source-observer-capacity';
          else observation.sourceEvents.push(structuredClone({ parcel, position, arrivalTime, segment,
            transferIndex: transfers.length - 1, transfer: transfers[transfers.length - 1] }));
        } catch (error) { observation.error = error instanceof Error ? error.message : 'source-observer-copy-failure'; }
      }
      allocated += volume;
      const remap = this.junctionRemap;
      remap.volume += volume;
      remap.incomingPositionMoment = add(remap.incomingPositionMoment, scale(position, volume));
      remap.portPositionMoment = add(remap.portPositionMoment, scale(add(segment.start, segment.end), volume / 2));
      remap.incomingPotential += density * volume * gravity * position[1];
      remap.portBedPotential += density * volume * gravity * bedY;
      remap.mappingPotentialChange += density * volume * gravity * (bedY - position[1]);
      remap.arrivalTimeMoment += volume * arrivalTime;
      remap.maximumAdmissionTimingUncertainty = this.options.dt;
    }
    if (Math.abs(allocated - parcel.volume) > 1e-10 * parcel.volume) throw Error('impact-junction-unowned-arrival');
  }

  /** Claim the original substep records before the legacy face aggregation.
   * Pending records are frozen transfer inventory, not moving free-flight
   * liquid: downstream material motion still requires a qualified receiver. */
  private routeOriginalFilmReleases(outflows:FilmOutflow[]):FilmOutflow[] {
    const routing=this.originalReleaseRouting,state=this.originalReleaseOwnership;
    if(!routing||!state||!outflows.length)return outflows;
    const records=outflows.map((outflow,index)=>{
      const origin=outflow.origin;
      if(!origin||!this.film||origin.surfaceId!==this.film.surface.id||origin.geometryIdentity!==waterfallContactGeometryIdentity(this.film.surface))throw Error('Original Film release provenance missing');
      return {id:JSON.stringify([routing.ownerId,this.options.startTime,this.tick,index,origin.surfaceId,origin.geometryIdentity,outflow.edge,outflow.face,outflow.intervalStart,outflow.intervalEnd]),outflow:structuredClone(outflow),support:structuredClone(this.film.surface)};
    });
    this.releaseOwnershipBusy=true;let claims:readonly string[];
    try{claims=routing.select(structuredClone(records));}finally{this.releaseOwnershipBusy=false;}
    if(!Array.isArray(claims)||new Set(claims).size!==claims.length||claims.some(id=>!records.some(r=>r.id===id)))throw Error('Invalid original Film release selection');
    // Every experimental terminal transfer retains its original layer/pressure
    // metadata. A missing receiver cannot turn this into an unqualified parcel.
    if (this.options.filmMode === FOUR_LAYER_FILM_MODE && claims.length !== records.length) throw Error('layered-film-unclaimed-terminal-transfer');
    if(state.pending.length+claims.length>routing.capacity)throw Error('original-film-release-capacity');
    const claimed=new Set(claims);
    state.pending.push(...records.filter(r=>claimed.has(r.id)));
    return outflows.filter((_,i)=>!claimed.has(records[i].id));
  }

  private releaseFilm(outflows: FilmOutflow[]): void {
    for (const flow of outflows) {
      if (flow.layered) throw Error('layered-film-detachment-unresolved');
      if (!flow.origin || (flow.height > 0 && flow.height * .5 === 0)) throw Error('release-local-unsupported-clearance-range');
      const position = scale(add(flow.start, flow.end), .5);
      this.parcels.push({ id: this.nextId++, position, velocity: [...flow.velocity], volume: flow.volume, birth: this.nextTime, contactCount: 0, contactEnergy: 0,
        releaseLocal: flow.origin ? { ...structuredClone(flow.origin), clearance: flow.height * .5, displacement: [0, 0, 0], referenceTime: this.nextTime } : undefined,
        sheetRelease: { edge: flow.edge, start: [...flow.start], end: [...flow.end], intervalStart: flow.intervalStart, intervalEnd: flow.intervalEnd, velocity: [...flow.velocity], birthTime: this.nextTime } });
    }
  }

  private aggregateReleases(outflows: FilmOutflow[]): FilmOutflow[] {
    const rows: FilmOutflow[] = [], latest = new Map<number, FilmOutflow>();
    for (const out of outflows) {
      // The original-owner route must consume these whole records. Merging a
      // versioned row would retain stale first-record profile/energy metadata.
      if (out.layered) throw Error('layered-film-terminal-aggregation-forbidden');
      const prior = latest.get(out.face);
      // Every film substep is still placed at this parent tick's end, before
      // any flight. Flux interval times describe support, not different ages.
      // Thus averaging clearance retains the existing common-time centroid.
      if (!out.origin || out.intervalStart < this.time - epsilon || out.intervalEnd > this.time + this.options.dt + epsilon) throw Error('release-local-missing-or-different-age');
      // Only contiguous releases from this SAME physical edge face merge.
      // Genuinely dry intervals terminate support. Temporal averaging retains
      // volume and momentum and reports its kinetic mixing loss separately.
      if (!prior || Math.abs(prior.intervalEnd - out.intervalStart) > 1e-10) {
        const copy = structuredClone(out); rows.push(copy); latest.set(out.face, copy); continue;
      }
      const amount = prior.volume + out.volume, momentum = add(prior.momentum, out.momentum);
      if (JSON.stringify(prior.origin) !== JSON.stringify(out.origin)) throw Error('release-local-aggregation-origin-mismatch');
      const before = (dot(prior.momentum, prior.momentum) / prior.volume + dot(out.momentum, out.momentum) / out.volume) / (2 * density);
      const after = dot(momentum, momentum) / (2 * density * amount);
      this.releaseMixingEnergyLoss += Math.max(0, before - after);
      prior.start = divide(add(scale(prior.start, prior.volume), scale(out.start, out.volume)), amount);
      prior.end = divide(add(scale(prior.end, prior.volume), scale(out.end, out.volume)), amount);
      prior.height = (prior.height * prior.volume + out.height * out.volume) / amount;
      prior.volume = amount; prior.momentum = momentum; prior.velocity = divide(momentum, density * amount);
      prior.intervalEnd = out.intervalEnd; prior.time = out.time;
    }
    return rows;
  }

  snapshot(): ContactSnapshot {
    let airborneVolume = 0;
    let airborneKinetic = 0, airbornePotential = 0;
    let airborneMomentum: ContactVec3 = [0, 0, 0];
    let supportedVolume = 0, supportedKinetic = 0, supportedPotential = 0;
    let supportedMomentum: ContactVec3 = [0, 0, 0];
    for (const p of this.parcels) {
      if (p.sourceSupport) {
        const moments = p.sourceSupport.moments;
        airborneVolume += moments.volume; airborneMomentum = add(airborneMomentum,moments.momentum);
        airborneKinetic += moments.kinetic; airbornePotential += moments.potential;
        continue;
      }
      if (p.support) {
        const surface = this.surfaces.find(s => s.id === p.support!.surfaceId);
        if (!surface) throw Error('support-missing-surface');
        // Inspection preserves even rejected provenance for the failure
        // checkpoint; strict geometry/time validation occurs before motion.
        const position = add(surface.vertices[0], supportVector(p.support.coordinate, surface)), velocity = supportVector(p.support.velocity, surface);
        supportedVolume += p.volume; supportedMomentum = add(supportedMomentum, scale(velocity, p.volume * density));
        supportedKinetic += .5 * density * p.volume * dot(velocity, velocity);
        supportedPotential += density * p.volume * gravity * position[1];
        continue;
      }
      airborneVolume += p.volume; airborneMomentum = add(airborneMomentum, scale(p.velocity, p.volume * density));
      airborneKinetic += .5 * density * p.volume * dot(p.velocity, p.velocity);
      if (p.releaseLocal) {
        const surface = this.surfaces.find(s => s.id === p.releaseLocal!.surfaceId);
        if (!surface) throw Error('release-local-missing-surface');
        const [bedY, relativeY] = releaseLocalHeightParts(p.releaseLocal, surface);
        // Keep potential on the same position interpretation as collision.
        // This is measured storage, not an offset impulse or energy repair.
        airbornePotential += density * p.volume * gravity * bedY + density * p.volume * gravity * relativeY;
      } else airbornePotential += density * p.volume * gravity * p.position[1];
    }
    const film = this.film?.snapshot() ?? null, filmVolume = film?.receipt.volume ?? 0;
    const filmMomentum: ContactVec3 = film?.receipt.momentum ?? [0, 0, 0];
    // Match the film's cell-center plus hydrostatic-column energy exactly.
    // Direct division keeps subnormal tails finite without reciprocal overflow.
    let filmKinetic = 0, filmPotential = 0;
    for (const cell of film?.cells ?? []) {
      filmKinetic += film?.layered ? layerKinetic(film.layered.columns[cell.id]) : cell.volume > 0 ? dot(cell.tangentialMomentum, cell.tangentialMomentum) / (2 * density * cell.volume) : 0;
      filmPotential += density * cell.volume * (gravity * cell.center[1] + .5 * film!.receipt.normalGravity * cell.height);
    }
    const ownership=this.originalReleaseOwnership;
    let pendingReleaseVolume=0,pendingReleaseMomentum:ContactVec3=[0,0,0],pendingReleaseKinetic=0,pendingReleasePotential=0;
    for(const r of ownership?.pending??[]){const o=r.outflow,energy=originalFilmReleaseEnergy(r);pendingReleaseVolume+=o.volume;pendingReleaseMomentum=add(pendingReleaseMomentum,o.momentum);pendingReleaseKinetic+=energy.kinetic;pendingReleasePotential+=energy.potential;}
    const counters = this.energyCounters;
    const airborneIntegrationEnergyChangeSigned = counters.gravityKickKineticChange + counters.airborneTransportPotentialChange;
    const captureNormalEnergyLoss = film?.receipt.normalEnergyLoss ?? 0;
    const lowerContactNormalEnergyLoss = this.contactEnergy - captureNormalEnergyLoss;
    const captureMixingEnergyLoss = film?.receipt.mixingEnergyLoss ?? 0;
    const depositionPotentialEnergyChange = film?.receipt.depositionPotentialEnergyChange ?? 0;
    const filmNumericalEnergyLossSigned = film?.receipt.numericalEnergyLossSigned ?? 0;
    const junctionIncomingEnergy = film?.receipt.junctionIncomingEnergy ?? 0, junctionOutgoingEnergy = film?.receipt.junctionOutgoingEnergy ?? 0;
    const junctionEnergyDiscrepancy = junctionOutgoingEnergy - junctionIncomingEnergy;
    const filmViscousLoss = film?.layered?.ledger.viscousLoss ?? 0, filmBackwardEulerLoss = film?.layered?.ledger.backwardEulerLoss ?? 0;
    // A terminal boundary carries its numerical energy flux as well as physical
    // profile inventory. Keep their difference explicit, never label it drag or
    // work reconstructed from a global energy residual. ENERGY_UNKNOWN remains.
    const layeredTerminalEnergyDifference = (ownership?.exportedLayeredEnergyDifference ?? 0) + (ownership?.pending ?? []).reduce((sum, r) => sum + (r.outflow.layered ? r.outflow.layered.energyFlux - r.outflow.layered.profileKinetic - r.outflow.layered.potential : 0), 0);
    const support: ContactSupportReceipt = { ...structuredClone(this.supportCounters), volume: supportedVolume, momentum: supportedMomentum, kinetic: supportedKinetic, potential: supportedPotential, wallImpulse: scale(this.supportCounters.impulse, -1), theoreticalWork: 0, numericalEnergyChangeSigned: this.supportCounters.kineticChange + this.supportCounters.potentialChange };
    const unexplainedResidual = counters.inputKinetic + counters.inputPotential + airborneIntegrationEnergyChangeSigned
      + support.numericalEnergyChangeSigned + support.conversionKineticChange
      + counters.contactPositionPotentialChange + counters.receiverProjectionPotentialChange + depositionPotentialEnergyChange + junctionEnergyDiscrepancy
      - this.contactEnergy - captureMixingEnergyLoss - this.releaseMixingEnergyLoss - filmNumericalEnergyLossSigned - filmViscousLoss - filmBackwardEulerLoss - layeredTerminalEnergyDifference
      - airborneKinetic - airbornePotential - supportedKinetic - supportedPotential - filmKinetic - filmPotential - counters.outgoingKinetic - counters.outgoingPotential
      - pendingReleaseKinetic - pendingReleasePotential - (ownership?.exportedKinetic??0) - (ownership?.exportedPotential??0);
    const energy: ContactEnergyReceipt = { ...counters, junctionIncomingEnergy, junctionOutgoingEnergy, junctionEnergyDiscrepancy, datumY: 0, airborneKinetic, airbornePotential, filmKinetic, filmPotential,
      ...(this.options.filmMode === FOUR_LAYER_FILM_MODE ? { filmViscousLoss, filmBackwardEulerLoss, layeredTerminalEnergyDifference, layeredEnergyStatus: 'ENERGY_UNKNOWN' as const } : {}),
      airborneIntegrationEnergyChangeSigned, filmNumericalEnergyLossSigned, captureNormalEnergyLoss, lowerContactNormalEnergyLoss,
      captureMixingEnergyLoss, depositionPotentialEnergyChange, releaseMixingEnergyLoss: this.releaseMixingEnergyLoss, unexplainedResidual,
      ...(ownership?{pendingReleaseKinetic,pendingReleasePotential,exportedReleaseKinetic:ownership.exportedKinetic,exportedReleasePotential:ownership.exportedPotential}:{}) };
    return { parcels: this.parcels.map(copyPublicParcel), surfaces: this.surfaces.map(surface => ({ ...surface, vertices: surface.vertices.map(v => [...v] as ContactVec3) as ContactSurface['vertices'], normal: [...surface.normal] })), film,
      receipt: { ...(this.options.filmSubdivision === '4x3-v1' ? { filmSubdivision: '4x3-v1' as const } : {}), ...(this.options.firstImpactModel===KINETIC_EXACT_IMPACT_MODEL?{firstImpactModel:KINETIC_EXACT_IMPACT_MODEL}:{}), ...(this.sourceSupportReceipt ? { sourceSupport: structuredClone(this.sourceSupportReceipt) } : {}), ...(this.options.impactMode === 'junction' ? { airborneTrajectory: 'constant-gravity' as const, support } : {}), junctionRemap: structuredClone(this.junctionRemap), failureDiagnostic: this.failureDiagnostic ? structuredClone(this.failureDiagnostic) : null, energy, time: this.time, emittedVolume: this.emittedVolume, airborneVolume, filmVolume, totalOwnedVolume: airborneVolume + supportedVolume + filmVolume + pendingReleaseVolume, landedVolume: this.landedVolume, budgetError: this.emittedVolume - airborneVolume - supportedVolume - filmVolume - this.landedVolume - pendingReleaseVolume - (ownership?.exportedVolume??0),
        ...(ownership?{originalReleaseOwnership:{ownerId:ownership.ownerId,pendingCount:ownership.pending.length,pendingVolume:pendingReleaseVolume,pendingMomentum:pendingReleaseMomentum,exportedVolume:ownership.exportedVolume,exportedMomentum:[...ownership.exportedMomentum] as ContactVec3,exportedKinetic:ownership.exportedKinetic,exportedPotential:ownership.exportedPotential,acknowledgedCount:ownership.acknowledgedCount}}:{}),
        emittedMomentum: [...this.emittedMomentum], airborneMomentum, filmMomentum, totalOwnedMomentum: add(add(add(airborneMomentum, supportedMomentum), filmMomentum),pendingReleaseMomentum), releaseMixingEnergyLoss: this.releaseMixingEnergyLoss, landedMomentum: [...this.landedMomentum], gravityImpulse: add(this.gravityImpulse, film?.receipt.gravityImpulse ?? [0, 0, 0]), rockImpulse: add(this.rockImpulse, film?.receipt.supportImpulse ?? [0, 0, 0]), contactCount: this.contactCount, contactEnergy: this.contactEnergy,
        surfaceContactCounts: { ...this.surfaceContactCounts },
        ticks: this.tick, lastAdvanceSteps: this.lastAdvanceSteps, lastAdvanceMilliseconds: this.lastAdvanceMilliseconds, lagSeconds: Math.max(0, this.targetTime - this.time), failure: this.failure, parcelCount: this.parcels.length } };
  }

  /** The native receiver can roll back an unhealthy step together with its
   * contact experiment. Keeping both ledgers at the same step prevents a
   * rejected pool deposit from consuming an arrival or admitting water twice. */
  saveState(): ContactFlowState {
    return { ...(this.options.filmSubdivision === '4x3-v1' ? { filmSubdivision: '4x3-v1' as const } : {}), ...(this.options.firstImpactModel===KINETIC_EXACT_IMPACT_MODEL?{firstImpactModel:KINETIC_EXACT_IMPACT_MODEL}:{}), ...(this.sourceSupportReceipt ? { sourceSupportMode: FINITE_SOURCE_SUPPORT_MODE, sourceSupportReceipt: structuredClone(this.sourceSupportReceipt) } : {}), ...(this.sourceSpans ? { sourceSpans: structuredClone(this.sourceSpans) } : {}), ...(this.options.filmMode === FOUR_LAYER_FILM_MODE ? { filmMode: FOUR_LAYER_FILM_MODE } : {}), ...(this.originalReleaseOwnership?{originalReleaseOwnership:structuredClone(this.originalReleaseOwnership)}:{}),fixedSourceShape: this.fixedSourceShape, supportCounters: structuredClone(this.supportCounters), impactMode: this.options.impactMode, junctionSource: this.junctionSource, snapshot: this.snapshot(), nextId: this.nextId, targetTime: this.targetTime, startTime: this.options.startTime, dt: this.options.dt, filmState: this.film?.saveState() ?? null, filmSurface: this.film ? structuredClone(this.film.surface) : null, releaseMixingEnergyLoss: this.releaseMixingEnergyLoss, energyCounters: { ...this.energyCounters } };
  }
  /** Copies only the numerical fields read by the unchanged restoration map.
   * Film retains its own internal rollback. Public saveState/snapshot still
   * construct their complete, independently mutable presentation records. */
  private saveRollbackState(): ContactRollbackState {
    // Public checkpoint construction already rejects a missing supplying
    // surface before the tick's transaction begins. Preserve that error order
    // and support precedence without calculating any presentation totals.
    for (const p of this.parcels) {
      if (p.support) {
        if (!this.surfaces.find(s => s.id === p.support!.surfaceId)) throw Error('support-missing-surface');
        continue;
      }
      if (p.releaseLocal && !this.surfaces.find(s => s.id === p.releaseLocal!.surfaceId)) throw Error('release-local-missing-surface');
    }
    const filmState = this.film?.saveState() ?? null;
    return {
      ...(this.options.filmSubdivision === '4x3-v1' ? { filmSubdivision: '4x3-v1' as const } : {}),
      ...(this.options.firstImpactModel===KINETIC_EXACT_IMPACT_MODEL?{firstImpactModel:KINETIC_EXACT_IMPACT_MODEL}:{}),
      ...(this.sourceSupportReceipt ? { sourceSupportMode: FINITE_SOURCE_SUPPORT_MODE, sourceSupportReceipt: structuredClone(this.sourceSupportReceipt) } : {}),
      ...(this.sourceSpans ? { sourceSpans: structuredClone(this.sourceSpans) } : {}),
      ...(this.options.filmMode === FOUR_LAYER_FILM_MODE ? { filmMode: FOUR_LAYER_FILM_MODE } : {}),
      ...(this.originalReleaseOwnership?{originalReleaseOwnership:structuredClone(this.originalReleaseOwnership)}:{}),
      fixedSourceShape: this.fixedSourceShape, supportCounters: structuredClone(this.supportCounters), impactMode: this.options.impactMode, junctionSource: this.junctionSource,
      snapshot: {
        parcels: this.parcels.map(copyRollbackParcel),        surfaces: this.surfaces.map(surface => ({ ...surface, vertices: surface.vertices.map(v => [...v] as ContactVec3) as ContactSurface['vertices'], normal: [...surface.normal] })),
        receipt: {
          ticks: this.tick, emittedVolume: this.emittedVolume, landedVolume: this.landedVolume,
          emittedMomentum: [...this.emittedMomentum], landedMomentum: [...this.landedMomentum],
          // Preserve snapshot's aggregate addition before restore subtracts
          // Film. Saving raw Flow impulses would change floating-point results.
          gravityImpulse: add(this.gravityImpulse, filmState?.gravityImpulse ?? [0, 0, 0]), rockImpulse: add(this.rockImpulse, filmState?.supportImpulse ?? [0, 0, 0]),
          contactCount: this.contactCount, contactEnergy: this.contactEnergy, surfaceContactCounts: { ...this.surfaceContactCounts },
          failure: this.failure, lastAdvanceSteps: this.lastAdvanceSteps, lastAdvanceMilliseconds: this.lastAdvanceMilliseconds,
          failureDiagnostic: this.failureDiagnostic ? structuredClone(this.failureDiagnostic) : null, junctionRemap: structuredClone(this.junctionRemap),
        },
      },
      nextId: this.nextId, targetTime: this.targetTime, startTime: this.options.startTime, dt: this.options.dt,
      filmState, filmSurface: this.film ? structuredClone(this.film.surface) : null, releaseMixingEnergyLoss: this.releaseMixingEnergyLoss, energyCounters: { ...this.energyCounters },
    };
  }
  /** Outer owners can restore several flows atomically without constructing display
   * totals or exposing mutable water records. The existing compact copy and restore
   * arithmetic also serve the Flow's own failed-tick rollback; physics is unchanged. */
  saveTransactionState(): ContactTransactionCheckpoint {
    const state = this.saveRollbackState();
    const token = Object.freeze({}) as ContactTransactionCheckpoint;
    this.transactionCheckpoints.set(token, state);
    return token;
  }
  /** The fixed-tick owner and Flow share one restorable copy. A failed tick
   * restores the entry state before returning; successful siblings can still be
   * rolled back by the outer owner using the returned token. No display data,
   * timestep or numerical operation is changed by this ownership shortcut. */
  advanceTransactionalTick(time: number, sourceAt: (time: number) => ContactSource): { advance: ContactAdvance; checkpoint: ContactTransactionCheckpoint; failure: string | null } {
    if (this.options.maxStepsPerAdvance !== 1 || this.borrowedTickCheckpoint) throw Error('Contact transaction requires one nonreentrant tick');
    const checkpoint = this.saveTransactionState();
    this.borrowedTickCheckpoint = this.transactionCheckpoints.get(checkpoint)!;
    try {
      const advance = this.advanceTo(time, sourceAt);
      const failure = this.failureReason ?? (this.time !== time ? 'fixed-tick-not-completed' : null);
      if (failure) this.restoreTransactionState(checkpoint);
      return { advance, checkpoint, failure };
    } catch (error) {
      this.restoreTransactionState(checkpoint);
      throw error;
    } finally { this.borrowedTickCheckpoint = null; }
  }
  restoreTransactionState(token: ContactTransactionCheckpoint): void {
    if (this.releaseOwnershipBusy) throw Error('Original release ownership operation is reentrant');
    const state = this.transactionCheckpoints.get(token);
    if (!state) throw Error('Contact transaction checkpoint owner mismatch');
    this.restoreRollbackState(state);
  }
  restoreState(state: ContactFlowState): void { if(this.releaseOwnershipBusy)throw Error('Original release ownership operation is reentrant');this.restoreRollbackState(state); }
  private restoreRollbackState(state: ContactRollbackState): void {
    if ((state.filmSubdivision ?? 'none') !== this.options.filmSubdivision || (state.filmState?.junctionGeometry?.subdivision ?? 'none') !== (state.filmState?.junctionGeometry ? this.options.filmSubdivision : 'none')) throw Error('Contact rollback film subdivision mismatch');
    if((state.firstImpactModel??'hydraulic-be-v1')!==this.options.firstImpactModel)throw Error('Contact rollback first impact model mismatch');
    if ((state.sourceSupportMode ?? 'midpoint') !== this.options.sourceSupportMode || Boolean(state.sourceSupportReceipt) !== Boolean(this.sourceSupportReceipt)) throw Error('Contact rollback source support mode mismatch');
    if (JSON.stringify(state.sourceSpans ?? null) !== JSON.stringify(this.sourceSpans)) throw Error('Contact rollback source spans mismatch');
    if ((state.filmMode ?? 'single-layer') !== this.options.filmMode) throw Error('Contact rollback Film mode mismatch');
    if (state.startTime !== this.options.startTime || state.dt !== this.options.dt) throw new Error('Contact rollback clock mismatch');
    if (state.impactMode !== this.options.impactMode) throw new Error('Contact rollback impact mode mismatch');
    const ownership=state.originalReleaseOwnership;
    if (this.options.filmMode === FOUR_LAYER_FILM_MODE) {
      if (!ownership || !Number.isFinite(ownership.exportedLayeredEnergyDifference)) throw Error('Contact rollback layered ownership mismatch');
      for (const record of ownership.pending) validateLayeredFilmOutlet(record.outflow);
    } else if (ownership?.pending.some(record => record.outflow.layered) || ownership?.exportedLayeredEnergyDifference !== undefined) throw Error('Contact rollback Film mode mismatch');
    if(ownership && (!this.originalReleaseRouting||ownership.ownerId!==this.originalReleaseRouting.ownerId||ownership.pending.length>this.originalReleaseRouting.capacity||new Set(ownership.pending.map(r=>r.id)).size!==ownership.pending.length||![ownership.exportedVolume,ownership.exportedKinetic,ownership.exportedPotential,...ownership.exportedMomentum].every(Number.isFinite)||ownership.exportedVolume<0||!Number.isSafeInteger(ownership.acknowledgedCount)||ownership.acknowledgedCount<0))throw Error('Contact rollback original release ownership mismatch');
    for(const r of ownership?.pending??[]){const o=r.outflow,origin=o.origin;if(!r.id||!origin||origin.surfaceId!==r.support.id||origin.geometryIdentity!==waterfallContactGeometryIdentity(r.support)||o.edge!==`${origin.surfaceId}:${origin.edge}`||o.face!==origin.face||!(o.volume>0)||!(o.intervalEnd>o.intervalStart)||o.time!==o.intervalEnd||![o.volume,o.height,o.intervalStart,o.intervalEnd,...o.start,...o.end,...o.velocity,...o.momentum].every(Number.isFinite))throw Error('Contact rollback malformed pending release');}
    // Reject the entire checkpoint before touching parcels, clocks or ledgers.
    // A matching first ledge alone cannot certify the lower collision terrain.
    if (this.fixedTerrainIdentity && (terrainIdentity(state.snapshot.surfaces) !== this.fixedTerrainIdentity
      || state.filmSurface && waterfallContactGeometryIdentity(state.filmSurface) !== waterfallContactGeometryIdentity(state.snapshot.surfaces[0]))) throw Error('Contact rollback terrain mismatch');
    // Film validates its own grid and saved arrays. For fixed fixtures, do
    // that on a candidate before committing any Flow fields, so a malformed
    // film checkpoint cannot leave half-restored water in the comparison.
    let fixedFilm: WaterfallContactFilm | null = null;
    if (this.fixedTerrainIdentity || this.options.filmMode === FOUR_LAYER_FILM_MODE) {
      if (Boolean(state.filmSurface) !== Boolean(state.filmState)) throw Error('Contact rollback film state mismatch');
      fixedFilm = state.filmSurface ? new WaterfallContactFilm(this.fixedTerrainIdentity ? fixedContactTerrain([state.filmSurface])[0] : structuredClone(state.filmSurface), 12, 16, 64, .35, this.options.filmMode,this.options.firstImpactModel) : null;
      if (fixedFilm && state.filmState) fixedFilm.restoreState(state.filmState);
    }
    const { receipt: r } = state.snapshot;
    if (this.sourceSupportReceipt) {
      const acceptedTime = this.options.startTime+r.ticks*this.options.dt;
      const validVector = (v: unknown): v is ContactVec3 => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
      const validMoments = (m: SourceSupportMoments | undefined): m is SourceSupportMoments => Boolean(m && validVector(m.momentum) && validVector(m.positionMoment) && [m.volume,m.kinetic,m.potential,m.arrivalTimeMoment].every(Number.isFinite) && m.volume >= 0 && m.kinetic >= 0);
      const savedReceipt = state.sourceSupportReceipt!;
      if (savedReceipt.mode !== FINITE_SOURCE_SUPPORT_MODE || savedReceipt.qualification !== 'midsurface-birth-span-support'
        || !validMoments(savedReceipt.delivered) || !validMoments(savedReceipt.remaining)
        || !validVector(savedReceipt.mappedChordPositionMoment) || !validVector(savedReceipt.curveToChordPositionMoment)
        || ![savedReceipt.betaRelativeDeviationMaximum,savedReceipt.curveToChordBedPotentialChange,savedReceipt.cumulativeClosureEnergyDifference,savedReceipt.cumulativeDeliveredIncomingKinetic].every(Number.isFinite)
        || savedReceipt.cumulativeClosureEnergyDifference < 0 || savedReceipt.cumulativeDeliveredIncomingKinetic < 0
        || savedReceipt.cumulativeDeliveredIncomingKinetic !== savedReceipt.delivered.kinetic
        || Math.abs(savedReceipt.delivered.volume+savedReceipt.remaining.volume-r.emittedVolume) > 1e-10*r.emittedVolume
        || ![savedReceipt.firstArrival,savedReceipt.lastArrival].every(v => v === null || Number.isFinite(v))
        || !Array.isArray(savedReceipt.lastTickSteps) || savedReceipt.lastTickSteps.length > 64
        || savedReceipt.lastTickSteps.some(step => !validMoments(step.moments) || !validVector(step.pressureImpulse)
          || ![step.start,step.end,step.samples,step.pressureWork,step.closureRelativeMaximum,step.closureEnergyDifference,step.chordMeasureRoundoff].every(Number.isFinite)
          || !step.closure || ![...step.closure.differences,...step.closure.unsignedReference,step.closure.relativeMaximum,step.closure.energyDifference,step.closure.cumulativeEnergyDifference,step.closure.energyBudget].every(Number.isFinite)
          || !Array.isArray(step.deliveredByOriginal) || step.deliveredByOriginal.some(item => !Number.isInteger(item.originalId) || !validMoments(item.moments)))) throw Error('Contact rollback malformed finite source receipt');
      const remaining = emptySourceSupportMoments();
      for (const p of state.snapshot.parcels) {
        const carrier = p.sourceSupport;
        if (!carrier) { if (p.sourceRelease) throw Error('Contact rollback missing finite source support'); continue; }
        if (!p.sourceRelease || !state.filmSurface || carrier.mode !== FINITE_SOURCE_SUPPORT_MODE || carrier.cursorTime !== acceptedTime
          || !(carrier.originalVolume > 0) || carrier.moments.volume !== p.volume || p.support || p.releaseLocal
          || !validMoments(carrier.moments) || ![carrier.originalVolume,carrier.cursorTime].every(Number.isFinite)) throw Error('Contact rollback malformed finite source support');
        const expected = new WaterfallSourceSupport(p.sourceRelease,carrier.originalVolume,state.filmSurface).remaining(acceptedTime);
        const actual = carrier.moments;
        for (const key of ['volume','kinetic','potential','arrivalTimeMoment'] as const) if (Math.abs(expected[key]-actual[key]) > 1e-10*Math.max(Math.abs(expected[key]),Math.abs(actual[key]))) throw Error('Contact rollback stale finite source moments');
        for (let k=0;k<3;k++) if (Math.abs(expected.momentum[k]-actual.momentum[k]) > 1e-10*Math.max(Math.abs(expected.momentum[k]),Math.abs(actual.momentum[k]))
          || Math.abs(expected.positionMoment[k]-actual.positionMoment[k]) > 1e-10*Math.max(Math.abs(expected.positionMoment[k]),Math.abs(actual.positionMoment[k]))) throw Error('Contact rollback stale finite source moments');
        addSourceSupportMoments(remaining,actual);
      }
      const values = (m: SourceSupportMoments) => [m.volume,...m.momentum,...m.positionMoment,m.kinetic,m.potential,m.arrivalTimeMoment];
      if (values(remaining).some((v,k) => Math.abs(v-values(savedReceipt.remaining)[k]) > 1e-10*Math.max(Math.abs(v),Math.abs(values(savedReceipt.remaining)[k])))) throw Error('Contact rollback inconsistent finite source ownership');
      this.sourceSupportReceipt = structuredClone(state.sourceSupportReceipt!);
    } else if (state.snapshot.parcels.some(p => p.sourceSupport)) throw Error('Contact rollback unexpected finite source support');
    this.parcels = structuredClone(state.snapshot.parcels);
    this.surfaces = this.fixedTerrainIdentity ? fixedContactTerrain(state.snapshot.surfaces) : state.snapshot.surfaces.map(s => ({ ...s, normal: [...s.normal], vertices: s.vertices.map(v => [...v] as ContactVec3) as ContactSurface['vertices'] }));
    this.fixedSourceShape = state.fixedSourceShape ?? null;
    this.tick = r.ticks; this.nextId = state.nextId; this.targetTime = state.targetTime;
    this.emittedVolume = r.emittedVolume; this.landedVolume = r.landedVolume;
    this.emittedMomentum = [...r.emittedMomentum]; this.landedMomentum = [...r.landedMomentum];
    this.gravityImpulse = sub(r.gravityImpulse, state.filmState?.gravityImpulse ?? [0, 0, 0]); this.rockImpulse = sub(r.rockImpulse, state.filmState?.supportImpulse ?? [0, 0, 0]);
    this.contactCount = r.contactCount; this.contactEnergy = r.contactEnergy;
    this.surfaceContactCounts = { ...r.surfaceContactCounts };
    this.failure = r.failure; this.lastAdvanceSteps = r.lastAdvanceSteps; this.lastAdvanceMilliseconds = r.lastAdvanceMilliseconds;
    this.failureDiagnostic = r.failureDiagnostic ? structuredClone(r.failureDiagnostic) : null;
    this.junctionRemap = { ...structuredClone(r.junctionRemap), mappingPotentialChange: r.junctionRemap.mappingPotentialChange ?? 0 }; this.junctionSource = state.junctionSource;
    this.film = this.fixedTerrainIdentity || this.options.filmMode === FOUR_LAYER_FILM_MODE ? fixedFilm : state.filmSurface ? new WaterfallContactFilm(structuredClone(state.filmSurface), 12, 16, 64, .35, this.options.filmMode,this.options.firstImpactModel) : null;
    if (!this.fixedTerrainIdentity && this.options.filmMode === 'single-layer' && this.film && state.filmState) this.film.restoreState(state.filmState);
    this.releaseMixingEnergyLoss = state.releaseMixingEnergyLoss;
    this.energyCounters = { ...state.energyCounters };
    this.supportCounters = state.supportCounters ? structuredClone(state.supportCounters) : { impulse: [0, 0, 0], kineticChange: 0, potentialChange: 0, conversionKineticChange: 0, conversionPotentialChange: 0 };
    this.originalReleaseOwnership=ownership?structuredClone(ownership):this.originalReleaseRouting?{ownerId:this.originalReleaseRouting.ownerId,pending:[],exportedVolume:0,exportedMomentum:[0,0,0],exportedKinetic:0,exportedPotential:0,acknowledgedCount:0}:undefined;
  }
}

/** Birth geometry is immutable provenance, unlike each parcel's evolving position.
 * Internal rollback can share frozen records; public snapshots still deep-copy. */
function immutableRelease(release: SheetRelease): SheetRelease {
  if (!Object.isFrozen(release)) {
    Object.freeze(release.start); Object.freeze(release.end); Object.freeze(release.velocity); Object.freeze(release);
  }
  return release;
}

// Public snapshots retain independent mutable vectors. A stable object layout
// avoids repeated spread/override work for native parcel records; extra metadata
// retains the original copy path so diagnostics are not silently discarded.
const publicParcelKeys = new Set(['id','position','velocity','volume','birth','contactCount','contactEnergy','sourceSupport','support','releaseLocal','sourceSection','sourceRelease','sheetRelease','motionRevision']);
function copyPublicParcel(p: ContactParcel): ContactParcel {
  const keys=Object.keys(p);
  if (Object.getOwnPropertySymbols(p).length || keys.some(key=>!publicParcelKeys.has(key))
    || ['id','position','velocity','volume','birth','contactCount','contactEnergy'].some(key=>!Object.hasOwn(p,key))) return ({ ...p, ...(p.sourceSupport ? { sourceSupport: structuredClone(p.sourceSupport) } : {}), support: p.support ? copySupportCoordinates(p.support) : undefined, releaseLocal: p.releaseLocal ? copyReleaseCoordinates(p.releaseLocal) : undefined, position: [...p.position], velocity: [...p.velocity], sourceSection: p.sourceSection ? { ...p.sourceSection } : undefined,
      sourceRelease: p.sourceRelease ? { ...p.sourceRelease, start: [...p.sourceRelease.start], end: [...p.sourceRelease.end], velocity: [...p.sourceRelease.velocity] } : undefined,
      sheetRelease: p.sheetRelease ? { ...p.sheetRelease, start: [...p.sheetRelease.start], end: [...p.sheetRelease.end], velocity: [...p.sheetRelease.velocity] } : undefined });
  const copy:ContactParcel = {
    id:p.id,position:[...p.position],velocity:[...p.velocity],volume:p.volume,birth:p.birth,contactCount:p.contactCount,contactEnergy:p.contactEnergy,
    support:p.support?copySupportCoordinates(p.support):undefined,releaseLocal:p.releaseLocal?copyReleaseCoordinates(p.releaseLocal):undefined,
    sourceSection:p.sourceSection?{...p.sourceSection}:undefined,
    sourceRelease:p.sourceRelease?{...p.sourceRelease,start:[...p.sourceRelease.start],end:[...p.sourceRelease.end],velocity:[...p.sourceRelease.velocity]}:undefined,
    sheetRelease:p.sheetRelease?{...p.sheetRelease,start:[...p.sheetRelease.start],end:[...p.sheetRelease.end],velocity:[...p.sheetRelease.velocity]}:undefined
  };
  if(Object.hasOwn(p,'motionRevision'))copy.motionRevision=p.motionRevision;
  if(Object.hasOwn(p,'sourceSupport'))copy.sourceSupport=p.sourceSupport?structuredClone(p.sourceSupport):p.sourceSupport;
  return copy;
}

// Internal rollback keeps the same frozen provenance and independent mutable
// coordinates as before. Building a native record directly avoids spread/
// override churn; extended metadata retains the original compatible copy.
function copyRollbackParcel(p: ContactParcel): ContactParcel {
  const keys=Object.keys(p);
  if (Object.getOwnPropertySymbols(p).length || keys.some(key=>!publicParcelKeys.has(key))
    || ['id','position','velocity','volume','birth','contactCount','contactEnergy'].some(key=>!Object.hasOwn(p,key))) return ({ ...p, ...(p.sourceSupport ? { sourceSupport: structuredClone(p.sourceSupport) } : {}), support: p.support ? copySupportCoordinates(p.support) : undefined, releaseLocal: p.releaseLocal ? copyReleaseCoordinates(p.releaseLocal) : undefined, position: [...p.position], velocity: [...p.velocity], sourceSection: p.sourceSection ? Object.freeze(p.sourceSection) : undefined,
      sourceRelease: p.sourceRelease ? immutableRelease(p.sourceRelease) : undefined,
      sheetRelease: p.sheetRelease ? immutableRelease(p.sheetRelease) : undefined });
  const copy:ContactParcel = {
    id:p.id,position:[...p.position],velocity:[...p.velocity],volume:p.volume,birth:p.birth,contactCount:p.contactCount,contactEnergy:p.contactEnergy,
    support:p.support?copySupportCoordinates(p.support):undefined,releaseLocal:p.releaseLocal?copyReleaseCoordinates(p.releaseLocal):undefined,
    sourceSection:p.sourceSection?Object.freeze(p.sourceSection):undefined,
    sourceRelease:p.sourceRelease?immutableRelease(p.sourceRelease):undefined,
    sheetRelease:p.sheetRelease?immutableRelease(p.sheetRelease):undefined
  };
  if(Object.hasOwn(p,'motionRevision'))copy.motionRevision=p.motionRevision;
  if(Object.hasOwn(p,'sourceSupport'))copy.sourceSupport=p.sourceSupport?structuredClone(p.sourceSupport):p.sourceSupport;
  return copy;
}
