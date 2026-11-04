/** A heard direction must remain the last discussion across replay and reload.
 * These tests cover publication and stale-source refusal. Native Cora play
 * separately proves the actual delivered answer and journal deduplication. */
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createMockGameState} from '../../../utils/core/factories';
import {createEmptyMemory} from '../../../utils/world/memoryUtils';
import type {GameState,RichNPC} from '../../../types';
import {processTopicSelection} from '../../../services/dialogueService';
import {latestSpokenDialogueReplies,npcDialogueSpeakerKey,publishSpokenNpcReply} from '../npcDialogueMemory';
import {migrateNpcMemoryRecord} from '../../../state/migrations/npcMemoryMigration';

const directions=vi.hoisted(()=>({text:"You're in Oroten. The temple is near the town center." as string|undefined}));
vi.mock('../../travel/npcLocalDirections',()=>({resolveNpcLocalDirections:()=>directions.text}));
const make=()=>{
 const npc={id:'cora',name:'Cora Dunmill',role:'civilian',occupation:'journeyman',
  worldforgeHousehold:{memberId:'b14:head',burgId:740,legacyNameUnique:true},biography:{family:[]}} as unknown as RichNPC;
 const state=createMockGameState({worldSeed:123,gameTime:new Date('0351-01-07T08:44:00Z'),generatedNpcs:{cora:npc},
  activeDialogueSession:{npcId:'cora',discussedTopicIds:['global_directions']},npcMemory:{cora:createEmptyMemory()},
  townSim:{740:{villagers:{28:{occupantId:28,householdMemberId:'b14:head',name:'Cora Dunmill',homePlotId:14,bornDay:-17879}}}} as unknown as GameState['townSim']});
 return {state,npc};
};
const publication=(state:GameState)=>({topicId:'global_directions' as const,speakerKey:npcDialogueSpeakerKey(state,'cora')!,
 source:{kind:'local-directions' as const,snapshot:directions.text!}});
const deliver=(state:GameState)=>({...state,...publishSpokenNpcReply(state,'cora',directions.text!,publication(state))});
beforeEach(()=>{directions.text="You're in Oroten. The temple is near the town center."});

describe('source-bound directions in spoken history',()=>{
 it('stamps the ordinary topic result and publishes only exact delivered wording',()=>{
  const {state,npc}=make(),before=JSON.stringify(state);
  const result=processTopicSelection('global_directions',state,{npcId:'cora',discussedTopicIds:[]},0,npc);
  expect(result.directReply?.dialogue).toEqual(publication(state));
  const patch=publishSpokenNpcReply(state,'cora',result.directReply!.text,result.directReply!.dialogue!);
  expect(Object.keys(patch).sort()).toEqual(['lastInteractedNpcId','lastNpcResponse','npcMemory']);
  const next={...state,...patch};expect(next.npcMemory.cora.interactions).toHaveLength(1);
  expect(next.npcMemory.cora.knownFacts).toBe(state.npcMemory.cora.knownFacts);
  expect(next.discoveryLog).toBe(state.discoveryLog);expect(next.party).toBe(state.party);
  expect(next.playerGroundPos).toBe(state.playerGroundPos);expect(JSON.stringify(state)).toBe(before);
 });
 it('recalls the heard directions through JSON migration with no new record or discovery',()=>{
  const {state,npc}=make(),heard=deliver(state);
  heard.npcMemory=migrateNpcMemoryRecord(JSON.parse(JSON.stringify(heard.npcMemory)));
  const before=JSON.stringify(heard);
  expect(latestSpokenDialogueReplies(heard,'cora',1)[0].summary).toBe(directions.text);
  const answer=processTopicSelection('conversation_recall',heard,{npcId:'cora',discussedTopicIds:[]},0,npc).directReply!;
  expect(answer.text).toBe('Last time, I told you: “'+directions.text+'”');expect(answer.dialogue).toBeUndefined();
  expect(JSON.stringify(heard)).toBe(before);
 });
 it('repeated directions regain recency while preserving first dates and intervening speech',()=>{
  const {state}=make(),first=deliver(state),original=JSON.stringify(first.npcMemory.cora.interactions![0]);
  const later={...first,gameTime:new Date(Number(first.gameTime)+1000)};
  const second={...later,...publishSpokenNpcReply(later,'cora','An intervening answer.',{
   topicId:'generated_exchange',speakerKey:npcDialogueSpeakerKey(later,'cora')!,source:{kind:'generated-exchange',requestId:'later',playerPrompt:'Another question'}})};
  expect(latestSpokenDialogueReplies(second,'cora',1)[0].summary).toBe('An intervening answer.');
  const replay=deliver({...second,gameTime:new Date(Number(second.gameTime)+1000)});
  expect(replay.npcMemory.cora.interactions).toHaveLength(2);
  expect(JSON.stringify(replay.npcMemory.cora.interactions![0])).toBe(original);
  expect(latestSpokenDialogueReplies(replay,'cora',1)[0].summary).toBe(directions.text);
 });
 it.each(['ended','wrong-speaker','undiscussed','world','replacement-life','changed-direction','snapshot'] as const)('refuses stale %s delivery without display or history changes',kind=>{
  const {state}=make(),p=publication(state),text=directions.text!;
  if(kind==='ended')state.activeDialogueSession=null;
  if(kind==='wrong-speaker')state.activeDialogueSession!.npcId='other';
  if(kind==='undiscussed')state.activeDialogueSession!.discussedTopicIds=[];
  if(kind==='world')state.worldSeed++;
  if(kind==='replacement-life')state.townSim[740].villagers[28].bornDay--;
  if(kind==='changed-direction')directions.text=undefined;
  if(kind==='snapshot')p.source.snapshot='Other words';
  expect(publishSpokenNpcReply(state,'cora',text,p)).toEqual({});
 });
 it('does not backfill journal notes or display-only legacy answers into speech',()=>{
  const {state}=make();state.lastNpcResponse=directions.text!;
  state.discoveryLog=[{content:directions.text}] as GameState['discoveryLog'];
  expect(latestSpokenDialogueReplies(state,'cora')).toEqual([]);
 });
});
