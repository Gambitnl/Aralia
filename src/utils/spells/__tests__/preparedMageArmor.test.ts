/** Actual cast ownership, paid resources, derived AC and expiry must agree. */
import {describe, expect, it} from 'vitest';
import mageArmorData from '../../../../public/data/spells/level-1/mage-armor.json';
import type {Spell, Item} from '../../../types';
import {createMockPlayerCharacter, createMockCombatCharacter, createMockCombatState, createMockGameState} from '../../core/factories';
import {buildOutOfCombatStatusEffect, applyPostCastToCharacter} from '../outOfCombatCasting';
import {advanceWorldTimedEffects} from '../worldTimedEffects';
import {calculateArmorClass} from '../../character/statUtils';
import {createPlayerCombatCharacter} from '../../combat/combatUtils';
import {carryPreparedSpellEffects} from '../preparedCombatEffects';
import {characterReducer} from '../../../state/reducers/characterReducer';
import {AbilityCommandFactory} from '../../../commands/factory/AbilityCommandFactory';
import type {Ability} from '../../../types/combat';
import {isPreparedMageArmor} from '../preparedMageArmor';

const spell=mageArmorData as unknown as Spell;
const at=new Date('0351-01-01T07:03:12Z');
const make=()=>createMockPlayerCharacter({id:'neris', class:{id:'wizard',name:'Wizard'} as never,
  hp:10,maxHp:10,armorClass:11,equippedItems:{},activeEffects:[],
  abilityScores:{Strength:8,Dexterity:13,Constitution:14,Intelligence:16,Wisdom:12,Charisma:10},
  finalAbilityScores:{Strength:8,Dexterity:13,Constitution:14,Intelligence:16,Wisdom:12,Charisma:10},
  statusEffects:[buildOutOfCombatStatusEffect(spell,'neris',at,1)!],
  spellSlots:{level_1:{current:1,max:2}} as never});
const catalog={[spell.id]:spell};

describe('paid Mage Armor across exploration and combat',()=>{
  it('derives the retained real cast from canonical data without changing its record or slot',()=>{
    const pc=make(),before=structuredClone(pc);
    expect(calculateArmorClass(pc)).toBe(14);expect(pc).toEqual(before);
    const [loaded]=advanceWorldTimedEffects([pc],[],new Date(at.getTime()+9000));
    expect(loaded.armorClass).toBe(14);expect(loaded.spellSlots).toEqual(pc.spellSlots);
    expect(loaded.statusEffects[0].worldTime).toEqual(pc.statusEffects[0].worldTime);
    expect(loaded.statusEffects[0].duration).toBe(4799);
  });
  it.each(['name','identity','caster','clock','level','concentration'] as const)('does not promote an ambiguous %s marker',kind=>{
    const pc=make(),s=pc.statusEffects[0];
    if(kind==='name')s.name='Similar armor';if(kind==='identity')s.id='custom';
    if(kind==='caster')delete s.sourceCasterId;if(kind==='clock')delete s.worldTime;
    if(kind==='level')s.sourceCastLevel=0;if(kind==='concentration')s.requiresConcentration=true;
    expect(calculateArmorClass(pc)).toBe(11);
  });
  it('keeps the cast reducer and open-sheet snapshot consistent after one actual slot payment',()=>{
    const pc=make(),status=pc.statusEffects[0];pc.statusEffects=[];pc.spellSlots!.level_1!.current=2;
    const snapshot=applyPostCastToCharacter(pc,1,{statusEffect:status});
    const state=createMockGameState({party:[pc]});
    const spent=characterReducer(state,{type:'CAST_SPELL',payload:{characterId:pc.id,spellId:spell.id,spellLevel:1}});
    const applied=characterReducer({...state,...spent},{type:'APPLY_CHARACTER_STATUS_EFFECT',payload:{characterId:pc.id,statusEffect:status}});
    expect(snapshot.armorClass).toBe(14);expect(applied.party?.[0].armorClass).toBe(14);
    expect(applied.party?.[0].spellSlots?.level_1?.current).toBe(1);
    expect(snapshot.spellSlots?.level_1?.current).toBe(1);
  });
  it('expires at the original eight-hour boundary without healing or refund',()=>{
    const pc=make();pc.armorClass=14;
    const [expired]=advanceWorldTimedEffects([pc],[],new Date(at.getTime()+8*3600000));
    expect(expired.armorClass).toBe(11);expect(expired.statusEffects).toEqual([]);
    expect(expired.hp).toBe(10);expect(expired.spellSlots).toEqual(pc.spellSlots);
  });
  it('chooses the stronger unarmored calculation and adds a shield once',()=>{
    const pc=make();pc.class={id:'monk',name:'Monk'} as never;pc.finalAbilityScores.Wisdom=18;
    expect(calculateArmorClass(pc)).toBe(15);
    pc.class={id:'wizard',name:'Wizard'} as never;
    pc.equippedItems.OffHand={id:'shield',type:'armor',armorCategory:'Shield',armorClassBonus:2} as Item;
    expect(calculateArmorClass(pc)).toBe(16);
  });
  it('ends when body armor is donned so unequipping cannot revive it',()=>{
    const pc=make(),armor={id:'leather',name:'Leather',type:'armor',slot:'Torso',baseArmorClass:11,addsDexterityModifier:true} as Item;
    const state=createMockGameState({party:[pc],inventory:[armor]});
    const equipped=characterReducer(state,{type:'EQUIP_ITEM',payload:{characterId:pc.id,itemId:armor.id}});
    expect(equipped.party?.[0].statusEffects.some(isPreparedMageArmor)).toBe(false);
    const removed=characterReducer({...state,...equipped},{type:'UNEQUIP_ITEM',payload:{characterId:pc.id,slot:'Torso'}});
    expect(removed.party?.[0].armorClass).toBe(11);
  });
  it('carries a remaining defense into actual attack resolution without recasting',async()=>{
    const pc=make(),before=structuredClone(pc),actor=createPlayerCombatCharacter(pc,catalog);
    expect(actor.armorClass).toBe(14);expect(actor.baseAC).toBe(11);
    const [warded]=carryPreparedSpellEffects([actor],[pc],catalog,new Date(at.getTime()+12000));
    expect(warded.activeEffects).toEqual([expect.objectContaining({spellId:'mage-armor',duration:{type:'rounds',value:4798},mechanics:{baseAC:13,baseACFormula:'13 + dex_mod'}})]);
    expect(carryPreparedSpellEffects([warded],[pc],catalog,new Date(at.getTime()+12000))).toEqual([warded]);
    const attacker=createMockCombatCharacter({id:'enemy',position:{x:0,y:0}});
    const attack:Ability={id:'strike',name:'Strike',description:'',type:'attack',cost:{type:'action'},targeting:'single_enemy',range:1,attackBonus:4,effects:[{type:'damage',value:4,damageType:'piercing'}]};
    warded.position={x:1,y:0};
    const [command]=AbilityCommandFactory.createCommands(attack,attacker,[warded],createMockGameState(),undefined,undefined,{attackRollRng:()=>0.425,damageRng:()=>0});
    const result=await command.execute(createMockCombatState({characters:[attacker,warded]}));
    expect(result.characters.find(c=>c.id==='neris')?.currentHP).toBe(10);
    expect(pc).toEqual(before);
  });
});
