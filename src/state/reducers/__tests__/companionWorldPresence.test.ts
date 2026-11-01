/** A public activity registers a person, not a meeting or recruitment reward. */
import {describe,it,expect} from 'vitest';
import {createMockGameState} from '@/utils/core/factories';
import {COMPANIONS} from '@/data/companions';
import {authoredCompanionsToRichNpcs} from '@/systems/party/authoredCompanionToRichNpc';
import {planCompanionWorldActivities} from '@/systems/companions/companionWorldActivities';
import {gameEntryReducer} from '../gameEntryReducer';
const activities=planCompanionWorldActivities(77,[{i:4,cell:2603,name:'Phu'},{i:93,cell:4413,name:'Kytion'}],
 {worldSeed:77,companionId:'elara_vance',goalId:'restore_temple',nearbyBurgId:93,sitePath:'world:77/temple'});
const initial=()=>createMockGameState({worldSeed:77,currentLocationId:'cell_2603',companions:structuredClone(COMPANIONS),metNpcIds:[],generatedNpcs:{},currentLocationActiveDynamicNpcIds:[]});
const action=()=>({type:'INITIALIZE_COMPANION_WORLD_PRESENCE' as const,payload:{activities,npcs:authoredCompanionsToRichNpcs(Object.values(COMPANIONS))}});
describe('new-world companion presence',()=>{
 it('registers both people globally but only the actual local person in the scene',()=>{
  const s=initial(),next=gameEntryReducer(s,action());
  expect(next.currentLocationActiveDynamicNpcIds).toEqual(['kaelen_thorne']);
  expect(Object.keys(next.generatedNpcs!)).toEqual(['elara_vance','kaelen_thorne']);
  expect(next.companions!.elara_vance.whereabouts).toMatchObject({locationId:'cell_4413',source:'world-activity'});
  for(const id of Object.keys(COMPANIONS))for(const key of ['identity','goals','memories','relationships','approvalHistory'] as const)
   expect(next.companions![id][key]).toEqual(s.companions[id][key]);
  expect(next).not.toHaveProperty('party');expect(next).not.toHaveProperty('metNpcIds');expect(next).not.toHaveProperty('questLog');expect(next).not.toHaveProperty('inventory');
  expect(gameEntryReducer({...s,...next},action())).toEqual({});
 });
 it('leaves observed, met and joined people unchanged',()=>{
  for(const kind of ['whereabouts','met','party'] as const){
   const s=initial();if(kind==='whereabouts')s.companions.elara_vance.whereabouts={worldSeed:77,locationId:'old',source:'encounter',observedAt:10,position:{xM:1,yM:2,zM:3}};
   if(kind==='met')s.metNpcIds=['elara_vance'];if(kind==='party')s.companions.elara_vance.inParty=true;
   const next=gameEntryReducer(s,action());expect(next.companions!.elara_vance).toBe(s.companions.elara_vance);
  }
 });
 it('rejects foreign-world plans and opening-model attempts to summon a remote companion',()=>{
  const s=initial();expect(gameEntryReducer({...s,worldSeed:78},action())).toEqual({});
  const next={...s,...gameEntryReducer(s,action())},npc=action().payload.npcs.find(p=>p.id==='elara_vance')!;
  expect(gameEntryReducer(next,{type:'PLACE_SITUATION_NPCS',payload:{npcs:[{...npc,name:'Invented stranger'}]}})).toEqual({});
  const local=next.generatedNpcs.kaelen_thorne;
  const result=gameEntryReducer(next,{type:'PLACE_SITUATION_NPCS',payload:{npcs:[{...local,name:'Invented replacement'}]}});
  expect(result.generatedNpcs!.kaelen_thorne).toBe(local);
 });
});
