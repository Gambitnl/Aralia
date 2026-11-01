/**
 * Builds a causal source-edge/birth-time trial strip from original Film flux.
 * The oldest row follows a gravity characteristic and the newest row is at
 * the cut. This is trial geometry for ONE open-system interval, not completed
 * membrane motion. It must not receive another full gravity/position update.
 * Positive source quadrature supplies unequal corner masses to future ALE
 * assembly. Resident rows retain actual IDs and explicitly supplied state.
 * No solver, ownership acknowledgment, rendering or finite contact runs here.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/10/2026, 17:29:47
 * Dependents: systems/world3d/river/waterfallMaterialInletAssembly.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { MaterialPortInput } from './waterfallMaterialReachPort';
import { projectFilmStreamSupplyingEdge, type StreamInletEdgeProjection } from './waterfallMaterialStreamInlet';
import { reachAdd as add, reachSub as sub, reachScale as scale, reachDot as dot, reachCross as cross, reachLength as length, validateReachMaterialConnectivity, type ReachVec3 } from './waterfallMaterialReach';

export interface MaterialInletBirthLimits { records:number; nodes:number; faces:number; quadrature:number }
export interface MaterialInletResidentRow {
  sourceEdgeNode:number; residentId:number; position:ReachVec3; velocity:ReachVec3; meshVelocity:ReachVec3;
}
export interface MaterialInletBirthOptions {
  endpointTime:number; gravity:ReachVec3; limits:MaterialInletBirthLimits;
  reconstruction:'constant-time-linear-edge';
  /** dV/(ds dτ), with each original spatial span normalized to s in [0,1].
   * Default constant beta is original V/dt. Optional affine beta is an
   * explicit source reconstruction, not hidden finer native temporal data. */
  edgeFluxEndpoints?:Record<string,[number,number]>;
  cut?:{kind:'stationary-original-centroid'}|{kind:'declared-linear-cut';referenceTime:number;evidence:string};
  residentOldestRow?:readonly MaterialInletResidentRow[];
  /** First new global material ID. Must not collide with supplied resident IDs. */
  firstNewNodeId?:number;
}
export interface MaterialInletBirthNode {
  /** Birth-time chart vertex, not a literal lumped parcel. Corner mass has
   * support over many actual births; no full-age newborn gravity kick follows. */
  id:number; sourceEdgeNode:number; normalizedBirth:number; birthTime:number;
  position:ReachVec3; characteristicVelocity:ReachVec3;
  mass:number; sourceMomentum:ReachVec3; trialMomentum:ReachVec3; projectedVelocity:ReachVec3;
  resident:boolean;
}
export interface MaterialInletBirthFace { id:number; releaseId:string; nodes:[number,number,number]; volume:number; cornerMass:[number,number,number] }
export interface MaterialInletBirthSample {
  faceId:number; releaseId:string; nodeIds:[number,number,number]; barycentric:[number,number,number];
  volume:number; birthTime:number; sourcePosition:ReachVec3; sourceVelocity:ReachVec3;
  trialPosition:ReachVec3; trialVelocity:ReachVec3; affinePosition:ReachVec3;
}
export interface MaterialInletBirthMoments {
  volume:number; positionMoment:ReachVec3; velocityVolumeMoment:ReachVec3; momentum:ReachVec3;
  kineticEnergy:number; birthTimeMoment:number; ageVolumeMoment:number; ageSquaredVolumeMoment:number; ageVelocityVolumeMoment:ReachVec3;
}
export interface MaterialInletBirthActiveFace {
  id:number; releaseId:string; nodeIds:[number,number,number];
  positions:[ReachVec3,ReachVec3,ReachVec3]; materialVelocities:[ReachVec3,ReachVec3,ReachVec3]; meshVelocities:[ReachVec3,ReachVec3,ReachVec3];
  /** Areal mass density rho*h. Thickness is beta/J of the affine triangle;
   * it is not a constant V/A prism when beta varies across the source edge. */
  density:[number,number,number]; thickness:[number,number,number];
  volume:number; cornerMass:[number,number,number]; quadrature:MaterialInletBirthSample[];
}
export interface MaterialInletBirthEvaluation {
  time:number; activeDuration:number; faces:MaterialInletBirthActiveFace[];
  boundaries:{releaseId:string;nodeIds:[number,number];massRate:[number,number];velocities:[ReachVec3,ReachVec3];positions:[ReachVec3,ReachVec3]}[];
  nodeMass:number[]; nodeSourceMomentum:ReachVec3[]; nodeTrialMomentum:ReachVec3[];
  /** Null at the zero-measure birth scaffold; never P/0 or a mass floor. */
  nodalProjectedVelocities:(ReachVec3|null)[];
  source:MaterialInletBirthMoments; characteristic:MaterialInletBirthMoments;
  affinePositionMoment:ReachVec3; affineMinusCharacteristicPositionMoment:ReachVec3;
  characteristicKineticEnergy:number; projectedLumpedKineticEnergy:number; projectedFieldKineticEnergy:number;
  signedMomentumProjectionLoss:number; absoluteMomentumProjectionLoss:number; lumpedMinusFieldKineticEnergy:number;
  residentConstraintPositionMoment:ReachVec3;
}
export interface MaterialInletBirth {
  classification:'source-time-trial-only'; originals:MaterialPortInput[]; sourceEdgeProjection:StreamInletEdgeProjection;
  intervalStart:number; intervalEnd:number; options:MaterialInletBirthOptions;
  nodes:MaterialInletBirthNode[]; faces:MaterialInletBirthFace[];
  temporalQuadrature:{time:number;weight:number}[];
  wetComponents:number[][];
  originalSource:MaterialInletBirthMoments; endpoint:MaterialInletBirthEvaluation;
  sourceReconstructionChange:{volume:number;positionMoment:ReachVec3;momentum:ReachVec3;birthTimeMoment:number;signedKineticLoss:number;absoluteKineticLoss:number};
  /** Internal chart is retained for repeated born-domain assembly evaluations. */
  charts:{releaseId:string; sourceEdgeNodes:[number,number]; beta:[number,number]; cutVelocity:ReachVec3; faces:[number,number]}[];
}
const rho=1000;
const zero=():ReachVec3=>[0,0,0];
const finite=(v:ReachVec3)=>v.length===3&&v.every(Number.isFinite);
const interpolate=(a:ReachVec3,b:ReachVec3,s:number)=>add(scale(a,1-s),scale(b,s));
const moments=():MaterialInletBirthMoments=>({volume:0,positionMoment:zero(),velocityVolumeMoment:zero(),momentum:zero(),kineticEnergy:0,birthTimeMoment:0,ageVolumeMoment:0,ageSquaredVolumeMoment:0,ageVelocityVolumeMoment:zero()});
// Positive six-point degree-four triangle rule, weights normalized to one.
// It integrates beta-weighted linear/quadratic characteristic moments without
// negative material weights or sampling the zero-area startup instant.
const quadrature:[number,number,number,number][]=[
  [.445948490915965,.445948490915965,.108103018168070,.223381589678011],
  [.445948490915965,.108103018168070,.445948490915965,.223381589678011],
  [.108103018168070,.445948490915965,.445948490915965,.223381589678011],
  [.091576213509771,.091576213509771,.816847572980458,.109951743655322],
  [.091576213509771,.816847572980458,.091576213509771,.109951743655322],
  [.816847572980458,.091576213509771,.091576213509771,.109951743655322],
];
function accumulate(m:MaterialInletBirthMoments,dV:number,x:ReachVec3,u:ReachVec3,birth:number,age:number):void {
  m.volume+=dV;m.positionMoment=add(m.positionMoment,scale(x,dV));m.velocityVolumeMoment=add(m.velocityVolumeMoment,scale(u,dV));m.momentum=add(m.momentum,scale(u,rho*dV));m.kineticEnergy+=rho*dV*.5*dot(u,u);m.birthTimeMoment+=dV*birth;m.ageVolumeMoment+=dV*age;m.ageSquaredVolumeMoment+=dV*age*age;m.ageVelocityVolumeMoment=add(m.ageVelocityVolumeMoment,scale(u,dV*age));
}
function emptyEvaluation(time:number,count:number):MaterialInletBirthEvaluation {
  return {time,activeDuration:0,faces:[],boundaries:[],nodeMass:Array(count).fill(0),nodeSourceMomentum:Array.from({length:count},zero),nodeTrialMomentum:Array.from({length:count},zero),nodalProjectedVelocities:Array(count).fill(null),source:moments(),characteristic:moments(),affinePositionMoment:zero(),affineMinusCharacteristicPositionMoment:zero(),characteristicKineticEnergy:0,projectedLumpedKineticEnergy:0,projectedFieldKineticEnergy:0,signedMomentumProjectionLoss:0,absoluteMomentumProjectionLoss:0,lumpedMinusFieldKineticEnergy:0,residentConstraintPositionMoment:zero()};
}

/** One original subinterval only. Different source times require separate
 * assembly intervals and actual resident-row coupling, not a fabricated
 * global subdivision or proximity-based reconnection. Inputs remain copied. */
export function constructMaterialInletBirth(inputs:readonly MaterialPortInput[],options:MaterialInletBirthOptions):MaterialInletBirth {
  if(!inputs.length||options.reconstruction!=='constant-time-linear-edge'||!finite(options.gravity)||!Object.values(options.limits).every(v=>Number.isSafeInteger(v)&&v>0))throw Error('Invalid inlet birth options or empty source interval');
  const originals=structuredClone([...inputs]),o=structuredClone(options),start=originals[0].outflow.intervalStart,end=originals[0].outflow.intervalEnd,dt=end-start;
  if(!(dt>0)||o.endpointTime!==end||originals.some(i=>i.outflow.intervalStart!==start||i.outflow.intervalEnd!==end))throw Error('Birth constructor requires one exact original source subinterval');
  if(o.cut?.kind==='declared-linear-cut'&&(!Number.isFinite(o.cut.referenceTime)||!o.cut.evidence.trim()))throw Error('Moving source centroid needs declared within-interval evidence');
  if(o.cut?.kind!=='declared-linear-cut'&&originals.some(i=>length(i.cut.velocity)!==0))throw Error('Moving cut requires declared linear centroid reconstruction');
  const edge=projectFilmStreamSupplyingEdge(originals,o.limits.records,o.limits.nodes);
  if(edge.nodes.length*2>o.limits.nodes||edge.segments.length*2>o.limits.faces||edge.segments.length*12>o.limits.quadrature)throw Error('Inlet birth capacity exceeded');
  const bindings=o.residentOldestRow??[],bound=new Map(bindings.map(b=>[b.sourceEdgeNode,b]));
  if(bound.size!==bindings.length||new Set(bindings.map(b=>b.residentId)).size!==bindings.length||bindings.some(b=>!Number.isSafeInteger(b.sourceEdgeNode)||b.sourceEdgeNode<0||b.sourceEdgeNode>=edge.nodes.length||!Number.isSafeInteger(b.residentId)||b.residentId<0||![b.position,b.velocity,b.meshVelocity].every(finite)))throw Error('Invalid actual resident oldest-row bindings');
  let next=o.firstNewNodeId??0;if(!Number.isSafeInteger(next)||next<0)throw Error('Invalid first new material node ID');
  const used=new Set(bindings.map(b=>b.residentId)),nodes:MaterialInletBirthNode[]=[],faces:MaterialInletBirthFace[]=[],charts:MaterialInletBirth['charts']=[];
  const rowIds=new Map<string,number>();
  edge.nodes.forEach((sourceNode,s)=>[0,1].forEach(r=>{
    const binding=r===0?bound.get(s):undefined;
    if(!binding){while(used.has(next))next++;if(!Number.isSafeInteger(next))throw Error('Material node ID capacity exceeded');}
    const id=binding?.residentId??next++;used.add(id);rowIds.set(`${s}:${r}`,id);
    nodes.push({id,sourceEdgeNode:s,normalizedBirth:r,birthTime:start+r*dt,position:binding?[...binding.position]:zero(),characteristicVelocity:zero(),mass:0,sourceMomentum:zero(),trialMomentum:zero(),projectedVelocity:zero(),resident:Boolean(binding)});
  }));
  for(const segment of edge.segments){
    const original=originals.find(i=>i.releaseId===segment.releaseId)!;
    const beta=o.edgeFluxEndpoints?.[segment.releaseId]??[original.outflow.volume/dt,original.outflow.volume/dt];
    const represented=(beta[0]+beta[1])*.5*dt,expected=original.outflow.volume;
    if(beta.some(v=>!Number.isFinite(v)||v<0)||!(represented>0)||Math.abs(represented-expected)>64*Number.EPSILON*Math.max(Number.MIN_VALUE,Math.abs(represented),Math.abs(expected)))throw Error('Declared source flux does not integrate original positive volume');
    const [a,b]=segment.nodes,oldA=rowIds.get(`${a}:0`)!,oldB=rowIds.get(`${b}:0`)!,newA=rowIds.get(`${a}:1`)!,newB=rowIds.get(`${b}:1`)!;
    const f=faces.length;faces.push({id:f,releaseId:segment.releaseId,nodes:[oldA,oldB,newB],volume:0,cornerMass:[0,0,0]},{id:f+1,releaseId:segment.releaseId,nodes:[oldA,newB,newA],volume:0,cornerMass:[0,0,0]});
    charts.push({releaseId:segment.releaseId,sourceEdgeNodes:[a,b],beta:[...beta],cutVelocity:[...original.cut.velocity],faces:[f,f+1]});
  }
  // A shared edge must use one declared source-time geometry. Different cut
  // trajectories cannot silently share the same source-projected vertex.
  const cuts=new Map<number,ReachVec3>();for(const c of charts)for(const id of c.sourceEdgeNodes){const prior=cuts.get(id);if(prior&&length(sub(prior,c.cutVelocity))>1e-10)throw Error('Shared source node has inconsistent cut trajectory');cuts.set(id,c.cutVelocity);}
  validateReachMaterialConnectivity(faces.map(f=>f.nodes.map(id=>nodes.findIndex(n=>n.id===id)) as [number,number,number]),nodes.length);
  const birth:MaterialInletBirth={classification:'source-time-trial-only',originals,sourceEdgeProjection:edge,intervalStart:start,intervalEnd:end,options:o,nodes,faces,charts,temporalQuadrature:[{time:start+dt*(.5-.5/Math.sqrt(3)),weight:dt*.5},{time:start+dt*(.5+.5/Math.sqrt(3)),weight:dt*.5}],wetComponents:[],originalSource:moments(),sourceReconstructionChange:{volume:0,positionMoment:zero(),momentum:zero(),birthTimeMoment:0,signedKineticLoss:0,absoluteKineticLoss:0},endpoint:emptyEvaluation(start,nodes.length)};
  for(const original of originals){const p=original.outflow;accumulate(birth.originalSource,p.volume,scale(add(p.start,p.end),.5),p.velocity,(start+end)*.5,dt*.5);birth.originalSource.ageSquaredVolumeMoment+=p.volume*dt*dt/12;}
  // Components follow material edge incidence, not visual proximity. A dry
  // source span has no face and therefore cannot join two wet components.
  const unvisited=new Set(faces.map(f=>f.id));while(unvisited.size){const seed=unvisited.values().next().value as number,component=[seed];unvisited.delete(seed);for(let k=0;k<component.length;k++){const current=faces[component[k]];for(const f of faces)if(unvisited.has(f.id)&&f.nodes.filter(id=>current.nodes.includes(id)).length===2){unvisited.delete(f.id);component.push(f.id);}}birth.wetComponents.push(component);}
  birth.endpoint=evaluateMaterialInletBirth(birth,end);
  const signedSourceLoss=birth.originalSource.kineticEnergy-birth.endpoint.source.kineticEnergy;
  birth.sourceReconstructionChange={volume:birth.endpoint.source.volume-birth.originalSource.volume,positionMoment:sub(birth.endpoint.source.positionMoment,birth.originalSource.positionMoment),momentum:sub(birth.endpoint.source.momentum,birth.originalSource.momentum),birthTimeMoment:birth.endpoint.source.birthTimeMoment-birth.originalSource.birthTimeMoment,signedKineticLoss:signedSourceLoss,absoluteKineticLoss:Math.abs(signedSourceLoss)};
  birth.nodes.forEach((n,k)=>{
    const chart=charts.find(c=>c.sourceEdgeNodes.includes(n.sourceEdgeNode))!,field=vertexField(birth,chart,n,end),binding=n.resident?bound.get(n.sourceEdgeNode):undefined;
    n.position=binding?[...binding.position]:field.position;n.characteristicVelocity=field.velocity;
    n.mass=birth.endpoint.nodeMass[k];n.sourceMomentum=birth.endpoint.nodeSourceMomentum[k];n.trialMomentum=birth.endpoint.nodeTrialMomentum[k];n.projectedVelocity=birth.endpoint.nodalProjectedVelocities[k]!;
  });
  birth.faces.forEach((f,k)=>{f.volume=birth.endpoint.faces[k].volume;f.cornerMass=birth.endpoint.faces[k].cornerMass;});
  return birth;
}

function sourceField(birth:MaterialInletBirth,chart:MaterialInletBirth['charts'][number],s:number,tau:number):{position:ReachVec3;velocity:ReachVec3;beta:number} {
  const [a,b]=chart.sourceEdgeNodes.map(i=>birth.sourceEdgeProjection.nodes[i]);
  let position=interpolate(a.position,b.position,s);
  if(birth.options.cut?.kind==='declared-linear-cut')position=add(position,scale(chart.cutVelocity,tau-birth.options.cut.referenceTime));
  return {position,velocity:interpolate(a.velocity,b.velocity,s),beta:chart.beta[0]*(1-s)+chart.beta[1]*s};
}
function vertexField(birth:MaterialInletBirth,chart:MaterialInletBirth['charts'][number],node:MaterialInletBirthNode,time:number) {
  const duration=time-birth.intervalStart,r=node.normalizedBirth,s=node.sourceEdgeNode===chart.sourceEdgeNodes[0]?0:1,tau=birth.intervalStart+r*duration,age=time-tau,source=sourceField(birth,chart,s,tau);
  const velocity=add(source.velocity,scale(birth.options.gravity,age));
  return {position:add(add(source.position,scale(source.velocity,age)),scale(birth.options.gravity,.5*age*age)),velocity,meshVelocity:add(scale(velocity,1-r),scale(chart.cutVelocity,r)),beta:source.beta,tau};
}

/** Evaluate only material born by this assembly time. The oldest row follows
 * fluid motion, while the newest cut row has cut mesh velocity. Interior
 * resident-row state must come from the actual adjoining trial solve; this
 * function neither guesses its trajectory nor changes resident storage. */
export function evaluateMaterialInletBirth(birth:MaterialInletBirth,time:number,residentStates?:readonly MaterialInletResidentRow[]):MaterialInletBirthEvaluation {
  if(!Number.isFinite(time)||time<birth.intervalStart||time>birth.intervalEnd)throw Error('Inlet evaluation outside original interval');
  const duration=time-birth.intervalStart,source=moments(),characteristic=moments(),faces:MaterialInletBirthActiveFace[]=[],boundaries:MaterialInletBirthEvaluation['boundaries']=[],nodeMass=birth.nodes.map(()=>0),nodeSourceMomentum=birth.nodes.map(zero),nodeTrialMomentum=birth.nodes.map(zero);
  let affinePositionMoment=zero(),residentConstraintPositionMoment=zero();
  const resident=residentStates??(time===birth.intervalEnd?birth.options.residentOldestRow:undefined),bindings=new Map((resident??[]).map(b=>[b.sourceEdgeNode,b]));
  if(resident&&bindings.size!==resident.length)throw Error('Duplicate actual resident trial states');
  if(duration>0&&birth.nodes.some(n=>n.resident)&&(!resident||birth.nodes.some(n=>n.resident&&!bindings.has(n.sourceEdgeNode))))throw Error('Interior evaluation needs actual same-time resident trial states');
  for(const binding of resident??[]){const n=birth.nodes.find(n=>n.resident&&n.sourceEdgeNode===binding.sourceEdgeNode);if(!n||n.id!==binding.residentId||![binding.position,binding.velocity,binding.meshVelocity].every(finite))throw Error('Resident trial node ID/state mismatch');}
  if(duration>0)for(const chart of birth.charts){
    const latest=chart.sourceEdgeNodes.map(id=>birth.nodes.find(n=>n.sourceEdgeNode===id&&n.normalizedBirth===1)!);
    const latestFields=latest.map(n=>vertexField(birth,chart,n,time));
    boundaries.push({releaseId:chart.releaseId,nodeIds:latest.map(n=>n.id) as [number,number],massRate:chart.beta.map(b=>rho*b) as [number,number],velocities:latestFields.map(f=>f.velocity) as [ReachVec3,ReachVec3],positions:latestFields.map(f=>f.position) as [ReachVec3,ReachVec3]});
    for(const faceId of chart.faces){
      const face=birth.faces[faceId],local=face.nodes.map(id=>birth.nodes.findIndex(n=>n.id===id)),ns=local.map(k=>birth.nodes[k]),fields=ns.map(n=>vertexField(birth,chart,n,time));
      const positions=fields.map((f,k)=>bindings.get(ns[k].sourceEdgeNode)&&ns[k].resident?[...bindings.get(ns[k].sourceEdgeNode)!.position]:f.position) as [ReachVec3,ReachVec3,ReachVec3];
      const materialVelocities=fields.map((f,k)=>ns[k].resident?[...bindings.get(ns[k].sourceEdgeNode)!.velocity]:f.velocity) as [ReachVec3,ReachVec3,ReachVec3];
      const meshVelocities=fields.map((f,k)=>ns[k].resident?[...bindings.get(ns[k].sourceEdgeNode)!.meshVelocity]:f.meshVelocity) as [ReachVec3,ReachVec3,ReachVec3];
      const jacobian=length(cross(sub(positions[1],positions[0]),sub(positions[2],positions[0])));
      if(!(jacobian>0)||!Number.isFinite(jacobian)||!positions.every(finite)||!materialVelocities.every(finite)||!meshVelocities.every(finite))throw Error('Positive source has no finite positive-area trial image');
      const thickness=fields.map(f=>f.beta*duration/jacobian) as [number,number,number],density=thickness.map(h=>rho*h) as [number,number,number],cornerMass:[number,number,number]=[0,0,0],samples:MaterialInletBirthSample[]=[];let volume=0;
      for(const [l0,l1,l2,w] of quadrature){
        const barycentric:[number,number,number]=[l0,l1,l2],s=ns.reduce((sum,n,k)=>sum+barycentric[k]*(n.sourceEdgeNode===chart.sourceEdgeNodes[0]?0:1),0),r=ns.reduce((sum,n,k)=>sum+barycentric[k]*n.normalizedBirth,0),tau=birth.intervalStart+r*duration,age=time-tau,field=sourceField(birth,chart,s,tau),dV=field.beta*duration*.5*w;
        if(!(dV>0)||!Number.isFinite(dV))throw Error('Source quadrature is not positive finite material');
        const x=add(add(field.position,scale(field.velocity,age)),scale(birth.options.gravity,.5*age*age)),v=add(field.velocity,scale(birth.options.gravity,age));
        let affine=zero(),unconstrained=zero();for(let k=0;k<3;k++){affine=add(affine,scale(positions[k],barycentric[k]));unconstrained=add(unconstrained,scale(fields[k].position,barycentric[k]));const dm=rho*dV*barycentric[k];cornerMass[k]+=dm;nodeMass[local[k]]+=dm;nodeSourceMomentum[local[k]]=add(nodeSourceMomentum[local[k]],scale(field.velocity,dm));nodeTrialMomentum[local[k]]=add(nodeTrialMomentum[local[k]],scale(v,dm));}
        volume+=dV;accumulate(source,dV,field.position,field.velocity,tau,age);accumulate(characteristic,dV,x,v,tau,age);affinePositionMoment=add(affinePositionMoment,scale(affine,dV));residentConstraintPositionMoment=add(residentConstraintPositionMoment,scale(sub(affine,unconstrained),dV));
        samples.push({faceId,releaseId:chart.releaseId,nodeIds:[...face.nodes],barycentric,volume:dV,birthTime:tau,sourcePosition:field.position,sourceVelocity:field.velocity,trialPosition:x,trialVelocity:v,affinePosition:affine});
      }
      if(![...thickness,...density,volume,...cornerMass].every(Number.isFinite))throw Error('Inlet source mass or thickness exceeds finite capacity');
      faces.push({id:faceId,releaseId:chart.releaseId,nodeIds:[...face.nodes],positions,materialVelocities,meshVelocities,density,thickness,volume,cornerMass,quadrature:samples});
    }
  }
  const nodalProjectedVelocities=nodeMass.map((m,k)=>m>0?scale(nodeTrialMomentum[k],1/m):null);
  let projectedLumpedKineticEnergy=0,projectedFieldKineticEnergy=0;
  nodeMass.forEach((m,k)=>{const v=nodalProjectedVelocities[k];if(v)projectedLumpedKineticEnergy+=m*.5*dot(v,v);});
  for(const face of faces)for(const q of face.quadrature){let v=zero();face.nodeIds.forEach((id,k)=>{v=add(v,scale(nodalProjectedVelocities[birth.nodes.findIndex(n=>n.id===id)]!,q.barycentric[k]));});projectedFieldKineticEnergy+=rho*q.volume*.5*dot(v,v);}
  const signedMomentumProjectionLoss=characteristic.kineticEnergy-projectedLumpedKineticEnergy;
  const result:MaterialInletBirthEvaluation={time,activeDuration:duration,faces,boundaries,nodeMass,nodeSourceMomentum,nodeTrialMomentum,nodalProjectedVelocities,source,characteristic,affinePositionMoment,affineMinusCharacteristicPositionMoment:sub(affinePositionMoment,characteristic.positionMoment),characteristicKineticEnergy:characteristic.kineticEnergy,projectedLumpedKineticEnergy,projectedFieldKineticEnergy,signedMomentumProjectionLoss,absoluteMomentumProjectionLoss:Math.abs(signedMomentumProjectionLoss),lumpedMinusFieldKineticEnergy:projectedLumpedKineticEnergy-projectedFieldKineticEnergy,residentConstraintPositionMoment};
  if(![...nodeMass,...nodeSourceMomentum.flat(),...nodeTrialMomentum.flat(),...Object.values(source).flat(),...Object.values(characteristic).flat(),...affinePositionMoment,projectedLumpedKineticEnergy,projectedFieldKineticEnergy].every(Number.isFinite))throw Error('Inlet birth moments exceed finite capacity');
  return result;
}
