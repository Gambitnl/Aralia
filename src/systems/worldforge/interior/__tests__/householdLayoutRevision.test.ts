import {afterEach,describe,it,expect,vi} from 'vitest';
import observed from './fixtures/observedBuildingSources.json';
import {buildingPlanSignature,readObservedBuildingSource,type ObservedBuildingSource} from '../buildingSource';
import {freezeHouseholdLayoutRevision,householdLayoutDoorStates,type HouseholdLayoutRevision} from '../householdLayoutRevision';
import * as programs from '../householdLivingPlan';
import {canonicalTownSeedPath} from '../../town/canonicalTown';
import {townBuildingVisit} from '../../../../components/Worldforge/townBuildingVisit';
import {buildInteriorParts} from '../../bridge/interiorParts';
import {buildBuildingHistoryParts} from '../../bridge/buildingHistoryParts';
import {computeOccupancy} from '../occupancy';
import {townReducer} from '@/state/reducers/townReducer';
import {createMockGameState} from '@/utils/core';
import {guestBedsForVisit} from '../../../gameplay/lodging';
import * as historyProjection from '../../bridge/buildingHistoryParts';
const poor=observed.poorHome as unknown as ObservedBuildingSource;
const seed=canonicalTownSeedPath(poor.worldSeed,poor.burgId);
const outside={tileX:4079,tileY:0,xM:477.353295555244,zM:485.91232295117925,yM:5.364260758100921};
function fixture(){
 const source=structuredClone(poor),history=JSON.parse(source.historySignature)??undefined;
 const proposal=programs.proposeHouseholdLivingPlan(source.plan,seed)!;
 const revision=freezeHouseholdLayoutRevision(source.plan,source.household!,source.manifests,proposal,'0351-01-01T07:44:33.000Z',outside);
 return {source,history,proposal,revision,context:{worldSeed:source.worldSeed,burgId:source.burgId,source}};
}
afterEach(()=>vi.restoreAllMocks());
describe('frozen modest household layout revision',()=>{
 it('keeps the immutable source while returning the exact frozen plan and remapped owned contents after JSON reload',()=>{
  const f=fixture(),before=structuredClone(f.source);f.source.householdRevision=f.revision;
  const source=JSON.parse(JSON.stringify(f.source));
  const out=readObservedBuildingSource({...f.context,source},source.plotId,f.history);
  expect(out.plan).toEqual(f.revision.plan);expect(out.household).toEqual(before.household);
  expect(out.manifests).toEqual(f.revision.references.manifests);expect(out.manifests).toHaveLength(2);
  const {householdRevision,...original}=source;expect(original).toEqual(before);
  for(const [i,m]of out.manifests.entries())expect(m.entries).toEqual(before.manifests[i].entries);
  out.plan.floors[0].furnishings[0].x+=1;out.manifests[0].entries[0].qty+=100;
  expect(f.source.householdRevision).toEqual(f.revision);
 });
 it('reads the actually played saved revision without using any current proposal coordinates',()=>{
  const source=structuredClone(poor);
  source.householdRevision=structuredClone(observed.poorHouseholdRevision as unknown as HouseholdLayoutRevision);
  const original=structuredClone(source);
  vi.spyOn(programs,'proposeHouseholdLivingPlan').mockImplementation(()=>{throw new Error('future proposal is different');});
  const out=readObservedBuildingSource({worldSeed:source.worldSeed,burgId:source.burgId,source},source.plotId,JSON.parse(source.historySignature));
  expect(source.householdRevision.planSignature).toBe('blueprint-v1:4ymiq5');
  expect(buildingPlanSignature(out.plan)).toBe('blueprint-v1:4ymiq5');
  expect(out.plan).toEqual(source.householdRevision.plan);
  expect(out.manifests).toEqual(source.householdRevision.references.manifests);
  expect(source).toEqual(original);
 });
 it('reads frozen coordinates without invoking the current proposal generator',()=>{
  const f=fixture();f.source.householdRevision=f.revision;
  const generator=vi.spyOn(programs,'proposeHouseholdLivingPlan').mockImplementation(()=>{throw new Error('future changed recipe');});
  expect(readObservedBuildingSource(f.context,f.source.plotId,f.history).plan).toEqual(f.revision.plan);
  expect(generator).not.toHaveBeenCalled();
 });
 it('projects all four beds and their actual owners, manifestations and history through existing live readers',()=>{
  const f=fixture();f.source.householdRevision=f.revision;
  const visit=townBuildingVisit(f.source.worldSeed,f.source.burgId,f.source.plotId,f.history,f.source,2);
  expect(visit.plan).toEqual(f.revision.plan);expect(visit.manifests).toEqual(f.revision.references.manifests);
  expect(visit.household).toEqual(f.source.household);
  expect(guestBedsForVisit(visit)).toEqual([]);
  const sleep=computeOccupancy(visit.plan,visit.household!,{worksAtHome:false}).stationsByHour[3];
  expect(new Set(sleep.map(s=>s.furnishingIndex)).size).toBe(4);
  expect(()=>buildBuildingHistoryParts(visit.plan,3.048)).not.toThrow();
  const parts=buildInteriorParts({id:0,role:'house',storeys:1,footprint:[[0,0],[25,0],[25,15],[0,15]],eventLog:f.history,retainedSource:f.context},seed,3.048,[],visit.plan);
  expect(parts.length).toBeGreaterThan(0);expect(parts.every(p=>[p.x,p.z,p.w,p.d,p.h].every(Number.isFinite))).toBe(true);
 });
 it('replays later condition history on the frozen layout while keeping a new structural event pending',()=>{
  const f=fixture();f.source.householdRevision=f.revision;
  const events=[...f.history,{day:0,kind:'abandonment' as const}];
  const out=readObservedBuildingSource(f.context,f.source.plotId,events);
  expect(out.plan.floors).toEqual(f.revision.plan.floors);expect(out.manifests).toEqual(f.revision.references.manifests);
  expect(out.plan.liveHistory?.eventsApplied).toBe(events.length);
  const pending=[...events,{day:1,kind:'extension' as const,payload:{phase:3,mass:{kind:'wing',x:5,y:0,w:1,h:1}}}];
  expect(()=>readObservedBuildingSource(f.context,f.source.plotId,pending)).toThrow('compatible retained-source migration');
 });
 it('keeps merged and unknown old door keys and transfers only the single explicit aliases',()=>{
  const {revision}=fixture(),[merged,kitchen,entry]=revision.references.doors;
  const old={[merged.from]:true,[kitchen.from]:false,[entry.from]:true,legacy:true},snapshot=structuredClone(old);
  const next=householdLayoutDoorStates(revision,old);
  expect(next).toEqual({...old,[kitchen.to[0]]:false,[entry.to[0]]:true});expect(old).toEqual(snapshot);
  expect(Object.hasOwn(next,merged.from)).toBe(true);
 });
 it('refuses an existing conflicting destination without changing any original door state',()=>{
  const {revision}=fixture(),entry=revision.references.doors.find(d=>d.from.startsWith('0:2:'))!;
  const old={[entry.from]:true,[entry.to[0]]:false},snapshot=structuredClone(old);
  expect(()=>householdLayoutDoorStates(revision,old)).toThrow('Conflicting household door state');expect(old).toEqual(snapshot);
 });
 it.each(['goods','owner','alias','geometry','history','source','position','height','partition'] as const)('refuses rehashed %s corruption rather than accepting a new interpretation',kind=>{
  const f=fixture();f.source.householdRevision=f.revision;
  if(kind==='goods')f.revision.references.manifests[0].entries[0].qty++;
  if(kind==='owner')f.revision.references.manifests[0].ownerHomeId='foreign';
  if(kind==='alias')f.revision.references.doors[2].to=f.revision.references.doors[1].to;
  if(kind==='geometry')f.revision.plan.floors[0].furnishings[0].x=12.5;
  if(kind==='history')f.revision.plan.backstory!.features=[];
  if(kind==='source')f.revision.sourceSignature='other';
  if(kind==='position')f.revision.position={...f.source.position};
  if(kind==='height')Reflect.deleteProperty(f.revision.position,'yM');
  if(kind==='partition')f.revision.plan.floors[0].rooms[1].cells.push({cx:0,cy:0});
  f.revision.planSignature=buildingPlanSignature(f.revision.plan);
  expect(()=>readObservedBuildingSource(f.context,f.source.plotId,f.history)).toThrow('recorded household layout');
 });
});

function admission(){
 const f=fixture(),source=f.source;
 const state=createMockGameState({worldSeed:source.worldSeed,playerCell:{cellId:source.cellId,localeCoords:null},
   playerGroundPos:{...outside},party:[createMockGameState().party[0]],townSim:{[source.burgId]:{burgId:source.burgId,layoutRevision:2,
   villagers:{},lastSimDay:0,nextVillagerId:1,chronicle:{burgId:source.burgId,events:[],nextEventId:1},
   buildingSources:{[source.plotId]:source},...(f.history?{buildingEvents:{[source.plotId]:f.history}}:{}),buildingDoors:{[source.plotId]:Object.fromEntries(f.revision.references.doors.map(d=>[d.from,true]))}}}});
 const action={type:'ADMIT_HOUSEHOLD_LAYOUT_REVISION' as const,payload:{burgId:source.burgId,plotId:source.plotId,sourceSignature:source.planSignature,mountedSignature:source.planSignature}};
 return {...f,state,action};
}
describe('household layout outside admission',()=>{
 it('commits only the frozen revision and door aliases, retaining all original state and exact accepted feet',()=>{
  const f=admission(),original=structuredClone(f.state),result=townReducer(f.state,f.action);
  expect(Object.keys(result)).toEqual(['townSim']);
  const town=result.townSim![f.source.burgId],record=town.buildingSources![f.source.plotId];
  expect(record.householdRevision).toBeDefined();
  const {householdRevision,...observation}=record;expect(observation).toEqual(f.source);
  expect(householdRevision!.position).toEqual(outside);
  for(const [key,value]of Object.entries(f.state.townSim![f.source.burgId].buildingDoors![f.source.plotId]))expect(town.buildingDoors![f.source.plotId][key]).toBe(value);
  const loaded=JSON.parse(JSON.stringify({...f.state,...result}));
  expect(loaded.playerGroundPos).toEqual(outside);
  expect(readObservedBuildingSource({...f.context,source:record},f.source.plotId,f.history).plan).toEqual(householdRevision!.plan);
  expect(townReducer(loaded,f.action)).toEqual({});expect(f.state).toEqual(original);
 });
 it.each(['inside','height','party','unknown-town','world','mounted','source','history','reservation','door-conflict'] as const)('refuses %s without moving or changing any saved property',kind=>{
  const f=admission(),town=f.state.townSim![f.source.burgId];
  if(kind==='inside')f.state.playerGroundPos={...f.source.position};
  if(kind==='height')delete f.state.playerGroundPos!.yM;
  if(kind==='party')f.state.party.push(structuredClone(f.state.party[0]));
  if(kind==='unknown-town')delete town.layoutRevision;
  if(kind==='world')f.state.worldSeed!+=1;
  if(kind==='mounted')f.action.payload.mountedSignature='other';
  if(kind==='source')f.action.payload.sourceSignature='other';
  if(kind==='history')town.buildingEvents={[f.source.plotId]:[{day:100,kind:'abandonment'}]};
  if(kind==='reservation')f.state.lodgingReservations=[{worldSeed:f.source.worldSeed,burgId:f.source.burgId,plotId:f.source.plotId} as never];
  if(kind==='door-conflict'){const entry=f.revision.references.doors[2];town.buildingDoors![f.source.plotId][entry.to[0]]=false;}
  const original=structuredClone(f.state);expect(townReducer(f.state,f.action)).toEqual({});expect(f.state).toEqual(original);
 });
 it('refuses a production history projection failure before storing any revision',()=>{
  const f=admission(),original=structuredClone(f.state);
  vi.spyOn(historyProjection,'buildBuildingHistoryParts').mockImplementation(()=>{throw new Error('unsupported surface');});
  expect(townReducer(f.state,f.action)).toEqual({});expect(f.state).toEqual(original);
 });
});
