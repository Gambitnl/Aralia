/** A physically read dedication and an actual career event can become a
 * conversation, without inventing belief, powers, family or a quest. */
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {getAvailableTopics,processTopicSelection} from '../../../services/dialogueService';
import {worldReducer} from '../../../state/reducers/worldReducer';
import {createMockGameState} from '../../../utils/core/factories';
import {createEmptyMemory} from '../../../utils/world/memoryUtils';
import {resolveWorldforgeTempleIdentity,templeDedicationReading} from '../../religion/worldforgeTemple';
import type {GameState,RichNPC} from '../../../types';
import type {TownPlan} from '../../worldforge/artifacts';
import type {AppAction} from '../../../state/actionTypes';
import {npcDialogueSpeakerKey} from '../npcDialogueMemory';

// DEBT: The atlas fixture deliberately permits missing/corrupt boundary fields.
// Production statements must reject them rather than repair world records.
const f=vi.hoisted(()=>({atlas:null as any,plan:null as unknown as TownPlan,burg:675,revisions:[] as unknown[]}));
vi.mock('../../worldforge/bridge/legacySubmapBridge',()=>({getBridgeAtlas:()=>f.atlas}));
vi.mock('../../worldforge/town/canonicalTown',()=>({canonicalArtifactTownForSiteFromAtlas:(_atlas:unknown,_seed:number,_site:unknown,revision?:unknown)=>(f.revisions.push(revision),{plan:f.plan})}));
vi.mock('../../worldforge/townsim/chronicleForLocation',async original=>({...await original<object>(),burgIdForLocation:()=>f.burg}));

beforeEach(()=>{
 f.revisions=[];
 const religion=new Uint16Array(4338);religion[4337]=9;
 f.atlas={pack:{burgs:[],cells:{religion},religions:[]}};
 f.atlas.pack.burgs[675]={i:675,name:'Menaikon',cell:4337};
 f.atlas.pack.religions[9]={i:9,name:'Elladan Pantheon',type:'Folk',form:'Polytheism',deity:'Nauclea, The Blue Eagle'};
 const plot=(id:number,role:string,x:number)=>({id,role,footprint:[[x,0],[x+10,0],[x+10,10],[x,10]]});
 f.plan={plots:[plot(168,'temple',0),plot(169,'temple',1000),plot(1,'house',0),plot(2,'house',0),plot(3,'house',0)]} as unknown as TownPlan;
 f.burg=675;
});
function make(){
 const npc={id:'faelan',name:'Faelan Ironsmith',role:'civilian',occupation:'keeps the household',worldforgeHousehold:{burgId:675,memberId:'b54:spouse'}} as unknown as RichNPC;
 const life={burgId:675,layoutRevision:2,villagers:{141:{occupantId:141,name:npc.name,householdMemberId:'b54:spouse',homePlotId:54,bornDay:-31388,role:'priest'},288:{occupantId:288,name:'Senna Ironstead',homePlotId:112,bornDay:-22628,diedDay:-372}},chronicle:{burgId:675,nextEventId:205,events:[{id:204,day:-372,kind:'role_succession',subjectId:141,relatedIds:[288],summary:'Faelan Ironsmith succeeded Senna Ironstead as priest.'}]}};
 const state=createMockGameState({worldSeed:77,gameTime:new Date('0351-01-06T09:00:00Z'),currentLocationId:'cell_4337',playerCell:{cellId:4337},generatedNpcs:{faelan:npc},npcMemory:{faelan:createEmptyMemory()},townSim:{675:life},activeDialogueSession:{npcId:npc.id,discussedTopicIds:[]}} as unknown as Partial<GameState>);
 const identity=resolveWorldforgeTempleIdentity(77,675,168,6,state.townSim[675])!;
 const reading=templeDedicationReading(identity,'0351-01-05T23:59:59Z')!.entry;
 state.discoveryLog=[{...reading,timestamp:1,isRead:true}];
 return {state,npc};
}
const topics=(s:GameState,n:RichNPC)=>getAvailableTopics(s,n.id,{npcId:n.id,discussedTopicIds:[]},n).map(t=>t.id);
const choose=(s:GameState,n:RichNPC,id:string)=>processTopicSelection(id,s,{npcId:n.id,discussedTopicIds:[]},0,n);
function publication(state:GameState,npc:RichNPC,id='household_temple'):AppAction {
 const reply=choose(state,npc,id).directReply!;
 return {type:'SET_LAST_NPC_INTERACTION',payload:{npcId:npc.id,response:reply.text,dialogue:reply.dialogue}};
}

describe('a reached priest discusses the actual temple and career',()=>{
 it('offers the earned dedication and the recorded succession as ordinary topics',()=>{
  const {state,npc}=make();expect(topics(state,npc).slice(0,2)).toEqual(['household_temple','household_office_history']);
 });
 it('answers with the actual pantheon/deity and office, without substituting a catalog god or granting a service',()=>{
  const {state,npc}=make(),before=JSON.stringify(state),result=choose(state,npc,'household_temple');
  expect(result.directReply?.text).toContain('Elladan Pantheon');expect(result.directReply?.text).toContain('Nauclea, The Blue Eagle');expect(result.directReply?.text).toContain('priest');
  expect(result.directReply?.text).not.toMatch(/Pelor|Bahamut|healing|blessing|quest/i);expect(result.unlocks).toEqual([]);expect(JSON.stringify(state)).toBe(before);
 });
 it('gives a dated personal career chapter from the subject/related life records',()=>{
  const {state,npc}=make(),result=choose(state,npc,'household_office_history');
  expect(result.directReply?.text).toContain('Senna Ironstead');expect(result.directReply?.text).toContain('378 days ago');
  expect(result.directReply?.text).not.toMatch(/father|mother|spouse|under.?city|growing|Howling|quest/i);
 });
 it('lets the general recall question remember a factual exchange too',()=>{
  const {state,npc}=make(),result=choose(state,npc,'global_who_are_you');
  state.activeDialogueSession!.discussedTopicIds=['global_who_are_you'];
  const next={...state,...worldReducer(state,{type:'SET_LAST_NPC_INTERACTION',payload:{npcId:npc.id,response:result.directReply!.text,dialogue:result.directReply!.dialogue}})};
  expect(topics(next,npc)).toContain('conversation_recall');expect(choose(next,npc,'conversation_recall').directReply?.text).toContain(result.directReply!.text);
 });
 it.each(['no-reading','other-world','other-building','future-reading','changed-words','changed-faith'])('withholds an unearned or unresolved dedication: %s',kind=>{
  const {state,npc}=make(),entry=state.discoveryLog[0];
  if(kind==='no-reading')state.discoveryLog=[];
  if(kind==='other-world')state.worldSeed=78;
  if(kind==='other-building')entry.source!.id='world:77:cell:4337:building:wf-plot-675-169';
  if(kind==='future-reading')entry.gameTime='0351-01-07T09:00:00Z';
  if(kind==='changed-words')entry.content='The temple promises a free miracle.';
  if(kind==='changed-faith')f.atlas.pack.religions[9].name='Changed tradition';
  expect(topics(state,npc)).not.toContain('household_temple');
 });
 it('preserves the old clergy listing as a historical reading after succession',()=>{
  const {state,npc}=make(),identity=resolveWorldforgeTempleIdentity(77,675,168,6,state.townSim[675])!;
  const when=new Date(Number(state.gameTime)-400*86400000);
  const reading=templeDedicationReading({...identity,clergy:{occupantId:288,name:'Senna Ironstead'}},when)!.entry;
  state.discoveryLog=[{...reading,timestamp:1,isRead:true}];const old=JSON.stringify(state.discoveryLog);
  expect(choose(state,npc,'household_temple').directReply?.text).toContain('I serve as the priest');
  expect(JSON.stringify(state.discoveryLog)).toBe(old);expect(state.discoveryLog[0].content).toContain('lists Senna Ironstead');
 });
 it('records exact words and provenance once, and recall does not create another conversation',()=>{
  const {state,npc}=make(),action=publication(state,npc);
  state.activeDialogueSession!.discussedTopicIds=['household_temple'];
  const first={...state,...worldReducer(state,action)},later={...first,gameTime:new Date(Number(state.gameTime)+30000)};
  const repeated={...later,...worldReducer(later,action)};
  expect(first.npcMemory.faelan.interactions).toHaveLength(1);
  expect(first.npcMemory.faelan.interactions![0].dialogue?.source.kind).toBe('institution-statement');
  expect(repeated.npcMemory.faelan.interactions).toBe(first.npcMemory.faelan.interactions);
  expect(first.npcMemory.faelan.knownFacts).toBe(state.npcMemory.faelan.knownFacts);
  expect(choose(repeated,npc,'conversation_recall').directReply?.text).toContain(first.npcMemory.faelan.interactions![0].summary);
  expect(repeated.npcMemory.faelan.interactions).toHaveLength(1);
 });
 it.each(['faith-change','reading-lost','ended','other-speaker','undiscussed','role-change','new-life','event-change','predecessor-change','changed-answer'])('rejects stale %s publication before changing display or history',kind=>{
  const {state,npc}=make(),topic=kind==='event-change'||kind==='predecessor-change'?'household_office_history':'household_temple';
  const action=publication(state,npc,topic);state.activeDialogueSession!.discussedTopicIds=[topic];
  if(kind==='faith-change')f.atlas.pack.religions[9].name='Other faith';
  if(kind==='reading-lost')state.discoveryLog=[];
  if(kind==='ended')state.activeDialogueSession=null;
  if(kind==='other-speaker')state.activeDialogueSession!.npcId='other';
  if(kind==='undiscussed')state.activeDialogueSession!.discussedTopicIds=[];
  if(kind==='role-change')state.townSim[675].villagers[141].role=undefined;
  if(kind==='new-life')state.townSim[675].villagers[141].bornDay-=365;
  if(kind==='event-change')state.townSim[675].chronicle.events[0].day-=1;
  if(kind==='predecessor-change')state.townSim[675].villagers[288].name='Someone else';
  if(kind==='changed-answer'&&action.type==='SET_LAST_NPC_INTERACTION')action.payload.response='A free miracle is yours.';
  expect(worldReducer(state,action)).toEqual({});
 });
 it.each(['future','wrong-subject','duplicate-id','missing-predecessor','wrong-death','wrong-office'])('does not manufacture a career from an unresolved event: %s',kind=>{
  const {state,npc}=make(),town=state.townSim[675],event=town.chronicle.events[0];
  if(kind==='future')event.day=7;
  if(kind==='wrong-subject')event.subjectId=288;
  if(kind==='duplicate-id')town.chronicle.events.push({...event,subjectId:288});
  if(kind==='missing-predecessor')delete town.villagers[288];
  if(kind==='wrong-death')town.villagers[288].diedDay=-373;
  if(kind==='wrong-office')event.summary='Faelan Ironsmith succeeded Senna Ironstead as lord.';
  expect(topics(state,npc)).not.toContain('household_office_history');
 });
 it('recalls the latest factual answer ahead of an older generated exchange',()=>{
  const {state,npc}=make();state.gameTime=new Date(Number(state.gameTime)-10000);
  const earlier={...state,...worldReducer(state,{type:'SET_LAST_NPC_INTERACTION',payload:{npcId:npc.id,response:'An older uncertain account.',dialogue:{topicId:'generated_exchange',speakerKey:npcDialogueSpeakerKey(state,npc.id)!,source:{kind:'generated-exchange',requestId:'earlier',playerPrompt:'An earlier question'}}}})};
  const current={...earlier,gameTime:new Date(Number(earlier.gameTime)+10000)};
  const action=publication(current,npc,'household_office_history');current.activeDialogueSession!.discussedTopicIds=['household_office_history'];
  const after={...current,...worldReducer(current,action)},recall=choose(after,npc,'conversation_recall').directReply!.text;
  expect(recall).toContain('378 days ago');expect(recall).not.toContain('older uncertain account');expect(after.npcMemory.faelan.interactions).toHaveLength(2);
 });
 it('remembers the most recently heard answer when an older statement is repeated without changing its first date',()=>{
  const {state,npc}=make();state.activeDialogueSession!.discussedTopicIds=['household_temple','household_office_history'];
  const temple=publication(state,npc),first={...state,...worldReducer(state,temple)};
  const later={...first,gameTime:new Date(Number(first.gameTime)+10000)};
  const career=publication(later,npc,'household_office_history'),second={...later,...worldReducer(later,career)};
  const original=JSON.stringify(second.npcMemory.faelan.interactions);
  const repeated={...second,gameTime:new Date(Number(second.gameTime)+10000)};
  const last={...repeated,...worldReducer(repeated,temple)};
  expect(choose(last,npc,'conversation_recall').directReply?.text).toContain('Elladan Pantheon');
  expect(JSON.stringify(last.npcMemory.faelan.interactions)).toBe(original);
 });
 it('does not bypass a new authored refusal by quoting a previous public answer',()=>{
  const {state,npc}=make(),action=publication(state,npc);state.activeDialogueSession!.discussedTopicIds=['household_temple'];
  const after={...state,...worldReducer(state,action)},history=after.npcMemory.faelan.interactions;
  const guarded={...npc,knowledgeProfile:{baseOpenness:40,topicOverrides:{household_temple:{known:false}}}};
  after.generatedNpcs.faelan=guarded;
  expect(topics(after,guarded)).not.toContain('conversation_recall');expect(after.npcMemory.faelan.interactions).toBe(history);
 });
 it('does not let an old saved delivery reference override a newer recorded conversation',()=>{
  const {state,npc}=make();state.activeDialogueSession!.discussedTopicIds=['household_temple','household_office_history'];
  const first={...state,...worldReducer(state,publication(state,npc))};
  const later={...first,gameTime:new Date(Number(state.gameTime)+10000)};
  const after={...later,...worldReducer(later,publication(later,npc,'household_office_history'))};
  after.npcMemory.faelan.lastSpokenDialogue=first.npcMemory.faelan.lastSpokenDialogue;
  expect(choose(after,npc,'conversation_recall').directReply?.text).toContain('378 days ago');
 });
});

describe('saved institutional statement source',()=>{
 it('corroborates the dedication through the selected earlier layout',()=>{
  const {state,npc}=make();state.townSim[675].layoutRevision=1;f.revisions=[];
  const reply=choose(state,npc,'household_temple');expect(reply.directReply?.text).toContain('Elladan Pantheon');
  expect(f.revisions.length).toBeGreaterThan(0);expect(f.revisions.every(revision=>revision===1)).toBe(true);
 });
 it('keeps career history but withholds spatial claims for an unresolved town',()=>{
  const {state,npc}=make();delete state.townSim[675].layoutRevision;f.revisions=[];
  const before=JSON.stringify(state),available=topics(state,npc);
  expect(available).toContain('household_office_history');expect(available).not.toContain('household_temple');
  expect(available).not.toContain('household_public_history');expect(f.revisions).toEqual([]);
  expect(JSON.stringify(state)).toBe(before);
 });
});
