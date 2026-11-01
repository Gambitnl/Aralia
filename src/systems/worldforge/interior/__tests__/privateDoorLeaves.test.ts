/** Opt-in private leaves must share exact render/collision identities and
 * preserve egress without granting a stranger bedroom or possession access.
 * These source tests do not qualify native NPC routes or saved adoption. */
import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import observed from './fixtures/observedBuildingSources.json';
import type {ObservedBuildingSource} from '../buildingSource';
import {proposeHouseholdLivingPlan} from '../householdLivingPlan';
import {privateRoomDoorSpecs} from '../doors';
import {buildInteriorParts} from '../../bridge/interiorParts';
import {canonicalTownSeedPath} from '../../town/canonicalTown';
import {generateHousehold} from '../../town/household';
import {briefFromHousehold,memberTag} from '../../town/householdBrief';
import {rootSeedPath} from '../../seedPath';
import {doorPartForState,siteDoorId,siteDoorKey,siteDoorLocalPose,sitePartLocalOffset} from '../../bridge/sitePartTransform';
import {doorInteractionError} from '../../../../components/World3D/groundDoorInteraction';
import {resolveBuildingMotion} from '../../../../components/World3D/groundBuildingMotion';
import type {GroundWorld} from '../../bridge/groundChunkLoader';
import type {FurnishingPick} from '../../../../components/World3D/groundFurnishingInteraction';
import {lodgingRoomDoorAccess,guestBedsForVisit} from '../../../gameplay/lodging';
import type {TownBuildingVisit} from '../../../../components/Worldforge/townBuildingVisit';
import {createMockGameState,createMockPlayerCharacter} from '../../../../utils/core/factories';
import type {WorldBusiness} from '../../../../types/business';
const home=observed.home as unknown as ObservedBuildingSource;
const seed=canonicalTownSeedPath(home.worldSeed,home.burgId);
const ages={'child:0':8,'child:1':9,'child:2':4,'child:3':8,'child:4':4};
function fixture(){
 const out=proposeHouseholdLivingPlan(home.plan,seed,{ageByTag:ages,privateDoorLeaves:true})!;
 const plot={id:34,role:'house' as const,storeys:4,footprint:[[0,0],[30,0],[30,20],[0,20]] as [number,number][]};
 const parts=buildInteriorParts(plot,seed,12.192,[],out.plan);
 return {out,plot,parts};
}
describe('explicit private-room leaf source profile',()=>{
 it('adds five private leaves only to the explicit v3 candidate and preserves the entire v2 output',()=>{
  const snapshot=structuredClone(home),v2=proposeHouseholdLivingPlan(home.plan,seed,{ageByTag:ages})!;
  const {out,plot,parts}=fixture();expect(out.recipe).toBe('public-landing-household-v3');expect(out.issues).toEqual([]);
  expect(out.plan.doorLeafProfile).toBe('private-room-leaves-v1');
  const {doorLeafProfile,...withoutProfile}=out.plan;expect(withoutProfile).toEqual(v2.plan);
  const old=buildInteriorParts(plot,seed,12.192,[],v2.plan);
  expect(parts.filter(part=>part.door?.privateRoomId===undefined)).toEqual(old);
  expect(parts.filter(part=>part.door)).toHaveLength(6);expect(privateRoomDoorSpecs(out.plan)).toHaveLength(5);
  expect(proposeHouseholdLivingPlan(out.plan,seed,{ageByTag:ages})).toBeUndefined();
  expect(proposeHouseholdLivingPlan(home.plan,seed,{ageByTag:ages,stairProfile:'legacy',privateDoorLeaves:true})).toBeUndefined();
  expect(proposeHouseholdLivingPlan((observed.poorHome as unknown as ObservedBuildingSource).plan,seed,{privateDoorLeaves:true})).toBeUndefined();
  expect(home).toEqual(snapshot);
 });
 it.each([5,6,7])('fits private leaves for generated family size %s and its original staff',familySize=>{
  for(const n of [3,7,12,18]){
   const path=rootSeedPath(n),household=generateHousehold(path,'variation:'+n+':'+familySize,familySize,'townhouse',undefined,'wealthy');
   const input=structuredClone(home.plan);input.household=briefFromHousehold(household,{wealth:'wealthy',worksAtHome:false});
   const counts=new Map<string,number>(),ageByTag:Record<string,number>={};
   for(const member of household.members){const index=counts.get(member.role)??0;counts.set(member.role,index+1);ageByTag[memberTag(member.role,index)]=member.age;}
   const out=proposeHouseholdLivingPlan(input,path,{ageByTag,privateDoorLeaves:true})!;
   expect(out.issues).toEqual([]);const specs=privateRoomDoorSpecs(out.plan);
   const parts=buildInteriorParts({id:34,role:'house',storeys:out.plan.floors.length,footprint:[[0,0],[30,0],[30,20],[0,20]]},path,out.plan.floors.length*3.048,[],out.plan);
   expect(parts.filter(part=>part.door?.privateRoomId!==undefined)).toHaveLength(specs.length);
   expect(new Set(specs.map(spec=>spec.level+':'+spec.roomId)).size).toBe(specs.length);
   for(const room of out.plan.floors.flatMap(floor=>floor.rooms).filter(room=>room.forSlot))expect(specs.some(spec=>out.plan.floors.find(f=>f.level===spec.level)!.rooms.find(r=>r.id===spec.roomId)===room)).toBe(true);
  }
 });
 it('keeps the new profile outside the existing saved-cottage admission',async()=>{
  const {freezeHouseholdLayoutRevision}=await import('../householdLayoutRevision');
  const {out}=fixture();
  expect(()=>freezeHouseholdLayoutRevision(home.plan,home.household!,home.manifests,out,'0351-01-01T08:00:00Z',
   {tileX:0,tileY:0,xM:0,zM:0,yM:0})).toThrow('The recorded household layout no longer preserves its original source and references.');
 });
 it('projects canonical private widths, floor heights and exact open-leaf bounds for either site sign',()=>{
  const {out,parts}=fixture();
  for(const part of parts.filter(part=>part.door?.privateRoomId!==undefined)){
   const id=part.door!,spec=privateRoomDoorSpecs(out.plan).find(spec=>spec.level===id.level&&spec.index===id.index)!;
   expect(id.privateRoomId).toBe(spec.roomId);expect(id.id).toBe(siteDoorId(id.level,id.index,spec.door.axis,part.x,part.z));
   expect(part.baseY).toBeCloseTo(id.level*3.048+.4*0.3048,5);
   expect(spec.door.axis==='x'?part.w:part.d).toBeCloseTo(4*.3048);
   for(const sign of [-1,1]){
    const pose=siteDoorLocalPose(part,sign,true),mesh=new THREE.Mesh(new THREE.BoxGeometry(part.w,part.h,part.d));
    mesh.position.set(pose.offset.x,pose.offset.y,pose.offset.z);mesh.rotation.y=pose.rotationY;mesh.updateMatrixWorld();
    const actual=new THREE.Box3().setFromObject(mesh),solid=doorPartForState(part,true),offset=sitePartLocalOffset(solid,sign);
    expect(actual.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(offset.x,offset.y,offset.z))).toBeLessThan(1e-6);
    expect(actual.getSize(new THREE.Vector3()).x).toBeCloseTo(solid.w,6);
    expect(actual.getSize(new THREE.Vector3()).z).toBeCloseTo(solid.d,6);mesh.geometry.dispose();
   }
  }
 });
 it('uses the existing movement collider for closed, opened and reclosed upper private leaves',()=>{
  const {parts}=fixture();
  for(const part of parts.filter(part=>part.door?.privateRoomId!==undefined)){
   const ground={cols:1,rows:1,heights:[0],buildings:[{id:'home',xM:100,zM:100,cornersM:[{x:95,z:95},{x:105,z:95},{x:105,z:105},{x:95,z:105}],parts:[part]}]} as unknown as GroundWorld;
   const nx=part.door!.swingX,nz=part.door!.swingZ;
   const from={xM:100+part.x-nx*.8,zM:100+part.z-nz*.8},to={xM:100+part.x+nx*.8,zM:100+part.z+nz*.8};
   const opened=new Set([siteDoorKey('home',part)]);
   expect(resolveBuildingMotion(ground,from,to,part.baseY!).blocked).toBe(true);
   expect(resolveBuildingMotion(ground,from,to,part.baseY!,opened).blocked).toBe(false);
   expect(resolveBuildingMotion(ground,from,to,part.baseY!).blocked).toBe(true);
  }
 });
 it('requires shared-side permission but preserves occupied-side egress and canonical reach checks',()=>{
  const {out,parts}=fixture();
  for(const part of parts.filter(part=>part.door?.privateRoomId!==undefined)){
   const pick:FurnishingPick={siteId:'wf-plot-675-34',part,transform:{groupX:100,groupZ:100,surfaceY:0,rotationY:0,doorZSign:-1}};
   const foot=(direction:number,along=0)=>({xM:100+part.x+part.door!.swingX*direction*.8+(part.door!.axis==='x'?along:0),
     zM:100+part.z+part.door!.swingZ*direction*.8+(part.door!.axis==='y'?along:0),yM:part.baseY!});
   const bodies=(position:ReturnType<typeof foot>)=>new Map([['player',{...position,radiusM:.3,heightM:1.9}]]);
   expect(doorInteractionError(out.plan,pick,foot(-1),false)).toContain('private');
   const permission=new Set([part.door!.level+':'+part.door!.privateRoomId]);
   expect(doorInteractionError(out.plan,pick,foot(-1),false,permission)).toContain('ready');
   expect(doorInteractionError(out.plan,pick,foot(-1),false,permission,bodies(foot(-1)))).toBeNull();
   expect(doorInteractionError(out.plan,pick,foot(1,-1.35),false,new Set(),bodies(foot(1,-1.35)))).toBeNull();
   expect(doorInteractionError(out.plan,pick,{...foot(1),yM:0},false)).toContain('same floor');
   expect(doorInteractionError(out.plan,{...pick,part:{...part,door:{...part.door!,privateRoomId:999}}},foot(1),false)).toContain('changed');
   const legacy=structuredClone(out.plan);delete legacy.doorLeafProfile;
   expect(doorInteractionError(legacy,pick,foot(1),false)).toContain('no longer available');
  }
 });
 it.each(['unknown-profile','through-private','missing-entry','duplicate-entry','bed-in-corridor','wrong-swing','wrong-direction','off-wall','narrow-opening'])(
  'refuses %s profile geometry',kind=>{
   const {out}=fixture(),plan=structuredClone(out.plan),floor=plan.floors.find(f=>f.level===1)!;
   if(kind==='unknown-profile')(plan as unknown as {doorLeafProfile:string}).doorLeafProfile='unknown';
   if(kind==='through-private'){floor.doors[0].a=1;floor.doors[0].b=0;}
   if(kind==='missing-entry')floor.doors.splice(0,1);
   if(kind==='duplicate-entry')floor.doors.push(structuredClone(floor.doors[0]));
   if(kind==='bed-in-corridor')floor.furnishings.push({kind:'bed',roomId:2,x:17.5,y:7.5,rotation:0});
   if(kind==='wrong-swing')floor.doors[0].swingInto=2;
   if(kind==='wrong-direction')floor.doors[0].openDir.nx*=-1;
   if(kind==='off-wall')floor.doors[0].x+=2;
   if(kind==='narrow-opening')floor.doors[0].clearWidthFt=3;
   expect(()=>privateRoomDoorSpecs(plan)).toThrow(/private|Private/);
  });
});

function bookedVisit(){
 const plan=structuredClone(fixture().out.plan);plan.type='inn';
 const room=plan.floors.find(f=>f.level===1)!.rooms.find(r=>r.id===0)!;room.purpose='guest-room';delete room.forSlot;
 const visit={plan,plot:{id:34}} as TownBuildingVisit;
 const bed=guestBedsForVisit(visit).find(bed=>bed.level===1&&bed.roomId===0)!;
 const state=createMockGameState({worldSeed:42,currentLocationId:'cell_7',playerCell:{cellId:7,localeCoords:null},gameTime:new Date('0351-01-01T08:00:00Z'),
  party:[createMockPlayerCharacter({id:'party-one'})],worldBusinesses:{inn:{id:'inn',ownerId:'keeper',burgId:675,plotId:34,locationId:'cell_7'} as WorldBusiness},
  lodgingReservations:[{id:'stay',businessId:'inn',businessName:'Inn',keeperId:'keeper',keeperName:'Keeper',worldSeed:42,cellId:7,locationId:'cell_7',burgId:675,plotId:34,
   partyIds:['party-one'],beds:[bed],costGp:.5,quotedAt:'0351-01-01T08:00:00Z',paidAt:'0351-01-01T08:00:00Z',expiresAt:'0351-01-02T08:00:00Z'}]});
 return {visit,state,bed};
}
describe('existing lodging consent for private door operation',()=>{
 it('grants only the current reserved guest room without changing ownership or rest state',()=>{
  const {visit,state}=bookedVisit(),snapshot=structuredClone({visit,state});
  expect([...lodgingRoomDoorAccess(state,visit,'inn')]).toEqual(['1:0']);expect({visit,state}).toEqual(snapshot);
 });
 it.each(['expired','used','party','world','cell','location','owner','plot','source','family-room','bed-index'])(
  'refuses %s reservation access',kind=>{
   const {visit,state,bed}=bookedVisit(),stay=state.lodgingReservations![0];
   if(kind==='expired')state.gameTime=new Date('0351-01-03T08:00:00Z');
   if(kind==='used')stay.usedAt='0351-01-01T09:00:00Z';
   if(kind==='party')state.party[0].id='other';
   if(kind==='world')state.worldSeed=43;
   if(kind==='cell')state.playerCell!.cellId=8;
   if(kind==='location')state.currentLocationId='cell_8';
   if(kind==='owner')state.worldBusinesses!.inn.ownerId='other';
   if(kind==='plot')state.worldBusinesses!.inn.plotId=35;
   if(kind==='source')visit.plan.buildingId=35;
   if(kind==='family-room')visit.plan.floors.find(f=>f.level===1)!.rooms.find(r=>r.id===0)!.forSlot='head';
   if(kind==='bed-index')bed.index=999;
   expect(lodgingRoomDoorAccess(state,visit,'inn').size).toBe(0);
  });
});
