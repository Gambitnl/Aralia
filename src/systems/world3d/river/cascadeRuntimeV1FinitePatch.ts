/** Local finite liquid patches for the isolated cascade.
 * All physical sides and rims survive a common construction. Grid cuts remain
 * numerical partitions. The shared stage owns the carrier: corrected backward
 * caps and old donor fragments never act as forward trajectories.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/10/2026, 11:56:10
 * Dependents: systems/world3d/river/cascadeRuntimeV1.ts, systems/world3d/river/cascadeRuntimeV1Reconstruction.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {cascadeMoments,cascadeMap,cascadeCellSplit,cascadePlaneKey,cascadeBox,dot3,sub3,cross3,type CascadePoly,type CascadeVec3,type CascadePlane} from './cascadeRuntimeV1Geometry';
import {type CascadePiece,type CascadeSolid} from './cascadeRuntimeV1Projection';
import {cascadeSharedTetra,cascadeSharedIntersection,type CascadeSharedAllocation,type CascadeStageConstruction,type CascadeStageField} from './cascadeRuntimeV1SharedRemap';
export interface CascadeAffineMap {matrix:CascadeVec3[];shift:CascadeVec3}
export interface CascadeFiniteFacet {id:string;kind:'physical-air'|'physical-solid'|'grid'|'internal';vertices:number[];plane:CascadePlane;pair:string|null}
export interface CascadeFinitePatch {generation:number;id:string;poly:CascadePoly;vertices:{id:number;point:CascadeVec3;facets:string[]}[];facets:CascadeFiniteFacet[];sector:number|null}
export interface CascadePatchPrediction {patches:CascadeFinitePatch[];crossings:number;maximumNormalMismatch:number;exactCommonAffine:boolean;sourceBranch?:{fields:number[];maximumDifference:number;coveredVolume:number;rawVolume:number;rawFront:number;sharedFront:number;frontCorrection:number}}
const plus=(a:CascadeVec3,b:CascadeVec3)=>a.map((v,d)=>v+b[d]) as CascadeVec3;
const scale=(a:CascadeVec3,s:number)=>a.map(v=>v*s) as CascadeVec3;
const determinant=(rows:CascadeVec3[])=>dot3(rows[0],cross3(rows[1],rows[2]));
function solve(rows:CascadeVec3[],rhs:CascadeVec3):CascadeVec3 {const det=determinant(rows);if(det===0)throw new Error('Finite-patch affine construction is singular');return [0,1,2].map(d=>determinant(rows.map((r,i)=>r.map((v,k)=>k===d?rhs[i]:v) as CascadeVec3))/det) as CascadeVec3;}
const evaluate=(f:CascadeStageField,p:CascadeVec3):CascadeVec3=>plus(f.intercept,f.gradient.map(r=>dot3(r,p)) as CascadeVec3);

/** This oracle is the declared map for geometry controls. It does not extend
 * the pressure runtime's six diagonal-linear velocity degrees of freedom. */
export function cascadeAffineFinitePatch(poly:CascadePoly,map:CascadeAffineMap,generation=0,id='affine-control',sector:number|null=null):CascadeFinitePatch {
  if(!(determinant(map.matrix)>0))throw new Error('Finite patch requires positive affine orientation');
  const points=new Map<CascadeVec3,CascadeVec3>(),coordinates=new Map<string,CascadeVec3>();
  const mapped=(p:CascadeVec3)=>{let q=points.get(p);if(!q){const key=p.join(',');q=coordinates.get(key);if(!q){q=plus(map.matrix.map(r=>dot3(r,p)) as CascadeVec3,map.shift);coordinates.set(key,q);}points.set(p,q);}return q;};
  const faces=poly.faces.map(f=>f.map(mapped)),planes=poly.planes.map(p=>{const n=solve([0,1,2].map(d=>map.matrix.map(r=>r[d]) as CascadeVec3),p.normal);return {normal:n,offset:p.offset+dot3(n,map.shift)};});
  const all=[...new Set(faces.flat())],facets=faces.map((f,i):CascadeFiniteFacet=>({id:`${generation}/${id}/f${i}`,kind:'physical-air',vertices:f.map(p=>all.indexOf(p)),plane:planes[i],pair:null}));
  for(let i=0;i<facets.length;i++){const j=facets.findIndex((f,k)=>k!==i&&dot3(f.plane.normal,facets[i].plane.normal)<0&&Math.hypot(...cross3(f.plane.normal,facets[i].plane.normal))===0);if(j>=0)facets[i].pair=facets[j].id;}
  return {generation,id,poly:{faces,planes},vertices:all.map((point,index)=>({id:index,point,facets:facets.filter(f=>f.vertices.includes(index)).map(f=>f.id)})),facets,sector};
}

/** Destination cuts inherit physical incidence when the corresponding current
 * facet survives. New fixed-cell/receiver cuts are explicitly numerical; they
 * cannot become movable physical sides during a local volume correction. */
export function cascadeFinitePatchMetadata(poly:CascadePoly,parents:CascadeFinitePatch[],cell:CascadeVec3,h:number,id:string):CascadeFinitePatch {
  const generation=Math.max(0,...parents.map(p=>p.generation)),patch=cascadeAffineFinitePatch(poly,{matrix:[[1,0,0],[0,1,0],[0,0,1]],shift:[0,0,0]},generation,id,parents[0]?.sector??null);
  patch.facets.forEach(f=>{const prior=parents.flatMap(p=>p.facets).find(g=>cascadePlaneKey(g.plane)===cascadePlaneKey(f.plane)&&dot3(g.plane.normal,f.plane.normal)>0);if(prior){f.kind=prior.kind;f.id=prior.id;f.pair=prior.pair;}else{const axes=f.plane.normal.flatMap((v,d)=>v!==0?[d]:[]),d=axes[0];f.kind=axes.length===1&&[cell[d]*h,(cell[d]+1)*h].includes(f.plane.offset/f.plane.normal[d])?'grid':'internal';f.pair=null;}});
  patch.vertices.forEach(v=>{v.facets=patch.facets.filter(f=>f.vertices.includes(v.id)).map(f=>f.id);});return patch;
}

function affineFlow(f:CascadeStageField,p:CascadeVec3,t:number):CascadeVec3 {
  // A bounded matrix exponential series supplies the actual frozen full-affine
  // predictor flow. This is a trajectory approximation, not pressure shear.
  let out=[...p] as CascadeVec3,term=scale(evaluate(f,p),t);
  for(let k=1;k<=24;k++){out=plus(out,term);term=scale(f.gradient.map(r=>dot3(r,term)) as CascadeVec3,t/(k+1));if(Math.max(...term.map(Math.abs))<1e-16)return out;}
  throw new Error('Finite-patch affine trajectory series did not converge within 24 terms');
}

/** Physical ownership resolves a tangential boundary only when its current wet
 * sector provides that facet's vector. Empty-side normal compatibility alone
 * cannot invent a vector at a zero-normal edge. No sector/air averaging occurs. */
export function cascadeForwardInterface(stage:CascadeStageConstruction,start:CascadeVec3,duration:number,sector:number|null,stats:{crossings:number;maximumNormalMismatch:number}):CascadeVec3 {
  if(stage.uniformControl)return plus(start,scale(stage.uniformControl,duration));
  let point=[...start] as CascadeVec3,elapsed=0,current:CascadeStageField|undefined;
  const candidates=(x:CascadeVec3)=>stage.fields.filter(f=>f.poly.planes.every(p=>dot3(p.normal,x)<=p.offset));
  while(elapsed<duration-1e-14){
    const touching=candidates(point),owned=touching.filter(f=>sector!==null&&(f.wetSector===sector||sector===-1&&elapsed===0&&stage.sourceSpeed!==null&&Math.hypot(...sub3(evaluate(f,point),[stage.sourceSpeed,0,0]))<1e-10));
    const entering=touching.filter(f=>{const v=evaluate(f,point);return f.poly.planes.every(p=>dot3(p.normal,point)!==p.offset||dot3(p.normal,v)<=0);});
    if(!current){
      // The starting physical facet belongs to its old wet carrier even when a
      // separately rounded partition plane disagrees. Its own input incidence
      // selects it; later transverse crossings must select the entering side.
      const preferred=owned[0];current=preferred??entering[0];
      if(!current)throw Object.assign(new Error('Forward interface has no current carrier/sector incidence'),{trajectory:{point,elapsed,sector,touching:touching.map(f=>f.id)}});
      const v=evaluate(current,point),ambiguous=entering.filter(f=>Math.hypot(...sub3(evaluate(f,point),v))>1e-10);
      if(!preferred&&ambiguous.length)throw Object.assign(new Error('Zero-normal/tangential forward interface sector is unresolved'),{trajectory:{point,elapsed,sector,fields:entering.map(f=>({id:f.id,wetSector:f.wetSector,velocity:evaluate(f,point)}))}});
    }
    const remaining=duration-elapsed,end=affineFlow(current,point,remaining);
    if(current.poly.planes.every(p=>dot3(p.normal,end)<=p.offset)){point=end;elapsed=duration;break;}
    let crossing=remaining,planeIndex=-1;
    current.poly.planes.forEach((plane,index)=>{if(dot3(plane.normal,end)<=plane.offset)return;let lo=0,hi=remaining;for(let k=0;k<52;k++){const mid=(lo+hi)/2;if(dot3(plane.normal,affineFlow(current!,point,mid))<=plane.offset)lo=mid;else hi=mid;}if(lo<crossing){crossing=lo;planeIndex=index;}});
    if(planeIndex<0)throw new Error('Forward interface crossing could not be bracketed');
    const boundary=affineFlow(current,point,crossing),plane=current.poly.planes[planeIndex],velocity=evaluate(current,boundary),normalSpeed=dot3(plane.normal,velocity);
    // Reconstruct the exact incident plane coordinate for an axis crossing;
    // a nonaxis boundary keeps its construction point and side record.
    const axes=plane.normal.flatMap((v,d)=>v!==0?[d]:[]);if(axes.length===1)boundary[axes[0]]=plane.offset/plane.normal[axes[0]];
    const next=candidates(boundary).filter(f=>f.id!==current!.id&&f.poly.planes.every(p=>dot3(p.normal,boundary)!==p.offset||dot3(p.normal,evaluate(f,boundary))<=0));
    const compatible=next.filter(f=>Math.abs(dot3(plane.normal,evaluate(f,boundary))-normalSpeed)<=1e-9&&f.poly.planes.every(p=>dot3(p.normal,boundary)!==p.offset||dot3(p.normal,velocity)<=0));
    if(!compatible.length)throw Object.assign(new Error('Forward interface crossing has no compatible entering carrier'),{trajectory:{point:boundary,elapsed:elapsed+crossing,plane,current:current.id,normalSpeed,next:next.map(f=>({id:f.id,velocity:evaluate(f,boundary)}))}});
    if(normalSpeed===0&&compatible.some(f=>Math.hypot(...sub3(evaluate(f,boundary),velocity))>1e-10))throw Object.assign(new Error('Zero-normal crossing has unresolved tangential sector'),{trajectory:{point:boundary,plane,current:current.id,next:compatible.map(f=>f.id)}});
    if(compatible.some(f=>Math.hypot(...sub3(evaluate(f,boundary),evaluate(compatible[0],boundary)))>1e-10))throw Object.assign(new Error('Edge/corner entering carrier has multiple unresolved physical vectors'),{trajectory:{point:boundary,plane,current:current.id,sector,next:compatible.map(f=>({id:f.id,wetSector:f.wetSector,velocity:evaluate(f,boundary)}))}});
    stats.maximumNormalMismatch=Math.max(stats.maximumNormalMismatch,...compatible.map(f=>Math.abs(dot3(plane.normal,evaluate(f,boundary))-normalSpeed)));
    point=boundary;elapsed+=crossing;current=compatible[0];stats.crossings++;if(stats.crossings>64)throw new Error('Finite-patch trajectory exceeds 64 fixed-region crossings');
    if(crossing===0&&Math.hypot(...evaluate(current,point))===0)throw new Error('Forward interface stalled at an unresolved fixed-region boundary');
  }
  return point;
}

export function cascadePredictFinitePatches(a:CascadeSharedAllocation,input:CascadePiece[],h:number,dt:number,sourceSpeed:number|null):CascadePatchPrediction {
  const stage=a.partition.construction;if(!stage)throw new Error('Finite reconstruction requires the shared face owner stage construction');
  const stats={crossings:0,maximumNormalMismatch:0},patches:CascadeFinitePatch[]=[];let sourceBranch:CascadePatchPrediction['sourceBranch'];
  for(let i=0;i<input.length;i++){
    const p=input[i];let patch:CascadeFinitePatch;
    if(stage.uniformControl){patch=cascadeAffineFinitePatch(p.poly,{matrix:[[1,0,0],[0,1,0],[0,0,1]],shift:scale(stage.uniformControl,dt)},stage.generation,`wet${i}`,i);}
    else {
      // Physical descendants use the actual stage trajectories. A general
      // warped polygon is triangulated, never treated as an unchanged plane.
      const original=cascadeAffineFinitePatch(p.poly,{matrix:[[1,0,0],[0,1,0],[0,0,1]],shift:[0,0,0]},stage.generation,`wet${i}`,i);
      if(p.finitePatch)original.facets.forEach((f,k)=>{f.kind=p.finitePatch!.facets[k]?.kind??f.kind;f.pair=p.finitePatch!.facets[k]?.pair??f.pair;});
      const mapped=original.vertices.map(v=>cascadeForwardInterface(stage,v.point,dt,i,stats));
      const center=cascadeMoments(p.poly),origin=scale(center.first,1/center.volume),movedCenter=cascadeForwardInterface(stage,origin,dt,i,stats);
      for(const facet of original.facets)for(let k=1;k<facet.vertices.length-1;k++){
        const ids=[facet.vertices[0],facet.vertices[k],facet.vertices[k+1]],tet=cascadeSharedTetra([movedCenter,...ids.map(id=>mapped[id])]);
        const m=cascadeMoments(tet);if(!(m.volume>0))throw new Error('Forward physical patch descendant is inverted');
        const descendant=cascadeAffineFinitePatch(tet,{matrix:[[1,0,0],[0,1,0],[0,0,1]],shift:[0,0,0]},stage.generation,`wet${i}/${facet.id}/${k}`,i);descendant.facets.forEach((f,j)=>{f.kind=j===3?facet.kind:'internal';if(j===3){f.id=`${stage.generation}/descendant/${facet.id}/${k}`;f.pair=facet.pair;}});descendant.vertices.forEach(v=>{v.facets=descendant.facets.filter(f=>f.vertices.includes(v.id)).map(f=>f.id);});patches.push(descendant);
      }
      continue;
    }
    // Current geometric opposing facets identify grid/decomposition partitions;
    // a historical source label never decides physical connection.
    patch.facets.forEach((f,k)=>{const original=p.poly.planes[k],axis=original.normal.findIndex(v=>v!==0);if(p.finitePatch){f.kind=p.finitePatch.facets[k]?.kind??f.kind;}else if(original.normal.filter(v=>v!==0).length===1&&[p.cell[axis]*h,(p.cell[axis]+1)*h].includes(original.offset/original.normal[axis]))f.kind='grid';});
    patches.push(patch);
  }
  if(sourceSpeed!==null&&sourceSpeed>0){
    const source=cascadeBox([1.25,2.5,2.75],[1.25+sourceSpeed*dt,2.625,3.25]);
    if(!stage.uniformControl){
      // Birth time is a source boundary label. These two finite faces represent
      // age zero and age dt; it is not an old resident prism given a full kick.
      // Nonuniform source trajectories require each inlet corner's own sector.
      const opening:CascadeVec3[]=[[1.25,2.5,2.75],[1.25,2.625,2.75],[1.25,2.625,3.25],[1.25,2.5,3.25]],oldest=opening.map(p=>cascadeForwardInterface(stage,p,dt,-1,stats));
      // A common axis front is one finite six-faced birth patch, established by
      // the actual four trajectories. Its internal parameter-tet separators
      // are not physical sides and must not be independently volume-expanded.
      const straight=oldest.every((p,k)=>p[0]===oldest[0][0]&&p[1]===opening[k][1]&&p[2]===opening[k][2])&&oldest[0][0]>1.25;
      if(straight){
        const prism=cascadeBox([1.25,2.5,2.75],[oldest[0][0],2.625,3.25]),branch=stage.fields.flatMap(f=>{const intersection=cascadeSharedIntersection(f.poly,prism);return intersection.faces.length?[{field:f,volume:cascadeMoments(intersection).volume}]:[];});
        if(!branch.length)throw new Error('Straight source prism has no current affine branch ownership');
        const first=branch[0].field,maximumBranchDifference=Math.max(...branch.flatMap(({field:f})=>[...f.intercept.map((v,d)=>Math.abs(v-first.intercept[d])),...f.gradient.flatMap((r,d)=>r.map((v,k)=>Math.abs(v-first.gradient[d][k])))])),covered=branch.reduce((s,b)=>s+b.volume,0),volume=cascadeMoments(prism).volume;
        // Four corners alone do not establish a straight finite face. This
        // verifies the actual affine branch on every positive fixed subregion
        // intersected by its interior, without adding an empty-divergence gate.
        if(maximumBranchDifference>1e-9||Math.abs(covered-volume)>1e-11)throw Object.assign(new Error('Source straight-face branch is not established through actual fixed subregions'),{sourceTrajectory:{opening,oldest,maximumBranchDifference,covered,volume,fields:branch.map(b=>b.field.id)}});
        // The admitted boundary measure fixes one shared free-front correction
        // before any receiving-region clipping. Inlet and all opening rims stay
        // fixed; regional bisections cannot round one physical front twice.
        const correctedFront=1.25+a.incomingVolume/.0625;
        if(Math.abs(correctedFront-oldest[0][0])>.05*h)throw new Error('Shared finite birth-front correction exceeds .05h');
        sourceBranch={fields:branch.map(b=>b.field.id),maximumDifference:maximumBranchDifference,coveredVolume:covered,rawVolume:volume,rawFront:oldest[0][0],sharedFront:correctedFront,frontCorrection:correctedFront-oldest[0][0]};
        patches.push(cascadeAffineFinitePatch(cascadeBox([1.25,2.5,2.75],[correctedFront,2.625,3.25]),{matrix:[[1,0,0],[0,1,0],[0,0,1]],shift:[0,0,0]},stage.generation,'finite-boundary-birth',-1));
      }
      else for(const triangle of [[0,1,2],[0,2,3]]){
        const points=[...triangle.map(i=>opening[i]),...triangle.map(i=>oldest[i])];
        for(const ids of [[0,1,2,5],[0,1,5,4],[0,3,4,5]]){
          const p=ids.map(i=>points[i]),det=determinant(p.slice(1).map(q=>sub3(q,p[0])));if(!(det>0))throw Object.assign(new Error('Source birth-time finite descendant is folded or stationary'),{sourceTrajectory:{opening,oldest,ids,det}});
          patches.push(cascadeAffineFinitePatch(cascadeSharedTetra(p),{matrix:[[1,0,0],[0,1,0],[0,0,1]],shift:[0,0,0]},stage.generation,`birth/${triangle.join('-')}/${ids.join('-')}`,null));
        }
      }
    } else {
      patches.push(cascadeAffineFinitePatch(source,{matrix:[[1,0,0],[0,1,0],[0,0,1]],shift:[0,0,0]},stage.generation,'boundary-birth',null));
    }
  }
  if(patches.length>6144||patches.some(p=>p.facets.length>192))throw new Error('Finite physical patch/facet capacity exceeded');
  return {patches,...stats,exactCommonAffine:stage.uniformControl!==null,sourceBranch};
}

/** One exact map is cut locally into destination cells without deleting a side
 * or applying a volume fit. Its incidence records remain on the finite patch. */
export function cascadeFinitePatchCells(patch:CascadeFinitePatch,h:number):{cell:CascadeVec3;poly:CascadePoly}[]{return cascadeCellSplit(patch.poly,h);}

export interface CascadeFiniteArrival {time:number;piece:number;solid:number;point:CascadeVec3;axis:number;direction:number}
/** Bracket transverse first arrival with the same frozen carrier query used
 * for physical descendants. Initial touching/departing points are not new
 * arrivals. A later positive-solid check still rejects any uncovered event;
 * this finite-face bracket never licenses post-penetration pressure repair. */
export function cascadeFirstFiniteArrival(stage:CascadeStageConstruction,input:CascadePiece[],solids:CascadeSolid[],dt:number):CascadeFiniteArrival|null {
  let event:CascadeFiniteArrival|null=null;
  for(let i=0;i<input.length;i++)for(const start of [...new Map(input[i].poly.faces.flat().map(p=>[p.join(','),p])).values()]){
    const stats={crossings:0,maximumNormalMismatch:0},end=cascadeForwardInterface(stage,start,dt,i,stats);
    for(let s=0;s<solids.length;s++)for(let axis=0;axis<3;axis++)for(const direction of [-1,1]){
      const coordinate=direction>0?solids[s].lo[axis]:solids[s].hi[axis];
      if(direction*(start[axis]-coordinate)>=0||direction*(end[axis]-coordinate)<0)continue;
      let lo=0,hi=dt;for(let k=0;k<48;k++){const mid=(lo+hi)/2,p=cascadeForwardInterface(stage,start,mid,i,{crossings:0,maximumNormalMismatch:0});if(direction*(p[axis]-coordinate)<0)lo=mid;else hi=mid;}
      const point=cascadeForwardInterface(stage,start,hi,i,{crossings:0,maximumNormalMismatch:0});point[axis]=coordinate;
      if(point.some((v,d)=>d!==axis&&(v<solids[s].lo[d]||v>solids[s].hi[d])))continue;
      if(!event||hi<event.time)event={time:hi,piece:i,solid:s,point,axis,direction};
    }
  }
  return event;
}
