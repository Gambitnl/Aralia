/** Ordinary swimming spends the shared movement cost while moving the same
 * measured body continuously through source water. Walking still owns dry
 * ground and support; this solver cannot lift a loaded body or choose a route.
 * Callers must explicitly request swimming and persist its mode, elapsed breath
 * exposure and actual feet before this can be used in native gameplay. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 02/11/2026, 18:03:43
 * Dependents: None (Orphan)
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import {groundSurfaceY} from '@/systems/worldforge/bridge/groundChunkLoader';
import {GROUND_METERS_PER_CELL} from '@/systems/worldforge/bridge/groundWorldAdapter';
import {inspectGroundWater} from '@/systems/worldforge/bridge/groundWaterSurfaceQuery';
import {applyMovementCostModifiers} from '@/utils/combat/physicsUtils';
import {groundBodyVolumeClear,type GroundWalkSurfaces} from './groundBuildingMotion';
import {sweepActorVolumes,type ActorBody,type ActorPoint,type ActorSpace} from './actorPersonalSpace';

export interface GroundSwimBody {heightM:number;mouthHeightM:number;radiusM:number;footprint:NonNullable<ActorBody['footprint']>}
export type GroundSwimResult=ActorPoint&{blocked:boolean;spentMovementM:number;distanceM:number;mouthSubmerged:boolean;reason?:'unknown-water'|'unknown-body'|'terrain'|'structure'|'person'|'shore'|'above-water'};
const STEP_M=.04;
const NO_DOORS:ReadonlySet<string>=new Set();

/** Bilinear source heights stay below the maximum on each grid-cell boundary.
 * Use the full swept body's projected box, including its corners and every
 * source grid crossing. This is conservative at diagonal margins; it does not
 * shrink a shield/weapon envelope or certify clearance from a center ray. */
export function swimTerrainClear(ground:GroundWorld,from:ActorPoint,to:ActorPoint,body:GroundSwimBody):boolean {
  const f=body.footprint,c=Math.cos(f.yawRad),s=Math.sin(f.yawRad);
  const corners=[f.minXM,f.maxXM].flatMap(x=>[f.minZM,f.maxZM].map(z=>({x:x*c+z*s,z:-x*s+z*c})));
  const minX=Math.min(from.xM,to.xM)+Math.min(...corners.map(p=>p.x)),maxX=Math.max(from.xM,to.xM)+Math.max(...corners.map(p=>p.x));
  const minZ=Math.min(from.zM,to.zM)+Math.min(...corners.map(p=>p.z)),maxZ=Math.max(from.zM,to.zM)+Math.max(...corners.map(p=>p.z)),m=GROUND_METERS_PER_CELL;
  if(![minX,maxX,minZ,maxZ,from.yM,to.yM].every(Number.isFinite)||minX<0||minZ<0||maxX>(ground.cols-1)*m||maxZ>(ground.rows-1)*m)return false;
  const points=(lo:number,hi:number)=>{const v=[lo,hi];for(let k=Math.ceil(lo/m);k*m<hi;k++)v.push(k*m);return v;};
  const xs=points(minX,maxX),zs=points(minZ,maxZ);if(xs.length*zs.length>4096)return false;
  const feetY=Math.min(from.yM,to.yM);
  for(const x of xs)for(const z of zs){const y=groundSurfaceY(ground,x,z);if(!Number.isFinite(y)||y>feetY+1e-6)return false;}
  return true;
}

/** A caller supplies one already budgeted movement amount, in meters. Native
 * swimming without a special speed costs two movement meters per meter moved.
 * Breath, conditions and time remain caller-owned: this result reports whether
 * the actual mouth is submerged and never fabricates a fresh air supply. */
export function resolveGroundSwim(ground:GroundWorld,from:ActorPoint,requested:ActorPoint,budgetM:number,body:GroundSwimBody,
  surfaces:GroundWalkSurfaces|undefined,doors:ReadonlySet<string>=NO_DOORS,actors?:ActorSpace,key='player',hasSwimSpeed=false):GroundSwimResult {
  const stopped=(reason:GroundSwimResult['reason']):GroundSwimResult=>({...from,blocked:true,spentMovementM:0,distanceM:0,mouthSubmerged:true,reason});
  const f=body.footprint;
  if(!f||![body.heightM,body.mouthHeightM,body.radiusM,f.minXM,f.maxXM,f.minZM,f.maxZM,f.yawRad,...Object.values(from),...Object.values(requested),budgetM].every(Number.isFinite)
    ||body.heightM<=0||body.mouthHeightM<=0||body.mouthHeightM>body.heightM||body.radiusM<=0||f.maxXM<=f.minXM||f.maxZM<=f.minZM||budgetM<0)return stopped('unknown-body');
  const initial=inspectGroundWater(ground,from.xM,from.zM);
  if(initial.status!=='valid')return stopped('unknown-water');
  if(initial.surfaceY===undefined||initial.surfaceY<=from.yM)return stopped('shore');
  if(!surfaces?.supportReadyAt?.(from.xM,from.zM))return stopped('unknown-water');
  const dx=requested.xM-from.xM,dy=requested.yM-from.yM,dz=requested.zM-from.zM,distance=Math.hypot(dx,dy,dz);
  const multiplier=applyMovementCostModifiers(1,{isSwimming:true,hasSwimSpeed});
  const length=Math.min(distance,budgetM/multiplier),steps=Math.max(1,Math.ceil(length/STEP_M));
  let pose={...from},spent=0,submerged=from.yM+body.mouthHeightM<initial.surfaceY;
  if(length<1e-9)return {...pose,blocked:false,spentMovementM:0,distanceM:0,mouthSubmerged:submerged};
  for(let i=1;i<=steps;i++){
    const t=length/distance*i/steps,next={xM:from.xM+dx*t,yM:from.yM+dy*t,zM:from.zM+dz*t};
    const stop=(reason:GroundSwimResult['reason']):GroundSwimResult=>({...pose,blocked:true,spentMovementM:spent*multiplier,distanceM:spent,mouthSubmerged:submerged,reason});
    const water=inspectGroundWater(ground,next.xM,next.zM);
    if(water.status!=='valid'||!surfaces.supportReadyAt?.(next.xM,next.zM))return stop('unknown-water');
    if(water.surfaceY===undefined||water.surfaceY<=next.yM)return stop('shore');
    // The upright swimmer may bring their mouth clear, not fly out of water.
    if(next.yM+body.mouthHeightM>water.surfaceY+.1+1e-7)return stop('above-water');
    if(!swimTerrainClear(ground,pose,next,body))return stop('terrain');
    if(!groundBodyVolumeClear(ground,pose,next,{...pose,...body},doors))return stop('structure');
    const r=body.radiusM,h=body.heightM,lo=Math.min(pose.yM,next.yM),height=h+Math.abs(next.yM-pose.yM);
    // Each short step covers its whole vertical span; bridges cannot be
    // tunneled through by checking only the higher endpoint.
    if(surfaces.intersectsBody({...next,yM:lo},r,height))return stop('structure');
    for(const [id,other]of actors??[]){if(id===key)continue;const hit=sweepActorVolumes(pose,next,{...pose,...body},other);if(!hit||hit.hit||hit.inside)return stop('person');}
    spent+=Math.hypot(next.xM-pose.xM,next.yM-pose.yM,next.zM-pose.zM);pose=next;submerged=next.yM+body.mouthHeightM<water.surfaceY;
  }
  return {...pose,blocked:false,spentMovementM:spent*multiplier,distanceM:spent,mouthSubmerged:submerged};
}
