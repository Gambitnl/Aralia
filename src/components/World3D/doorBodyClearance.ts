/** Shared private-door clearance over live measured bodies. A conservative
 * quarter-turn query covers the space between the renderer's exact endpoint
 * poses. It grants no access, moves no body and never writes a door state. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 17:09:18
 * Dependents: components/World3D/groundDoorInteraction.ts, components/World3D/groundFurnishingInteraction.ts, components/World3D/residentDoorUse.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {SitePart} from '@/systems/worldforge/bridge/interiorParts';
import {siteDoorLocalPoseAtFraction,type SiteGroupTransform} from '@/systems/worldforge/bridge/sitePartTransform';
import {actorSpaceOverlaps,type ActorBody} from './actorPersonalSpace';
export const DOOR_BODY_REACH_M=1.5;
export type DoorBodies=ReadonlyMap<string,ActorBody>;
export interface DoorBodyClearance {valid:boolean;blockers:string[]}
const STEPS=12;
/** Unknown/malformed body data refuses a new operation. A controller already
 * holding an observed-open door uses this same refusal to postpone closing. */
export function doorBodyClearance(part:SitePart,t:SiteGroupTransform,bodies:DoorBodies|null|undefined,mode:'swing'|'closed'='swing'):DoorBodyClearance{
 if(!bodies||!part.door||![part.x,part.z,part.w,part.d,part.h,part.baseY??0,t.groupX,t.groupZ,t.surfaceY,t.rotationY,t.doorZSign].every(Number.isFinite)
  ||part.w<=0||part.d<=0||part.h<=0||![-1,1].includes(t.doorZSign)
  ||(part.door.axis!=='x'&&part.door.axis!=='y')
  ||(part.door.axis==='x'?(part.door.swingX!==0||Math.abs(part.door.swingZ)!==1):(part.door.swingZ!==0||Math.abs(part.door.swingX)!==1)))return {valid:false,blockers:[]};
 const checked:Array<[string,ActorBody]>=[];
 for(const [key,body]of bodies){
  const f=body.footprint;
  if(![body.xM,body.yM,body.zM,body.radiusM,body.heightM,body.marginM??0].every(Number.isFinite)||body.radiusM<=0||body.heightM<=0
   ||f&&(![f.minXM,f.maxXM,f.minZM,f.maxZM,f.yawRad].every(Number.isFinite)||f.maxXM<=f.minXM||f.maxZM<=f.minZM))return {valid:false,blockers:[]};
  checked.push([key,{...body,footprint:f??{minXM:-body.radiusM,maxXM:body.radiusM,minZM:-body.radiusM,maxZM:body.radiusM,yawRad:0}}]);
 }
 const blockers=new Set<string>(),count=mode==='closed'?0:STEPS;
 const length=part.door.axis==='x'?part.w:part.d,thickness=part.door.axis==='x'?part.d:part.w;
 // Any corner travels at most this distance from the nearest sampled pose.
 // Expanding each sampled box covers that arc, including between samples.
 const margin=mode==='closed'?0:2*Math.hypot(length,thickness/2)*Math.sin(Math.PI/2/STEPS/4);
 for(let i=0;i<=count;i++){
  const pose=siteDoorLocalPoseAtFraction(part,t.doorZSign,count?i/count:0),c=Math.cos(t.rotationY),s=Math.sin(t.rotationY);
  const obstacle:ActorBody={xM:t.groupX+pose.offset.x*c+pose.offset.z*s,zM:t.groupZ-pose.offset.x*s+pose.offset.z*c,
   yM:t.surfaceY+(part.baseY??0),heightM:part.h,radiusM:Math.hypot(part.w,part.d)/2,marginM:margin,
   footprint:{minXM:-part.w/2,maxXM:part.w/2,minZM:-part.d/2,maxZM:part.d/2,yawRad:t.rotationY+pose.rotationY}};
  const solid=new Map([['canonical-leaf',obstacle]]);
  for(const [key,body]of checked)if(!blockers.has(key)&&actorSpaceOverlaps(body,'actor',body,solid))blockers.add(key);
 }
 return {valid:true,blockers:[...blockers].sort()};
}
