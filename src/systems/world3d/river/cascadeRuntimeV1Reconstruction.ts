/** Guided reconstruction of positive donations. Geometry, rather than a saved
 * moment ledger, owns the next physical state. This bounded pilot rejects a
 * receiver whose guides cannot represent its volume without changing topology.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/10/2026, 11:56:10
 * Dependents: systems/world3d/river/cascadeRuntimeV1.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {cascadeBox,cascadeClip,cascadeMoments,dot3,sub3,type CascadePoly,type CascadePlane,type CascadeVec3} from './cascadeRuntimeV1Geometry';
import {cascadePhysical,type CascadePiece} from './cascadeRuntimeV1Projection';
import {cascadeSharedIntersection,type CascadeSharedAllocation} from './cascadeRuntimeV1SharedRemap';
import {type CascadeEndpointAudit} from './cascadeRuntimeV1Endpoint';
import {cascadePredictFinitePatches,cascadeFinitePatchMetadata,type CascadePatchPrediction} from './cascadeRuntimeV1FinitePatch';

export interface CascadeReconstruction {pieces:CascadePiece[];centroidDefect:number|null;signedDefect:CascadeVec3;motionStatus:CascadeEndpointAudit['status'];energyLoss:number;milliseconds:number;patchPrediction?:CascadePatchPrediction;maximumFitShift?:number}
const clip=(p:CascadePoly,planes:CascadePlane[])=>planes.reduce((poly,plane)=>cascadeClip(poly,plane),p);
const unit=(n:CascadeVec3)=>n.map(v=>v/Math.hypot(...n)) as CascadeVec3;

function convexUnion(a:CascadePiece,b:CascadePiece,h:number):CascadePiece|null {
  const faceKey=(f:CascadeVec3[])=>f.map(v=>v.join(',')).sort().join('/');
  for(let i=0;i<a.poly.faces.length;i++)for(let j=0;j<b.poly.faces.length;j++){
    if(faceKey(a.poly.faces[i])!==faceKey(b.poly.faces[j]))continue;
    const pa=a.poly.planes[i],pb=b.poly.planes[j];if(dot3(pa.normal,pb.normal)>=0)continue;
    const faces=[...a.poly.faces.filter((_,k)=>k!==i),...b.poly.faces.filter((_,k)=>k!==j)],planes=[...a.poly.planes.filter((_,k)=>k!==i),...b.poly.planes.filter((_,k)=>k!==j)];
    // Removing a full opposite face is a positive geometric union. The outer
    // support check proves convexity; no hull fills an unoccupied gap.
    if(!faces.flat().every(v=>planes.every(p=>dot3(p.normal,v)<=p.offset)))continue;
    const poly={faces,planes},before=cascadePhysical([a,b],h),m=cascadeMoments(poly);if(Math.abs(m.volume-before.volume)>1e-11)throw new Error('Positive convex union changes occupied volume');
    const centroid=m.first.map(v=>v/m.volume),ma=cascadeMoments(a.poly),mb=cascadeMoments(b.poly),mean=before.momentum.map(v=>v/(1000*m.volume));
    const gradient=[0,1,2].map(d=>(ma.volume*(a.velocity[2*d+1]-a.velocity[2*d])+mb.volume*(b.velocity[2*d+1]-b.velocity[2*d]))/(h*m.volume));
    const meanEnergy=500*m.volume*mean.reduce((s,v)=>s+v*v,0),slopeEnergy=gradient.reduce((s,g,d)=>s+500*g*g*(m.second[d][d]-m.first[d]**2/m.volume),0);
    if(meanEnergy>before.energy+1e-9)throw new Error('Compressed actual mean exceeds physical kinetic energy');
    const limiter=slopeEnergy>0?Math.min(1,Math.sqrt(Math.max(0,before.energy-meanEnergy)/slopeEnergy)):1;
    return {cell:a.cell,poly,sourceId:a.sourceId,...(a.finitePatch&&b.finitePatch?{finitePatch:cascadeFinitePatchMetadata(poly,[a.finitePatch,b.finitePatch],a.cell,h,`union/${a.finitePatch.id}/${b.finitePatch.id}`)}:{}),velocity:[0,1,2].flatMap(d=>[0,1].map(side=>mean[d]+limiter*gradient[d]*((a.cell[d]+side)*h-centroid[d])))};
  }return null;
}

/** Exterior supporting planes retire cell/history cuts for a convex component.
 * A concave component has no single convex guide and must be handled as several
 * connected regions; this prototype stops rather than bridging its empty space.
 */
function guides(input:CascadePiece[],h:number,dt:number,sourceSpeed:number|null):CascadePlane[] {
  const shifted=input.map(p=>{const m=cascadeMoments(p.poly),c=m.first.map(v=>v/m.volume),v=c.map((x,d)=>p.velocity[2*d]+(p.velocity[2*d+1]-p.velocity[2*d])*(x/h-p.cell[d]));return {points:p.poly.faces.flat().map(x=>x.map((a,d)=>a+dt*v[d]) as CascadeVec3),planes:p.poly.planes.map(plane=>({normal:plane.normal,offset:plane.offset+dt*dot3(plane.normal,v as CascadeVec3)}))};});
  if(sourceSpeed!==null&&sourceSpeed>0){const box=cascadeBox([1.25,2.5,2.75],[1.25+sourceSpeed*dt,2.625,3.25]);shifted.push({points:box.faces.flat(),planes:box.planes});}
  const points=shifted.flatMap(p=>p.points),seen=new Set<string>();
  return shifted.flatMap(p=>p.planes).filter(p=>{if(!points.every(x=>dot3(p.normal,x)<=p.offset))return false;const n=unit(p.normal),key=[...n,p.offset/Math.hypot(...p.normal)].join(',');if(seen.has(key))return false;seen.add(key);return true;});
}

export function cascadeReconstructSharedLegacy(a:CascadeSharedAllocation,input:CascadePiece[],h:number,dt:number,sourceSpeed:number|null,endpoint:CascadeEndpointAudit):CascadeReconstruction {
  const began=performance.now(),guide=guides(input,h,dt,sourceSpeed),pieces:CascadePiece[]=[],signedDefect:CascadeVec3=[0,0,0];let centroidDefect=0,donatedEnergy=0;
  if(guide.length<4)throw new Error('Transported interface guides do not bound a convex wet component');
  for(const region of a.partition.regions){const donations=a.donors.filter(d=>d.region===region.id);if(!donations.length)continue;
    const volume=donations.reduce((s,d)=>s+d.volume,0),momentum=[0,1,2].map(k=>donations.reduce((s,d)=>s+d.momentum[k],0)),first=endpoint.regions.find(r=>r.region===region.id)!.first;
    let poly=clip(region.poly,guide);const initial=poly.faces.length?cascadeMoments(poly).volume:0;
    if(Math.abs(initial-volume)>1e-12){
      // Move one existing exterior guide, leaving its opposing sheet support in
      // place. Select the smallest normal displacement that represents volume.
      const candidates:{poly:CascadePoly;shift:number}[]=[];
      guide.forEach((plane,index)=>{const n=unit(plane.normal),base=clip(region.poly,guide.filter((_,i)=>i!==index));if(!base.faces.length)return;const positions=base.faces.flat().map(p=>dot3(n,p));let lo=Math.min(...positions),hi=Math.max(...positions),candidate=base;
        if(cascadeMoments(base).volume<volume)return;
        for(let k=0;k<64;k++){const mid=(lo+hi)/2,p=cascadeClip(base,{normal:n,offset:mid}),v=p.faces.length?cascadeMoments(p).volume:0;if(v<volume)lo=mid;else{hi=mid;candidate=p;}}
        const shift=hi-plane.offset/Math.hypot(...plane.normal);if(Math.abs(cascadeMoments(candidate).volume-volume)<=1e-11)candidates.push({poly:candidate,shift});});
      candidates.sort((x,y)=>Math.abs(x.shift)-Math.abs(y.shift));if(!candidates.length)throw new Error('Guided receiver cannot represent positive donated volume');poly=candidates[0].poly;
    }
    const m=cascadeMoments(poly),centroid=m.first.map(v=>v/m.volume),gradient=[0,1,2].map(k=>donations.reduce((s,d)=>s+d.volume*d.gradient[k],0)/volume),mean=momentum.map(v=>v/(1000*m.volume));
    const energy=donations.reduce((s,d)=>s+d.energy,0),meanEnergy=500*m.volume*mean.reduce((s,v)=>s+v*v,0),slopeEnergy=gradient.reduce((s,g,k)=>s+500*g*g*(m.second[k][k]-m.first[k]**2/m.volume),0);
    if(meanEnergy>energy+1e-9)throw new Error('Reconstructed actual mean exceeds donated kinetic energy');
    const limiter=slopeEnergy>0?Math.min(1,Math.sqrt(Math.max(0,energy-meanEnergy)/slopeEnergy)):1;
    const velocity=[0,1,2].flatMap(k=>[0,1].map(side=>mean[k]+limiter*gradient[k]*((region.cell[k]+side)*h-centroid[k])));
    // Whole receiver donations carry OLD coordinates. Only qualified crossing
    // history can diagnose endpoint motion; an absent reference is unknown.
    // Neither reference nor old donor moments change the constructed geometry.
    if(first){for(let k=0;k<3;k++){const defect=m.first[k]-first[k];signedDefect[k]+=defect;}centroidDefect+=Math.hypot(...m.first.map((v,k)=>v-first[k]));}donatedEnergy+=energy;
    pieces.push({cell:region.cell,poly,velocity,sourceId:'shared-physical-component'});
  }
  // Retire partition boundaries by exact adjacent convex unions. Separated
  // components remain separate. A connected nonconvex union needs a richer
  // reconstruction and is rejected rather than bridged or left as history.
  for(let changed=true;changed;){changed=false;outer:for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++){if(pieces[i].cell.join(',')!==pieces[j].cell.join(','))continue;const merged=convexUnion(pieces[i],pieces[j],h);if(merged){pieces[i]=merged;pieces.splice(j,1);changed=true;break outer;}}}
  const actual=cascadePhysical(pieces,h),volume=a.incomingVolume+a.residentVolume;
  if(Math.abs(actual.volume-volume)>1e-9)throw new Error('Actual reconstructed volume does not equal positive donations');
  if(endpoint.status==='constant-control-qualified'&&centroidDefect>.05*h*volume)throw Object.assign(new Error('Guided reconstruction exceeds declared mean endpoint centroid displacement'),{reconstruction:{pieces,centroidDefect,signedDefect,meanDisplacement:centroidDefect/volume,limit:.05*h,volume,endpoint}});
  return {pieces,centroidDefect:endpoint.status==='constant-control-qualified'?centroidDefect:null,signedDefect,motionStatus:endpoint.status,energyLoss:donatedEnergy-actual.energy,milliseconds:performance.now()-began};
}

/** Current-generation local patch replacement. The legacy global guide remains
 * above solely for reproduction of its frozen failure, and is never called by
 * the current runtime. Exact common maps need no volume fitting. General local
 * correction retains every finite support and rejects positive joint overlap. */
export function cascadeReconstructShared(a:CascadeSharedAllocation,input:CascadePiece[],h:number,dt:number,sourceSpeed:number|null,endpoint:CascadeEndpointAudit):CascadeReconstruction {
  const began=performance.now(),prediction=cascadePredictFinitePatches(a,input,h,dt,sourceSpeed),pieces:CascadePiece[]=[],cache=new Map<string,CascadeVec3>();let centroidDefect=0,donatedEnergy=0,maximumFitShift=0;const signedDefect:CascadeVec3=[0,0,0];
  for(const region of a.partition.regions){const donations=a.donors.filter(d=>d.region===region.id);if(!donations.length)continue;
    const volume=donations.reduce((s,d)=>s+d.volume,0),momentum=[0,1,2].map(k=>donations.reduce((s,d)=>s+d.momentum[k],0)),energy=donations.reduce((s,d)=>s+d.energy,0),gradient=[0,1,2].map(k=>donations.reduce((s,d)=>s+d.volume*d.gradient[k],0)/volume);
    const candidateRecords=prediction.patches.flatMap(p=>{const poly=cascadeSharedIntersection(p.poly,region.poly,cache);return poly.faces.length?[{poly,patch:cascadeFinitePatchMetadata(poly,[p],region.cell,h,`${p.id}/region${region.id}`)}]:[];}),candidates=candidateRecords.map(c=>c.poly),raw=candidates.reduce((s,p)=>s+cascadeMoments(p).volume,0);
    if(!candidates.length)throw Object.assign(new Error('Finite physical patches do not reach a positive allocated receiving region'),{reconstruction:{region,volume,prediction}});
    if(prediction.exactCommonAffine&&Math.abs(raw-volume)>1e-11)throw Object.assign(new Error('Exact finite affine patch differs from conservative regional allocation'),{reconstruction:{region,volume,raw,prediction}});
    if(candidateRecords.every(c=>c.patch.sector===-1)&&Math.abs(raw-volume)>1e-11)throw Object.assign(new Error('Shared finite source front does not match a positive regional source allocation'),{reconstruction:{region,volume,raw,prediction}});
    for(let index=0;index<candidates.length;index++){
      let poly=candidates[index];const old=cascadeMoments(poly),target=volume*old.volume/raw;
      if(!prediction.exactCommonAffine&&candidateRecords[index].patch.sector!==-1&&Math.abs(old.volume-target)>1e-12){
        // Only physical sides/rims can move. Artificial tet separators, receiver
        // cuts and grid partitions remain fixed and retain their current IDs.
        // Joint occupied intersection rejects a physical expansion into water.
        const c=old.first.map(v=>v/old.volume) as CascadeVec3,planes=poly.planes,roles=candidateRecords[index].patch.facets;
        const sourceBirth=candidateRecords[index].patch.sector===-1;
        const movable=roles.map(f=>(f.kind==='physical-air'||f.kind==='physical-solid')&&(!sourceBirth||f.plane.normal[0]>0&&f.plane.normal[1]===0&&f.plane.normal[2]===0));let lo=0,hi=.05*h;
        const fitted=(distance:number)=>planes.reduce((p,plane,planeIndex)=>cascadeClip(p,{normal:plane.normal,offset:plane.offset+(movable[planeIndex]?distance*Math.hypot(...plane.normal):0)}),region.poly);
        if(target<old.volume){lo=-.05*h;hi=0;}const low=fitted(lo),high=fitted(hi),lowV=low.faces.length?cascadeMoments(low).volume:0,highV=high.faces.length?cascadeMoments(high).volume:0;
        if(lowV>target||highV<target)throw Object.assign(new Error('Local finite supports cannot fit positive allocation within .05h shift'),{reconstruction:{region,target,raw:old.volume,lowV,highV,prediction}});
        for(let k=0;k<52;k++){const mid=(lo+hi)/2,p=fitted(mid),v=p.faces.length?cascadeMoments(p).volume:0;if(v<target)lo=mid;else hi=mid;}poly=fitted(hi);maximumFitShift=Math.max(maximumFitShift,Math.abs(hi));
        const descendantIds=new Map(roles.map(f=>[f.id,`${a.partition.construction!.generation}/fit/${f.id}`]));candidateRecords[index].patch={...candidateRecords[index].patch,facets:roles.map((f,k)=>({...f,id:descendantIds.get(f.id)!,pair:f.pair?descendantIds.get(f.pair)??f.pair:null,plane:{normal:planes[k].normal,offset:planes[k].offset+(movable[k]?hi*Math.hypot(...planes[k].normal):0)}}))};void c;
      }
      const m=cascadeMoments(poly),centroid=m.first.map(v=>v/m.volume),fraction=m.volume/volume,mean=momentum.map(v=>v/(1000*volume)),meanEnergy=500*m.volume*mean.reduce((s,v)=>s+v*v,0),slopeEnergy=gradient.reduce((s,g,k)=>s+500*g*g*(m.second[k][k]-m.first[k]**2/m.volume),0),available=energy*fraction;
      if(meanEnergy>available+1e-9)throw new Error('Finite patch mean momentum exceeds donated kinetic energy');const limiter=slopeEnergy>0?Math.min(1,Math.sqrt(Math.max(0,available-meanEnergy)/slopeEnergy)):1;
      pieces.push({cell:region.cell,poly,finitePatch:cascadeFinitePatchMetadata(poly,[candidateRecords[index].patch],region.cell,h,`${candidateRecords[index].patch.id}/fitted`),sourceId:'current-finite-patch',velocity:[0,1,2].flatMap(k=>[0,1].map(side=>mean[k]+limiter*gradient[k]*((region.cell[k]+side)*h-centroid[k])))});
    }
    const actualRegion=pieces.filter(p=>p.cell.every((v,d)=>v===region.cell[d])).filter(p=>{const hit=cascadeSharedIntersection(p.poly,region.poly,cache);return hit.faces.length&&cascadeMoments(hit).volume>0;}),actual=actualRegion.reduce((s,p)=>{const hit=cascadeSharedIntersection(p.poly,region.poly,cache),m=cascadeMoments(hit);return s.map((v,d)=>v+m.first[d]) as CascadeVec3;},[0,0,0] as CascadeVec3),reference=endpoint.regions.find(r=>r.region===region.id)!.first;
    if(reference){for(let k=0;k<3;k++)signedDefect[k]+=actual[k]-reference[k];centroidDefect+=Math.hypot(...sub3(actual,reference));}donatedEnergy+=energy;
  }
  for(let i=0;i<pieces.length;i++){if(pieces.filter(p=>p.cell.every((v,d)=>v===pieces[i].cell[d])).length>32)throw new Error('Finite patch reconstruction exceeds 32 pieces/cell');for(let j=0;j<i;j++)if(pieces[i].cell.every((v,d)=>v===pieces[j].cell[d])){const hit=cascadeSharedIntersection(pieces[i].poly,pieces[j].poly,cache);if(hit.faces.length&&cascadeMoments(hit).volume>0)throw Object.assign(new Error('Local finite patch descendants have positive occupied overlap'),{reconstruction:{i,j,pieces,prediction}});}}
  for(let changed=true;changed;){changed=false;outer:for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++){if(!pieces[i].cell.every((v,d)=>v===pieces[j].cell[d]))continue;const merged=convexUnion(pieces[i],pieces[j],h);if(merged){pieces[i]=merged;pieces.splice(j,1);changed=true;break outer;}}}
  const physical=cascadePhysical(pieces,h),volume=a.incomingVolume+a.residentVolume;
  if(Math.abs(physical.volume-volume)>1e-9)throw new Error('Finite reconstructed volume differs from positive conservative allocation');
  if(endpoint.status==='constant-control-qualified'&&centroidDefect>.05*h*volume)throw Object.assign(new Error('Finite patch endpoint displacement exceeds unchanged .05h gate'),{reconstruction:{pieces,prediction,centroidDefect,meanDisplacement:centroidDefect/volume,limit:.05*h}});
  return {pieces,centroidDefect:endpoint.status==='constant-control-qualified'?centroidDefect:null,signedDefect,motionStatus:endpoint.status,energyLoss:donatedEnergy-physical.energy,milliseconds:performance.now()-began,patchPrediction:prediction,maximumFitShift};
}
