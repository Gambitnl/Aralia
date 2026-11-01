/** Low-order pressure/contact projection over actual occupied cuts.
 * The mass metric integrates the same normal-linear carrier used by transport.
 * Weak normal slopes are explicitly restricted to constant motion inside their
 * own material support. Their positive volume, momentum and wall traces remain.
 * Matrix-free pressure has no dense rescue or residual-hiding fallback.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 08/10/2026, 11:56:10
 * Dependents: systems/world3d/river/cascadeRuntimeV1.ts, systems/world3d/river/cascadeRuntimeV1Endpoint.ts, systems/world3d/river/cascadeRuntimeV1FinitePatch.ts, systems/world3d/river/cascadeRuntimeV1Reconstruction.ts, systems/world3d/river/cascadeRuntimeV1SharedRemap.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {cascadeMoments,cascadeBox,dot3,cross3,sub3,cascadeFacePatch,cascadePlaneKey,cascadeFaceArea,type CascadePoly,type CascadeVec3} from './cascadeRuntimeV1Geometry';
export interface CascadePiece {cell: CascadeVec3;poly: CascadePoly;velocity: number[];sourceId: string;finitePatch?:import('./cascadeRuntimeV1FinitePatch').CascadeFinitePatch}
export interface CascadeSolid {lo: CascadeVec3;hi: CascadeVec3}
export interface CascadeProjection {pieces: CascadePiece[];wallImpulse: CascadeVec3;sourcePressureImpulse:CascadeVec3;sourceBoundaryWork:number;divergence: number;iterations: number;restrictionLoss: number;pressureLoss: number;constraints: number;pressureCells:{piece:number;volume:number;multiplier:number;pressure:number}[]}
type Row={entries:[number,number][];kind:'divergence'|'internal'|'wall'|'source';piece?:number;target?:number;contactKey?:string};
type Block={indices:number[];inverse:number[];mass:number[];piece:number;axis:number};
const dot=(a: Float64Array,b: Float64Array)=>a.reduce((s,v,i)=>s+v*b[i],0);
export function cascadePhysical(pieces: CascadePiece[],h: number,rho=1000) {
  let volume=0,energy=0;const momentum: CascadeVec3=[0,0,0],first: CascadeVec3=[0,0,0];
  for(const p of pieces){const m=cascadeMoments(p.poly);volume+=m.volume;
    for(let d=0;d<3;d++){
      first[d]+=m.first[d];const b=(p.velocity[2*d+1]-p.velocity[2*d])/h,a=p.velocity[2*d]-b*p.cell[d]*h;
      momentum[d]+=rho*(a*m.volume+b*m.first[d]);energy+=rho*.5*(a*a*m.volume+2*a*b*m.first[d]+b*b*m.second[d][d]);
    }
  }return {volume,momentum,first,energy};
}
export function cascadeProject(input: CascadePiece[],solids: CascadeSolid[],h: number,tolerance=1e-9,dt=1,sourceSpeed:number|null=null,contact:'bilateral-reference'|'unilateral'='bilateral-reference'): CascadeProjection {
  return cascadeProjectInternal(input,solids,h,tolerance,dt,sourceSpeed,contact,null,0);
}
function cascadeProjectInternal(input: CascadePiece[],solids: CascadeSolid[],h:number,tolerance:number,dt:number,sourceSpeed:number|null,contact:'bilateral-reference'|'unilateral',active:Set<string>|null,pass:number):CascadeProjection {
  const before=cascadePhysical(input,h),blocks: Block[]=[],map: number[][]=[],star: number[]=[],rows: Row[]=[];
  let restrictionLoss=0;
  const wallCandidates:Row[]=[];
  input.forEach((p,i)=>{
    const m=cascadeMoments(p.poly),indices: number[]=[];
    for(let d=0;d<3;d++){
      const mean=m.first[d]/m.volume/h-p.cell[d];
      const variance=m.second[d][d]/m.volume/h**2-(m.first[d]/m.volume/h)**2;
      if(variance < -1e-10)throw new Error('Invalid cut second moment');
      const mass=1000*m.volume,u0=p.velocity[2*d],u1=p.velocity[2*d+1];
      // This is an explicit change of approximation space, not fictitious mass.
      // The constant mode remains exact; the unresolved normal slope loses only
      // its measured variance energy. No other wet body participates.
      if(variance<1e-4){
        const k=star.length,u=u0*(1-mean)+u1*mean;star.push(u);indices.push(k,k);
        blocks.push({indices:[k],inverse:[1/mass],mass:[mass],piece:i,axis:d});
        restrictionLoss+=.5*mass*(u1-u0)**2*Math.max(0,variance);
      }else{
        const rr=variance+mean*mean,A=mass*(1-2*mean+rr),B=mass*(mean-rr),C=mass*rr,det=A*C-B*B;
        if(!(det>0))throw new Error('Unsupported positive cut mass block');
        const k=star.length;star.push(u0,u1);indices.push(k,k+1);
        blocks.push({indices:[k,k+1],inverse:[C/det,-B/det,-B/det,A/det],mass:[A,B,B,C],piece:i,axis:d});
      }
    }map.push(indices);
    const entries: [number,number][]=[];
    for(let d=0;d<3;d++)if(indices[2*d]!==indices[2*d+1])entries.push([indices[2*d],-1/h],[indices[2*d+1],1/h]);
    if(entries.length)rows.push({entries,kind:'divergence',piece:i});
  });
  const buckets=new Map<string,number[]>();input.forEach((p,i)=>{const key=p.cell.join(',');buckets.set(key,[...(buckets.get(key)??[]),i]);});
  const trace=(i:number,point:CascadeVec3,n:CascadeVec3,sign=1):[number,number][]=>n.flatMap((v,d)=>{const r=point[d]/h-input[i].cell[d];return v===0?[]:[[map[i][2*d],sign*v*(1-r)],[map[i][2*d+1],sign*v*r]] as [number,number][];});
  const points=(patch:CascadeVec3[],n:CascadeVec3)=>{
    if(n.filter(v=>v!==0).length===1)return [patch[0]];
    for(let i=1;i<patch.length;i++)for(let j=i+1;j<patch.length;j++)if(Math.hypot(...cross3(sub3(patch[i],patch[0]),sub3(patch[j],patch[0])))>0)return [patch[0],patch[i],patch[j]];
    throw new Error('Oblique contact trace has no independent affine samples');
  };
  input.forEach((p,i)=>{
    const neighbors=new Set<number>();for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const j of buckets.get([p.cell[0]+dx,p.cell[1]+dy,p.cell[2]+dz].join(','))??[])if(j>i)neighbors.add(j);
    for(let f=0;f<p.poly.faces.length;f++){
      const plane=p.poly.planes[f],key=cascadePlaneKey(plane),n=plane.normal;
      for(const j of neighbors){const q=input[j],other=q.poly.planes.find(t=>cascadePlaneKey(t)===key&&dot3(t.normal,n)<0);if(!other)continue;
        const patch=cascadeFacePatch(p.poly.faces[f],q.poly.planes);if(cascadeFaceArea(patch)>0)for(const point of points(patch,n))rows.push({entries:[...trace(i,point,n),...trace(j,point,n,-1)],kind:'internal'});
      }
      for(const solid of solids){const poly=cascadeBox(solid.lo,solid.hi);if(!poly.planes.some(t=>cascadePlaneKey(t)===key&&dot3(t.normal,n)<0))continue;
        const patch=cascadeFacePatch(p.poly.faces[f],poly.planes);if(cascadeFaceArea(patch)>0)for(const point of points(patch,n)){
          const row:Row={entries:trace(i,point,n),kind:'wall',contactKey:`${i}/${f}/${solids.indexOf(solid)}/${point.join(',')}`};wallCandidates.push(row);
          // Actual wet wall footprints supply unilateral reactions. A departing
          // trace is free; zero/incoming traces can become active after pressure.
          if(contact==='bilateral-reference'||(active?active.has(row.contactKey!):row.entries.reduce((s,[k,c])=>s+c*star[k],0)>0))rows.push(row);
        }
      }
      if(sourceSpeed!==null&&key==='1,0,0,1.25'&&n[0]<0){const patch=cascadeFacePatch(p.poly.faces[f],cascadeBox([1.125,2.5,2.75],[1.25,2.625,3.25]).planes);
        if(cascadeFaceArea(patch)>0)rows.push({entries:trace(i,patch[0],[1,0,0]),kind:'source',target:sourceSpeed});}
    }
  });
  // Restricted modes can give repeated indices. Combine them before solving;
  // a homogeneous zero trace is redundant, never an artificial mass floor.
  for(let r=rows.length-1;r>=0;r--){const sums=new Map<number,number>();for(const [i,c] of rows[r].entries)sums.set(i,(sums.get(i)??0)+c);rows[r].entries=[...sums].filter(([,c])=>c!==0);if(!rows[r].entries.length){if(rows[r].target)throw new Error('Restricted field cannot satisfy prescribed source trace');rows.splice(r,1);}}
  const inverse=(v: Float64Array)=>{const out=new Float64Array(v.length);for(const b of blocks)for(let i=0;i<b.indices.length;i++)for(let j=0;j<b.indices.length;j++)out[b.indices[i]]+=b.inverse[i*b.indices.length+j]*v[b.indices[j]];return out;};
  const apply=(v: Float64Array)=>Float64Array.from(rows,r=>r.entries.reduce((s,[i,c])=>s+c*v[i],0));
  const transpose=(v: Float64Array)=>{const out=new Float64Array(star.length);rows.forEach((r,j)=>r.entries.forEach(([i,c])=>{out[i]+=c*v[j];}));return out;};
  const owner=new Map<number,Block>();for(const b of blocks)for(const i of b.indices)owner.set(i,b);
  const diagonal=Float64Array.from(rows,r=>{
    const touched=new Map<Block,number[]>();for(const [i,c] of r.entries){const b=owner.get(i)!;if(!touched.has(b))touched.set(b,Array(b.indices.length).fill(0));touched.get(b)![b.indices.indexOf(i)]+=c;}
    let value=0;for(const [b,v] of touched)for(let i=0;i<v.length;i++)for(let j=0;j<v.length;j++)value+=v[i]*b.inverse[i*v.length+j]*v[j];return value;
  });
  const rhs=apply(Float64Array.from(star));rows.forEach((r,i)=>{rhs[i]-=r.target??0;});const lambda=new Float64Array(rows.length),residual=rhs.slice();
  let z=Float64Array.from(residual,(v,i)=>v/diagonal[i]),direction=z.slice(),rz=dot(residual,z),iterations=0;
  for(;Math.max(0,...residual.map(Math.abs))>tolerance&&iterations<400;iterations++){
    const q=apply(inverse(transpose(direction))),den=dot(direction,q);
    if(!(den>0))throw new Error('Pressure breakdown before residual acceptance');
    const alpha=rz/den;for(let i=0;i<lambda.length;i++){lambda[i]+=alpha*direction[i];residual[i]-=alpha*q[i];}
    z=Float64Array.from(residual,(v,i)=>v/diagonal[i]);const next=dot(residual,z),beta=next/rz;for(let i=0;i<direction.length;i++)direction[i]=z[i]+beta*direction[i];rz=next;
  }
  const correction=inverse(transpose(lambda)),values=Float64Array.from(star,(v,i)=>v-correction[i]),actual=apply(values);
  rows.forEach((r,i)=>{actual[i]-=r.target??0;});if(Math.max(0,...actual.map(Math.abs))>tolerance)throw new Error('Actual pressure/contact residual failed');
  if(contact==='unilateral'){
    const next=new Set(rows.flatMap(r=>r.contactKey?[r.contactKey]:[]));let changed=false;
    rows.forEach((r,i)=>{if(r.contactKey&&lambda[i]<-tolerance){next.delete(r.contactKey);changed=true;}});
    for(const row of wallCandidates)if(!next.has(row.contactKey!)&&row.entries.reduce((s,[k,c])=>s+c*values[k],0)>tolerance){next.add(row.contactKey!);changed=true;}
    if(changed){if(pass>=32)throw new Error('Actual unilateral wet-wall active set exceeds 32 pressure solves');return cascadeProjectInternal(input,solids,h,tolerance,dt,sourceSpeed,contact,next,pass+1);}
  }
  const pieces=input.map((p,i)=>({...p,velocity:map[i].map(k=>values[k])})),after=cascadePhysical(pieces,h),wallImpulse: CascadeVec3=[0,0,0],sourcePressureImpulse:CascadeVec3=[0,0,0];
  // Internal rows annihilate constant velocity. Only solid constraints contribute
  // a resultant force. Measure it directly from the accepted multipliers.
  rows.forEach((row,r)=>{if(row.kind==='wall'||row.kind==='source')for(const [k,c] of row.entries){const block=owner.get(k);if(block)(row.kind==='wall'?wallImpulse:sourcePressureImpulse)[block.axis]-=c*lambda[r];}});
  const error=after.momentum.map((p,d)=>p-before.momentum[d]-wallImpulse[d]-sourcePressureImpulse[d]);
  if(Math.max(...error.map(Math.abs))>1e-6)throw new Error(`Direct projected momentum failed ${error}`);
  let divergence=0;for(const p of pieces)divergence=Math.max(divergence,Math.abs([0,1,2].reduce((s,d)=>s+(p.velocity[2*d+1]-p.velocity[2*d])/h,0)));
  // KKT uses u_new = u_star - M^-1 A^T lambda. The divergence row is
  // unscaled by volume, so weak pressure dt*V*p*div(w) equals -lambda*div(w).
  // Only the reported pressure changes sign; physical reactions and work retain it.
  const pressureCells=rows.flatMap((r,i)=>r.kind==='divergence'&&r.piece!==undefined?[{piece:r.piece,volume:cascadeMoments(input[r.piece].poly).volume,multiplier:lambda[i],pressure:-lambda[i]/(dt*cascadeMoments(input[r.piece].poly).volume)}]:[]);
  // A prescribed source can add mechanical work. Its exact discrete constraint
  // work is separate from dissipation of the pressure projection.
  const sourceBoundaryWork=rows.reduce((s,r,i)=>s-(r.kind==='source'?lambda[i]*(r.target??0):0),0);
  return {pieces,wallImpulse,sourcePressureImpulse,sourceBoundaryWork,divergence,iterations,restrictionLoss,pressureLoss:before.energy-after.energy+sourceBoundaryWork-restrictionLoss,constraints:rows.length,pressureCells};
}
