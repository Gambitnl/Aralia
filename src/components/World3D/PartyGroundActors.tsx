/** Party members keep physical bodies and accepted-footstep trails. A companion
 * may briefly sidestep when the leader presses their measured courtesy space,
 * then resumes that trail. Followers never own the camera or player input. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/11/2026, 00:17:19
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React,{useRef,useState,useEffect,useMemo,useContext} from 'react';
import {useFrame} from '@react-three/fiber';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {SceneOrigin} from '@/systems/world3d/sceneOrigin';
import type {GroundWalkSurfaces} from './groundBuildingMotion';
import type {CompanionPosition,PartyCompanionPresence} from '@/systems/companions/companionWhereabouts';
import {groundBodyVolumeRecoveryClear,resolveGroundWalk} from './groundBuildingMotion';
import {resolveGroundWaterWalk} from './groundWaterMovement';
import {actorCourtesySpace,actorSpaceOverlaps,yieldActorStep,type ActorBody,type ActorPoint,type ActorYieldRouteState} from './actorPersonalSpace';
import {ActorPersonalSpaceContext} from './ActorPersonalSpaceContext';
import {groundFrameSeconds,groundSpeedMps} from './groundLocomotion';
import PlayerAvatar from './PlayerAvatar';
import {PartyGroundTrail} from './partyGroundTrail';

interface Props {
 members:PartyCompanionPresence[];ground:GroundWorld;sceneOrigin:SceneOrigin;
 leader:Readonly<{current:CompanionPosition|null}>;paused?:boolean;openDoors?:ReadonlySet<string>;walkingSurfaces?:GroundWalkSurfaces;
 onPosition?:(id:string,pose:CompanionPosition,trail:CompanionPosition[])=>void;
 onTalk?:(id:string)=>void;
}
const FOLLOWER_YIELD_MAX_STEP_HEIGHT_M=.08;

/** A temporary sidestep may use only the follower's measured body and current source world. */
function probeFollowerYield(ground:GroundWorld,from:ActorPoint,point:ActorPoint,body:ActorBody,doors:ReadonlySet<string>,surfaces?:GroundWalkSurfaces):ActorPoint|null{
 const footprint=body.footprint;
 if(!footprint||(surfaces?.supportReadyAt&&(!surfaces.supportReadyAt(from.xM,from.zM)||!surfaces.supportReadyAt(point.xM,point.zM))))return null;
 const distance=Math.hypot(point.xM-from.xM,point.zM-from.zM);
 const water=resolveGroundWaterWalk(ground,from,point,distance,{standingHeightM:body.heightM},doors,surfaces);
 if(water.blocked||water.water.mode!=='dry'||Math.hypot(water.xM-point.xM,water.zM-point.zM)>1e-6)return null;
 const walk=resolveGroundWalk(ground,from,point,doors,surfaces,body.heightM,body.radiusM,footprint);
 const reached={xM:walk.xM,yM:walk.yM,zM:walk.zM};
 // Courtesy never grants a new floor, stair trip, wet crossing or passage
 // through source furniture. The normal avatar still admits every footstep.
 if(walk.blocked||walk.onStairs||Math.abs(reached.yM-from.yM)>FOLLOWER_YIELD_MAX_STEP_HEIGHT_M
  ||Math.hypot(reached.xM-point.xM,reached.zM-point.zM)>1e-6
  ||Math.abs(water.yM-reached.yM)>1e-6
  ||!groundBodyVolumeRecoveryClear(ground,from,reached,body,doors))return null;
 return reached;
}

function Follower({member,index,...props}:Omit<Props,'members'>&{member:PartyCompanionPresence;index:number}){
 // Physical checkpoint updates create new selector objects. Identical observed
 // appearance must not reassemble an expensive body on every saved footfall.
 const recipeKey=JSON.stringify(member.recipe);
 const recipe=useMemo(()=>member.recipe,[recipeKey]);
 const trail=useRef(new PartyGroundTrail(member.trail)),feet=useRef({...member.position});
 const target=useRef<{xM:number;zM:number}|null>(null),blocked=useRef(false),lastLeader=useRef<CompanionPosition|null>(null);
 const yieldRoute=useRef<ActorYieldRouteState>({}),yieldGoal=useRef<ActorPoint|null>(null),personalSpace=useContext(ActorPersonalSpaceContext);
 const frameTime=useRef(0),retryAfter=useRef(0);
 const [notice,setNotice]=useState<string|null>(null);
 const initialized=useRef(member.canFollow);
 useEffect(()=>{blocked.current=false;yieldRoute.current={};},[props.ground,props.openDoors]);
 useFrame(({clock},delta)=>{
  frameTime.current=clock.elapsedTime;
  const leader=props.leader.current;if(!leader||props.paused){target.current=null;return;}
  const near=Math.hypot(leader.xM-feet.current.xM,leader.zM-feet.current.zM,leader.yM-feet.current.yM)<=3;
  if((!initialized.current||trail.current.overflowed)&&near){trail.current.reunite(leader);initialized.current=true;setNotice(null);}
  if(!initialized.current){target.current=null;return;}
  // People can clear the saved route while the leader waits. Retry through
  // PlayerAvatar's same ground/body solver; never move the feet here.
  if(blocked.current&&frameTime.current>=retryAfter.current)blocked.current=false;
  // Measure accumulated leader movement, not one frame's tiny displacement.
  if(!lastLeader.current||Math.hypot(leader.xM-lastLeader.current.xM,leader.zM-lastLeader.current.zM)>.15){blocked.current=false;lastLeader.current={...leader};}
  trail.current.observe(leader);
  if(trail.current.overflowed){target.current=null;yieldRoute.current={};yieldGoal.current=null;setNotice(`${member.character.name} lost your trail. Return to them.`);return;}
  const trailGoal=trail.current.target(feet.current,2.25*(index+1));
  const key='companion:'+member.character.id,body=personalSpace?.get(key),reservation=personalSpace?actorCourtesySpace(personalSpace):null;
  const player=reservation?.get('player'),from={...feet.current};
  const underLeaderPressure=!!body&&!!player&&actorSpaceOverlaps(from,key,body,new Map([['player',player]]));
  if(!trailGoal&&!underLeaderPressure&&!yieldGoal.current){target.current=null;yieldRoute.current={};return;}
  if(body&&reservation&&personalSpace&&(underLeaderPressure||yieldGoal.current)){
   // A follower can briefly make room inside existing courtesy space, then
   // resume this same recorded trail. The persistent trail and its goal stay
   // untouched; PlayerAvatar remains the only owner of accepted movement.
   const step=groundSpeedMps(member.character)*groundFrameSeconds(delta);
   // The shared route signature tracks party bodies. Omit this follower's own
   // moving feet so each accepted sidestep can continue the same bounded path.
   const yieldingSpace=new Map([...reservation].filter(([id])=>id!==key));
   const probe=(point:ActorPoint,start:ActorPoint=from)=>probeFollowerYield(props.ground,start,point,body,props.openDoors??new Set<string>(),props.walkingSurfaces);
   const yieldTo=(goal:ActorPoint)=>yieldActorStep(from,goal,key,body,yieldingSpace,step,probe,personalSpace,yieldRoute.current,FOLLOWER_YIELD_MAX_STEP_HEIGHT_M);
   if(!trailGoal){
    // A caught-up companion holds their current feet as a transient courtesy
    // goal, then returns there only through the same measured local path.
    const goal=yieldGoal.current??(yieldGoal.current={...from});
    const reached=yieldTo(goal);
    if(!underLeaderPressure&&Math.hypot(goal.xM-from.xM,goal.zM-from.zM)<.015){target.current=null;yieldRoute.current={};yieldGoal.current=null;return;}
    target.current=reached.blocked||Math.hypot(reached.xM-from.xM,reached.zM-from.zM)<1e-5?null:{xM:reached.xM,zM:reached.zM};
    return;
   }
   yieldGoal.current=null;
   if(underLeaderPressure){
    const reached=yieldTo(trailGoal);
    target.current=reached.blocked||Math.hypot(reached.xM-from.xM,reached.zM-from.zM)<1e-5?null:{xM:reached.xM,zM:reached.zM};
    return;
   }
  }
  yieldRoute.current={};yieldGoal.current=null;
  target.current=blocked.current?null:trailGoal;
 },-.7);
 return <PlayerAvatar character={member.character} recipe={recipe}
  actorId={member.character.id} trackCamera={false} routeTarget={target}
  groundPos={member.position} ground={props.ground} sceneOrigin={props.sceneOrigin} startSurfaceY={member.position.yM}
  openDoors={props.openDoors} walkingSurfaces={props.walkingSurfaces}
  onTalk={props.onTalk?()=>props.onTalk!(member.character.id):undefined} actorNotice={notice}
  onPositionChange={pose=>{if(Math.hypot(pose.xM-feet.current.xM,pose.yM-feet.current.yM,pose.zM-feet.current.zM)>.01)setNotice(null);feet.current=pose;props.onPosition?.(member.character.id,pose,trail.current.snapshot());}}
  onMovementBlocked={()=>{blocked.current=true;retryAfter.current=frameTime.current+.75;target.current=null;setNotice(`${member.character.name}'s way is blocked. Wait or find another approach.`);}}
 />;
}
export default function PartyGroundActors({members,...props}:Props){
 return <>{members.map((member,index)=><Follower key={member.character.id} member={member} index={index} {...props}/>)}</>;
}
