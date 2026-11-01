/** Measure the body at its real facing. Standing, translating and turning
 * are separate permissions; no test may make a body smaller to fit a room. */
import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import * as actorSpace from '../actorPersonalSpace';
import {resolveGroundWalk,isGroundBodyClear,canGroundBodyTurn,type GroundBodyFootprint} from '../groundBuildingMotion';
import {createGroundInteriorRouteSearch,findGroundInteriorRoute} from '../groundInteriorRoute';
import {advanceResidentInteriorRoute,type ResidentInteriorRouteState} from '../residentInteriorMotion';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {SitePart} from '@/systems/worldforge/bridge/interiorParts';
import {buildInteriorParts} from '@/systems/worldforge/bridge/interiorParts';
import {proposeHouseholdLivingPlan} from '@/systems/worldforge/interior/householdLivingPlan';
import observed from '@/systems/worldforge/interior/__tests__/fixtures/observedBuildingSources.json';
import type {ObservedBuildingSource} from '@/systems/worldforge/interior/buildingSource';
import {canonicalTownSeedPath} from '@/systems/worldforge/town/canonicalTown';
const floor:SitePart={x:0,z:0,w:8,d:8,h:.12,baseY:0,colorHex:'#aaa',walkSurface:'floor'};
const long:GroundBodyFootprint={minXM:-.6,maxXM:.6,minZM:-.15,maxZM:.15,yawRad:0};
const radius=Math.hypot(.6,.15);
function room(parts:SitePart[],yaw=0,sign=-1){
 const project=(x:number,z:number)=>{const p=new THREE.Vector3(x,0,z*-sign).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);return {xM:100+p.x,zM:100+p.z};};
 const ground={cols:1,rows:1,heights:[0],buildings:[{id:'home',xM:100,zM:100,cornersM:[[-4,-4],[4,-4],[4,4],[-4,4]].map(([x,z])=>{const p=project(x,z);return {x:p.xM,z:p.zM};}),parts:[floor,...parts]}]} as unknown as GroundWorld;
 return {ground,project};
}
describe('measured supported body movement',()=>{
 for(const yaw of [0,.73])for(const sign of [-1,1])it('fits the real narrow axis without admitting the broad facing: '+yaw+'/'+sign,()=>{
  const wall={x:0,z:0,w:.1,d:3.5,h:3,baseY:0,colorHex:'#bbb'},f={...long,yawRad:yaw};
  const {ground,project}=room([{...wall,z:-2.25},{...wall,z:2.25}],yaw,sign),from={...project(-2,0),yM:.12},to=project(2,0);
  expect(resolveGroundWalk(ground,from,to,undefined,undefined,1.9,radius).blocked).toBe(true);
  const actual=resolveGroundWalk(ground,from,to,undefined,undefined,1.9,radius,f);expect(actual.blocked).toBe(false);expect(Math.hypot(actual.xM-to.xM,actual.zM-to.zM)).toBeLessThan(1e-6);
  const at={...project(0,0),yM:.12};expect(isGroundBodyClear(ground,at,1.9,f)).toBe(true);
  expect(isGroundBodyClear(ground,at,1.9,{...f,yawRad:yaw+Math.PI/2})).toBe(false);
  expect(canGroundBodyTurn(ground,at,1.9,f,yaw+Math.PI/2)).toBe(false);
 });
 it('keeps asymmetric gear offsets and slides on the real contact plane',()=>{
  const {ground}=room([{x:0,z:0,w:.1,d:8,h:3,baseY:0,colorHex:'#bbb'}]);
  const f={minXM:-.1,maxXM:1,minZM:-.2,maxZM:.2,yawRad:0},from=Object.freeze({xM:98,yM:.12,zM:98});
  const result=resolveGroundWalk(ground,from,{xM:102,zM:101},undefined,undefined,1.9,1.02,f);
  expect(result.blocked).toBe(true);expect(result.xM).toBeCloseTo(98.949,2);expect(result.zM).toBeCloseTo(101,2);expect(from).toEqual({xM:98,yM:.12,zM:98});
 });
 it('sweeps thin walls and permits exit from an old overlap without relocating idle feet',()=>{
  const {ground}=room([{x:0,z:0,w:.015,d:5,h:3,baseY:0,colorHex:'#bbb'}]);
  const from={xM:98,yM:.13,zM:100};expect(resolveGroundWalk(ground,from,{xM:102,zM:100},undefined,undefined,1.9,radius,long).blocked).toBe(true);
  const embedded=Object.freeze({xM:100.01,yM:.13,zM:100});expect(resolveGroundWalk(ground,embedded,embedded,undefined,undefined,1.9,radius,long)).toMatchObject({...embedded,blocked:false});
  expect(isGroundBodyClear(ground,embedded,1.9,long)).toBe(false);
  expect(resolveGroundWalk(ground,embedded,{xM:101,zM:100},undefined,undefined,1.9,radius,long).xM).toBeGreaterThan(embedded.xM);
  expect(resolveGroundWalk(ground,embedded,{xM:99,zM:100},undefined,undefined,1.9,radius,long).xM).toBeCloseTo(embedded.xM);
 });
 it('counts even a short head overlap and refuses invalid measured bounds',()=>{
  const {ground}=room([{x:0,z:0,w:2,d:2,h:.2,baseY:1.94,colorHex:'#bbb'}]),at={xM:100,yM:.12,zM:100};
  expect(isGroundBodyClear(ground,at,1.85,long)).toBe(false);expect(canGroundBodyTurn(ground,at,1.85,long,Math.PI/2)).toBe(false);
  for(const f of [{...long,maxXM:NaN},{...long,minXM:2},{...long,marginM:-1},null as unknown as GroundBodyFootprint]){
   expect(resolveGroundWalk(ground,at,{xM:101,zM:100},undefined,undefined,1.9,radius,f)).toMatchObject({...at,blocked:true});expect(canGroundBodyTurn(ground,at,1.9,f,1)).toBe(false);
  }
 });
 it('refuses unknown structural dimensions instead of treating them as clear space',()=>{
  const {ground}=room([{x:0,z:0,w:NaN,d:2,h:3,baseY:0,colorHex:'#bbb'}]),from={xM:98,yM:.12,zM:100};
  expect(resolveGroundWalk(ground,from,{xM:102,zM:100},undefined,undefined,1.9,radius,long)).toMatchObject({...from,blocked:true});
  expect(isGroundBodyClear(ground,from,1.9,long)).toBe(false);expect(canGroundBodyTurn(ground,from,1.9,long,1)).toBe(false);
 });
 it('retains conservative mounted-deck clearance until that owner exposes boxes',()=>{
  const {ground}=room([]),at={xM:100,yM:.12,zM:100},intersectsBody=vi.fn((_point:unknown,_radius:number,_height:number)=>true),surfaces={surfaceHeightsAt:()=>[.12],intersectsBody};
  expect(resolveGroundWalk(ground,at,{xM:101,zM:100},undefined,surfaces,1.9,.3,long).blocked).toBe(true);expect(intersectsBody.mock.calls.length).toBeGreaterThan(0);
  expect(intersectsBody.mock.calls[0][1]).toBeGreaterThanOrEqual(radius);
 });
});
function furnished(){
 const home=observed.home as unknown as ObservedBuildingSource,seed=canonicalTownSeedPath(home.worldSeed,home.burgId);
 const proposal=proposeHouseholdLivingPlan(home.plan,seed,{ageByTag:{'child:0':8,'child:1':9,'child:2':4,'child:3':8,'child:4':4},privateDoorLeaves:true})!;
 const parts=buildInteriorParts({id:34,role:'house',storeys:4,footprint:[[0,0],[30,0],[30,20],[0,20]]},seed,12.192,[],proposal.plan);
 const project=(x:number,z:number)=>({xM:100+(x-15)*.3048,zM:100+(z-10)*.3048});
 const ground={cols:1,rows:1,heights:[0],buildings:[{id:'home',xM:100,zM:100,cornersM:[[0,0],[30,0],[30,20],[0,20]].map(([x,z])=>{const p=project(x,z);return {x:p.xM,z:p.zM};}),parts}]} as unknown as GroundWorld;
 const f={minXM:-.5427870154380796,maxXM:.5427870154380796,minZM:-.2567894756793976,maxZM:.27903780341148376,yawRad:0};
 return {ground,project,f};
}
describe('measured furnishing station and reachable fixed-facing route',()=>{
 it('enters the known barrel-side station and refuses the obstructed intermediate turn',()=>{
  const {ground,project,f}=furnished(),at={...project(16.5,4.5),yM:.12192},r=.6103112647337291,h=1.8547481632837726;
  expect(isGroundBodyClear(ground,at,h,f)).toBe(true);expect(canGroundBodyTurn(ground,at,h,f,Math.PI/2)).toBe(false);
  const goal=at,from={...project(16.5,4.9),yM:.12192},query={bodyRadiusM:r,standingHeightM:h,bodyFootprint:f,doors:new Set<string>(),grid:{originXM:100,originZM:100,yawRad:0,stepM:.1524},maxNodes:1000,acceptsFoot:(p:{yM:number})=>Math.abs(p.yM-.12192)<.01};
  const route=findGroundInteriorRoute(ground,from,goal,query);expect(route.kind).toBe('route');
  const body={...from,radiusM:r,heightM:h,footprint:f},context={ground,key:'resident:test',body,bodies:new Map([['resident:test',body]]),query,policyToken:{},doors:[]},state:ResidentInteriorRouteState={};
  let point=from;for(let frame=0;frame<1000;frame++){
   const previous=point,oldFoot=context.body.footprint,step=advanceResidentInteriorRoute(point,goal,.1,context,state);
   expect(canGroundBodyTurn(ground,previous,h,oldFoot,step.rotationY)).toBe(true);
   const nextFoot={...oldFoot,yawRad:step.rotationY},walk=resolveGroundWalk(ground,previous,step.position,query.doors,undefined,h,r,nextFoot);
   expect(walk.blocked).toBe(false);point=step.position;context.body={...body,...point,footprint:nextFoot};context.bodies.set(context.key,context.body);if(step.status==='at-station')break;
  }
  expect(Math.hypot(point.xM-goal.xM,point.zM-goal.zM)).toBeLessThan(.025);expect(isGroundBodyClear(ground,point,h,context.body.footprint)).toBe(true);
 });
 it('sidesteps at retained facing when an immediate turn would strike the barrels',()=>{
  const {ground,project,f}=furnished(),from={...project(16.5,4.5),yM:.12192},goal={...from,xM:from.xM+.05},r=.6103112647337291,h=1.8547481632837726;
  const body={...from,radiusM:r,heightM:h,footprint:f},query={bodyRadiusM:r,standingHeightM:h,doors:new Set<string>(),grid:{originXM:100,originZM:100,yawRad:0,stepM:.1524},maxNodes:1000,acceptsFoot:()=>true};
  const context={ground,key:'resident:test',body,bodies:new Map([['resident:test',body]]),query,policyToken:{},doors:[]};
  expect(canGroundBodyTurn(ground,from,h,f,Math.PI/2)).toBe(false);
  const state:ResidentInteriorRouteState={};let step=advanceResidentInteriorRoute(from,goal,.1,context,state);
  for(let frame=0;frame<1000&&step.status==='planning';frame++){expect(step.position).toEqual(from);step=advanceResidentInteriorRoute(from,goal,.1,context,state);}
  expect(step.moving).toBe(true);expect(step.rotationY).toBe(0);expect(step.position.xM).toBeCloseTo(goal.xM,6);
 });
 it('replays ascent and descent on furnished treads with an actual measured box',()=>{
  const {ground,project,f}=furnished(),from={...project(17.5,17.5),yM:.12192},goal={...project(17.5,12.5),yM:3.16992},r=.6103112647337291,h=1.8547481632837726;
  const query={bodyRadiusM:r,standingHeightM:h,bodyFootprint:f,doors:new Set<string>(),grid:{originXM:100,originZM:100,yawRad:0,stepM:.1524},maxNodes:3000,
   acceptsFoot:(p:{xM:number;yM:number;zM:number})=>p.xM>=100-15*.3048&&p.xM<=100+5*.3048&&p.zM>=100&&p.zM<=100+10*.3048&&p.yM>=.12&&p.yM<=3.18};
  for(const [start,end]of [[from,goal],[goal,from]]){
   const route=findGroundInteriorRoute(ground,start,end,query);expect(route.kind,JSON.stringify(route)).toBe('route');if(route.kind!=='route')continue;
   // Slicing preserves every supported height and measured facing on the
   // furnished stair; a shorter body proxy cannot qualify this comparison.
   const search=createGroundInteriorRouteSearch(ground,start,end,query);let finished=false;
   for(let slice=0;slice<30000;slice++){
    const update=search.advance({maxWork:64,maxMs:.5});expect(update.work).toBeLessThanOrEqual(64);
    if(update.kind==='done'){expect(update.result).toEqual(route);finished=true;break;}
   }expect(finished).toBe(true);
   expect(route.points.some(p=>p.yM>1&&p.yM<2.5)).toBe(true);
   for(let i=1;i<route.points.length;i++){const reached=resolveGroundWalk(ground,route.points[i-1],route.points[i],query.doors,undefined,h,r,f);expect(reached.blocked).toBe(false);expect(reached.yM).toBeCloseTo(route.points[i].yM,7);}
  }
 });

});

describe('conservative ceiling query bounds',()=>{
 it('avoids detailed box contact tests for distant overhead slabs',()=>{
  const floor:SitePart={x:0,z:0,w:8,d:8,h:.12,baseY:0,colorHex:'#aaa',walkSurface:'floor'};
  const overhead:SitePart={x:3,z:0,w:.2,d:.2,h:.1,baseY:1,colorHex:'#bbb'};
  const ground={cols:1,rows:1,heights:[0],buildings:[{id:'test',xM:100,zM:100,cornersM:[{x:96,z:96},{x:104,z:96},{x:104,z:104},{x:96,z:104}],parts:[floor,overhead]}]} as unknown as GroundWorld;
  const from={xM:100,yM:.12,zM:100},f={minXM:-.2,maxXM:.2,minZM:-.2,maxZM:.2,yawRad:0};
  const spy=vi.spyOn(actorSpace,'sweepActorBoxes');try{
   expect(resolveGroundWalk(ground,from,{xM:100.02,zM:100},new Set(),undefined,1.9,.3,f).blocked).toBe(false);
   expect(spy).not.toHaveBeenCalled();
  }finally{spy.mockRestore();}
 });
});

describe('near ceilings retain exact asymmetric body and margin checks',()=>{
 for(const yaw of [0,Math.PI/2])it('refuses a slab touching offset gear at yaw '+yaw,()=>{
  const floor:SitePart={x:0,z:0,w:8,d:8,h:.12,baseY:0,colorHex:'#aaa',walkSurface:'floor'};
  const slab:SitePart={x:.65*Math.cos(yaw),z:-.65*Math.sin(yaw),w:.1,d:.1,h:.1,baseY:1,colorHex:'#bbb'};
  const ground={cols:1,rows:1,heights:[0],buildings:[{id:'test',xM:100,zM:100,cornersM:[{x:96,z:96},{x:104,z:96},{x:104,z:104},{x:96,z:104}],parts:[floor,slab]}]} as unknown as GroundWorld;
  const from={xM:100,yM:.12,zM:100},f={minXM:-.05,maxXM:.6,minZM:-.1,maxZM:.1,yawRad:yaw,marginM:.1};
  expect(resolveGroundWalk(ground,from,{xM:100+.02*Math.cos(yaw),zM:100-.02*Math.sin(yaw)},new Set(),undefined,1.9,.3,f)).toMatchObject({blocked:true,blockedReason:'low-clearance'});
 });
});
