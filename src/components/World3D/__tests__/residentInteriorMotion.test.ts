/** Follow real paths from accepted feet; private approaches need both physical
 * reach and turning room and never open a door or borrow a bedroom claim. */
import {describe,it,expect,vi} from 'vitest';
import * as groundMotion from '../groundBuildingMotion';
import * as THREE from 'three';
import {advanceResidentInteriorRoute,heldResidentFoot,findResidentDoorApproach,residentRouteRegion,residentRouteRadius,type ResidentInteriorRouteContext,type ResidentInteriorRouteState} from '../residentInteriorMotion';
import {createResidentDoorSampler} from '../residentDoorUse';
import type {BuildingOccupantRender,LoadedChunk} from '@/systems/world3d/types';
import {actorSpaceOverlaps,canActorTurn} from '../actorPersonalSpace';
import {doorBodyClearance} from '../doorBodyClearance';
import {resolveGroundWalk} from '../groundBuildingMotion';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {SitePart} from '@/systems/worldforge/bridge/interiorParts';
import {buildInteriorParts} from '@/systems/worldforge/bridge/interiorParts';
import {residentPrivateDoorAccess} from '@/systems/worldforge/bridge/buildingOccupancy';
import {computeOccupancy} from '@/systems/worldforge/interior/occupancy';
import {proposeHouseholdLivingPlan} from '@/systems/worldforge/interior/householdLivingPlan';
import observed from '@/systems/worldforge/interior/__tests__/fixtures/observedBuildingSources.json';
import type {ObservedBuildingSource} from '@/systems/worldforge/interior/buildingSource';
import {canonicalTownSeedPath} from '@/systems/worldforge/town/canonicalTown';
import {siteDoorKey} from '@/systems/worldforge/bridge/sitePartTransform';
const key='resident:test';
const floor:SitePart={x:0,z:0,w:8,d:8,h:.12,baseY:0,colorHex:'#aaa',walkSurface:'floor'};
function room(){
 const wall:SitePart={x:0,z:0,w:.1,d:3,h:3,baseY:0,colorHex:'#bbb'};
 const ground={cols:1,rows:1,heights:[0],buildings:[{id:'home',xM:100,zM:100,cornersM:[{x:96,z:96},{x:104,z:96},{x:104,z:104},{x:96,z:104}],parts:[floor,wall]}]} as unknown as GroundWorld;
 const from={xM:98,yM:.12,zM:100},goal={xM:102,yM:.12,zM:100};
 const body={...from,radiusM:.3,heightM:1.9};
 const context:ResidentInteriorRouteContext={ground,key,body,bodies:new Map([[key,body]]),doors:[],policyToken:{},
  query:{bodyRadiusM:.3,standingHeightM:1.9,doors:new Set(),grid:{originXM:100,originZM:100,yawRad:0,stepM:.25},maxNodes:1000,
   acceptsFoot:p=>Math.abs(p.xM-100)<=3&&Math.abs(p.zM-100)<=3&&Math.abs(p.yM-.12)<.02}};
 return {from,goal,context};
}
function walk(from:{xM:number;yM:number;zM:number},goal:typeof from,context:ResidentInteriorRouteContext,frames=30000){
 const state:ResidentInteriorRouteState={},points=[{...from}];let step;
 for(let i=0;i<frames;i++){const start=points.at(-1)!;step=advanceResidentInteriorRoute(start,goal,.1,context,state);points.push(step.position);
  expect(Math.hypot(step.position.xM-start.xM,step.position.zM-start.zM)).toBeLessThanOrEqual(.120001);
  const physical=resolveGroundWalk(context.ground,start,step.position,context.query.doors,context.query.surfaces,context.query.standingHeightM,context.query.bodyRadiusM);
  expect(physical.blocked).toBe(false);expect(physical.yM).toBeCloseTo(step.position.yM,6);
  context.body={...context.body,...step.position};context.bodies.set(context.key,context.body);
  if(step.status==='at-station'||step.status==='waiting-for-door')break;
 }
 return {points,step:step!,state};
}
// Planning now holds accepted feet across frames. These tests retain the
// physical trip assertions and allow bounded slices before the first step.
function planned(from:{xM:number;yM:number;zM:number},goal:typeof from,context:ResidentInteriorRouteContext,state:ResidentInteriorRouteState){
 for(let frame=0;frame<30000;frame++){
  const step=advanceResidentInteriorRoute(from,goal,.1,context,state);
  if(step.status!=='planning')return step;
  expect(step.position).toEqual(from);expect(step.moving).toBe(false);
 }
 throw new Error('Planning did not settle within bounded slices');
}

describe('physical resident route following',()=>{
 it('takes a furniture detour at bounded speed instead of snapping to the hourly station',()=>{
  const {from,goal,context}=room(),out=walk(from,goal,context);
  expect(out.step.position).toEqual(goal);expect(out.points.some(p=>Math.abs(p.zM-100)>1.8)).toBe(true);
  expect(out.points.length).toBeGreaterThan(35);
 });
 it('stops for a newly occupied segment and replans after the body leaves',()=>{
  const {from,goal,context}=room(),state:ResidentInteriorRouteState={};
  const first=planned(from,goal,context,state);
  const next=state.points![0];context.bodies.set('player',{...next,radiusM:.5,heightM:1.9});
  const blocked=advanceResidentInteriorRoute(first.position,goal,.1,context,state);
  // This fixture places the new body inside the resident's current body.
  // Contact recovery now makes room instead of freezing at that overlap;
  // the player's accepted position stays fixed and contact cannot deepen.
  const player=context.bodies.get('player')!;
  expect(Math.hypot(blocked.position.xM-player.xM,blocked.position.zM-player.zM)).toBeGreaterThanOrEqual(Math.hypot(first.position.xM-player.xM,first.position.zM-player.zM));
  expect(context.bodies.get('player')).toEqual({...next,radiusM:.5,heightM:1.9});
  expect(Math.hypot(blocked.position.xM-first.position.xM,blocked.position.zM-first.position.zM)).toBeLessThanOrEqual(.120001);
  context.bodies.delete('player');let point=blocked.position;
  for(let i=0;i<30000;i++)point=advanceResidentInteriorRoute(point,goal,.1,context,state).position;
  expect(point).toEqual(goal);
 });
 it('keeps accepted feet after source/door/policy changes or a clock destination jump',()=>{
  const {from,goal,context}=room(),state:ResidentInteriorRouteState={};
  const first=planned(from,goal,context,state);
  const changed={...context,ground:{...context.ground},policyToken:{},query:{...context.query,doors:new Set(['changed']),acceptsFoot:()=>false}};
  expect(advanceResidentInteriorRoute(first.position,{...goal,yM:3.12},.1,changed,state).position).toEqual(first.position);
  expect(advanceResidentInteriorRoute(first.position,goal,NaN,context,state).position).toEqual(first.position);
 });
 it('reuses a static refusal and waits for malformed body measurements',()=>{
  const {from,goal,context}=room(),state:ResidentInteriorRouteState={};
  // Occupied goals may now have a proposal, while physical steps still wait.
  // This cache case needs a genuinely forbidden destination, not a bystander.
  const permitted=context.query.acceptsFoot;context.query.acceptsFoot=p=>permitted(p)&&Math.hypot(p.xM-goal.xM,p.zM-goal.zM)>.1;
  planned(from,goal,context,state);const refusal=state.failureFingerprint;
  expect(refusal).toBeDefined();expect(advanceResidentInteriorRoute(from,goal,.1,context,state).position).toEqual(from);expect(state.failureFingerprint).toBe(refusal);
  context.bodies.set('player',{xM:101,yM:.12,zM:100,radiusM:NaN,heightM:1.9});
  expect(advanceResidentInteriorRoute(from,goal,.1,context,state).position).toEqual(from);
 });
 it('covers measured asymmetric corners and refuses malformed bodies',()=>{
  expect(residentRouteRadius({xM:0,yM:0,zM:0,radiusM:.3,heightM:1.8,footprint:{minXM:-.6,maxXM:.7,minZM:-.2,maxZM:.4,yawRad:1}})).toBeCloseTo(Math.hypot(.7,.4));
  expect(residentRouteRadius({xM:0,yM:0,zM:0,radiusM:NaN,heightM:1.8})).toBeNaN();
  const {from,goal,context}=room();context.body.radiusM=.6;expect(advanceResidentInteriorRoute(from,goal,.1,context,{}).position).toEqual(from);
 });
});
function house(yaw=0,sign=-1){
 const home=observed.home as unknown as ObservedBuildingSource,seed=canonicalTownSeedPath(home.worldSeed,home.burgId);
 const out=proposeHouseholdLivingPlan(home.plan,seed,{ageByTag:{'child:0':8,'child:1':9,'child:2':4,'child:3':8,'child:4':4},privateDoorLeaves:true})!;
 const occupancy=computeOccupancy(out.plan,home.household!,{worksAtHome:false});
 const access=residentPrivateDoorAccess(out.plan,home.household!,occupancy.claims,0)!;
 const parts=buildInteriorParts({id:34,role:'house',storeys:4,footprint:[[0,0],[30,0],[30,20],[0,20]]},seed,12.192,[],out.plan);
 const project=(x:number,z:number)=>{const p=new THREE.Vector3((x-15)*.3048,0,(z-10)*.3048*-sign).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);return {xM:100+p.x,zM:100+p.z};};
 const ground={cols:1,rows:1,heights:[0],buildings:[{id:'home',xM:100,zM:100,cornersM:[[0,0],[30,0],[30,20],[0,20]].map(([x,z])=>{const p=project(x,z);return {x:p.xM,z:p.zM};}),parts}]} as unknown as GroundWorld;
 const transform={groupX:100,groupZ:100,surfaceY:0,rotationY:yaw,doorZSign:sign};
 const floorTops=new Map(out.plan.floors.map(f=>[f.level,.12192+f.level*3.048]));
 const region=residentRouteRegion(access,access.memberId,transform,{x:15,y:10},floorTops)!;
 const part=parts.find(p=>p.door?.id===access.doors[0].id)!;
 const foot=(normal:number,along:number)=>{const x=part.x+part.door!.swingX*normal+(part.door!.axis==='x'?along:0),z=part.z+part.door!.swingZ*normal+(part.door!.axis==='y'?along:0);
  const p=new THREE.Vector3(x,0,z*-sign).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);return {xM:100+p.x,zM:100+p.z,yM:part.baseY!};};
 const from=foot(-.8,-1.35),goal=foot(.8,0),body={...from,radiusM:.3,heightM:1.9};
 const context:ResidentInteriorRouteContext={ground,key,body,bodies:new Map([[key,body]]),doors:[{part,transform}],policyToken:access,
  query:{bodyRadiusM:.3,standingHeightM:1.9,doors:new Set(),grid:{originXM:100,originZM:100,yawRad:yaw,stepM:.1524},maxNodes:3000,acceptsFoot:region}};
 return {out,access,region,project,ground,transform,part,from,goal,context,floorTops};
}
describe('source household regions and claimed door approaches',()=>{
 for(const [yaw,sign]of [[0,-1],[.73,1]])it('reaches a clear operating stance and waits for the existing door owner: '+yaw+'/'+sign,()=>{
  const h=house(yaw,sign),snapshot=structuredClone(h.out);
  expect(h.region(h.from)).toBe(true);expect(h.region(h.goal)).toBe(true);
  const approach=findResidentDoorApproach(h.from,h.context);expect(approach).not.toBeNull();
  if(!approach)return;
  const actual={...h.context.body,...approach.at(-1)!},bodies=new Map(h.context.bodies);bodies.set(key,actual);
  expect(doorBodyClearance(h.part,h.transform,bodies)).toEqual({valid:true,blockers:[]});
  const waiting=walk(h.from,h.goal,h.context);expect(waiting.step.status).toBe('waiting-for-door');
  expect(h.context.query.doors.size).toBe(0);
  // Opening belongs to the separate admitted owner. The follower consumes its
  // observed state, invalidates the stance path and continues physically.
  h.context.query.doors=new Set([siteDoorKey('home',h.part)]);h.context.doors=[];
  let position=waiting.step.position;
  for(let i=0;i<180;i++){const step=advanceResidentInteriorRoute(position,h.goal,.1,h.context,waiting.state);position=step.position;h.context.body={...h.context.body,...position};h.context.bodies.set(key,h.context.body);if(step.status==='at-station')break;}
  expect(Math.hypot(position.xM-h.goal.xM,position.zM-h.goal.zM,position.yM-h.goal.yM)).toBeLessThan(.025);
  expect(h.out).toEqual(snapshot);
 });
 it('the existing source/body-backed door owner admits a physically reached stance',()=>{
  const h=house(.73,1),home=observed.home as unknown as ObservedBuildingSource,sid='wf-plot-675-34',residentKey='675:'+h.access.memberId,bodyKey='resident:'+residentKey;
  const ownRoom=h.access.doors[0],door=h.out.plan.floors.find(f=>f.level===ownRoom.level)!.doors[h.part.door!.index];
  const own={xFt:door.x+door.openDir.nx*2.5,yFt:door.y+door.openDir.ny*2.5,level:ownRoom.level,roomId:ownRoom.roomId,activity:'sleeping' as const};
  const shared={...own,xFt:door.x-door.openDir.nx*2.5,yFt:door.y-door.openDir.ny*2.5,roomId:2,activity:'chores' as const};
  const occ:BuildingOccupantRender={id:84,burgId:675,householdMemberId:h.access.memberId,name:home.household!.members[0].name,ageBand:'adult',body:{} as never,
   privateDoorAccess:h.access,stationsByHour:Array.from({length:24},(_,hour)=>hour<6?shared:own)};
  const source={id:84,householdMemberId:h.access.memberId,name:occ.name,homePlotId:34,workPlotId:123,occupation:'merchant',ageBand:'adult'};
  h.ground.rosters=[{burgId:675,occupants:[source]}] as never;h.ground.buildings[0].id=sid;
  const loaded=[{cx:0,cy:0,bundle:{sites:[{id:sid,localX:100,localZ:100,surfaceY:0,rotationY:.73,doorZSign:1,parts:h.ground.buildings[0].parts,occupants:[occ],interiorWidthFt:30,interiorDepthFt:20}]}}] as unknown as LoadedChunk[];
  h.context.key=bodyKey;h.context.bodies=new Map([[bodyKey,h.context.body]]);
  const reached=walk(h.from,h.goal,h.context);expect(reached.step.status).toBe('waiting-for-door');
  const sampler=createResidentDoorSampler(h.ground,loaded,{x:0,z:0},id=>id===residentKey?h.context.bodies.get(bodyKey)!:null,{readBodies:()=>h.context.bodies,readOpenDoors:()=>new Set()});
  const users=sampler(6.005);expect(users.get(siteDoorKey(sid,h.part))).toEqual([occ.name]);
  // A bystander blocks the same operation; the route receipt is not authority
  // to swing through that body or to override the existing door controller.
  const t=h.transform,local=new THREE.Vector3(h.part.x,0,h.part.z*-t.doorZSign).applyAxisAngle(new THREE.Vector3(0,1,0),t.rotationY);
  h.context.bodies.set('player',{xM:100+local.x,yM:h.part.baseY!,zM:100+local.z,radiusM:.3,heightM:1.9});
  const fresh=createResidentDoorSampler(h.ground,loaded,{x:0,z:0},id=>id===residentKey?h.context.bodies.get(bodyKey)!:null,{readBodies:()=>h.context.bodies,readOpenDoors:()=>new Set()});
  expect(fresh(6.005).has(siteDoorKey(sid,h.part))).toBe(false);
 });
 it('excludes another bedroom and refuses missing or borrowed route permissions',()=>{
  const h=house();
  for(const floor of h.out.plan.floors)for(const room of floor.rooms)if(room.purpose==='bedroom'&&!h.access.doors.some(d=>d.level===floor.level&&d.roomId===room.id)){
   const cell=room.cells[0],point={...h.project(cell.cx*5+2.5,cell.cy*5+2.5),yM:h.floorTops.get(floor.level)!};expect(h.region(point)).toBe(false);
  }
  expect(residentRouteRegion({...h.access,routeRooms:undefined},h.access.memberId,h.transform,{x:15,y:10},h.floorTops)).toBeNull();
  expect(residentRouteRegion(h.access,'someone else',h.transform,{x:15,y:10},h.floorTops)).toBeNull();
 });
 it('follows the furnished return stair without jumping to the upstairs schedule',()=>{
  const h=house(.73,1),from={...h.project(17.5,17.5),yM:.12192},goal={...h.project(17.5,12.5),yM:3.16992};
  h.context.doors=[];h.context.body={...h.context.body,...from,radiusM:.6};h.context.query.bodyRadiusM=.6;h.context.bodies.set(key,h.context.body);
  const result=walk(from,goal,h.context);expect(result.step.position.yM).toBeCloseTo(goal.yM);
  expect(Math.hypot(result.step.position.xM-goal.xM,result.step.position.zM-goal.zM)).toBeLessThan(.025);
  expect(result.points.some(p=>p.yM>1&&p.yM<2.5)).toBe(true);
 });
});

describe('household representation without a complete street-roster join',()=>{
 it('retains accepted/observed feet and never follows a changed station implicitly',()=>{
  const initial={xM:10,yM:3,zM:20},later={xM:50,yM:6,zM:80};
  const first=heldResidentFoot(null,null,null,initial);expect(first).toEqual(initial);expect(first).not.toBe(initial);
  expect(heldResidentFoot(null,null,first,later)).toEqual(initial);
  const observed={xM:11,yM:3,zM:21},accepted={xM:12,yM:3,zM:22};
  expect(heldResidentFoot(null,observed,first,later)).toEqual(observed);expect(heldResidentFoot(accepted,observed,first,later)).toEqual(accepted);
 });
 it('refuses unknown/nonfinite positions without creating route or door evidence',()=>{
  expect(heldResidentFoot(null,null,null,null)).toBeNull();
  expect(heldResidentFoot({xM:NaN,yM:0,zM:0},null,null,null)).toBeNull();
 });
});

describe('measured standing space is not unrestricted turning space',()=>{
 it('keeps the known barrel-side station clear at idle facing while refusing an obstructed turn',()=>{
  const h=house(),foot={...h.project(16.5,4.5),yM:.12192};
  // Current canonical recipe81 body reconstruction, not an accepted native
  // source08 body golden. Preserve the asymmetric bounds in this counterexample.
  const body={...foot,radiusM:.6103112647337291,heightM:1.8547481632837726,footprint:{minXM:-.5427870154380796,maxXM:.5427870154380796,minZM:-.2567894756793976,maxZM:.27903780341148376,yawRad:0}};
  const barrels=h.ground.buildings[0].parts.filter(p=>p.furnishing?.kind==='barrel').map((p,index)=>[String(index),{xM:100+p.x,zM:100+p.z,yM:p.baseY??0,heightM:p.h,radiusM:Math.hypot(p.w,p.d)/2,footprint:{minXM:-p.w/2,maxXM:p.w/2,minZM:-p.d/2,maxZM:p.d/2,yawRad:0}}] as const);
  const space=new Map(barrels);expect(actorSpaceOverlaps(foot,key,body,space)).toBe(false);
  expect(resolveGroundWalk(h.ground,foot,{xM:foot.xM+.005,zM:foot.zM},new Set(),undefined,body.heightM,body.radiusM).blocked).toBe(true);
  expect(actorSpaceOverlaps(foot,key,{...body,footprint:{...body.footprint,yawRad:Math.PI/4}},space)).toBe(true);
  expect(canActorTurn(foot,key,body,Math.PI/2,space)).toBe(false);
 });
});

describe('bounded recovery from existing household-body contact',()=>{
 it('physically makes room even when the overlapping resident is already at its scheduled station',()=>{
  const {from,context}=room(),state:ResidentInteriorRouteState={},player={xM:from.xM+.4,yM:from.yM,zM:from.zM,radiusM:.3,heightM:1.9};
  context.bodies.set('player',player);const snapshot=structuredClone(player);
  const step=advanceResidentInteriorRoute(from,from,1/60,context,state);
  expect(step.moving).toBe(true);expect(step.position.xM).toBeLessThan(from.xM);
  expect(Math.hypot(step.position.xM-from.xM,step.position.zM-from.zM)).toBeLessThanOrEqual(.020001);
  expect(context.bodies.get('player')).toEqual(snapshot);expect(step.rotationY).toBe(0);expect(context.query.doors.size).toBe(0);
 });
 it('can start leaving an overlapping body instead of caching an inadmissible start forever',()=>{
  const {from,goal,context}=room(),state:ResidentInteriorRouteState={};context.bodies.set('resident:other',{xM:from.xM+.4,yM:from.yM,zM:from.zM,radiusM:.3,heightM:1.9});
  const step=advanceResidentInteriorRoute(from,goal,.1,context,state);expect(step.moving).toBe(true);expect(step.position.xM).toBeLessThan(from.xM);expect(step.position.yM).toBe(from.yM);
  expect(context.query.acceptsFoot(step.position)).toBe(true);expect(Math.hypot(step.position.xM-from.xM,step.position.zM-from.zM)).toBeLessThanOrEqual(.120001);
 });
 it('holds accepted feet at zero delta and when all legal escapes are refused',()=>{
  const {from,goal,context}=room();context.bodies.set('player',{xM:from.xM+.4,yM:from.yM,zM:from.zM,radiusM:.3,heightM:1.9});
  expect(advanceResidentInteriorRoute(from,goal,0,context,{}).position).toEqual(from);
  context.query.acceptsFoot=p=>p.xM>=from.xM&&Math.abs(p.zM-from.zM)<1e-8;
  const state:ResidentInteriorRouteState={};for(let frame=0;frame<3;frame++)expect(advanceResidentInteriorRoute(from,goal,.1,context,state).position).toEqual(from);
 });
});

it('does not repeat a blocked overlap escape until the crowd changes',()=>{
 const {from,goal,context}=room(),state:ResidentInteriorRouteState={};context.bodies.set('player',{xM:from.xM+.4,yM:from.yM,zM:from.zM,radiusM:.3,heightM:1.9});
 context.query.acceptsFoot=p=>p.xM>=from.xM&&Math.abs(p.zM-from.zM)<1e-8;
 const spy=vi.spyOn(groundMotion,'resolveGroundWalk');try{
  expect(advanceResidentInteriorRoute(from,goal,.1,context,state).position).toEqual(from);const attempted=spy.mock.calls.length;expect(attempted).toBeGreaterThan(0);
  expect(advanceResidentInteriorRoute(from,goal,.1,context,state).position).toEqual(from);expect(spy.mock.calls.length).toBe(attempted);
  context.bodies.set('player',{xM:from.xM-.4,yM:from.yM,zM:from.zM,radiusM:.3,heightM:1.9});
  expect(advanceResidentInteriorRoute(from,goal,.1,context,state).moving).toBe(true);expect(spy.mock.calls.length).toBeGreaterThan(attempted);
 }finally{spy.mockRestore();}
});

it('retries blocked contact recovery after source permission changes, without borrowing a room',()=>{
 const {from,goal,context}=room(),state:ResidentInteriorRouteState={};context.bodies.set('player',{xM:from.xM+.4,yM:from.yM,zM:from.zM,radiusM:.3,heightM:1.9});
 context.query.acceptsFoot=p=>p.xM>=from.xM&&Math.abs(p.zM-from.zM)<1e-8;
 expect(advanceResidentInteriorRoute(from,goal,.1,context,state).position).toEqual(from);
 context.policyToken={};context.query={...context.query,acceptsFoot:p=>p.xM<=from.xM&&Math.abs(p.zM-from.zM)<1e-8};
 const step=advanceResidentInteriorRoute(from,goal,.1,context,state);expect(step.moving).toBe(true);expect(step.position.xM).toBeLessThan(from.xM);expect(context.query.acceptsFoot(step.position)).toBe(true);
});

it('keeps recovery stationary when source authority or neighboring body geometry is unavailable',()=>{
 const {from,goal,context}=room();context.bodies.set('player',{xM:from.xM+.4,yM:from.yM,zM:from.zM,radiusM:.3,heightM:1.9});
 context.query.acceptsFoot=()=>false;expect(advanceResidentInteriorRoute(from,from,.1,context,{}).position).toEqual(from);
 context.query.acceptsFoot=()=>true;context.bodies.set('resident:unknown',{xM:from.xM,yM:from.yM,zM:from.zM,radiusM:NaN,heightM:1.9});
 expect(advanceResidentInteriorRoute(from,goal,.1,context,{}).position).toEqual(from);
});

it('recovers the measured box contact even when compatibility circles are clear',()=>{
 const {from,context}=room();context.body={...context.body,footprint:{minXM:-.65,maxXM:.65,minZM:-.18,maxZM:.22,yawRad:0}};
 context.query.bodyRadiusM=residentRouteRadius(context.body);context.bodies.set(key,context.body);
 context.bodies.set('player',{xM:from.xM+.8,yM:from.yM,zM:from.zM,radiusM:.3,heightM:1.9,footprint:{minXM:-.3,maxXM:.3,minZM:-.2,maxZM:.2,yawRad:0}});
 expect(actorSpaceOverlaps(from,key,{...context.body,footprint:undefined},context.bodies)).toBe(false);
 expect(actorSpaceOverlaps(from,key,context.body,context.bodies)).toBe(true);
 const step=advanceResidentInteriorRoute(from,from,.1,context,{});expect(step.moving).toBe(true);expect(step.position.xM).toBeLessThan(from.xM);expect(step.rotationY).toBe(0);
 const physical=resolveGroundWalk(context.ground,from,step.position,context.query.doors,undefined,context.body.heightM,context.query.bodyRadiusM,{...context.body.footprint!,marginM:0});
 expect(physical.blocked).toBe(false);expect(physical.xM).toBeCloseTo(step.position.xM);
});

it('never trades existing contact for a new contact with a clear neighbor',()=>{
 const {from,goal,context}=room(),state:ResidentInteriorRouteState={},neighbor={xM:from.xM-.75,yM:from.yM,zM:from.zM,radiusM:.3,heightM:1.9};
 context.bodies.set('player',{xM:from.xM+.4,yM:from.yM,zM:from.zM,radiusM:.3,heightM:1.9});context.bodies.set('resident:clear',neighbor);
 context.query.acceptsFoot=p=>Math.abs(p.zM-from.zM)<1e-8&&Math.abs(p.yM-from.yM)<1e-8;
 let point=from;for(let frame=0;frame<20;frame++){
  const step=advanceResidentInteriorRoute(point,goal,.1,context,state);expect(step.position.xM).toBeLessThanOrEqual(point.xM);
  expect(actorSpaceOverlaps(step.position,key,context.body,new Map([['resident:clear',neighbor]]))).toBe(false);
  point=step.position;context.body={...context.body,...point};context.bodies.set(key,context.body);
 }expect(point.xM).toBeLessThan(from.xM);expect(context.bodies.get('resident:clear')).toEqual(neighbor);
});


describe('approaching an occupied household station',()=>{
 it('can leave its old station but waits clear of the current occupant until they leave',()=>{
  const {from,context}=room(),goal={...from,zM:102},player={...goal,radiusM:.35,heightM:1.9};context.bodies.set('player',player);
  const waiting=walk(from,goal,context,200);expect(waiting.step.position.zM).toBeGreaterThan(from.zM+1);
  expect(waiting.step.status).not.toBe('at-station');expect(Math.hypot(waiting.step.position.xM-goal.xM,waiting.step.position.zM-goal.zM)).toBeGreaterThanOrEqual(.65-1e-6);
  for(const point of waiting.points)expect(actorSpaceOverlaps(point,key,context.body,new Map([['player',player]]))).toBe(false);
  expect(context.bodies.get('player')).toEqual(player);expect(context.query.doors.size).toBe(0);
  const retained=waiting.state.points;expect(retained?.length).toBeGreaterThan(0);
  const held=advanceResidentInteriorRoute(waiting.step.position,goal,.1,context,waiting.state);expect(held.position).toEqual(waiting.step.position);expect(waiting.state.points).toBe(retained);expect(waiting.state.pending).toBeUndefined();
  context.bodies.delete('player');let arrived=held;
  for(let frame=0;frame<100&&arrived.status!=='at-station';frame++){
   arrived=advanceResidentInteriorRoute(arrived.position,goal,.1,context,waiting.state);context.body={...context.body,...arrived.position};context.bodies.set(key,context.body);
  }expect(arrived.status).toBe('at-station');expect(arrived.position).toEqual(goal);
 });
 it('retains every other frozen body in the proposal instead of clearing the whole room',()=>{
  const {from,context}=room(),goal={...from,zM:102};
  context.bodies.set('resident:at-goal',{...goal,radiusM:.3,heightM:1.9});
  context.bodies.set('resident:in-aisle',{...from,zM:101,radiusM:.3,heightM:1.9});
  const state:ResidentInteriorRouteState={},first=planned(from,goal,context,state);expect(first.moving).toBe(true);
  expect(state.points?.some(p=>Math.abs(p.xM-from.xM)>.5)).toBe(true);
  expect(context.bodies.get('resident:in-aisle')?.zM).toBe(101);
 });
});
