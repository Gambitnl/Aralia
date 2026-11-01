/** Offers are remembered terms, not accepted obligations or reward triggers. */
import {describe,it,expect} from 'vitest';
import {QuestStatus,type Quest} from '@/types/quests';
import {createMockGameState} from '@/utils/core';
import {questReducer} from '../questReducer';
const blueprint:Quest={id:'offered-work',title:'An offered task',description:'Its actual terms',giverId:'elara_vance',status:QuestStatus.Available,objectives:[{id:'report',description:'Bring a report',isCompleted:false}],rewards:{gold:8}};
const fresh=()=>createMockGameState({gameTime:new Date('0351-01-01T18:28:00Z'),questLog:[]});
describe('quest offer lifecycle',()=>{
 it('records an unaccepted offer with its game-clock date and no start date or reward',()=>{
  const state=fresh(),patch=questReducer(state,{type:'OFFER_QUEST',payload:blueprint});
  expect(patch.questLog![0]).toMatchObject({status:QuestStatus.Available,dateOffered:state.gameTime.getTime()});
  expect(patch.questLog![0].dateStarted).toBeUndefined();expect(patch).not.toHaveProperty('gold');
  expect(patch.journal!.pendingEvents.at(-1)).toMatchObject({type:'npc_conversation',title:'Work Offered: An offered task'});
  expect(blueprint).not.toHaveProperty('dateOffered');
 });
 it('accepts the retained offer once without replacing its terms with caller data',()=>{
  const first={...fresh(),...questReducer(fresh(),{type:'OFFER_QUEST',payload:blueprint})};
  const patch=questReducer(first,{type:'ACCEPT_QUEST',payload:{...blueprint,description:'forged replacement',rewards:{gold:9999}}});
  expect(patch.questLog).toHaveLength(1);expect(patch.questLog![0]).toMatchObject({status:QuestStatus.Active,description:blueprint.description,rewards:blueprint.rewards,dateStarted:first.gameTime.getTime()});
  expect(questReducer({...first,...patch},{type:'ACCEPT_QUEST',payload:blueprint})).toEqual({});
 });
 it.each([QuestStatus.Available,QuestStatus.Abandoned,QuestStatus.Failed,QuestStatus.Unknown])('cannot complete or progress %s work',status=>{
  const state={...fresh(),questLog:[{...blueprint,status}]};
  expect(questReducer(state,{type:'UPDATE_QUEST_OBJECTIVE',payload:{questId:blueprint.id,objectiveId:'report',isCompleted:true}})).toEqual({});
  expect(questReducer(state,{type:'COMPLETE_QUEST',payload:{questId:blueprint.id}})).toEqual({});
 });
 it('records an explicit withdrawal once and can offer the work again without accepting it',()=>{
  const state={...fresh(),questLog:[{...blueprint,status:QuestStatus.Active,dateStarted:1}]};
  const patch=questReducer(state,{type:'ABANDON_QUEST',payload:{questId:blueprint.id,reason:'You withdrew your promise.'}});
  expect(patch.questLog![0]).toMatchObject({status:QuestStatus.Abandoned,dateStarted:1,dateAbandoned:state.gameTime.getTime()});
  const abandoned={...state,...patch};expect(questReducer(abandoned,{type:'ABANDON_QUEST',payload:{questId:blueprint.id,reason:'again'}})).toEqual({});
  const reoffered=questReducer(abandoned,{type:'OFFER_QUEST',payload:blueprint});expect(reoffered.questLog![0].status).toBe(QuestStatus.Available);expect(reoffered.questLog![0].dateStarted).toBeUndefined();
 });
 it.each([QuestStatus.Available,QuestStatus.Active,QuestStatus.Completed])('does not replace existing %s work with a new offer',status=>{
  expect(questReducer({...fresh(),questLog:[{...blueprint,status}]},{type:'OFFER_QUEST',payload:blueprint})).toEqual({});
 });
});
