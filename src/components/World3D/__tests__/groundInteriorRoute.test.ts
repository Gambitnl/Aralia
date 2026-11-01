/** Physical route receipts must honor explicit width, real stair supports,
 * current doors and the caller's allowed region without relocating actors. */
import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createGroundInteriorRouteSearch,findGroundInteriorRoute,type InteriorRouteQuery,type InteriorRouteFoot} from '../groundInteriorRoute';
import {resolveGroundWalk,resolveBuildingMotion} from '../groundBuildingMotion';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {SitePart} from '@/systems/worldforge/bridge/interiorParts';
import {buildInteriorParts} from '@/systems/worldforge/bridge/interiorParts';
import observed from '@/systems/worldforge/interior/__tests__/fixtures/observedBuildingSources.json';
import type {ObservedBuildingSource} from '@/systems/worldforge/interior/buildingSource';
import {proposeHouseholdLivingPlan} from '@/systems/worldforge/interior/householdLivingPlan';
import {canonicalTownSeedPath} from '@/systems/worldforge/town/canonicalTown';
function ground(parts:SitePart[]):GroundWorld{return {cols:1,rows:1,heights:[0],buildings:[{id:'home',xM:100,zM:100,cornersM:[{x:96,z:96},{x:104,z:96},{x:104,z:104},{x:96,z:104}],parts}]} as unknown as GroundWorld;}
const floor:SitePart={x:0,z:0,w:8,d:8,h:.12,baseY:0,colorHex:'#aaa',walkSurface:'floor'};
const wall:SitePart={x:0,z:0,w:.1,d:3,h:3,baseY:0,colorHex:'#bbb'};
function query(radius=.3):InteriorRouteQuery{return {bodyRadiusM:radius,standingHeightM:1.9,doors:new Set(),grid:{originXM:100,originZM:100,yawRad:0,stepM:.25},maxNodes:1000,
 acceptsFoot:p=>Math.abs(p.xM-100)<=3&&Math.abs(p.zM-100)<=3&&p.yM>=.1&&p.yM<.2};}
function replay(g:GroundWorld,points:InteriorRouteFoot[],q:InteriorRouteQuery){
 for(let i=1;i<points.length;i++){
  const reached=resolveGroundWalk(g,points[i-1],points[i],q.doors,q.surfaces,q.standingHeightM,q.bodyRadiusM,q.bodyFootprint);
  expect(reached.blocked,JSON.stringify({from:points[i-1],to:points[i],reached})).toBe(false);
  expect(Math.hypot(reached.xM-points[i].xM,reached.zM-points[i].zM,reached.yM-points[i].yM)).toBeLessThan(1e-6);
 }
}
describe('explicit horizontal walking envelope',()=>{
 it('refuses a one-meter gap for a1.2-meter envelope and keeps legacy/cache results exact',()=>{
  const g=ground([{...wall,z:-2.25,d:3.5},{...wall,z:2.25,d:3.5}]),from=Object.freeze({xM:98,zM:100}),to={xM:102,zM:100},doors=new Set<string>();
  const legacy=resolveBuildingMotion(g,from,to,0,doors);expect(legacy.blocked).toBe(false);
  expect(resolveBuildingMotion(g,from,to,0,doors,.6).blocked).toBe(true);
  expect(resolveBuildingMotion(g,from,to,0,doors)).toEqual(legacy);
  expect(from).toEqual({xM:98,zM:100});
 });
 it('refuses invalid widths and leaves an accepted idle pose verbatim',()=>{
  const g=ground([floor]),from=Object.freeze({xM:100,zM:100,yM:.13});
  expect(resolveGroundWalk(g,from,from,undefined,undefined,1.9,.6)).toMatchObject({...from,blocked:false});
  for(const radius of [0,-1,NaN,Infinity])expect(resolveGroundWalk(g,from,{xM:101,zM:100},undefined,undefined,1.9,radius)).toMatchObject({...from,blocked:true});
 });
});
describe('bounded physical indoor routes',()=>{
 it('goes around furniture instead of drawing the blocked straight segment',()=>{
  const g=ground([floor,wall]),from=Object.freeze({xM:98,yM:.12,zM:100}),goal={xM:102,yM:.12,zM:100},q=query(),snapshot=structuredClone({g,goal});
  expect(resolveGroundWalk(g,from,goal).blocked).toBe(true);
  const route=findGroundInteriorRoute(g,from,goal,q);expect(route.kind).toBe('route');
  if(route.kind!=='route')return;
  expect(route.points.some(p=>Math.abs(p.zM-100)>1.8)).toBe(true);expect(route.distanceM).toBeGreaterThan(4);
  replay(g,route.points,q);expect({g,goal}).toEqual(snapshot);expect(from).toEqual({xM:98,yM:.12,zM:100});
 });
 it('separates policy refusal, unsupported starts and search exhaustion without fabricating a destination',()=>{
  const g=ground([floor,wall]),from={xM:98,yM:.12,zM:100},goal={xM:102,yM:.12,zM:100};
  expect(findGroundInteriorRoute(g,from,goal,{...query(),acceptsFoot:()=>false})).toMatchObject({kind:'refused',reason:'outside-region'});
  expect(findGroundInteriorRoute(g,{...from,yM:9},goal,query())).toMatchObject({kind:'refused',reason:'outside-region'});
  expect(findGroundInteriorRoute(g,{...from,yM:9},goal,{...query(),acceptsFoot:()=>true})).toMatchObject({kind:'refused',reason:'unsupported-start'});
  expect(findGroundInteriorRoute(g,from,goal,{...query(),maxNodes:1})).toMatchObject({kind:'refused',reason:'search-limit'});
  expect(findGroundInteriorRoute(g,from,goal,{...query(),bodyRadiusM:NaN})).toMatchObject({kind:'refused',reason:'invalid-query'});
 });
 it('does not cross a prohibited room while finding a geometric detour',()=>{
  const g=ground([floor,wall]),from={xM:98,yM:.12,zM:100},goal={xM:102,yM:.12,zM:100},q={...query(),acceptsFoot:(p:InteriorRouteFoot)=>query().acceptsFoot(p)&&p.zM<=100};
  const route=findGroundInteriorRoute(g,from,goal,q);expect(route.kind).toBe('route');
  if(route.kind==='route'){expect(route.points.every(q.acceptsFoot)).toBe(true);replay(g,route.points,q);}
 });
});

function wealthy(yaw=0,sign=-1,level=0){
 const home=observed.home as unknown as ObservedBuildingSource,seed=canonicalTownSeedPath(home.worldSeed,home.burgId);
 const out=proposeHouseholdLivingPlan(home.plan,seed,{ageByTag:{'child:0':8,'child:1':9,'child:2':4,'child:3':8,'child:4':4},privateDoorLeaves:true})!;
 const parts=buildInteriorParts({id:34,role:'house',storeys:4,footprint:[[0,0],[30,0],[30,20],[0,20]]},seed,12.192,[],out.plan);
 const project=(x:number,z:number)=>{const p=new THREE.Vector3((x-15)*.3048,0,(z-10)*.3048*-sign).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);return {xM:100+p.x,zM:100+p.z};};
 const g={cols:1,rows:1,heights:[0],buildings:[{id:'home',xM:100,zM:100,cornersM:[[0,0],[30,0],[30,20],[0,20]].map(([x,z])=>{const p=project(x,z);return {x:p.xM,z:p.zM};}),parts}]} as unknown as GroundWorld;
 const q:InteriorRouteQuery={bodyRadiusM:.6,standingHeightM:1.9,doors:new Set(),grid:{originXM:100,originZM:100,yawRad:yaw,stepM:.1524},maxNodes:3000,
  acceptsFoot:p=>{const local=new THREE.Vector3(p.xM-100,0,p.zM-100).applyAxisAngle(new THREE.Vector3(0,1,0),-yaw);const x=local.x/.3048+15,z=local.z/.3048*-sign+10;
   return p.yM>=.12+level*3.048&&p.yM<=3.18+level*3.048&&x>=0&&x<=20&&z>=10&&z<=20;}};
 const from={...project(17.5,17.5),yM:.12192+level*3.048},goal={...project(17.5,12.5),yM:3.16992+level*3.048};
 return {g,q,from,goal,out};
}
describe('furnished wealthy return-stair route query',()=>{
 for(const [yaw,sign,level] of [[0,-1,0],[.73,-1,0],[0,1,0],[.73,1,0],[.73,1,2]])it(`uses real flights and landing for a 1.2-meter envelope: yaw ${yaw}, sign ${sign}, level ${level}`,()=>{
  const {g,q,from,goal,out}=wealthy(yaw,sign,level),snapshot=structuredClone({g,from,goal,out});
  const route=findGroundInteriorRoute(g,from,goal,q);expect(route.kind,JSON.stringify(route)).toBe('route');
  if(route.kind!=='route')return;
  expect(route.points[0]).toEqual(from);expect(route.points.at(-1)!.xM).toBeCloseTo(goal.xM,8);expect(route.points.at(-1)!.zM).toBeCloseTo(goal.zM,8);expect(route.points.at(-1)!.yM).toBeCloseTo(goal.yM,8);
  expect(route.points.some(p=>p.yM>from.yM+1&&p.yM<from.yM+2.5)).toBe(true);
  replay(g,route.points,q);
  const descent=findGroundInteriorRoute(g,goal,from,q);expect(descent.kind,JSON.stringify(descent)).toBe('route');if(descent.kind==='route')replay(g,descent.points,q);
  expect({g,from,goal,out}).toEqual(snapshot);
 },60000);
});

/** A wider grid is only a faster proposal. Failed proposals retain the fine
 * search budget, while every accepted edge still uses actual body/support. */
describe('optional wider stair proposal with complete fine fallback',()=>{
 it('reduces expansions on a furnished stair without losing physical support',()=>{
  const {g,q,from,goal}=wealthy();
  // This is the recorded Fenna box from the measured stair profile. The
  // larger radius-only envelope below remains a deliberate fallback case.
  q.bodyRadiusM=.5119558728059717;q.standingHeightM=1.5413617157167048;
  q.bodyFootprint={minXM:-.4544653296470643,maxXM:.4544653296470643,minZM:-.21206837892532346,maxZM:.23571185767650601,yawRad:0};
  const fine=findGroundInteriorRoute(g,from,goal,q),options={...q,coarseSearch:{stepMultiplier:4,maxNodes:128}},route=findGroundInteriorRoute(g,from,goal,options);
  expect(fine.kind).toBe('route');expect(route.kind).toBe('route');if(fine.kind!=='route'||route.kind!=='route')return;
  expect(route.expanded).toBeLessThan(fine.expanded/2);expect(route.distanceM).toBeLessThan(fine.distanceM*1.1);replay(g,route.points,options);
 });

 it('preserves the larger radius-only route when the wider grid cannot fit it',()=>{
  const {g,q,from,goal}=wealthy(),fine=findGroundInteriorRoute(g,from,goal,q);
  const options={...q,coarseSearch:{stepMultiplier:4,maxNodes:128}},route=findGroundInteriorRoute(g,from,goal,options);
  expect(fine.kind).toBe('route');expect(route.kind).toBe('route');if(fine.kind!=='route'||route.kind!=='route')return;
  expect(route.points).toEqual(fine.points);expect(route.expanded).toBeGreaterThan(fine.expanded);replay(g,route.points,options);
 });
 it('keeps the full original fine budget after a limited proposal fails',()=>{
  const {g,q,from,goal}=wealthy(),fine=findGroundInteriorRoute(g,from,goal,q);
  const options={...q,coarseSearch:{stepMultiplier:4,maxNodes:1}},route=findGroundInteriorRoute(g,from,goal,options);
  expect(fine.kind).toBe('route');expect(route.kind).toBe('route');if(fine.kind!=='route'||route.kind!=='route')return;
  expect(route.points).toEqual(fine.points);expect(route.distanceM).toBe(fine.distanceM);expect(route.expanded).toBe(fine.expanded+1);
 });
 it('falls back when a shifted coarse grid misses a real measured-body route',()=>{
  const {g,q,from,goal}=wealthy();q.grid={...q.grid,originXM:from.xM,originZM:from.zM};
  q.bodyRadiusM=.5119558728059717;q.standingHeightM=1.5413617157167048;
  q.bodyFootprint={minXM:-.4544653296470643,maxXM:.4544653296470643,minZM:-.21206837892532346,maxZM:.23571185767650601,yawRad:0};
  const fine=findGroundInteriorRoute(g,from,goal,q),proposal=findGroundInteriorRoute(g,from,goal,{...q,grid:{...q.grid,stepM:q.grid.stepM*4},maxNodes:128});
  expect(fine.kind).toBe('route');expect(proposal.kind).toBe('refused');
  const options={...q,coarseSearch:{stepMultiplier:4,maxNodes:128}},route=findGroundInteriorRoute(g,from,goal,options);
  expect(route.kind).toBe('route');if(fine.kind==='route'&&route.kind==='route'){expect(route.points).toEqual(fine.points);replay(g,route.points,options);}
 });
 it('keeps ordinary same-floor results and the direct-route preference exact',()=>{
  const g=ground([floor,wall]),from={xM:98,yM:.12,zM:100},goal={xM:102,yM:.12,zM:100},q=query();
  expect(findGroundInteriorRoute(g,from,goal,{...q,coarseSearch:{stepMultiplier:4,maxNodes:128}})).toEqual(findGroundInteriorRoute(g,from,goal,q));
 });
 it('rejects malformed optional proposal settings before admitting even a direct route',()=>{
  const g=ground([floor]),from={xM:98,yM:.12,zM:100},goal={xM:102,yM:.12,zM:100};
  for(const coarseSearch of [{stepMultiplier:1,maxNodes:128},{stepMultiplier:Infinity,maxNodes:128},{stepMultiplier:4,maxNodes:0},null]){
   const raw={...query(),coarseSearch:coarseSearch as never};expect(findGroundInteriorRoute(g,from,goal,raw)).toMatchObject({kind:'refused',reason:'invalid-query'});
  }
 });
 it('copies optional settings for a pending task and preserves sliced cancellation',()=>{
  const {g,q,from,goal}=wealthy(),options={...q,coarseSearch:{stepMultiplier:4,maxNodes:128}},expected=findGroundInteriorRoute(g,from,goal,options);
  const search=createGroundInteriorRouteSearch(g,from,goal,options);options.coarseSearch.stepMultiplier=1;
  let done=false;for(let i=0;i<5000;i++){const update=search.advance({maxWork:64,maxMs:Infinity,now:()=>0});expect(update.work).toBeLessThanOrEqual(64);if(update.kind==='done'){expect(update.result).toEqual(expected);done=true;break;}}
  expect(done).toBe(true);
  const cancelled=createGroundInteriorRouteSearch(g,from,goal,{...q,coarseSearch:{stepMultiplier:4,maxNodes:128}});cancelled.advance({maxWork:128,maxMs:Infinity,now:()=>0});cancelled.cancel();
  expect(cancelled.advance({maxWork:64,maxMs:1})).toMatchObject({kind:'done',work:0,result:{kind:'refused',reason:'cancelled'}});
 });
});

it('never jumps across a prohibited intermediate stair region in either pass',()=>{
 const {g,q,from,goal}=wealthy(),policy=q.acceptsFoot;
 const options={...q,maxNodes:100,coarseSearch:{stepMultiplier:4,maxNodes:128},acceptsFoot:(p:InteriorRouteFoot)=>policy(p)&&!(p.yM>1&&p.yM<1.3)};
 expect(options.acceptsFoot(from)).toBe(true);expect(options.acceptsFoot(goal)).toBe(true);
 const snapshot=structuredClone(from);expect(findGroundInteriorRoute(g,from,goal,options).kind).toBe('refused');expect(from).toEqual(snapshot);
});
