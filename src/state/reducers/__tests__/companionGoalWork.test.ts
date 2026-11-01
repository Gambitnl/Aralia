/** A personal ambition belongs to the companion even when the player declines,
 * withdraws or supplies a bounded report. Consent is never inferred from work. */
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {createMockGameState,createMockPlayerCharacter} from '@/utils/core';
import {COMPANIONS} from '@/data/companions';
import {QuestStatus} from '@/types/quests';
import {DiscoveryType,type GameState} from '@/types/state';
import type {CompanionGoalWorkChoice} from '@/types/companions';
import {enumerateDungeonSites,type DungeonSite} from '@/systems/worldforge/dungeon/world/dungeonSites';
import {canonicalDungeonId} from '@/systems/worldforge/dungeon/world/dungeonIdentity';
import {companionReducer} from '../companionReducer';
import {questReducer} from '../questReducer';
vi.mock('@/systems/worldforge/dungeon/world/dungeonSites',()=>({enumerateDungeonSites:vi.fn()}));
const source={sourceId:'elara_restore_temple_v1',version:1,worldSeed:77,companionId:'elara_vance',goalId:'restore_temple',name:'Temple of the Morning',entranceName:'Temple of the Morning: Undercroft',builderName:'the Order of the Morning',nearbyBurgId:93,nearbyBurgName:'Kytion',settlementDistanceCells:1} as const;
const site={sitePath:'wf:77/cell:4413/dungeon:temple-morning-v1',cellId:4413,authoredGoal:source} as DungeonSite;
const fresh=()=>{
 const c=structuredClone(COMPANIONS.elara_vance);c.goals.find(g=>g.id==='restore_temple')!.disclosedDestination={worldSeed:77,sourceId:source.sourceId,sitePath:site.sitePath,cellId:4413,name:source.name,nearbyBurgId:93,nearbyBurgName:'Kytion',sharedAt:1};
 c.questline={id:'retained-preparations',title:'Road Preparations',currentStageId:'supplied',stages:{supplied:{description:'Kept the earlier promise',objectives:[],isCompleted:true}}};
 return createMockGameState({worldSeed:77,currentLocationId:'cell_3052',metNpcIds:['elara_vance'],currentLocationActiveDynamicNpcIds:['elara_vance'],companions:{elara_vance:c},party:[createMockPlayerCharacter({id:'mara',name:'Mara Tanner'})],gameTime:new Date('0351-01-01T18:28:00Z'),activeConversation:{id:'elara',participants:['elara_vance'],messages:[],startedAt:1,isPlayerTurn:true,pendingResponse:false},questLog:[]});
};
const choose=(state:GameState,choice:CompanionGoalWorkChoice)=>companionReducer(state,{type:'COMPANION_GOAL_WORK_CHOICE',payload:{companionId:'elara_vance',choice}});
const offered=()=>({...fresh(),...choose(fresh(),'ask')});
const active=()=>{const state=offered();return {...state,...choose(state,'accept')};};
beforeEach(()=>vi.mocked(enumerateDungeonSites).mockReturnValue([site]));
describe('Elara public work agreement',()=>{
 it('offers work without acceptance, trust, recruitment or replacing her previous chapter',()=>{
  const state=fresh(),patch=choose(state,'ask'),c=patch.companions!.elara_vance;
  expect(patch.questLog![0]).toMatchObject({status:QuestStatus.Available,companionWork:{destination:{worldSeed:77,sitePath:site.sitePath}}});
  expect(patch.questLog![0].dateStarted).toBeUndefined();expect(c.questline).toBe(state.companions.elara_vance.questline);
  expect(patch.questLog![0].objectives[0].description).toBe('Find the entrance to the Temple of the Morning.');
  expect(JSON.stringify(patch.questLog)).not.toContain('Undercroft');
  for(const key of ['goals','identity','inventory','relationships','whereabouts','inParty'] as const)expect(c[key]).toBe(state.companions.elara_vance[key]);
  for(const key of ['party','inventory','gold','playerGroundPos'])expect(patch).not.toHaveProperty(key);
  expect(c.memories.at(-1)!.tags).toContain('offered');expect(patch.activeConversation!.messages.every(m=>m.memoryHandled)).toBe(true);
 });
 it('requires learning the source destination before offering world-bound work',()=>{
  const state=fresh();delete state.companions.elara_vance.goals.find(g=>g.id==='restore_temple')!.disclosedDestination;
  expect(choose(state,'ask')).toEqual({});
 });
 it('lets Elara refuse reliance on a distrusted promise without abandoning her own goal',()=>{
  const state=fresh();state.companions.elara_vance.relationships.player.approval=-101;
  const patch=choose(state,'ask');expect(patch).not.toHaveProperty('questLog');
  expect(patch.activeConversation!.messages.at(-1)!.text).toContain('not willing to rely');
  expect(patch.companions!.elara_vance.goals).toBe(state.companions.elara_vance.goals);
  expect(patch.companions!.elara_vance.memories.at(-1)!.tags).toContain('refused-promise');
  const repeat=choose({...state,...patch},'ask');expect(repeat.companions!.elara_vance.memories).toBe(patch.companions!.elara_vance.memories);
 });
 it('declines without a promise or approval loss and preserves the offer for a later explicit acceptance',()=>{
  const state=offered(),patch=choose(state,'decline');
  expect(patch.questLog![0]).toMatchObject({status:QuestStatus.Available,companionWork:{response:'declined'}});
  expect(patch.companions!.elara_vance.relationships).toBe(state.companions.elara_vance.relationships);
  expect(choose({...state,...patch},'decline')).toEqual({});
  const accepted=choose({...state,...patch},'accept');expect(accepted.questLog![0].status).toBe(QuestStatus.Active);
 });
 it('remembers a promise and a single withdrawal consequence without erasing prior obligations',()=>{
  const state=active(),before=state.companions.elara_vance,patch=choose(state,'withdraw');
  expect(patch.questLog![0].status).toBe(QuestStatus.Abandoned);
  expect(patch.companions!.elara_vance.relationships.player.approval).toBe(before.relationships.player.approval-3);
  expect(patch.companions!.elara_vance.questline).toBe(before.questline);
  expect(patch.companions!.elara_vance.memories.slice(-3).map(m=>m.tags.at(-1))).toEqual(['offered','promised','withdrawn']);
  expect(choose({...state,...patch},'withdraw')).toEqual({});
 });
 it('can reopen the discussion after withdrawal without silently renewing a promise',()=>{
  const state=active(),withdrawn={...state,...choose(state,'withdraw')},next=choose(withdrawn,'ask');
  expect(next.questLog).toHaveLength(1);expect(next.questLog![0].status).toBe(QuestStatus.Available);expect(next.questLog![0].dateStarted).toBeUndefined();
  expect(next.companions!.elara_vance.memories.some(m=>m.tags.includes('withdrawn'))).toBe(true);
 });
 it('does not turn directions or a purchased rumor into a firsthand report',()=>{
  expect(choose(active(),'report')).toEqual({});
 });
 it('cannot use generic checkboxes or completion to claim that a report was given',()=>{
  const state=active(),questId=state.questLog[0].id;
  expect(questReducer(state,{type:'COMPLETE_QUEST',payload:{questId}})).toEqual({});
  expect(questReducer(state,{type:'UPDATE_QUEST_OBJECTIVE',payload:{questId,objectiveId:'find_entrance',isCompleted:true}})).toEqual({});
  expect(questReducer(state,{type:'UPDATE_QUEST_OBJECTIVE',payload:{questId,objectiveId:'report_to_elara',isCompleted:true}})).toEqual({});
 });
 it('records an actual arrival observation separately from telling the distant companion',()=>{
  const state=active(),id=canonicalDungeonId(site.sitePath),locationId=`world:77:cell:4413:site:${id}`;
  state.activeConversation=null;state.currentLocationActiveDynamicNpcIds=[];
  const patch=questReducer(state,{type:'ADD_DISCOVERY_ENTRY',payload:{type:DiscoveryType.LOCATION_DISCOVERY,source:{type:'LOCATION',id:locationId},associatedLocationId:'cell_4413',flags:[{key:'locationId',value:locationId},{key:'hiddenSiteId',value:id}]}});
  expect(patch.questLog![0].objectives.map(objective=>objective.isCompleted)).toEqual([true,false]);
  expect(patch.questLog![0].status).toBe(QuestStatus.Active);expect(patch).not.toHaveProperty('companions');
 });
 it('requires the exact source-world arrival discovery before accepting a report once',()=>{
  const state=active(),id=canonicalDungeonId(site.sitePath),locationId=`world:77:cell:4413:site:${id}`;
  state.discoveryLog=[{id:'real-observation',timestamp:1,gameTime:state.gameTime.toISOString(),type:DiscoveryType.LOCATION_DISCOVERY,title:'Found the entrance',content:'You found the undercroft nearby.',source:{type:'LOCATION',id:locationId},flags:[{key:'locationId',value:locationId},{key:'hiddenSiteId',value:id}],associatedLocationId:'cell_4413',isRead:false}];
  const before=state.companions.elara_vance,patch=choose(state,'report');
  expect(patch.questLog![0]).toMatchObject({status:QuestStatus.Completed,companionWork:{reportDiscoveryId:'real-observation'}});
  expect(patch.companions!.elara_vance.relationships.player.approval).toBe(before.relationships.player.approval+10);
  expect(patch.companions!.elara_vance.goals).toBe(before.goals);expect(patch.companions!.elara_vance.questline).toBe(before.questline);
  expect(patch.party).toBe(state.party);expect(patch.inventory).toBe(state.inventory);expect(patch.gold).toBe(state.gold);
  expect(choose({...state,...patch},'report')).toEqual({});
  const foreign=structuredClone(state);foreign.discoveryLog[0].source.id=locationId.replace('world:77:','world:78:');expect(choose(foreign,'report')).toEqual({});
 });
 it.each(['absent','pending','foreign-source','unmet'] as const)('refuses a stale or unavailable discussion: %s',reason=>{
  const state=fresh();if(reason==='absent')state.currentLocationActiveDynamicNpcIds=[];if(reason==='pending')state.activeConversation!.pendingResponse=true;if(reason==='unmet')state.metNpcIds=[];
  if(reason==='foreign-source')vi.mocked(enumerateDungeonSites).mockReturnValue([{...site,authoredGoal:{...source,worldSeed:78}}]);
  expect(choose(state,'ask')).toEqual({});
 });
 it('recalls a serialized active promise without repeating memory, trust or quest acceptance',()=>{
  const state=active();state.companions=JSON.parse(JSON.stringify(state.companions));state.questLog=JSON.parse(JSON.stringify(state.questLog));
  const patch=choose(state,'recall');expect(patch.companions!.elara_vance.memories).toBe(state.companions.elara_vance.memories);expect(patch).not.toHaveProperty('questLog');
  expect(patch.activeConversation!.messages.at(-1)!.text).toContain('still counting');
 });
});
