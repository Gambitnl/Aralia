/** The original source's birth-time/span measure until its first rock impact.
 * This is a midsurface source: depth remains collapsed to the existing source
 * center height. Positive quadrature integrates arriving and remaining water
 * with its own momentum, energy and position moments; no center-event trigger,
 * dose compression, particle multiplication or compensating work is used.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 02:10:57
 * Dependents: systems/world3d/river/waterfallContactFilm.ts, systems/world3d/river/waterfallContactFlow.ts, systems/world3d/river/waterfallSourceContact.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ContactSurface, ContactVec3, SheetRelease } from './waterfallContactFlow';
import { waterfallDownwardRoot } from './waterfallFlightRoots';
import type { FilmJunctionSegment } from './waterfallContactFilm';
import { solveWaterfallImpactJunction } from './waterfallImpactJunction';
import {KINETIC_EXACT_IMPACT_MODEL,type FirstImpactModel} from './waterfallLayeredFilm';

export const FINITE_SOURCE_SUPPORT_MODE = 'finite-birth-span-v1' as const;
const rho = 1000, g = 9.81;
const gauss = [[-Math.sqrt(3 / 5), 5 / 9], [0, 8 / 9], [Math.sqrt(3 / 5), 5 / 9]] as const;
const gauss5 = [[-.906179845938664, .236926885056189], [-.538469310105683, .478628670499366], [0, .568888888888889], [.538469310105683, .478628670499366], [.906179845938664, .236926885056189]] as const;
export interface SourceSupportMoments {
  volume: number; momentum: ContactVec3; positionMoment: ContactVec3;
  kinetic: number; potential: number; arrivalTimeMoment: number;
}
export const emptySourceSupportMoments = (): SourceSupportMoments => ({ volume: 0, momentum: [0, 0, 0], positionMoment: [0, 0, 0], kinetic: 0, potential: 0, arrivalTimeMoment: 0 });
export interface SourceArrivalPoint {
  quadrature?: { node:number; weight:number; bounds:number[]; coordinate:'age'|'z'; order:3|5 };
  age: number; z: number; position: ContactVec3; velocity: ContactVec3;
  volume: number; birthStart: number; birthEnd: number; arrivalTimeMean: number;
  /** Positive transverse quadrature weight before birth-time overlap, meters. */
  transverseWeight: number;
  /** True analytic strike length per unit transverse source width. */
  strikeJacobian: number; strikeTangent: ContactVec3;
}
export interface SourceSupportArrival { moments: SourceSupportMoments; points: SourceArrivalPoint[] }
export interface SourceSupportCarrier {
  mode: typeof FINITE_SOURCE_SUPPORT_MODE; originalVolume: number;
  cursorTime: number; moments: SourceSupportMoments;
}
export function addSourceSupportMoments(target: SourceSupportMoments, value: SourceSupportMoments): void {
  target.volume += value.volume; target.kinetic += value.kinetic; target.potential += value.potential; target.arrivalTimeMoment += value.arrivalTimeMoment;
  for (let k = 0; k < 3; k++) { target.momentum[k] += value.momentum[k]; target.positionMoment[k] += value.positionMoment[k]; }
}
function addPoint(target: SourceSupportMoments, volume: number, position: ContactVec3, velocity: ContactVec3, arrivalTime: number) {
  target.volume += volume; target.kinetic += .5 * rho * volume * velocity.reduce((s, v) => s + v * v, 0);
  target.potential += rho * g * volume * position[1]; target.arrivalTimeMoment += volume * arrivalTime;
  for (let k = 0; k < 3; k++) { target.momentum[k] += rho * volume * velocity[k]; target.positionMoment[k] += volume * position[k]; }
}

export class WaterfallSourceSupport {
  readonly beta: number;
  readonly firstArrival: number;
  readonly lastArrival: number;
  readonly forwardSlope: number;
  readonly crossSlope: number;
  readonly intercept: number;
  readonly z0: number;
  readonly z1: number;
  readonly birth0: number;
  readonly birth1: number;
  readonly y0: number;
  readonly speed: number;
  /** Closed pieces may meet a mesh edge exactly. Their reported roundoff is
   * coordinate arithmetic only; it never supplies an occupied water area. */
  readonly boundaryRoundoff: number;
  constructor(readonly release: SheetRelease, readonly originalVolume: number, readonly surface: ContactSurface, closedBoundary = false) {
    this.z0 = release.start[2]; this.z1 = release.end[2]; this.birth0 = release.intervalStart; this.birth1 = release.intervalEnd;
    this.y0 = release.start[1]; this.speed = release.velocity[0];
    const n = surface.normal;
    this.forwardSlope = -n[0] / n[1]; this.crossSlope = -n[2] / n[1];
    this.intercept = surface.vertices[0][1] - this.forwardSlope * surface.vertices[0][0] - this.crossSlope * surface.vertices[0][2];
    if (!(originalVolume > 0 && this.z1 > this.z0 && this.birth1 > this.birth0 && this.speed > 0 && n[1] > 0)
      || ![originalVolume, this.z0, this.z1, this.birth0, this.birth1, this.y0, this.speed, this.forwardSlope, this.crossSlope, this.intercept].every(Number.isFinite)
      || release.start[0] !== 0 || release.end[0] !== 0 || release.end[1] !== this.y0 || release.velocity[1] !== 0 || release.velocity[2] !== 0
      || Math.abs(Math.hypot(...n) - 1) > 1e-12) throw Error('source-support-unreconstructible-source');
    const [a, b, c, d] = surface.vertices;
    if (!(b[0] > a[0] && d[2] > a[2]) || a[2] !== b[2] || b[0] !== c[0] || c[2] !== d[2] || d[0] !== a[0]
      || surface.vertices.some(v => Math.abs(v[1] - this.intercept - this.forwardSlope * v[0] - this.crossSlope * v[2]) > 1e-10)
      || this.z0 < a[2] || this.z1 > d[2]) throw Error('source-support-unsupported-first-ledge');
    this.beta = originalVolume / ((this.birth1 - this.birth0) * (this.z1 - this.z0));
    const ages = [this.ageAt(this.z0), this.ageAt(this.z1)];
    this.boundaryRoundoff = Math.max(0,...ages.map(age=>Math.max(a[0]-this.speed*age,this.speed*age-b[0])));
    const coordinateAllowance=64*Number.EPSILON*Math.max(1,Math.abs(a[0]),Math.abs(b[0]),...ages.map(age=>Math.abs(this.speed*age)));
    if (ages.some(age => !(age > 0)) || (closedBoundary ? this.boundaryRoundoff>coordinateAllowance : ages.some(age=>this.speed*age<=a[0]||this.speed*age>=b[0]))) throw Error('source-support-strike-outside-first-ledge');
    this.firstArrival = this.birth0 + Math.min(...ages); this.lastArrival = this.birth1 + Math.max(...ages);
  }
  ageAt(z: number): number {
    const age = waterfallDownwardRoot(this.y0 - this.intercept - this.crossSlope * z, -this.forwardSlope * this.speed, -g);
    if (age === null) throw Error('source-support-no-first-ledge-flight');
    return age;
  }
  positionAt(age: number, z: number): ContactVec3 { return [this.speed * age, this.y0 - .5 * g * age * age, z]; }
  velocityAt(age: number): ContactVec3 { return [this.speed, -g * age, 0]; }
  strikeAt(age: number) {
    const denominator = this.forwardSlope * this.speed + g * age;
    if (!(denominator > 0)) throw Error('source-support-nonmonotone-flight');
    const derivative = -this.crossSlope / denominator;
    const tangent: ContactVec3 = [this.speed * derivative, -g * age * derivative, 1];
    const jacobian = Math.hypot(...tangent);
    return { jacobian, tangent: tangent.map(v => v / jacobian) as ContactVec3 };
  }
  /** Existing mesh cuts enter only as transverse bounds. Time overlap knots
   * partition integration, never the rock mesh. Constant age uses z directly. */
  private visit(z0: number, z1: number, knots: number[], visit: (age: number, z: number, transverseWeight: number, quadrature?:SourceArrivalPoint['quadrature']) => void, order: 3 | 5 = 3, observe=false) {
    const rule = order === 3 ? gauss : gauss5;
    const lo = Math.max(this.z0, z0), hi = Math.min(this.z1, z1); if (!(hi > lo)) return;
    if (this.crossSlope === 0) {
      const age = this.ageAt(lo), mid = lo + (hi - lo) / 2, half = (hi - lo) / 2;
      for (const [x, w] of rule) visit(age, mid + half * x, half * w, observe?{node:x,weight:w,bounds:[lo,hi],coordinate:'z',order}:undefined);
      return;
    }
    const a0 = this.ageAt(lo), a1 = this.ageAt(hi), low = Math.min(a0, a1), high = Math.max(a0, a1);
    const cuts = [...new Set([low, high, ...knots.filter(a => a > low && a < high)])].sort((a, b) => a - b);
    for (let k = 1; k < cuts.length; k++) {
      const half = (cuts[k] - cuts[k - 1]) / 2, mid = cuts[k - 1] + half;
      for (const [x, w] of rule) {
        const age = mid + half * x;
        const z = (this.y0 - this.intercept - this.forwardSlope * this.speed * age - .5 * g * age * age) / this.crossSlope;
        const jacobian = Math.abs((this.forwardSlope * this.speed + g * age) / this.crossSlope);
        visit(age, z, half * w * jacobian, observe?{node:x,weight:w,bounds:[cuts[k-1],cuts[k]],coordinate:'age',order}:undefined);
      }
    }
  }
  arrivals(start: number, end: number, z0 = this.z0, z1 = this.z1, order: 3 | 5 = 3, observe=false): SourceSupportArrival {
    if (![start, end, z0, z1].every(Number.isFinite) || end < start) throw Error('source-support-invalid-arrival-interval');
    const result: SourceSupportArrival = { moments: emptySourceSupportMoments(), points: [] };
    if (end <= this.firstArrival || start >= this.lastArrival || end === start) return result;
    this.visit(z0, z1, [start - this.birth0, start - this.birth1, end - this.birth0, end - this.birth1], (age, z, transverseWeight,quadrature) => {
      const birthStart = Math.max(this.birth0, start - age), birthEnd = Math.min(this.birth1, end - age);
      if (!(birthEnd > birthStart)) return;
      const volume = this.beta * transverseWeight * (birthEnd - birthStart), position = this.positionAt(age, z), velocity = this.velocityAt(age);
      const arrivalTimeMean = birthStart + (birthEnd - birthStart) / 2 + age, strike = this.strikeAt(age);
      addPoint(result.moments, volume, position, velocity, arrivalTimeMean);
      result.points.push({ age, z, position, velocity, volume, birthStart, birthEnd, arrivalTimeMean, transverseWeight, strikeJacobian: strike.jacobian, strikeTangent: strike.tangent });
      if(quadrature)result.points[result.points.length-1].quadrature=quadrature;
    }, order,observe);
    return result;
  }
  remaining(time: number): SourceSupportMoments {
    if (!Number.isFinite(time)) throw Error('source-support-invalid-airborne-time');
    const result = emptySourceSupportMoments(), upper = Math.min(this.birth1, time);
    if (upper <= this.birth0 || time >= this.lastArrival) return result;
    this.visit(this.z0, this.z1, [time - this.birth0, time - this.birth1], (hitAge, z, transverseWeight) => {
      const lower = Math.max(this.birth0, time - hitAge); if (!(upper > lower)) return;
      const half = (upper - lower) / 2, mid = lower + half;
      for (const [x, w] of gauss) {
        const birth = mid + half * x, age = time - birth;
        addPoint(result, this.beta * transverseWeight * half * w, this.positionAt(age, z), this.velocityAt(age), birth + hitAge);
      }
    });
    return result;
  }
}

export interface FiniteSourcePort {
  volume: number; velocity: ContactVec3; height: number; normal: ContactVec3;
  advectiveMomentum: ContactVec3; pressureImpulse: ContactVec3; pressureWork: number;
  profileKinetic: number; potential: number; advectiveEnergy: number; energy: number;
}
export interface FiniteSourceSample {
  firstImpactModel?: typeof KINETIC_EXACT_IMPACT_MODEL;
  observationProvenance?: unknown;
  originalId: number; face: number; position: ContactVec3; arrivalTimeMean: number;
  incoming: SourceSupportMoments; measureLengthTime: number; strikeJacobian: number;
  minus: FiniteSourcePort; plus: FiniteSourcePort; reaction: ContactVec3;
}
export interface FiniteSourceInterval {
  start: number; end: number; samples: FiniteSourceSample[];
  /** Frozen ordinary face flux acts on the uncovered chord measure-time only.
   * Source traction uses true curve measure-time, never this chord value. */
  ordinaryChordMeasure: Map<number, number>; moments: SourceSupportMoments;
  closure: FiniteSourceClosure;
  chordMeasureRoundoff: number;
}
export interface FiniteSourceClosure {
  worstGroup: { originalId: number; face: number; side: 'minus' | 'plus' } | null;
  differences: number[]; unsignedReference: number[]; relativeMaximum: number;
  energyDifference: number; cumulativeEnergyDifference: number; energyBudget: number;
}
export interface FiniteSourceFailureDiagnostic { stage: 'source-support-quadrature'; start: number; end: number; closure: FiniteSourceClosure }
export class FiniteSourceQuadratureFailure extends Error {
  constructor(readonly diagnostic: FiniteSourceFailureDiagnostic) { super('source-support-closure-quadrature-screen'); }
}
export interface FiniteSourceStepReceipt {
  start: number; end: number; moments: SourceSupportMoments; samples: number;
  pressureImpulse: ContactVec3; pressureWork: number; closureRelativeMaximum: number;
  closureEnergyDifference: number; chordMeasureRoundoff: number;
  closure: FiniteSourceClosure; deliveredByOriginal: { originalId: number; moments: SourceSupportMoments }[];
}
const dot3 = (a: ContactVec3, b: ContactVec3) => a.reduce((s, v, k) => s + v * b[k], 0);
const scale3 = (v: ContactVec3, n: number) => v.map(x => x * n) as ContactVec3;
const add3 = (a: ContactVec3, b: ContactVec3) => a.map((x, k) => x + b[k]) as ContactVec3;
const cross3 = (a: ContactVec3, b: ContactVec3): ContactVec3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/** Ideal shallow/free impingement turns incoming kinetic momentum into two
 * material streams. It prescribes no hydraulic depth, pressure or work.
 * This is not a submerged-impact closure or a measured wet footprint. */
export function kineticImpingementStreams(point:SourceArrivalPoint,n:ContactVec3,e:ContactVec3,t:ContactVec3) {
  const ve=dot3(point.velocity,e),vt=dot3(point.velocity,t),vn=dot3(point.velocity,n),s=Math.hypot(vt,vn);
  if(!(point.volume>0&&vn<0&&s>0)||![ve,vt,vn,s,point.volume,...point.position].every(Number.isFinite))throw Error('kinetic-impingement-unsupported-impact');
  const small=.5*(Math.abs(vn)/s)*(Math.abs(vn)/(s+Math.abs(vt))),plusFraction=vt>=0?1-small:small,minusFraction=vt>=0?small:1-small;
  const port=(fraction:number,sign:number):FiniteSourcePort=>{
    const volume=fraction*point.volume,velocity=add3(scale3(e,ve),scale3(t,sign*s));
    if(!(volume>0))throw Error('kinetic-impingement-unrepresentable-side');
    const profileKinetic=.5*rho*volume*dot3(velocity,velocity),potential=rho*g*volume*point.position[1],advectiveEnergy=profileKinetic+potential;
    return {volume,velocity,height:0,normal:scale3(t,sign),advectiveMomentum:scale3(velocity,rho*volume),pressureImpulse:[0,0,0],pressureWork:0,profileKinetic,potential,advectiveEnergy,energy:advectiveEnergy};
  };
  const minus=port(minusFraction,-1),plus=port(plusFraction,1),incoming=emptySourceSupportMoments();addPoint(incoming,point.volume,point.position,point.velocity,point.arrivalTimeMean);
  const reaction=scale3(n,-rho*point.volume*vn),momentumResidual=add3(add3(minus.advectiveMomentum,plus.advectiveMomentum),scale3(add3(incoming.momentum,reaction),-1));
  if(Math.hypot(...momentumResidual)>1e-10*(Math.hypot(...incoming.momentum)+Math.hypot(...reaction))||Math.abs(minus.profileKinetic+plus.profileKinetic-incoming.kinetic)>1e-10*incoming.kinetic)throw Error('kinetic-impingement-balance');
  return {minus,plus,incoming,reaction,ve,vt,vn,s,plusFraction,minusFraction,momentumResidual};
}
/** Pure interval queries plus a tentative, bounded receipt. Flow commits the
 * receipt and carrier cursors only after the complete Film transaction succeeds.
 * The optional five-node calculation observes nonlinear quadrature discrepancy;
 * it never replaces the selected three-node physical transfer. */
export class FiniteSourceSupply {
  readonly delivered = emptySourceSupportMoments();
  readonly byOriginal = new Map<number, SourceSupportMoments>();
  readonly steps: FiniteSourceStepReceipt[] = [];
  readonly reaction: ContactVec3 = [0,0,0];
  readonly mappedChordPositionMoment: ContactVec3 = [0,0,0];
  readonly curveToChordPositionMoment: ContactVec3 = [0,0,0];
  curveToChordBedPotentialChange = 0;
  private closureEnergyDifference = 0;
  private closureIncomingKinetic = 0;
  constructor(readonly records: { id: number; model: WaterfallSourceSupport }[], readonly segments: FilmJunctionSegment[], readonly closureRelativeLimit: number, priorClosureEnergyDifference = 0, priorIncomingKinetic = 0, readonly observeProvenance=false,readonly firstImpactModel:FirstImpactModel='hydraulic-be-v1') {
    if(firstImpactModel!=='hydraulic-be-v1'&&firstImpactModel!==KINETIC_EXACT_IMPACT_MODEL)throw Error('finite-source-first-impact-model');
    if (!(closureRelativeLimit > 0) || !Number.isFinite(closureRelativeLimit)) throw Error('source-support-invalid-closure-screen');
    if (![priorClosureEnergyDifference,priorIncomingKinetic].every(v => Number.isFinite(v) && v >= 0)) throw Error('source-support-invalid-prior-closure');
    this.closureEnergyDifference = priorClosureEnergyDifference; this.closureIncomingKinetic = priorIncomingKinetic;
  }
  cflBounds(start: number, end: number): { face: number; signalLength: number; incomingVolumeBound?:number;incomingSpeedBound?:number }[] {
    if(this.firstImpactModel===KINETIC_EXACT_IMPACT_MODEL){
      if(![start,end].every(Number.isFinite)||end<start)throw Error('kinetic-source-cfl-interval');
      const bounds=new Map<number,{face:number;signalLength:number;incomingVolumeBound:number;incomingSpeedBound:number}>();
      for(const {model} of this.records)for(const segment of this.segments){const lo=Math.max(model.z0,segment.start[2]),hi=Math.min(model.z1,segment.end[2]);if(!(hi>lo)||model.firstArrival>=end||model.lastArrival<=start)continue;
        // Pointwise birth overlap never exceeds either interval's length.
        // Whole-span rectangular measure bounds every analytic partition;
        // the stated binary64 product allowance rounds this bound outward.
        const volume=model.beta*(hi-lo)*Math.min(end-start,model.birth1-model.birth0)*(1+16*Number.EPSILON);if(!(volume>0))throw Error('kinetic-source-cfl-volume-range');
        const speed=Math.hypot(model.speed,g*Math.max(model.ageAt(lo),model.ageAt(hi))),row=bounds.get(segment.face)??{face:segment.face,signalLength:0,incomingVolumeBound:0,incomingSpeedBound:0};
        row.incomingVolumeBound+=volume;row.incomingSpeedBound=Math.max(row.incomingSpeedBound,speed);bounds.set(segment.face,row);
      }
      if([...bounds.values()].some(row=>![row.incomingVolumeBound,row.incomingSpeedBound].every(v=>Number.isFinite(v)&&v>0)))throw Error('kinetic-source-cfl-range');return [...bounds.values()];
    }
    const bounds = new Map<number, number>();
    for (const { model } of this.records) {
      if (model.firstArrival >= end || model.lastArrival <= start) continue;
      for (const segment of this.segments) {
        const lo = Math.max(model.z0, segment.start[2]), hi = Math.min(model.z1, segment.end[2]); if (!(hi > lo)) continue;
        const amin = Math.min(model.ageAt(lo), model.ageAt(hi)), amax = Math.max(model.ageAt(lo), model.ageAt(hi));
        // Energy bounds all port speeds and gravity waves before dt selection,
        // including material whose leading support enters later in this tick.
        const speed = Math.hypot(model.speed, g * amax), signal = speed + 2 * speed / Math.sqrt(2);
        const derivativeBound = Math.abs(model.crossSlope) / (model.forwardSlope * model.speed + g * amin);
        const jacobianBound = Math.hypot(model.speed * derivativeBound, g * amax * derivativeBound, 1);
        bounds.set(segment.face, Math.max(bounds.get(segment.face) ?? 0, signal * jacobianBound * (segment.end[2] - segment.start[2])));
      }
    }
    return [...bounds].map(([face, signalLength]) => {
      if (!(signalLength > 0) || !Number.isFinite(signalLength)) throw Error('source-support-invalid-cfl-bound');
      return { face, signalLength };
    });
  }
  private sample(id: number, model: WaterfallSourceSupport, segment: FilmJunctionSegment, point: SourceArrivalPoint): FiniteSourceSample {
    const n = model.surface.normal, e = point.strikeTangent;
    let t = cross3(e, n); t = scale3(t, 1 / Math.hypot(...t));
    if (dot3(t, segment.normal) < 0) t = scale3(t, -1);
    if(this.firstImpactModel===KINETIC_EXACT_IMPACT_MODEL){const solved=kineticImpingementStreams(point,n,e,t),sample:FiniteSourceSample={firstImpactModel:KINETIC_EXACT_IMPACT_MODEL,originalId:id,face:segment.face,position:point.position,arrivalTimeMean:point.arrivalTimeMean,incoming:solved.incoming,measureLengthTime:point.strikeJacobian*point.transverseWeight*(point.birthEnd-point.birthStart),strikeJacobian:point.strikeJacobian,minus:solved.minus,plus:solved.plus,reaction:solved.reaction};if(this.observeProvenance)sample.observationProvenance={release:model.release,originalVolume:model.originalVolume,point,solved,qualification:'shallow-free-impact-and-full-cell-wet-footprint-unqualified'};return sample;}
    const ve = dot3(point.velocity, e), vt = dot3(point.velocity, t), vn = dot3(point.velocity, n);
    const gn = g * n[1], H = .5 * dot3(point.velocity, point.velocity) - .5 * ve * ve;
    const measureLengthTime = point.strikeJacobian * point.transverseWeight * (point.birthEnd - point.birthStart);
    const solved = solveWaterfallImpactJunction({ q: model.beta / point.strikeJacobian, ve, vt, vn, gn, H, density: rho, span: 1, duration: measureLengthTime });
    if (!solved.ok) throw Error(`source-support-junction-${solved.reason}`);
    const port = (p: typeof solved.plus, sign: number): FiniteSourcePort => {
      const volume = p.q * measureLengthTime, normal = scale3(t, sign), velocity = add3(scale3(e, ve), scale3(t, sign * p.s));
      const pressureImpulse = scale3(normal, .5 * rho * gn * p.h * p.h * measureLengthTime), pressureWork = dot3(pressureImpulse, velocity);
      const profileKinetic = .5 * rho * volume * dot3(velocity, velocity), potential = rho * volume * (g * point.position[1] + .5 * gn * p.h);
      const advectiveEnergy = profileKinetic + potential;
      return { volume, normal, velocity, height: p.h, advectiveMomentum: scale3(velocity, rho * volume), pressureImpulse, pressureWork, profileKinetic, potential, advectiveEnergy, energy: advectiveEnergy + pressureWork };
    };
    const minus = port(solved.minus, -1), plus = port(solved.plus, 1), incoming = emptySourceSupportMoments();
    addPoint(incoming, point.volume, point.position, point.velocity, point.arrivalTimeMean);
    const reaction = add3(add3(add3(minus.advectiveMomentum, minus.pressureImpulse), add3(plus.advectiveMomentum, plus.pressureImpulse)), scale3(incoming.momentum, -1));
    if (Math.abs(minus.volume + plus.volume - incoming.volume) > 1e-10 * incoming.volume
      || Math.abs(minus.energy + plus.energy - incoming.kinetic - incoming.potential) > 1e-10 * Math.abs(incoming.kinetic + incoming.potential)
      || Math.hypot(...add3(reaction, scale3(n, -dot3(reaction, n)))) > 1e-10 * Math.max(Math.hypot(...reaction), Math.hypot(...incoming.momentum))) throw Error('source-support-junction-balance');
    const sample:FiniteSourceSample={ originalId: id, face: segment.face, position: point.position, arrivalTimeMean: point.arrivalTimeMean, incoming, measureLengthTime, strikeJacobian: point.strikeJacobian, minus, plus, reaction };
    if(this.observeProvenance)sample.observationProvenance={release:model.release,originalVolume:model.originalVolume,beta:model.beta,point,segment,junctionInput:{q:model.beta/point.strikeJacobian,ve,vt,vn,gn,H,rho},junctionSolution:solved};
    return sample;
  }
  interval(start: number, end: number): FiniteSourceInterval {
    const samples: FiniteSourceSample[] = [], reference: FiniteSourceSample[] = [];
    const activeChord = new Map<number, number>(), moments = emptySourceSupportMoments();
    for (const { id, model } of this.records) {
      if (model.firstArrival >= end || model.lastArrival <= start) continue;
      for (const segment of this.segments) {
        const arrived = model.arrivals(start, end, segment.start[2], segment.end[2],3,this.observeProvenance);
        addSourceSupportMoments(moments, arrived.moments);
        for (const point of arrived.points) {
          samples.push(this.sample(id, model, segment, point));
          const chordMeasure = point.transverseWeight * (point.birthEnd - point.birthStart) * segment.length / (segment.end[2] - segment.start[2]);
          activeChord.set(segment.face, (activeChord.get(segment.face) ?? 0) + chordMeasure);
        }
        for (const point of model.arrivals(start, end, segment.start[2], segment.end[2], 5).points) reference.push(this.sample(id, model, segment, point));
      }
    }
    // Compare each original support, receiving face and side before taking
    // absolute discrepancies. Opposing traction errors cannot cancel here.
    const vector = (rows: FiniteSourceSample[]) => {
      const groups = new Map<string, { identity: NonNullable<FiniteSourceClosure['worstGroup']>; signed: number[]; unsigned: number[] }>();
      for (const row of rows) for (const side of ['minus', 'plus'] as const) {
        const port = row[side], key = `${row.originalId}:${row.face}:${side}`;
        const group = groups.get(key) ?? { identity: { originalId: row.originalId, face: row.face, side }, signed: Array(12).fill(0), unsigned: Array(12).fill(0) };
        const values = [...port.advectiveMomentum, ...port.pressureImpulse, port.profileKinetic, port.potential, port.pressureWork, port.volume, port.height * row.measureLengthTime, port.energy];
        values.forEach((v, k) => { group.signed[k] += v; group.unsigned[k] += Math.abs(v); }); groups.set(key, group);
      }
      return groups;
    };
    const a = vector(samples), b = vector(reference);
    let differences = Array(12).fill(0) as number[], unsignedReference = Array(12).fill(0) as number[], relativeMaximum = 0, energyDifference = 0;
    let worstGroup: FiniteSourceClosure['worstGroup'] = null;
    for (const key of new Set([...a.keys(), ...b.keys()])) {
      const left = a.get(key), right = b.get(key), zeros = Array(12).fill(0) as number[];
      const delta = (left?.signed ?? zeros).map((v, k) => v - (right?.signed[k] ?? 0));
      const scale = (left?.unsigned ?? zeros).map((v, k) => Math.max(v, right?.unsigned[k] ?? 0));
      const finite = [...delta, ...scale].every(Number.isFinite);
      const relative = finite ? Math.max(0, ...delta.map((v, k) => scale[k] > 0 ? Math.abs(v) / scale[k] : v === 0 ? 0 : Infinity)) : Infinity;
      energyDifference += Math.abs(delta[6]) + Math.abs(delta[7]) + Math.abs(delta[8]);
      if (worstGroup === null || relative > relativeMaximum) { worstGroup = (left ?? right)!.identity; differences = delta; unsignedReference = scale; relativeMaximum = relative; }
    }
    const energyBudget = this.closureRelativeLimit * (this.closureIncomingKinetic + moments.kinetic);
    const closure = { worstGroup, differences, unsignedReference, relativeMaximum, energyDifference, cumulativeEnergyDifference: this.closureEnergyDifference + energyDifference, energyBudget };
    if (![relativeMaximum,energyDifference,energyBudget,closure.cumulativeEnergyDifference].every(Number.isFinite) || relativeMaximum > this.closureRelativeLimit || closure.cumulativeEnergyDifference > energyBudget) throw new FiniteSourceQuadratureFailure({ stage: 'source-support-quadrature', start, end, closure });
    const ordinaryChordMeasure = new Map<number, number>(); let chordMeasureRoundoff = 0;
    for (const segment of this.segments) {
      const total = segment.length * (end - start), remaining = total - (activeChord.get(segment.face) ?? 0);
      if (remaining < -1e-12 * total) throw Error('source-support-overlapping-active-boundary');
      // Adjacent binary64 birth intervals may overlap by arithmetic roundoff.
      // This bound applies only to geometric uncovered boundary measure; no
      // incoming water, pressure or energy is removed or fitted to a residual.
      if (remaining < 0) chordMeasureRoundoff += -remaining;
      ordinaryChordMeasure.set(segment.face,this.firstImpactModel===KINETIC_EXACT_IMPACT_MODEL?total:Math.max(0, remaining));
    }
    return { start, end, samples, ordinaryChordMeasure, moments, closure, chordMeasureRoundoff };
  }
  accept(interval: FiniteSourceInterval): void {
    if (this.steps.length >= 64) throw Error('source-support-substep-capacity');
    addSourceSupportMoments(this.delivered, interval.moments);
    const pressureImpulse: ContactVec3 = [0,0,0]; let pressureWork = 0;
    for (const sample of interval.samples) {
      const original = this.byOriginal.get(sample.originalId) ?? emptySourceSupportMoments();
      addSourceSupportMoments(original, sample.incoming); this.byOriginal.set(sample.originalId, original);
      const segment = this.segments.find(s => s.face === sample.face)!;
      const fraction = (sample.position[2] - segment.start[2]) / (segment.end[2] - segment.start[2]);
      const chord = add3(segment.start,scale3(add3(segment.end,scale3(segment.start,-1)),fraction));
      for (let k=0;k<3;k++) {
        this.reaction[k] += sample.reaction[k]; this.mappedChordPositionMoment[k] += chord[k] * sample.incoming.volume;
        this.curveToChordPositionMoment[k] += (chord[k]-sample.position[k]) * sample.incoming.volume;
      }
      this.curveToChordBedPotentialChange += rho*g*sample.incoming.volume*(chord[1]-sample.position[1]);
      for (const port of [sample.minus, sample.plus]) { for (let k=0;k<3;k++) pressureImpulse[k] += port.pressureImpulse[k]; pressureWork += port.pressureWork; }
    }
    this.closureEnergyDifference += interval.closure.energyDifference; this.closureIncomingKinetic += interval.moments.kinetic;
    const deliveredByOriginal = new Map<number,SourceSupportMoments>();
    for (const sample of interval.samples) { const value = deliveredByOriginal.get(sample.originalId) ?? emptySourceSupportMoments(); addSourceSupportMoments(value,sample.incoming); deliveredByOriginal.set(sample.originalId,value); }
    this.steps.push({ start: interval.start, end: interval.end, moments: structuredClone(interval.moments), samples: interval.samples.length, pressureImpulse, pressureWork, closureRelativeMaximum: interval.closure.relativeMaximum, closureEnergyDifference: interval.closure.energyDifference, chordMeasureRoundoff: interval.chordMeasureRoundoff, closure: structuredClone(interval.closure), deliveredByOriginal: [...deliveredByOriginal].map(([originalId,moments])=>({originalId,moments})) });
  }
}
