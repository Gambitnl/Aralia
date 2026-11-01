/** Planning must yield across frames without changing the physical route or
 * granting movement/door authority. Clock injection makes budget tests exact;
 * these are source-level checks, not native frame-time acceptance. */
import {describe,it,expect} from 'vitest';
import {createGroundInteriorRouteSearch,createInteriorRouteTask,findGroundInteriorRoute,type InteriorRouteResult,type InteriorRouteSearch,type InteriorRouteQuery} from '../groundInteriorRoute';
import {advanceResidentInteriorRoute,createResidentPlanningFrameBudget,cancelResidentInteriorPlanning,type ResidentInteriorRouteState,type ResidentInteriorRouteContext} from '../residentInteriorMotion';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {SitePart} from '@/systems/worldforge/bridge/interiorParts';
const floor:SitePart={x:0,z:0,w:8,d:8,h:.12,baseY:0,colorHex:'#aaa',walkSurface:'floor'};
function fixture(obstacle=true){
 const parts=[floor];if(obstacle)parts.push({x:0,z:0,w:.1,d:3,h:3,baseY:0,colorHex:'#bbb'});
 const ground={cols:1,rows:1,heights:[0],buildings:[{id:'home',xM:100,zM:100,cornersM:[{x:96,z:96},{x:104,z:96},{x:104,z:104},{x:96,z:104}],parts}]} as unknown as GroundWorld;
 const from={xM:98,yM:.12,zM:100},goal={xM:102,yM:.12,zM:100};
 const query:InteriorRouteQuery={bodyRadiusM:.3,standingHeightM:1.9,doors:new Set(),grid:{originXM:100,originZM:100,yawRad:0,stepM:.25},maxNodes:1000,acceptsFoot:p=>Math.abs(p.xM-100)<=3&&Math.abs(p.zM-100)<=3&&Math.abs(p.yM-.12)<.02};
 return {ground,from,goal,query};
}
function drain(search:InteriorRouteSearch,work=13){
 let slices=0;for(;slices<30000;slices++){const update=search.advance({maxWork:work,maxMs:Infinity,now:()=>0});expect(update.work).toBeLessThanOrEqual(work);if(update.kind==='done')return {result:update.result,slices:slices+1};}
 throw new Error('Search did not finish');
}
function* units(count:number,tick:()=>void=()=>{}):Generator<void,InteriorRouteResult,void>{
 for(let i=0;i<count;i++){tick();yield;}return {kind:'refused',reason:'no-grid-route',expanded:count};
}
describe('resumable physical route planning',()=>{
 for(const obstacle of [false,true])it('matches the batch path with bounded slices, obstacle='+obstacle,()=>{
  const f=fixture(obstacle),expected=findGroundInteriorRoute(f.ground,f.from,f.goal,f.query),search=createGroundInteriorRouteSearch(f.ground,f.from,f.goal,f.query);
  const out=drain(search);expect(out.slices).toBeGreaterThan(2);expect(out.result).toEqual(expected);
  expect(search.advance({maxWork:1,maxMs:1})).toMatchObject({kind:'done',work:0,result:expected});
 });
 it('does no eager physical work and splits even a straight route',()=>{
  const f=fixture(false);let checks=0;f.query.acceptsFoot=p=>{checks++;return p.yM===.12;};
  const search=createGroundInteriorRouteSearch(f.ground,f.from,f.goal,f.query);expect(checks).toBe(0);
  expect(search.advance({maxWork:4,maxMs:Infinity,now:()=>0})).toMatchObject({kind:'pending',work:4});expect(checks).toBeLessThan(10);
  expect(drain(search).result.kind).toBe('route');
 });
 it('stops at the injected cooperative clock deadline',()=>{
  let clock=0;const search=createInteriorRouteTask(units(20,()=>{clock+=.6;}),new Set());
  expect(search.advance({maxWork:20,maxMs:1,now:()=>clock})).toEqual({kind:'pending',work:2,elapsedMs:1.2});
 });
 it('cancels without resuming work and rejects a changed door snapshot',()=>{
  const f=fixture(),search=createGroundInteriorRouteSearch(f.ground,f.from,f.goal,f.query);
  search.advance({maxWork:2,maxMs:1});search.cancel();expect(drain(search).result).toMatchObject({kind:'refused',reason:'cancelled'});
  const second=createGroundInteriorRouteSearch(f.ground,f.from,f.goal,f.query);(f.query.doors as Set<string>).add('changed');
  expect(second.advance({maxWork:5,maxMs:1})).toMatchObject({kind:'done',work:0,result:{kind:'refused',reason:'changed-query'}});
 });
 it('copies scalar pose and grid inputs while preserving immutable geometry policy',()=>{
  const f=fixture(false),expected=findGroundInteriorRoute(f.ground,f.from,f.goal,f.query),search=createGroundInteriorRouteSearch(f.ground,f.from,f.goal,f.query);
  f.from.xM=500;f.goal.zM=500;f.query.grid.stepM=100;expect(drain(search).result).toEqual(expected);
 });
});
describe('shared resident frame allowance',()=>{
 it('uses the remaining allowance when a sole resident has no waiting peer',()=>{
  const budget=createResidentPlanningFrameBudget(Infinity,128,()=>0),search=createInteriorRouteTask(units(1000),new Set());
  expect(budget.advance('solo',0,search).work).toBe(128);
  expect(budget.advance('solo',0,search).work).toBe(0);
 });

 it('limits the sum of work and gives every waiting resident a turn',()=>{
  const budget=createResidentPlanningFrameBudget(Infinity,20,()=>0),served=Array(5).fill(0),jobs=Array.from({length:5},(_,i)=>createInteriorRouteTask(units(500,()=>{served[i]++;}),new Set()));
  for(let frame=0;frame<30;frame++){let total=0;for(let i=0;i<jobs.length;i++){const out=budget.advance(String(i),frame,jobs[i]);total+=out.work;}expect(total).toBeLessThanOrEqual(20);}
  expect(served.every(work=>work>0)).toBe(true);expect(Math.max(...served)-Math.min(...served)).toBeLessThanOrEqual(32);
 });
 it('shares time across actors and clears cancelled or abandoned registrations',()=>{
  let clock=0;const budget=createResidentPlanningFrameBudget(1,100,()=>clock),a=createInteriorRouteTask(units(100,()=>{clock+=.6;}),new Set()),b=createInteriorRouteTask(units(100,()=>{clock+=.6;}),new Set());
  // A sole job uses the time allowance; one atomic unit may cross its deadline.
  expect(budget.advance('a',0,a).work).toBe(2);expect(budget.advance('b',0,b).work).toBe(0);expect(budget.advance('a',0,a).work).toBe(0);
  budget.cancel('a',a);budget.forget('a');expect(budget.advance('b',1,b).work).toBe(2);
  const fresh=createInteriorRouteTask(units(1000),new Set());budget.advance('c',2,fresh);
  expect(budget.advance('c',3,fresh).work).toBeGreaterThan(0);expect(budget.advance('c',4,fresh).work).toBeGreaterThan(0);
 });

 it('uses leftover work for validated peers and never runs an unvalidated old job',()=>{
  const budget=createResidentPlanningFrameBudget(Infinity,128,()=>0);let ticksA=0,ticksB=0;
  const a=createInteriorRouteTask(units(2000,()=>{ticksA++;}),new Set()),b=createInteriorRouteTask(units(2000,()=>{ticksB++;}),new Set());
  budget.advance('a',0,a);budget.advance('b',0,b);const aBefore=ticksA;
  // b is oldest but has not validated this frame, so a cannot run b yet.
  expect(budget.advance('a',1,a).work).toBe(0);expect(ticksA).toBe(aBefore);expect(ticksB).toBe(0);
  expect(budget.advance('b',1,b).work).toBe(128);expect(ticksB).toBe(128);
  // Both are now ready at equal work. A later callback may finish the frame's
  // allowance across both, rather than wasting it after their one call each.
  expect(budget.advance('a',2,a).work).toBe(16);expect(budget.advance('b',2,b).work).toBe(112);
  expect(ticksA+ticksB).toBe(384);
 });

 it('delivers a peer-completed result on its own next validated call',()=>{
  const budget=createResidentPlanningFrameBudget(Infinity,128,()=>0),a=createInteriorRouteTask(units(200),new Set()),b=createInteriorRouteTask(units(1),new Set());
  expect(budget.advance('a',0,a).kind).toBe('pending');expect(budget.advance('b',0,b).kind).toBe('pending');
  expect(budget.advance('a',1,a).work).toBe(0);expect(budget.advance('b',1,b).kind).toBe('done');
  expect(budget.advance('a',2,a)).toMatchObject({kind:'done',work:0,result:{expanded:200}});
 });
 it('does not let stale cleanup cancel a replacement job',()=>{
  const budget=createResidentPlanningFrameBudget(Infinity,128,()=>0),a=createInteriorRouteTask(units(500),new Set()),b=createInteriorRouteTask(units(500),new Set());
  budget.advance('resident',0,a);budget.advance('resident',1,b);budget.cancel('resident',a);budget.forget('resident');
  expect(budget.advance('resident',2,b).work).toBeGreaterThan(0);expect(drain(b).result).toMatchObject({reason:'no-grid-route'});
 });
});
describe('resident pending job authority',()=>{
 function actor(){const f=fixture(),body={...f.from,radiusM:.3,heightM:1.9},budget=createResidentPlanningFrameBudget(Infinity,1,()=>0);
  const context:ResidentInteriorRouteContext={ground:f.ground,key:'resident',body,bodies:new Map([['resident',body]]),query:f.query,doors:[],policyToken:{},planningFrame:{id:0,budget}};
  return {...f,context,state:{} as ResidentInteriorRouteState};}
 // Moving bystanders no longer erase a frozen candidate; separate tests below
 // require fresh swept-body refusal before any newly occupied step.
 for(const change of ['source','door','destination','own-facing','dimensions','accepted-feet','proposal'] as const)it('holds feet and cancels pending work on '+change+' change',()=>{
  const f=actor(),first=advanceResidentInteriorRoute(f.from,f.goal,.1,f.context,f.state);expect(first).toMatchObject({position:f.from,moving:false,status:'planning'});
  const old=f.state.pending!.search;
  if(change==='source')f.context.policyToken={};if(change==='door')f.query.doors=new Set(['changed']);
  if(change==='destination')f.goal={...f.goal,zM:101};
  if(change==='own-facing')f.context.body.footprint={minXM:-.1,maxXM:.1,minZM:-.1,maxZM:.1,yawRad:1};
  if(change==='dimensions')f.context.body.heightM=1.8;
  if(change==='proposal')f.query.coarseSearch={stepMultiplier:4,maxNodes:128};
  if(change==='accepted-feet')f.from={...f.from,zM:100.1};
  f.context.planningFrame!.id++;expect(advanceResidentInteriorRoute(f.from,f.goal,.1,f.context,f.state).position).toEqual(f.from);
  expect(drain(old).result).toMatchObject({reason:'cancelled'});expect(f.context.query.doors.size).toBe(change==='door'?1:0);
 });
 it('cancels on loss of authority and preserves accepted feet',()=>{
  const f=actor();advanceResidentInteriorRoute(f.from,f.goal,.1,f.context,f.state);const old=f.state.pending!.search;
  cancelResidentInteriorPlanning('resident',f.state,f.context.planningFrame!.budget);expect(f.state.pending).toBeUndefined();expect(drain(old).result).toMatchObject({reason:'cancelled'});expect(f.state.expected).toEqual(f.from);
 });
});

// A path is a proposal through a frozen crowd, never authority to pass through
// today's people. Unrelated movement must not erase all search progress.
describe('planning while people keep moving',()=>{
 function actor(){const f=fixture(false),body={...f.from,radiusM:.3,heightM:1.9},budget=createResidentPlanningFrameBudget(Infinity,16,()=>0);
  const context:ResidentInteriorRouteContext={ground:f.ground,key:'resident',body,bodies:new Map([['resident',body]]),query:f.query,doors:[],policyToken:{},planningFrame:{id:0,budget}};
  return {...f,context,state:{} as ResidentInteriorRouteState};}
 function advance(f:ReturnType<typeof actor>,frame:number){
  f.context.planningFrame!.id=frame;const prior=f.from,step=advanceResidentInteriorRoute(prior,f.goal,.1,f.context,f.state);
  expect(Math.hypot(step.position.xM-prior.xM,step.position.zM-prior.zM)).toBeLessThanOrEqual(.120001);
  f.from=step.position;f.context.body={...f.context.body,...f.from};f.context.bodies.set('resident',f.context.body);return step;
 }
 it('finishes a route while a distant person moves every frame',()=>{
  const f=actor();let arrival=false;
  for(let frame=0;frame<1000;frame++){
   f.context.bodies.set('player',{xM:1000+Math.sin(frame),yM:.12,zM:1000,radiusM:.3,heightM:1.9});
   if(advance(f,frame).status==='at-station'){arrival=true;break;}
  }expect(arrival).toBe(true);expect(f.from).toEqual(f.goal);
 });
 it('keeps the planning proposal but refuses a newly occupied walking segment',()=>{
  const f=actor();advance(f,0);const search=f.state.pending!.search;
  f.context.bodies.set('player',{xM:100,yM:.12,zM:100,radiusM:.3,heightM:1.9});advance(f,1);
  expect(f.state.pending!.search).toBe(search);
  let walked=false,held=false;
  for(let frame=2;frame<1000;frame++){
   const step=advance(f,frame);walked ||= step.moving;
   // A fresh swept-body check protects the player even though the candidate
   // was planned before they stepped into its path.
   expect(Math.hypot(f.from.xM-100,f.from.zM-100)).toBeGreaterThanOrEqual(.6-1e-6);
   if(walked&&!step.moving&&step.status==='blocked'){held=true;break;}
  }expect(walked).toBe(true);expect(held).toBe(true);
 });
 it('does not cache a frozen-crowd refusal as a refusal for the new crowd',()=>{
  const f=actor();f.query.acceptsFoot=p=>Math.abs(p.zM-100)<.05&&p.xM>=97&&p.xM<=103&&Math.abs(p.yM-.12)<.01;f.query.maxNodes=100;
  f.context.bodies.set('player',{xM:100,yM:.12,zM:100,radiusM:.3,heightM:1.9});advance(f,0);
  f.context.bodies.set('player',{xM:1000,yM:.12,zM:1000,radiusM:.3,heightM:1.9});let arrival=false;
  for(let frame=1;frame<5000;frame++)if(advance(f,frame).status==='at-station'){arrival=true;break;}
  expect(arrival).toBe(true);expect(f.from).toEqual(f.goal);
 });
});
