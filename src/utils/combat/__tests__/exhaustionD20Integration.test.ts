/** Earned travel exhaustion must affect the same ordinary rolls as combat. */
import {describe,it,expect} from 'vitest';
import {createMockPlayerCharacter,createMockCombatCharacter} from '../../core';
import {CLASSES_DATA} from '../../../data/classes';
import {createPlayerCombatCharacter} from '../combatUtils';
import {getExhaustionD20Penalty} from '../physicsUtils';
import {rollSavingThrow} from '../../character/savingThrowUtils';
import {rollAbilityCheck} from '../../character/checkUtils';
import {rollInitiativeTotal} from '../initiativeUtils';
import {resolveForcedMarch} from '../../../systems/travel/forcedMarch';
import {resolveDeathSavingThrow} from '../deathSaveUtils';
import {calculateAttackBonuses,calculateInitiativeModifier,calculateSpellSaveDC} from '../../character/partyStatUtils';

function mara(){return createMockPlayerCharacter({id:'mara',name:'Mara Stonebrook',class:CLASSES_DATA.cleric,
 level:1,speed:30,hp:11,maxHp:11,conditions:['exhaustion'],spellcastingAbility:'wisdom',equippedItems:{},
 finalAbilityScores:{Strength:13,Dexterity:12,Constitution:14,Intelligence:8,Wisdom:16,Charisma:10},
 savingThrowProficiencies:['Wisdom','Charisma'],skills:[],modifiers:{advantage:[],disadvantage:[],bonuses:[]}});}
const face10=()=>0.475;

describe('GG-212 earned exhaustion through ordinary roll owners',()=>{
 it('carries one persistent exhausted condition into combat without mutating the saved character',()=>{
  const pc=mara(),original=JSON.stringify(pc),actor=createPlayerCombatCharacter(pc);
  const statuses=actor.statusEffects.filter(e=>e.source==='Exhaustion');
  expect(statuses).toHaveLength(1);expect(statuses[0].persistsUntilRemoved).toBe(true);
  expect(actor.stats.speed).toBe(25);expect(getExhaustionD20Penalty(actor)).toBe(2);
  expect(JSON.stringify(pc)).toBe(original);
 });
 it('counts one highest level across structured condition mirrors instead of stacking duplicates',()=>{
  const actor=createMockCombatCharacter({statusEffects:[{id:'exhaustion',name:'exhaustion_2',type:'debuff',duration:0,persistsUntilRemoved:true}],
   conditions:[{name:'exhaustion_2',appliedTurn:0,duration:{type:'permanent'}}]});
  expect(getExhaustionD20Penalty(actor)).toBe(4);
  expect(getExhaustionD20Penalty({...mara(),conditions:[]})).toBe(0);
 });
 it('changes a Constitution save boundary and reports the exact penalty once',()=>{
  const actor=createPlayerCombatCharacter(mara()),original=JSON.stringify(actor);
  const result=rollSavingThrow(actor,'Constitution',11,undefined,undefined,undefined,{rng:face10});
  expect(result.roll).toBe(10);expect(result.total).toBe(10);expect(result.success).toBe(false);
  expect(result.modifiersApplied).toContainEqual({source:'Exhaustion',value:-2});
  expect(JSON.stringify(actor)).toBe(original);
 });
 it('preserves an authored monster save bonus before applying its real exhaustion',()=>{
  const actor=createMockCombatCharacter({stats:{saveBonuses:{con:7}},statusEffects:[{id:'e',name:'exhaustion_2',type:'debuff',duration:0,persistsUntilRemoved:true}]});
  const result=rollSavingThrow(actor,'Constitution',14,undefined,undefined,undefined,{rng:face10});
  expect(result.total).toBe(13);expect(result.success).toBe(false);
 });
 it('applies the same penalty to player and tactical ability checks',()=>{
  const pc=mara(),actor=createPlayerCombatCharacter(pc);
  for(const subject of [pc,actor]){const result=rollAbilityCheck(subject,'Wisdom',undefined,{rng:face10});
   expect(result.total).toBe(11);expect(result.modifiersApplied).toContainEqual({source:'Exhaustion',value:-2});}
 });
 it('keeps initiative and displayed attack bonuses consistent without changing spell DC',()=>{
  const pc=mara(),actor=createPlayerCombatCharacter(pc);
  expect(calculateInitiativeModifier(pc)).toBe(-1);expect(rollInitiativeTotal(actor,face10)).toBe(9);
  expect(calculateAttackBonuses(pc).spell?.bonus).toBe(3);expect(calculateAttackBonuses(pc).melee?.bonus).toBe(1);
  expect(calculateSpellSaveDC(pc)).toBe(13);
 });
 it('uses earned exhaustion in the next real forced-march saving throw',()=>{
  const result=resolveForcedMarch([mara()],13,()=>12);
  expect(result.results[0]).toMatchObject({roll:12,total:12,failed:true});
 });
 it('penalizes ordinary death saves while preserving natural one and twenty rules',()=>{
  const actor={...createPlayerCombatCharacter(mara()),currentHP:0,deathSaves:{successes:0,failures:0,isStable:false}};
  expect(resolveDeathSavingThrow(actor,10).outcome).toBe('failure');
  expect(resolveDeathSavingThrow(actor,10).character.deathSaves?.failures).toBe(1);
  expect(resolveDeathSavingThrow(actor,1).character.deathSaves?.failures).toBe(2);
  expect(resolveDeathSavingThrow(actor,20)).toMatchObject({outcome:'revived',character:{currentHP:1}});
 });
});

describe('GG-212 lifetime and unchanged healthy results',()=>{
 it('does not retain an expired mirrored condition as a roll penalty',()=>{
  const actor=createMockCombatCharacter({statusEffects:[{id:'e',name:'exhaustion_2',type:'debuff',duration:0}],
   conditions:[{name:'exhaustion_2',appliedTurn:0,duration:{type:'rounds',value:0}}]});
  expect(getExhaustionD20Penalty(actor)).toBe(0);
 });
 it('keeps Bless numeric composition and the exhaustion receipt distinct',()=>{
  const actor=createPlayerCombatCharacter(mara());
  const result=rollSavingThrow(actor,'Constitution',12,[{source:'Bless',dice:'1d4'}],undefined,undefined,{rng:face10});
  expect(result.total).toBe(12);expect(result.success).toBe(true);
  expect(result.modifiersApplied).toEqual([{source:'Exhaustion',value:-2},{source:'Bless',value:2}]);
 });
 it('leaves healthy rolls, spell attack and initiative at their prior values',()=>{
  const pc={...mara(),conditions:[]},actor=createPlayerCombatCharacter(pc);
  expect(rollSavingThrow(actor,'Constitution',12,undefined,undefined,undefined,{rng:face10})).toMatchObject({roll:10,total:12,success:true});
  expect(rollAbilityCheck(pc,'Wisdom',undefined,{rng:face10}).total).toBe(13);
  expect(rollInitiativeTotal(actor,face10)).toBe(11);expect(calculateAttackBonuses(pc).spell?.bonus).toBe(5);
  expect(resolveForcedMarch([pc],13,()=>12).results[0].total).toBe(14);
 });
});
