/**
 * Assembles the water entering a growing sheet during one source interval.
 * Material velocity and mesh velocity are distinct: the inlet stays at the
 * ledge while water passes through it. These equations include that transport,
 * changing mass, gravity and the existing membrane forces on born water only.
 *
 * The source-time constructor supplies trial geometry at interior times. This
 * module calculates the actual residual for a coupled solve; it neither commits
 * that trial nor calls a ballistic guess an accepted capillary solution.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 11/10/2026, 17:29:47
 * Dependents: None (Orphan)
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { WATER_REACH_LAW, reachAdd, reachSub, reachScale, reachDot, reachLength, reachCross,
  reachFaceLaw, validateReachMaterialConnectivity, type ReachLaw, type ReachVec3 } from './waterfallMaterialReach';
import { evaluateMaterialInletBirth, type MaterialInletBirth, type MaterialInletResidentRow } from './waterfallMaterialInletBirth';

type Triple<T> = [T,T,T];
export interface MaterialInletAssemblyFace {
  nodeIds: Triple<number>;
  positions: Triple<ReachVec3>;
  materialVelocities: Triple<ReachVec3>;
  meshVelocities: Triple<ReachVec3>;
  /** The same linear thickness distribution used by source quadrature. */
  thickness: Triple<number>;
}
export interface MaterialInletAssemblyBoundary {
  nodeIds: [number,number];
  /** kg/s per normalized edge coordinate, positive into the sheet. */
  massRate: [number,number];
  velocities: [ReachVec3,ReachVec3];
}
export interface MaterialInletAssemblyLimits { nodes:number; faces:number; boundaries:number; samples:number }
export interface MaterialInletAssemblyNode {
  id:number; position:ReachVec3; velocity:ReachVec3; meshVelocity:ReachVec3; mass:number;
  sourceMassRate:number; transportMassRate:number;
  sourceMomentumRate:ReachVec3; transportMomentumRate:ReachVec3;
  gravityForce:ReachVec3; membraneForce:ReachVec3; cutForce:ReachVec3;
}
export interface MaterialInletAssemblySample {
  nodes:MaterialInletAssemblyNode[];
  /** Spatial moments here use mass (kg*m), unlike birth's volume moments. */
  volume:number; momentum:ReachVec3; spatialMoment:ReachVec3;
  kineticEnergy:number; lumpedKineticEnergy:number; potentialEnergy:number; surfaceEnergy:number;
  sourceMechanicalPower:number; sourceSpatialMomentRate:ReachVec3;
  cutPower:number; surfaceEnergyAdvectionRate:number; viscousDissipationRate:number;
}
const zero=():ReachVec3=>[0,0,0];
const finiteVector=(v:ReachVec3)=>v.length===3&&v.every(Number.isFinite);
const near=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b));
const factorial=[1,1,2,6,24,120,720];
// Exact integrals of products of linear basis functions. Keeping the source,
// transport and energy products under one integral avoids unrelated averages.
function triangleMoment(ids:number[]):number {
  const counts=[0,0,0];ids.forEach(i=>counts[i]++);
  return 2*counts.reduce((p,n)=>p*factorial[n],1)/factorial[ids.length+2];
}
function edgeMoment(ids:number[]):number {
  const counts=[0,0];ids.forEach(i=>counts[i]++);
  return counts.reduce((p,n)=>p*factorial[n],1)/factorial[ids.length+1];
}
function checkLimits(limits:MaterialInletAssemblyLimits):void {
  if(Object.values(limits).some(n=>!Number.isSafeInteger(n)||n<1))throw Error('Invalid inlet assembly capacity');
}

/** Integrate one positive-area temporal sample. Thickness, velocity and mesh
 * velocity are linear on each face; their degree-three products are integrated
 * exactly in space. Temporal and geometry errors are still measured separately. */
export function assembleMaterialInletSample(faces:readonly MaterialInletAssemblyFace[],boundaries:readonly MaterialInletAssemblyBoundary[],limits:MaterialInletAssemblyLimits,law:ReachLaw=WATER_REACH_LAW):MaterialInletAssemblySample {
  checkLimits(limits);
  if(!faces.length||faces.length>limits.faces||boundaries.length>limits.boundaries)throw Error('Inlet assembly capacity or empty sample');
  const ids=[...new Set(faces.flatMap(f=>f.nodeIds))];
  if(ids.length>limits.nodes||ids.some(id=>!Number.isSafeInteger(id)||id<0))throw Error('Invalid inlet assembly node ownership');
  const local=new Map(ids.map((id,i)=>[id,i]));
  validateReachMaterialConnectivity(faces.map(f=>f.nodeIds.map(id=>local.get(id)!) as Triple<number>),ids.length);
  const nodes=new Map<number,MaterialInletAssemblyNode>();
  const edges=new Map<string,{count:number;a:number;b:number;normal:ReachVec3}>();
  const result:MaterialInletAssemblySample={nodes:[],volume:0,momentum:zero(),spatialMoment:zero(),kineticEnergy:0,lumpedKineticEnergy:0,potentialEnergy:0,surfaceEnergy:0,sourceMechanicalPower:0,sourceSpatialMomentRate:zero(),cutPower:0,surfaceEnergyAdvectionRate:0,viscousDissipationRate:0};
  for(const face of faces){
    const {nodeIds,positions,materialVelocities:v,meshVelocities:w,thickness:h}=face;
    if([positions,v,w,h,nodeIds].some(a=>a.length!==3)||![...positions,...v,...w].every(finiteVector)||h.some(x=>x<0||!Number.isFinite(x)))throw Error('Invalid inlet sample field');
    const area=.5*reachLength(reachCross(reachSub(positions[1],positions[0]),reachSub(positions[2],positions[0])));
    const volume=area*(h[0]+h[1]+h[2])/3;
    const physics=reachFaceLaw(positions,v,volume,law);
    const eta=h.map(x=>law.density*x),relative=v.map((u,i)=>reachSub(u,w[i]));
    result.volume+=volume;result.surfaceEnergy+=physics.surfaceEnergy;result.viscousDissipationRate+=physics.dissipationRate;
    for(let a=0;a<3;a++){
      const id=nodeIds[a],existing=nodes.get(id);
      if(existing&&(!existing.position.every((x,i)=>near(x,positions[a][i]))||!existing.velocity.every((x,i)=>near(x,v[a][i]))||!existing.meshVelocity.every((x,i)=>near(x,w[a][i]))))throw Error('Shared inlet node has conflicting trial state');
      const node=existing??{id,position:[...positions[a]],velocity:[...v[a]],meshVelocity:[...w[a]],mass:0,sourceMassRate:0,transportMassRate:0,sourceMomentumRate:zero(),transportMomentumRate:zero(),gravityForce:zero(),membraneForce:zero(),cutForce:zero()};
      const mass=area*eta.reduce((s,e,r)=>s+e*triangleMoment([a,r]),0);
      node.mass+=mass;node.gravityForce=reachAdd(node.gravityForce,reachScale(law.gravity,mass));
      node.membraneForce=reachAdd(node.membraneForce,reachAdd(physics.capillary[a],physics.viscous[a]));
      for(let r=0;r<3;r++)for(let s=0;s<3;s++){
        const transport=area*eta[r]*reachDot(relative[s],physics.gradients[a]);
        node.transportMassRate+=transport*triangleMoment([r,s]);
        for(let t=0;t<3;t++)node.transportMomentumRate=reachAdd(node.transportMomentumRate,reachScale(v[t],transport*triangleMoment([r,s,t])));
      }
      nodes.set(id,node);
      const b=nodeIds[(a+1)%3],key=[Math.min(id,b),Math.max(id,b)].join(':');
      const edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{count:1,a:id,b,normal:physics.normal});
    }
    for(let r=0;r<3;r++)for(let s=0;s<3;s++)for(let t=0;t<3;t++)result.kineticEnergy+=.5*area*eta[r]*reachDot(v[s],v[t])*triangleMoment([r,s,t]);
  }
  const seen=new Set<string>();
  for(const boundary of boundaries){
    const {nodeIds,massRate,velocities}=boundary;
    if(nodeIds.length!==2||massRate.length!==2||velocities.length!==2||!velocities.every(finiteVector)||massRate.some(m=>m<0||!Number.isFinite(m)))throw Error('Invalid source boundary flux');
    const key=[Math.min(...nodeIds),Math.max(...nodeIds)].join(':'),edge=edges.get(key);
    if(!edge||edge.count!==1||seen.has(key))throw Error('Source flux must own a unique exterior inlet edge');seen.add(key);
    const ends=nodeIds.map(id=>nodes.get(id)!);
    if(ends.some((n,i)=>!n.velocity.every((u,k)=>near(u,velocities[i][k]))))throw Error('Source fluid velocity differs from trial inlet velocity');
    const tangent=reachSub(nodes.get(edge.b)!.position,nodes.get(edge.a)!.position),length=reachLength(tangent);
    const conormal=reachCross(reachScale(tangent,1/length),edge.normal);
    const traction=reachScale(conormal,law.surfaceTension*length);
    const matching=faces.find(f=>f.nodeIds.includes(nodeIds[0])&&f.nodeIds.includes(nodeIds[1]))!;
    const mesh= nodeIds.map(id=>matching.meshVelocities[matching.nodeIds.indexOf(id)]);
    for(let a=0;a<2;a++){
      const node=ends[a];node.cutForce=reachAdd(node.cutForce,traction);
      for(let r=0;r<2;r++){
        node.sourceMassRate+=massRate[r]*edgeMoment([a,r]);
        for(let s=0;s<2;s++)node.sourceMomentumRate=reachAdd(node.sourceMomentumRate,reachScale(velocities[s],massRate[r]*edgeMoment([a,r,s])));
      }
      result.cutPower+=reachDot(traction,velocities[a]);
      result.surfaceEnergyAdvectionRate-=reachDot(traction,reachSub(velocities[a],mesh[a]));
    }
    for(let r=0;r<2;r++)for(let s=0;s<2;s++){
      result.sourceSpatialMomentRate=reachAdd(result.sourceSpatialMomentRate,reachScale(ends[s].position,massRate[r]*edgeMoment([r,s])));
      result.sourceMechanicalPower-=massRate[r]*reachDot(law.gravity,ends[s].position)*edgeMoment([r,s]);
      for(let t=0;t<2;t++)result.sourceMechanicalPower+=.5*massRate[r]*reachDot(velocities[s],velocities[t])*edgeMoment([r,s,t]);
    }
  }
  result.nodes=[...nodes.values()];
  for(const n of result.nodes){
    result.momentum=reachAdd(result.momentum,reachScale(n.velocity,n.mass));
    result.spatialMoment=reachAdd(result.spatialMoment,reachScale(n.position,n.mass));
    result.lumpedKineticEnergy+=.5*n.mass*reachDot(n.velocity,n.velocity);
    result.potentialEnergy-=n.mass*reachDot(law.gravity,n.position);
  }
  if(![result.volume,result.kineticEnergy,result.lumpedKineticEnergy,result.potentialEnergy,result.surfaceEnergy,result.sourceMechanicalPower,result.cutPower,result.surfaceEnergyAdvectionRate,result.viscousDissipationRate,...result.momentum,...result.spatialMoment,...result.sourceSpatialMomentRate,...result.nodes.flatMap(n=>[n.mass,n.sourceMassRate,n.transportMassRate,...n.sourceMomentumRate,...n.transportMomentumRate,...n.gravityForce,...n.membraneForce,...n.cutForce])].every(Number.isFinite))throw Error('Nonfinite inlet assembly result');
  return result;
}

export interface MaterialInletAssemblyEndpoint { id:number; mass:number; velocity:ReachVec3 }
/** Integrate one declared interval, retaining the unsatisfied equations for the
 * nonlinear solver. A nonzero residual is never renamed drive force or work. */
export function integrateMaterialInletAssembly(initial:readonly MaterialInletAssemblyEndpoint[],endpoint:readonly MaterialInletAssemblyEndpoint[],samples:readonly {time:number;weight:number;state:MaterialInletAssemblySample}[],start:number,end:number,limits:MaterialInletAssemblyLimits){
  checkLimits(limits);
  const duration=end-start,totalWeight=samples.reduce((s,q)=>s+q.weight,0);
  // Time weights represent the actual interval, including very short ones.
  // A unit-size tolerance would accept almost no water on a tiny interval.
  if(!(duration>0)||![start,end,duration,totalWeight].every(Number.isFinite)||!samples.length||samples.length>limits.samples||Math.abs(totalWeight-duration)>1e-10*duration||samples.some(q=>!(q.time>start&&q.time<end)||!(q.weight>0)||!Number.isFinite(q.weight)))throw Error('Invalid born-material temporal quadrature');
  const validate=(list:readonly MaterialInletAssemblyEndpoint[])=>{if(list.length>limits.nodes||new Set(list.map(n=>n.id)).size!==list.length||list.some(n=>!Number.isSafeInteger(n.id)||n.id<0||n.mass<0||!Number.isFinite(n.mass)||!finiteVector(n.velocity)))throw Error('Invalid inlet endpoint inventory');};
  validate(initial);validate(endpoint);
  const old=new Map(initial.map(n=>[n.id,n])),final=new Map(endpoint.map(n=>[n.id,n]));
  if(initial.some(n=>!final.has(n.id)))throw Error('Inlet assembly cannot silently retire old material');
  const rows=endpoint.map(n=>({id:n.id,massResidual:n.mass-(old.get(n.id)?.mass??0),momentumResidual:reachSub(reachScale(n.velocity,n.mass),reachScale(old.get(n.id)?.velocity??zero(),old.get(n.id)?.mass??0))}));
  const byId=new Map(rows.map(n=>[n.id,n]));
  let sourceMechanicalEnergy=0,cutWork=0,surfaceEnergyAdvection=0,viscousLoss=0;
  for(const {weight,state} of samples){
    for(const n of state.nodes){
      const row=byId.get(n.id);if(!row)throw Error('Temporal sample has unowned endpoint node');
      row.massResidual-=weight*(n.sourceMassRate+n.transportMassRate);
      const rate=reachAdd(reachAdd(n.sourceMomentumRate,n.transportMomentumRate),reachAdd(n.gravityForce,reachAdd(n.membraneForce,n.cutForce)));
      row.momentumResidual=reachSub(row.momentumResidual,reachScale(rate,weight));
    }
    sourceMechanicalEnergy+=weight*state.sourceMechanicalPower;cutWork+=weight*state.cutPower;surfaceEnergyAdvection+=weight*state.surfaceEnergyAdvectionRate;viscousLoss+=weight*state.viscousDissipationRate;
  }
  if(![sourceMechanicalEnergy,cutWork,surfaceEnergyAdvection,viscousLoss,...rows.flatMap(r=>[r.massResidual,...r.momentumResidual])].every(Number.isFinite))throw Error('Nonfinite integrated inlet residual');
  return {rows,sourceMechanicalEnergy,cutWork,surfaceEnergyAdvection,viscousLoss,physicalStepAccepted:false as const};
}

/** Connect the original source-time construction to the actual equations.
 * This measures the born-material increment only. A resident node keeps its
 * supplied state, but its old mass/forces belong to the downstream coupled
 * equation and must be added exactly once by that solver. Nothing is advanced,
 * committed, acknowledged or projected to hide the trial residual here.
 */
export function assembleMaterialInletBirthTrial(birth:MaterialInletBirth,limits:MaterialInletAssemblyLimits,law:ReachLaw=WATER_REACH_LAW,residentStatesAt?:(time:number)=>readonly MaterialInletResidentRow[]) {
  if(law.density!==1000||!law.gravity.every((g,i)=>g===birth.options.gravity[i]))throw Error('Assembly law differs from source birth reconstruction');
  const evaluate=(time:number)=>{
    const evaluation=evaluateMaterialInletBirth(birth,time,residentStatesAt?.(time));
    return {evaluation,state:assembleMaterialInletSample(evaluation.faces,evaluation.boundaries,limits,law)};
  };
  const final=evaluate(birth.intervalEnd);
  const samples=birth.temporalQuadrature.map(q=>({...q,...evaluate(q.time)}));
  const residual=integrateMaterialInletAssembly([],final.state.nodes,samples,birth.intervalStart,birth.intervalEnd,limits);
  const original=birth.originalSource,reconstructed=final.evaluation.source,characteristic=final.evaluation.characteristic;
  return {
    classification:'born-material-residual-only' as const,
    endpoint:final.state,samples,residual,
    sourceReconstructionError:{
      volume:reconstructed.volume-original.volume,
      momentum:reachSub(reconstructed.momentum,original.momentum),
      // All exported spatial defects below are volume moments (m^4), with
      // density conversion explicit at this interface.
      volumePositionMoment:reachSub(reconstructed.positionMoment,original.positionMoment),
      kineticEnergy:reconstructed.kineticEnergy-original.kineticEnergy,
    },
    affineMinusCharacteristicVolumeMoment:reachSub(reachScale(final.state.spatialMoment,1/law.density),characteristic.positionMoment),
    representedMinusCharacteristicMomentum:reachSub(final.state.momentum,characteristic.momentum),
    fieldMinusCharacteristicKineticEnergy:final.state.kineticEnergy-characteristic.kineticEnergy,
    diagonalMinusFieldKineticEnergy:final.state.lumpedKineticEnergy-final.state.kineticEnergy,
    // This raw defect includes the affine geometry/lumping errors and trial
    // dynamics. It is not manufactured inlet work or a solver acceptance.
    mechanicalEnergyResidual:final.state.kineticEnergy+final.state.potentialEnergy+final.state.surfaceEnergy-residual.sourceMechanicalEnergy-residual.cutWork-residual.surfaceEnergyAdvection+residual.viscousLoss,
    physicalStepAccepted:false as const,
  };
}
