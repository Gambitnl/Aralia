/** Place a native finite cliff and its surface queries downstream.
 * This moves the existing stored triangles, including ledge sides and
 * undersides, instead of adding height noise or a decorative wall. The
 * resulting geometry is a candidate: ground joins, exterior material and
 * water admission must qualify before a live landscape may install it.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/10/2026, 05:21:18
 * Dependents: components/World3D/water/riverSistersCliffSurface.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import {createNativeCliffSampler} from './riverWaterfallCliff';
import {bindNativeBoundaryEpoch} from './riverNativeBoundaryAtlas';

interface HorizontalFrame {x:number;z:number;tx:number;tz:number}
export interface CliffFrameDescription {
  owner:string;source:HorizontalFrame;target:HorizontalFrame;
  sourceFloorY:number;sourceCrestY:number;targetFloorY:number;targetCrestY:number;
  lateralScale:number;forwardScale:number;runM:number;
}

/** An invertible placement preserves native face lineage. Its shear lets
 * the foot lie farther down the river than the crest; elevation is never
 * inferred from absolute world Y or the original source's fixed location. */
export class RiverCliffFrame {
  readonly description:Readonly<CliffFrameDescription>;
  readonly volumeScale:number;
  constructor(description:CliffFrameDescription){
    const d=description,numbers=[...Object.values(d.source),...Object.values(d.target),d.sourceFloorY,d.sourceCrestY,
      d.targetFloorY,d.targetCrestY,d.lateralScale,d.forwardScale,d.runM];
    if(!d.owner||!numbers.every(Number.isFinite)||d.sourceCrestY<=d.sourceFloorY||d.targetCrestY<=d.targetFloorY
      ||d.lateralScale<=0||d.forwardScale<=0||d.runM<0
      ||[d.source,d.target].some(f=>Math.abs(Math.hypot(f.tx,f.tz)-1)>1e-12))throw Error('Invalid finite cliff placement');
    this.description=Object.freeze({...d,source:Object.freeze({...d.source}),target:Object.freeze({...d.target})});
    this.volumeScale=d.lateralScale*d.forwardScale*(d.targetCrestY-d.targetFloorY)/(d.sourceCrestY-d.sourceFloorY);
  }
  toWorld(p:THREE.Vector3):THREE.Vector3 {
    const d=this.description,s=d.source,t=d.target,x=p.x-s.x,z=p.z-s.z;
    const v=(p.y-d.sourceFloorY)/(d.sourceCrestY-d.sourceFloorY);
    const forward=(x*s.tx+z*s.tz)*d.forwardScale+d.runM*(1-v);
    const n=(x*s.tz-z*s.tx)*d.lateralScale;
    return new THREE.Vector3(t.x+t.tx*forward+t.tz*n,d.targetFloorY+v*(d.targetCrestY-d.targetFloorY),t.z+t.tz*forward-t.tx*n);
  }
  toSource(p:THREE.Vector3):THREE.Vector3 {
    const d=this.description,s=d.source,t=d.target,x=p.x-t.x,z=p.z-t.z;
    const v=(p.y-d.targetFloorY)/(d.targetCrestY-d.targetFloorY);
    const forward=((x*t.tx+z*t.tz)-d.runM*(1-v))/d.forwardScale;
    const n=(x*t.tz-z*t.tx)/d.lateralScale;
    return new THREE.Vector3(s.x+s.tx*forward+s.tz*n,d.sourceFloorY+v*(d.sourceCrestY-d.sourceFloorY),s.z+s.tz*forward-s.tx*n);
  }
}

/** Find native open perimeter loops without welding or changing a face.
 * These are the actual vertex IDs a ground join must meet. Opposite edge
 * incidence is a topology check, not a proof of non-overlap or solid closure. */
export function inspectNativeCliffPerimeter(geometry:THREE.BufferGeometry,maximumEntries=1000000){
  const index=geometry.index,count=geometry.getAttribute('position').count;
  if(!index||count<3||index.count<3||index.count%3||!Number.isSafeInteger(maximumEntries)
    ||index.count>maximumEntries||count*count*2>=Number.MAX_SAFE_INTEGER)
    throw Error('Native cliff perimeter exceeds bounded indexed contract');
  const edges=new Float64Array(index.count);
  for(let e=0;e<index.count;e++){
    const a=index.getX(e),b=index.getX(e-e%3+(e%3+1)%3);
    if(a===b||!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||a>=count||b>=count)throw Error('Invalid native cliff edge');
    edges[e]=(Math.min(a,b)*count+Math.max(a,b))*2+(a<b?1:0);
  }
  edges.sort();const boundary:Array<[number,number]>=[];
  let pairedEdges=0,orientationConflicts=0,nonManifoldEdges=0;
  for(let i=0;i<edges.length;){
    const key=Math.floor(edges[i]/2);let end=i+1;
    while(end<edges.length&&Math.floor(edges[end]/2)===key)end++;
    const a=Math.floor(key/count),b=key%count;
    if(end-i===1)boundary.push(edges[i]%2?[a,b]:[b,a]);
    else if(end-i===2){pairedEdges++;if(edges[i]===edges[i+1])orientationConflicts++;}
    else nonManifoldEdges++;
    i=end;
  }
  const next=new Map<number,number>(),incoming=new Set<number>();let branched=false;
  const outgoingCount=new Map<number,number>(),incomingCount=new Map<number,number>();
  for(const [a,b] of boundary){if(next.has(a)||incoming.has(b))branched=true;next.set(a,b);incoming.add(b);
    outgoingCount.set(a,(outgoingCount.get(a)??0)+1);incomingCount.set(b,(incomingCount.get(b)??0)+1);}
  const branchVertices=[...new Set(boundary.flat())].filter(id=>(outgoingCount.get(id)??0)!==1||(incomingCount.get(id)??0)!==1)
    .map(id=>({id,outgoing:boundary.filter(e=>e[0]===id).map(e=>e[1]),incoming:boundary.filter(e=>e[1]===id).map(e=>e[0])}));
  const loops:number[][]=[];
  if(!branched&&!orientationConflicts&&!nonManifoldEdges){
    const remaining=new Set(next.keys());
    while(remaining.size){
      const start=remaining.values().next().value!,loop:number[]=[];let at=start;
      do{
        if(!remaining.delete(at)||!next.has(at))throw Error('Native cliff perimeter is not a loop');
        loop.push(at);at=next.get(at)!;
      }while(at!==start);
      loops.push(loop);
    }
  }
  return {pairedEdges,orientationConflicts,nonManifoldEdges,boundaryEdges:boundary.length,branched,branchVertices,loops,
    workEntries:edges.length,edgeStorageBytes:edges.byteLength,allEdgesPaired:boundary.length===0&&!orientationConflicts&&!nonManifoldEdges};
}

/** The posed mesh and sampler read ONE actual Float32 position buffer. An
 * inverse-transformed source sample would miss the new storage rounding and
 * could certify contact on a different triangle. Changes invalidate queries. */
export function poseNativeCliff(source:THREE.BufferGeometry,frame:RiverCliffFrame){
  const rails=source.userData.constructedRails as {crest:number[];floor:number[]}|undefined;
  if(!rails?.crest.length||!rails.floor.length||!source.index)throw Error('Native constructed cliff rails/index required');
  const geometry=source.clone(),positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){
    const p=frame.toWorld(new THREE.Vector3().fromBufferAttribute(positions,i));positions.setXYZ(i,p.x,p.y,p.z);
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const target=frame.description.target;
  let lateralMin=Infinity,lateralMax=-Infinity;
  for(const id of [...rails.crest,...rails.floor]){
    const n=(positions.getX(id)-target.x)*target.tz-(positions.getZ(id)-target.z)*target.tx;
    lateralMin=Math.min(lateralMin,n);lateralMax=Math.max(lateralMax,n);
  }
  const sample=createNativeCliffSampler({geometry,crest:target,lateralMin,lateralMax,
    floorY:positions.getY(rails.floor[0]),rails,rejectChanges:true});
  bindNativeBoundaryEpoch(geometry,{schema:'native-framed-cliff-candidate-v1',owner:frame.description.owner,
    frame:frame.description,volumeScale:frame.volumeScale,sourceGeometry:source.uuid,
    faceMapping:'same-elements-and-vertex-ids',qualification:'surface-query-only',
    closedSolid:false,groundJoins:'unqualified',waterAdmission:false});
  return {geometry,sample,frame};
}
