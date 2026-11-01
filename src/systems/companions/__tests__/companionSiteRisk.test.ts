/** Fixtures prove decision boundaries; actual offers/refusals require gameplay. */
import {describe,it,expect} from 'vitest';
import {COMPANIONS} from '@/data/companions';
import {createMockGameState,createMockPlayerCharacter,createMockItem} from '@/utils/core';
import {applyCompanionTravelChoice} from '@/state/reducers/companionTravelReducer';
import {companionDungeonRiskError,companionSiteRiskConcerns} from '../companionSiteRisk';
import type {DungeonIdentity} from '@/systems/worldforge/dungeon/world/dungeonIdentity';
const identity={dungeonId:'wf-dungeon-wf:77/cell:777/site',seedPath:'wf:77/cell:777/site'} as DungeonIdentity;
function ready(supplied=true){
 const c=structuredClone(COMPANIONS.elara_vance);c.inParty=true;c.relationships.player.approval=15;
 c.travelAgreement={worldSeed:77,sourceId:'elara_restore_temple_v1',goalId:'restore_temple',sitePath:identity.seedPath,destinationName:'Temple of the Morning',terms:['Judge risks together'],offeredAt:1,response:'accepted'};
 c.goals.find(g=>g.id==='restore_temple')!.disclosedDestination={worldSeed:77,sourceId:c.travelAgreement.sourceId,sitePath:identity.seedPath,cellId:777,name:'Temple of the Morning',nearbyBurgId:3,nearbyBurgName:'Town',sharedAt:1};
 c.whereabouts={worldSeed:77,locationId:'cell_777',source:'party',observedAt:1,position:{xM:12,yM:0,zM:10}};
 c.inventory=[createMockItem({id:'rations',quantity:2}),createMockItem({id:'water-day',quantity:2})];
 return createMockGameState({worldSeed:77,playerCell:{cellId:777,localeCoords:null},currentLocationId:'cell_777',playerGroundPos:{tileX:777,tileY:0,xM:10,yM:0,zM:10},
  companions:{[c.id]:c},party:[createMockPlayerCharacter({id:'bram',name:'Bram',hp:10,maxHp:10}),createMockPlayerCharacter({id:c.id,name:'Elara',hp:10,maxHp:10})],metNpcIds:[c.id],
  inventory:supplied?[createMockItem({id:'rations',quantity:1}),createMockItem({id:'water-day',quantity:1})]:[],
  activeConversation:{id:'talk',startedAt:0,participants:[c.id],messages:[],isPlayerTurn:true,pendingResponse:false}});
}
const choose=(s:ReturnType<typeof ready>,choice:Parameters<typeof applyCompanionTravelChoice>[2])=>({...s,...applyCompanionTravelChoice(s,'elara_vance',choice).patch});
describe('source-bound entrance-floor discussion',()=>{
 it('refuses for a real unmet return-meal need without sharing private surplus or erasing the travel promise',()=>{
  const s=ready(false),before=structuredClone(s),next=choose(s,'discuss_entry');
  expect(next.companions.elara_vance.travelAgreement!.response).toBe('accepted');
  expect(next.companions.elara_vance.travelAgreement!.exploration!.response).toBe('declined');
  expect(next.activeConversation!.messages.at(-1)!.text).toContain('Bram has no complete day');
  expect(companionDungeonRiskError(next,identity)).toContain('Bram has no complete day');
  expect(next.inventory).toBe(s.inventory);expect(next.companions.elara_vance.inventory).toBe(s.companions.elara_vance.inventory);
  expect(s).toEqual(before);
  const twice=choose(next,'discuss_entry');
  expect(twice.companions.elara_vance.memories).toHaveLength(next.companions.elara_vance.memories.length);
 });
 it('requires a separate mutual offer and acceptance; repeated discussion cannot withdraw an unchanged agreement',()=>{
  const s=ready();expect(choose(s,'accept_entry_terms')).toEqual(s);
  const offered=choose(s,'discuss_entry');expect(offered.companions.elara_vance.travelAgreement!.exploration!.response).toBe('offered');
  expect(companionDungeonRiskError(offered,identity)).toContain('Discuss');
  const accepted=choose(offered,'accept_entry_terms');expect(companionDungeonRiskError(accepted,identity)).toBeNull();
  expect(companionDungeonRiskError(accepted,identity,1)).toContain('not agreed to descend');
  expect(choose(accepted,'discuss_entry').companions.elara_vance.travelAgreement!.exploration!.response).toBe('accepted');
 });
 it('rechecks changed health and supplies before accepting and at the actual doorway',()=>{
  const offered=choose(ready(),'discuss_entry');offered.party[0].conditions=['exhaustion'];
  const next=choose(offered,'accept_entry_terms');expect(next.companions.elara_vance.travelAgreement!.exploration!.response).toBe('declined');
  expect(next.activeConversation!.messages.at(-1)!.text).toContain('exhaustion');
  const accepted=choose(choose(ready(),'discuss_entry'),'accept_entry_terms');accepted.inventory=[];
  expect(companionDungeonRiskError(accepted,identity)).toContain('Bram has no complete day');
 });
 it('preserves a refusal and exact reasons through serialization and recall without new rewards',()=>{
  const refused=choose(ready(false),'discuss_entry'),copy=JSON.parse(JSON.stringify(refused));copy.gameTime=new Date(copy.gameTime);
  const recalled=choose(copy,'recall_entry_terms');
  expect(recalled.activeConversation!.messages.at(-1)!.text).toContain('no complete day');
  expect(recalled.companions).toEqual(refused.companions);expect(recalled.gold).toBe(refused.gold);
 });
 it('does not remotely grant consent, cross worlds, reveal unknown interiors or change unrelated dungeon entry',()=>{
  const s=ready();s.companions.elara_vance.whereabouts!.position!.xM=100;
  expect(choose(s,'discuss_entry')).toEqual(s);
  s.worldSeed=78;expect(choose(s,'discuss_entry')).toEqual(s);
  expect(companionDungeonRiskError(ready(),{...identity,seedPath:'elsewhere'} as DungeonIdentity)).toBeNull();
 });
 it('keeps the player’s decision to stay outside and rejects new danger when hurt or trust is broken',()=>{
  const declined=choose(choose(ready(),'discuss_entry'),'decline_entry_terms');
  expect(declined.companions.elara_vance.travelAgreement!.exploration!.response).toBe('declined');
  const s=ready();s.party[0].hp=1;s.companions.elara_vance.relationships.player.approval=-1;
  expect(companionSiteRiskConcerns(s,'elara_vance').join(' ')).toMatch(/trust.*care/);
 });
});
