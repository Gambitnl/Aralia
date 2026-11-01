/** Physical water capacity, atomic spell cost and real provision debit share
 * the same fixtures. Native casting/reload remains a separate play requirement. */
import {describe,it,expect} from 'vitest';
import {ALL_ITEMS} from '../../../data/items';
import {createMockGameState,createMockPlayerCharacter} from '../../../utils/core/factories';
import {GamePhase,type CastSpellPayload,type PlayerCharacter} from '../../../types';
import {characterReducer,instantiateItem} from '../../../state/reducers/characterReducer';
import {GENERATED_GLOSSARY_ITEMS} from '../../../data/items/generatedGlossaryItems';
import {daysOfWater} from '../../travel/provisioning';
import {inventoryWeight,provisionWeight} from '../../travel/provisionEncumbrance';
import {consumeProvision,GALLONS_PER_WATER_DAY} from '../../travel/containedWater';
import {spendPartyProvisions} from '../../travel/partyProvisions';
import {planRestMeals} from '../restMeals';
import {prepareContainedWaterCast,CONTAINED_WATER_SPELL_ID} from '../containedWaterCasting';
import spellData from '../../../../public/data/spells/level-1/create-or-destroy-water.json';

function fixture(){
 const base=createMockPlayerCharacter({id:'bram',name:'Bram',hp:9,maxHp:9});
 const caster={...base,spellSlots:{...base.spellSlots!,level_1:{current:2,max:2}},spellbook:{...base.spellbook,cantrips:[],knownSpells:[CONTAINED_WATER_SPELL_ID],preparedSpells:[CONTAINED_WATER_SPELL_ID]}} as PlayerCharacter;
 const vessel={...ALL_ITEMS.waterskin,quantity:1,acquiredAt:1234,isStolen:true};
 const state=createMockGameState({phase:GamePhase.PLAYING,party:[caster],companions:{},inventory:[{...ALL_ITEMS.rations,quantity:2},vessel],gold:17,gameTime:new Date('0351-01-04T12:56:27Z')});
 const payload:CastSpellPayload={characterId:caster.id,spellId:CONTAINED_WATER_SPELL_ID,spellLevel:1,outOfCombat:{targetCharacterId:caster.id,water:{mode:'create',inventoryIndex:1,sourceItem:vessel,castId:'cast-one'}}};
 return {state,vessel,payload};
}
describe('contained water through normal spell and provision transactions',()=>{
 it('retains declared capacity through normal unique-id item acquisition without changing other catalog fields',()=>{
  const {waterCapacityGallons,...catalogFields}=ALL_ITEMS.waterskin;
  expect(waterCapacityGallons).toBe(0.5);expect(catalogFields).toEqual(GENERATED_GLOSSARY_ITEMS.waterskin);
  const {state,payload}=fixture(),instance=instantiateItem(ALL_ITEMS.waterskin,1234);
  expect(instance.id).not.toBe('waterskin');state.inventory[1]=instance;
  const cast={...payload,outOfCombat:{...payload.outOfCombat!,water:{...payload.outOfCombat!.water!,sourceItem:instance}}};
  expect(characterReducer(state,{type:'CAST_SPELL',payload:cast}).inventory?.[1].containedWater?.gallons).toBe(0.5);
 });
 it('fills only one vessel from an owned stack and preserves the other units and every source attribute',()=>{
  const {state,payload,vessel}=fixture();vessel.quantity=3;
  const next={...state,...characterReducer(state,{type:'CAST_SPELL',payload})};
  expect(next.party[0].spellSlots?.level_1.current).toBe(1);
  expect(next.inventory[1]).toEqual({...vessel,quantity:2});
  expect(next.inventory[2]).toEqual({...vessel,quantity:1,containedWater:{gallons:0.5,lastCastId:'cast-one'}});
  expect(next.inventory.filter(i=>i.id==='waterskin').reduce((n,i)=>n+(i.quantity??1),0)).toBe(3);
  expect(daysOfWater(next.inventory)).toBe(0.25);
  expect(inventoryWeight(next.inventory)-inventoryWeight(state.inventory)).toBeCloseTo(4.17,8);
  expect(characterReducer(next,{type:'CAST_SPELL',payload})).toEqual({});
 });
 it('keeps the real spell volume/day conversion explicit instead of awarding the whole spell output into a skin',()=>{
  const water=spellData.effects[0].createdObjects?.find(o=>o.objectType==='water') as {count:number;inventoryQuantity:number};
  expect(water?.count).toBe(10);expect(water?.inventoryQuantity).toBe(5);
  expect(water!.count!/water!.inventoryQuantity!).toBe(GALLONS_PER_WATER_DAY);
  const {state,payload,vessel}=fixture(),before=structuredClone(state),result=prepareContainedWaterCast(state,payload);
  if('error'in result)throw Error(result.error);
  expect(result.gallons).toBe(0.5);expect(result.waterDays).toBe(0.25);
  const next={...state,...characterReducer(state,{type:'CAST_SPELL',payload})};
  expect(next.party[0].spellSlots?.level_1.current).toBe(1);
  expect(next.inventory).toHaveLength(2);expect(next.inventory[1]).toEqual({...vessel,containedWater:{gallons:0.5,lastCastId:'cast-one'}});
  expect(next.inventory[0]).toBe(state.inventory[0]);expect(daysOfWater(next.inventory)).toBe(0.25);
  expect(inventoryWeight(next.inventory)-inventoryWeight(state.inventory)).toBeCloseTo(4.17,8);
  expect(provisionWeight(next.inventory)-provisionWeight(state.inventory)).toBeCloseTo(4.17,8);
  expect(next.messages.at(-1)?.text).toContain('0.50 gallons');expect(next.messages.at(-1)?.timestamp).toEqual(state.gameTime);
  expect(next.gold).toBe(17);expect(state).toEqual(before);
 });
 it('refuses replay, a full vessel and a missing explicit choice without another cost or message',()=>{
  const {state,payload}=fixture(),next={...state,...characterReducer(state,{type:'CAST_SPELL',payload})};
  expect(characterReducer(next,{type:'CAST_SPELL',payload})).toEqual({});
  const fresh={...payload,outOfCombat:{...payload.outOfCombat!,water:{...payload.outOfCombat!.water!,sourceItem:next.inventory[1],castId:'cast-two'}}};
  expect(characterReducer(next,{type:'CAST_SPELL',payload:fresh})).toEqual({});
  expect(characterReducer(state,{type:'CAST_SPELL',payload:{...payload,outOfCombat:{targetCharacterId:'bram'}}})).toEqual({});
 });
 it.each(['unprepared','no-slot','downed','combat','invalid-stack','changed-source','unknown-capacity','unverified-legacy-capacity','malformed'] as const)('keeps every resource exact when %s',kind=>{
  const {state,payload,vessel}=fixture();
  if(kind==='unprepared')state.party[0].spellbook!.preparedSpells=[];
  if(kind==='no-slot')state.party[0].spellSlots!.level_1.current=0;
  if(kind==='downed')state.party[0].hp=0;
  if(kind==='combat')state.phase=GamePhase.COMBAT;
  if(kind==='invalid-stack')vessel.quantity=0.5;
  if(kind==='changed-source')state.inventory[1]={...vessel};
  if(kind==='unknown-capacity'){vessel.id='unknown-vessel';delete vessel.waterCapacityGallons;}
  if(kind==='unverified-legacy-capacity'){delete vessel.waterCapacityGallons;vessel.requiresAttunement=true;}
  if(kind==='malformed')Object.assign(vessel,{containedWater:{gallons:99}});
  const before=structuredClone(state);expect(characterReducer(state,{type:'CAST_SPELL',payload})).toEqual({});expect(state).toEqual(before);
 });
 it('drains real water while retaining the vessel across resource debit, travel, rest and serialization',()=>{
  const {state,payload}=fixture(),next={...state,...characterReducer(state,{type:'CAST_SPELL',payload})};
  const empty=consumeProvision(next.inventory,'water-day',0.25).inventory;
  expect(empty[1].containedWater?.gallons).toBe(0);expect(empty[1].id).toBe(next.inventory[1].id);
  expect(empty[1].acquiredAt).toBe(1234);expect(empty[1].isStolen).toBe(true);
  expect(characterReducer(next,{type:'REMOVE_ITEM',payload:{itemId:'water-day',count:0.25}}).inventory).toEqual(empty);
  expect(spendPartyProvisions(next,0,0.25)?.inventory).toEqual(empty);
  expect(planRestMeals(next).fedIds).toEqual([]);expect(planRestMeals(next).inventory).toBe(next.inventory);
  const sufficient={...next,inventory:[...next.inventory,{...ALL_ITEMS['water-day'],quantity:0.75}]};
  const meal=planRestMeals(sufficient);expect(meal.fedIds).toEqual(['bram']);expect(meal.inventory.find(i=>i.id==='waterskin')?.containedWater?.gallons).toBe(0);
  const restored=JSON.parse(JSON.stringify(next));restored.gameTime=new Date(restored.gameTime);
  expect(daysOfWater(restored.inventory)).toBe(0.25);
  expect(daysOfWater(restored.inventory.filter((i:{id:string})=>i.id!=='waterskin'))).toBe(0);
 });
 it('destroys only selected contained water and spends its own slot, without touching food or another water stack',()=>{
  const {state,payload}=fixture(),next={...state,...characterReducer(state,{type:'CAST_SPELL',payload})};
  next.inventory.push({...ALL_ITEMS['water-day'],quantity:3});
  const destroy={...payload,outOfCombat:{...payload.outOfCombat!,water:{...payload.outOfCombat!.water!,mode:'destroy' as const,sourceItem:next.inventory[1],castId:'destroy-one'}}};
  const patch=characterReducer(next,{type:'CAST_SPELL',payload:destroy});
  expect(patch.party?.[0].spellSlots?.level_1.current).toBe(0);expect(patch.inventory?.[1].containedWater?.gallons).toBe(0);
  expect(patch.inventory?.[0]).toBe(next.inventory[0]);expect(patch.inventory?.[2]).toBe(next.inventory[2]);
 });
});
