/**
 * Projects original Film releases onto the supplying edge and provides a
 * manufactured, source-moment-preserving geometry control. That old control
 * is NOT a causal downstream birth constructor: transported material changes
 * its first spatial moment. Use waterfallMaterialInletBirth for the causal
 * source-time trial and retain these original source receipts for comparison.
 * It does not implement Film detachment, finite receivers, rims or breakup.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/10/2026, 17:29:47
 * Dependents: systems/world3d/river/waterfallMaterialInletBirth.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { MaterialPortInput, MaterialReachPort } from './waterfallMaterialReachPort';
import { reconstructFilmMaterialReachPort } from './waterfallMaterialReachPort';
import { reachAdd, reachScale, reachSub, reachLength, reachDot, validateReachMesh, type ReachMesh, type ReachVec3 } from './waterfallMaterialReach';

export interface StreamInletGeometry {
  /** Actual initial occupied material positions, not an aperture or guessed extrusion. */
  positions: ReachVec3[];
  nodeTimes: number[];
  faces: [number, number, number][];
  evidence: string;
}
export interface StreamInletSource {
  input: MaterialPortInput;
  /** Positive volume fractions of this original release in declared faces.
   * A triangle's constant mass quadrature assigns exactly one third to each
   * corner, matching the existing GPU's rho*faceVolume/3 storage model. */
  faceFractions: { face: number; fraction: number }[];
}
/** records bounds pending records AND lifetime admitted-ID history. Reaching
 * history capacity blocks further admission; retirement/history compaction is
 * a separately required stream lifecycle, never silent loss of deduplication. */
export interface StreamInletLimits { records: number; nodes: number; faces: number }
export interface StreamInletReceipt {
  sourceVolume: number; admittedVolume: number;
  sourceMomentum: ReachVec3; admittedMomentum: ReachVec3;
  sourceSpatialMoment: ReachVec3; admittedSpatialMoment: ReachVec3;
  sourceTimeMoment: number; admittedTimeMoment: number;
  sourceKineticEnergy: number; admittedKineticEnergy: number;
  /** Signed source minus projected kinetic energy; never physical viscosity. */
  signedKineticMixingLoss: number; absoluteKineticMixingLoss: number;
  geometryEvidence: string;
}
export interface StreamInletProjection {
  mesh: ReachMesh;
  nodeTimes: number[];
  sources: StreamInletSource[];
  ports: MaterialReachPort[];
  receipt: StreamInletReceipt;
}
export interface StreamInletOwner {
  checkpoint(): unknown;
  /** Must atomically debit these exact original release IDs once. */
  transfer(projection: StreamInletProjection): void;
  restore(checkpoint: unknown): void;
}
const zero = (): ReachVec3 => [0, 0, 0];
const near = (a: number, b: number) => Math.abs(a-b) <= 1e-10 + 1e-10*Math.max(Math.abs(a),Math.abs(b));
const same = (a: ReachVec3,b: ReachVec3) => a.every((v,i)=>near(v,b[i]));
const finite = (a: ReachVec3) => a.length===3 && a.every(Number.isFinite);

export interface StreamInletEdgeProjection {
  sources: MaterialPortInput[];
  nodes: { position:ReachVec3; velocity:ReachVec3; mass:number; sourceTime:number }[];
  segments: { releaseId:string; nodes:[number,number]; intervalStart:number; intervalEnd:number }[];
  receipt: Omit<StreamInletReceipt,'geometryEvidence'> & { maximumCentroidProjectionDisplacement:number };
  admission: 'pending-occupied-downstream-row';
}

/** Project the actual edge flux before occupied downstream material exists.
 * Bed endpoints identify same-interval neighbors; centroid height differences
 * remain visible as measured displacement. These projected points are source
 * mapping only, not a silently welded physical sheet. Dry gaps, different
 * edges, intervals and restart epochs never acquire a connecting segment. */
export function projectFilmStreamSupplyingEdge(inputs:readonly MaterialPortInput[],recordLimit:number,nodeLimit:number):StreamInletEdgeProjection {
  if(inputs.length>recordLimit||!Number.isSafeInteger(recordLimit)||recordLimit<1||!Number.isSafeInteger(nodeLimit)||nodeLimit<1)throw Error('Stream edge capacity exceeded');
  const sources=structuredClone([...inputs]),ports=sources.map(reconstructFilmMaterialReachPort);
  if(new Set(ports.map(p=>p.releaseId)).size!==ports.length)throw Error('Duplicate original release ID');
  const nodes:{position:ReachVec3;velocity:ReachVec3;mass:number;sourceTime:number}[]=[],samples:{id:number;position:ReachVec3}[]=[],segments:StreamInletEdgeProjection['segments']=[];
  const anchors:{key:string;bed:ReachVec3;id:number}[]=[];
  let sourceVolume=0,sourceMomentum=zero(),sourceSpatialMoment=zero(),sourceTimeMoment=0,sourceKineticEnergy=0;
  for(const p of ports){
    const key=JSON.stringify([p.origin.surfaceId,p.edge,p.origin.geometryIdentity,p.intervalStart,p.intervalEnd]);
    const ids=[p.centroidStart,p.centroidEnd].map(position=>{
      const bed=reachSub(position,reachScale(p.normal,p.donorHeight*.5));
      let id=anchors.find(a=>a.key===key&&reachLength(reachSub(a.bed,bed))<=1e-9)?.id;
      if(id===undefined){id=nodes.length;if(id>=nodeLimit)throw Error('Stream edge capacity exceeded');anchors.push({key,bed,id});nodes.push({position:zero(),velocity:zero(),mass:0,sourceTime:0});}
      const n=nodes[id],m=p.mass*.5;n.mass+=m;n.position=reachAdd(n.position,reachScale(position,m));n.velocity=reachAdd(n.velocity,reachScale(p.velocity,m));n.sourceTime+=m*(p.intervalStart+p.intervalEnd)*.5;samples.push({id,position});return id;
    }) as [number,number];
    if(ids[0]===ids[1])throw Error('Collapsed supplying segment');
    segments.push({releaseId:p.releaseId,nodes:ids,intervalStart:p.intervalStart,intervalEnd:p.intervalEnd});
    sourceVolume+=p.volume;sourceMomentum=reachAdd(sourceMomentum,p.momentum);sourceSpatialMoment=reachAdd(sourceSpatialMoment,reachScale(reachAdd(p.centroidStart,p.centroidEnd),p.mass*.5));sourceTimeMoment+=p.mass*(p.intervalStart+p.intervalEnd)*.5;sourceKineticEnergy+=p.mass*.5*reachDot(p.velocity,p.velocity);
  }
  let admittedMomentum=zero(),admittedSpatialMoment=zero(),admittedTimeMoment=0,admittedKineticEnergy=0;
  nodes.forEach(n=>{n.position=reachScale(n.position,1/n.mass);n.velocity=reachScale(n.velocity,1/n.mass);n.sourceTime/=n.mass;admittedMomentum=reachAdd(admittedMomentum,reachScale(n.velocity,n.mass));admittedSpatialMoment=reachAdd(admittedSpatialMoment,reachScale(n.position,n.mass));admittedTimeMoment+=n.mass*n.sourceTime;admittedKineticEnergy+=n.mass*.5*reachDot(n.velocity,n.velocity);});
  const signedKineticMixingLoss=sourceKineticEnergy-admittedKineticEnergy;
  if(!same(sourceMomentum,admittedMomentum)||!same(sourceSpatialMoment,admittedSpatialMoment)||!near(sourceTimeMoment,admittedTimeMoment))throw Error('Supplying edge projection moments failed');
  return {sources,nodes,segments,admission:'pending-occupied-downstream-row',receipt:{sourceVolume,admittedVolume:nodes.reduce((s,n)=>s+n.mass/1000,0),sourceMomentum,admittedMomentum,sourceSpatialMoment,admittedSpatialMoment,sourceTimeMoment,admittedTimeMoment,sourceKineticEnergy,admittedKineticEnergy,signedKineticMixingLoss,absoluteKineticMixingLoss:Math.abs(signedKineticMixingLoss),maximumCentroidProjectionDisplacement:Math.max(0,...samples.map(s=>reachLength(reachSub(s.position,nodes[s.id].position))))}};
}

/** Manufactured source-moment-preserving control, NOT downstream birth.
 * Positive triangle quadrature preserves mass and momentum with variable
 * source velocities. Geometry/time moments must also match EACH original
 * interval, so opposing errors cannot disappear in a packet total. Unsupported
 * mappings stop before an owner debit. No height-offset centroid is welded. */
export function projectFilmStreamInlet(sources: readonly StreamInletSource[], geometry: StreamInletGeometry, limits: StreamInletLimits): StreamInletProjection {
  if(Object.values(limits).some(v=>!Number.isSafeInteger(v)||v<1)||sources.length>limits.records||geometry.positions.length>limits.nodes||geometry.faces.length>limits.faces)throw Error('Stream inlet capacity exceeded');
  if(!sources.length||!geometry.evidence.trim()||geometry.nodeTimes.length!==geometry.positions.length||!geometry.positions.every(finite)||!geometry.nodeTimes.every(Number.isFinite))throw Error('Missing justified occupied material geometry');
  const originals=structuredClone([...sources]), g=structuredClone(geometry);
  const ports=originals.map(s=>reconstructFilmMaterialReachPort(s.input));
  if(new Set(ports.map(p=>p.releaseId)).size!==ports.length)throw Error('Duplicate original release ID');
  const volumes=g.faces.map(()=>0), mass=g.positions.map(()=>0), momentum=g.positions.map(zero);
  let sourceVolume=0, sourceMomentum=zero(),sourceSpatialMoment=zero(),sourceTimeMoment=0,sourceKineticEnergy=0;
  // Each original interval has its own receipt. The positive quadrature is
  // deliberately compatible with lumped GPU mass, not a consistent mass solve.
  originals.forEach((s,k)=>{
    const p=ports[k];let sum=0, x=zero(), t=0;
    if(!s.faceFractions.length||new Set(s.faceFractions.map(q=>q.face)).size!==s.faceFractions.length)throw Error('Missing or duplicate positive quadrature');
    for(const q of s.faceFractions){
      if(!Number.isSafeInteger(q.face)||q.face<0||q.face>=g.faces.length||!(q.fraction>0)||!Number.isFinite(q.fraction))throw Error('Invalid positive quadrature');
      const ids=g.faces[q.face];
      if(new Set(ids).size!==3||ids.some(i=>!Number.isSafeInteger(i)||i<0||i>=g.positions.length))throw Error('Invalid material face');
      sum+=q.fraction;volumes[q.face]+=p.volume*q.fraction;
      for(const i of ids){const w=q.fraction/3;x=reachAdd(x,reachScale(g.positions[i],w));t+=g.nodeTimes[i]*w;mass[i]+=p.mass*w;momentum[i]=reachAdd(momentum[i],reachScale(p.momentum,w));}
    }
    const centroid=reachScale(reachAdd(p.centroidStart,p.centroidEnd),.5), midpoint=(p.intervalStart+p.intervalEnd)*.5;
    if(!near(sum,1)||!same(x,centroid)||!near(t,midpoint))throw Error(`Unsupported spatial/time moment alignment for ${p.releaseId}`);
    sourceVolume+=p.volume;sourceMomentum=reachAdd(sourceMomentum,p.momentum);sourceSpatialMoment=reachAdd(sourceSpatialMoment,reachScale(centroid,p.mass));sourceTimeMoment+=p.mass*midpoint;sourceKineticEnergy+=p.mass*.5*reachDot(p.velocity,p.velocity);
  });
  const mesh:ReachMesh={nodes:g.positions.map((position,i)=>({position,velocity:reachScale(momentum[i],1/mass[i]),mass:mass[i]})),faces:g.faces.map((nodes,i)=>({nodes,volume:volumes[i]}))};
  validateReachMesh(mesh);
  // A shared material edge must correspond to an actual same-time supplying
  // neighbor. This rejects topology that silently bridges dry spatial spans,
  // temporal source-off gaps, unrelated supplying edges or surfaces.
  const owners=g.faces.map((_,i)=>originals.flatMap((s,k)=>s.faceFractions.some(q=>q.face===i)?[k]:[]));
  const incidence=new Map<string,number[]>();
  g.faces.forEach((ids,f)=>ids.forEach((a,k)=>{const b=ids[(k+1)%3],key=[a,b].sort((x,y)=>x-y).join(':');const list=incidence.get(key)??[];list.push(f);incidence.set(key,list);}));
  for(const faces of incidence.values())if(faces.length===2){
    const compatible=owners[faces[0]].some(a=>owners[faces[1]].some(b=>{
      if(a===b)return true;
      const pa=ports[a],pb=ports[b];if(pa.edge!==pb.edge||pa.origin.geometryIdentity!==pb.origin.geometryIdentity||pa.intervalStart!==pb.intervalStart||pa.intervalEnd!==pb.intervalEnd)return false;
      const bed=(p:MaterialReachPort,v:ReachVec3)=>reachSub(v,reachScale(p.normal,p.donorHeight*.5));
      // Even physically adjacent bed edges cannot merge distinct flux-height
      // centroids without a separate, explicitly justified shape projection.
      return [[pa.centroidStart,pb.centroidEnd],[pa.centroidEnd,pb.centroidStart]].some(([x,y])=>reachLength(reachSub(bed(pa,x),bed(pb,y)))<=1e-9 && same(x,y));
    }));
    if(!compatible)throw Error('Shared geometry bridges dry spans, intervals or height-offset source centroids');
  }
  let admittedMomentum=zero(),admittedSpatialMoment=zero(),admittedTimeMoment=0,admittedKineticEnergy=0;
  mesh.nodes.forEach((n,i)=>{admittedMomentum=reachAdd(admittedMomentum,reachScale(n.velocity,n.mass));admittedSpatialMoment=reachAdd(admittedSpatialMoment,reachScale(n.position,n.mass));admittedTimeMoment+=n.mass*g.nodeTimes[i];admittedKineticEnergy+=n.mass*.5*reachDot(n.velocity,n.velocity);});
  const admittedVolume=mesh.faces.reduce((s,f)=>s+f.volume,0),signedKineticMixingLoss=sourceKineticEnergy-admittedKineticEnergy;
  if(!near(sourceVolume,admittedVolume)||!same(sourceMomentum,admittedMomentum)||!same(sourceSpatialMoment,admittedSpatialMoment)||!near(sourceTimeMoment,admittedTimeMoment))throw Error('Stream inlet moments failed reconstruction');
  return {mesh,nodeTimes:g.nodeTimes,sources:originals,ports,receipt:{sourceVolume,admittedVolume,sourceMomentum,admittedMomentum,sourceSpatialMoment,admittedSpatialMoment,sourceTimeMoment,admittedTimeMoment,sourceKineticEnergy,admittedKineticEnergy,signedKineticMixingLoss,absoluteKineticMixingLoss:Math.abs(signedKineticMixingLoss),geometryEvidence:g.evidence}};
}

/** Holds an immutable staged projection until the two-sided ownership change
 * succeeds. Checkpoints and projection data are copied so a failing owner
 * cannot mutate the retained source inventory or retry a partially changed mesh. */
export class FilmMaterialStreamInlet {
  private committed=new Set<string>();
  private retained=new Map<string,MaterialPortInput>();
  constructor(private readonly limits:StreamInletLimits) { this.limits=structuredClone(limits); }
  /** Queue originals before ContactFlow aggregates or adopts them as flight.
   * Validation and capacity apply to the entire replacement first, so failed
   * packets leave the retained inventory untouched. No source-off call clears it. */
  retain(inputs:readonly MaterialPortInput[]):StreamInletEdgeProjection {
    const candidate=[...this.retained.values(),...structuredClone(inputs)];
    if(inputs.some(s=>this.committed.has(s.releaseId)))throw Error('Original release already admitted');
    const projected=projectFilmStreamSupplyingEdge(candidate,this.limits.records,this.limits.nodes);
    this.retained=new Map(projected.sources.map(s=>[s.releaseId,structuredClone(s)]));return projected;
  }
  pending():MaterialPortInput[] { return structuredClone([...this.retained.values()]); }
  prepare(sources:readonly StreamInletSource[],geometry:StreamInletGeometry):StreamInletProjection {
    if(sources.some(s=>this.committed.has(s.input.releaseId)))throw Error('Original release already admitted');
    if(this.committed.size+sources.length>this.limits.records)throw Error('Stream inlet admitted-ID history capacity exceeded');
    if(sources.some(s=>this.retained.has(s.input.releaseId)&&JSON.stringify(this.retained.get(s.input.releaseId))!==JSON.stringify(s.input)))throw Error('Retained original release was mutated');
    return projectFilmStreamInlet(sources,geometry,this.limits);
  }
  admit(sources:readonly StreamInletSource[],geometry:StreamInletGeometry,owner:StreamInletOwner):StreamInletProjection {
    const staged=this.prepare(sources,geometry),checkpoint=owner.checkpoint();
    try{owner.transfer(structuredClone(staged));}catch(error){owner.restore(checkpoint);throw error;}
    staged.ports.forEach(p=>{this.committed.add(p.releaseId);this.retained.delete(p.releaseId);});return staged;
  }
}
