/** Retained Hartham source, separate from evolving town-layout generation.
 * These are candidate gates, not permission to overwrite the saved home. */
import {describe,it,expect} from 'vitest';
import observed from './fixtures/observedBuildingSources.json';
import type {ObservedBuildingSource} from '../buildingSource';
import {proposeHouseholdLivingPlan,householdLivingGeometryIssues} from '../householdLivingPlan';
import {canonicalTownSeedPath} from '../../town/canonicalTown';
import {computeOccupancy} from '../occupancy';
import {buildInteriorParts} from '../../bridge/interiorParts';
import {generateHousehold} from '../../town/household';
import {briefFromHousehold,memberTag} from '../../town/householdBrief';
import {rootSeedPath} from '../../seedPath';
const home=observed.home as unknown as ObservedBuildingSource;
const seed=canonicalTownSeedPath(home.worldSeed,home.burgId);
const ages={'child:0':8,'child:1':9,'child:2':4,'child:3':8,'child:4':4};
function candidate(){return proposeHouseholdLivingPlan(home.plan,seed,{ageByTag:ages})!;}
function privateRoute(plan:typeof home.plan,level:number,target:number){
 const floor=plan.floors.find(f=>f.level===level)!,allowed=new Set(floor.rooms.filter(r=>r.isCorridor||r.id===target).map(r=>r.id)),queue=[2],seen=new Set(queue);
 for(let i=0;i<queue.length;i++)for(const d of floor.doors){const n=d.a===queue[i]?d.b:d.b===queue[i]?d.a:-1;if(allowed.has(n)&&!seen.has(n)){seen.add(n);queue.push(n);}}
 return seen.has(target);
}
describe('coherent prosperous household living proposal',()=>{
 it('gives all nine original people individual sleeping places and public landing access',()=>{
  const before=structuredClone(home),out=candidate();expect(out).toBeDefined();
  const occ=computeOccupancy(out.plan,home.household!,{worksAtHome:false});
  expect(out.plan.floors).toHaveLength(4);
  expect(occ.stationsByHour[3]).toHaveLength(9);
  const beds=occ.stationsByHour[3].map(s=>{expect(s.activity).toBe('sleeping');expect(s.furnishingIndex).toBeDefined();expect(s.level).toBeDefined();expect(s.roomId).toBeDefined();expect(privateRoute(out.plan,s.level!,s.roomId!)).toBe(true);return s.level+':'+s.furnishingIndex;});
  expect(new Set(beds).size).toBe(9);expect(home).toEqual(before);
 });
 it('reports the full 1.2m furnished reach and production projection gates',()=>{
  const out=candidate();expect(out.issues).toEqual([]);
  const parts=buildInteriorParts({id:34,role:'house',storeys:4,footprint:[[0,0],[30,0],[30,20],[0,20]]},seed,12.192,[],out.plan);
  expect(parts.length).toBeGreaterThan(0);expect(parts.every(p=>[p.x,p.z,p.w,p.d,p.h].every(Number.isFinite))).toBe(true);
 });
 it('puts both four-year-olds together beside their parents, and records service meal rooms explicitly',()=>{
  const out=candidate(),floor=out.plan.floors.find(f=>f.level===1)!;
  expect(floor.rooms.find(r=>r.forSlot==='head,spouse')).toBeDefined();
  expect(floor.rooms.find(r=>r.forSlot==='child:2,child:4')).toBeDefined();
  const occ=computeOccupancy(out.plan,home.household!,{worksAtHome:false});
  expect(occ.visitors).toHaveLength(0);
  expect(occ.stationsByHour[7].slice(0,7).every(s=>s.level===0&&s.roomId===0&&s.furnishingIndex!==undefined)).toBe(true);
  expect(occ.stationsByHour[7].slice(7).every(s=>s.level===0&&s.roomId===1&&s.furnishingIndex!==undefined)).toBe(true);
 });
 it('provides real stations throughout the original household day without changing offsite lives',()=>{
  const out=candidate(),before=structuredClone(home.household!);
  const occ=computeOccupancy(out.plan,home.household!,{worksAtHome:false});
  const original=computeOccupancy(home.plan,home.household!,{worksAtHome:false});
  for(let hour=0;hour<24;hour++)for(const station of occ.stationsByHour[hour]){
    const label='hour '+hour+' member '+station.memberIndex+' '+station.activity;
    expect(station.where,label).toBe(original.stationsByHour[hour][station.memberIndex].where);
    if(station.where!=='home')continue;
    expect(station.standingIssue,label).toBeUndefined();
    const floor=out.plan.floors.find(f=>f.level===station.level)!;
    const piece=station.furnishingIndex===undefined?undefined:floor.furnishings[station.furnishingIndex];
    if(station.activity==='sleeping')expect(piece?.kind,label).toBe('bed');
    else expect(station.standingPosition,label).toBeDefined();
  }
  expect(home.household).toEqual(before);
 });
 it.each([5,6,7])('fits generated families of %s plus their original live-in staff across distinct seeds',familySize=>{
  for(const n of [3,7,12,18]){
    const path=rootSeedPath(n),household=generateHousehold(path,'variation:'+n+':'+familySize,familySize,'townhouse',undefined,'wealthy');
    const input=structuredClone(home.plan);input.household=briefFromHousehold(household,{wealth:'wealthy',worksAtHome:false});
    const roleCounts=new Map<string,number>(),ageByTag:Record<string,number>={};
    for(const m of household.members){const index=roleCounts.get(m.role)??0;roleCounts.set(m.role,index+1);ageByTag[memberTag(m.role,index)]=m.age;}
    const out=proposeHouseholdLivingPlan(input,path,{ageByTag});
    const label=n+':'+familySize;
    expect(out,label).toBeDefined();expect(out!.issues,label).toEqual([]);
    const occ=computeOccupancy(out!.plan,household,{worksAtHome:false});
    const beds=occ.stationsByHour[3].map(s=>s.level+':'+s.furnishingIndex);
    expect(beds,label).toHaveLength(household.members.length);expect(new Set(beds).size,label).toBe(beds.length);
    for(const row of occ.stationsByHour)for(const s of row)if(s.where==='home'){
      expect(s.standingIssue,label+' hour'+s.hour+' member'+s.memberIndex).toBeUndefined();
      if(s.activity==='sleeping')expect(s.furnishingIndex,label).toBeDefined();
      else expect(s.standingPosition,label).toBeDefined();
    }
    expect(proposeHouseholdLivingPlan(input,path,{ageByTag})).toEqual(out);
  }
 });
 it('keeps the parcel and original entrance while refusing unsupported households instead of replacing them',()=>{
  const out=candidate();expect(out.plan.footprintCells).toEqual(home.plan.footprintCells);expect(out.plan.frontage).toEqual(home.plan.frontage);
  for(const changes of [{type:'inn' as const},{widthFt:25},{household:{...home.plan.household!,wealth:'poor' as const}},{household:{...home.plan.household!,worksAtHome:true}}])expect(proposeHouseholdLivingPlan({...structuredClone(home.plan),...changes},seed)).toBeUndefined();
  expect(proposeHouseholdLivingPlan(home.plan,seed,{maxStoreys:2})).toBeUndefined();
 });
});


describe('reached modest shared-hall cottage proposal',()=>{
 const poor=observed.poorHome as unknown as ObservedBuildingSource;
 const path=canonicalTownSeedPath(poor.worldSeed,poor.burgId);
 const propose=()=>proposeHouseholdLivingPlan(poor.plan,path)!;
 it('provides four individual full-size beds and furnished body routes within the original shell',()=>{
  const snapshot=structuredClone(poor),out=propose();
  expect(out.recipe).toBe('shared-hall-cottage-v1');expect(out.issues).toEqual([]);
  expect(out.plan.floors).toHaveLength(1);expect(out.plan.stairs).toEqual([]);
  expect([out.plan.widthFt,out.plan.depthFt]).toEqual([25,15]);
  const occ=computeOccupancy(out.plan,poor.household!,{worksAtHome:false});
  expect(occ.stationsByHour[3]).toHaveLength(4);
  expect(new Set(occ.stationsByHour[3].map(s=>s.furnishingIndex)).size).toBe(4);
  for(const s of occ.stationsByHour[3])expect(out.plan.floors[0].furnishings[s.furnishingIndex!]?.kind).toBe('bed');
  expect(out.plan.floors[0].furnishings.filter(p=>p.kind==='bed').every(p=>p.rotation===90)).toBe(true);
  expect(poor).toEqual(snapshot);
 });
 it('retains the actual roof, windows, hearth, culture, applied history and sealed outer wall surface',()=>{
  const out=propose(),a=poor.plan,b=out.plan;
  for(const key of ['roof','masses','footprintCells','style','styleResolved','eventLog','liveHistory','household'] as const)expect(b[key],key).toEqual(a[key]);
  expect(b.floors[0].windows).toEqual(a.floors[0].windows);
  expect(b.floors[0].furnishings.find(p=>p.kind==='hearth')).toEqual(a.floors[0].furnishings.find(p=>p.kind==='hearth'));
  for(const feature of a.backstory!.features)if('wallRunIndex'in feature){
   const target=b.backstory!.features.find(f=>f.kind===feature.kind)!;
   expect('wallRunIndex'in target).toBe(true);
   if('wallRunIndex'in target)expect(b.floors[0].wallRuns[target.wallRunIndex]).toEqual(a.floors[0].wallRuns[feature.wallRunIndex]);
  }
 });
 it('keeps the original daily home and work destinations while giving children actual sleeping furniture',()=>{
  const out=propose(),old=computeOccupancy(poor.plan,poor.household!,{worksAtHome:false}),next=computeOccupancy(out.plan,poor.household!,{worksAtHome:false});
  for(let hour=0;hour<24;hour++)for(const s of next.stationsByHour[hour]){
   expect(s.where,'hour '+hour+' member '+s.memberIndex).toBe(old.stationsByHour[hour][s.memberIndex].where);
   if(s.where==='home')expect(s.standingIssue,'hour '+hour+' member '+s.memberIndex).toBeUndefined();
  }
 });
 it.each([2,3,4])('keeps modest programs workable for %s sleepers across seeds and both modest wealth tiers',count=>{
  for(const wealth of ['poor','common'] as const)for(const n of [3,12,18]){
   const input=structuredClone(poor.plan);input.household!.slots=input.household!.slots.slice(0,count);input.household!.wealth=wealth;
   // Cell membership is authoritative; incidental ordering must not suppress a valid program.
   input.floors[0].rooms.forEach(r=>r.cells.reverse());
   const out=proposeHouseholdLivingPlan(input,rootSeedPath(n))!;expect(out).toBeDefined();expect(out.issues).toEqual([]);
   expect(out.plan.floors[0].furnishings.filter(p=>p.kind==='bed')).toHaveLength(count);
   expect(out.plan.household).toEqual(input.household);
  }
 });
 it('does not replace an attached, private-room or home-work program with the measured shared hall',()=>{
  for(const mutate of [(p:typeof poor.plan)=>{p.ensemble!.partyWallLeft=true;},(p:typeof poor.plan)=>{p.household!.worksAtHome=true;},(p:typeof poor.plan)=>{p.floors[0].rooms[0].purpose='bedroom';},(p:typeof poor.plan)=>{p.household!.wealth='wealthy';}]){
   const input=structuredClone(poor.plan);mutate(input);const snapshot=structuredClone(input);
   expect(proposeHouseholdLivingPlan(input,path)).toBeUndefined();expect(input).toEqual(snapshot);
  }
 });
});

describe('body-aware prosperous stairs and public spine',()=>{
 it('reserves six cells for real width and keeps the historical draft explicitly unqualified',()=>{
  const wide=candidate();expect(wide.recipe).toBe('public-landing-household-v2');
  expect(wide.plan.stairs).toHaveLength(3);
  for(const stair of wide.plan.stairs){expect(stair.layout!.shaftCells).toHaveLength(6);expect(stair.layout!.flightWidthFt*.3048).toBeGreaterThanOrEqual(1.2);expect(stair.layout!.landingDepthFt*.3048).toBeGreaterThanOrEqual(1.2);}
  const legacy=proposeHouseholdLivingPlan(home.plan,seed,{ageByTag:ages,stairProfile:'legacy'})!;
  expect(legacy.recipe).toBe('public-landing-household-v1');expect(legacy.plan.floors).toHaveLength(3);
  expect(legacy.issues).toContain('stair body width 0');expect(legacy.issues).toContain('blocked stair portal 1');
  expect(proposeHouseholdLivingPlan(home.plan,seed,{ageByTag:ages,maxStoreys:3})).toBeUndefined();
  expect(proposeHouseholdLivingPlan(home.plan,seed)).toBeUndefined();
  expect(proposeHouseholdLivingPlan(home.plan,seed,{ageByTag:{...ages,'child:2':NaN}})).toBeUndefined();
 });
 it('does not count a missing landing cell or a blocked public spine as usable floor',()=>{
  const missing=structuredClone(candidate().plan),middle=missing.floors.find(f=>f.level===1)!;
  middle.rooms.find(r=>r.id===2)!.cells=middle.rooms.find(r=>r.id===2)!.cells.filter(c=>c.cx!==3||c.cy!==2);
  expect(householdLivingGeometryIssues(missing)).toContain('missing stair portal 1');
  const blocked=structuredClone(candidate().plan);blocked.floors[1].furnishings.push({kind:'chest',roomId:2,x:17.5,y:7.5,rotation:0});
  expect(householdLivingGeometryIssues(blocked).some(issue=>issue.startsWith('corridor body route 1:2'))).toBe(true);
 });
 it('keeps the wider wealthy proposal outside the existing saved-cottage admission',async()=>{
  const {freezeHouseholdLayoutRevision}=await import('../householdLayoutRevision');
  expect(()=>freezeHouseholdLayoutRevision(home.plan,home.household!,home.manifests,candidate(),'2026-11-01',home.position)).toThrow('The recorded household layout no longer preserves its original source and references.');
 });
});
