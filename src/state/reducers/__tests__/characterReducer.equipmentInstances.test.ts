/** Equipment must move one owned unit from the selected source, never a whole
 * stack or a different purchase. These fixtures reproduce Sana's preparation. */
import {describe,it,expect} from 'vitest';
import {characterReducer} from '../characterReducer';
import {createMockPlayerCharacter} from '../../../utils/core';
import {ItemType,type Item,type GameState} from '../../../types';

const dagger=(over:Partial<Item>={}):Item=>({id:'dagger',name:'Dagger',description:'An owned dagger.',type:ItemType.Weapon,
  slot:'MainHand',category:'Simple Melee',damageDice:'1d4',properties:['Finesse','Light','Thrown'],
  quantity:2,weight:1,sourceId:'starting-gear',...over});
const stateWith=(inventory:Item[]):GameState=>({party:[createMockPlayerCharacter({id:'sana',equippedItems:{}})],
  inventory,gold:20.69,characterSheetModal:{isOpen:false,character:null}} as GameState);

describe('equipment source units',()=>{
  it('equips one dagger and leaves its spare and unrelated earned coins untouched',()=>{
    const source=dagger(),coins={id:'gold_piece',name:'Gold Piece',type:ItemType.Treasure,quantity:8,sourceId:'cache:25'} as Item;
    const state=stateWith([source,coins]);
    const next=characterReducer(state,{type:'EQUIP_ITEM',payload:{characterId:'sana',itemId:'dagger',inventoryIndex:0,inventoryItem:source}});
    expect(next.party?.[0].equippedItems.MainHand).toEqual({...source,quantity:1});
    expect(next.inventory).toEqual([{...source,quantity:1},coins]);
    expect(next.inventory?.[1]).toBe(coins);
    expect(source.quantity).toBe(2);
    expect(state.party[0].equippedItems.MainHand).toBeUndefined();
  });
  it('uses the clicked same-ID purchase instead of the first dagger stack',()=>{
    const starter=dagger(),purchase=dagger({quantity:1,sourceId:'keeper:123',acquiredAt:1234,costInGp:2.22});
    const state=stateWith([starter,purchase]);
    const next=characterReducer(state,{type:'EQUIP_ITEM',payload:{characterId:'sana',itemId:'dagger',inventoryIndex:1,inventoryItem:purchase}});
    expect(next.party?.[0].equippedItems.MainHand).toBe(purchase);
    expect(next.inventory).toEqual([starter]);
  });
  it('rejects a stale receipt even when the new row has the same item ID',()=>{
    const old=dagger({acquiredAt:1}),replacement=dagger({acquiredAt:2});
    expect(characterReducer(stateWith([replacement]),{type:'EQUIP_ITEM',payload:{characterId:'sana',itemId:'dagger',inventoryIndex:0,inventoryItem:old}})).toEqual({});
  });
  it.each([0,-1,1.5,Number.NaN])('does not equip invalid source quantity %s',quantity=>{
    expect(characterReducer(stateWith([dagger({quantity})]),{type:'EQUIP_ITEM',payload:{characterId:'sana',itemId:'dagger'}})).toEqual({});
  });
  it('retains source units through equip, serialization and ordinary unequip',()=>{
    const source=dagger({acquiredAt:1234,sourceId:'original-source'}),state=stateWith([source]);
    const equipped={...state,...characterReducer(state,{type:'EQUIP_ITEM',payload:{characterId:'sana',itemId:'dagger'}})};
    const loaded=JSON.parse(JSON.stringify(equipped)) as GameState;
    const result=characterReducer(loaded,{type:'UNEQUIP_ITEM',payload:{characterId:'sana',slot:'MainHand'}});
    expect(result.party?.[0].equippedItems.MainHand).toBeUndefined();
    expect(result.inventory?.reduce((n,item)=>n+(item.quantity??1),0)).toBe(2);
    expect(result.inventory?.every(item=>item.acquiredAt===1234&&item.sourceId==='original-source')).toBe(true);
  });
});
