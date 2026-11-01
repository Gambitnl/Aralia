/** CPU reference for a single monolithic resident-plus-inlet interval. Radau
 * stages use global consistent momentum Mv, compatible curved geometry and
 * measured constraint reactions. Accepted collars freeze their material map;
 * the next interval shares actual resident DOFs without ballistic overwrite.
 * This bounded reference is neither the legacy GPU path nor native acceptance.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 11/10/2026, 18:50:38
 * Dependents: None (Orphan)
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {MaterialPortInput} from './waterfallMaterialReachPort';
import {reachAdd as add,reachSub as sub,reachScale as scale,reachDot as dot,reachLength as length,type ReachVec3} from './waterfallMaterialReach';
import {assembleMaterialCollar,prepareMaterialCollar,collarMultiply,collarVectors,collarLocalMass,collarCoordinateDerivative,collarSourceKeys,type CollarState,type CollarPrepared,type CollarLaw,type CollarLimits,type CollarAssembly} from './waterfallMaterialCollar';
export const COLLAR_FIXED_POLICY=Object.freeze({maximumNewtonIterations:20,maximumBacktrackingHalvings:8,scaledResidualTolerance:1e-9,jacobianDifference:1e-7,maximumKnownLossFraction:.05,creationArithmeticFactor:65536});
const A=[[5/12,-1/12],[3/4,1/4]],AI=[[1.5,.5],[-4.5,2.5]],B=[3/4,1/4],T=[1/3,1];
const z=():ReachVec3=>[0,0,0];
export interface CollarStageResult {
  prepared:CollarPrepared;next:CollarState;stages:{time:number;q:ReachVec3[];v:ReachVec3[];operator:CollarAssembly;row2Reactions:ReachVec3[];row3Reactions:ReachVec3[]}[];
  receipt:{classification:'cpu-coupled-reference';iterations:number;scaledResidual:number;positionScale:number;velocityScale:number;momentumScale:number;volumeError:number;sourceMomentumError:ReachVec3;sourceSpatialMomentError:ReachVec3;gclError:number;cutFluxError:number;energyResidual:number;energyCreationAllowance:number;arithmeticEnergyAllowance:number;residualWorkAllowance:number;absoluteEnergySummands:number;positiveAvailableEnergy:number;knownLossAllowance:number;sourceProjectionKineticDifference:number;nodalProjectionKineticDifference:number;row2ReactionImpulse:ReachVec3;row3ReactionImpulse:ReachVec3;row2ReactionWork:number;row3ReactionWork:number;cutWork:number;surfaceAdvection:number;viscousLoss:number;originalVolume:number;originalMomentum:ReachVec3;originalSpatialMoment:ReachVec3;originalTimeMoment:number;sourceFieldKinetic:number;originalKinetic:number;materialVolumeQualified:true;finiteUnionVolumeQualified:false};
}
export interface CollarSolveDiagnostic {phase:'prepared'|'initial'|'iteration'|'candidate';iterations:number;scaledResidual?:number;initial:CollarState;originalIds:string[];stages?:{time:number;q:ReachVec3[];v:ReachVec3[];p:ReachVec3[];operator:CollarAssembly}[];candidate?:Record<string,unknown>}
export class CollarSolveFailure extends Error {constructor(message:string,readonly diagnostic:CollarSolveDiagnostic|null){super(message);this.name='CollarSolveFailure';}}
function assertDeadline(deadline:number){if(performance.now()>deadline)throw Error('Collar inclusive CPU runtime cap');}
function solveLinear(matrix:number[][],rhs:number[]):number[]{
  const a=matrix.map((r,k)=>[...r,rhs[k]]),n=rhs.length,maximum=Math.max(...matrix.flat().map(Math.abs));
  for(let k=0;k<n;k++){let pivot=k;for(let j=k+1;j<n;j++)if(Math.abs(a[j][k])>Math.abs(a[pivot][k]))pivot=j;
    if(!(Math.abs(a[pivot][k])>1e-14*maximum))throw Error('Singular coupled collar Jacobian');
    [a[k],a[pivot]]=[a[pivot],a[k]];for(let i=k+1;i<n;i++){const f=a[i][k]/a[k][k];a[i][k]=0;for(let j=k+1;j<=n;j++)a[i][j]-=f*a[k][j];}}
  const x=Array(n).fill(0);for(let i=n-1;i>=0;i--){let sum=a[i][n];for(let j=i+1;j<n;j++)sum-=a[i][j]*x[j];x[i]=sum/a[i][i];}return x;
}
const maximum=(r:number[])=>Math.max(...r.map(Math.abs));
/** Positive definiteness is checked on the actual active global mass matrix.
 * A row sum is not physical inertia, and no eigenvalue/mass floor is inserted. */
function requirePositiveMass(M:number[][]){const n=M.length,L=M.map(()=>Array(n).fill(0));for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let d=M[i][j];for(let k=0;k<j;k++)d-=L[i][k]*L[j][k];if(i===j){if(!(d>0)||!Number.isFinite(d))throw Error('Singular active consistent collar mass');L[i][j]=Math.sqrt(d);}else L[i][j]=d/L[j][j];}}

/** Solve once with the frozen policy. Failures leave the caller's state and
 * originals intact. No changed timestep, basis or second packet is attempted. */
export function solveMaterialCollar(prepared:CollarPrepared,law:CollarLaw,deadline:number,onDiagnostic?:(diagnostic:CollarSolveDiagnostic)=>void):CollarStageResult {
  let last:CollarSolveDiagnostic|null={phase:'prepared',iterations:0,initial:structuredClone(prepared.initial),originalIds:prepared.originals.map(i=>i.releaseId)};
  const report=(d:CollarSolveDiagnostic)=>{last=structuredClone(d);onDiagnostic?.(structuredClone(d));};
  try{return solveCollarInternal(prepared,law,deadline,report);}catch(error){throw new CollarSolveFailure(error instanceof Error?error.message:String(error),last);}
}
function solveCollarInternal(prepared:CollarPrepared,law:CollarLaw,deadline:number,onDiagnostic:(diagnostic:CollarSolveDiagnostic)=>void):CollarStageResult {
  assertDeadline(deadline);const initial=prepared.initial,dt=prepared.end-prepared.start,n=initial.q.length;
  const constrainedQ=new Set(prepared.cutRows.flatMap(r=>[r.ids[2],r.ids[3]])),constrainedV=new Set(prepared.cutRows.map(r=>r.ids[3]));
  const qUnknown=initial.q.map((_,i)=>i).filter(i=>!constrainedQ.has(i)),vUnknown=initial.q.map((_,i)=>i).filter(i=>!constrainedV.has(i)),qRows=initial.q.map((_,i)=>i).filter(i=>!constrainedV.has(i)),pRows=initial.q.map((_,i)=>i).filter(i=>!constrainedQ.has(i));
  const incoming=prepared.originals.reduce((s,i)=>s+i.outflow.volume,0),residentVolume=initial.panels.reduce((s,p)=>s+p.duration*(p.beta[0]+p.beta[1])/2,0);
  const span=Math.max(...prepared.panels.filter(p=>!p.frozen).map(p=>length(sub(p.cut[1],p.cut[0])))),velocityScale=Math.max(1e-3,...initial.v.map(length),...prepared.cutRows.map(r=>length(r.u)),length(law.gravity)*dt),positionScale=Math.max(1e-3,span,velocityScale*dt,length(law.gravity)*dt*dt),momentumScale=law.density*(incoming+residentVolume)*velocityScale/n;
  if(!(momentumScale>0))throw Error('Empty coupled collar inertia');
  const prior=initial.panels.length?assembleMaterialCollar(initial.panels,initial.q,initial.v,prepared.start,law):null,pn=prior?collarMultiply(prior.M,initial.v):collarVectors(n);
  // Frozen resident matrix has zeros on newly collapsed controls.
  const stride=3*(qUnknown.length+vUnknown.length),guess:number[]=[];
  for(const fraction of T){const age=dt*fraction,q=initial.q.map((p,id)=>add(add(p,scale(initial.v[id],age)),scale(law.gravity,.5*age*age))),v=initial.v.map(u=>add(u,scale(law.gravity,age)));
    for(const row of prepared.cutRows)for(let j=0;j<4;j++){const id=row.ids[j];if(j===0&&initial.panels.length)continue;const f=1-j/3,gravityCoefficient=j===0?.5:j===1?1/6:0;q[id]=add(add(row.c,scale(row.u,age*f)),scale(law.gravity,age*age*gravityCoefficient));v[id]=add(row.u,scale(law.gravity,age*f));}
    for(const id of qUnknown)for(let k=0;k<3;k++)guess.push((q[id][k]-initial.q[id][k])/positionScale);for(const id of vUnknown)for(let k=0;k<3;k++)guess.push(v[id][k]/velocityScale);}
  const evaluate=(x:number[])=>{
    assertDeadline(deadline);const stages=T.map((fraction,stage)=>{let offset=stage*stride;const age=fraction*dt,q=initial.q.map(p=>[...p] as ReachVec3),v=collarVectors(n);
      for(const id of qUnknown)for(let k=0;k<3;k++)q[id][k]+=x[offset++]*positionScale;for(const id of vUnknown)for(let k=0;k<3;k++)v[id][k]=x[offset++]*velocityScale;
      for(const row of prepared.cutRows){q[row.ids[2]]=add(row.c,scale(row.u,age/3));q[row.ids[3]]=[...row.c];v[row.ids[3]]=[...row.u];}
      const operator=assembleMaterialCollar(prepared.panels,q,v,prepared.start+age,law);requirePositiveMass(operator.M);
      const kq=collarVectors(n);for(const panel of prepared.panels.filter(p=>!p.frozen)){const local=collarCoordinateDerivative(panel.ids.map(id=>q[id]),age);panel.ids.forEach((id,k)=>{if(k%4!==0)kq[id]=local[k];});}
      const qdot=v.map((u,id)=>sub(u,kq[id])),p=collarMultiply(operator.M,v),transport=operator.C[0].map((_,id)=>operator.C.reduce<ReachVec3>((sum,row,j)=>add(sum,scale(v[j],row[id])),z())),rhs=operator.force.map((force,id)=>add(add(force,transport[id]),operator.sourceMomentum[id]));
      return {time:prepared.start+age,q,v,p,qdot,rhs,operator};});
    const residual:number[]=[];for(let stage=0;stage<2;stage++){for(const id of qRows)for(let k=0;k<3;k++)residual.push((stages[stage].q[id][k]-initial.q[id][k]-dt*(A[stage][0]*stages[0].qdot[id][k]+A[stage][1]*stages[1].qdot[id][k]))/positionScale);for(const id of pRows)for(let k=0;k<3;k++)residual.push((stages[stage].p[id][k]-pn[id][k]-dt*(A[stage][0]*stages[0].rhs[id][k]+A[stage][1]*stages[1].rhs[id][k]))/momentumScale);}
    if(residual.length!==x.length||residual.some(r=>!Number.isFinite(r)))throw Error('Invalid coupled collar residual');return {stages,residual};
  };
  let x=guess,current=evaluate(x),iterations=0;
  const report=(phase:CollarSolveDiagnostic['phase'],candidate?:Record<string,unknown>)=>{onDiagnostic({phase,iterations,scaledResidual:maximum(current.residual),initial,originalIds:prepared.originals.map(i=>i.releaseId),stages:current.stages,candidate});assertDeadline(deadline);};
  report('initial');
  while(maximum(current.residual)>COLLAR_FIXED_POLICY.scaledResidualTolerance){
    if(iterations++>=COLLAR_FIXED_POLICY.maximumNewtonIterations)throw Error('Coupled collar Newton iteration cap');
    const J=current.residual.map(()=>Array(x.length).fill(0));for(let j=0;j<x.length;j++){assertDeadline(deadline);const h=COLLAR_FIXED_POLICY.jacobianDifference*Math.max(1,Math.abs(x[j])),trial=x.slice();trial[j]+=h;const r=evaluate(trial).residual;for(let i=0;i<r.length;i++)J[i][j]=(r[i]-current.residual[i])/h;}
    const direction=solveLinear(J,current.residual.map(r=>-r));let accepted=false;
    for(let half=0;half<=COLLAR_FIXED_POLICY.maximumBacktrackingHalvings;half++){const trial=x.map((value,j)=>value+direction[j]*2**-half);try{const next=evaluate(trial);if(maximum(next.residual)<maximum(current.residual)){x=trial;current=next;accepted=true;break;}}catch(error){if(performance.now()>deadline)throw error;}}
    if(!accepted)throw Error('Coupled collar fixed line search rejected');
    report('iteration');
  }
  const stages=current.stages.map((stage,i)=>{const row2Reactions=collarVectors(n),row3Reactions=collarVectors(n);for(const row of prepared.cutRows)for(const j of [2,3]){const id=row.ids[j],derivative=scale(add(scale(sub(current.stages[0].p[id],pn[id]),AI[i][0]),scale(sub(current.stages[1].p[id],pn[id]),AI[i][1])),1/dt),reaction=sub(derivative,stage.rhs[id]);(j===2?row2Reactions:row3Reactions)[id]=reaction;}return {...stage,row2Reactions,row3Reactions};});
  let row2ReactionImpulse=z(),row3ReactionImpulse=z(),row2ReactionWork=0,row3ReactionWork=0,cutWork=0,surfaceAdvection=0,viscousLoss=0,Ein=0,EinK=0,EinPE=0,sourceFieldKinetic=0;
  stages.forEach((stage,i)=>{const w=dt*B[i];cutWork+=w*stage.operator.cutPower;surfaceAdvection+=w*stage.operator.surfaceAdvectionPower;viscousLoss+=w*2*stage.operator.rayleigh;Ein+=w*stage.operator.sourceMechanicalPower;EinK+=w*stage.operator.sourceKineticPower;EinPE+=w*stage.operator.sourcePotentialPower;for(let id=0;id<n;id++){row2ReactionImpulse=add(row2ReactionImpulse,scale(stage.row2Reactions[id],w));row3ReactionImpulse=add(row3ReactionImpulse,scale(stage.row3Reactions[id],w));row2ReactionWork+=w*dot(stage.row2Reactions[id],stage.v[id]);row3ReactionWork+=w*dot(stage.row3Reactions[id],stage.v[id]);}});
  const end=stages[1].operator,initialEnergy=prior?prior.kinetic+prior.potential+prior.surface:0,finalEnergy=end.kinetic+end.potential+end.surface,energyResidual=finalEnergy-initialEnergy-Ein-cutWork-surfaceAdvection-row2ReactionWork-row3ReactionWork+viscousLoss;
  // Recover physical stage defects, not scaled Newton residuals or per-stage
  // backward-Euler quotients. Their work only bounds unresolved equations;
  // Radau time error and curved quadrature error receive no creation allowance.
  const Rq=stages.map((stage,i)=>stage.q.map((q,id)=>sub(sub(q,initial.q[id]),scale(add(scale(stages[0].qdot[id],A[i][0]),scale(stages[1].qdot[id],A[i][1])),dt))));
  const fullRhs=stages.map(stage=>stage.rhs.map((rhs,id)=>add(add(rhs,stage.row2Reactions[id]),stage.row3Reactions[id])));
  const Rp=stages.map((stage,i)=>stage.p.map((p,id)=>sub(sub(p,pn[id]),scale(add(scale(fullRhs[0][id],A[i][0]),scale(fullRhs[1][id],A[i][1])),dt))));
  let residualWorkAllowance=0,absoluteStageEnergy=0;stages.forEach((stage,i)=>{const w=dt*B[i];absoluteStageEnergy+=w*(Math.abs(stage.operator.sourceKineticPower)+Math.abs(stage.operator.sourcePotentialPower)+Math.abs(stage.operator.cutPower)+Math.abs(stage.operator.surfaceAdvectionPower)+2*stage.operator.rayleigh);for(let id=0;id<n;id++){const eq=scale(add(scale(Rq[0][id],AI[i][0]),scale(Rq[1][id],AI[i][1])),1/dt),ep=scale(add(scale(Rp[0][id],AI[i][0]),scale(Rp[1][id],AI[i][1])),1/dt);residualWorkAllowance+=w*(length(stage.v[id])*length(ep)+length(add(stage.operator.capillary[id],stage.operator.gravity[id]))*length(eq));absoluteStageEnergy+=w*(Math.abs(dot(stage.row2Reactions[id],stage.v[id]))+Math.abs(dot(stage.row3Reactions[id],stage.v[id])));}});
  const absoluteEnergySummands=(prior?Math.abs(prior.kinetic)+Math.abs(prior.potential)+Math.abs(prior.surface):0)+Math.abs(end.kinetic)+Math.abs(end.potential)+Math.abs(end.surface)+absoluteStageEnergy;
  const arithmeticEnergyAllowance=COLLAR_FIXED_POLICY.creationArithmeticFactor*Number.EPSILON*absoluteEnergySummands,energyCreationAllowance=arithmeticEnergyAllowance+residualWorkAllowance;
  // Declared positive availability includes each positive energy/work input
  // separately, before dissipation. It never authorizes a positive residual.
  const positiveAvailableEnergy=(prior?prior.kinetic+Math.max(0,prior.potential)+prior.surface:0)+EinK+Math.max(0,EinPE)+Math.max(0,cutWork)+Math.max(0,surfaceAdvection)+Math.max(0,row2ReactionWork)+Math.max(0,row3ReactionWork),knownLossAllowance=COLLAR_FIXED_POLICY.maximumKnownLossFraction*positiveAvailableEnergy;
  const originalMomentum=prepared.originals.reduce((p,i)=>add(p,i.outflow.momentum),z()),originalSpatialMoment=prepared.originals.reduce((p,i)=>add(p,scale(add(i.outflow.start,i.outflow.end),i.outflow.volume/2)),z()),originalTimeMoment=prepared.originals.reduce((s,i)=>s+i.outflow.volume*(i.outflow.intervalStart+i.outflow.intervalEnd)/2,0),originalKinetic=prepared.originals.reduce((s,i)=>s+.5*law.density*i.outflow.volume*dot(i.outflow.velocity,i.outflow.velocity),0);
  let projectedMomentum=z(),projectedSpatial=z();for(const panel of prepared.panels.filter(p=>!p.frozen)){const b0=panel.beta[0],b1=panel.beta[1],u0=panel.velocity[0],u1=panel.velocity[1];projectedMomentum=add(projectedMomentum,scale(add(scale(u0,2*b0+b1),scale(u1,b0+2*b1)),law.density*dt/6));projectedSpatial=add(projectedSpatial,scale(add(scale(panel.cut[0],2*b0+b1),scale(panel.cut[1],b0+2*b1)),dt/6));const du=sub(u1,u0),db=b1-b0;sourceFieldKinetic+=.5*law.density*dt*(b0*dot(u0,u0)+(2*b0*dot(u0,du)+db*dot(u0,u0))/2+(b0*dot(du,du)+2*db*dot(u0,du))/3+db*dot(du,du)/4);}
  const volumeError=end.volume-residentVolume-incoming,sourceMomentumError=sub(projectedMomentum,originalMomentum),sourceSpatialMomentError=sub(projectedSpatial,originalSpatialMoment),gclError=Math.max(...stages.map(s=>s.operator.gclError)),cutFluxError=Math.max(...stages.map(s=>s.operator.cutFluxError));
  report('candidate',{volumeError,sourceMomentumError,sourceSpatialMomentError,gclError,cutFluxError,energyResidual,energyCreationAllowance,arithmeticEnergyAllowance,residualWorkAllowance,absoluteEnergySummands,positiveAvailableEnergy,knownLossAllowance,originalKinetic,sourceFieldKinetic,sourceProjectionKineticDifference:originalKinetic-sourceFieldKinetic,row2ReactionImpulse,row3ReactionImpulse,row2ReactionWork,row3ReactionWork,cutWork,surfaceAdvection,viscousLoss,EinK,EinPE,stages});
  const arithmetic=512*Number.EPSILON;if(Math.abs(volumeError)>arithmetic*(residentVolume+incoming)||length(sourceMomentumError)>arithmetic*Math.max(Number.MIN_VALUE,length(originalMomentum))||length(sourceSpatialMomentError)>arithmetic*Math.max(Number.MIN_VALUE,length(originalSpatialMoment))||gclError>arithmetic*Math.max(...end.Mdot.flat().map(Math.abs),Number.MIN_VALUE)||cutFluxError>arithmetic*Math.max(...prepared.panels.map(p=>Math.max(...p.beta))))throw Error('Collar mass/source/GCL/trace arithmetic gate');
  if(energyResidual>energyCreationAllowance||-energyResidual>knownLossAllowance+energyCreationAllowance)throw Error(`Collar energy gate: residual=${energyResidual}; creation=${energyCreationAllowance}; loss=${knownLossAllowance}`);
  const next:CollarState={time:prepared.end,q:structuredClone(stages[1].q),v:structuredClone(stages[1].v),panels:prepared.panels.map(p=>p.frozen?structuredClone(p):{...structuredClone(p),frozen:true,frozenMass:collarLocalMass(p.beta,p.duration,law.density).M}),originals:[...structuredClone(initial.originals),...structuredClone(prepared.originals)],lastCut:{positions:prepared.cutRows.map(r=>[...r.c]),ids:prepared.cutRows.map(r=>r.ids[3]),keys:collarSourceKeys(prepared.originals,prepared.projection)}};
  assertDeadline(deadline);return {prepared,next,stages,receipt:{classification:'cpu-coupled-reference',iterations,scaledResidual:maximum(current.residual),positionScale,velocityScale,momentumScale,volumeError,sourceMomentumError,sourceSpatialMomentError,gclError,cutFluxError,energyResidual,energyCreationAllowance,arithmeticEnergyAllowance,residualWorkAllowance,absoluteEnergySummands,positiveAvailableEnergy,knownLossAllowance,sourceProjectionKineticDifference:originalKinetic-sourceFieldKinetic,nodalProjectionKineticDifference:prepared.projection.receipt.signedKineticMixingLoss,row2ReactionImpulse,row3ReactionImpulse,row2ReactionWork,row3ReactionWork,cutWork,surfaceAdvection,viscousLoss,originalVolume:incoming,originalMomentum,originalSpatialMoment,originalTimeMoment,sourceFieldKinetic,originalKinetic,materialVolumeQualified:true,finiteUnionVolumeQualified:false}};
}

/** The caller commits a complete reviewed source epoch before debiting Film.
 * Failed staging never changes this state or the caller's original records. */
export class MaterialCollarOwner {
  private owned:CollarState;private pending:{result:CollarStageResult;next:CollarState}|null=null;
  constructor(time:number,readonly law:CollarLaw,readonly limits:CollarLimits){if(!Number.isFinite(time))throw Error('Invalid collar clock');this.owned={time,q:[],v:[],panels:[],originals:[]};}
  get state(){return structuredClone(this.owned);}
  checkpoint(){return this.state;}
  restore(state:CollarState){this.owned=structuredClone(state);this.pending=null;}
  stage(inputs:readonly MaterialPortInput[],deadline:number,onDiagnostic?:(diagnostic:CollarSolveDiagnostic)=>void){if(this.pending)throw Error('Pending collar epoch');const p=prepareMaterialCollar(this.owned,inputs,this.limits),result=solveMaterialCollar(p,this.law,deadline,onDiagnostic);this.pending={result,next:structuredClone(result.next)};return result;}
  commit(result:CollarStageResult){if(!this.pending||result!==this.pending.result)throw Error('Unowned collar epoch');this.owned=structuredClone(this.pending.next);this.pending=null;}
  rollback(){this.pending=null;}
}
