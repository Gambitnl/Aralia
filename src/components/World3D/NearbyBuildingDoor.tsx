/** A reached town door stays usable when a narrow room makes pointer aiming
 * awkward. This publishes one nearby action from actual feet and mounted
 * source doors; activation still uses the existing guarded door handler.
 * It changes no door state itself and gives crossing residents priority. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 05:40:54
 * Dependents: components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {useContext,useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {LoadedChunk} from '@/systems/world3d/types';
import {doorPartForState,siteDoorKey,siteOrientationFromQuad,worldOffsetToSiteLocal} from '@/systems/worldforge/bridge/sitePartTransform';
import {groundSurfaceYM} from './terrain/groundSurfaceYM';
import {GroundFurnishingContext} from './GroundFurnishingContext';
import type {AvatarFootfall,FurnishingPick} from './groundFurnishingInteraction';

type Candidate={id:string;name:string;pick:FurnishingPick};
export type NearbyBuildingDoorAction={id:string;name:string;open:boolean;users:readonly string[];activate:()=>void};

/** Build once for the mounted source set, rather than scanning geometry every
 * frame. Unloaded buildings and non-town parts cannot advertise an action. */
export function mountedBuildingDoors(ground:GroundWorld|null,loaded:LoadedChunk[]):Candidate[]{
  if(!ground)return [];
  const mounted=new Set(loaded.flatMap(chunk=>chunk.bundle.sites.map(site=>site.id)));
  return ground.buildings.flatMap(building=>{
    if(!mounted.has(building.id)||!/^wf-plot-\d+-\d+$/.test(building.id)||building.cornersM.length<4)return [];
    const orientation=siteOrientationFromQuad(building.cornersM);
    const transform={groupX:building.xM,groupZ:building.zM,surfaceY:groundSurfaceYM(ground,building.xM,building.zM),...orientation};
    return building.parts.filter(part=>part.door&&part.w>0&&part.d>0&&part.h>0).map(part=>({
      id:siteDoorKey(building.id,part),name:building.name||'Building entrance',pick:{siteId:building.id,part,transform},
    }));
  });
}

/** This only nominates a nearby door. The handler still checks the current
 * source plan, entry room, swing clearance and fresh actual body at action time. */
export function nearestBuildingDoor(candidates:readonly Candidate[],feet:AvatarFootfall|null,opens:ReadonlySet<string>){
  if(!feet||![feet.xM,feet.yM,feet.zM].every(Number.isFinite))return null;
  let best:{candidate:Candidate;distance:number;open:boolean}|null=null;
  for(const candidate of candidates){
    const {part,transform:t}=candidate.pick;
    if(Math.abs(feet.yM-t.surfaceY-(part.baseY??0))>.75)continue;
    const p=worldOffsetToSiteLocal(feet.xM-t.groupX,feet.zM-t.groupZ,t.rotationY);
    const leaf=doorPartForState(part,opens.has(candidate.id));
    const distance=Math.hypot(Math.max(0,Math.abs(p.lx-leaf.x)-leaf.w/2),Math.max(0,Math.abs(p.lz*-t.doorZSign-leaf.z)-leaf.d/2));
    if(distance>1.5)continue;
    if(!best||distance<best.distance||distance===best.distance&&candidate.id<best.candidate.id)
      best={candidate,distance,open:opens.has(candidate.id)};
  }
  return best;
}

const CLOSED:ReadonlySet<string>=new Set();
export function NearbyBuildingDoor({ground,loaded,readFootfall,enabled,onChange}:{
  ground:GroundWorld|null;loaded:LoadedChunk[];readFootfall:()=>AvatarFootfall|null;
  enabled:boolean;onChange?:(action:NearbyBuildingDoorAction|null)=>void;
}){
  const context=useContext(GroundFurnishingContext);
  const candidates=useMemo(()=>mountedBuildingDoors(ground,loaded),[ground,loaded]);
  const current=useRef({context,candidates,readFootfall,enabled,onChange});
  current.current={context,candidates,readFootfall,enabled,onChange};
  const alive=useRef(true),last=useRef(''),elapsed=useRef(.1);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;onChange?.(null);};},[onChange]);
  useFrame((_,delta)=>{
    elapsed.current+=delta;if(elapsed.current<.1)return;elapsed.current=0;
    const c=current.current;
    const found=c.enabled&&c.context?.onDoor?nearestBuildingDoor(c.candidates,c.readFootfall(),c.context.openDoors??CLOSED):null;
    const users=found?c.context?.doorUsers?.get(found.candidate.id)??[]:[];
    const signature=found?JSON.stringify([found.candidate.id,found.open,users,found.candidate.name]):'';
    if(signature===last.current)return;last.current=signature;
    if(!found){c.onChange?.(null);return;}
    const id=found.candidate.id;
    c.onChange?.({id,name:found.candidate.name,open:found.open,users,activate:()=>{
      const live=current.current;
      if(!alive.current||!live.enabled||!live.context?.onDoor)return;
      // A stale button never opens yesterday's door after walking, unloading,
      // pausing or another resident starting to cross the threshold.
      const now=nearestBuildingDoor(live.candidates,live.readFootfall(),live.context.openDoors??CLOSED);
      if(now?.candidate.id!==id||now.open!==found.open||live.context.doorUsers?.get(id)?.length)return;
      live.context.onDoor(now.candidate.pick);
    }});
  });
  return null;
}
