/** First-generation placement only. Established property reads a retained
 * window source instead of rerunning this search around changed buildings. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 03:58:01
 * Dependents: systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/props/propGenerationSource.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import type { GroundWorld } from '../bridge/groundChunkLoader';
import type { PropInstance, PropAffiliation } from './propSchema';
import { propSourceId } from './propSchema';
import { surfaceGateFor } from './catalog';
import { fitToSurface, rejectReasonFor, FEET_PER_METER, type SurfaceProbe } from '../terrain/surfaceProbe';
import { TOWN_THRESHOLDS } from '../placement/thresholds';
import { fnv1a } from '../seedPath';
import { createPropGeometriesV1, disposePropGeometriesV1, propRenderScaleV1, propShapeV1, propWorldVerticalLiftV1, type PropGeometriesV1 } from './generators/propRenderRecipeV1';
import { exteriorPropSearchPoints } from './exteriorPropRepair';
import { createFreshPropClearance } from './freshPropClearance';
import { convexFootprint, type FootprintPoint } from './propFootprint';
import { propLandConstraint } from './propLandUse';
import { renderedPropPose } from '@/components/World3D/groundPropGeometry';

export interface FreshPropPlacementReport {
  considered: number;
  kept: number;
  moved: number;
  declined: Array<{sourceId: string; defId: string; reason: string; affiliation?: PropAffiliation}>;
}

interface ContactModel { points: THREE.Vector3[]; feet: THREE.Vector3[] }
// A bounded search often retries the same rigid art thousands of times on flat
// ground. Reuse that exact local shape, not its world pose or ground samples.
// Weak library ownership and a 64-entry cap avoid retaining a town's geometry.
const modelCache=new WeakMap<PropGeometriesV1,Map<string,ContactModel|undefined>>();
/** The low actual vertices are contact feet, not an invented base across holes
 * between posts. Every vertex still participates in penetration checks. */
function modelPoints(prop: PropInstance, library: PropGeometriesV1):ContactModel|undefined {
  let cache=modelCache.get(library);
  if(!cache){cache=new Map();modelCache.set(library,cache);}
  const key=JSON.stringify([prop.defId,prop.variation.variant,propRenderScaleV1(prop,{x:0,z:0}),
    prop.rotationRad,prop.surface?.tiltRad??0,prop.surface?.tiltAxis??[1,0]]);
  if(cache.has(key))return cache.get(key);
  const shape=propShapeV1(prop,{x:0,z:0},library);
  if(!shape?.triangles.length)return undefined;
  const unique=new Map<string,THREE.Vector3>();
  for(const point of shape.triangles.flat())unique.set(point.map(v=>v.toFixed(7)).join(','),new THREE.Vector3(...point));
  const points=[...unique.values()];
  if(points.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))return undefined;
  const minY=Math.min(...points.map(p=>p.y));
  const footBand=Math.min(.08,TOWN_THRESHOLDS.contactToleranceFt/FEET_PER_METER);
  const feet=points.filter(p=>p.y<=minY+footBand);
  const model={points,feet};
  if(cache.size>=64)cache.delete(cache.keys().next().value!);
  cache.set(key,model);
  return model;
}

/** Seat rigid art against its real contact feet using the existing surface
 * admission and town tolerances. Terrain and appearance never change. */
function freshSurfacePose(prop: Readonly<PropInstance>, probe: SurfaceProbe): PropInstance | undefined {
  const gate=surfaceGateFor(prop.defId),sample=probe.sampleAt(prop.xM*FEET_PER_METER,prop.zM*FEET_PER_METER);
  const roll=fnv1a(`${prop.defId}:${prop.xM}:${prop.zM}`)/4294967296;
  if(![sample.elevationFt,sample.slopeRad,...sample.normal].every(Number.isFinite)||rejectReasonFor(sample,gate,roll)!==null)return;
  const fit=fitToSurface(sample,gate);
  // JSON has one zero. Normalize the newly born axis before freezing it,
  // rather than changing an established pose when a save reloads.
  const result:PropInstance={...prop,variation:{...prop.variation},surface:{groundYM:0,sinkM:0,tiltRad:fit.tiltRad,tiltAxis:[fit.tiltAxis[0]+0,fit.tiltAxis[1]+0]}};
  return result;
}

export function seatFreshProp(prop: Readonly<PropInstance>, probe: SurfaceProbe, library: PropGeometriesV1): PropInstance | undefined {
  const result=freshSurfacePose(prop,probe);if(!result)return;
  const model=modelPoints(result,library);if(!model||model.feet.length<3)return;
  const pose=renderedPropPose(result,0);
  const points=model.points.map(p=>p.clone().applyMatrix4(pose));
  const feet=model.feet.map(p=>p.clone().applyMatrix4(pose));
  const offsets:number[]=[],slopes:number[]=[];
  for(const point of feet){const ground=probe.sampleAt(point.x*FEET_PER_METER,point.z*FEET_PER_METER);
    if(![ground.elevationFt,ground.slopeRad].every(Number.isFinite))return;
    offsets.push(ground.elevationFt/FEET_PER_METER-point.y);slopes.push(ground.slopeRad);}
  offsets.sort((a,b)=>a-b);
  let base=offsets[Math.floor(offsets.length/2)];
  // An unsampled narrow tip cannot disappear below the ground to rescue the
  // contact ratio. Lift only the prop, then recheck all contact feet.
  for(const point of points){const ground=probe.sampleAt(point.x*FEET_PER_METER,point.z*FEET_PER_METER);
    if(!Number.isFinite(ground.elevationFt))return;
    base=Math.max(base,(ground.elevationFt-TOWN_THRESHOLDS.maxPenetrationFt)/FEET_PER_METER-point.y);}
  const contact=offsets.filter(offset=>Math.abs(base-offset)*FEET_PER_METER<=TOWN_THRESHOLDS.contactToleranceFt+1e-7).length/offsets.length;
  const mean=slopes.reduce((s,v)=>s+v,0)/slopes.length;
  const variance=slopes.reduce((s,v)=>s+(v-mean)**2,0)/slopes.length;
  if(contact<TOWN_THRESHOLDS.minContactRatio||variance>TOWN_THRESHOLDS.maxSupportSlopeVarianceRad2)return;
  result.surface!.groundYM=base;return result;
}

// Each search reuses the rigid art at zero lean/yaw. Only its actual candidate
// transform changes. Keep this cache bounded and owned by the disposable library.
const footprintModelCache=new WeakMap<PropGeometriesV1,Map<string,THREE.Vector3[]>>();
const footprintProjectionCache=new WeakMap<PropGeometriesV1,Map<string,FootprintPoint[]>>();
/** Actual model projection, including frozen scale, yaw and surface lean.
 * The recipe's post-rotation vertical lift has no horizontal component. */
export function freshPropFootprint(prop:PropInstance,supplied?:PropGeometriesV1):FootprintPoint[] {
  const library=supplied??createPropGeometriesV1();
  try{
    let cache=footprintModelCache.get(library);if(!cache){cache=new Map();footprintModelCache.set(library,cache);}
    const scale=propRenderScaleV1(prop,{x:0,z:0}),key=JSON.stringify([prop.defId,prop.variation.variant,scale]);
    let points=cache.get(key);
    if(!points){
      const canonical={...prop,rotationRad:0,renderScale:scale,surface:{groundYM:0,sinkM:0,tiltRad:0,tiltAxis:[1,0] as [number,number]}};
      const model=modelPoints(canonical,library);if(!model)return [];
      const lift=propWorldVerticalLiftV1(canonical,{x:0,z:0},library);
      points=model.points.map(point=>new THREE.Vector3(point.x,point.y-lift,point.z));
      if(cache.size>=64)cache.delete(cache.keys().next().value!);cache.set(key,points);
    }
    let projections=footprintProjectionCache.get(library);if(!projections){projections=new Map();footprintProjectionCache.set(library,projections);}
    const poseKey=JSON.stringify([key,prop.rotationRad,prop.surface?.tiltRad??0,prop.surface?.tiltAxis??[1,0]]);
    let hull=projections.get(poseKey);
    if(!hull){
      const pose=renderedPropPose({...prop,xM:0,zM:0},0),v=new THREE.Vector3();
      hull=convexFootprint(points.map(point=>{v.copy(point).applyMatrix4(pose);return {x:v.x,z:v.z};}));
      if(projections.size>=64)projections.delete(projections.keys().next().value!);projections.set(poseKey,hull);
    }
    return hull.map(p=>({x:p.x+prop.xM,z:p.z+prop.zM}));
  }finally{if(!supplied)disposePropGeometriesV1(library);}
}

function broadRadius(prop:PropInstance,library:PropGeometriesV1):number|undefined {
  const upright={...prop,surface:{groundYM:0,sinkM:0,tiltRad:0,tiltAxis:[1,0] as [number,number]}};
  const model=modelPoints(upright,library);if(!model)return;
  const radial=Math.max(...model.points.map(p=>Math.hypot(p.x,p.z)));
  const height=Math.max(...model.points.map(p=>Math.abs(p.y)));
  return radial+height*Math.sin(surfaceGateFor(prop.defId).maxTiltRad)+.001;
}

/** Keep every accepted original field and seeded size. A declined FIRST
 * candidate is reported before it becomes established property; saved sources
 * never take this path. Existing purposeful under-stall stocking is preserved. */
export function placeFreshProps(ground:GroundWorld, originals:readonly PropInstance[],probe:SurfaceProbe):{props:PropInstance[];report:FreshPropPlacementReport} {
  const library=createPropGeometriesV1();
  try{
    const report:FreshPropPlacementReport={considered:originals.length,kept:0,moved:0,declined:[]};
    const candidates=originals.map(original=>{
      const prop:PropInstance={...original,variation:{...original.variation},
        ...(original.affiliation ? {affiliation:{...original.affiliation}} : {}),
        renderRecipe:'props-v1',renderScale:propRenderScaleV1(original,{x:0,z:0})};
      prop.renderRadiusM=broadRadius(prop,library);return prop;
    });
    const clearance=createFreshPropClearance(ground);
    // Internal candidate keys stay unique even before a final source address
    // is born. Saved identity checks still refuse duplicate final addresses.
    candidates.forEach((prop,index)=>clearance.setProp('candidate:'+index,freshPropFootprint(prop,library)));
    const props:PropInstance[]=[];
    const decline=(original:PropInstance,key:string,reason:string)=>{
      report.declined.push({sourceId:propSourceId(original),defId:original.defId,reason,
        ...(original.affiliation?{affiliation:structuredClone(original.affiliation)}:{}),
      });
      clearance.removeProp(key);
    };
    for(const [index,original] of candidates.entries()){
      const key='candidate:'+index,radius=original.renderRadiusM;
      if(!(radius&&Number.isFinite(radius))){decline(original,key,'unknown-art');continue;}
      const land=propLandConstraint(ground,original);
      if(land.issue){decline(original,key,land.issue);continue;}
      const surface=land.surface??probe;
      const attempt=(candidate:PropInstance,checkNeighbours:boolean)=>{
        // A model wholly beyond its source land cannot fit there. This padded
        // bound only skips impossible searches; near the lot, exact tilted
        // hull, route, neighbor and all-vertex support checks still decide.
        const bounds=land.bounds;
        if(bounds && (candidate.xM+radius<bounds.minX || candidate.xM-radius>bounds.maxX
          || candidate.zM+radius<bounds.minZ || candidate.zM-radius>bounds.maxZ))return;
        const pose=freshSurfacePose(candidate,surface);if(!pose)return;
        const hull=freshPropFootprint(pose,library);
        // Reject occupied ground before the expensive all-vertex support test.
        if(!land.containsHull(hull)||!clearance.isClear(hull,key,checkNeighbours))return;
        const seated=seatFreshProp(candidate,surface,library);
        return seated?{prop:seated,hull}:undefined;
      };
      // Preserve purposeful original stocking beneath a shared stall. Moved
      // candidates must clear other model hulls, never just their centers.
      let accepted=attempt(original,false);
      if(!accepted)for(const point of exteriorPropSearchPoints({x:original.xM,z:original.zM})){
        accepted=attempt({...original,xM:point.x,zM:point.z},true);
        if(accepted)break;
      }
      if(!accepted){decline(original,key,original.affiliation?'no-clear-supported-affiliated-site':'no-clear-supported-site');continue;}
      if(accepted.prop.xM!==original.xM||accepted.prop.zM!==original.zM)report.moved++;
      props.push(accepted.prop);clearance.setProp(key,accepted.hull);
    }
    report.kept=props.length;return {props,report};
  }finally{disposePropGeometriesV1(library);}
}
