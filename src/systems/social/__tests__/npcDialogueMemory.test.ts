/** A resident can recall words actually delivered to this player, across later world changes. */
import {describe,it,expect} from 'vitest';
import {npcDialogueSpeakerKey,latestSpokenGeneratedReplies,generatedDialogueSpeakerKey} from '../npcDialogueMemory';
import {worldReducer} from '../../../state/reducers/worldReducer';
import {createMockGameState} from '../../../utils/core/factories';
import {createEmptyMemory} from '../../../utils/world/memoryUtils';
import {getGameDay} from '../../../utils/core';
import {migrateNpcMemoryRecord} from '../../../state/migrations/npcMemoryMigration';
import {getAvailableTopics,processTopicSelection,buildNpcDialoguePromptContext} from '../../../services/dialogueService';
import type {GameState,RichNPC} from '../../../types';
import type {AppAction} from '../../../state/actionTypes';
// Open dialogue must remember heard wording without turning it into a fact.
describe('generated conversation publication',()=>{
 const generatedAction=(state:GameState,requestId='heard-1'):AppAction=>({type:'SET_LAST_NPC_INTERACTION',payload:{npcId:'fenna',response:'I cannot confirm the growth story.',dialogue:{topicId:'generated_exchange',speakerKey:generatedDialogueSpeakerKey(state,'fenna')!,source:{kind:'generated-exchange',requestId,playerPrompt:'What do you know about this account?'}}}});
 it('retains the exact generated answer in the same speaker history, separately from known facts',()=>{
  const {state}=make();
  const action={type:'SET_LAST_NPC_INTERACTION',payload:{npcId:'fenna',response:'I cannot confirm the growth story.',dialogue:{topicId:'generated_exchange',speakerKey:npcDialogueSpeakerKey(state,'fenna'),source:{kind:'generated-exchange',requestId:'heard-1',playerPrompt:'What do you know about this account?'}}}} as unknown as AppAction;
  const next={...state,...worldReducer(state,action)};
  expect(next.npcMemory.fenna.interactions).toHaveLength(1);
  expect(next.npcMemory.fenna.interactions![0].summary).toBe('I cannot confirm the growth story.');
  expect(next.npcMemory.fenna.knownFacts).toBe(state.npcMemory.fenna.knownFacts);
  const repeated={...next,...worldReducer(next,action)};
  expect(repeated.npcMemory.fenna.interactions).toBe(next.npcMemory.fenna.interactions);
 });
 it.each(['ended','other-speaker','other-world','replacement-life','malformed'])('rejects %s publication without changing facts or display',kind=>{
  const {state}=make(),action=generatedAction(state);
  if(kind==='ended')state.activeDialogueSession=null;
  if(kind==='other-speaker')state.activeDialogueSession!.npcId='other';
  if(kind==='other-world')state.worldSeed+=1;
  if(kind==='replacement-life')state.townSim[675].villagers[84].bornDay-=365;
  if(kind==='malformed'&&action.type==='SET_LAST_NPC_INTERACTION'&&action.payload.dialogue?.source.kind==='generated-exchange')action.payload.dialogue.source.requestId='';
  expect(worldReducer(state,action)).toEqual({});
 });
 it('recalls exact heard words after migration, without publishing another interaction',()=>{
  const {state,npc}=make(),next={...state,...worldReducer(state,generatedAction(state))};
  next.npcMemory=migrateNpcMemoryRecord(JSON.parse(JSON.stringify(next.npcMemory)));
  expect(getAvailableTopics(next,'fenna',{npcId:'fenna',discussedTopicIds:[]},npc).some(t=>t.id==='conversation_recall')).toBe(true);
  const answer=processTopicSelection('conversation_recall',next,{npcId:'fenna',discussedTopicIds:[]},0,npc).directReply!;
  expect(answer.text).toBe('Last time, I told you: “I cannot confirm the growth story.”');expect(answer.dialogue).toBeUndefined();
  expect(next.npcMemory.fenna.interactions).toHaveLength(1);
 });
 it('supplies only recent same-life speech to later model context and never backfills provider logs',()=>{
  const {state}=make();let next=state;
  for(let i=0;i<5;i++)next={...next,gameTime:new Date(Number(next.gameTime)+1000),...worldReducer({...next,gameTime:new Date(Number(next.gameTime)+1000)},generatedAction(next,'heard-'+i))};
  expect(latestSpokenGeneratedReplies(next,'fenna')).toHaveLength(3);
  expect(latestSpokenGeneratedReplies(next,'fenna',0)).toEqual([]);
  const before=next.npcMemory.fenna.interactions;
  const wrongWorld={...next,worldSeed:next.worldSeed+1};expect(latestSpokenGeneratedReplies(wrongWorld,'fenna')).toEqual([]);
  expect(next.npcMemory.fenna.interactions).toBe(before);
  expect(latestSpokenGeneratedReplies(state,'fenna')).toEqual([]);
  const context=buildNpcDialoguePromptContext(next,'fenna',next.generatedNpcs.fenna);
  expect(context).toContain('Your recorded conversations:');expect(context).toContain('I cannot confirm the growth story.');
  expect(context).toContain('not independent evidence');
  const originalContext=buildNpcDialoguePromptContext(state,'fenna',state.generatedNpcs.fenna);
  expect(originalContext).not.toContain('Your recorded conversations:');
 });
 it('does not authenticate malformed, future or provider-only history',()=>{
  const {state}=make(),published={...state,...worldReducer(state,generatedAction(state))};
  published.npcMemory.fenna.interactions![0].date=Number(state.gameTime)+1;
  expect(latestSpokenGeneratedReplies(published,'fenna')).toEqual([]);
  const corrupt={...state,npcMemory:{fenna:{...state.npcMemory.fenna,interactions:{old:'unusable'}}}} as unknown as GameState;
  expect(latestSpokenGeneratedReplies(corrupt,'fenna')).toEqual([]);
 });
});
const line="I run The Provisions. The latest day's takings covered costs, with something left over.";
const make=()=>{const npc={id:'fenna',name:'Fenna Hartham',role:'merchant',occupation:'shopkeeper',worldforgeHousehold:{memberId:'b34:head',burgId:675,legacyNameUnique:true},biography:{family:[]}} as unknown as RichNPC;const state=createMockGameState({generatedNpcs:{fenna:npc},gameTime:new Date('0351-01-04T11:44:14Z'),activeDialogueSession:{npcId:'fenna',discussedTopicIds:['household_work']},npcMemory:{fenna:{...createEmptyMemory(),knownFacts:[{id:'original',text:'Met Sana.',source:'direct',isPublic:true,timestamp:1,strength:3,lifespan:999,factKey:'player_met_npc'}]}},townSim:{675:{villagers:{84:{occupantId:84,householdMemberId:'b34:head',name:'Fenna Hartham',homePlotId:34,bornDay:-20000}}}} as unknown as GameState['townSim'],worldBusinesses:{shop:{id:'shop',ownerId:'fenna',ownerType:'npc',name:'The Provisions',businessType:'general_store',lastDailyReport:{day:4,revenue:14.8,costs:12,profit:2.8,supplyIssues:[],staffIssues:[],competitorActions:[]}}} as unknown as GameState['worldBusinesses']});state.worldBusinesses.shop.lastDailyReport.day=getGameDay(state.gameTime);return{state,npc};};
const action=(s:GameState)=>({type:'SET_LAST_NPC_INTERACTION',payload:{npcId:'fenna',response:line,dialogue:{topicId:'household_work',speakerKey:npcDialogueSpeakerKey(s,'fenna')!,source:{kind:'business-report',businessId:'shop',...s.worldBusinesses.shop.lastDailyReport}}}} as unknown as AppAction);
const publish=(s:GameState)=>({...s,...worldReducer(s,action(s))});
describe('spoken NPC work memory',()=>{
 it('records delivered words with source, person and original date in existing interactions',()=>{const {state}=make();const next=publish(state);const m=next.npcMemory.fenna.interactions!;expect(m).toHaveLength(1);expect(m[0].type).toBe('dialogue');expect(m[0].summary).toBe(line);expect(m[0].date).toBe(state.gameTime.getTime());expect(m[0].dialogue?.topicId).toBe('household_work');expect((m[0].dialogue?.source.kind==='business-report'?m[0].dialogue.source.businessId:undefined)).toBe('shop');expect(m[0].dialogue?.speakerKey).toBeTruthy();expect(next.npcMemory.fenna.knownFacts).toBe(state.npcMemory.fenna.knownFacts);});
 it('does not synthesize history from a previous global display line or current books',()=>{const {state,npc}=make();state.lastInteractedNpcId='fenna';state.lastNpcResponse=line;expect(getAvailableTopics(state,'fenna',state.activeDialogueSession!,npc).some(t=>t.id==='household_work_recall')).toBe(false);expect(()=>processTopicSelection('household_work_recall',state,state.activeDialogueSession!,0,npc)).toThrow();});
 it('publishes one immutable memory for an identical delivered source and wording',()=>{const {state}=make();const first=publish(state);const later={...first,gameTime:new Date(first.gameTime.getTime()+10000)};const repeated=publish(later);expect(repeated.npcMemory.fenna.interactions).toBe(first.npcMemory.fenna.interactions);expect(repeated.npcMemory.fenna.interactions![0].date).toBe(state.gameTime.getTime());});
 it('recalls the delivered statement after finances change and memory passes the native migration shape',()=>{const {state,npc}=make();const first=publish(state);const saved=JSON.parse(JSON.stringify(first));const later={...first,gameTime:new Date(first.gameTime.getTime()+86400000),npcMemory:migrateNpcMemoryRecord(saved.npcMemory),worldBusinesses:{shop:{...first.worldBusinesses.shop,lastDailyReport:{...first.worldBusinesses.shop.lastDailyReport,day:5,revenue:10,costs:12,profit:-2}}}};const result=processTopicSelection('household_work_recall',later,{npcId:'fenna',discussedTopicIds:[]},0,npc);expect(result.directReply?.text).toContain(line);expect(result.directReply?.text).toContain('Yesterday');expect(result.directReply?.text).not.toContain("didn't cover");expect(later.npcMemory.fenna.interactions).toHaveLength(1);});
 it('does not attach a former speaker conversation to a replacement life record',()=>{const {state,npc}=make();const next=publish(state);next.townSim[675].villagers[84]={...next.townSim[675].villagers[84],occupantId:91,bornDay:0};expect(()=>processTopicSelection('household_work_recall',next,{npcId:'fenna',discussedTopicIds:[]},0,npc)).toThrow();});
 it('does not claim old speech when the projected keeper name no longer matches the life person',()=>{const {state,npc}=make();const next=publish(state);next.generatedNpcs.fenna={...npc,name:'A new keeper'};expect(()=>processTopicSelection('household_work_recall',next,{npcId:'fenna',discussedTopicIds:[]},0,next.generatedNpcs.fenna)).toThrow();});
 it('does not borrow another NPC conversation',()=>{const {state,npc}=make();const next=publish(state);next.npcMemory={other:next.npcMemory.fenna,fenna:createEmptyMemory()};expect(()=>processTopicSelection('household_work_recall',next,{npcId:'fenna',discussedTopicIds:[]},0,npc)).toThrow();});
 it.each(['ended','different-speaker','changed-report','changed-owner','changed-concerns'])('rejects %s publication before writing display or memory',kind=>{const {state}=make();const a=action(state);if(kind==='ended')state.activeDialogueSession=null;if(kind==='different-speaker')state.activeDialogueSession!.npcId='other';if(kind==='changed-report')state.worldBusinesses.shop.lastDailyReport.revenue=99;if(kind==='changed-owner')state.worldBusinesses.shop.ownerId='other';if(kind==='changed-concerns')state.worldBusinesses.shop.lastDailyReport.supplyIssues=['New delivery problem.'];expect(worldReducer(state,a)).toEqual({});});
 it('rejects a publication copied across worlds',()=>{const {state}=make();const a=action(state);state.worldSeed+=1;expect(worldReducer(state,a)).toEqual({});});
 it('ignores a malformed legacy history entry instead of authenticating it',()=>{const {state,npc}=make();state.npcMemory.fenna.interactions=[{id:'bad',type:'dialogue',date:state.gameTime.getTime(),summary:'Invented yesterday.',dialogue:{topicId:'household_work',speakerKey:npcDialogueSpeakerKey(state,'fenna')}}] as never;expect(()=>processTopicSelection('household_work_recall',state,{npcId:'fenna',discussedTopicIds:[]},0,npc)).toThrow();expect(publish(state).npcMemory.fenna.interactions).toHaveLength(2);});
 it('does not overwrite the first statement or its date when a later report is spoken',()=>{const {state}=make();const first=publish(state);const original=JSON.stringify(first.npcMemory.fenna.interactions![0]);const later={...first,gameTime:new Date(first.gameTime.getTime()+86400000),worldBusinesses:{shop:{...first.worldBusinesses.shop,lastDailyReport:{...first.worldBusinesses.shop.lastDailyReport,day:5,revenue:10,costs:12,profit:-2}}}};const a=action(later);if(a.type==='SET_LAST_NPC_INTERACTION')a.payload.response='My latest takings did not cover costs.';const next={...later,...worldReducer(later,a)};expect(next.npcMemory.fenna.interactions).toHaveLength(2);expect(JSON.stringify(next.npcMemory.fenna.interactions![0])).toBe(original);});
 it('keeps the original reported concerns independent of later account mutations',()=>{const {state}=make();state.worldBusinesses.shop.lastDailyReport.supplyIssues=['Original delivery issue.'];const next=publish(state);state.worldBusinesses.shop.lastDailyReport.supplyIssues.push('Later issue.');expect((next.npcMemory.fenna.interactions![0].dialogue?.source as {supplyIssues?:string[]})?.supplyIssues).toEqual(['Original delivery issue.']);});
 it('keeps old display-only callers on their existing path without inventing a conversation record',()=>{const {state}=make();expect(worldReducer(state,{type:'SET_LAST_NPC_INTERACTION',payload:{npcId:'fenna',response:line}})).toEqual({lastInteractedNpcId:'fenna',lastNpcResponse:line});expect(state.npcMemory.fenna.interactions).toEqual([]);});
});

const personalFixture=()=>{
 const p=make(),day=getGameDay(p.state.gameTime);
 Object.assign(p.state.townSim[675].villagers[84],{bornDay:day-45*365,parentIds:[],childIds:[],spouseId:85,role:'priest'});
 p.state.townSim[675].villagers[85]={occupantId:85,name:'Rowan Hartham',bornDay:day-44*365,homePlotId:34,parentIds:[],childIds:[],spouseId:84} as never;
 return p;
};
const personalAction=(state:GameState,npc:RichNPC,topicId='household_family'):AppAction=>{
 const result=processTopicSelection(topicId,state,{npcId:npc.id,discussedTopicIds:[]},0,npc);
 return {type:'SET_LAST_NPC_INTERACTION',payload:{npcId:npc.id,response:result.directReply!.text,dialogue:result.directReply!.dialogue}};
};
const deliverPersonal=(state:GameState,npc:RichNPC,topicId='household_family')=>{
 const a=personalAction(state,npc,topicId);
 const ready={...state,activeDialogueSession:{...state.activeDialogueSession!,npcId:npc.id,discussedTopicIds:[topicId]}};
 return {...ready,...worldReducer(ready,a)};
};
describe('delivered identity and family memory',()=>{
 it.each(['household_family','global_who_are_you'])('records exact %s words, date and admitted life without rewriting first contact',topic=>{
  const {state,npc}=personalFixture(),a=personalAction(state,npc,topic),next=deliverPersonal(state,npc,topic);
  const history=next.npcMemory.fenna.interactions!;
  expect(a.type==='SET_LAST_NPC_INTERACTION'&&a.payload.dialogue?.source.kind).toBe('household-personal');
  expect(history).toHaveLength(1);expect(history[0].summary).toBe(a.type==='SET_LAST_NPC_INTERACTION'&&a.payload.response);
  expect(history[0].date).toBe(Number(state.gameTime));expect(history[0].dialogue?.topicId).toBe(topic);
  expect(next.npcMemory.fenna.knownFacts).toBe(state.npcMemory.fenna.knownFacts);
  expect(next.townSim).toBe(state.townSim);expect(next.worldBusinesses).toBe(state.worldBusinesses);
 });
 it('retains the original date and interaction array on duplicate delivery',()=>{
  const {state,npc}=personalFixture(),first=deliverPersonal(state,npc),later={...first,gameTime:new Date(Number(state.gameTime)+10000)};
  const second=deliverPersonal(later,npc);expect(second.npcMemory.fenna.interactions).toBe(first.npcMemory.fenna.interactions);
  expect(second.npcMemory.fenna.interactions![0].date).toBe(Number(state.gameTime));
 });
 it.each(['ended','other-speaker','undiscussed','family-change','role-change','world-change','replacement-life','changed-words','guarded'])('rejects %s before changing display or history',kind=>{
  const {state,npc}=personalFixture(),topic=kind==='role-change'?'global_who_are_you':'household_family';
  state.activeDialogueSession!.discussedTopicIds=[topic]; const a=personalAction(state,npc,topic);
  if(kind==='ended')state.activeDialogueSession=null;
  if(kind==='other-speaker')state.activeDialogueSession!.npcId='other';
  if(kind==='undiscussed')state.activeDialogueSession!.discussedTopicIds=[];
  if(kind==='family-change')state.townSim[675].villagers[85].name='New name';
  if(kind==='role-change')state.townSim[675].villagers[84].role='lord';
  if(kind==='world-change')state.worldSeed+=1;
  if(kind==='replacement-life')state.townSim[675].villagers[84].bornDay-=1;
  if(kind==='changed-words'&&a.type==='SET_LAST_NPC_INTERACTION')a.payload.response='Invented story.';
  if(kind==='guarded')npc.knowledgeProfile={baseOpenness:0,topicOverrides:{[topic]:{known:true,willingnessModifier:-10}}};
  expect(worldReducer(state,a)).toEqual({});
 });
 it('recalls exact dated family words after a later death and native migration, without appending recall',()=>{
  const {state,npc}=personalFixture(),first=deliverPersonal(state,npc),original=JSON.stringify(first.npcMemory.fenna.interactions![0]);
  const saved=JSON.parse(JSON.stringify(first));saved.gameTime=new Date(Number(state.gameTime)+86400000);saved.npcMemory=migrateNpcMemoryRecord(saved.npcMemory);
  saved.townSim[675].villagers[85].diedDay=getGameDay(saved.gameTime);
  const before=JSON.stringify(saved.npcMemory),recall=processTopicSelection('household_family_recall',saved,{npcId:npc.id,discussedTopicIds:[]},0,npc).directReply!;
  expect(recall.text).toBe('Yesterday, when you asked about my family, I told you: “Rowan Hartham is my spouse.”');expect(recall.dialogue).toBeUndefined();expect(JSON.stringify(saved.npcMemory)).toBe(before);
  const next=deliverPersonal(saved,npc);expect(next.npcMemory.fenna.interactions).toHaveLength(2);
  expect(next.npcMemory.fenna.interactions![1].summary).toContain('(deceased)');expect(JSON.stringify(next.npcMemory.fenna.interactions![0])).toBe(original);
 });
 it('recalls an old introduction after office and occupation change while the new answer uses current facts',()=>{
  const {state,npc}=personalFixture(),first=deliverPersonal(state,npc,'global_who_are_you');first.townSim[675].villagers[84].role='lord';npc.occupation='retired';
  const recall=processTopicSelection('household_identity_recall',first,{npcId:npc.id,discussedTopicIds:[]},0,npc).directReply!;
  expect(recall.text).toContain("town's priest");expect(recall.text).toContain('shopkeeper');expect(recall.dialogue).toBeUndefined();
  const next=deliverPersonal(first,npc,'global_who_are_you');expect(next.npcMemory.fenna.interactions![1].summary).toContain("town's lord");expect(next.npcMemory.fenna.interactions![1].summary).toContain("I'm retired");
 });
 it.each(['other-world','other-npc','new-life','future-history','malformed'])('withholds %s recall instead of attaching an unverified conversation',kind=>{
  const {state,npc}=personalFixture(),first=deliverPersonal(state,npc);
  if(kind==='other-world')first.worldSeed+=1;
  if(kind==='other-npc'){first.npcMemory.other=first.npcMemory.fenna;first.npcMemory.fenna=createEmptyMemory();}
  if(kind==='new-life')first.townSim[675].villagers[84].bornDay-=1;
  if(kind==='future-history')first.npcMemory.fenna.interactions![0].date=Number(first.gameTime)+86400000;
  if(kind==='malformed')first.npcMemory.fenna.interactions![0].dialogue={topicId:'household_family',speakerKey:npcDialogueSpeakerKey(first,npc.id)!} as never;
  expect(getAvailableTopics(first,npc.id,{npcId:npc.id,discussedTopicIds:[]},npc).some(t=>t.id==='household_family_recall')).toBe(false);
 });
 it('does not backfill a legacy display or attach its uncertain biography to a life record',()=>{
  const {state,npc}=personalFixture();delete state.townSim[675];npc.biography!.family=[{name:'Legacy Relative',relation:'spouse',lifeStatus:'unresolved'}] as never;
  state.lastNpcResponse='Old family words';state.lastInteractedNpcId=npc.id;
  const reply=processTopicSelection('household_family',state,{npcId:npc.id,discussedTopicIds:[]},0,npc).directReply!;
  expect(reply.text).toContain('unsure');expect(reply.dialogue).toBeUndefined();
  expect(getAvailableTopics(state,npc.id,{npcId:npc.id,discussedTopicIds:[]},npc).some(t=>t.id==='household_family_recall')).toBe(false);
 });
});
