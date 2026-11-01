import {describe,expect,it} from 'vitest';
import {preparePartyMeal} from '../partyMeal';
import {characterReducer} from '../../../state/reducers/characterReducer';
import {createMockGameState,createMockPlayerCharacter} from '../../../utils/core';
import type {Item} from '../../../types';

function fixture(members=1){
 const item=(id:string,quantity:number,acquiredAt:number)=>({id,name:id,type:'food_drink',description:'',quantity,acquiredAt} as Item);
 const inventory=[item('rations',4,100),item('water-day',4,200),item('rations',1,300),item('water-day',1,400)];
 const state=createMockGameState({inventory,party:Array.from({length:members},(_,index)=>createMockPlayerCharacter({id:`c${index}`,hp:3,maxHp:10,conditions:['starving','fatigued','poisoned','exhaustion_2']})),
  gold:8.06,travelMinutesRemainder:265,lastLongRestAt:'2000-01-01T00:00:00Z'});
 return {state,meal:{rationIndex:2,rationItem:inventory[2],waterIndex:3,waterItem:inventory[3],partyIds:state.party.map(member=>member.id!)}};
}
describe('confirmed coupled party meal',()=>{
 it('consumes the bought singletons, preserves original stacks and grants no rest or HP',()=>{
  const {state,meal}=fixture();
  const patch=characterReducer(state,{type:'USE_ITEM',payload:{itemId:'rations',characterId:'c0',meal}});
  expect(patch.inventory).toEqual(state.inventory.slice(0,2));
  expect(patch.inventory![0]).toBe(state.inventory[0]);
  expect(patch.inventory![1]).toBe(state.inventory[1]);
  expect(patch.party![0].conditions).toEqual(['poisoned','exhaustion_2']);
  expect(patch.party![0].hp).toBe(3);
  expect(patch.party![0].spellSlots).toEqual(state.party[0].spellSlots);
  expect(patch.travelMinutesRemainder).toBe(0);
  expect(patch.gold).toBeUndefined();expect(patch.lastLongRestAt).toBeUndefined();expect(patch.gameTime).toBeUndefined();
  expect(preparePartyMeal({...state,...patch},meal)).toHaveProperty('error');
 });
 it('fills only the remaining party cost from other stacks',()=>{
  const {state,meal}=fixture(2);const result=preparePartyMeal(state,meal);
  expect('patch'in result&&result.patch.inventory?.map(item=>({id:item.id,quantity:item.quantity,acquiredAt:item.acquiredAt}))).toEqual([
   {id:'rations',quantity:3,acquiredAt:100},{id:'water-day',quantity:3,acquiredAt:200}]);
 });
 it('rejects a shifted same-ID source instead of consuming its replacement',()=>{
  const {state,meal}=fixture();state.inventory=[...state.inventory];state.inventory[2]={...meal.rationItem,acquiredAt:999};
  expect(preparePartyMeal(state,meal)).toHaveProperty('error');
 });
 it('refuses insufficient water without nibbling food',()=>{
  const {state,meal}=fixture(2);state.inventory[1]={...state.inventory[1],quantity:0};
  expect(preparePartyMeal(state,meal)).toHaveProperty('error');expect(state.inventory[2].quantity).toBe(1);
 });
 it('refuses a changed party and unconscious diners',()=>{
  const {state,meal}=fixture();expect(preparePartyMeal(state,{...meal,partyIds:['other']})).toHaveProperty('error');
  state.party[0].hp=0;expect(preparePartyMeal(state,meal)).toHaveProperty('error');
 });
 it('uses the same food expiration rule as the inventory',()=>{
  const {state,meal}=fixture();Object.assign(meal.rationItem,{perishable:true,shelfLife:'1 day',acquiredAt:100});
  expect(preparePartyMeal(state,meal,100+86400000)).toHaveProperty('error');
 });
});
