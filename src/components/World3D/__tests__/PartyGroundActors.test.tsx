/** Policy fixtures for a physically blocked follower. Frame retries only renew
 * the saved target; PlayerAvatar still owns every admitted footfall. Native
 * play must separately prove that a cleared route produces real movement. */
import React from 'react';
import {act,render} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import PartyGroundActors from '../PartyGroundActors';
import type PlayerAvatar from '../PlayerAvatar';
import type {PartyCompanionPresence} from '@/systems/companions/companionWhereabouts';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import {ActorPersonalSpaceContext} from '../ActorPersonalSpaceContext';
import {actorCourtesySpace,actorSpaceOverlaps,clipActorStep,type ActorBody,type ActorSpace} from '../actorPersonalSpace';
import {groundBodyVolumeClear,groundBodyVolumeRecoveryClear,resolveGroundWalk} from '../groundBuildingMotion';
import {resolveGroundWaterWalk} from '../groundWaterMovement';
import {groundSpeedMps} from '../groundLocomotion';

const driver=vi.hoisted(()=>({frame:null as null|((state:{clock:{elapsedTime:number}},delta:number)=>void),avatar:null as unknown as React.ComponentProps<typeof PlayerAvatar>}));
vi.mock('@react-three/fiber',async()=>{
 const React=await import('react');
 return {useFrame(callback:typeof driver.frame){React.useLayoutEffect(()=>{driver.frame=callback;});}};
});
vi.mock('../PlayerAvatar',()=>({default:(props:React.ComponentProps<typeof PlayerAvatar>)=>{driver.avatar=props;return null;}}));

function flatGround(overrides:Partial<GroundWorld>={}):GroundWorld{
 return {cols:32,rows:32,heights:Array(1024).fill(0),biomeIds:Array(1024).fill('plains'),extentMetersX:48,extentMetersZ:48,
  features:[],props:[],hostiles:[],hiddenSites:[],dungeonEntrances:[],roads:[],walls:[],waterBodies:[],decks:[],gatehouses:[],towns:[],buildings:[],rosters:[],occupants:[],rivers:[],...overrides} as unknown as GroundWorld;
}
function closedDoorRoom():GroundWorld{
 const cornersM: [number,number][]=[[-3,-3],[3,-3],[3,3],[-3,3]].map(([x,z])=>[15+x,15+z]);
 const worldCorners=cornersM.map(([x,z])=>({x,z}));
 const wall={h:3,baseY:0,colorHex:'#cfc7b8'};
 const parts=[
  {...wall,x:0,z:-1,w:2,d:.12},{...wall,x:0,z:1,w:2,d:.12},{...wall,x:-1,z:0,w:.12,d:2},
  {...wall,x:1,z:-.8,w:.12,d:.4},{...wall,x:1,z:.8,w:.12,d:.4},
  {x:1,z:0,w:.12,d:1.2,h:2.1,baseY:0,colorHex:'#4a3220',door:{id:'guest-room',level:1,index:0,axis:'y' as const,swingX:1,swingZ:0}},
 ];
 return flatGround({buildings:[{id:'room',xM:15,zM:15,cornersM:worldCorners,parts}] as unknown as GroundWorld['buildings']});
}
function shallowOverlapRoom():GroundWorld{
 const cornersM: {x:number;z:number}[]=[{x:11,z:11},{x:19,z:11},{x:19,z:19},{x:11,z:19}];
 const parts=[{x:0,z:0,w:1.2,d:1.2,h:1.5,baseY:0,furnishing:true,colorHex:'#654321'}];
 return flatGround({buildings:[{id:'overlap-fixture',xM:15,zM:15,cornersM,parts}] as unknown as GroundWorld['buildings']});
}
function body(xM:number,zM:number):ActorBody{
 return {xM,yM:0,zM,radiusM:.26,heightM:1.6,footprint:{minXM:-.18,maxXM:.18,minZM:-.18,maxZM:.18,yawRad:0}};
}
function setup(distance=5,canFollow=true,options:{space?:ActorSpace;ground?:GroundWorld;walkingSurfaces?:React.ComponentProps<typeof PartyGroundActors>['walkingSurfaces'];trail?:{xM:number;yM:number;zM:number}[];position?:{xM:number;yM:number;zM:number};leader?:{xM:number;yM:number;zM:number}}={}){
 const member={character:{id:'elara_vance',name:'Elara Vance',speed:30},position:options.position??{xM:0,yM:0,zM:0},trail:options.trail??[{xM:1,yM:0,zM:0},{xM:distance,yM:0,zM:0}],canFollow} as PartyCompanionPresence;
 const props={members:[member],leader:{current:options.leader??{xM:distance,yM:0,zM:0}},ground:options.ground??({rivers:[]} as unknown as GroundWorld),sceneOrigin:{},openDoors:new Set<string>(),walkingSurfaces:options.walkingSurfaces,onPosition:vi.fn()} as unknown as React.ComponentProps<typeof PartyGroundActors>;
 const actors=<PartyGroundActors {...props}/>;
 const view=options.space?render(<ActorPersonalSpaceContext.Provider value={options.space}>{actors}</ActorPersonalSpaceContext.Provider>):render(actors);
 const tick=(time:number,delta=.1)=>act(()=>driver.frame!({clock:{elapsedTime:time}},delta));
 tick(0);
 return {view,props,member,tick,space:options.space};
}

describe('guarded follower retry',()=>{
 beforeEach(()=>{driver.frame=null;});
 it('retries a stationary leader trail after a bounded wait without relocating anyone',()=>{
  const {props,member,tick}=setup();
  act(()=>driver.avatar.onMovementBlocked?.({xM:0,yM:0,zM:0}));
  tick(.5);expect(driver.avatar.routeTarget?.current).toBeNull();
  tick(.76);expect(driver.avatar.routeTarget?.current).toMatchObject({xM:1,zM:0});
  expect(member.position).toEqual({xM:0,yM:0,zM:0});expect(props.onPosition).not.toHaveBeenCalled();
 });
 it('spaces repeated static obstructions rather than retrying every frame',()=>{
  const {tick}=setup();act(()=>driver.avatar.onMovementBlocked?.({xM:0,yM:0,zM:0}));tick(.76);
  act(()=>driver.avatar.onMovementBlocked?.({xM:0,yM:0,zM:0}));tick(1);
  expect(driver.avatar.routeTarget?.current).toBeNull();tick(1.52);
  expect(driver.avatar.routeTarget?.current).not.toBeNull();
 });
 it('preserves the intentional following gap after a retry',()=>{
  const {tick}=setup(2);act(()=>driver.avatar.onMovementBlocked?.({xM:0,yM:0,zM:0}));tick(1);
  expect(driver.avatar.routeTarget?.current).toBeNull();
 });
 it('does not retry or move while conversation pauses following',()=>{
  const space:ActorSpace=new Map([['player',body(0,0)],['companion:elara_vance',body(.25,0)]]);
  const {view,props,tick}=setup(5,true,{space,ground:flatGround(),position:{xM:.25,yM:0,zM:0},leader:{xM:0,yM:0,zM:0}});
  act(()=>driver.avatar.onMovementBlocked?.({xM:.25,yM:0,zM:0}));
  view.rerender(<ActorPersonalSpaceContext.Provider value={space}><PartyGroundActors {...props} paused/></ActorPersonalSpaceContext.Provider>);tick(100);
  expect(driver.avatar.routeTarget?.current).toBeNull();expect(props.onPosition).not.toHaveBeenCalled();
  expect(space.get('companion:elara_vance')).toEqual(body(.25,0));
 });
 it('clears the blocked notice only after an actual reported footfall',()=>{
  const {tick}=setup();act(()=>driver.avatar.onMovementBlocked?.({xM:0,yM:0,zM:0}));tick(1);
  expect(driver.avatar.actorNotice).toContain('blocked');
  act(()=>driver.avatar.onPositionChange?.({xM:.1,yM:0,zM:0}));
  expect(driver.avatar.actorNotice).toBeNull();
 });
 it('observes accumulated small leader steps before the stationary retry deadline',()=>{
  const {props,tick}=setup();act(()=>driver.avatar.onMovementBlocked?.({xM:0,yM:0,zM:0}));
  props.leader.current!.xM=5.05;tick(.1);expect(driver.avatar.routeTarget?.current).toBeNull();
  props.leader.current!.xM=5.10;tick(.2);expect(driver.avatar.routeTarget?.current).toBeNull();
  props.leader.current!.xM=5.16;tick(.3);expect(driver.avatar.routeTarget?.current).not.toBeNull();
 });
 it('does not resume a missing trail from a distant leader',()=>{
  const {props,tick}=setup(5,false);tick(100);
  expect(driver.avatar.routeTarget?.current).toBeNull();expect(props.onPosition).not.toHaveBeenCalled();
 });

 it('briefly yields inside measured courtesy space, then resumes the unchanged accepted trail',()=>{
  const ground=flatGround(),space:ActorSpace=new Map([['player',body(0,0)],['companion:elara_vance',body(.25,0)]]);
  const trail=[{xM:1,yM:0,zM:0},{xM:2,yM:0,zM:0},{xM:1,yM:0,zM:0},{xM:0,yM:0,zM:0}],saved=trail.map(point=>({...point}));
  const {member,tick,props}=setup(5,true,{space,ground,position:{xM:.25,yM:0,zM:0},leader:{xM:0,yM:0,zM:0},trail});
  const key='companion:elara_vance',maxFootstepM=groundSpeedMps(member.character)*.1;
  let clear=false;
  for(let frame=1;frame<=12;frame++){
   tick(frame*.1);
   const route=driver.avatar.routeTarget?.current;
   if(!route)continue;
   const from={...member.position},measured=space.get(key)!;
   const requestedDistance=Math.hypot(route.xM-from.xM,route.zM-from.zM);
   expect(requestedDistance).toBeLessThanOrEqual(.12+1e-6);
   const share=Math.min(1,maxFootstepM/Math.max(requestedDistance,1e-9));
   const step=resolveGroundWalk(ground,from,{xM:from.xM+(route.xM-from.xM)*share,zM:from.zM+(route.zM-from.zM)*share},props.openDoors,undefined,measured.heightM,measured.radiusM,measured.footprint);
   expect(step.blocked).toBe(false);
   expect(groundBodyVolumeClear(ground,from,step,measured,props.openDoors)).toBe(true);
   const reached=clipActorStep(from,step,key,measured,space);
   expect(reached.blocked).toBe(false);
   expect(Math.hypot(reached.xM-from.xM,reached.zM-from.zM)).toBeLessThanOrEqual(maxFootstepM+1e-6);
   const next={xM:reached.xM,yM:reached.yM,zM:reached.zM};
   member.position=next;
   space.set(key,{...measured,...next});
   act(()=>driver.avatar.onPositionChange?.(next));
   const leaderReservation=actorCourtesySpace(space).get('player')!;
   clear=!actorSpaceOverlaps(next,key,space.get(key)!,new Map([['player',leaderReservation]]));
   if(clear)break;
  }
  expect(clear).toBe(true);
  expect(member.trail).toEqual(saved);
  tick(2);
  expect(driver.avatar.routeTarget?.current).toMatchObject({xM:1,zM:0});
 });

 it('does not use a local yield to leave an unready support surface',()=>{
  const space:ActorSpace=new Map([['player',body(0,0)],['companion:elara_vance',body(.25,0)]]);
  const {member,tick}=setup(5,true,{space,ground:flatGround(),walkingSurfaces:{surfaceHeightsAt:()=>[],supportReadyAt:()=>false,intersectsBody:()=>false},position:{xM:.25,yM:0,zM:0},leader:{xM:0,yM:0,zM:0}});
  tick(.1);
  expect(driver.avatar.routeTarget?.current).toBeNull();
  expect(member.position).toEqual({xM:.25,yM:0,zM:0});
 });

 it('keeps a pressure sidestep inside the room when its only doorway is closed',()=>{
  const ground=closedDoorRoom(),space:ActorSpace=new Map([['player',body(15.15,15)],['companion:elara_vance',body(15.7,15)]]);
  const trail=[{xM:16,yM:0,zM:15},{xM:17,yM:0,zM:15},{xM:15.15,yM:0,zM:15}];
  const {tick,props}=setup(15.15,true,{space,ground,position:{xM:15.7,yM:0,zM:15},leader:{xM:15.15,yM:0,zM:15},trail});
  const from={xM:15.7,yM:0,zM:15},measured=space.get('companion:elara_vance')!;
  const sideStep=resolveGroundWalk(ground,from,{xM:15.7,zM:15.12},props.openDoors,undefined,measured.heightM,measured.radiusM,measured.footprint);
  expect(sideStep.blocked).toBe(false);expect(groundBodyVolumeClear(ground,from,sideStep,measured,props.openDoors)).toBe(true);
  expect(resolveGroundWaterWalk(ground,from,{xM:15.7,zM:15.12},.12,{standingHeightM:measured.heightM},props.openDoors).water.mode).toBe('dry');
  expect(actorSpaceOverlaps(from,'companion:elara_vance',measured,new Map([['player',actorCourtesySpace(space).get('player')!]]))).toBe(true);
  let target: {xM:number;zM:number}|null=null;
  for(let frame=1;frame<=64&&!target;frame++){tick(frame*.1);target=driver.avatar.routeTarget?.current??null;}
  expect(target).not.toBeNull();
  expect(target!.xM).toBeLessThan(16);
  const walk=resolveGroundWalk(ground,from,target!,props.openDoors,undefined,measured.heightM,measured.radiusM,measured.footprint);
  expect(walk.blocked).toBe(false);expect(walk.onStairs).toBe(false);
  expect(groundBodyVolumeClear(ground,from,walk,measured,props.openDoors)).toBe(true);
  expect(resolveGroundWalk(ground,from,{xM:16.2,zM:15},props.openDoors,undefined,measured.heightM,measured.radiusM,measured.footprint).blocked).toBe(true);
 });

 it('uses a normal measured footstep to recover from a shallow existing source-solid overlap',()=>{
  const ground=shallowOverlapRoom(),from={xM:15,yM:0,zM:15.75},key='companion:elara_vance';
  const space:ActorSpace=new Map([['player',body(15,15.21)],[key,body(from.xM,from.zM)]]),measured=space.get(key)!;
  const {member,props,tick}=setup(15.21,true,{space,ground,position:from,leader:{xM:15,yM:0,zM:15.21},trail:[]});
  expect(groundBodyVolumeClear(ground,from,from,measured,props.openDoors)).toBe(false);
  tick(.1);
  const target=driver.avatar.routeTarget?.current;
  expect(target).not.toBeNull();
  const walk=resolveGroundWalk(ground,from,target!,props.openDoors,undefined,measured.heightM,measured.radiusM,measured.footprint);
  expect(walk.blocked).toBe(false);expect(walk.onStairs).toBe(false);
  expect(groundBodyVolumeRecoveryClear(ground,from,walk,measured,props.openDoors)).toBe(true);
  expect(groundBodyVolumeClear(ground,from,walk,measured,props.openDoors)).toBe(false);
  expect(groundBodyVolumeClear(ground,walk,walk,{...measured,...walk},props.openDoors)).toBe(true);
  expect(clipActorStep(from,walk,key,measured,space).blocked).toBe(false);
  expect(member.trail).toEqual([]);
 });

 it('waits instead of using courtesy space to create a wet path without body clearance',()=>{
  const ground=flatGround({rivers:[{sourceKind:'river',points:[{x:0,z:0},{x:48,z:0}],widthM:8,waterlineY:[.4,.4]}]});
  const space:ActorSpace=new Map([['player',body(0,0)],['companion:elara_vance',body(.25,0)]]);
  const {member,tick}=setup(5,true,{space,ground,position:{xM:.25,yM:0,zM:0},leader:{xM:0,yM:0,zM:0}});
  tick(.1);
  expect(driver.avatar.routeTarget?.current).toBeNull();
  expect(member.position).toEqual({xM:.25,yM:0,zM:0});
 });

 it('makes temporary room for a caught-up companion without creating a trail destination',()=>{
  const space:ActorSpace=new Map([['player',body(0,0)],['companion:elara_vance',body(.25,0)]]);
  const {member,tick}=setup(5,true,{space,ground:flatGround(),position:{xM:.25,yM:0,zM:0},leader:{xM:0,yM:0,zM:0},trail:[]});
  tick(.1);
  const target=driver.avatar.routeTarget?.current;
  expect(target).not.toBeNull();
  expect(Math.hypot(target!.xM-.25,target!.zM)).toBeLessThanOrEqual(.12+1e-6);
  expect(target!.xM).toBeGreaterThan(.25);
  expect(member.trail).toEqual([]);
 });
});
