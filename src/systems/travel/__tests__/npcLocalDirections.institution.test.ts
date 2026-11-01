/** A living office can locate the existing temple; it cannot create access,
 * attendance, services, discoveries or a new worker. The real life/plot resolvers
 * are used so name collisions and succession cannot be hidden by mock answers. */
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {resolveNpcLocalDirections} from '../npcLocalDirections';
import {createMockGameState} from '../../../utils/core/factories';
import {getGameDay} from '../../../utils/core';
import type {GameState,RichNPC} from '../../../types';
const source=vi.hoisted(()=>({cell:4337,burgPresent:true,span:1000,revisions:[] as unknown[],plots:[] as {id:number;role:string;footprint:[number,number][];pop?:{residential?:boolean;buildingType?:string;proprietorHomeId?:string}}[]}));
vi.mock('../../worldforge/bridge/legacySubmapBridge',()=>({getBridgeAtlas:()=>({pack:{burgs:{675:{i:675,cell:source.cell,name:'Menaikon'}}}})}));
vi.mock('../../worldforge/townsim/chronicleForLocation',()=>({burgIdForLocation:()=>source.burgPresent?675:undefined}));
vi.mock('../../worldforge/town/canonicalTown',()=>({townSpanFtForBurg:()=>source.span,canonicalArtifactTownForSiteFromAtlas:(_atlas:unknown,_seed:number,_site:unknown,revision?:unknown)=>(source.revisions.push(revision),{plan:{plots:source.plots}})}));
const plot=(id:number,role:string,x:number,y:number)=>({id,role,footprint:[[x-5,y-5],[x+5,y-5],[x+5,y+5],[x-5,y+5]] as [number,number][]});
const make=()=>{
 const npc={id:'faelan',name:'Faelan Ironsmith',role:'civilian',occupation:'keeps the household',worldforgeHousehold:{burgId:675,memberId:'b54:spouse',legacyNameUnique:true}} as unknown as RichNPC;
 const state=createMockGameState({worldSeed:7,gameTime:new Date('0351-01-05T21:13:13Z'),currentLocationId:'cell_4337',playerCell:{cellId:4337,localeCoords:{x:0,y:0}},generatedNpcs:{faelan:npc},worldBusinesses:{}});
 const day=getGameDay(state.gameTime);
 state.townSim={675:{burgId:675,layoutRevision:2,villagers:{141:{occupantId:141,name:npc.name,householdMemberId:'b54:spouse',homePlotId:54,bornDay:day-86*365,role:'priest',parentIds:[],childIds:[]}},lastSimDay:day,nextVillagerId:142}} as unknown as GameState['townSim'];
 return {state,npc,person:state.townSim[675].villagers[141],day};
};
beforeEach(()=>Object.assign(source,{revisions:[],cell:4337,burgPresent:true,span:1000,plots:[plot(54,'house',0,0),plot(168,'temple',0,-300)]}));
describe('source-bound priest temple directions',()=>{
 it('locates the existing temple from admitted life and canonical town without altering any state',()=>{
  const {state,npc}=make(),before=JSON.stringify(state);
  expect(resolveNpcLocalDirections(state,npc)).toBe("You're in Menaikon. The temple is in the northern part of town.");
  expect(JSON.stringify(state)).toBe(before);
 });
 it('retains the canonical temple choice with multiple temples rather than choosing a nearby building itself',()=>{
  source.plots.push(plot(49,'temple',0,-1500));const {state,npc}=make();
  expect(resolveNpcLocalDirections(state,npc)).toContain('northern part');
  source.plots.find(p=>p.id===168)!.footprint=plot(168,'temple',0,0).footprint;
  expect(resolveNpcLocalDirections(state,npc)).toContain('near the town center');
 });
 it.each([[300,0,'eastern'],[-300,0,'western'],[0,300,'southern'],[300,-300,'northeastern']] as const)('uses shared north-up direction at %s/%s', (x,y,area)=>{
  source.plots=[plot(168,'temple',x,y)];const {state,npc}=make();expect(resolveNpcLocalDirections(state,npc)).toContain(area+' part of town');
 });
 it.each(['not-priest','missing-life','ambiguous-life','disputed-office','missing-temple','duplicate-plot','private-temple','invalid-footprint','invalid-span'])('withholds temple advice for %s',kind=>{
  const {state,npc,person}=make();
  if(kind==='not-priest')person.role='marketmaster';
  if(kind==='missing-life')delete state.townSim[675];
  if(kind==='ambiguous-life')state.townSim[675].villagers[400]={...person,occupantId:400,role:undefined};
  if(kind==='disputed-office')state.townSim[675].villagers[400]={...person,occupantId:400,householdMemberId:'b99:head',name:'Other priest'};
  if(kind==='missing-temple')source.plots=source.plots.filter(p=>p.role!=='temple');
  if(kind==='duplicate-plot')source.plots.push({...source.plots[1]});
  if(kind==='private-temple')source.plots[1].pop={residential:true};
  if(kind==='invalid-footprint')source.plots[1].footprint=[[NaN,0],[0,1],[1,0]];
  if(kind==='invalid-span')source.span=NaN;
  expect(resolveNpcLocalDirections(state,npc)??'').not.toContain('temple');
 });
 it.each(['dead','future','foreign-cell','foreign-town'])('does not grant locality or living testimony to %s',kind=>{
  const {state,npc,person,day}=make();
  if(kind==='dead')person.diedDay=day;
  if(kind==='future')person.bornDay=day+1;
  if(kind==='foreign-cell')source.cell=999;
  if(kind==='foreign-town')source.burgPresent=false;
  expect(resolveNpcLocalDirections(state,npc)).toBeUndefined();
 });
 it('does not let a deceased former holder prevent the living successor from locating the same temple',()=>{
  const {state,npc,person,day}=make();state.townSim[675].villagers[288]={...person,occupantId:288,householdMemberId:'b112:head',name:'Former priest',diedDay:day-1};
  expect(resolveNpcLocalDirections(state,npc)).toContain('The temple is');
 });
 it('preserves an exact household identity after its recorded home move',()=>{
  const {state,npc,person}=make();person.homePlotId=112;expect(resolveNpcLocalDirections(state,npc)).toContain('The temple is');
 });
 it('keeps merchant directions first when the priest also has a registered business',()=>{
  const {state,npc}=make();npc.businessId='shop';state.worldBusinesses.shop={id:'shop',name:'The Provisions',ownerId:npc.id,burgId:675,locationId:'cell_4337',plotId:27} as never;
  source.plots.push({...plot(27,'market',300,0),pop:{buildingType:'general-store',residential:false,proprietorHomeId:'b54'}});
  expect(resolveNpcLocalDirections(state,npc)).toBe("You're in Menaikon. The Provisions is my general store, in the eastern part of town.");
 });
 it('retains authored refusal and a supplied different speaker',()=>{
  const {state,npc}=make();npc.knowledgeProfile={baseOpenness:0,topicOverrides:{global_directions:{known:true,willingnessModifier:-10}}};
  expect(resolveNpcLocalDirections(state,npc)).toBeUndefined();delete npc.knowledgeProfile;
  expect(resolveNpcLocalDirections(state,{...npc,name:'Someone Else'})).toBeUndefined();
 });
 it('survives saved life reload but stops attributing temple advice after an office change',()=>{
  const {state,npc}=make();const saved=JSON.parse(JSON.stringify(state));saved.gameTime=new Date(saved.gameTime);
  expect(resolveNpcLocalDirections(saved,npc)).toContain('The temple is');saved.townSim[675].villagers[141].role='lord';
  expect(resolveNpcLocalDirections(saved,npc)).toBe("You're in Menaikon.");
 });
});

describe('saved priest direction layout',()=>{
 it('uses the saved earlier temple plan',()=>{
  const {state,npc}=make();state.townSim[675].layoutRevision=1;
  expect(resolveNpcLocalDirections(state,npc)).toContain('The temple is in the northern part');
  expect(source.revisions).toEqual([1]);
 });
 it('withholds temple coordinates while the old town source is unresolved',()=>{
  const {state,npc}=make();delete state.townSim[675].layoutRevision;
  expect(resolveNpcLocalDirections(state,npc)).toBe("You're in Menaikon.");expect(source.revisions).toEqual([]);
 });
});
