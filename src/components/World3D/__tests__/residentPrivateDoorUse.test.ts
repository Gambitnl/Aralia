/** Resident private doors require source claims and real bodies, not desired
 * clock positions. These fixtures do not qualify complete indoor/stair routes. */
import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import observed from '@/systems/worldforge/interior/__tests__/fixtures/observedBuildingSources.json';
import type {ObservedBuildingSource} from '@/systems/worldforge/interior/buildingSource';
import {proposeHouseholdLivingPlan} from '@/systems/worldforge/interior/householdLivingPlan';
import {computeOccupancy} from '@/systems/worldforge/interior/occupancy';
import {residentPrivateDoorAccess,occupancyScheduleForPlot} from '@/systems/worldforge/bridge/buildingOccupancy';
import {buildInteriorParts} from '@/systems/worldforge/bridge/interiorParts';
import {canonicalTownSeedPath} from '@/systems/worldforge/town/canonicalTown';
import {householdMemberIdentity,householdForPlot} from '@/systems/worldforge/town/householdBrief';
import {rootSeedPath} from '@/systems/worldforge/seedPath';
import type {TownPlotPopulation} from '@/systems/worldforge/town/townEngine';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {LoadedChunk,BuildingOccupantRender} from '@/systems/world3d/types';
import {createResidentDoorSampler,mergeResidentDoorOpens,type ResidentActualFootfall} from '../residentDoorUse';
const home=observed.home as unknown as ObservedBuildingSource;
const seed=canonicalTownSeedPath(home.worldSeed,home.burgId);
function candidate(){return proposeHouseholdLivingPlan(home.plan,seed,{ageByTag:{'child:0':8,'child:1':9,'child:2':4,'child:3':8,'child:4':4},privateDoorLeaves:true})!;}
function fixture(yaw=0,sign=-1){
 const out=candidate(),occupancy=computeOccupancy(out.plan,home.household!,{worksAtHome:false});
 const access=residentPrivateDoorAccess(out.plan,home.household!,occupancy.claims,0)!;
 const parts=buildInteriorParts({id:34,role:'house',storeys:4,footprint:[[0,0],[30,0],[30,20],[0,20]]},seed,12.192,[],out.plan);
 const part=parts.find(part=>part.door?.id===access.doors[0].id)!;
 const door=out.plan.floors.find(f=>f.level===part.door!.level)!.doors[part.door!.index];
 const own={xFt:door.x+door.openDir.nx*2.5,yFt:door.y+door.openDir.ny*2.5,level:part.door!.level,roomId:part.door!.privateRoomId!,activity:'sleeping' as const};
 const shared={xFt:door.x-door.openDir.nx*2.5,yFt:door.y-door.openDir.ny*2.5,level:part.door!.level,roomId:2,activity:'chores' as const};
 const occ:BuildingOccupantRender={id:84,burgId:675,householdMemberId:access.memberId,name:home.household!.members[0].name,ageBand:'adult',body:{} as never,
  privateDoorAccess:access,stationsByHour:Array.from({length:24},(_,h)=>({...h<7?own:shared}))};
 const origin={x:400,z:500},surfaceY=2;
 const site={id:'wf-plot-675-34',localX:100,localZ:200,surfaceY,interiorWidthFt:30,interiorDepthFt:20,rotationY:yaw,doorZSign:sign,
  interiorOriginXFt:out.plan.siteOriginFt?.x,interiorOriginYFt:out.plan.siteOriginFt?.y,parts,occupants:[occ]};
 const loaded=[{cx:0,cy:0,bundle:{sites:[site]}}] as unknown as LoadedChunk[];
 const source={id:84,householdMemberId:access.memberId,name:occ.name,homePlotId:34,workPlotId:123,occupation:'merchant',ageBand:'adult'};
 const ground={rosters:[{burgId:675,occupants:[source]}]} as unknown as GroundWorld;
 const foot=(normal=.8,along=-1.35):ResidentActualFootfall=>{
  const x=part.x+part.door!.swingX*normal+(part.door!.axis==='x'?along:0);
  const z=part.z+part.door!.swingZ*normal+(part.door!.axis==='y'?along:0);
  const v=new THREE.Vector3(x,0,z*-sign).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
  return {xM:100+v.x,yM:surfaceY+part.baseY!,zM:200+v.z,radiusM:.35,heightM:1.9};
 };
 let actual:ResidentActualFootfall|null=foot();
 const read=(key:string)=>key==='675:'+access.memberId?actual:null;
 const otherBodies=new Map<string,ResidentActualFootfall>();let observed=new Set<string>(),ledgerAvailable=true;
 const context={readBodies:()=>ledgerAvailable?new Map([...otherBodies,...(actual?[['resident:675:'+access.memberId,actual] as const]:[])]):null,
  readOpenDoors:()=>observed};
 const rawSample=createResidentDoorSampler(ground,loaded,origin,read,context);
 const sample=(clock:number)=>{const users=rawSample(clock);observed=new Set(users.keys());return users;};
 return {out,occupancy,access,part,occ,source,site,loaded,ground,origin,foot,read,sample,context,otherBodies,setObserved:(ids:string[])=>{observed=new Set(ids);},setLedger:(ready:boolean)=>{ledgerAvailable=ready;},setActual:(value:ResidentActualFootfall|null)=>{actual=value;}};
}

describe('source-backed resident private room claims',()=>{
 it('uses each member slot and keeps duplicate names distinct without changing the household',()=>{
  const out=candidate(),occ=computeOccupancy(out.plan,home.household!,{worksAtHome:false}),snapshot=structuredClone({out,household:home.household,claims:occ.claims});
  const access=home.household!.members.map((_,i)=>residentPrivateDoorAccess(out.plan,home.household!,occ.claims,i)!);
  expect(access).toHaveLength(9);expect(new Set(access.map(a=>a.memberId)).size).toBe(9);
  expect(access.every(a=>a.doors.length===1)).toBe(true);
  expect(home.household!.members[3].name).toBe(home.household!.members[5].name);
  expect(access[3].memberId).not.toBe(access[5].memberId);expect(access[3].doors).not.toEqual(access[5].doors);
  expect(access[7].doors).toEqual(access[8].doors);
  const spouseSnapshot=structuredClone(access[1]);access[0].doors[0].approachCells[0].cx=999;
  expect(access[1]).toEqual(spouseSnapshot);
  expect({out,household:home.household,claims:occ.claims}).toEqual(snapshot);
  const legacy=structuredClone(out.plan);delete legacy.doorLeafProfile;
  expect(residentPrivateDoorAccess(legacy,home.household!,occ.claims,0)).toBeUndefined();
  expect(residentPrivateDoorAccess(out.plan,home.household!,[],0)!.doors).toEqual([]);
  const head=occ.claims.find(claim=>claim.slotTag==='head')!;
  expect(()=>residentPrivateDoorAccess(out.plan,home.household!,[head,head],0)).toThrow('one original room claim');
 });
 it('carries room identities and private access only through profiled occupancy packets',()=>{
  const path=rootSeedPath(7),plotPop:TownPlotPopulation={buildingType:'townhouse',residential:true,occupants:7,homeId:'b34',district:'common'};
  const household=householdForPlot(plotPop,[plotPop],path)!.household,out=candidate();
  const input={id:34,role:'house' as const,storeys:4,buildingType:'townhouse' as const,footprint:[[0,0],[30,0],[30,20],[0,20]] as [number,number][]};
  const profile=occupancyScheduleForPlot(plotPop,[plotPop],input,path,path,out.plan)!;
  const legacyPlan=structuredClone(out.plan);delete legacyPlan.doorLeafProfile;
  const legacy=occupancyScheduleForPlot(plotPop,[plotPop],input,path,path,legacyPlan)!;
  expect(profile.occupants.length).toBeGreaterThan(0);
  for(const member of profile.occupants){
   expect(member.privateDoorAccess!.memberId).toBe(householdMemberIdentity(household,member.memberIndex));
   expect(member.stationsByHour.filter(Boolean).every(station=>station!.roomId!==undefined)).toBe(true);
  }
  const stripped=profile.occupants.map(({privateDoorAccess,...person})=>({...person,stationsByHour:person.stationsByHour.map(station=>{
   if(!station)return null;const {roomId,...rest}=station;return rest;
  })}));
  expect(stripped).toEqual(legacy.occupants);
  expect(legacy.occupants.every(member=>!Object.hasOwn(member,'privateDoorAccess'))).toBe(true);
 });
});

describe('actual-body resident private leaf use',()=>{
 for(const sign of [-1,1])it('opens the claimed upper leaf at actual feet with rotated site sign '+sign,()=>{
  const f=fixture(.63,sign),clock=7+.2/3600;
  expect([...f.sample(clock)]).toEqual([['wf-plot-675-34/'+f.part.door!.id,[f.occ.name]]]);
  expect([...createResidentDoorSampler(f.ground,f.loaded,f.origin,f.read,f.context)(clock)]).toEqual([...f.sample(clock)]);
 });
 it('requires a live body instead of trusting a predicted schedule position',()=>{
  const f=fixture(),clock=7+.2/3600;
  expect(createResidentDoorSampler(f.ground,f.loaded,f.origin)(clock).size).toBe(0);
  f.setActual(null);expect(f.sample(clock).size).toBe(0);
  f.setActual({...f.foot(),xM:900});expect(f.sample(clock).size).toBe(0);
  f.setActual({...f.foot(),yM:0});expect(f.sample(clock).size).toBe(0);
  f.setActual({...f.foot(),radiusM:NaN});expect(f.sample(clock).size).toBe(0);
  // Within reach, but over the source stair opening rather than its floor.
  f.setActual(f.foot(.1,1.3));expect(f.sample(clock).size).toBe(0);
 });
 it.each(['member','name','burg','home','permission-member','permission-room','permission-id','missing-claim','missing-cells'])(
  'refuses %s identity or access mismatch',kind=>{
   const f=fixture();
   if(kind==='member')f.occ.householdMemberId='b99:head';
   if(kind==='name')f.occ.name='Another Fenna';
   if(kind==='burg')f.occ.burgId=676;
   if(kind==='home')f.source.homePlotId=35;
   if(kind==='permission-member')f.access.memberId='b34:spouse';
   if(kind==='permission-room')f.access.doors[0].roomId=999;
   if(kind==='permission-id')f.access.doors[0].id='another-door';
   if(kind==='missing-claim')delete f.occ.privateDoorAccess;
   if(kind==='missing-cells')delete (f.access.doors[0] as Partial<typeof f.access.doors[0]>).approachCells;
   expect(f.sample(7+.2/3600).size).toBe(0);
  });
 it('does not open for a same-room chore or a passer-by in shared circulation',()=>{
  for(const privateRoom of [true,false]){
   const f=fixture(),station=structuredClone(f.occ.stationsByHour[privateRoom?0:8]!);
   f.occ.stationsByHour=Array.from({length:24},()=>({...station}));
   f.occ.stationsByHour[7]={...station,xFt:station.xFt+.5};
   expect(f.sample(7+.2/3600).size).toBe(0);
  }
 });
 it('waits rather than opening the swung leaf into its requesting resident',()=>{
  const f=fixture();f.setActual(f.foot(.6,-.6));
  expect(f.sample(7+.2/3600).size).toBe(0);
  f.setActual(f.foot());expect(f.sample(7+.2/3600).size).toBe(1);
 });
 it('uses measured standing bounds and yaw when a small radius misses long anatomy',()=>{
  const f=fixture(),actual={...f.foot(.8,-1.0),radiusM:.1,footprint:{minXM:-.2,maxXM:.2,minZM:-.7,maxZM:.7,yawRad:0}};
  f.setActual(actual);expect(f.sample(7+.2/3600).size).toBe(0);
  actual.footprint.yawRad=Math.PI/2;f.setActual(actual);expect(f.sample(7+.2/3600).size).toBe(1);
 });
 it('holds for the actual occupied passage, clears when the body leaves and preserves player-saved state',()=>{
  const f=fixture(),saved=new Set(['legacy/player-open']);
  const first=f.sample(7+.2/3600);expect(first.size).toBe(1);
  expect([...mergeResidentDoorOpens(saved,first)!]).toEqual(['legacy/player-open','wf-plot-675-34/'+f.part.door!.id]);
  expect(f.sample(8).size).toBe(1);
  f.setActual(f.foot(2));expect(f.sample(8).size).toBe(0);
  expect([...saved]).toEqual(['legacy/player-open']);
 });
 it('rebuilds a safety hold only with observed open evidence, never from body position alone',()=>{
  const f=fixture(),key='wf-plot-675-34/'+f.part.door!.id;f.setActual(f.foot(.15,0));
  expect(createResidentDoorSampler(f.ground,f.loaded,f.origin,f.read,f.context)(8).size).toBe(0);
  f.setObserved([key]);
  expect(createResidentDoorSampler(f.ground,f.loaded,f.origin,f.read,f.context)(8).size).toBe(1);
  f.setActual(f.foot());
  expect(createResidentDoorSampler(f.ground,f.loaded,f.origin,f.read,f.context)(8).size).toBe(0);
 });
 it.each(['player','companion:one','resident:other'])('waits when %s is in the turning path',key=>{
  const f=fixture();f.otherBodies.set(key,f.foot(.6,0));
  expect(f.sample(7+.2/3600).size).toBe(0);
  f.otherBodies.clear();expect(f.sample(7+.2/3600).size).toBe(1);
 });
 it('holds an observed-open door for the next body after the requesting resident leaves',()=>{
  const f=fixture(),key='wf-plot-675-34/'+f.part.door!.id;
  expect(f.sample(7+.2/3600).size).toBe(1);
  f.setActual(null);f.otherBodies.set('player',f.foot(.6,0));
  expect([...f.sample(8)]).toEqual([[key,['Your character']]]);
  f.otherBodies.clear();expect(f.sample(8).size).toBe(0);
 });
 it('refuses missing/stale ledgers and defers closing an observed-open leaf during missing measurements',()=>{
  const f=fixture(),key='wf-plot-675-34/'+f.part.door!.id;
  expect(createResidentDoorSampler(f.ground,f.loaded,f.origin,f.read)(7+.2/3600).size).toBe(0);
  const stale={...f.context,readBodies:()=>new Map([['resident:675:'+f.access.memberId,{...f.foot(),xM:999}]])};
  expect(createResidentDoorSampler(f.ground,f.loaded,f.origin,f.read,stale)(7+.2/3600).size).toBe(0);
  f.setLedger(false);expect(f.sample(7+.2/3600).size).toBe(0);
  f.setObserved([key]);expect(f.sample(8).has(key)).toBe(true);
 });
});
