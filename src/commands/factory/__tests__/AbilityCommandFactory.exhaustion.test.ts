/** Source attack math stays intact; an actual condition changes each D20 total once. */
import {describe,it,expect,vi,afterEach} from 'vitest';
import {INGESTED_MONSTERS} from '@/data/monsters.generated';
import {createMockCombatCharacter,createMockCombatState,createMockGameState} from '@/utils/core';
import {AbilityCommandFactory} from '../AbilityCommandFactory';
import {SpellCommandFactory} from '../SpellCommandFactory';
import {CommandExecutor} from '../../base/CommandExecutor';
import {consumeActionCost} from '@/utils/combat/actionEconomyUtils';
import {advanceCasterTurnEndAttackRiders} from '../../effects/AttackRollModifierCommand';
import * as dice from '@/systems/dice/rollers';
import guidingBolt from '@/data/spells/level-1/guiding-bolt.json';
import type {Spell} from '@/types/spells';
import type {CombatState} from '@/types/combat';
const canonicalGuidingBoltPacket=JSON.stringify(guidingBolt);
afterEach(()=>{expect(JSON.stringify(guidingBolt)).toBe(canonicalGuidingBoltPacket);vi.restoreAllMocks();});
const exhaustion={id:'earned-exhaustion',name:'exhaustion',type:'debuff' as const,duration:0,persistsUntilRemoved:true,source:'Exhaustion'};

async function veteran(distance:number,rolls:number[]){
 const source=INGESTED_MONSTERS.warrior_veteran,sourceBefore=JSON.stringify(source);
 const multiattack=source.abilities.find(a=>a.id==='multiattack')!;
 const actor=consumeActionCost(createMockCombatCharacter({id:'veteran',name:'Highwayman',team:'enemy',
  stats:source.baseStats,cr:'3',armorClass:17,baseAC:17,currentHP:65,maxHP:65,abilities:source.abilities,
  position:{x:2,y:2},statusEffects:[exhaustion]}),multiattack.cost);
 const target=createMockCombatCharacter({id:'target',name:'Target',team:'player',position:{x:2+distance,y:2},armorClass:14,baseAC:14,currentHP:100,maxHP:100});
 let draws=0;
 const commands=AbilityCommandFactory.createCommands(multiattack,actor,[target],createMockGameState(),undefined,undefined,
  {attackRollRng:()=>((rolls[draws++]??10)-0.5)/20,damageRng:()=>0});
 const result=await CommandExecutor.execute(commands,createMockCombatState({characters:[actor,target],combatLog:[],activeLightSources:[]}));
 expect(JSON.stringify(source)).toBe(sourceBefore);
 return {...result,draws,actor};
}
describe('GG-212 production attack consumers',()=>{
 it('subtracts one exhaustion penalty from each authored Greatsword leaf and retains one Action',async()=>{
  const result=await veteran(1,[10,10]);expect(result.success).toBe(true);expect(result.draws).toBe(2);
  const attacks=result.finalState.combatLog.filter(e=>e.type==='action');expect(attacks).toHaveLength(2);
  for(const entry of attacks){expect(entry.message).toContain('Exhaustion -2');expect(entry.message).toContain('+ 3 = 13 vs AC 14');expect(entry.message).toContain('MISS');}
  expect(result.finalState.characters.find(c=>c.id==='target')?.currentHP).toBe(100);
  expect(result.finalState.characters.find(c=>c.id==='veteran')?.actionEconomy.action).toMatchObject({used:true,remaining:0});
  expect(result.actor).toMatchObject({currentHP:65,maxHP:65,armorClass:17,cr:'3'});
 });
 it('keeps the Heavy Crossbow source bonus distinct from its exhaustion penalty',async()=>{
  const result=await veteran(10,[12,12]);const attacks=result.finalState.combatLog.filter(e=>e.type==='action');
  for(const entry of attacks){expect(entry.message).toContain('+ 1 = 13 vs AC 14');expect(entry.message).toContain('MISS');}
  expect(result.finalState.characters.find(c=>c.id==='target')?.currentHP).toBe(100);
 });
 it('retains natural one and twenty and the source damage formula',async()=>{
  const result=await veteran(1,[1,20]),attacks=result.finalState.combatLog.filter(e=>e.type==='action');
  expect(attacks[0].message).toContain('MISS');expect(attacks[1].message).toContain('CRITICAL HIT');
  expect(result.finalState.characters.find(c=>c.id==='target')?.currentHP).toBe(93);
 });
 it('uses the canonical Guiding Bolt attack owner and skips hit effects on a penalty-caused miss',async()=>{
  vi.spyOn(dice,'rollD20').mockReturnValue(10);
  const caster=createMockCombatCharacter({id:'cleric',name:'Mara',spellcastingAbility:'wisdom',level:1,stats:{wisdom:16},statusEffects:[exhaustion]});
  const target=createMockCombatCharacter({id:'target',name:'Target',team:'enemy',armorClass:14,baseAC:14,currentHP:100,maxHP:100});
  const commands=await SpellCommandFactory.createCommands(guidingBolt as unknown as Spell,caster,[target],1,createMockGameState());
  let state=createMockCombatState({characters:[caster,target],combatLog:[],activeLightSources:[]});
  for(const command of commands)state=await command.execute(state);
  const attack=state.combatLog.find(e=>e.data?.attackType==='spell');
  expect(attack?.message).toContain('10 + 3 = 13');expect(attack?.message).toContain('Exhaustion -2');
  expect(attack?.data?.isHit).toBe(false);expect(state.characters.find(c=>c.id==='target')?.currentHP).toBe(100);
 });
});

it('retains a healthy Guiding Bolt hit and its source next-attack advantage rider',async()=>{
 vi.spyOn(dice,'rollD20').mockReturnValue(10);
 const caster=createMockCombatCharacter({id:'cleric',name:'Mara',spellcastingAbility:'wisdom',level:1,stats:{wisdom:16},statusEffects:[]});
 const target=createMockCombatCharacter({id:'target',name:'Target',team:'enemy',armorClass:14,baseAC:14,currentHP:100,maxHP:100});
 const commands=await SpellCommandFactory.createCommands(guidingBolt as unknown as Spell,caster,[target],1,createMockGameState());
 let state=createMockCombatState({characters:[caster,target],combatLog:[],activeLightSources:[]});
 for(const command of commands)state=await command.execute(state);
 const attack=state.combatLog.find(e=>e.data?.attackType==='spell');
 expect(attack?.message).toContain('10 + 5 = 15');expect(attack?.data?.isHit).toBe(true);
 const after=state.characters.find(c=>c.id==='target')!;expect(after.currentHP).toBeLessThan(100);
 expect(after.activeEffects?.filter(e=>e.spellId==='guiding-bolt'&&e.mechanics?.attackRollDirection==='incoming')).toHaveLength(1);
});

async function castGuide(currentId='cleric'){
 vi.spyOn(dice,'rollD20').mockReturnValue(10);
 const caster=createMockCombatCharacter({id:'cleric',name:'Mara',spellcastingAbility:'wisdom',level:1,stats:{wisdom:16}});
 const target=createMockCombatCharacter({id:'guide-target',name:'Target',team:'enemy',position:{x:11,y:1},armorClass:14,baseAC:14,currentHP:100,maxHP:100});
 const commands=await SpellCommandFactory.createCommands(guidingBolt as unknown as Spell,caster,[target],1,createMockGameState());
 const base=createMockCombatState({characters:[caster,target],combatLog:[],activeLightSources:[]});
 let state:CombatState={...base,turnState:{...base.turnState,currentCharacterId:currentId}};
 for(const command of commands)state=await command.execute(state);
 return {state,caster,target:state.characters.find(c=>c.id===target.id)!};
}
it('uses two caster ends for an on-turn Guiding Bolt and one for an off-turn cast',async()=>{
 const own=await castGuide();expect(own.target.activeEffects?.[0].duration).toEqual({type:'caster_turn_end',value:2});
 const reaction=await castGuide('other-actor');expect(reaction.target.activeEffects?.[0].duration).toEqual({type:'caster_turn_end',value:1});
 expect(advanceCasterTurnEndAttackRiders(reaction.target,reaction.caster.id).character.activeEffects).toHaveLength(0);
});
it('consumes Guiding Bolt advantage on the next matching attack even when that attack misses',async()=>{
 const cast=await castGuide(),target=advanceCasterTurnEndAttackRiders(cast.target,cast.caster.id).character;
 const source=INGESTED_MONSTERS.warrior_veteran,ability=source.abilities.find(a=>a.id==='heavy_crossbow')!;
 const ally=consumeActionCost(createMockCombatCharacter({id:'ally',team:'player',name:'Ally',position:{x:1,y:1},stats:source.baseStats,abilities:source.abilities}),ability.cost);
 const state={...cast.state,characters:[cast.caster,ally,target],turnState:{...cast.state.turnState,currentCharacterId:ally.id}};
 const commands=AbilityCommandFactory.createCommands(ability,ally,[target],createMockGameState(),undefined,undefined,{attackRollRng:()=>0.475,damageRng:()=>0});
 const result=await CommandExecutor.execute(commands,state);expect(result.success).toBe(true);
 const attack=result.finalState.combatLog.filter(e=>e.type==='action').at(-1);expect(attack?.message).toContain('with Advantage');expect(attack?.message).toContain('MISS');
 const after=result.finalState.characters.find(c=>c.id===target.id)!;expect(after.currentHP).toBe(target.currentHP);
 expect(after.activeEffects?.filter(e=>e.spellId==='guiding-bolt')).toHaveLength(0);
});
