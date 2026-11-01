/** A useful referral names a real public library, never invented testimony,
 * opening hours, admission or a quest. Exact heard words use existing memory. */
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {act,renderHook} from '@testing-library/react';
import {useDialogueSystem} from '../../../hooks/useDialogueSystem';
import {createMockGameState} from '../../../utils/core/factories';
import {createEmptyMemory} from '../../../utils/world/memoryUtils';
import {getAvailableTopics,processTopicSelection} from '../../../services/dialogueService';
import {worldReducer} from '../../../state/reducers/worldReducer';
import type {GameState,RichNPC} from '../../../types';
import type {TownPlan} from '../../worldforge/artifacts';
import type {AppAction} from '../../../state/actionTypes';
import type {BuildingHistoryJournalV1} from '../../worldforge/interior/blueprintTypes';
const f=vi.hoisted(()=>({plan:null as unknown as TownPlan,cell:4337,local:true,span:1000}));
vi.mock('../../worldforge/bridge/legacySubmapBridge',()=>({getBridgeAtlas:()=>({pack:{burgs:{675:{i:675,name:'Menaikon',cell:f.cell}}}})}));
vi.mock('../../worldforge/town/canonicalTown',()=>({canonicalArtifactTownForSiteFromAtlas:()=>({plan:f.plan}),townSpanFtForBurg:()=>f.span}));
vi.mock('../../worldforge/townsim/chronicleForLocation',async original=>({...await original<object>(),burgIdForLocation:()=>f.local?675:undefined}));
const topic='household_public_history';
const plot=(id:number,x:number,y:number)=>({id,role:'civic',footprint:[[x-5,y-5],[x+5,y-5],[x+5,y+5],[x-5,y+5]],pop:{buildingType:'library',residential:false}});
beforeEach(()=>{Object.assign(f,{cell:4337,local:true,span:1000,plan:{plots:[plot(30,300,-300)]}});});
function make(){
 const npc={id:'faelan',name:'Faelan Ironsmith',role:'civilian',worldforgeHousehold:{burgId:675,memberId:'b54:spouse'}} as unknown as RichNPC;
 // The mocked public directory is a known current-layout source. Historical
 // admission is covered separately; omitted metadata must not authorize it.
 const state=createMockGameState({worldSeed:77,gameTime:new Date('0351-01-06T09:00:00Z'),currentLocationId:'cell_4337',playerCell:{cellId:4337},generatedNpcs:{faelan:npc},npcMemory:{faelan:createEmptyMemory()},townSim:{675:{burgId:675,layoutRevision:2,villagers:{141:{occupantId:141,name:npc.name,householdMemberId:'b54:spouse',homePlotId:54,bornDay:-31388,role:'priest'}},buildingEvents:{}}},activeDialogueSession:{npcId:'faelan',discussedTopicIds:[]}} as unknown as Partial<GameState>);
 return {state,npc};
}
const choose=(state:GameState,npc:RichNPC)=>processTopicSelection(topic,state,{npcId:npc.id,discussedTopicIds:[]},0,npc);
const offered=(state:GameState,npc:RichNPC)=>getAvailableTopics(state,npc.id,{npcId:npc.id,discussedTopicIds:[]},npc).some(t=>t.id===topic);
describe('priest public-history referral',()=>{
 it('does not add a referral or heard memory from an unresolved saved directory',()=>{
  const {state,npc}=make();delete state.townSim[675].layoutRevision;
  const before=JSON.stringify(state);
  expect(offered(state,npc)).toBe(false);
  expect(()=>choose(state,npc)).toThrow('This personal subject is no longer available.');
  expect(JSON.stringify(state)).toBe(before);
 });
 it('offers a factual ordinary topic to the existing public library, without a dedication prerequisite',()=>{
  const {state,npc}=make(),before=JSON.stringify(state);expect(offered(state,npc)).toBe(true);
  expect(getAvailableTopics(state,npc.id,{npcId:npc.id,discussedTopicIds:[]},npc)[0].id).toBe(topic);
  const answer=choose(state,npc).directReply!;expect(answer.text).toContain('northeastern part of Menaikon');expect(answer.text).toContain('Ask the librarian about the town chronicle');
  expect(answer.text).not.toMatch(/open now|safe|Senna|Pelor|quest|bless|heal/i);expect(answer.dialogue?.source.kind).toBe('institution-statement');expect(JSON.stringify(state)).toBe(before);
 });
 it('preserves one exact spoken record and recalls it after a saved-state round trip',()=>{
  const {state,npc}=make(),reply=choose(state,npc).directReply!;state.activeDialogueSession!.discussedTopicIds=[topic];
  const action:AppAction={type:'SET_LAST_NPC_INTERACTION',payload:{npcId:npc.id,response:reply.text,dialogue:reply.dialogue}};
  const heard={...state,...worldReducer(state,action)},again={...heard,...worldReducer(heard,action)};
  expect(again.npcMemory.faelan.interactions).toHaveLength(1);expect(again.npcMemory.faelan.knownFacts).toEqual(state.npcMemory.faelan.knownFacts);
  const saved=JSON.parse(JSON.stringify(again));saved.gameTime=new Date(saved.gameTime);
  expect(processTopicSelection('conversation_recall',saved,{npcId:npc.id,discussedTopicIds:[]},0,npc).directReply?.text).toBe('Last time, I told you: “'+reply.text+'”');
 });
 it.each(['absent','private','wrong-type','duplicate','bad-polygon','bad-span','abandoned','ruined','foreign-cell','foreign-town','wrong-office','dead','unborn','refusal'])('offers no invented referral for %s',kind=>{
  const {state,npc}=make(),p=f.plan.plots[0];
  if(kind==='absent')f.plan.plots=[];
  if(kind==='private')p.pop!.residential=true;
  if(kind==='wrong-type')p.pop!.buildingType='school';
  if(kind==='duplicate')f.plan.plots.push({...p});
  if(kind==='bad-polygon')p.footprint=[[NaN,0],[0,1],[1,0]];
  if(kind==='bad-span')f.span=NaN;
  if(kind==='abandoned')state.townSim[675].buildingEvents![30]=[{kind:'abandonment',day:5}];
  if(kind==='ruined')state.townSim[675].buildingEvents![30]=[{kind:'ruin',day:5}];
  if(kind==='foreign-cell')f.cell=123;
  if(kind==='foreign-town')f.local=false;
  if(kind==='wrong-office')state.townSim[675].villagers[141].role=undefined;
  if(kind==='dead')state.townSim[675].villagers[141].diedDay=6;
  if(kind==='unborn')state.townSim[675].villagers[141].bornDay=7;
  if(kind==='refusal')npc.knowledgeProfile={baseOpenness:0,topicOverrides:{[topic]:{known:true,willingnessModifier:-10}}};
  expect(offered(state,npc)).toBe(false);
 });
 it('keeps a direction refusal authoritative for this more specific direction question',()=>{
  const {state,npc}=make();npc.knowledgeProfile={baseOpenness:0,topicOverrides:{global_directions:{known:true,willingnessModifier:-10}}};expect(offered(state,npc)).toBe(false);
 });
 it('revalidates a selected referral when the library becomes ruined before publication',()=>{
  const {state,npc}=make(),reply=choose(state,npc).directReply!;state.activeDialogueSession!.discussedTopicIds=[topic];
  state.townSim[675].buildingEvents![30]=[{kind:'ruin',day:6}];
  expect(worldReducer(state,{type:'SET_LAST_NPC_INTERACTION',payload:{npcId:npc.id,response:reply.text,dialogue:reply.dialogue}})).toEqual({});
 });
 it('does not let a future reoccupation reopen a ruined library',()=>{
  const {state,npc}=make();state.townSim[675].buildingEvents![30]=[{kind:'ruin',day:5},{kind:'reoccupation',day:7}];expect(offered(state,npc)).toBe(false);
 });
 it('accepts a repaired library without changing the original building events',()=>{
  const {state,npc}=make();state.townSim[675].buildingEvents![30]=[{kind:'ruin',day:4},{kind:'renovation',day:5}];const before=JSON.stringify(state.townSim);expect(offered(state,npc)).toBe(true);expect(JSON.stringify(state.townSim)).toBe(before);
 });
 it('honors folded ruin and only reopens after a current, rather than future, reoccupation',()=>{
  const {state,npc}=make();
  // DEBT: only use-state fields are needed to exercise the existing journal adapter.
  const journal={version:1,snapshot:{throughDay:5,history:{status:'ruined'},useStateSinceDay:5},events:[{kind:'reoccupation',day:7}]} as unknown as BuildingHistoryJournalV1;
  state.townSim[675].buildingEvents![30]=journal;
  expect(offered(state,npc)).toBe(false);
  journal.events[0].day=6;expect(offered(state,npc)).toBe(true);
 });
 it('does not use a folded snapshot from the future to describe the present library',()=>{
  const {state,npc}=make();state.townSim[675].buildingEvents![30]={version:1,snapshot:{throughDay:7,history:{status:'occupied'}},events:[]} as never;
  expect(offered(state,npc)).toBe(false);
 });
 it('retains an actually heard referral in the existing attributed directions Logbook, without a visited-place award',()=>{
  const {state,npc}=make(),answer=choose(state,npc),dispatch=vi.fn();
  const {result}=renderHook(()=>useDialogueSystem(state,dispatch));act(()=>result.current.handleTopicOutcome(answer,topic));
  const entry=dispatch.mock.calls.find(([action])=>action.type==='ADD_DISCOVERY_ENTRY')?.[0].payload;
  expect(entry.content).toBe(npc.name+' told you: "'+answer.directReply!.text+'"');
  expect(entry.source).toEqual({type:'NPC',id:npc.id,name:npc.name});
  expect(entry.flags).toEqual([{key:'knowledgeKind',value:'local-directions',label:'Travel directions'}]);
  expect(dispatch.mock.calls.map(([action])=>action.type)).not.toContain('ADD_WORLD_FACT');
  expect(entry.gameTime).toBe('0351-01-06T09:00:00.000Z');
 });
 it('records no effects when a stale referral points at a newly private building',()=>{
  const {state,npc}=make(),answer=choose(state,npc),dispatch=vi.fn();f.plan.plots[0].pop!.residential=true;
  const {result}=renderHook(()=>useDialogueSystem(state,dispatch));
  expect(()=>result.current.handleTopicOutcome(answer,topic)).toThrow('no longer available');expect(dispatch).not.toHaveBeenCalled();
 });
});
