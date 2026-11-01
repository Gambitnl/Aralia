/** Nearby furnishings remain discoverable when walls make pointer aiming
 * difficult. This nominates reached pieces; the existing examination handler
 * still owns fresh source validation, reading, rest and permission checks. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 20:26:15
 * Dependents: components/World3D/NearbyFurnishingChoices.tsx, components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx
 * Imports: 7 files
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
import type {BlueprintPlan} from '@/systems/worldforge/interior/blueprintTypes';
import {siteOrientationFromQuad,sitePartScenePosition,worldOffsetToSiteLocal} from '@/systems/worldforge/bridge/sitePartTransform';
import {groundSurfaceYM} from './terrain/groundSurfaceYM';
import {GroundFurnishingContext} from './GroundFurnishingContext';
import {furnishingReachError,type AvatarFootfall,type FurnishingPick} from './groundFurnishingInteraction';

type Candidate={id:string;name:string;pick:FurnishingPick};
export type NearbyFurnishingAction={id:string;name:string;detail?:string;activate:()=>void};
export type ResolveFurnishingPlan=(siteId:string)=>Promise<BlueprintPlan|null>;

/** Index mounted source pieces once. Each furnishing may render several boxes;
 * keep one original receipt rather than publishing duplicate shelf buttons. */
export function mountedFurnishings(ground:GroundWorld|null,loaded:LoadedChunk[]):Candidate[]{
  if(!ground)return [];
  const mounted=new Set(loaded.flatMap(chunk=>chunk.bundle.sites.map(site=>site.id)));
  return ground.buildings.flatMap(building=>{
    if(!mounted.has(building.id)||!/^wf-plot-\d+-\d+$/.test(building.id)||building.cornersM.length<4)return [];
    const transform={groupX:building.xM,groupZ:building.zM,surfaceY:groundSurfaceYM(ground,building.xM,building.zM),...siteOrientationFromQuad(building.cornersM)};
    const seen=new Set<string>();
    return building.parts.flatMap(part=>{
      const f=part.furnishing;
      if(!f||part.w<=0||part.d<=0||part.h<=0)return [];
      const id=`${building.id}/${f.level}/${f.index}`;
      if(seen.has(id))return [];seen.add(id);
      return [{id,name:f.kind.replace(/[-_]/g,' '),pick:{siteId:building.id,part,transform}}];
    });
  });
}

/** Cheap radius/floor prefilter: only reached buildings load their canonical
 * plans. The shared reach function then rejects other rooms and stale pieces. */
export function nearbyFurnishingCandidates(candidates:readonly Candidate[],feet:AvatarFootfall|null):Candidate[]{
  if(!feet||![feet.xM,feet.yM,feet.zM].every(Number.isFinite))return [];
  return candidates.flatMap(candidate=>{
    const {part,transform:t}=candidate.pick;
    if(Math.abs(feet.yM-t.surfaceY-(part.baseY??0))>.75)return [];
    const p=worldOffsetToSiteLocal(feet.xM-t.groupX,feet.zM-t.groupZ,t.rotationY);
    const distance=Math.hypot(Math.max(0,Math.abs(p.lx-part.x)-part.w/2),Math.max(0,Math.abs(p.lz*-t.doorZSign-part.z)-part.d/2));
    return distance<=1.5?[{candidate,distance}]:[];
  }).sort((a,b)=>a.distance-b.distance||a.candidate.id.localeCompare(b.candidate.id)).map(entry=>entry.candidate);
}

/** Describe only a piece already admitted by the shared physical reach check.
 * Compass directions use its rendered center, while distance uses the same
 * nearest surface as reach. This is a view hint, never another access rule. */
function furnishingLocationHint(candidate:Candidate,feet:AvatarFootfall,plan:BlueprintPlan):string{
  const {part,transform:t}=candidate.pick,identity=part.furnishing!;
  const room=plan.floors.find(f=>f.level===identity.level)?.rooms.find(r=>r.id===identity.roomId);
  const at=sitePartScenePosition(part,t),dx=at.x-feet.xM,dz=at.z-feet.zM;
  const directions=['north','northeast','east','southeast','south','southwest','west','northwest'];
  const direction=Math.hypot(dx,dz)<.15?'beside you':directions[(Math.round(Math.atan2(dx,-dz)/(Math.PI/4))+8)%8];
  const local=worldOffsetToSiteLocal(feet.xM-t.groupX,feet.zM-t.groupZ,t.rotationY);
  const distance=Math.hypot(Math.max(0,Math.abs(local.lx-part.x)-part.w/2),Math.max(0,Math.abs(local.lz*-t.doorZSign-part.z)-part.d/2));
  const feetAway=Math.round(distance/.3048);
  return [room?.purpose.replace(/[-_]/g,' '),direction,feetAway?feetAway+' ft away':'within reach'].filter(Boolean).join(' · ');
}

export function NearbyFurnishing({ground,loaded,readFootfall,resolvePlan,enabled,onChange}:{
  ground:GroundWorld|null;loaded:LoadedChunk[];readFootfall:()=>AvatarFootfall|null;
  resolvePlan?:ResolveFurnishingPlan;enabled:boolean;onChange?:(actions:NearbyFurnishingAction[])=>void;
}){
  const context=useContext(GroundFurnishingContext);
  const candidates=useMemo(()=>mountedFurnishings(ground,loaded),[ground,loaded]);
  const plans=useRef(new Map<string,BlueprintPlan|null>());
  const current=useRef({context,candidates,readFootfall,resolvePlan,enabled,onChange});
  current.current={context,candidates,readFootfall,resolvePlan,enabled,onChange};
  const alive=useRef(true),last=useRef(''),elapsed=useRef(.1);
  useEffect(()=>{plans.current=new Map();last.current='reset';},[candidates,resolvePlan]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;onChange?.([]);};},[onChange]);
  useFrame((_,delta)=>{
    elapsed.current+=delta;if(elapsed.current<.1)return;elapsed.current=0;
    const c=current.current,feet=c.readFootfall();
    const nearby=c.enabled&&c.context?.onSelect&&c.resolvePlan?nearbyFurnishingCandidates(c.candidates,feet):[];
    const ready=nearby.filter(candidate=>{
      const id=candidate.pick.siteId;
      if(!plans.current.has(id)){
        const cache=plans.current;cache.set(id,null);
        // A pending result belongs to this source generation. Loading another
        // world or changed history cannot publish an old room's interaction.
        c.resolvePlan!(id).then(plan=>{if(alive.current&&plans.current===cache)cache.set(id,plan);}).catch(()=>{});
      }
      const plan=plans.current.get(id);
      return plan&&furnishingReachError(plan,candidate.pick,feet)===null;
    });
    // Moving within reach can change the useful location hint without changing
    // the candidate set. Publish that change, keeping the exact original pick.
    const described=ready.map(candidate=>({candidate,detail:furnishingLocationHint(candidate,feet!,plans.current.get(candidate.pick.siteId)!)}));
    const signature=JSON.stringify(described.map(({candidate,detail})=>[candidate.id,detail]));
    if(signature===last.current)return;last.current=signature;
    c.onChange?.(described.map(({candidate,detail})=>({id:candidate.id,name:candidate.name,detail,activate:()=>{
      const live=current.current;
      if(!alive.current||!live.enabled||!live.context?.onSelect)return;
      const now=nearbyFurnishingCandidates(live.candidates,live.readFootfall()).find(p=>p.id===candidate.id);
      const plan=now&&plans.current.get(now.pick.siteId);
      if(!now||!plan||furnishingReachError(plan,now.pick,live.readFootfall()))return;
      live.context.onSelect(now.pick);
    }})));
  });
  return null;
}
