/** Source-bound expedition consent exercises the real membership reducer and
 * existing character promotion. Fixtures are not claims of played recruitment. */
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {createMockGameState,createMockPlayerCharacter,createMockItem} from '@/utils/core';
import {COMPANIONS} from '@/data/companions';
import type {CompanionTravelChoice} from '@/types/companions';
import {DiscoveryType,type GameState} from '@/types/state';
import {QuestStatus} from '@/types/quests';
import {canonicalDungeonId} from '@/systems/worldforge/dungeon/world/dungeonIdentity';
import {enumerateDungeonSites,type DungeonSite} from '@/systems/worldforge/dungeon/world/dungeonSites';
import {companionTempleWork,templeAccountQuest} from '@/systems/companions/companionGoalWork';
import {preparationQuestline,ELARA_PREPARATIONS_QUEST_ID} from '@/systems/companions/companionPreparations';
import {companionReducer} from '../companionReducer';
vi.mock('@/systems/worldforge/dungeon/world/dungeonSites',()=>({enumerateDungeonSites:vi.fn()}));
const source={sourceId:'elara_restore_temple_v1',version:1,worldSeed:77,companionId:'elara_vance',goalId:'restore_temple',name:'Temple of the Morning',entranceName:'Morning Undercroft',builderName:'Morning',nearbyBurgId:3,nearbyBurgName:'Test Town',settlementDistanceCells:1} as const;
const site={sitePath:'wf:77/cell:777/dungeon:temple-morning-v1',cellId:777,authoredGoal:source} as unknown as DungeonSite;
beforeEach(()=>vi.mocked(enumerateDungeonSites).mockReturnValue([site]));
function ready(){
 const c=structuredClone(COMPANIONS.elara_vance);
 c.relationships.player.approval=15;
 c.inventory=[createMockItem({id:'elara-owned-supplies',quantity:2,description:'Retained personal belongings.'})];
 c.whereabouts={worldSeed:77,locationId:'cell_700',source:'world-activity',observedAt:1,position:{xM:10,yM:0,zM:10}};
 c.publicActivity={version:1,sourceId:'activity',worldSeed:77,companionId:c.id,kind:'restoration-preparations',burgId:3,burgName:'Test Town',cellId:700,locationId:'cell_700',summary:'Preparing for her own journey.'};
 c.goals.find(g=>g.id==='restore_temple')!.disclosedDestination={worldSeed:77,sourceId:source.sourceId,sitePath:site.sitePath,cellId:777,name:source.name,nearbyBurgId:3,nearbyBurgName:'Test Town',sharedAt:1};
 const s=createMockGameState({worldSeed:77,currentLocationId:'cell_700',companions:{[c.id]:c},party:[createMockPlayerCharacter()],metNpcIds:[c.id],currentLocationActiveDynamicNpcIds:[c.id],
  playerGroundPos:{tileX:700,tileY:0,xM:11,yM:0,zM:10},activeConversation:{id:'meeting',startedAt:0,participants:[c.id],messages:[],isPlayerTurn:true,pendingResponse:false}});
 c.questline=preparationQuestline(s);c.questline.currentStageId='supplied';
 const work=companionTempleWork(s,c.id)!;const q=templeAccountQuest(s,work);q.status=QuestStatus.Completed;q.companionWork!.reportDiscoveryId='observed';q.objectives=q.objectives.map(o=>({...o,isCompleted:true}));s.questLog=[q];
 c.memories=[{id:'supply',type:'event',timestamp:1,importance:7,text:'Kept provision promise',tags:[ELARA_PREPARATIONS_QUEST_ID,'promise-fulfilled']},{id:'report',type:'event',timestamp:2,importance:7,text:'Kept report',tags:[q.id,'reported']}];
 const dungeonId=canonicalDungeonId(site.sitePath),location=`world:77:cell:777:site:${dungeonId}`;
 s.discoveryLog=[{id:'observed',timestamp:2,gameTime:s.gameTime.toISOString(),type:DiscoveryType.LOCATION_DISCOVERY,title:'Observed',content:'A firsthand entrance.',source:{type:'LOCATION',id:location},associatedLocationId:'cell_777',flags:[{key:'locationId',value:location},{key:'hiddenSiteId',value:dungeonId}],isRead:false}];
 return s;
}
const choose=(s:GameState,choice:CompanionTravelChoice)=>companionReducer(s,{type:'COMPANION_TRAVEL_CHOICE',payload:{companionId:'elara_vance',choice}});
const offer=(s:GameState)=>({...s,...choose(s,'propose_goal')});
describe('deliberate companion travel consent',()=>{
 it('saves reached party feet and pending corners without replacing the person',()=>{
  const offered=offer(ready()),s={...offered,...choose(offered,'accept_terms')};
  const old=s.companions.elara_vance,position={xM:11,yM:0,zM:10},trail=[{xM:12,yM:0,zM:10},{xM:12,yM:0,zM:14}];
  const p=companionReducer(s,{type:'RECORD_COMPANION_POSITION',payload:{companionId:old.id,worldSeed:77,locationId:s.currentLocationId,position,trail}});
  const person=p.companions!.elara_vance;
  expect(person.whereabouts).toMatchObject({source:'party',position});expect(person.following?.trail).toEqual(trail);
  expect(person.following?.trail).not.toBe(trail);expect(person.inventory).toBe(old.inventory);expect(person.goals).toBe(old.goals);
  expect(person.travelAgreement).toBe(old.travelAgreement);expect(person.publicActivity).toBe(old.publicActivity);expect(person.memories).toBe(old.memories);
  expect(person.journeyDeparture).toBe(old.whereabouts);
  const next={...s,...p};const left=companionReducer(next,{type:'DISMISS_PARTY_MEMBER',payload:{memberId:old.id}});
  expect(companionReducer(next,{type:'RECORD_COMPANION_POSITION',payload:{companionId:old.id,worldSeed:77,locationId:s.currentLocationId,position,trail}})).toEqual({});
  expect(left.companions!.elara_vance.whereabouts?.position).toEqual(position);
 });
 it('rejects remote or malformed party footfall callbacks',()=>{
  const offered=offer(ready()),s={...offered,...choose(offered,'accept_terms')};
  const payload={companionId:'elara_vance',worldSeed:77,locationId:s.currentLocationId,position:{xM:11,yM:0,zM:10},trail:[]};
  for(const patch of [{worldSeed:78},{locationId:'cell_777'},{position:{xM:NaN,yM:0,zM:0}},{trail:Array(513).fill(payload.position)}])
   expect(companionReducer(s,{type:'RECORD_COMPANION_POSITION',payload:{...payload,...patch}})).toEqual({});
 });
 it('remembers an ordinary refusal without awarding friendship or spamming memories',()=>{
  const s=ready(),before=structuredClone(s),p=choose(s,'invite');
  expect(p.party).toBeUndefined();expect(p.companions!.elara_vance.relationships.player.approval).toBe(15);
  expect(p.activeConversation!.messages.at(-1)?.text).toMatch(/not agreeing to follow your party/);
  const again=choose({...s,...p},'invite');expect(again.companions!.elara_vance.memories).toHaveLength(3);expect(s).toEqual(before);
 });
 it('offers purpose and terms without joining or changing either person’s goals or belongings',()=>{
  const s=ready(),p=choose(s,'propose_goal');expect(p.party).toBeUndefined();
  expect(p.companions!.elara_vance.travelAgreement).toMatchObject({response:'offered',worldSeed:77,sitePath:site.sitePath});
  expect(p.companions!.elara_vance.goals).toBe(s.companions.elara_vance.goals);
  expect(p.inventory).toBeUndefined();expect(p.companions!.elara_vance.publicActivity).toBe(s.companions.elara_vance.publicActivity);
 });
 it('requires an actual offer then atomically promotes the same person once',()=>{
  const s=ready();expect(choose(s,'accept_terms')).toEqual({});const offered=offer(s),p=choose(offered,'accept_terms');
  expect(p.party).toHaveLength(2);expect(p.party![1].id).toBe('elara_vance');expect(p.party![1].class.id).toBe('cleric');
  expect(p.companions!.elara_vance).toMatchObject({inParty:true,travelAgreement:{response:'accepted'},relationships:{player:{approval:15}}});
  expect(p.currentLocationActiveDynamicNpcIds).toBeNull();
  expect(p.companions!.elara_vance.identity).toEqual(s.companions.elara_vance.identity);expect(p.companions!.elara_vance.goals).toEqual(s.companions.elara_vance.goals);
  expect(p.companions!.elara_vance.inventory).toBe(s.companions.elara_vance.inventory);
  expect(p.companions!.elara_vance.whereabouts).toBe(s.companions.elara_vance.whereabouts);
  expect(p.companions!.elara_vance.relationships).toBe(s.companions.elara_vance.relationships);
  expect(p.questLog).toBeUndefined();expect(choose({...offered,...p},'accept_terms')).toEqual({});
 });
 it('retains a declined agreement and allows no acceptance of its stale button',()=>{
  const s=offer(ready()),p=choose(s,'decline_terms');expect(p.party).toBeUndefined();
  expect(p.companions!.elara_vance.travelAgreement?.response).toBe('declined');expect(p.companions!.elara_vance.memories.some(m=>m.tags.includes('terms-declined'))).toBe(true);
  expect(choose({...s,...p},'accept_terms')).toEqual({});
 });
 it.each(['remote','wrong-world','missing-report','unkept-supplies','stale-preparations','secret-goal','invalid-feet'] as const)('refuses stale %s evidence at offer and acceptance',kind=>{
  const s=offer(ready()),c=s.companions.elara_vance;
  if(kind==='remote')s.playerGroundPos!.xM=100;
  if(kind==='wrong-world')s.worldSeed=88;
  if(kind==='missing-report')s.questLog[0].companionWork!.reportDiscoveryId='invented';
  if(kind==='unkept-supplies')c.memories=c.memories.filter(m=>!m.tags.includes('promise-fulfilled'));
  if(kind==='stale-preparations')c.questline!.origin!.worldSeed=88;
  if(kind==='secret-goal')c.goals.find(g=>g.id==='restore_temple')!.isSecret=true;
  if(kind==='invalid-feet')s.playerGroundPos!.zM=NaN;
  expect(choose(s,'accept_terms')).toEqual({});
 });
 it('does not weaken the ordinary friendship invitation gate',()=>{
  const s=ready();s.companions.elara_vance.relationships.player.approval=200;
  expect(choose(s,'invite').party).toHaveLength(2);
 });
 it('locks all choices during a pending response',()=>{
  const s=offer(ready());s.activeConversation!.pendingResponse=true;expect(choose(s,'accept_terms')).toEqual({});expect(choose(s,'invite')).toEqual({});
 });
 it('recalls an accepted purpose without a second award or membership mutation',()=>{
  const s=offer(ready()),joined={...s,...choose(s,'accept_terms')},p=choose(joined,'recall_terms');
  expect(p.party).toBeUndefined();expect(p.companions!.elara_vance).toEqual(joined.companions.elara_vance);
  expect(p.activeConversation!.messages.at(-1)?.text).toMatch(/restoration remains my own/);
 });
 it('recalls the actual shared arrival and her own exhaustion without a new award',()=>{
  const offered=offer(ready()),s={...offered,...choose(offered,'accept_terms')},c=s.companions.elara_vance;
  s.currentLocationId='cell_777';c.whereabouts={...c.whereabouts!,locationId:s.currentLocationId};
  c.journey={id:'played-leg',worldSeed:77,from:{cellId:700,locationId:'cell_700',position:{xM:10,yM:0,zM:10}},to:{cellId:777,locationId:s.currentLocationId},intendedCellId:777,routeCells:[700,777],departedAt:0,arrivalAt:62277000,status:'arrived'};
  c.memories=[...c.memories,{id:'played-leg:arrived',type:'event',timestamp:62277000,importance:5,text:'Shared the journey.',tags:['shared-journey','arrived']}];
  s.party=s.party.map(person=>person.id===c.id?{...person,conditions:['exhaustion']}:person);
  const before=structuredClone(c),p=choose(s,'recall_journey'),reply=p.activeConversation!.messages.at(-1)!.text;
  expect(reply).toContain('17 hours and 18 minutes');expect(reply).toContain('I want to rest');expect(reply).toContain('work remains unfinished');
  expect(p.companions!.elara_vance).toEqual(before);expect(p.party).toBeUndefined();expect(p.inventory).toBeUndefined();expect(p.gold).toBeUndefined();
  expect(choose({...s,...p},'recall_journey').companions!.elara_vance).toEqual(before);
  c.memories=c.memories.filter(memory=>memory.id!=='played-leg:arrived');expect(choose(s,'recall_journey')).toEqual({});
 });
});


describe('Elara decides whether to share water for the known return',()=>{
 function atTemple(){
  const offered=offer(ready()),s={...offered,...choose(offered,'accept_terms')},c=s.companions.elara_vance;
  c.journeyDeparture={...c.whereabouts!};
  s.currentLocationId='cell_777';s.playerCell={cellId:777,localeCoords:null};
  c.whereabouts={...c.whereabouts!,locationId:s.currentLocationId};
  c.journey={id:'real-arrival',worldSeed:77,from:{cellId:700,locationId:'cell_700',position:{xM:10,yM:0,zM:10}},to:{cellId:777,locationId:s.currentLocationId},intendedCellId:777,routeCells:[700,777],departedAt:0,arrivalAt:1,status:'arrived'};
  c.memories.push({id:'real-arrival:arrived',type:'event',timestamp:1,importance:5,text:'Actual shared journey',tags:['shared-journey','arrived']});
  c.inventory=[createMockItem({id:'water-day',quantity:1,description:'Her own sealed water',acquiredAt:4})];
  s.inventory=[createMockItem({id:'water-day',quantity:0.25})];
  return s;
 }
 it('offers and accepts limited sharing without moving water or inventing carrying capacity',()=>{
  const s=atTemple(),before=structuredClone(s),p=choose(s,'discuss_return_water');
  expect(p.inventory).toBeUndefined();expect(p.companions!.elara_vance.inventory).toBe(s.companions.elara_vance.inventory);
  expect(p.companions!.elara_vance.travelAgreement!.returnWater).toMatchObject({response:'offered',amount:0.25,destinationCellId:700});
  const offered={...s,...p},accepted=choose(offered,'accept_return_water'),c=accepted.companions!.elara_vance;
  expect(accepted.inventory).toBeUndefined();expect(c.inventory).toBe(s.companions.elara_vance.inventory);
  expect(c.relationships).toBe(s.companions.elara_vance.relationships);expect(c.goals).toBe(s.companions.elara_vance.goals);
  expect(c.travelAgreement!.response).toBe('accepted');expect(c.travelAgreement!.exploration).toBe(s.companions.elara_vance.travelAgreement!.exploration);
  expect(c.memories.at(-1)?.tags).toContain('return-water-accepted');
  expect(choose({...offered,...accepted},'accept_return_water')).toEqual({});expect(s).toEqual(before);
 });
 it('can decline the offer without changing either bag or opening the temple',()=>{
  const s=atTemple(),p=choose(s,'discuss_return_water'),offered={...s,...p},no=choose(offered,'decline_return_water');
  expect(no.inventory).toBeUndefined();expect(no.companions!.elara_vance.inventory).toBe(s.companions.elara_vance.inventory);
  expect(no.companions!.elara_vance.travelAgreement!.returnWater?.response).toBe('declined');
  expect(choose({...offered,...no},'accept_return_water')).toEqual({});
 });
 it.each(['remote','wrong-world','no-arrival','changed-water','mistrust'] as const)('refuses stale %s acceptance without a transfer',kind=>{
  const s=atTemple(),p=choose(s,'discuss_return_water'),offered={...s,...p};
  if(kind==='remote')offered.playerGroundPos!.xM=100;
  if(kind==='wrong-world')offered.worldSeed=78;
  if(kind==='no-arrival')offered.companions.elara_vance.journey=undefined;
  if(kind==='changed-water')offered.inventory=[];
  if(kind==='mistrust')offered.companions.elara_vance.relationships.player.approval=-1;
  expect(choose(offered,'accept_return_water')).toEqual({});
 });
 it('refuses to promise water that would take her below the stated half-day reserve',()=>{
  const s=atTemple();s.companions.elara_vance.inventory![0].quantity=0.5;
  const p=choose(s,'discuss_return_water');expect(p.inventory).toBeUndefined();
  expect(p.companions!.elara_vance.travelAgreement!.returnWater?.response).toBe('declined');
  expect(p.activeConversation!.messages.at(-1)?.text).toMatch(/own half-day/);
 });
});

describe('Kaelen can discuss his advertised work without accepting a contract',()=>{
 function available(){
  const state=ready(),c=structuredClone(COMPANIONS.kaelen_thorne);
  c.publicActivity={version:1,sourceId:'kaelen-public-work-77',worldSeed:77,companionId:c.id,kind:'seeking-independent-work',burgId:3,burgName:'Test Town',cellId:700,locationId:'cell_700',summary:'Looking for independent paid work.'};
  c.whereabouts=state.companions.elara_vance.whereabouts;
  state.companions={[c.id]:c};state.metNpcIds=[c.id];state.currentLocationActiveDynamicNpcIds=[c.id];
  state.activeConversation!.participants=[c.id];state.questLog=[];
  return state;
 }
 const ask=(s:GameState)=>companionReducer(s,{type:'COMPANION_TRAVEL_CHOICE',payload:{companionId:'kaelen_thorne',choice:'discuss_work'}});
 it('records the real request once, recalls it after serialization, and preserves agency and secrets',()=>{
  const s=available(),before=structuredClone(s),p=ask(s),c=p.companions!.kaelen_thorne;
  expect(c.memories).toHaveLength(1);expect(c.memories[0]).toMatchObject({timestamp:s.gameTime.getTime(),tags:['independent-work-discussed','kaelen-public-work-77','world:77']});
  expect(c.goals).toBe(s.companions.kaelen_thorne.goals);expect(c.relationships).toBe(s.companions.kaelen_thorne.relationships);
  expect(c.whereabouts).toBe(s.companions.kaelen_thorne.whereabouts);expect(c.publicActivity).toBe(s.companions.kaelen_thorne.publicActivity);
  for(const key of ['party','inventory','gold','questLog','npcMemory','metNpcIds'] as const)expect(p[key]).toBeUndefined();
  const reply=p.activeConversation!.messages.at(-1)!.text;
  expect(reply).toContain('what needs doing, what it pays, and how we get back');expect(reply).toContain('not accepted a job');
  expect(reply).not.toMatch(/Zhentarim|sister|Underdark/);
  const loaded={...s,...JSON.parse(JSON.stringify(p))},recall=ask(loaded);
  expect(recall.companions!.kaelen_thorne).toEqual(c);expect(recall.activeConversation!.messages.at(-1)?.text).toContain('As I said');
  expect(companionReducer({...s,...p},{type:'COMPANION_TRAVEL_CHOICE',payload:{companionId:'kaelen_thorne',choice:'invite'}}).party).toBeUndefined();
  expect(s).toEqual(before);
 });
 it.each(['remote','wrong-world','missing-activity','wrong-person','wrong-location','already-joined','pending','not-player-turn','unmet'] as const)('rejects stale %s requests',kind=>{
  const s=available(),c=s.companions.kaelen_thorne;
  if(kind==='remote')s.playerGroundPos!.xM=100;
  if(kind==='wrong-world')s.worldSeed=78;
  if(kind==='missing-activity')delete c.publicActivity;
  if(kind==='wrong-person')c.publicActivity!.companionId='elara_vance';
  if(kind==='wrong-location')c.publicActivity!.locationId='cell_777';
  if(kind==='already-joined')c.inParty=true;
  if(kind==='pending')s.activeConversation!.pendingResponse=true;
  if(kind==='not-player-turn')s.activeConversation!.isPlayerTurn=false;
  if(kind==='unmet')s.metNpcIds=[];
  expect(ask(s)).toEqual({});
 });
});
