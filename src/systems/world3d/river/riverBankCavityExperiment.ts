/**
 * Prepares and advances one isolated water test on frozen drawn bank triangles.
 * Water below and above a rock owns separate inventory; no top envelope fills
 * the native undercuts. This CPU experiment is not connected to live water.
 * Its single invocation includes geometry setup, transport, audits and surfaces.
 * Unknown geometry or energy cannot become physical acceptance.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 10/10/2026, 13:35:46
 * Dependents: None (Orphan)
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { bankHll } from './riverSubcellBankExperiment';
import type { FrozenBankTerrain } from './riverBankCommonGeometry';

export const BANK_CAVITY_LIMITS = Object.freeze({ bins: 128, candidates: 24,
  lines: 96, vertices: 4096, piecesPerBin: 256, pieces: 1048576,
  statesPerBin: 8, states: 131072, apertures: 264192, faceNodes: 32,
  operations: 4194304, inversions: 64, steps: 100000, snapshots: 23, outputBytes: 64 * 1024 * 1024,
  physicalS: 10, wallMs: 180000 });
const G = 9.81, RHO = 1000, DX = 1 / 64, N = 128;
const ROUND = 128 * Number.EPSILON;
type P = readonly [number, number]; // x, z
type Plane = readonly [number, number, number];
type Interval = readonly [number, number];
type PlaneBounds = readonly [Interval, Interval, Interval];
interface LineOwner { bounds: PlaneBounds; identity: string; points: readonly P[]; axis: 0 | 1 | null; coordinate: number | null }
interface Tri { id: number; source: string; ground: boolean; p: readonly P[];
  y: readonly number[]; plane: Plane; orientation: number; slopeBounds?: readonly [Interval, Interval] }
interface Piece { id: number; bin: number; p: readonly P[]; area: number;
  floor: Tri; roof: Tri | null; state: number }
interface Boundary { id: number; left: number; right: number | null;
  a: P; b: P; nx: number; nz: number; leftPiece: number; rightPiece: number | null;
  floor: Tri; roof: Tri | null;
  kind: 'interior' | 'wall' | 'west' | 'south' | 'east' | 'north' }
interface Geometry { pieces: Piece[]; states: readonly number[][]; boundaries: Boundary[];
  triangles: Tri[]; budget: Budget; identity: string; sourceHash: string }
export interface CavityState {
  readonly stateId: string; readonly geometryId: string; readonly revision: number;
  readonly timeS: number; readonly volumeM3: readonly number[];
  readonly pxKgMS: readonly number[]; readonly pzKgMS: readonly number[];
}
export interface CavitySurface {
  readonly stateId: string; readonly timeS: number;
  readonly nativeGeometryIdentity: string;
  /** Plain x,y,z triples; every triangle is from this committed observation. */
  readonly verticesXYZ: readonly number[]; readonly stateOwners: readonly number[];
}
export interface CavityLedger {
  readonly stateId: string; readonly dtS: number;
  readonly boundaryVolumeM3: number; readonly boundaryEnergyJ: number;
  readonly hllMomentumKgMS: readonly [number, number];
  readonly correctionKgMS: readonly [number, number];
  readonly floorReactionKgMS: readonly [number, number];
  readonly wallMomentumKgMS: readonly [number, number];
  readonly independentVolumeStatus: 'QUALIFIED_1_PERCENT' | 'UNQUALIFIED_RANGE';
  readonly independentPotentialStatus: 'UNQUALIFIED_RANGE';
  readonly volumeResidualM3: number; readonly energyResidualJ: number;
  readonly energyStatus: 'ENERGY_UNKNOWN';
}
export interface CavityRunOptions {
  readonly runId: string;
  /** Shorter time is for disposable operator checks; the native packet uses 10. */
  readonly physicalSeconds?: number;
  readonly requestedStepS?: number;
  readonly now?: () => number;
  /** The supervising single invocation persists each accepted observation. */
  readonly onAccepted?: (s: CavityState, surface: CavitySurface) => void;
  readonly inclusiveStartMs?: number;
  readonly onProgress?: (p:Readonly<{stage:string;pieces:number;states:number;boundaries:number;operations:number}>) => void;
}
export interface CavityRunResult {
  readonly status: 'STOPPED' | 'COMPLETED_UNQUALIFIED'; readonly reason: string;
  readonly state: CavityState | null; readonly snapshots: readonly CavitySurface[];
  readonly ledger: readonly CavityLedger[]; readonly elapsedMs: number;
  readonly firstFailure: CavitySurface | null;
  readonly lastAccepted: CavitySurface | null;
  readonly failureContext: Readonly<{stage:string; stateId:string|null; revision:number|null; timeS:number|null; detail:string; lineDiagnostics:CavityLineDiagnostics|null}> | null;
  readonly geometryCounts: Readonly<{ pieces: number; states: number; boundaries: number; operations: number }>;
  readonly sourceHash: string; readonly energyStatus: 'ENERGY_UNKNOWN';
}
function need(ok: boolean, why: string): asserts ok { if (!ok) throw new Error(why); }
const height = (t: Tri, p: P) => t.y[0] + t.plane[0] * (p[0]-t.p[0][0]) + t.plane[1] * (p[1]-t.p[0][1]);
const cross = (a: P, b: P, c: P) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
// Local differences avoid inventing tiny faces through large-coordinate cancellation.
const signedArea = (p: readonly P[]) => p.slice(1,-1).reduce((sum,a,i)=>sum+cross(p[0],a,p[i+2]),0)/2;
function clip(p: readonly P[], f: (p: P) => number): P[] {
  const out: P[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const q = fa / (fa - fb); out.push([a[0] + q * (b[0] - a[0]), a[1] + q * (b[1] - a[1])]); }
  }
  need(out.length <= BANK_CAVITY_LIMITS.vertices, 'Local polygon vertex cap'); return out;
}
function inside(t: Tri, p: P) { return t.p.every((a, i) => Math.sign(t.orientation) * cross(a, t.p[(i + 1) % 3], p) >= -ROUND); }
function centroid(p: readonly P[]): P { return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]; }
// Coordinate keys reconcile only floating-point line intersections. This is a
// dimensioned topology roundoff policy, not a physical volume allowance.
const key = (p: P) => `${p[0].toPrecision(15)},${p[1].toPrecision(15)}`;
const edgeKey = (a: P, b: P) => [key(a), key(b)].sort().join('|');

interface CavityLineDiagnostics {
  readonly bin: number; readonly x: number; readonly z: number;
  readonly candidateIds: readonly number[]; readonly proposed: Readonly<{ boundary:number; edge:number; pair:number }>;
  readonly sharedPairsSkipped:number; readonly unique:number; readonly rejected:number; readonly retained:number;
  readonly lines: readonly Readonly<{ coefficients:Plane; pairIds:readonly string[]; outside:boolean }>[];
}

// Each endpoint is moved to the next representable number after arithmetic.
// These ranges bound the original captured binary coordinates, including plane
// construction. A zero determinant or nonfinite range keeps the line uncertain.
// This is an exclusion certificate, not a new geometry solver or tolerance.
const rangeBits = new DataView(new ArrayBuffer(8));
function outward(value:number, direction:-1|1):number {
  if(Number.isNaN(value) || value===direction*Infinity) return value;
  if(value===0) return direction*Number.MIN_VALUE;
  rangeBits.setFloat64(0,value);
  let high=rangeBits.getUint32(0),low=rangeBits.getUint32(4);
  if((value>0)===(direction>0)) { low=(low+1)>>>0; if(low===0) high=(high+1)>>>0; }
  else { if(low===0) high=(high-1)>>>0; low=(low-1)>>>0; }
  rangeBits.setUint32(0,high);rangeBits.setUint32(4,low);return rangeBits.getFloat64(0);
}
const exactRange=(value:number):Interval=>[value,value];
const unknownRange=():Interval=>[-Infinity,Infinity];
function enclose(low:number,high:number):Interval {
  return Number.isNaN(low)||Number.isNaN(high)?unknownRange():[outward(low,-1),outward(high,1)];
}
const rangeAdd=(a:Interval,b:Interval):Interval=>enclose(a[0]+b[0],a[1]+b[1]);
const rangeSub=(a:Interval,b:Interval):Interval=>enclose(a[0]-b[1],a[1]-b[0]);
function rangeMul(a:Interval,b:Interval):Interval {
  const values=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];
  return values.some(Number.isNaN)?unknownRange():enclose(Math.min(...values),Math.max(...values));
}
function rangeDiv(a:Interval,b:Interval):Interval {
  if(b[0]<=0&&b[1]>=0) return unknownRange();
  const values=[a[0]/b[0],a[0]/b[1],a[1]/b[0],a[1]/b[1]];
  return values.some(Number.isNaN)?unknownRange():enclose(Math.min(...values),Math.max(...values));
}
const rangeDifference=(a:number,b:number)=>rangeSub(exactRange(a),exactRange(b));
const rangeCross=(a:Interval,b:Interval,c:Interval,d:Interval)=>rangeSub(rangeMul(a,b),rangeMul(c,d));
function originalSlopeBounds(p:readonly P[],y:readonly number[]):readonly [Interval,Interval] {
  const x1=rangeDifference(p[1][0],p[0][0]),x2=rangeDifference(p[2][0],p[0][0]);
  const z1=rangeDifference(p[1][1],p[0][1]),z2=rangeDifference(p[2][1],p[0][1]);
  const y1=rangeDifference(y[1],y[0]),y2=rangeDifference(y[2],y[0]);
  const determinant=rangeCross(x1,z2,z1,x2);
  const slope: [Interval,Interval] = [rangeDiv(rangeCross(y1,z2,y2,z1),determinant),rangeDiv(rangeCross(x1,y2,x2,y1),determinant)];
  // Equal source heights on an axis-aligned original edge establish a zero
  // slope exactly. Keep that incidence instead of widening an exact identity.
  for(let k=0;k<2;k++) if(p.some((a,i)=>{const b=p[(i+1)%3];return a[1-k]===b[1-k]&&a[k]!==b[k]&&y[i]===y[(i+1)%3];})) slope[k]=[0,0];
  if(y.every(v=>v===y[0])) return [[0,0],[0,0]];
  return slope;
}
function heightBounds(t:Tri,x:number,z:number):Interval {
  const slope=t.slopeBounds??originalSlopeBounds(t.p,t.y);
  return rangeAdd(rangeAdd(exactRange(t.y[0]),rangeMul(slope[0],rangeDifference(x,t.p[0][0]))),rangeMul(slope[1],rangeDifference(z,t.p[0][1])));
}
function lineProvablyOutside(bounds:PlaneBounds,x:number,z:number):boolean {
  // Include the graph's expanded global acceptance box and its final global-add
  // rounding. Touching ranges remain. Uncertain arithmetic never deletes a line.
  const localX=rangeSub([outward(x-ROUND,-1),outward(x+DX+ROUND,1)],exactRange(x));
  const localZ=rangeSub([outward(z-ROUND,-1),outward(z+DX+ROUND,1)],exactRange(z));
  const value=rangeAdd(rangeAdd(rangeMul(bounds[0],localX),rangeMul(bounds[1],localZ)),bounds[2]);
  return value.every(Number.isFinite)&&(value[0]>0||value[1]<0);
}

class Budget {
  crossings = new Map<string,Set<string>>();
  operations = 0; stage = 'geometry'; pieces = 0; states = 0; boundaries = 0;
  lineDiagnostics:CavityLineDiagnostics|null=null;
  constructor(readonly start: number, readonly now: () => number, readonly progress?:CavityRunOptions['onProgress']) {}
  tick(n = 1) { this.operations += n; need(this.operations <= BANK_CAVITY_LIMITS.operations, 'Geometry operation cap'); this.check(); }
  check() { need(this.now() - this.start < BANK_CAVITY_LIMITS.wallMs, 'Inclusive wall-time cap'); this.progress?.({stage:this.stage,pieces:this.pieces,states:this.states,boundaries:this.boundaries,operations:this.operations}); }
}

// ============================================================================
// Source geometry: local line graphs, signed solid union and distinct cavities.
// Tile names are provenance only. They are not physical closed rock shells.
// ============================================================================
function sourceTriangles(input: FrozenBankTerrain, budget:Budget): Tri[] {
  need(input.identity.length > 0 && /^[a-f0-9]{64}$/i.test(input.sourceSha256), 'Missing frozen source identity');
  need(input.triangles.length > 0 && input.triangles.length <= 512 && input.vertices.length === input.triangles.length * 9, 'Source triangle cap/shape');
  return input.triangles.map((owner, id) => {
    budget.tick(); // Charge each new original-coefficient enclosure to the fixed budget.
    const source = input.objects[owner.objectIndex]?.sourceName;
    need(typeof source === 'string' && /^(ground-|rock-|small-stones)/.test(source), `Unsupported drawn solid ${id}`);
    const raw = Array.from(input.vertices.slice(id * 9, id * 9 + 9));
    need(raw.every(Number.isFinite), `Nonfinite triangle ${id}`);
    const p: P[] = [[raw[0], raw[2]], [raw[3], raw[5]], [raw[6], raw[8]]], y = [raw[1], raw[4], raw[7]];
    const orientation = cross(p[0], p[1], p[2]);
    need(orientation !== 0, `Vertical triangle requires unsupported wall projection: ${id}`);
    const ax = ((y[1] - y[0]) * (p[2][1] - p[0][1]) - (y[2] - y[0]) * (p[1][1] - p[0][1])) / orientation;
    const az = ((p[1][0] - p[0][0]) * (y[2] - y[0]) - (p[2][0] - p[0][0]) * (y[1] - y[0])) / orientation;
    const plane: Plane = [ax, az, y[0] - ax * p[0][0] - az * p[0][1]];
    need(plane.every(Number.isFinite), `Invalid affine triangle ${id}`);
    return { id, source, ground: source.startsWith('ground-'), p, y, plane, orientation, slopeBounds:originalSlopeBounds(p,y) };
  });
}
function collectLocalLines(candidates: readonly Tri[], x: number, z: number, budget: Budget) {
  // A stop during collection has no completed current-bin record; do not attach
  // a previous bin's evidence to a new failure. The final line-cap record is exact.
  budget.lineDiagnostics=null;
  need(candidates.length<=BANK_CAVITY_LIMITS.candidates,'Bin candidate cap');
  const lines: Plane[] = [], seen = new Map<string,number>(), linePairs:Set<string>[]=[], owners:LineOwner[][]=[];
  const originalBounds:PlaneBounds[]=[],proposed={boundary:0,edge:0,pair:0};let sharedPairsSkipped=0;
  function line(a:number,b:number,c:number,kind:keyof typeof proposed,bounds:PlaneBounds,pair?:string,owner?:LineOwner,zeroCertified=false) {
    budget.tick();proposed[kind]++;
    const length = Math.hypot(a, b);
    // A rounded zero normal does not prove that the original surfaces have no
    // separator. Only an explicit original constant-height identity permits it.
    if(length===0) { need(zeroCertified,'Unresolved zero-length original separator');return; }
    need(Number.isFinite(length),'Nonfinite retained separator');
    const provenance=owner??{bounds,identity:`${kind}:${a}:${b}:${c}`,points:[],axis:null,coordinate:null};
    const sign = a < 0 || (a === 0 && b < 0) ? -1 : 1;
    const q: Plane = [sign * a / length, sign * b / length, sign * c / length];
    // ORIENTED BOUNDS (2026-11-02, agora-257c; CI run 41363850920). The stored
    // line takes `sign`, so its original bounds take it too. Without it, one
    // edge that two triangles give in opposite winding (B->C and C->B) merged
    // [+0.5,+0.5] with [-0.5,-0.5] into [-0.5,+0.5], and a line 0.12 m from the
    // bin could never be proved outside. Negation is exact, so the enclosure
    // stays certified.
    const orient=(r:Interval):Interval=>sign<0?[-r[1],-r[0]]:r;
    const oriented:PlaneBounds=[orient(bounds[0]),orient(bounds[1]),orient(bounds[2])];
    const id = q.map(v => v.toPrecision(15)).join(',');
    let ix=seen.get(id);
    if(ix===undefined) { ix=lines.length;seen.set(id,ix);lines.push(q);linePairs.push(new Set());originalBounds.push(oriented);owners.push([]); }
    else {
      // Preserve the first representative and every original plane-pair owner.
      // Union before exclusion also keeps a later uncertain key collision alive.
      const merge=(r:Interval,b:Interval):Interval=>[Math.min(r[0],b[0]),Math.max(r[1],b[1])];
      originalBounds[ix]=[merge(originalBounds[ix][0],oriented[0]),merge(originalBounds[ix][1],oriented[1]),merge(originalBounds[ix][2],oriented[2])];
    }
    if(pair) linePairs[ix].add(pair);
    owners[ix].push(provenance);
  }
  const corners:P[]=[[x,z],[x+DX,z],[x+DX,z+DX],[x,z+DX]];
  const boundary=(a:number,b:number,c:number)=>{const axis=a===0?1:0,coordinate=(axis===0?x:z)-c;
    const bounds:PlaneBounds=[exactRange(a),exactRange(b),exactRange(c)];
    line(a,b,c,'boundary',bounds,undefined,{bounds,identity:`grid:${axis}:${coordinate}`,points:corners.filter(p=>p[axis]===coordinate),axis,coordinate});};
  boundary(1,0,0);boundary(1,0,-DX);boundary(0,1,0);boundary(0,1,-DX);
  for (const t of candidates) for (let i = 0; i < 3; i++) {
    const a=t.p[i],b=t.p[(i+1)%3];
    const bounds:PlaneBounds=[rangeDifference(b[1],a[1]),rangeDifference(a[0],b[0]),rangeCross(rangeDifference(b[0],x),rangeDifference(a[1],z),rangeDifference(a[0],x),rangeDifference(b[1],z))];
    const axis=a[0]===b[0]?0:a[1]===b[1]?1:null;
    line(b[1]-a[1],a[0]-b[0],(b[0]-x)*(a[1]-z)-(a[0]-x)*(b[1]-z),'edge',bounds,undefined,
      {bounds,identity:`edge:${[JSON.stringify(a),JSON.stringify(b)].sort().join('|')}`,points:[a,b],axis,coordinate:axis===null?null:a[axis]});
  }
  for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) {
    budget.tick();
    const first=candidates[i],second=candidates[j];
    const shared=first.p.filter((p,k)=>second.p.some((q,l)=>key(p)===key(q)&&first.y[k]===second.y[l]));
    if(shared.length>=2) {sharedPairsSkipped++;continue;}
    const a=first.plane,b=second.plane;
    const ar=first.slopeBounds??originalSlopeBounds(first.p,first.y),br=second.slopeBounds??originalSlopeBounds(second.p,second.y);
    const bounds:PlaneBounds=[rangeSub(ar[0],br[0]),rangeSub(ar[1],br[1]),rangeSub(heightBounds(first,x,z),heightBounds(second,x,z))];
    const axis=ar[1][0]===0&&ar[1][1]===0&&br[1][0]===0&&br[1][1]===0?0:ar[0][0]===0&&ar[0][1]===0&&br[0][0]===0&&br[0][1]===0?1:null;
    const pair=[first.id,second.id].sort((a,b)=>a-b).join(':');
    line(a[0]-b[0],a[1]-b[1],height(first,[x,z])-height(second,[x,z]),'pair',
      bounds,pair,{bounds,identity:`pair:${pair}`,points:shared,axis,coordinate:null},
      first.y.every(y=>y===first.y[0])&&second.y.every(y=>y===second.y[0]));
  }
  // At most four boundaries +72 edges +276 pairs under the unchanged candidate
  // cap. Classify after dedup so rejected-first keys cannot lose later provenance.
  // Require BOTH the original construction and represented line to miss the box.
  // This can remove false rounded Cramer intersections; graph topology and exact
  // physical geometry remain unqualified by this exclusion certificate alone.
  const outside=lines.map((q,i)=>{budget.tick();return lineProvablyOutside(originalBounds[i],x,z)&&lineProvablyOutside([exactRange(q[0]),exactRange(q[1]),exactRange(q[2])],x,z);});
  const retained=outside.filter(v=>!v).length;
  budget.lineDiagnostics={bin:Math.round((z-22)/DX)*N+Math.round((x-36)/DX),x,z,candidateIds:candidates.map(t=>t.id),
    proposed,sharedPairsSkipped,unique:lines.length,rejected:lines.length-retained,retained,
    lines:lines.map((coefficients,i)=>({coefficients,pairIds:[...linePairs[i]],outside:outside[i]}))};
  need(retained<=BANK_CAVITY_LIMITS.lines,'Local line cap');
  return {lines:lines.filter((_,i)=>!outside[i]),linePairs:linePairs.filter((_,i)=>!outside[i]),owners:owners.filter((_,i)=>!outside[i])};
}
function retainedIntersection(a:Plane,b:Plane,first:LineOwner,second:LineOwner,x:number,z:number):{point:P|null; exact:boolean} {
  const d=a[0]*b[1]-b[0]*a[1];
  if(first.axis!==null&&first.axis===second.axis) {
    need(d===0,'Represented parallel source directions disagree');return {point:null,exact:true};
  }
  const solve=(r:PlaneBounds,s:PlaneBounds):readonly [Interval,Interval]=>{
    const determinant=rangeCross(r[0],s[1],s[0],r[1]);
    need(determinant.every(Number.isFinite)&&(determinant[0]>0||determinant[1]<0),'Unresolved retained determinant');
    return [rangeAdd(exactRange(x),rangeDiv(rangeCross(r[1],s[2],s[1],r[2]),determinant)),
      rangeAdd(exactRange(z),rangeDiv(rangeCross(s[0],r[2],r[0],s[2]),determinant))];
  };
  const represented=solve(a.map(exactRange) as unknown as PlaneBounds,b.map(exactRange) as unknown as PlaneBounds);
  const p:P=[x+(a[1]*b[2]-b[1]*a[2])/d,z+(b[0]*a[2]-a[0]*b[2])/d];
  const common=first.points.find(p=>second.points.some(q=>p[0]===q[0]&&p[1]===q[1]));
  const structural=first.axis!==null&&second.axis!==null&&first.axis!==second.axis&&first.coordinate!==null&&second.coordinate!==null
    ? (first.axis===0?[first.coordinate,second.coordinate]:[second.coordinate,first.coordinate]) as P:common;
  if(structural) {
    need(key(structural)===key(p),'Represented original incidence disagrees');
    if(structural[0]<x-ROUND||structural[0]>x+DX+ROUND||structural[1]<z-ROUND||structural[1]>z+DX+ROUND) return {point:null,exact:true};
    return {point:structural,exact:true};
  }
  const bounds=(owner:LineOwner):PlaneBounds=>owner.axis===0?[owner.bounds[0],exactRange(0),owner.bounds[2]]:
    owner.axis===1?[exactRange(0),owner.bounds[1],owner.bounds[2]]:owner.bounds;
  const original=solve(bounds(first),bounds(second));
  const classify=(box:readonly [Interval,Interval])=>{
    need(box.flat().every(Number.isFinite),'Nonfinite retained intersection enclosure');
    const origins=[x,z];
    if(box.some((r,k)=>r[1]<origins[k]-ROUND||r[0]>origins[k]+DX+ROUND)) return 'outside';
    if(box.every((r,k)=>r[0]>=origins[k]-ROUND&&r[1]<=origins[k]+DX+ROUND)) return 'inside';
    return 'uncertain';
  };
  const sourceClass=classify(original),representedClass=classify(represented);
  if(sourceClass==='outside'&&representedClass==='outside') return {point:null,exact:false};
  need(sourceClass==='inside'&&representedClass==='inside','Unresolved retained rectangle classification');
  // An invertible enclosed solve proves an original intersection exists. Every
  // enclosure endpoint must give the same stored key; a zero residual alone
  // would not establish incidence or protect a narrow crossing from rounding.
  const k=key(p);
  for(const box of [original,represented]) for(const xx of box[0]) for(const zz of box[1]) need(key([xx,zz])===k,'Unresolved retained intersection key');
  return {point:p,exact:false};
}
function localPartition(candidates: readonly Tri[], x: number, z: number, budget: Budget): P[][] {
  const {lines,linePairs,owners}=collectLocalLines(candidates,x,z,budget);
  for(const group of owners) {budget.tick();const first=group[0];
    // Rounded duplicate keys are not a coincidence certificate. Source edge
    // identity and the same exact grid coordinate are the only shared identities
    // retained here; an unresolved merge stops this candidate before topology.
    need(group.every(o=>o.identity===first.identity||(o.axis!==null&&o.axis===first.axis&&o.coordinate!==null&&o.coordinate===first.coordinate)),
      'Unresolved retained separator key merge');
  }
  const vertices: P[] = [], ids = new Map<string, number>(), onLine = lines.map(() => new Set<number>());
  const exactVertices:boolean[]=[];
  // VERTEX MERGE (2026-11-02, agora-257c; CI run 41363850920). Two line pairs
  // can meet at one point that one pair gives exactly (a grid coordinate or a
  // shared source point) and the other gives by a rounded solve a few ulps away
  // (22.296875 against 22.296875000000004; 22.3125 against 22.312499999999993:
  // a decimal source edge that meets a grid corner in real numbers). The old
  // rule merged only two equal exact points, so float noise stopped the whole
  // candidate. Now a point within VERTEX_MERGE of a stored vertex on each axis
  // IS that vertex, and an exact coordinate replaces a rounded one. Two exact
  // points that differ still stop the candidate. The search reads every stored
  // vertex, so a rounded key boundary between two noisy copies cannot split them.
  const VERTEX_MERGE=(q:number)=>ROUND*Math.max(1,Math.abs(q));
  const near=(a:P,b:P)=>Math.abs(a[0]-b[0])<=VERTEX_MERGE(b[0])&&Math.abs(a[1]-b[1])<=VERTEX_MERGE(b[1]);
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    budget.tick(); const result=retainedIntersection(lines[i],lines[j],owners[i][0],owners[j][0],x,z),p=result.point;
    if(!p) continue;
    const k = key(p); let id = ids.get(k);
    if (id === undefined) { const at=vertices.findIndex(v=>near(p,v)); if(at>=0) id=at; }
    if (id === undefined) { id = vertices.length; ids.set(k, id); vertices.push(p);exactVertices.push(result.exact); }
    else if (result.exact && !exactVertices[id] && near(p, vertices[id])) { vertices[id] = p; exactVertices[id] = true; ids.set(k, id); }
    else need(near(p,vertices[id])&&!(result.exact&&exactVertices[id]&&(vertices[id][0]!==p[0]||vertices[id][1]!==p[1])),
      `Unresolved retained vertex key merge: ${JSON.stringify({x,z,point:p,previous:vertices[id],exact:result.exact,previousExact:exactVertices[id],owners:[owners[i][0],owners[j][0]]})}`);
    onLine[i].add(id); onLine[j].add(id);
    need(vertices.length <= BANK_CAVITY_LIMITS.vertices, 'Local graph vertex cap');
  }
  const adjacent = vertices.map(() => new Set<number>());
  onLine.forEach((set, i) => {
    const l = lines[i], order = [...set].sort((a, b) => (vertices[a][0] * l[1] - vertices[a][1] * l[0]) - (vertices[b][0] * l[1] - vertices[b][1] * l[0]));
    for (let j = 1; j < order.length; j++) { adjacent[order[j - 1]].add(order[j]); adjacent[order[j]].add(order[j - 1]); }
  });
  const sorted = adjacent.map((set, i) => [...set].sort((a, b) => Math.atan2(vertices[a][1] - vertices[i][1], vertices[a][0] - vertices[i][0]) - Math.atan2(vertices[b][1] - vertices[i][1], vertices[b][0] - vertices[i][0])));
  const visited = new Set<string>(), polygons: P[][] = [];
  for (let a = 0; a < vertices.length; a++) for (const b of sorted[a]) {
    if (visited.has(`${a}:${b}`)) continue;
    let u = a, v = b; const polygon: P[] = [];
    for (let q = 0; q <= BANK_CAVITY_LIMITS.vertices; q++) {
      budget.tick(); const k = `${u}:${v}`; if (visited.has(k)) break;
      visited.add(k); polygon.push(vertices[u]);
      const order = sorted[v], ix = order.indexOf(u); need(ix >= 0 && order.length > 0, 'Broken local half-edge');
      const w = order[(ix + order.length - 1) % order.length]; u = v; v = w;
      if (u === a && v === b) break;
      need(q < BANK_CAVITY_LIMITS.vertices, 'Unclosed local polygon');
    }
    if (polygon.length >= 3 && signedArea(polygon) > ROUND * DX * DX) polygons.push(polygon);
    need(polygons.length <= BANK_CAVITY_LIMITS.piecesPerBin, 'Local piece cap');
  }
  const sum = polygons.reduce((s, p) => s + signedArea(p), 0);
  need(Math.abs(sum - DX * DX) <= ROUND * 100, 'Local partition coverage/roundoff unavailable');
  for(const polygon of polygons) for(let k=0;k<polygon.length;k++) {
    const a=polygon[k],b=polygon[(k+1)%polygon.length],ia=ids.get(key(a))!,ib=ids.get(key(b))!;
    const pairs=new Set<string>();
    onLine.forEach((vertices,i)=>{if(vertices.has(ia)&&vertices.has(ib)) for(const pair of linePairs[i]) pairs.add(pair);});
    if(pairs.size) budget.crossings.set(edgeKey(a,b),pairs);
  }
  return polygons;
}
function freeIntervals(candidates: readonly Tri[], p: readonly P[]): readonly { floor: Tri; roof: Tri | null }[] {
  const mid = centroid(p), ground = candidates.filter(t => t.ground && inside(t, mid));
  need(ground.length === 1, 'Ground coverage or overlap unresolved');
  const floor = ground[0];
  const hits = candidates.filter(t => !t.ground && inside(t, mid)).sort((a, b) => height(a, mid) - height(b, mid));
  // All rock tile and stone hits contribute to one winding count. Positive
  // crossings enter solid while ascending; overlapping solids remain occupied.
  let winding = 0, lower: Tri | null = null; const solids: { bottom: Tri; top: Tri }[] = [];
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    if (i > 0) need(Math.abs(height(hit, mid) - height(hits[i - 1], mid)) > ROUND, 'Coincident solid crossings ambiguous');
    if (winding === 0) lower = hit;
    winding += Math.sign(hit.orientation);
    need(winding >= 0, `Unclosed ascending solid column at triangle ${hit.id}; point ${JSON.stringify(mid)}; hits ${JSON.stringify(hits.map(t=>[t.id,height(t,mid),t.orientation]))}; piece ${JSON.stringify(p)}`);
    if (winding === 0) { need(lower !== null, 'Missing solid entry'); solids.push({ bottom: lower, top: hit }); lower = null; }
  }
  need(winding === 0, 'Unclosed solid column inside patch');
  const intervals: { floor: Tri; roof: Tri | null }[] = []; let current = floor;
  for (const solid of solids) {
    if (height(solid.top, mid) <= height(current, mid)) continue;
    if (height(solid.bottom, mid) > height(current, mid)) intervals.push({ floor: current, roof: solid.bottom });
    current = solid.top;
  }
  intervals.push({ floor: current, roof: null });
  for (const interval of intervals) for (const q of p) {
    need(inside(interval.floor, q), `Floor provenance does not cover local piece at triangle ${interval.floor.id}, point ${JSON.stringify(q)}, piece ${JSON.stringify(p)}`);
    if (interval.roof) need(height(interval.roof, q) >= height(interval.floor, q) - ROUND, 'Interval ordering changes inside piece');
  }
  return intervals;
}

function buildGeometry(input: FrozenBankTerrain, budget: Budget): Geometry {
  const triangles = sourceTriangles(input,budget), bins: Tri[][] = Array.from({ length: N * N }, () => []);
  for (const t of triangles) {
    const x0 = Math.max(0, Math.floor((Math.min(...t.p.map(p => p[0])) - 36) / DX));
    const x1 = Math.min(N - 1, Math.floor((Math.max(...t.p.map(p => p[0])) - 36) / DX));
    const z0 = Math.max(0, Math.floor((Math.min(...t.p.map(p => p[1])) - 22) / DX));
    const z1 = Math.min(N - 1, Math.floor((Math.max(...t.p.map(p => p[1])) - 22) / DX));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      bins[z * N + x].push(t); need(bins[z * N + x].length <= BANK_CAVITY_LIMITS.candidates, 'Bin candidate cap');
    }
  }
  const pieces: Piece[] = [];
  for (let bin = 0; bin < bins.length; bin++) {
    budget.check(); const x = 36 + (bin % N) * DX, z = 22 + Math.floor(bin / N) * DX;
    for (const p of localPartition(bins[bin], x, z, budget)) for (const interval of freeIntervals(bins[bin], p)) {
      pieces.push({ id: pieces.length, bin, p, area: signedArea(p), ...interval, state: -1 });
      budget.pieces=pieces.length; need(pieces.length <= BANK_CAVITY_LIMITS.pieces, 'Total cavity piece cap');
    }
  }
  // The geometry owns every piece boundary. Equal-floor neighbouring pieces can
  // share a state; a discontinuous floor keeps separate state and aperture.
  const parent = pieces.map((_, i) => i);
  const root = (i: number): number => { while (parent[i] !== i) i = parent[i]; return i; };
  const edgeOwners = new Map<string, { piece: Piece; a: P; b: P }[]>();
  const rawEdges: { piece: Piece; a: P; b: P; grid: string | null; axis: number }[] = [];
  const gridPoints = new Map<string, number[]>();
  for (const p of pieces) for (let i = 0; i < p.p.length; i++) {
    const a = p.p[i], b = p.p[(i + 1) % p.p.length];
    let grid: string | null = null, axis = 0;
    for (let k = 0; k < 2; k++) {
      const origin = k === 0 ? 36 : 22, ix = Math.round((a[k] - origin) / DX);
      if (Math.abs(a[k] - b[k]) <= ROUND && Math.abs(a[k] - origin - ix * DX) <= ROUND) { grid = `${k}:${ix}`; axis = k; break; }
    }
    rawEdges.push({ piece: p, a, b, grid, axis });
    if (grid) { const points = gridPoints.get(grid) ?? []; points.push(a[1 - axis], b[1 - axis]); gridPoints.set(grid, points); }
  }
  // Both sides share one ordered horizontal face partition, even when their
  // local line graphs added different vertices. No unmatched edge becomes wall.
  const gridSorted = new Map<string, number[]>();
  for (const [id, p] of gridPoints) gridSorted.set(id, [...new Map(p.map(x => [x.toPrecision(15), x])).values()].sort((a, b) => a - b));
  for (const e of rawEdges) {
    const coordinate = 1 - e.axis;
    const mids = e.grid ? gridSorted.get(e.grid)!.filter(x => x > Math.min(e.a[coordinate], e.b[coordinate]) + ROUND && x < Math.max(e.a[coordinate], e.b[coordinate]) - ROUND) : [];
    const points: P[] = [e.a, ...mids.map(x => e.axis === 0 ? [e.a[0], x] as P : [x, e.a[1]] as P), e.b];
    points.sort((a, b) => (a[coordinate] - b[coordinate]) * Math.sign(e.b[coordinate] - e.a[coordinate]));
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], k = edgeKey(a, b);
      const provenance=budget.crossings.get(edgeKey(e.a,e.b)); if(provenance) budget.crossings.set(k,provenance);
      const owners = edgeOwners.get(k) ?? []; owners.push({ piece: e.piece, a, b }); edgeOwners.set(k, owners);
    }
  }
  for (const owners of edgeOwners.values()) for (let i = 0; i < owners.length; i++) for (let j = i + 1; j < owners.length; j++) {
    budget.tick(); const a = owners[i], b = owners[j]; if (a.piece.bin !== b.piece.bin) continue;
    if (a.piece === b.piece || key(a.a) !== key(b.b)) continue;
    const sameFloor = [a.a, a.b].every(q => Math.abs(height(a.piece.floor, q) - height(b.piece.floor, q)) <= ROUND * Math.max(1, Math.abs(height(a.piece.floor, q))));
    const open = [a.a, a.b].some(q => Math.min(a.piece.roof ? height(a.piece.roof, q) : Infinity, b.piece.roof ? height(b.piece.roof, q) : Infinity) > Math.max(height(a.piece.floor, q), height(b.piece.floor, q)));
    if (sameFloor && open) parent[root(b.piece.id)] = root(a.piece.id);
  }
  const states: number[][] = [], group = new Map<number, number>(), binCounts = new Map<number, number>();
  for (const piece of pieces) {
    const r = root(piece.id); let id = group.get(r);
    if (id === undefined) {
      id = states.length; group.set(r, id); states.push([]);
      const count = (binCounts.get(piece.bin) ?? 0) + 1; binCounts.set(piece.bin, count);
      need(count <= BANK_CAVITY_LIMITS.statesPerBin && states.length <= BANK_CAVITY_LIMITS.states, 'Independent cavity state cap');
    }
    piece.state = id; states[id].push(piece.id); budget.states=states.length;
  }
  const boundaries: Boundary[] = [];
  function add(left: Piece, right: Piece | null, a: P, b: P, kind: Boundary['kind'], floor: Tri, roof: Tri | null) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]); need(length > 0, 'Zero boundary length');
    boundaries.push({ id: boundaries.length, left: left.state, right: right?.state ?? null, a, b,
      nx: (b[1] - a[1]) / length, nz: -(b[0] - a[0]) / length,
      leftPiece: left.id, rightPiece: right?.id ?? null, kind, floor, roof });
    budget.boundaries=boundaries.length; need(boundaries.length <= BANK_CAVITY_LIMITS.apertures, 'Common aperture/boundary cap');
  }
  for (const owners of edgeOwners.values()) {
    budget.check();
    // Original affine crossings divide each real face before pairing vertical
    // openings. One outside column can meet both lower and upper cavities.
    const a = owners[0].a, b = owners[0].b, cuts = [0, 1];
    const planes = owners.flatMap(o => o.piece.roof ? [o.piece.floor, o.piece.roof] : [o.piece.floor]);
    for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) {
      budget.tick(); const da = height(planes[i],a)-height(planes[j],a), db=height(planes[i],b)-height(planes[j],b);
      if (da * db < 0) cuts.push(da/(da-db));
    }
    const ordered = [...new Set(cuts)].sort((x,y)=>x-y);
    const provenance=budget.crossings.get(edgeKey(a,b));
    for (let k=1;k<ordered.length;k++) {
      const point=(t:number):P=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])], mid=point((ordered[k-1]+ordered[k])/2);
      for (const owner of owners) {
        const reversed=key(owner.a)!==key(a), aa=point(ordered[k-1]), bb=point(ordered[k]), oa=reversed?bb:aa, ob=reversed?aa:bb;
        if(aa[0]===bb[0]&&aa[1]===bb[1]) continue;
        if(provenance) budget.crossings.set(edgeKey(aa,bb),provenance);
        const opposite=owners.filter(q=>q.piece!==owner.piece&&key(q.a)===key(owner.b));
        const lower=owner.piece.floor, upper=owner.piece.roof;
        const connected=opposite.map(q=>({other:q.piece,
          floor:height(lower,mid)>=height(q.piece.floor,mid)?lower:q.piece.floor,
          roof:!upper?q.piece.roof:!q.piece.roof?upper:height(upper,mid)<=height(q.piece.roof,mid)?upper:q.piece.roof,
        })).filter(q=>!q.roof||(!cavityOriginalEdgeContinuous(q.floor,q.roof,aa,bb,provenance)&&height(q.roof,mid)>height(q.floor,mid))).sort((x,y)=>height(x.floor,mid)-height(y.floor,mid));
        let cursor=lower;
        for(const opening of connected) {
          const continuous=cavityOriginalEdgeContinuous(opening.floor,cursor,oa,ob,provenance);
          need(continuous||height(opening.floor,mid)>=height(cursor,mid),`Overlapping shared aperture ownership at owner ${owner.piece.id}, other ${opening.other.id}, floor ${height(opening.floor,mid)}, cursor ${height(cursor,mid)}, point ${JSON.stringify(mid)}, intervals ${JSON.stringify(connected.map(q=>[q.other.id,q.floor.id,q.roof?.id,height(q.floor,mid),q.roof?height(q.roof,mid):null]))}`);
          if(!continuous&&height(opening.floor,mid)>height(cursor,mid)) add(owner.piece,null,oa,ob,'wall',cursor,opening.floor);
          if(opening.other.state!==owner.piece.state&&owner.piece.id<opening.other.id) add(owner.piece,opening.other,oa,ob,'interior',opening.floor,opening.roof);
          if(!opening.roof) break;
          cursor=opening.roof;
        }
        if(connected.some(q=>!q.roof)||(upper&&height(cursor,mid)>=height(upper,mid))) continue;
        const x=mid[0],z=mid[1];
        const kind:Boundary['kind']=Math.abs(x-36)<=ROUND?'west':Math.abs(x-38)<=ROUND?'east':Math.abs(z-22)<=ROUND?'south':Math.abs(z-24)<=ROUND?'north':'wall';
        const binX=36+(owner.piece.bin%N)*DX,binZ=22+Math.floor(owner.piece.bin/N)*DX;
        const onBin=Math.abs(x-binX)<=ROUND||Math.abs(x-binX-DX)<=ROUND||Math.abs(z-binZ)<=ROUND||Math.abs(z-binZ-DX)<=ROUND;
        need(kind!=='wall'||!onBin||opposite.length>0,'Common face endpoint partition mismatch');
        add(owner.piece,null,oa,ob,kind,cursor,upper);
      }
    }
  }
  return { pieces, states, boundaries, triangles, budget, identity: input.identity, sourceHash: input.sourceSha256 };
}

// ============================================================================
// Affine storage and independent original-coordinate range checks.
// ============================================================================
interface Measure { eta: number; v: number; area: number; potential: number;
  sourceX: number; sourceZ: number; wet: { piece: Piece; polygon: P[] }[] }
function atLevel(g: Geometry, state: number, eta: number, guards = true): Measure {
  let v = 0, area = 0, potential = 0, sourceX = 0, sourceZ = 0;
  const wet: Measure['wet'] = [];
  for (const id of g.states[state]) {
    g.budget.check();
    const piece = g.pieces[id], polygon = clip(piece.p, p => eta - height(piece.floor, p));
    if (!polygon.some(p => eta > height(piece.floor, p))) continue;
    if (guards && piece.roof) for (const p of polygon) need(eta < height(piece.roof, p), `Ceiling pressure required in state ${state}`);
    let pieceV = 0;
    for (let i = 1; i + 1 < polygon.length; i++) {
      const tri = [polygon[0], polygon[i], polygon[i + 1]], a = Math.abs(cross(tri[0], tri[1], tri[2])) / 2;
      const h = tri.map(p => eta - height(piece.floor, p));
      const depth = a * (h[0] + h[1] + h[2]) / 3;
      const h2 = a * (h[0] ** 2 + h[1] ** 2 + h[2] ** 2 + h[0] * h[1] + h[0] * h[2] + h[1] * h[2]) / 6;
      pieceV += depth; v += depth; area += a; potential += eta * depth - h2 / 2;
    }
    sourceX -= RHO * G * pieceV * piece.floor.plane[0]; sourceZ -= RHO * G * pieceV * piece.floor.plane[1];
    wet.push({ piece, polygon });
  }
  // A dry start does not authorize splitting later incoming volume among wet
  // islands. Require positive-depth shared boundaries for every wet component.
  if (guards && wet.length > 1) {
    const reached = new Set([0]); let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < wet.length; i++) if (reached.has(i)) for (let j = 0; j < wet.length; j++) if (!reached.has(j)) {
        const a = wet[i], b = wet[j];
        const connected = a.polygon.some((p, k) => b.polygon.some((q, l) => edgeKey(p, a.polygon[(k + 1) % a.polygon.length]) === edgeKey(q, b.polygon[(l + 1) % b.polygon.length]) && eta > height(a.piece.floor, centroid([p, a.polygon[(k + 1) % a.polygon.length]])) && eta > height(b.piece.floor, centroid([q, b.polygon[(l + 1) % b.polygon.length]]))));
        if (connected) { reached.add(j); changed = true; }
      }
    }
    need(reached.size === wet.length, `Disconnected wet basin in cavity ${state}`);
  }
  need([v, area, potential, sourceX, sourceZ].every(Number.isFinite), 'Nonfinite storage/source');
  return { eta, v, area, potential, sourceX, sourceZ, wet };
}
function invert(g: Geometry, id: number, volume: number, guards = true): Measure {
  need(Number.isFinite(volume) && volume >= 0, 'Negative/missing cavity inventory');
  const pieces = g.states[id].map(i => g.pieces[i]);
  let lo = Math.min(...pieces.flatMap(p => p.p.map(q => height(p.floor, q))));
  if (volume === 0) return { eta: lo, v: 0, area: 0, potential: 0, sourceX: 0, sourceZ: 0, wet: [] };
  let hi = Math.max(...pieces.flatMap(p => p.p.map(q => height(p.floor, q)))) + volume / pieces.reduce((s, p) => s + p.area, 0);
  const roof = Math.min(...pieces.flatMap(p => p.roof ? p.p.map(q => height(p.roof!, q)) : [Infinity]));
  if (guards && hi >= roof) { need(atLevel(g, id, roof, false).v > volume, `Volume inversion requires ceiling pressure in ${id}`); hi = roof; }
  for (let i = 0; i < BANK_CAVITY_LIMITS.inversions; i++) {
    g.budget.check(); const eta = (lo + hi) / 2, m = atLevel(g, id, eta, false);
    if (Math.abs(m.v - volume) <= volume * 1e-10) return atLevel(g, id, eta, guards);
    if (m.v < volume) lo = eta; else hi = eta;
  }
  throw new Error(`Volume inversion cap in ${id}`);
}
function originalHeight(t: Tri, q: P) {
  // Independent evaluation from original vertices, rather than cached planes or
  // capacity tables. It still shares the declared projected topology assumption.
  const a = cross(q, t.p[1], t.p[2]) / t.orientation;
  const b = cross(t.p[0], q, t.p[2]) / t.orientation;
  return a * t.y[0] + b * t.y[1] + (1 - a - b) * t.y[2];
}
function volumeAudit(g: Geometry, measures: readonly Measure[], inventory: readonly number[]) {
  const low = Array(16).fill(0) as number[], high = Array(16).fill(0) as number[], represented = Array(16).fill(0) as number[];
  measures.forEach(m => m.wet.forEach(({ piece, polygon }) => {
    const binX = 36 + (piece.bin % N) * DX, binZ = 22 + Math.floor(piece.bin / N) * DX;
    const parent = Math.floor((binZ - 22) / 0.5) * 4 + Math.floor((binX - 36) / 0.5);
    for (let iz = 0; iz < 4; iz++) for (let ix = 0; ix < 4; ix++) {
      const x = binX + ix * DX / 4, z = binZ + iz * DX / 4;
      const p = clip(clip(clip(clip(polygon, q => q[0] - x), q => x + DX / 4 - q[0]), q => q[1] - z), q => z + DX / 4 - q[1]);
      if (p.length < 3) continue;
      const a = Math.abs(signedArea(p)), depths = p.map(q => m.eta - originalHeight(piece.floor, q));
      need(depths.every(Number.isFinite) && Math.min(...depths) >= -ROUND, 'Original triangle water containment unavailable');
      g.budget.check();
      const interior = centroid(p);
      const originals = g.triangles.filter(t=>inside(t,interior));
      const ground = originals.filter(t=>t.ground);
      need(ground.length === 1,'Original-triangle ground coverage ambiguous');
      const rocks = originals.filter(t=>!t.ground).sort((a,b)=>originalHeight(a,interior)-originalHeight(b,interior));
      let winding=0, occupied=0;
      const liquidMiddle=(m.eta+originalHeight(piece.floor,interior))/2;
      for(const rock of rocks) {
        winding+=Math.sign(rock.orientation);
        if(originalHeight(rock,interior)<liquidMiddle) occupied=winding;
        need(winding>=0,'Original-triangle solid orientation unresolved');
        // The emitted liquid may not cross any original solid face. The local
        // affine partition ensures extrema occur at these clipped vertices.
        const heights=p.map(q=>originalHeight(rock,q));
        const bottom=p.map(q=>originalHeight(piece.floor,q));
        need(heights.every((h,i)=>h<=bottom[i]+ROUND)||heights.every(h=>h>=m.eta-ROUND),'Original-triangle liquid intersects solid');
      }
      need(winding===0 && occupied===0,'Original-triangle water inside solid or unclosed column');
      low[parent] += a * Math.max(0, Math.min(...depths)); high[parent] += a * Math.max(...depths);
    }
    // This exact comparison accumulator is deliberately distinct from the range
    // integration above; range bounds, not agreement, supply its error ceiling.
    for (let i = 1; i + 1 < polygon.length; i++) represented[parent] += Math.abs(cross(polygon[0], polygon[i], polygon[i + 1])) / 6 * [polygon[0], polygon[i], polygon[i + 1]].reduce((s, p) => s + m.eta - originalHeight(piece.floor, p), 0);
  }));
  const parentInventory=Array(16).fill(0) as number[];
  inventory.forEach((v,i)=>{
    const bin=g.pieces[g.states[i][0]].bin, parent=Math.floor(Math.floor(bin/N)/32)*4+Math.floor((bin%N)/32);
    parentInventory[parent]+=v;
  });
  for(let i=0;i<16;i++) need(parentInventory[i]===0?represented[i]===0:Math.abs(represented[i]-parentInventory[i])<=0.01*parentInventory[i],`Independent original-triangle parent inventory failure ${i}`);
  const qualified=represented.every((v,i)=>v===0?low[i]===0&&high[i]===0:low[i]>=0.99*parentInventory[i]&&high[i]<=1.01*parentInventory[i]);
  return { qualified, low: low.reduce((s, x) => s + x, 0), high: high.reduce((s, x) => s + x, 0), represented: represented.reduce((s, x) => s + x, 0) };
}

/** A downward wet transfer above a dry lower surface requires a vertical jet.
 * No depth floor, speed threshold or arbitrary vertical tolerance hides it. */
export function cavityStepJetUnsupported(upstreamFloor: number, downstreamFloor: number, downstreamEta: number, outwardVolumeRate: number) {
  return outwardVolumeRate > 0 && upstreamFloor > downstreamFloor && downstreamEta < upstreamFloor;
}
export function cavityReservoirHead(timeS: number) { return timeS <= 2 ? 3.25 + 0.125 * timeS : 3.5; }

function state(run: string, g: Geometry, revision: number, time: number, v: number[], px: number[], pz: number[]): CavityState {
  need(v.length === g.states.length && px.length === v.length && pz.length === v.length, 'State shape mismatch');
  for (let i = 0; i < v.length; i++) need(Number.isFinite(v[i]) && v[i] >= 0 && Number.isFinite(px[i]) && Number.isFinite(pz[i]) && (v[i] > 0 || (px[i] === 0 && pz[i] === 0)), 'Negative/missing inventory or unsupported dry momentum');
  return Object.freeze({ stateId: `${run}:${g.identity}:${revision}`, geometryId: g.identity, revision, timeS: time, volumeM3: Object.freeze(v), pxKgMS: Object.freeze(px), pzKgMS: Object.freeze(pz) });
}
function surface(s: CavityState, measures: readonly Measure[], budget: Budget): CavitySurface {
  const vertices: number[] = [], owners: number[] = [];
  measures.forEach((m, owner) => m.wet.forEach(({ polygon }) => {
    budget.check();
    for (let i = 1; i + 1 < polygon.length; i++) {
      for (const p of [polygon[0], polygon[i + 1], polygon[i]]) vertices.push(p[0], m.eta, p[1]);
      owners.push(owner); need(owners.length <= BANK_CAVITY_LIMITS.pieces * 2, 'Surface triangle cap');
    }
  }));
  return Object.freeze({ stateId: s.stateId, timeS: s.timeS, nativeGeometryIdentity: s.geometryId, verticesXYZ: Object.freeze(vertices), stateOwners: Object.freeze(owners) });
}

/** One inclusive CPU invocation. Parent review must precede the native call.
 * Geometry refusal is a stopped candidate, never a substitute terrain run. */
export function runBankCavityExperiment(input: FrozenBankTerrain, options: CavityRunOptions): CavityRunResult {
  const now = options.now ?? (() => performance.now()), start = options.inclusiveStartMs ?? now(), budget = new Budget(start, now, options.onProgress);
  let g: Geometry | null = null, committed: CavityState | null = null, lastSurface: CavitySurface | null = null;
  let firstFailure: CavitySurface | null = null;
  const snapshots: CavitySurface[] = [], ledger: CavityLedger[] = [];
  let status: CavityRunResult['status'] = 'STOPPED', reason = '';
  try {
    need(Number.isFinite(start)&&start<=now(),'Invalid inclusive invocation clock');
    need(options.runId.length > 0, 'Missing run identity');
    const end = options.physicalSeconds ?? 10, cap = options.requestedStepS ?? 1 / 60;
    need(Number.isFinite(end) && end > 0 && end <= 10 && Number.isFinite(cap) && cap > 0 && cap <= 1 / 60, 'Invalid frozen time contract');
    budget.stage='geometry'; g = buildGeometry(input, budget);
    committed = state(options.runId, g, 0, 0, g.states.map(() => 0), g.states.map(() => 0), g.states.map(() => 0));
    lastSurface = surface(committed, g.states.map((_, i) => invert(g!, i, 0)), budget);
    snapshots.push(lastSurface); options.onAccepted?.(committed,lastSurface);
    while (committed.timeS < end) {
      budget.check(); need(committed.revision < BANK_CAVITY_LIMITS.steps, 'Physical step cap');
      const nextSample = (Math.floor(committed.timeS / 0.5) + 1) * 0.5;
      const event = Math.min(...[2,4,end,nextSample].filter(t => t > committed!.timeS));
      budget.stage='advance'; const transaction = advance(g, committed, Math.min(cap, event - committed.timeS));
      budget.check();
      budget.stage='surface'; const candidateSurface = surface(transaction.state, transaction.measures, budget);
      budget.check(); committed = transaction.state; lastSurface=candidateSurface; ledger.push(transaction.ledger);
      budget.stage='persist'; options.onAccepted?.(committed,lastSurface); budget.check();
      if (committed.timeS === event && (event === nextSample || event === end)) snapshots.push(lastSurface);
      need(snapshots.length <= BANK_CAVITY_LIMITS.snapshots, 'Retained snapshot cap');
      need(JSON.stringify(snapshots).length * 2 + ledger.length * 1024 <= BANK_CAVITY_LIMITS.outputBytes, '64 MiB output cap');
    }
    budget.check();
    status = 'COMPLETED_UNQUALIFIED'; reason = 'Known-history transport completed; discrete energy attribution remains ENERGY_UNKNOWN';
  } catch (error) { reason = error instanceof Error ? error.message : String(error);
    if (error instanceof CavityTransactionStop) firstFailure = error.surface;
    if(lastSurface && snapshots.at(-1)?.stateId !== lastSurface.stateId) snapshots.push(lastSurface);
  }
  return Object.freeze({ status, reason, state: committed, snapshots: Object.freeze(snapshots), ledger: Object.freeze(ledger), elapsedMs: now() - start,
    firstFailure, lastAccepted: lastSurface, failureContext: status==='STOPPED' ? Object.freeze({stage:budget.stage,stateId:committed?.stateId??null,revision:committed?.revision??null,timeS:committed?.timeS??null,detail:reason,lineDiagnostics:budget.lineDiagnostics}) : null, geometryCounts: Object.freeze({ pieces: budget.pieces, states: budget.states, boundaries: budget.boundaries, operations: budget.operations }), sourceHash: input.sourceSha256, energyStatus: 'ENERGY_UNKNOWN' });
}

/** Complete external pressure resultant. In a same-state floor jump this is
 * B_smooth plus the vertical-step reaction J; internal unequal pressure terms
 * are not retained. Distinct states instead use their shared H/C transaction. */
export function cavityPressureResultant(traces: readonly { weightM: number; depthM: number; nx: number; nz: number }[]): readonly [number, number] {
  let x = 0, z = 0;
  for (const p of traces) {
    need([p.weightM, p.depthM, p.nx, p.nz].every(Number.isFinite) && p.weightM > 0 && p.depthM >= 0, 'Invalid complete pressure trace');
    const pressure = RHO * G * p.weightM * p.depthM ** 2 / 2;
    x += pressure * p.nx; z += pressure * p.nz;
  }
  return [x, z];
}
function atmospheric(g: Geometry, measures: readonly Measure[]) {
  const air = g.states.map((pieces, state) => pieces.some(i => g.pieces[i].roof === null ));
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of g.boundaries) {
      g.budget.check(); if (b.kind === "wall") continue;
      if (b.right === null) { if ((!b.roof || Math.min(height(b.roof,b.a),height(b.roof,b.b)) > measures[b.left].eta) && !air[b.left]) { air[b.left]=true;changed=true; } continue; }
      const ceiling = b.roof ? Math.min(height(b.roof,b.a),height(b.roof,b.b)) : Infinity;
      const water = Math.max(measures[b.left].eta, measures[b.right].eta);
      // A positive-height common air band across this WHOLE source partition
      // gives a conservative route. Endpoint/point vents alone do not qualify.
      if (!(ceiling > water)) continue;
      if (air[b.left] && !air[b.right]) { air[b.right] = true; changed = true; }
      if (air[b.right] && !air[b.left]) { air[b.left] = true; changed = true; }
    }
  }
  measures.forEach((m, i) => need(m.v === 0 || air[i], `Atmospheric air route lost/unknown for occupied cavity ${i}`));
}
function energyFlux(hL: number, uL: number, vL: number, hR: number, uR: number, vR: number, bed: number) {
  const cL = Math.sqrt(G * hL), cR = Math.sqrt(G * hR);
  const sL = hL === 0 ? uR - 2 * cR : hR === 0 ? uL - cL : Math.min(uL - cL, uR - cR);
  const sR = hL === 0 ? uR + cR : hR === 0 ? uL + 2 * cL : Math.max(uL + cL, uR + cR);
  const eL = RHO * (hL * (uL * uL + vL * vL) / 2 + G * hL * hL / 2 + G * bed * hL);
  const eR = RHO * (hR * (uR * uR + vR * vR) / 2 + G * hR * hR / 2 + G * bed * hR);
  const fL = uL * (eL + RHO * G * hL * hL / 2), fR = uR * (eR + RHO * G * hR * hR / 2);
  const q = sL >= 0 ? fL : sR <= 0 ? fR : (sR * fL - sL * fR + sL * sR * (eR - eL)) / (sR - sL);
  need(Number.isFinite(q), 'Nonfinite prescribed boundary energy flux'); return q;
}
function totalEnergy(s: CavityState, m: readonly Measure[]) {
  return m.reduce((sum, p, i) => sum + RHO * G * p.potential + (s.volumeM3[i] === 0 ? 0 : (s.pxKgMS[i] ** 2 + s.pzKgMS[i] ** 2) / (2 * RHO * s.volumeM3[i])), 0);
}
function advance(g: Geometry, s: CavityState, cap: number): { state: CavityState; ledger: CavityLedger; measures: Measure[] } {
  const measures = g.states.map((_, i) => invert(g, i, s.volumeM3[i])); atmospheric(g, measures);
  const vRate = g.states.map(() => 0), pxRate = [...vRate], pzRate = [...vRate];
  const out = [...vRate], wave = [...vRate], response = [...vRate];
  const H: [number, number] = [0, 0], C: [number, number] = [0, 0], B: [number, number] = [0, 0], W: [number, number] = [0, 0];
  let boundaryVolume = 0, boundaryEnergy = 0;
  for (const b of g.boundaries) {
    g.budget.check();
    const lp = g.pieces[b.leftPiece], rp = b.rightPiece === null ? null : g.pieces[b.rightPiece];
    const length = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]);
    const eL = measures[b.left].eta, eR = b.right === null ? eL : measures[b.right].eta;
    const ul = s.volumeM3[b.left] === 0 ? 0 : s.pxKgMS[b.left] / (RHO * s.volumeM3[b.left]);
    const vl = s.volumeM3[b.left] === 0 ? 0 : s.pzKgMS[b.left] / (RHO * s.volumeM3[b.left]);
    const ur = b.right === null || s.volumeM3[b.right] === 0 ? 0 : s.pxKgMS[b.right] / (RHO * s.volumeM3[b.right]);
    const vr = b.right === null || s.volumeM3[b.right] === 0 ? 0 : s.pzKgMS[b.right] / (RHO * s.volumeM3[b.right]);
    const exteriorHead = b.right === null && b.kind !== 'wall' && (b.kind === 'west'||b.kind === 'south') && s.timeS<4 ? cavityReservoirHead(s.timeS) : null;
    const cuts = [0, 1];
    if(exteriorHead!==null) {
      const a=exteriorHead-height(b.floor,b.a), c=exteriorHead-height(b.floor,b.b);
      if((a>0)!==(c>0)) cuts.push(a/(a-c));
    }
    if(b.kind==='wall'&&b.roof) {
      const normal=ul*b.nx+vl*b.nz;
      need(normal===0 || [b.a,b.b].every(p=>eL<=height(b.roof!,p)),'Unsupported submerged partial-wall dynamic reflection');
      const a=eL-height(b.roof,b.a),c=eL-height(b.roof,b.b);
      if((a>0)!==(c>0)) cuts.push(a/(a-c));
    }
    for(const eta of [eL,eR,...(exteriorHead===null?[]:[exteriorHead])]) {
      const a=eta-height(b.floor,b.a),c=eta-height(b.floor,b.b);
      if((a>0)!==(c>0)) cuts.push(a/(a-c));
      if(b.roof&&b.kind!=='wall') for(const p of [b.a,b.b]) need(eta<=height(b.floor,p)||eta<height(b.roof,p),`Common aperture ceiling pressure at boundary ${b.id}`);
    }
    for (const [piece, eta] of [[lp, eL], [rp, eR]] as const) if (piece) {
      const a = eta - height(piece.floor, b.a), c = eta - height(piece.floor, b.b);
      if ((a > 0) !== (c > 0)) cuts.push(a / (a - c));
    }
    cuts.sort((a, c) => a - c);
    need((cuts.length - 1) * 2 <= BANK_CAVITY_LIMITS.faceNodes, 'Face quadrature node cap');
    for (let segment = 1; segment < cuts.length; segment++) {
      const lo = cuts[segment - 1], hi = cuts[segment]; if (hi === lo) continue;
      for (const gauss of [-1 / Math.sqrt(3), 1 / Math.sqrt(3)]) {
        const t = (lo + hi) / 2 + gauss * (hi - lo) / 2, p: P = [b.a[0] + t * (b.b[0] - b.a[0]), b.a[1] + t * (b.b[1] - b.a[1])];
        const weight = length * (hi - lo) / 2, bedL = height(lp.floor, p), bedR = rp ? height(rp.floor, p) : bedL;
        
        const nL = ul * b.nx + vl * b.nz, tangentL = -ul * b.nz + vl * b.nx;
        let etaR = eR, nR = ur * b.nx + vr * b.nz, tangentR = -ur * b.nz + vr * b.nx;
        const wall = b.kind === 'wall';
        if (wall) { nR = -nL; tangentR = tangentL; etaR = eL; }
        else if (b.right === null) { etaR = (b.kind === 'west' || b.kind === 'south') && s.timeS < 4 ? cavityReservoirHead(s.timeS) : bedR; nR = 0; tangentR = 0; }
        const sharedBed = height(b.floor,p), hL = Math.max(eL - sharedBed, 0), hR = Math.max(etaR - sharedBed, 0);
        const ceiling = b.roof ? height(b.roof,p) : Infinity;
        need(wall || ((hL === 0 || eL < ceiling) && (hR === 0 || etaR < ceiling)), `Common aperture ceiling pressure at boundary ${b.id}`);
        const flux = { ...bankHll(hL,nL,tangentL,hR,nR,tangentR) };
        // Reflection uses the native HLL dynamic reaction. Replace only its full
        // column hydrostatic part by the actual wall-strip pressure.
        if(wall) {
          need(!(Number.isFinite(ceiling)&&eL>ceiling&&nL!==0),'Unsupported submerged partial-wall dynamic reflection');
          flux.normal += cavityStripPressure(eL,bedL,sharedBed,ceiling)/RHO - G*hL*hL/2;
        }
        const q = weight * flux.mass;
        need(!wall || q === 0, 'Reflecting wall transferred water');
        const outlet = b.right === null && !wall && !((b.kind === 'west' || b.kind === 'south') && s.timeS < 4);
        need(!outlet || q >= 0, 'Atmospheric outlet requested unprescribed incoming supply');
        const sameOriginalFloor = rp && cavityOriginalEdgeContinuous(lp.floor,rp.floor,b.a,b.b,g.budget.crossings.get(edgeKey(b.a,b.b)));
        need(!cavityStepJetUnsupported(bedL, sameOriginalFloor?bedL:bedR, etaR, q) && !cavityStepJetUnsupported(sameOriginalFloor?bedL:bedR, bedL, eL, -q), `Unsupported detached downward step jet at boundary ${b.id}`);
        const fx = RHO * weight * (flux.normal * b.nx - flux.tangent * b.nz), fz = RHO * weight * (flux.normal * b.nz + flux.tangent * b.nx);
        const rawPressureL = weight * cavityStripPressure(eL,bedL,sharedBed,ceiling), starL = RHO * G * weight * hL ** 2 / 2;
        const rawPressureR = weight * cavityStripPressure(eR,bedR,sharedBed,ceiling), starR = RHO * G * weight * hR ** 2 / 2;
        const correctionL = wall ? 0 : -(rawPressureL - starL), correctionR = rawPressureR - starR;
        // B uses complete EXTERNAL state boundary pressure. Internal same-state
        // edges were removed earlier; rock traction is not added a second time.
        vRate[b.left] -= q; pxRate[b.left] += -fx + (correctionL + rawPressureL) * b.nx; pzRate[b.left] += -fz + (correctionL + rawPressureL) * b.nz;
        H[0] -= fx; H[1] -= fz; C[0] += correctionL * b.nx; C[1] += correctionL * b.nz; B[0] += rawPressureL * b.nx; B[1] += rawPressureL * b.nz;
        if (wall) { W[0] -= fx; W[1] -= fz; }
        if (q > 0) out[b.left] += q;
        wave[b.left] += weight * flux.speed; response[b.left] += weight * Math.max(hL,hR) * flux.speed;
        if (b.right !== null) {
          vRate[b.right] += q; pxRate[b.right] += fx + (correctionR - rawPressureR) * b.nx; pzRate[b.right] += fz + (correctionR - rawPressureR) * b.nz;
          H[0] += fx; H[1] += fz; C[0] += correctionR * b.nx; C[1] += correctionR * b.nz; B[0] -= rawPressureR * b.nx; B[1] -= rawPressureR * b.nz;
          if (q < 0) out[b.right] -= q;
          wave[b.right] += weight * flux.speed; response[b.right] += weight * Math.max(hL,hR) * flux.speed;
        } else if (!wall) {
          boundaryVolume -= q;
          boundaryEnergy -= weight * energyFlux(hL, nL, tangentL, hR, nR, tangentR, sharedBed);
        }
      }
    }
  }
  let dt = cap;
  s.volumeM3.forEach((v, i) => {
    need(v > 0 || out[i] === 0, 'Dry cavity has outgoing water');
    const footprint = g.states[i].reduce((sum,p) => sum + g.pieces[p].area,0);
    if (wave[i] > 0) dt = Math.min(dt,0.25 * (measures[i].area || footprint) / wave[i]);
    if (v > 0) dt = Math.min(dt, wave[i] > 0 ? 0.25 * measures[i].area / wave[i] : Infinity, response[i] > 0 ? 0.25 * v / response[i] : Infinity, out[i] > 0 ? 0.9 * v / out[i] : Infinity);
  });
  need(Number.isFinite(dt) && dt > 0, 'Nonfinite/zero cavity timestep');
  const next = state(s.stateId.split(':')[0], g, s.revision + 1, s.timeS + dt, s.volumeM3.map((v, i) => v + dt * vRate[i]), s.pxKgMS.map((v, i) => v + dt * pxRate[i]), s.pzKgMS.map((v, i) => v + dt * pzRate[i]));
  let nextMeasures: Measure[];
  try { nextMeasures=g.states.map((_,i)=>invert(g,i,next.volumeM3[i])); atmospheric(g,nextMeasures); }
  catch(error) {
    let diagnostic:CavitySurface|null=null;
    try { diagnostic=surface(next,g.states.map((_,i)=>invert(g,i,next.volumeM3[i],false)),g.budget); } catch { /* Wall cap can forbid further geometry. */ }
    throw new CavityTransactionStop(error instanceof Error?error.message:String(error),diagnostic);
  }
  // The common roof belongs to both owners. Test the candidate before commit,
  // including an unbounded outside owner whose neighbour has a lower roof.
  try { guardCommonRoofs(g,nextMeasures,next.timeS); }
  catch(error) { throw new CavityTransactionStop(error instanceof Error?error.message:String(error),surface(next,nextMeasures,g.budget)); }
  const audit = volumeAudit(g, nextMeasures, next.volumeM3), total = next.volumeM3.reduce((sum, v) => sum + v, 0);
  need(total === 0 ? audit.high === 0 : Math.abs(audit.represented - total) <= 0.01 * total, 'Independent original-triangle volume failure');
  const residual = total - s.volumeM3.reduce((sum, v) => sum + v, 0) - dt * boundaryVolume;
  need(Math.abs(residual) <= ROUND * Math.max(total, Math.abs(dt * boundaryVolume)), 'Measured transactional volume closure failure');
  const energyResidual = totalEnergy(next, nextMeasures) - totalEnergy(s, measures) - dt * boundaryEnergy;
  need(Number.isFinite(energyResidual), 'Nonfinite measured energy');
  // DEBT: Companion flux is measured independently, but a rigorous decomposition
  // of Euler/source/quadrature dissipation is not supplied. Keep ENERGY_UNKNOWN.
  // A measured gain above the fixed 5% input budget is still an adverse stop.
  // No residual-based loss or gain pass: source/discrete attribution is unknown.
  // A independently certified bound would be needed for a physical 5% verdict.
  const scale = (p: readonly [number, number]): readonly [number, number] => [p[0] * dt, p[1] * dt];
  return { state: next, measures: nextMeasures, ledger: Object.freeze({ stateId: next.stateId, dtS: dt, boundaryVolumeM3: dt * boundaryVolume, boundaryEnergyJ: dt * boundaryEnergy,
    hllMomentumKgMS: scale(H), correctionKgMS: scale(C), floorReactionKgMS: scale(B), wallMomentumKgMS: scale(W), independentVolumeStatus: audit.qualified ? 'QUALIFIED_1_PERCENT' : 'UNQUALIFIED_RANGE', independentPotentialStatus: 'UNQUALIFIED_RANGE', volumeResidualM3: residual, energyResidualJ: energyResidual, energyStatus: 'ENERGY_UNKNOWN' }) };
}

/** A submerged wall strip feels the overlying water. Squaring just the strip
 * height would lose that pressure; subtract the two water-depth squares. */
export function cavityStripPressure(eta:number, ownerFloor:number, stripFloor:number, stripRoof:number) {
  const bottom=Math.max(ownerFloor,stripFloor),top=Math.min(eta,stripRoof);
  return top<=bottom?0:RHO*G*((eta-bottom)**2-(eta-top)**2)/2;
}

/** Named transaction refusal retains diagnostic geometry, never an accepted state. */
class CavityTransactionStop extends Error {
  constructor(message:string, readonly surface:CavitySurface|null) { super(message); }
}
/** Narrow numerical access for disposable synthetic cases. No native caller uses it. */
export const cavityExperimentInternals = Object.freeze({Budget,buildGeometry,state,invert,atLevel,advance,atmospheric,surface,collectLocalLines,localPartition,lineProvablyOutside,originalSlopeBounds,outward,retainedIntersection});

function cavityOriginalEdgeContinuous(a:Tri,b:Tri,start:P,end:P,provenance?:ReadonlySet<string>) {
  if(a.id===b.id) return true;
  // Two original vertices (including their unmodified y) identify a continuous
  // mesh seam. Coordinate roundoff qualifies incidence, never physical steps.
  const common=a.p.filter((p,i)=>b.p.some((q,j)=>key(p)===key(q)&&a.y[i]===b.y[j]));
  if(common.length>=2 && [start,end].every(p=>Math.abs(cross(common[0],common[1],p))<=ROUND)) return true;
  // Only a line that the original plane pair actually inserted into the local
  // graph can establish continuity without a common original mesh edge.
  return provenance?.has([a.id,b.id].sort((x,y)=>x-y).join(':'))??false;
}
function guardCommonRoofs(g:Geometry,m:readonly Measure[],boundaryTime:number) {
  for(const b of g.boundaries) {
    g.budget.check(); if(b.kind==='wall'||!b.roof) continue;
    const heads=[m[b.left].eta,...(b.right===null?[]:[m[b.right].eta])];
    if(b.right===null && (b.kind==='west'||b.kind==='south') && boundaryTime<4) heads.push(cavityReservoirHead(boundaryTime));
    for(const eta of heads) for(const p of [b.a,b.b]) need(eta<=height(b.floor,p)||eta<height(b.roof,p),`Common aperture ceiling pressure at boundary ${b.id}`);
  }
}
