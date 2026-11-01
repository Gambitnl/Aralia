/** Curved source collars share one geometry, compatible velocity and consistent
 * inertia operator. Positive quadrature measures original incoming water; it
 * does not invent a startup reservoir or use the flat GPU membrane kernel.
 * The CPU stage solver owns acceptance. This module only evaluates its fields,
 * forces and source constraints, including the full curved area gradient.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/10/2026, 18:50:38
 * Dependents: systems/world3d/river/waterfallMaterialCollarSolve.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {MaterialPortInput} from './waterfallMaterialReachPort';
import {projectFilmStreamSupplyingEdge,type StreamInletEdgeProjection} from './waterfallMaterialStreamInlet';
import {reachAdd as add,reachSub as sub,reachScale as scale,reachDot as dot,reachCross as cross,reachLength as length,type ReachVec3} from './waterfallMaterialReach';
export type CollarMatrix=number[][];
export interface CollarLaw {density:number;gravity:ReachVec3;surfaceTension:number;dynamicViscosity:number}
export interface CollarLimits {records:number;nodes:number;panels:number}
export interface CollarPanel {
  /** Local order is s-endpoint then birth row: (0,0)..(0,3),(1,0)..(1,3). */
  ids:number[];beta:[number,number];duration:number;start:number;
  frozen:boolean;releaseId:string;cut:[ReachVec3,ReachVec3];velocity:[ReachVec3,ReachVec3];
  /** Retained consistent material matrix once this panel becomes resident. */
  frozenMass?:CollarMatrix;
}
export interface CollarState {time:number;q:ReachVec3[];v:ReachVec3[];panels:CollarPanel[];originals:MaterialPortInput[];lastCut?:{positions:ReachVec3[];ids:number[];keys:string[]}}
export interface CollarPrepared {initial:CollarState;panels:CollarPanel[];originals:MaterialPortInput[];projection:StreamInletEdgeProjection;start:number;end:number;cutRows:{ids:[number,number,number,number];c:ReachVec3;u:ReachVec3}[]}
export interface CollarAssembly {
  M:CollarMatrix;C:CollarMatrix;Mdot:CollarMatrix;Bin:CollarMatrix;
  force:ReachVec3[];capillary:ReachVec3[];viscous:ReachVec3[];gravity:ReachVec3[];cut:ReachVec3[];sourceMomentum:ReachVec3[];
  sourceMassRate:number;volume:number;momentum:ReachVec3;volumeMoment:ReachVec3;
  kinetic:number;potential:number;surface:number;rayleigh:number;cutPower:number;surfaceAdvectionPower:number;sourceMechanicalPower:number;
  sourceKineticPower:number;sourcePotentialPower:number;minimumJacobian:number;maximumThickness:number;cutFluxError:number;gclError:number;
}
const z=():ReachVec3=>[0,0,0];
export const collarMatrix=(n:number):CollarMatrix=>Array.from({length:n},()=>Array(n).fill(0));
export const collarVectors=(n:number):ReachVec3[]=>Array.from({length:n},z);
export function collarMultiply(M:CollarMatrix,v:ReachVec3[]):ReachVec3[]{return M.map(row=>row.reduce((sum,m,j)=>add(sum,scale(v[j],m)),z()));}
export const COLLAR_GAUSS=[
  {x:.06943184420297371,w:.17392742256872692},{x:.33000947820757187,w:.32607257743127305},
  {x:.6699905217924281,w:.32607257743127305},{x:.9305681557970262,w:.17392742256872692},
];
export function collarBasis(s:number,r:number){
  const b=[(1-r)**3,3*r*(1-r)**2,3*r*r*(1-r),r**3],d=[-3*(1-r)**2,3*(1-r)*(1-3*r),3*r*(2-3*r),3*r*r];
  return {N:[...b.map(x=>(1-s)*x),...b.map(x=>s*x)],Ns:[...b.map(x=>-x),...b],Nr:[...d.map(x=>(1-s)*x),...d.map(x=>s*x)]};
}
/** Coefficient representation of -r/age partial_r; never called at age zero. */
export function collarCoordinateDerivative(q:ReachVec3[],age:number):ReachVec3[]{
  if(!(age>0)||q.length!==8)throw Error('Collar coordinate operator needs positive age');
  return q.map((p,k)=>k%4===0?z():scale(sub(q[k-1],p),(k%4)/age));
}
export function collarLocalMass(beta:[number,number],measureAge:number,density:number){
  const M=collarMatrix(8),C=collarMatrix(8),Mdot=collarMatrix(8),Bin=collarMatrix(8);
  for(const s of COLLAR_GAUSS)for(const r of COLLAR_GAUSS){const b=collarBasis(s.x,r.x),flux=density*(beta[0]*(1-s.x)+beta[1]*s.x)*s.w*r.w;
    for(let a=0;a<8;a++)for(let c=0;c<8;c++){M[a][c]+=measureAge*flux*b.N[a]*b.N[c];Mdot[a][c]+=flux*b.N[a]*b.N[c];C[a][c]-=flux*b.N[a]*r.x*b.Nr[c];}}
  for(const s of COLLAR_GAUSS){const b=collarBasis(s.x,1),flux=density*(beta[0]*(1-s.x)+beta[1]*s.x)*s.w;for(let a=0;a<8;a++)for(let c=0;c<8;c++)Bin[a][c]+=flux*b.N[a]*b.N[c];}
  return {M,C,Mdot,Bin};
}
const combine=(coeff:number[],vectors:ReachVec3[])=>coeff.reduce((p,n,k)=>add(p,scale(vectors[k],n)),z());
const finite=(v:ReachVec3)=>v.length===3&&v.every(Number.isFinite);
/** Source topology uses explicit original surface/edge bed coordinates, not
 * proximity between arbitrary world points. Projection displacement is retained. */
export function collarSourceKeys(inputs:readonly MaterialPortInput[],projection:StreamInletEdgeProjection):string[]{
  const keys:string[][]=projection.nodes.map(()=>[]);
  for(const seg of projection.segments){const p=inputs.find(i=>i.releaseId===seg.releaseId)!.outflow,o=p.origin!;
    seg.nodes.forEach((id,k)=>{keys[id].push(JSON.stringify([o.surfaceId,o.geometryIdentity,o.edge,p.face,k]));});}
  return keys.map(k=>k.sort().join('|'));
}
/** Prepare immutable originals and collapsed new rows. No inverse mass or
 * normal is evaluated at birth. Resident positions, velocities and IDs persist. */
export function prepareMaterialCollar(state:CollarState,inputs:readonly MaterialPortInput[],limits:CollarLimits):CollarPrepared {
  if(!inputs.length||Object.values(limits).some(n=>!Number.isSafeInteger(n)||n<1))throw Error('Invalid collar capacity or source-off');
  const originals=structuredClone([...inputs]),start=originals[0].outflow.intervalStart,end=originals[0].outflow.intervalEnd;
  if(start!==state.time||!(end>start)||originals.some(i=>i.outflow.intervalStart!==start||i.outflow.intervalEnd!==end||i.cut.kind!=='stationary'||length(i.cut.velocity)!==0))throw Error('Collar requires consecutive stationary original intervals');
  if(new Set([...state.originals,...originals].map(i=>i.releaseId)).size!==state.originals.length+originals.length)throw Error('Duplicate original collar ownership');
  const projection=projectFilmStreamSupplyingEdge(originals,limits.records,limits.nodes),keys=collarSourceKeys(originals,projection);
  const initial=structuredClone(state),cutRows:CollarPrepared['cutRows']=[],newPanels:CollarPanel[]=[];
  if(state.lastCut&&(state.lastCut.keys.length!==keys.length||keys.some((key,k)=>key!==state.lastCut!.keys[k])))throw Error('Supplying topology discontinuity: no bridging');
  projection.nodes.forEach((node,k)=>{
    const prior=state.lastCut?.ids[k];
    if(prior!==undefined&&length(sub(initial.q[prior],node.position))>1e-10)throw Error('Supplying centroid discontinuity: no resident overwrite');
    const id0=prior??initial.q.length;if(prior===undefined){initial.q.push([...node.position]);initial.v.push(z());}
    const ids:[number,number,number,number]=[id0,initial.q.length,initial.q.length+1,initial.q.length+2];
    for(let row=1;row<4;row++){initial.q.push([...node.position]);initial.v.push(z());}
    cutRows.push({ids,c:[...node.position],u:[...node.velocity]});
  });
  for(const seg of projection.segments){const p=originals.find(i=>i.releaseId===seg.releaseId)!.outflow,[a,b]=seg.nodes;
    if(length(cross(sub(projection.nodes[b].position,projection.nodes[a].position),projection.nodes[a].velocity))===0||length(cross(sub(projection.nodes[b].position,projection.nodes[a].position),projection.nodes[b].velocity))===0)throw Error('Positive supply has no transverse collar image');
    newPanels.push({ids:[...cutRows[a].ids,...cutRows[b].ids],beta:[p.volume/(end-start),p.volume/(end-start)],start,duration:end-start,frozen:false,releaseId:seg.releaseId,cut:[cutRows[a].c,cutRows[b].c],velocity:[cutRows[a].u,cutRows[b].u]});
  }
  if(initial.q.length>limits.nodes||state.panels.length+newPanels.length>limits.panels||state.originals.length+originals.length>limits.records)throw Error('Collar retained capacity exceeded');
  return {initial,panels:[...initial.panels,...newPanels],originals,projection,start,end,cutRows};
}

/** All curved forces and energies use this same fixed positive rule. Consistent
 * M is physical inertia; its positive row sum is never substituted for M. */
export function assembleMaterialCollar(panels:readonly CollarPanel[],q:ReachVec3[],v:ReachVec3[],time:number,law:CollarLaw):CollarAssembly {
  if(q.length!==v.length||![...q,...v].every(finite)||!Number.isFinite(time)||!(law.density>0)||law.surfaceTension<0||law.dynamicViscosity<0||![law.density,law.surfaceTension,law.dynamicViscosity,...law.gravity].every(Number.isFinite))throw Error('Invalid collar stage');
  const n=q.length,M=collarMatrix(n),C=collarMatrix(n),Mdot=collarMatrix(n),Bin=collarMatrix(n),capillary=collarVectors(n),viscous=collarVectors(n),gravity=collarVectors(n),cut=collarVectors(n),sourceMomentum=collarVectors(n);
  const result:CollarAssembly={M,C,Mdot,Bin,force:collarVectors(n),capillary,viscous,gravity,cut,sourceMomentum,sourceMassRate:0,volume:0,momentum:z(),volumeMoment:z(),kinetic:0,potential:0,surface:0,rayleigh:0,cutPower:0,surfaceAdvectionPower:0,sourceMechanicalPower:0,sourceKineticPower:0,sourcePotentialPower:0,minimumJacobian:Infinity,maximumThickness:0,cutFluxError:0,gclError:0};
  for(const panel of panels){
    const age=panel.frozen?panel.duration:time-panel.start;if(!(age>0)||panel.ids.length!==8)throw Error('No zero-age collar force or inverse mass');
    const localQ=panel.ids.map(id=>q[id]),localV=panel.ids.map(id=>v[id]),operator=collarLocalMass(panel.beta,age,law.density),localM=panel.frozen?panel.frozenMass!:operator.M;
    if(!localM||localM.length!==8)throw Error('Resident collar lacks frozen consistent mass');
    for(let a=0;a<8;a++)for(let b=0;b<8;b++){M[panel.ids[a]][panel.ids[b]]+=localM[a][b];if(!panel.frozen){C[panel.ids[a]][panel.ids[b]]+=operator.C[a][b];Mdot[panel.ids[a]][panel.ids[b]]+=operator.Mdot[a][b];Bin[panel.ids[a]][panel.ids[b]]+=operator.Bin[a][b];}}
    // Subtract each s-endpoint's cut before differentiating in r, and factor
    // positive age. No division of a collapsed zero-age world-coordinate chord.
    const relative=localQ.map((p,k)=>scale(sub(p,panel.cut[k<4?0:1]),1/age));
    for(const s of COLLAR_GAUSS)for(const r of COLLAR_GAUSS){
      const basis=collarBasis(s.x,r.x),Xs=combine(basis.Ns,localQ),Xr=scale(combine(basis.Nr,relative),age),X=combine(basis.N,localQ),U=combine(basis.N,localV),Us=combine(basis.Ns,localV),Ur=combine(basis.Nr,localV),cr=cross(Xs,Xr),J=length(cr),w=s.w*r.w,beta=panel.beta[0]*(1-s.x)+panel.beta[1]*s.x,measure=age*beta;
      if(!(J>0)||!Number.isFinite(J))throw Error('Invalid active curved collar geometry');
      const normal=scale(cr,1/J),h=measure/J,g00=dot(Xs,Xs),g01=dot(Xs,Xr),g11=dot(Xr,Xr),det=g00*g11-g01*g01;
      if(!(det>0)||!Number.isFinite(h))throw Error('Singular curved collar metric');
      result.minimumJacobian=Math.min(result.minimumJacobian,J);result.maximumThickness=Math.max(result.maximumThickness,h);
      const i00=g11/det,i01=-g01/det,i11=g00/det,d00=dot(Xs,Us),d01=.5*(dot(Xs,Ur)+dot(Xr,Us)),d11=dot(Xr,Ur),trace=i00*d00+2*i01*d01+i11*d11;
      const a00=i00*i00*d00+2*i00*i01*d01+i01*i01*d11+trace*i00,a01=i00*i01*d00+(i00*i11+i01*i01)*d01+i01*i11*d11+trace*i01,a11=i01*i01*d00+2*i01*i11*d01+i11*i11*d11+trace*i11;
      const strain= a00*d00+2*a01*d01+a11*d11;
      result.volume+=w*measure;result.volumeMoment=add(result.volumeMoment,scale(X,w*measure));result.kinetic+=.5*law.density*w*measure*dot(U,U);result.potential-=law.density*w*measure*dot(law.gravity,X);result.surface+=2*law.surfaceTension*w*J;result.rayleigh+=law.dynamicViscosity*w*measure*strain;
      for(let a=0;a<8;a++){const id=panel.ids[a],grad=add(scale(cross(Xr,normal),basis.Ns[a]),scale(cross(normal,Xs),basis.Nr[a]));
        capillary[id]=add(capillary[id],scale(grad,-2*law.surfaceTension*w));
        const strainGrad=add(scale(add(scale(Xs,a00),scale(Xr,a01)),basis.Ns[a]),scale(add(scale(Xs,a01),scale(Xr,a11)),basis.Nr[a]));
        viscous[id]=add(viscous[id],scale(strainGrad,-2*law.dynamicViscosity*w*measure));gravity[id]=add(gravity[id],scale(law.gravity,law.density*w*measure*basis.N[a]));}
    }
    if(!panel.frozen){
      const kq=collarCoordinateDerivative(relative.map(p=>scale(p,age)),age);
      for(const s of COLLAR_GAUSS){const basis=collarBasis(s.x,1),Xs=combine(basis.Ns,localQ),Xr=scale(combine(basis.Nr,relative),age),L=length(Xs),tangent=scale(Xs,1/L),outward=sub(Xr,scale(tangent,dot(Xr,tangent))),nu=scale(outward,1/length(outward)),U=combine(basis.N,localV),relativeU=combine(basis.N,kq),beta=panel.beta[0]*(1-s.x)+panel.beta[1]*s.x,ub=add(scale(panel.velocity[0],1-s.x),scale(panel.velocity[1],s.x)),X=combine(basis.N,localQ),J=length(cross(Xs,Xr)),h=age*beta/J;
        if(!Number.isFinite(h)||!(J>0))throw Error('Invalid curved cut geometry');
        result.cutFluxError=Math.max(result.cutFluxError,Math.abs(h*(-dot(relativeU,nu))*L-beta));
        result.sourceMassRate+=law.density*beta*s.w;const incomingK=.5*law.density*beta*s.w*dot(ub,ub),incomingPE=-law.density*beta*s.w*dot(law.gravity,X);result.sourceKineticPower+=incomingK;result.sourcePotentialPower+=incomingPE;result.sourceMechanicalPower+=incomingK+incomingPE;
        result.surfaceAdvectionPower-=2*law.surfaceTension*s.w*L*dot(relativeU,nu);
        for(let a=0;a<8;a++){const id=panel.ids[a],traction=scale(nu,2*law.surfaceTension*s.w*L*basis.N[a]);cut[id]=add(cut[id],traction);result.cutPower+=dot(traction,localV[a]);sourceMomentum[id]=add(sourceMomentum[id],scale(ub,law.density*beta*s.w*basis.N[a]));}
        if(length(sub(U,ub))>1e-8*Math.max(1,length(ub)))throw Error('Curved cut material velocity mismatch');
      }
    }
  }
  const p=collarMultiply(M,v);result.momentum=p.reduce(add,z());
  for(let a=0;a<n;a++){result.force[a]=add(add(capillary[a],viscous[a]),add(gravity[a],cut[a]));for(let b=0;b<n;b++)result.gclError=Math.max(result.gclError,Math.abs(Mdot[a][b]-C[a][b]-C[b][a]-Bin[a][b]));}
  if(![result.volume,result.kinetic,result.potential,result.surface,result.rayleigh,result.cutPower,result.surfaceAdvectionPower,result.cutFluxError,result.gclError,...result.momentum,...result.force.flat()].every(Number.isFinite)||result.rayleigh< -1e-12)throw Error('Nonfinite collar operator or negative dissipation');
  return result;
}
