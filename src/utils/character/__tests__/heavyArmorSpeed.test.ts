/** Armor changes must honor the carried race's explicit rule without granting
 * exemptions by name or hiding the ordinary low-Strength tradeoff. */
import {describe,expect,it} from 'vitest';
import {calculateCharacterSpeed} from '../stats';
import {createMockPlayerCharacter} from '../../core';
import {MOUNTAIN_DWARF_DATA} from '../../../data/races/mountain_dwarf';
import {ALL_ITEMS} from '../../../data/items';
import {characterReducer} from '../../../state/reducers/characterReducer';
import type {GameState,PlayerCharacter,Race} from '../../../types';

const human:Race={id:'human',name:'Human',description:'',traits:['Speed: 30 feet']};
const equipped=(race:Race=MOUNTAIN_DWARF_DATA,strength=12):PlayerCharacter=>createMockPlayerCharacter({
  id:'armor-fit-review',race,feats:[],speed:30,
  finalAbilityScores:{Strength:strength,Dexterity:13,Constitution:10,Intelligence:10,Wisdom:10,Charisma:10},
  equippedItems:{Torso:{...ALL_ITEMS.chain_mail}},
});

describe('authored heavy-armor speed exceptions',()=>{
  it('keeps the actual Mountain Dwarf speed with Strength below Chain Mail requirement',()=>{
    expect(calculateCharacterSpeed(equipped())).toBe(30);
  });
  it('preserves the normal ten-foot penalty without an explicit exception',()=>{
    expect(calculateCharacterSpeed(equipped(human))).toBe(20);
  });
  it('does not infer an exception from a race name or a difficult-terrain rule',()=>{
    const namedDwarf={...human,id:'unverified-dwarf',name:'Mountain Dwarf',traits:['Speed: 30 feet','Your speed is not reduced by difficult terrain.']};
    expect(calculateCharacterSpeed(equipped(namedDwarf))).toBe(20);
  });
  it('preserves full movement when the ordinary Strength requirement is met',()=>{
    expect(calculateCharacterSpeed(equipped(human,13))).toBe(30);
  });
  it('keeps the exception through the ordinary equipment reducer, without changing the owned armor',()=>{
    const armor={...ALL_ITEMS.chain_mail,quantity:1,acquiredAt:1234,sourceId:'earned:smithy'};
    const member=equipped();member.equippedItems={};
    const state={party:[member],inventory:[armor],gold:7.75,characterSheetModal:{isOpen:false,character:null}} as GameState;
    const patch=characterReducer(state,{type:'EQUIP_ITEM',payload:{characterId:member.id,itemId:armor.id,inventoryIndex:0,inventoryItem:armor}});
    expect(patch.party?.[0].speed).toBe(30);
    expect(patch.party?.[0].equippedItems.Torso).toBe(armor);
    expect(patch.inventory).toEqual([]);
    expect(patch.gold).toBeUndefined();
    expect(state.inventory).toEqual([armor]);
  });
});
