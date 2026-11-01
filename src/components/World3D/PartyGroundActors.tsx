/** Party membership has a physical presence. Reuse the player's generated body,
 * gait and collision/water/step solver, but give each person their own feet and
 * pending accepted-footstep trail. A follower never owns the camera or input. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 08:31:23
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React,{useRef,useState,useEffect,useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {SceneOrigin} from '@/systems/world3d/sceneOrigin';
import type {GroundWalkSurfaces} from './groundBuildingMotion';
import type {CompanionPosition,PartyCompanionPresence} from '@/systems/companions/companionWhereabouts';
import PlayerAvatar from './PlayerAvatar';
import {PartyGroundTrail} from './partyGroundTrail';

interface Props {
 members:PartyCompanionPresence[];ground:GroundWorld;sceneOrigin:SceneOrigin;
 leader:Readonly<{current:CompanionPosition|null}>;paused?:boolean;openDoors?:ReadonlySet<string>;walkingSurfaces?:GroundWalkSurfaces;
 onPosition?:(id:string,pose:CompanionPosition,trail:CompanionPosition[])=>void;
 onTalk?:(id:string)=>void;
}
function Follower({member,index,...props}:Omit<Props,'members'>&{member:PartyCompanionPresence;index:number}){
 // Physical checkpoint updates create new selector objects. Identical observed
 // appearance must not reassemble an expensive body on every saved footfall.
 const recipeKey=JSON.stringify(member.recipe);
 const recipe=useMemo(()=>member.recipe,[recipeKey]);
 const trail=useRef(new PartyGroundTrail(member.trail)),feet=useRef({...member.position});
 const target=useRef<{xM:number;zM:number}|null>(null),blocked=useRef(false),lastLeader=useRef<CompanionPosition|null>(null);
 const [notice,setNotice]=useState<string|null>(null);
 const initialized=useRef(member.canFollow);
 useEffect(()=>{blocked.current=false;},[props.openDoors]);
 useFrame(()=>{
  const leader=props.leader.current;if(!leader||props.paused){target.current=null;return;}
  const near=Math.hypot(leader.xM-feet.current.xM,leader.zM-feet.current.zM,leader.yM-feet.current.yM)<=3;
  if((!initialized.current||trail.current.overflowed)&&near){trail.current.reunite(leader);initialized.current=true;setNotice(null);}
  if(!initialized.current){target.current=null;return;}
  if(lastLeader.current&&Math.hypot(leader.xM-lastLeader.current.xM,leader.zM-lastLeader.current.zM)>.15)blocked.current=false;
  lastLeader.current={...leader};trail.current.observe(leader);
  if(trail.current.overflowed){target.current=null;setNotice(`${member.character.name} lost your trail. Return to them.`);return;}
  target.current=blocked.current?null:trail.current.target(feet.current,2.25*(index+1));
 },-.7);
 return <PlayerAvatar character={member.character} recipe={recipe}
  actorId={member.character.id} trackCamera={false} routeTarget={target}
  groundPos={member.position} ground={props.ground} sceneOrigin={props.sceneOrigin} startSurfaceY={member.position.yM}
  openDoors={props.openDoors} walkingSurfaces={props.walkingSurfaces}
  onTalk={props.onTalk?()=>props.onTalk!(member.character.id):undefined} actorNotice={notice}
  onPositionChange={pose=>{feet.current=pose;props.onPosition?.(member.character.id,pose,trail.current.snapshot());}}
  onMovementBlocked={()=>{blocked.current=true;target.current=null;setNotice(`${member.character.name}'s way is blocked. Wait or find another approach.`);}}
 />;
}
export default function PartyGroundActors({members,...props}:Props){
 return <>{members.map((member,index)=><Follower key={member.character.id} member={member} index={index} {...props}/>)}</>;
}
