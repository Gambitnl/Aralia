/** Full-swing body queries must preserve exact old endpoints, catch bodies
 * between them and keep current private permission separate from clearance. */
import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import type {SitePart} from '@/systems/worldforge/bridge/interiorParts';
import {buildInteriorParts} from '@/systems/worldforge/bridge/interiorParts';
import {siteDoorLocalPoseAtFraction,siteDoorLocalPose,doorPartForState,type SiteGroupTransform} from '@/systems/worldforge/bridge/sitePartTransform';
import {doorBodyClearance} from '../doorBodyClearance';
import type {ActorBody} from '../actorPersonalSpace';
import {doorInteractionError} from '../groundDoorInteraction';
import observed from '@/systems/worldforge/interior/__tests__/fixtures/observedBuildingSources.json';
import type {ObservedBuildingSource} from '@/systems/worldforge/interior/buildingSource';
import {proposeHouseholdLivingPlan} from '@/systems/worldforge/interior/householdLivingPlan';
import {canonicalTownSeedPath} from '@/systems/worldforge/town/canonicalTown';
function part(axis:'x'|'y'='x',swing=1):SitePart{return {x:0,z:0,w:axis==='x'?1.2:.06,d:axis==='y'?1.2:.06,h:2.1,baseY:3.048,colorHex:'#65462f',
 door:{id:'1:0:'+axis+':0.0000:0.0000',level:1,index:0,axis,swingX:axis==='y'?swing:0,swingZ:axis==='x'?swing:0,privateRoomId:0}};}
const transform=(sign=-1):SiteGroupTransform=>({groupX:100,groupZ:200,surfaceY:2,rotationY:.37,doorZSign:sign});
function bodyAtPose(p:SitePart,t:SiteGroupTransform,fraction:number,radius=.05):ActorBody{
 const pose=siteDoorLocalPoseAtFraction(p,t.doorZSign,fraction),group=new THREE.Group();
 group.position.set(t.groupX,t.surfaceY,t.groupZ);group.rotation.y=t.rotationY;
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(p.w,p.h,p.d));mesh.position.set(pose.offset.x,pose.offset.y,pose.offset.z);mesh.rotation.y=pose.rotationY;group.add(mesh);group.updateMatrixWorld(true);
 const center=mesh.getWorldPosition(new THREE.Vector3());mesh.geometry.dispose();
 return {xM:center.x,zM:center.z,yM:t.surfaceY+(p.baseY??0),radiusM:radius,heightM:1.8};
}
describe('conservative quarter-turn body clearance',()=>{
 for(const axis of ['x','y'] as const)for(const swing of [-1,1])for(const sign of [-1,1])it('uses exact endpoints and catches an intermediate body: '+axis+'/'+swing+'/'+sign,()=>{
  const p=part(axis,swing),t=transform(sign),body=bodyAtPose(p,t,.5),bodies=new Map([['person',body]]),snapshot=structuredClone({p,t,bodies});
  expect(siteDoorLocalPoseAtFraction(p,sign,0)).toEqual(siteDoorLocalPose(p,sign,false));
  expect(siteDoorLocalPoseAtFraction(p,sign,1)).toEqual(siteDoorLocalPose(p,sign,true));
  // The physical hinge must stay fixed between the endpoints too. Derive it
  // independently from the closed wall edge, then let Three transform the mesh.
  const length=axis==='x'?p.w:p.d;
  const hingeLocal=new THREE.Vector3(axis==='x'?p.x-length/2:p.x,0,(axis==='y'?p.z-length/2:p.z)*-sign);
  const group=new THREE.Group();group.position.set(t.groupX,t.surfaceY,t.groupZ);group.rotation.y=t.rotationY;group.updateMatrixWorld(true);
  const expected=group.localToWorld(hingeLocal);
  for(const fraction of [.25,.5,.75]){
   const pose=siteDoorLocalPoseAtFraction(p,sign,fraction),leaf=new THREE.Object3D();leaf.position.set(pose.offset.x,0,pose.offset.z);leaf.rotation.y=pose.rotationY;group.add(leaf);group.updateMatrixWorld(true);
   const actual=leaf.localToWorld(new THREE.Vector3(axis==='x'?-length/2:0,0,axis==='y'?sign*length/2:0));
   expect(actual.distanceTo(expected)).toBeLessThan(1e-9);group.remove(leaf);
  }
  expect(doorBodyClearance(p,t,bodies,'closed')).toEqual({valid:true,blockers:[]});
  expect(doorBodyClearance(doorPartForState(p,true),t,bodies,'closed')).toEqual({valid:true,blockers:[]});
  expect(doorBodyClearance(p,t,bodies)).toEqual({valid:true,blockers:['person']});
  expect({p,t,bodies}).toEqual(snapshot);
 });
 it('covers a thin body between adjacent samples rather than leaving gaps in the turning arc',()=>{
  const p=part(),t={...transform(),rotationY:0},angle=Math.PI/48;
  const body:ActorBody={xM:100-.6+1.2*Math.cos(angle),zM:200+1.2*Math.sin(angle),yM:2+3.048,radiusM:.001,heightM:1.8};
  expect(doorBodyClearance(p,t,new Map([['thin',body]]))).toEqual({valid:true,blockers:['thin']});
 });
 it('keeps other floors and distant bodies clear, and reports every intersecting body deterministically',()=>{
  const p=part(),t=transform(),near=bodyAtPose(p,t,.5);
  const bodies=new Map([['far',{...near,xM:near.xM+20}],['upstairs',{...near,yM:near.yM+3.048}],['player',near],['companion:one',{...near}]]);
  expect(doorBodyClearance(p,t,bodies)).toEqual({valid:true,blockers:['companion:one','player']});
 });
 it('rejects missing or malformed measurements and fractions instead of assuming an empty room',()=>{
  const p=part(),t=transform(),body=bodyAtPose(p,t,.5);
  expect(doorBodyClearance(p,t,null).valid).toBe(false);
  for(const bad of [{...body,radiusM:NaN},{...body,heightM:0},{...body,footprint:{minXM:1,maxXM:-1,minZM:0,maxZM:1,yawRad:0}}])
   expect(doorBodyClearance(p,t,new Map([['bad',bad]])).valid).toBe(false);
  expect(doorBodyClearance(p,{...t,doorZSign:0},new Map()).valid).toBe(false);
  for(const fraction of [-1,2,NaN])expect(()=>siteDoorLocalPoseAtFraction(p,-1,fraction)).toThrow('between zero and one');
 });
});

function privatePick(){
 const home=observed.home as unknown as ObservedBuildingSource,seed=canonicalTownSeedPath(home.worldSeed,home.burgId);
 const out=proposeHouseholdLivingPlan(home.plan,seed,{ageByTag:{'child:0':8,'child:1':9,'child:2':4,'child:3':8,'child:4':4},privateDoorLeaves:true})!;
 const parts=buildInteriorParts({id:34,role:'house',storeys:4,footprint:[[0,0],[30,0],[30,20],[0,20]]},seed,12.192,[],out.plan);
 const p=parts.find(part=>part.door?.privateRoomId!==undefined)!;
 const t={groupX:100,groupZ:200,surfaceY:2,rotationY:0,doorZSign:-1};
 const player:ActorBody={xM:100+p.x-p.door!.swingX*.8,zM:200+p.z-p.door!.swingZ*.8,yM:2+p.baseY!,radiusM:.25,heightM:1.9};
 const permission=new Set([p.door!.level+':'+p.door!.privateRoomId]);
 return {plan:out.plan,pick:{siteId:'wf-plot-675-34',part:p,transform:t},player,permission};
}
describe('player private door operation with the live scene ledger',()=>{
 it('refuses opening and closing through another body while preserving room consent and inputs',()=>{
  const f=privatePick(),other=bodyAtPose(f.pick.part,f.pick.transform,.5),bodies=new Map([['player',f.player],['other',other]]),snapshot=structuredClone({f,bodies});
  for(const open of [false,true])expect(doorInteractionError(f.plan,f.pick,f.player,open,f.permission,bodies)).toContain('door swing');
  bodies.delete('other');expect(doorInteractionError(f.plan,f.pick,f.player,false,f.permission,bodies)).toBeNull();
  expect(doorInteractionError(f.plan,f.pick,f.player,false,new Set(),bodies)).toContain('private');
  expect(f).toEqual(snapshot.f);
 });
 it('requires the current measured player rather than an absent, stale or unmounted body ledger',()=>{
  const f=privatePick();
  for(const bodies of [undefined,null,new Map(),new Map([['player',{...f.player,xM:999}]])])
   expect(doorInteractionError(f.plan,f.pick,f.player,false,f.permission,bodies)).toContain('ready');
 });
});
