import {describe,expect,it} from 'vitest';
import {ALL_ITEMS} from '../../../data/items';
import {ADVENTURING_GEAR} from '../../../data/items/adventuringGear';
import {createMockGameState,createMockPlayerCharacter} from '../../../utils/core/factories';
import {GamePhase,type Item,type UseItemPayload} from '../../../types';
import {characterReducer} from '../../../state/reducers/characterReducer';
import {inventoryWeight} from '../../travel/provisionEncumbrance';
import {preparePartyMeal} from '../../travel/partyMeal';
import {prepareCarriedTorch} from '../../underdark/carriedItemLight';
import {adventuringPackOffer,prepareAdventuringPack} from '../adventuringPacks';
import {parseCost} from '../../../utils/economy/economyUtils';

function fixture(quantity=1){
  const pack:Item={...ADVENTURING_GEAR.explorers_pack,quantity,acquiredAt:1234,isStolen:true,containerId:'existing-bag'};
  const state=createMockGameState({phase:GamePhase.PLAYING,party:[createMockPlayerCharacter({id:'eldrin',hp:10,maxHp:10})],
    gold:12,gameTime:new Date('0351-01-01T07:04:03Z'),inventory:[
      {...ALL_ITEMS.torch,quantity:1,lightFuelMinutes:4,acquiredAt:999},pack,
      {...ALL_ITEMS.rations,quantity:5,acquiredAt:777},{...ALL_ITEMS['water-day'],quantity:5,acquiredAt:888}]});
  const request:UseItemPayload={itemId:pack.id,characterId:'eldrin',inventoryIndex:1,unpack:{sourceItem:pack,openingId:'first-opening'}};
  return {state,pack,request};
}

describe('explicit owned expedition-pack opening',()=>{
  it('makes the authored priest supplies usable while retaining every unpriced ritual component in the remaining kit',()=>{
    const {state,request}=fixture();
    const pack={...ADVENTURING_GEAR.priests_pack,quantity:1,acquiredAt:1234,isStolen:true,containerId:'existing-bag'};
    state.inventory[1]=pack;
    const offer=adventuringPackOffer(pack);
    expect(offer).not.toBeNull();
    expect(offer?.error).toBeUndefined();
    expect(offer?.contents.map(i=>[i.id,i.quantity])).toEqual([
      ['backpack',1],['tinderbox',1],['rations',2],['waterskin',1]]);
    const result=prepareAdventuringPack(state,{...request,itemId:pack.id,unpack:{sourceItem:pack,openingId:'priest-opening'}});
    if('error' in result)throw Error(result.error);
    const opened=result.patch.inventory!.filter(i=>i.unpackedFrom);
    expect(inventoryWeight(opened)).toBe(25);
    expect(opened.reduce((sum,item)=>sum+(item.costInGp??parseCost(item.cost))*(item.quantity??1),0)).toBeCloseTo(19,8);
    expect(opened[0].description).toMatch(/blanket, an alms box, 2 blocks of incense, a censer, and vestments/);
    expect(opened[0].name).toBe("Priest's Pack — retained kit");
    expect(opened[0].unpackedFrom?.sourceItem).toEqual({...pack,quantity:1});
    expect(opened.every(item=>item.acquiredAt===1234&&item.isStolen&&item.containerId==='existing-bag')).toBe(true);
    expect(opened.some(item=>item.id==='water-day')).toBe(false);
    expect(Object.keys(result.patch)).toEqual(['inventory']);
    expect(adventuringPackOffer(opened[0])).toBeNull();
    expect(prepareAdventuringPack({...state,...result.patch},{...request,itemId:pack.id,unpack:{sourceItem:pack,openingId:'priest-opening'}})).toHaveProperty('error');
  });

  it('keeps a custom priest kit sealed instead of overwriting its contents',()=>{
    const pack={...ADVENTURING_GEAR.priests_pack,description:'My personal ritual kit.'};
    expect(adventuringPackOffer(pack)?.error).toMatch(/special or unverified/);
  });

  it('fulfills the authored bundle once without counting its supplies twice or changing carrying mass',()=>{
    const {state,pack,request}=fixture(),original=structuredClone(state),offer=adventuringPackOffer(pack)!;
    expect(offer.error).toBeUndefined();
    expect(offer.contents.map(i=>[i.id,i.quantity])).toEqual([
      ['backpack',1],['bedroll',1],['mess_kit',1],['tinderbox',1],['torch',10],['rations',10],['waterskin',1],['rope',1]]);
    expect(inventoryWeight(offer.contents)).toBe(55);
    const patch=characterReducer(state,{type:'USE_ITEM',payload:request});
    expect(patch.inventory).toBeDefined();
    const inventory=patch.inventory!;
    expect(inventory.some(i=>i.id==='explorers_pack')).toBe(false);
    expect(inventoryWeight(inventory)).toBe(inventoryWeight(state.inventory));
    expect(inventory.filter(i=>i.id==='rations').reduce((n,i)=>n+(i.quantity??1),0)).toBe(15);
    expect(inventory.filter(i=>i.id==='water-day').reduce((n,i)=>n+(i.quantity??1),0)).toBe(5);
    expect(inventory[0]).toBe(state.inventory[0]);
    expect(inventory.find(i=>i.id==='rations'&&!i.unpackedFrom)).toBe(state.inventory[2]);
    expect(Object.keys(patch)).toEqual(['inventory']);
    expect(state).toEqual(original);
  });

  it('opens only one unit from a stack and rejects replay of its old source reference',()=>{
    const {state,pack,request}=fixture(2),patch=characterReducer(state,{type:'USE_ITEM',payload:request});
    const after={...state,...patch};
    expect(after.inventory[1]).toEqual({...pack,quantity:1});
    expect(after.inventory[1]).not.toBe(pack);
    expect(characterReducer(after,{type:'USE_ITEM',payload:request})).toEqual({});
    const next={...request,unpack:{sourceItem:after.inventory[1],openingId:'second-opening'}};
    const twice=characterReducer(after,{type:'USE_ITEM',payload:next}).inventory!;
    expect(twice.filter(i=>'isContainer' in i).map(i=>i.id)).toEqual([
      'backpack:unpacked:first-opening','backpack:unpacked:second-opening']);
    expect(twice.filter(i=>i.id==='rations').reduce((n,i)=>n+(i.quantity??1),0)).toBe(25);
    expect(inventoryWeight(twice)).toBe(inventoryWeight(state.inventory));
  });

  it('retains the original bundle, age, stolen status and outer container through serialization',()=>{
    const {state,pack,request}=fixture(2),result=prepareAdventuringPack(state,request);
    if('error' in result)throw Error(result.error);
    const contents=result.patch.inventory!.filter(i=>i.unpackedFrom);
    for(const item of contents){
      expect(item.acquiredAt).toBe(1234);expect(item.isStolen).toBe(true);expect(item.containerId).toBe('existing-bag');
      expect(item.unpackedFrom).toEqual({openingId:'first-opening',sourceItem:{...pack,quantity:1},gameTime:'0351-01-01T07:04:03.000Z'});
    }
    const restored=JSON.parse(JSON.stringify(contents)) as Item[];
    expect(restored).toEqual(contents.map(i=>JSON.parse(JSON.stringify(i))));
    expect(restored[0].unpackedFrom?.sourceItem.quantity).toBe(1);
    expect(restored.filter(i=>i.id==='waterskin')).toHaveLength(1);
    expect(restored.every(i=>i.slot!=='Ring')).toBe(true);
  });

  it('refuses a source shifted under a filtered quote instead of opening another identical pack',()=>{
    const {state,pack,request}=fixture();
    const shifted={...state,inventory:[pack,{...pack},...state.inventory.slice(2)]};
    expect(prepareAdventuringPack(shifted,request)).toHaveProperty('error');
    expect(shifted.inventory[0]).toBe(pack);
    expect(shifted.inventory[1]).not.toBe(pack);
  });

  it.each(['custom contents','quest-bearing','impossible weight'] as const)('keeps %s intact rather than replacing unfinished item intent',kind=>{
    const {state,pack,request}=fixture();
    const special={...pack,...(kind==='custom contents'?{description:'A sealed personal expedition kit.'}:
      kind==='quest-bearing'?{questHooks:{onUse:'source-quest'}}:{weight:1})};
    const altered={...state,inventory:[state.inventory[0],special,...state.inventory.slice(2)]};
    expect(prepareAdventuringPack(altered,{...request,unpack:{sourceItem:special,openingId:'special'}})).toHaveProperty('error');
    expect(altered.inventory[1]).toBe(special);
  });

  it.each(['combat','incapacitated'] as const)('refuses %s without opening anything',reason=>{
    const {state,request}=fixture();
    const blocked={...state,...(reason==='combat'?{phase:GamePhase.COMBAT}:{party:[{...state.party[0],hp:0}]})};
    expect(prepareAdventuringPack(blocked,request)).toHaveProperty('error');
    expect(blocked.inventory).toBe(state.inventory);
  });

  it('provides real ignition and edible portions through the existing systems without renewing the old torch',()=>{
    const {state,request}=fixture(),opened=prepareAdventuringPack(state,request);
    if('error' in opened)throw Error(opened.error);
    const after={...state,...opened.patch},torchIndex=after.inventory.findIndex(i=>i.id==='torch'&&i.unpackedFrom);
    const lit=prepareCarriedTorch(after,{itemId:'torch',characterId:'eldrin',inventoryIndex:torchIndex});
    if('error' in lit)throw Error(lit.error);
    expect(lit.patch.underdark!.activeLightSources[0].sourceItem?.unpackedFrom?.openingId).toBe('first-opening');
    expect(lit.patch.inventory![0].lightFuelMinutes).toBe(4);
    expect(lit.patch.inventory!.find(i=>i.id==='torch'&&i.unpackedFrom)?.quantity).toBe(9);
    const rationIndex=after.inventory.findIndex(i=>i.id==='rations'&&i.unpackedFrom),waterIndex=after.inventory.findIndex(i=>i.id==='water-day');
    const meal=preparePartyMeal(after,{rationIndex,rationItem:after.inventory[rationIndex],waterIndex,waterItem:after.inventory[waterIndex],partyIds:['eldrin']});
    if('error' in meal)throw Error(meal.error);
    expect(meal.patch.inventory!.find(i=>i.id==='rations'&&i.unpackedFrom)?.quantity).toBe(9);
    expect(meal.patch.inventory!.find(i=>i.id==='rations'&&!i.unpackedFrom)?.quantity).toBe(5);
    expect(meal.patch.inventory!.find(i=>i.id==='water-day')?.quantity).toBe(4);
    expect(meal.patch.party?.[0].hp??after.party[0].hp).toBe(10);
  });
});
