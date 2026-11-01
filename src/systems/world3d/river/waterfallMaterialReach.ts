/**
 * Defines the water, forces and exchange receipts for one outgoing liquid sheet.
 * The renderer's GPU owns moving positions; these small reference calculations
 * check the physical law and admission contract without rebuilding water on CPU.
 * This is a membrane-only, fixed-connectivity experiment. It is not the full
 * Discrete Viscous Sheets solver: bending, remeshing, rupture and contact are
 * deliberately unsupported and must stop the reach, retaining its water.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 11/10/2026, 17:29:47
 * Dependents: systems/world3d/river/waterfallMaterialInletAssembly.ts, systems/world3d/river/waterfallMaterialInletBirth.ts, systems/world3d/river/waterfallMaterialReachCompute.ts, systems/world3d/river/waterfallMaterialReceiver.ts, systems/world3d/river/waterfallMaterialStreamInlet.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { FilmOutflow } from './waterfallContactFilm';

export type ReachVec3 = [number, number, number];
export interface ReachNode { position: ReachVec3; velocity: ReachVec3; mass: number }
export interface ReachFace {
  nodes: [number, number, number]; volume: number;
  /** Incoming water may be denser toward one corner of its source-time cell.
   * These integrated basis weights are kg, not arbitrary barycentric weights.
   * Omission preserves the original uniform-volume, equal-third convention. */
  cornerMass?: [number, number, number];
}
export interface ReachMesh { nodes: ReachNode[]; faces: ReachFace[] }
export interface ReachLaw { density: number; gravity: ReachVec3; surfaceTension: number; dynamicViscosity: number }
export const WATER_REACH_LAW: Readonly<ReachLaw> = { density: 1000, gravity: [0, -9.81, 0], surfaceTension: .072, dynamicViscosity: .001 };
export const reachAdd = (a: ReachVec3, b: ReachVec3): ReachVec3 => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
export const reachSub = (a: ReachVec3, b: ReachVec3): ReachVec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
export const reachScale = (a: ReachVec3, s: number): ReachVec3 => [a[0]*s, a[1]*s, a[2]*s];
export const reachDot = (a: ReachVec3, b: ReachVec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const reachCross = (a: ReachVec3, b: ReachVec3): ReachVec3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const reachLength = (a: ReachVec3) => Math.hypot(...a);

/** Keep source density variation in the diagonal mass rather than replacing it
 * with equal shares. The same distribution must also reach the eventual optical
 * reconstruction; accepting these weights alone does not qualify rendering. */
export function reachFaceCornerMass(face:ReachFace,density=WATER_REACH_LAW.density):[number,number,number] {
  const total=density*face.volume;
  if(!(density>0)||!(total>0)||![density,face.volume,total].every(Number.isFinite))throw Error('Invalid face mass');
  if(!face.cornerMass)return [total/3,total/3,total/3];
  const weights=face.cornerMass;
  if(weights.length!==3||weights.some(m=>!(m>0)||!Number.isFinite(m))||Math.abs(weights.reduce((a,b)=>a+b,0)-total)>1e-10*total)throw Error('Source corner mass does not equal owned face volume');
  return [...weights];
}

/** The same material topology rule applies at birth and after every append.
 * Two faces may share an edge only with opposite winding; duplicate material
 * triangles and a third edge owner are rejected before GPU water is changed.
 */
export function validateReachMaterialConnectivity(faces:readonly (readonly [number,number,number])[],nodeCount:number):void {
  const triangles=new Set<string>(),edges=new Map<string,{count:number;a:number}>();
  for(const ids of faces){
    if(new Set(ids).size!==3||ids.some(i=>!Number.isSafeInteger(i)||i<0||i>=nodeCount))throw Error('Invalid reach connectivity');
    const triangle=[...ids].sort((a,b)=>a-b).join(':');
    if(triangles.has(triangle))throw Error('Duplicate material face or inconsistent winding');triangles.add(triangle);
    for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');const edge=edges.get(key);if(edge){if(edge.count===2||edge.a===a)throw Error('Nonmanifold or inconsistent reach winding');edge.count++;}else edges.set(key,{count:1,a});}
  }
}

/** No rest shape enters this law. Uniform translation and rigid rotation have
 * zero strain rate; only changes in material lengths dissipate physical energy.
 * The two exposed faces contribute 2 sigma A, as in the DVS surface potential.
 */
export function reachFaceLaw(position: [ReachVec3, ReachVec3, ReachVec3], velocity: [ReachVec3, ReachVec3, ReachVec3], volume: number, law: ReachLaw = WATER_REACH_LAW) {
  if(!(law.density>0)||law.surfaceTension<0||law.dynamicViscosity<0||![law.density,law.surfaceTension,law.dynamicViscosity,...law.gravity].every(Number.isFinite))throw Error('Invalid physical membrane law');
  const [a,b,c] = position, edge = reachSub(b,a), raw = reachCross(edge,reachSub(c,a)), twiceArea = reachLength(raw);
  if (!(twiceArea > 0) || !(volume > 0) || ![...position.flat(),...velocity.flat(),volume].every(Number.isFinite)) throw Error('Invalid positive material triangle');
  const area = twiceArea*.5, normal = reachScale(raw,1/twiceArea), t1 = reachScale(edge,1/reachLength(edge)), t2 = reachCross(normal,t1);
  const gradients: [ReachVec3,ReachVec3,ReachVec3] = [reachScale(reachCross(normal,reachSub(c,b)),1/twiceArea),reachScale(reachCross(normal,reachSub(a,c)),1/twiceArea),reachScale(reachCross(normal,reachSub(b,a)),1/twiceArea)];
  const grad = gradients.map(g => [reachDot(g,t1),reachDot(g,t2)]);
  let l00=0,l01=0,l10=0,l11=0;
  for(let i=0;i<3;i++){const u=reachDot(velocity[i],t1),v=reachDot(velocity[i],t2);l00+=u*grad[i][0];l01+=u*grad[i][1];l10+=v*grad[i][0];l11+=v*grad[i][1];}
  const d01=(l01+l10)*.5, trace=l00+l11, h=volume/area, factor=2*law.dynamicViscosity*h;
  const n00=factor*(l00+trace),n01=factor*d01,n11=factor*(l11+trace);
  const capillary = gradients.map(g=>reachScale(g,-2*law.surfaceTension*area));
  const viscous = grad.map(g=>reachScale(reachAdd(reachScale(t1,n00*g[0]+n01*g[1]),reachScale(t2,n01*g[0]+n11*g[1])),-area));
  const dissipationRate=area*(n00*l00+2*n01*d01+n11*l11);
  return { area, thickness:h, normal, gradients, capillary, viscous, surfaceEnergy:2*law.surfaceTension*area, dissipationRate };
}

/** Check manifold incidence before allocating GPU storage. There is no topology
 * repair here: a folded or nonmanifold input cannot quietly lose a triangle.
 */
export function validateReachMesh(mesh: ReachMesh, law: ReachLaw = WATER_REACH_LAW) {
  if(!mesh.nodes.length||!mesh.faces.length) throw Error('Empty reach mesh');
  validateReachMaterialConnectivity(mesh.faces.map(f=>f.nodes),mesh.nodes.length);
  const mass=new Float64Array(mesh.nodes.length), edges=new Map<string,{a:number;b:number;count:number}>();
  for(const f of mesh.faces){if(new Set(f.nodes).size!==3||f.nodes.some(i=>!Number.isSafeInteger(i)||i<0||i>=mesh.nodes.length))throw Error('Invalid reach connectivity');reachFaceLaw(f.nodes.map(i=>mesh.nodes[i].position) as [ReachVec3,ReachVec3,ReachVec3],f.nodes.map(i=>mesh.nodes[i].velocity) as [ReachVec3,ReachVec3,ReachVec3],f.volume,law);const shares=reachFaceCornerMass(f,law.density);f.nodes.forEach((i,k)=>mass[i]+=shares[k]);for(let k=0;k<3;k++){const a=f.nodes[k],b=f.nodes[(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');const e=edges.get(key);if(e){if(e.count===2||e.a===a)throw Error('Nonmanifold or inconsistent reach winding');e.count++;}else edges.set(key,{a,b,count:1});}}
  mesh.nodes.forEach((n,i)=>{if(!(n.mass>0)||![...n.position,...n.velocity,n.mass].every(Number.isFinite)||Math.abs(n.mass-mass[i])>1e-10*Math.max(1,n.mass))throw Error('Node mass does not equal owned face shares');});
  return { boundaryEdges:[...edges.values()].filter(e=>e.count===1).map(e=>[e.a,e.b] as [number,number]), volume:mesh.faces.reduce((s,f)=>s+f.volume,0) };
}

/** Integrate the actual closed rendered triangles, including free-edge rims.
 * Caller supplies rendered geometry; the function never consults V/A or the
 * owned-volume ledger. Open surfaces are rejected before a volume is reported.
 * Applicability is limited to an independently nonoverlapping closed surface;
 * this arithmetic integral cannot certify union volume or rule out overlap.
 */
export function measureClosedReachVolume(positions: ArrayLike<number>, indices: ArrayLike<number>): number {
  if(positions.length%3||indices.length%3)throw Error('Malformed closed surface');
  const incidence=new Map<string,{signed:number;count:number}>();const triangles=new Set<string>();let sum=0;
  const at=(i:number):ReachVec3=>{if(!Number.isInteger(i)||i<0||i*3+2>=positions.length)throw Error('Invalid closed vertex');return[positions[i*3],positions[i*3+1],positions[i*3+2]];};
  // Translating to a rendered vertex reduces large-world cancellation without
  // fitting thickness or changing the physical surface being measured.
  const origin=at(indices[0]);
  for(let k=0;k<indices.length;k+=3){const ids=[indices[k],indices[k+1],indices[k+2]],keyTriangle=[...ids].sort((a,b)=>a-b).join(':');if(new Set(ids).size!==3||triangles.has(keyTriangle))throw Error('Duplicate or degenerate rendered triangle');triangles.add(keyTriangle);const p=ids.map(i=>reachSub(at(i),origin));if(!p.flat().every(Number.isFinite))throw Error('Nonfinite rendered surface');sum+=reachDot(p[0],reachCross(p[1],p[2]))/6;for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');const e=incidence.get(key)??{signed:0,count:0};e.signed+=a<b?1:-1;e.count++;incidence.set(key,e);}}
  if([...incidence.values()].some(v=>v.signed!==0||v.count!==2))throw Error('Rendered surface is open, nonmanifold or inconsistently wound');
  return Math.abs(sum);
}

export interface ReachInterfaceExchange {
  /** The current attached Film has no surface/wetting-energy closure. Supplying
   * opposite numbers cannot turn that missing model into a qualified transfer. */
  qualification:'controlled-two-sided-sheet-cut'|'film-detachment-unqualified';
  /** Integrated cut force on sheet, kg m/s; applied opposite to named film. */
  sheetImpulse: ReachVec3;
  sheetWork: number;
  upstreamReaction: ReachVec3;
  upstreamWork: number;
  upstreamSurfaceId: string;
  /** Evaluated creation/transport of 2 sigma A. Never an energy residual. */
  surfaceEnergyFlux: number;
  mechanicalEnergy: number;
}
export interface ReachAdmission { id: string; outflow: FilmOutflow; exchange: ReachInterfaceExchange }
export interface ReachAtomicOwner {
  checkpoint(): unknown;
  /** Film.advance already debited water. Suppress flight adoption exactly once. */
  transfer(admissions: readonly ReachAdmission[]): void;
  restore(checkpoint: unknown): void;
}

/** External controls for the artificial inlet, not an upstream Film reaction.
 * Material rows advect with their solved/prescribed velocity. The geometric cut
 * has its own measured trajectory and time interval; the two are not aliases.
 * Surface advection is an insertion transaction, separate from force work.
 */
export type ReachCutSegment = {
  nodeIds:[number,number];
  start:ReachVec3;
  end:ReachVec3;
  outwardConormal:ReachVec3;
} & (
  {materialVelocity:ReachVec3;endpointVelocities?:never}
  | {endpointVelocities:[ReachVec3,ReachVec3];materialVelocity?:never}
);
export interface ReachBoundaryInput {
  timeStart:number;
  timeEnd:number;
  cut:{positionStart:ReachVec3;positionEnd:ReachVec3;velocity:ReachVec3};
  materialRowPolicy:'advect-material-rows';
  inletNodeIds:number[];
  nodes:{id:number;cutForce:ReachVec3;prescribedVelocity?:ReachVec3}[];
  cutSegments:ReachCutSegment[];
  surfaceEnergyAdvection:number;
}
export function validateReachBoundaryInput(input:ReachBoundaryInput,nodeCount:number,boundaryNodes:ReadonlySet<number>,sigma=WATER_REACH_LAW.surfaceTension,boundaryEdges?:ReadonlySet<string>):void {
  const dt=input.timeEnd-input.timeStart;
  const finiteVector=(v:ReachVec3)=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
  if(![input.cut.positionStart,input.cut.positionEnd,input.cut.velocity].every(finiteVector))throw Error('Invalid explicit inlet cut vectors');
  if(!(dt>0)||input.materialRowPolicy!=='advect-material-rows'||![input.timeStart,input.timeEnd,input.surfaceEnergyAdvection,...input.cut.positionStart,...input.cut.positionEnd,...input.cut.velocity].every(Number.isFinite))throw Error('Invalid explicit inlet time or cut trajectory');
  const motion=reachSub(reachSub(input.cut.positionEnd,input.cut.positionStart),reachScale(input.cut.velocity,dt));
  if(reachLength(motion)>1e-10*Math.max(1,reachLength(input.cut.positionStart),reachLength(input.cut.positionEnd)))throw Error('Cut velocity does not match measured cut displacement');
  if(new Set(input.inletNodeIds).size!==input.inletNodeIds.length||input.inletNodeIds.some(i=>!Number.isSafeInteger(i)||i<0||i>=nodeCount||!boundaryNodes.has(i)))throw Error('Artificial forcing requires actual inlet boundary nodes');
  if(new Set(input.nodes.map(n=>n.id)).size!==input.nodes.length||input.nodes.some(n=>!input.inletNodeIds.includes(n.id)||!finiteVector(n.cutForce)||(n.prescribedVelocity!==undefined&&!finiteVector(n.prescribedVelocity))))throw Error('Invalid or non-inlet nodal forcing');
  const forces=new Map<number,ReachVec3>(),segments=new Set<string>(),degree=new Map<number,number>(),anchors=new Map<number,ReachVec3>();let advection=0;
  for(const segment of input.cutSegments){
    if(segment.nodeIds[0]===segment.nodeIds[1]||segment.nodeIds.some(i=>!input.inletNodeIds.includes(i)))throw Error('Cut segment must use inlet material nodes');
    const key=[...segment.nodeIds].sort((a,b)=>a-b).join(':');if(segments.has(key)||boundaryEdges&&!boundaryEdges.has(key))throw Error('Cut segment must be a unique actual material boundary edge');segments.add(key);
    segment.nodeIds.forEach((id,k)=>{const point=k===0?segment.start:segment.end,old=anchors.get(id);if(old&&reachLength(reachSub(old,point))>1e-10*Math.max(1,reachLength(point)))throw Error('Shared inlet material node has inconsistent cut anchors');anchors.set(id,point);});
    // Shared rows may carry a velocity gradient. Each endpoint keeps its own
    // prescribed value; averaging the entire row would erase inlet momentum.
    if((segment.materialVelocity!==undefined)===(segment.endpointVelocities!==undefined))throw Error('Cut segment requires exactly one velocity representation');
    const velocities=segment.endpointVelocities??[segment.materialVelocity!,segment.materialVelocity!] as [ReachVec3,ReachVec3];
    if(velocities.length!==2||velocities.some(v=>!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)))throw Error('Invalid cut endpoint velocities');
    segment.nodeIds.forEach((id,k)=>{degree.set(id,(degree.get(id)??0)+1);if(degree.get(id)!>2)throw Error('Inlet boundary node supports at most two cut segments');const node=input.nodes.find(n=>n.id===id);if(!node?.prescribedVelocity||reachLength(reachSub(node.prescribedVelocity,velocities[k]))>1e-10*Math.max(1,reachLength(velocities[k])))throw Error('Cut transport velocity must equal its prescribed material endpoints');});
    const measured=evaluateLinearMovingReachCut(segment.start,segment.end,segment.outwardConormal,velocities,input.cut.velocity,dt,sigma);
    advection+=measured.surfaceEnergyAdvection;
    for(const id of segment.nodeIds)forces.set(id,reachAdd(forces.get(id)??[0,0,0],reachScale(measured.cutForce,.5)));
  }
  if([...forces.keys()].some(id=>!input.nodes.some(n=>n.id===id)))throw Error('Missing nodal cut traction');
  for(const node of input.nodes){const expected=forces.get(node.id)??[0,0,0];if(reachLength(reachSub(node.cutForce,expected))>1e-10*Math.max(1,reachLength(expected)))throw Error('Cut force is not the evaluated physical edge traction');}
  if(Math.abs(input.surfaceEnergyAdvection-advection)>1e-10*Math.max(1,Math.abs(advection)))throw Error('Surface advection is not the evaluated relative cut flux');
}

/** Geometry derives the artificial two-sided cut force and its independent
 * transport of surface energy. Material velocity supplies physical traction
 * work; relative material/cut velocity supplies advection across the cut.
 */
export function evaluateMovingReachCut(start:ReachVec3,end:ReachVec3,outwardConormal:ReachVec3,materialVelocity:ReachVec3,cutVelocity:ReachVec3,duration:number,sigma=WATER_REACH_LAW.surfaceTension) {
  if(!Array.isArray(cutVelocity)||cutVelocity.length!==3||!cutVelocity.every(Number.isFinite))throw Error('Invalid moving cut velocity');
  const reference=evaluateControlledReachCut(start,end,outwardConormal,materialVelocity,duration,sigma);
  const cutForce=reachScale(reference.sheetImpulse,1/duration);
  return{cutForce,cutImpulse:reference.sheetImpulse,tractionWork:reference.sheetWork,surfaceEnergyAdvection:-duration*reachDot(cutForce,reachSub(materialVelocity,cutVelocity))};
}

/** A straight cut has constant capillary traction, so its work against a
 * linear material velocity is exactly the endpoint mean. Both nodal forces
 * stay half of the edge force. This permits uneven connected inflow without
 * inventing a drive force or changing the existing uniform-cut behavior.
 */
export function evaluateLinearMovingReachCut(start:ReachVec3,end:ReachVec3,outwardConormal:ReachVec3,endpointVelocities:[ReachVec3,ReachVec3],cutVelocity:ReachVec3,duration:number,sigma=WATER_REACH_LAW.surfaceTension) {
  if(endpointVelocities.length!==2||endpointVelocities.some(v=>!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)))throw Error('Invalid cut endpoint velocities');
  const mean=reachAdd(reachScale(endpointVelocities[0],.5),reachScale(endpointVelocities[1],.5));
  return evaluateMovingReachCut(start,end,outwardConormal,mean,cutVelocity,duration,sigma);
}

/** Observer quadrature for the existing backward-Euler update. Constrained
 * rows recover the force that was actually needed after all physical/cut forces
 * were applied. Free rows keep that same expression as a convergence residual;
 * they do not get an invented drive impulse to fill their energy budget.
 */
export function observeReachBoundaryStep(mass:number,v0:ReachVec3,v1:ReachVec3,physicalForce:ReachVec3,cutForce:ReachVec3,dt:number,constrained:boolean) {
  if(!(mass>0)||!(dt>0)||![mass,dt,...v0,...v1,...physicalForce,...cutForce].every(Number.isFinite))throw Error('Invalid boundary observer state');
  const cutImpulse=reachScale(cutForce,dt),rowResidual=reachSub(reachScale(reachSub(v1,v0),mass),reachScale(reachAdd(physicalForce,cutForce),dt));
  const driveImpulse:ReachVec3=constrained?rowResidual:[0,0,0];
  return{cutImpulse,driveImpulse,freeMomentumResidual:constrained?[0,0,0] as ReachVec3:rowResidual,cutWork:reachDot(cutForce,reachScale(v1,dt)),driveWork:reachDot(driveImpulse,v1)};
}

export function validateReachAdmission(a: ReachAdmission) {
  const o=a.outflow,e=a.exchange;
  if(!a.id||!o.origin||o.volume<=0||o.height<=0||!(o.intervalEnd>o.intervalStart)||o.time!==o.intervalEnd||![...o.start,...o.end,...o.velocity,...o.momentum,o.volume,o.height,o.time,e.mechanicalEnergy,e.sheetWork,e.upstreamWork,e.surfaceEnergyFlux,...e.sheetImpulse,...e.upstreamReaction].every(Number.isFinite))throw Error('Incomplete physical reach admission');
  if(e.upstreamSurfaceId!==o.origin.surfaceId||reachLength(reachAdd(e.sheetImpulse,e.upstreamReaction))>1e-9||Math.abs(e.sheetWork+e.upstreamWork)>1e-9)throw Error('Missing opposite interface reaction or work');
  if(reachLength(reachSub(o.momentum,reachScale(o.velocity,WATER_REACH_LAW.density*o.volume)))>1e-8)throw Error('Outflow momentum mismatch');
}

export function requireQualifiedReachInterface(a:ReachAdmission):void {
  validateReachAdmission(a);
  // ReachAdmission deliberately retains a FilmOutflow. A caller-written label
  // cannot change the attached film into a two-sided free sheet. Controlled
  // force preparation enters as a ReachMesh, without claiming Film ownership.
  throw Error('Film detachment requires an evaluated wetting, cut-traction and surface-energy model');
}

/** Evaluates a stationary cut through an ALREADY two-sided free sheet. This is
 * the controlled reference, not a wet ledge detachment closure. The root's
 * assembled free-edge force is retained; this traction cancels it once. Surface
 * advection and traction work cancel for uniform translation across a fixed cut.
 */
export function evaluateControlledReachCut(start:ReachVec3,end:ReachVec3,outwardConormal:ReachVec3,velocity:ReachVec3,duration:number,sigma=WATER_REACH_LAW.surfaceTension) {
  if([start,end,outwardConormal,velocity].some(v=>!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)))throw Error('Invalid controlled stationary cut vectors');
  const length=reachLength(reachSub(end,start));
  if(!(length>0)||!(duration>0)||sigma<0||![...start,...end,...outwardConormal,...velocity,duration,sigma].every(Number.isFinite)||Math.abs(reachLength(outwardConormal)-1)>1e-10||Math.abs(reachDot(reachSub(end,start),outwardConormal))>length*1e-10)throw Error('Invalid controlled stationary cut');
  const sheetImpulse=reachScale(outwardConormal,2*sigma*length*duration),sheetWork=reachDot(sheetImpulse,velocity);
  return{sheetImpulse,upstreamReaction:reachScale(sheetImpulse,-1),sheetWork,upstreamWork:-sheetWork,surfaceEnergyFlux:-sheetWork};
}

/** Shared nodes conserve the incoming momentum. The kinetic energy discarded by
 * adopting one velocity is exposed as mixing loss, never numerical viscosity.
 */
export function mixReachNode(mass: number, velocity: ReachVec3, incomingMass: number, incomingMomentum: ReachVec3) {
  if(!(mass>0)||!(incomingMass>0))throw Error('Invalid node mixing mass');
  const next=reachScale(reachAdd(reachScale(velocity,mass),incomingMomentum),1/(mass+incomingMass));
  const incomingVelocity=reachScale(incomingMomentum,1/incomingMass);
  return {mass:mass+incomingMass,velocity:next,mixingEnergyLoss:.5*mass*reachDot(velocity,velocity)+.5*incomingMass*reachDot(incomingVelocity,incomingVelocity)-.5*(mass+incomingMass)*reachDot(next,next)};
}

/** Only genuinely adjoining wet edges can join. Coordinate closeness alone
 * cannot join unrelated source faces or bridge a dry interval.
 */
export function reachAdmissionsConnect(a: ReachAdmission,b: ReachAdmission):boolean {
  validateReachAdmission(a);validateReachAdmission(b);
  const x=a.outflow,y=b.outflow;
  return x.origin!.surfaceId===y.origin!.surfaceId&&x.origin!.geometryIdentity===y.origin!.geometryIdentity&&x.origin!.face===y.origin!.face&&x.origin!.edge===y.origin!.edge&&x.intervalEnd===y.intervalStart;
}

/** A neighboring wet face needs explicit physical edge incidence. The film's
 * current origin anchor identifies a midpoint, not its complete parameter
 * support. The adapter must provide endpoints; guessing them from centers would
 * recreate the rejected independent source bins. Partial overlap requires a
 * subdivision plan and throws until the caller supplies one.
 */
export interface ReachWetEdgeSupport { edgeIdentity:string; start:number; end:number }
export function reachWetEdgesConnect(a:ReachAdmission,sa:ReachWetEdgeSupport,b:ReachAdmission,sb:ReachWetEdgeSupport):boolean {
  validateReachAdmission(a);validateReachAdmission(b);
  if(!(sa.end>sa.start)||!(sb.end>sb.start)||![sa.start,sa.end,sb.start,sb.end].every(Number.isFinite))throw Error('Invalid wet-edge parameter support');
  if(a.outflow.origin!.surfaceId!==b.outflow.origin!.surfaceId||a.outflow.origin!.geometryIdentity!==b.outflow.origin!.geometryIdentity||sa.edgeIdentity!==sb.edgeIdentity)return false;
  if(a.outflow.intervalStart!==b.outflow.intervalStart||a.outflow.intervalEnd!==b.outflow.intervalEnd)return false;
  if(Math.max(sa.start,sb.start)<Math.min(sa.end,sb.end))throw Error('Partial wet-edge overlap requires explicit subdivision');
  return sa.end===sb.start||sb.end===sa.start;
}
