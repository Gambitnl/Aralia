import { evaluateCombatTurn } from '@/utils/combat/combatAI';
import { repeatedMultiattackOptions } from '@/utils/combat/multiattackUtils';
import type { BattleMapData } from '@/types/combat';
/** Production coverage for the authored Ghoul encountered in the Tepecto Crypt. */
import { describe, expect, it } from 'vitest';
import { INGESTED_MONSTERS } from '@/data/monsters.generated';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/core';
import { AbilityCommandFactory } from '../AbilityCommandFactory';
import { CommandExecutor } from '../../base/CommandExecutor';
import type { Ability } from '@/types/combat';
import { consumeActionCost } from '@/utils/combat/actionEconomyUtils';
import { addUnconsciousCondition } from '@/utils/combat/deathSaveUtils';

async function attack(rolls: number[], chilled = false) {
  const source = INGESTED_MONSTERS.ghoul;
  const originalGhoul = createMockCombatCharacter({
    id: 'source-ghoul', name: source.name, team: 'enemy',
    stats: source.baseStats, abilities: source.abilities,
    position: { x: 2, y: 2 }, currentHP: 22, maxHP: 22,
    activeEffects: chilled ? [{
      id: 'frostbite', spellId: 'frostbite', casterId: 'target', sourceName: 'Frostbite',
      type: 'debuff', duration: { type: 'rounds', value: 2 }, startTime: 1,
      mechanics: { attackRollDirection: 'outgoing', attackRollModifier: 'disadvantage',
        attackRollKind: 'weapon', attackRollConsumption: 'next_attack' },
    }] : [],
  });
  const target = createMockCombatCharacter({
    id: 'target', name: 'Target', team: 'player',
    armorClass: 13, baseAC: 13, position: { x: 3, y: 2 },
    currentHP: 100, maxHP: 100,
  });
  const multiattack = source.abilities.find(ability => ability.id === 'multiattack') as Ability;
  // Match the production facade: pay the parent Action once before commands.
  const ghoul = consumeActionCost(originalGhoul, multiattack.cost);
  let draws = 0;
  const commands = AbilityCommandFactory.createCommands(
    multiattack, ghoul, [target], createMockGameState(), undefined, undefined,
    { attackRollRng: () => ((rolls[draws++] ?? 12) - 0.5) / 20, damageRng: () => 0 },
  );
  const result = await CommandExecutor.execute(commands, createMockCombatState({
    characters: [ghoul, target], combatLog: [], activeLightSources: [],
  }));
  return { result, draws, multiattack, ghoul, target };
}

describe('production authored repeat Multiattack', () => {
  it('rolls each source Ghoul Bite at its authored +4 rather than the aggregate +3', async () => {
    const { result, draws } = await attack([12, 12]);
    expect(result.success).toBe(true);
    const attacks = result.finalState.combatLog.filter(entry => entry.type === 'action');
    expect(attacks.map(entry => entry.message)).toEqual([
      expect.stringContaining('Rolled 12 + 4 = 16 vs AC 13'),
      expect.stringContaining('Rolled 12 + 4 = 16 vs AC 13'),
    ]);
    expect(draws).toBe(2);
    // Each Bite is 1d6+2 piercing plus 1d6 necrotic. Minimum dice give 4 per hit.
    expect(result.finalState.characters.find(character => character.id === 'target')?.currentHP).toBe(92);
  });

  it('keeps a missed Bite separate from a later hit without applying aggregate damage', async () => {
    const { result } = await attack([2, 12]);
    const attacks = result.finalState.combatLog.filter(entry => entry.type === 'action');
    expect(attacks).toHaveLength(2);
    expect(attacks[0].message).toContain('MISS');
    expect(attacks[1].message).toContain('HIT');
    expect(result.finalState.characters.find(character => character.id === 'target')?.currentHP).toBe(96);
  });

  it('consumes an outgoing next-attack rider only on the first Bite and preserves the single action payment', async () => {
    const { result, draws, ghoul } = await attack([12, 12, 12], true);
    const attacks = result.finalState.combatLog.filter(entry => entry.type === 'action');
    expect(attacks).toHaveLength(2);
    expect(attacks[0].message).toContain('(with Disadvantage)');
    expect(attacks[1].message).not.toContain('Disadvantage');
    expect(draws).toBe(3);
    const finalGhoul = result.finalState.characters.find(character => character.id === ghoul.id)!;
    expect(finalGhoul.activeEffects).toHaveLength(0);
    expect(finalGhoul.actionEconomy.action).toEqual(ghoul.actionEconomy.action);
    expect(finalGhoul.actionEconomy.action.used).toBe(true);
    expect(finalGhoul.actionEconomy.action.remaining).toBe(0);
    expect(ghoul.activeEffects).toHaveLength(1);
  });
});

async function biteAtHealth(hp: number, damageRng: () => number, downed = false) {
  const source = INGESTED_MONSTERS.ghoul;
  const ghoul = createMockCombatCharacter({
    id: 'source-ghoul', name: source.name, team: 'enemy', stats: source.baseStats,
    abilities: source.abilities, position: { x: 2, y: 2 },
  });
  const healthyTarget = createMockCombatCharacter({
    id: 'target', name: 'Target', team: 'player', armorClass: 13,
    position: { x: 3, y: 2 }, currentHP: hp, maxHP: 10,
  });
  const target = downed ? addUnconsciousCondition(healthyTarget) : healthyTarget;
  const bite = source.abilities.find(ability => ability.id === 'bite') as Ability;
  const commands = AbilityCommandFactory.createCommands(
    bite, ghoul, [target], createMockGameState(), undefined, undefined,
    // A natural20 isolates critical packet settlement from condition-derived
    // critical-hit support, which is a separate execution concern.
    { attackRollRng: () => ((downed ? 20 : 12) - 0.5) / 20, damageRng },
  );
  return CommandExecutor.execute(commands, createMockCombatState({
    characters: [ghoul, target], combatLog: [], activeLightSources: [],
  }));
}

describe('one authored Bite with two damage types', () => {
  it('downs once when piercing alone reaches zero, without treating necrotic as another hit', async () => {
    const { finalState } = await biteAtHealth(6, () => 0.999);
    const target = finalState.characters.find(character => character.id === 'target')!;
    expect(target.currentHP).toBe(0);
    expect(target.deathSaves?.failures).toBe(0);
    const receipts = finalState.combatLog.filter(entry => entry.data?.damageEventBoundary === 'post_hp');
    expect(receipts).toHaveLength(1);
    expect(receipts[0].data).toMatchObject({ finalDamage: 14, hitPointsBefore: 6, hitPointsAfter: 0 });
    expect(receipts[0].message).toContain('8 piercing + 6 necrotic');
    expect(finalState.combatLog.some(entry => entry.message.includes('falls unconscious at 0 HP'))).toBe(true);
  });

  it('checks massive damage against the complete hit rather than either component in isolation', async () => {
    const { finalState } = await biteAtHealth(3, () => 0.999);
    expect(finalState.characters.find(character => character.id === 'target')?.deathSaves?.failures).toBe(3);
    expect(finalState.combatLog.some(entry => entry.message.includes('11 damage remains') && entry.message.includes('maximum HP (10)'))).toBe(true);
  });

  it('adds only two failures for one critical hit on a downed player', async () => {
    const { finalState } = await biteAtHealth(0, () => 0, true);
    const target = finalState.characters.find(character => character.id === 'target')!;
    expect(target.deathSaves?.failures).toBe(2);
    expect(finalState.combatLog.some(entry => entry.message.includes('adds 2 failed death saves (critical hit)'))).toBe(true);
    expect(finalState.combatLog.filter(entry => entry.data?.damageEventBoundary === 'post_hp')).toHaveLength(1);
  });
});


// The owner's Highwayman uses this real CR3 profile. Exercise production commands,
// rather than the sandbox strike expander, at both authored weapon distances.
async function veteranAttack(distance: number, rolls = [12, 2], secondDistance?: number) {
  const source = INGESTED_MONSTERS.warrior_veteran;
  const multiattack = source.abilities.find(a => a.id === 'multiattack')!;
  const veteran = consumeActionCost(createMockCombatCharacter({
    id: 'veteran', team: 'enemy', name: 'Highwayman', stats: source.baseStats,
    abilities: source.abilities, position: {x:2,y:2}, currentHP:65, maxHP:65,
  }), multiattack.cost);
  const target = createMockCombatCharacter({
    id:'target',team:'player',name:'Target',armorClass:13,baseAC:13,
    position:{x:2+distance,y:2},currentHP:100,maxHP:100,
  });
  const targets=secondDistance===undefined?[target]:[target,{...target,id:'target-two',position:{x:2+secondDistance,y:2}}];
  let draws=0;
  const commands=AbilityCommandFactory.createCommands(multiattack,veteran,targets,createMockGameState(),undefined,undefined,
    {attackRollRng:()=>((rolls[draws++]??12)-0.5)/20,damageRng:()=>0});
  const result=await CommandExecutor.execute(commands,createMockCombatState({characters:[veteran,...targets],combatLog:[],activeLightSources:[]}));
  return {...result,draws,veteran};
}

describe('production authored alternative repeat',()=>{
  it('uses two independent Greatsword attacks in reach and spends one action',async()=>{
    const {success,finalState,draws}=await veteranAttack(1);
    expect(success).toBe(true);expect(draws).toBe(2);
    const attacks=finalState.combatLog.filter(e=>e.type==='action');
    expect(attacks).toHaveLength(2);
    expect(attacks[0].message).toContain('Rolled 12 + 5 = 17 vs AC 13');
    expect(attacks[1].message).toContain('MISS');
    expect(finalState.characters.find(c=>c.id==='target')?.currentHP).toBe(95);
    expect(finalState.characters.find(c=>c.id==='veteran')?.actionEconomy.action).toMatchObject({used:true,remaining:0});
    expect(finalState.combatLog.filter(e=>e.message.includes('Greatsword ('))).toHaveLength(2);
  });
  it('uses two independent Heavy Crossbow attacks beyond melee reach',async()=>{
    const {success,finalState,draws}=await veteranAttack(10);
    expect(success).toBe(true);expect(draws).toBe(2);
    const attacks=finalState.combatLog.filter(e=>e.type==='action');
    expect(attacks).toHaveLength(2);
    expect(attacks[0].message).toContain('Rolled 12 + 3 = 15 vs AC 13');
    expect(attacks[1].message).toContain('MISS');
    expect(finalState.characters.find(c=>c.id==='target')?.currentHP).toBe(97);
    expect(finalState.combatLog.filter(e=>e.message.includes('Heavy Crossbow ('))).toHaveLength(2);
  });
  it('refuses a target outside every authored reach without rolling or damaging it',async()=>{
    const {success,finalState,draws}=await veteranAttack(21);
    expect(success).toBe(false);expect(draws).toBe(0);
    expect(finalState.characters.find(c=>c.id==='target')?.currentHP).toBe(100);
  });
  it('refuses to apply a close weapon to a second target needing a different alternative',async()=>{
    const {success,finalState,draws}=await veteranAttack(1,[12,12],10);
    expect(success).toBe(false);expect(draws).toBe(0);
    expect(finalState.characters.filter(c=>c.team==='player').map(c=>c.currentHP)).toEqual([100,100]);
  });
});


async function parryAttack(roll: number, ranged=false, reactionSpent=false, incapacitated=false) {
  const source=INGESTED_MONSTERS.warrior_veteran;
  const raw=createMockCombatCharacter({id:'defender',name:'Highwayman',team:'enemy',stats:source.baseStats,
    abilities:source.abilities,armorClass:17,baseAC:17,currentHP:65,maxHP:65,position:{x:3,y:2}});
  const target={...raw,actionEconomy:{...raw.actionEconomy,reaction:{...raw.actionEconomy.reaction,used:reactionSpent}},
    conditions:incapacitated?[{name:'Incapacitated' as const,duration:{type:'rounds' as const,value:2},appliedTurn:0,source:'test'}]:[]};
  const attacker=createMockCombatCharacter({id:'attacker',team:'player',position:{x:2,y:2}});
  const attack:Ability={...source.abilities.find(a=>a.id===(ranged?'heavy_crossbow':'greatsword'))!,attackBonus:5};
  const commands=AbilityCommandFactory.createCommands(attack,attacker,[target],createMockGameState(),undefined,undefined,
    {attackRollRng:()=>(roll-0.5)/20,damageRng:()=>0});
  return CommandExecutor.execute(commands,createMockCombatState({characters:[attacker,target],combatLog:[],activeLightSources:[]}));
}

describe('authored NPC Parry in the production hit window',()=>{
  it('spends its reaction to turn an eligible melee hit into a miss without changing retained AC',async()=>{
    const {success,finalState}=await parryAttack(13);
    expect(success).toBe(true);
    const defender=finalState.characters.find(c=>c.id==='defender')!;
    expect(defender.currentHP).toBe(65);expect(defender.armorClass).toBe(17);
    expect(defender.actionEconomy.reaction.used).toBe(true);
    expect(finalState.combatLog.some(e=>e.message.includes('AC 17 + 2 = 19 against this attack; 18 misses'))).toBe(true);
  });
  it('cannot Parry a second hit after spending that reaction',async()=>{
    const first=await parryAttack(13);
    const attacker=first.finalState.characters.find(c=>c.id==='attacker')!;
    const defender=first.finalState.characters.find(c=>c.id==='defender')!;
    const attack=INGESTED_MONSTERS.warrior_veteran.abilities.find(a=>a.id==='greatsword')!;
    const commands=AbilityCommandFactory.createCommands(attack,attacker,[defender],createMockGameState(),undefined,undefined,
      {attackRollRng:()=>12.5/20,damageRng:()=>0});
    const second=await CommandExecutor.execute(commands,first.finalState);
    expect(second.finalState.characters.find(c=>c.id==='defender')?.currentHP).toBe(60);
    expect(second.finalState.combatLog.filter(e=>e.data?.abilityName==='Parry')).toHaveLength(1);
  });
  it.each([
    ['ranged attack',13,true,false,false],['already spent reaction',13,false,true,false],
    ['incapacitated defender',13,false,false,true],['unpreventable hit',17,false,false,false],
    ['natural twenty',20,false,false,false],
  ] as const)('does not grant Parry against %s',async(_label,roll,ranged,spent,incapacitated)=>{
    const {finalState}=await parryAttack(roll,ranged,spent,incapacitated);
    expect(finalState.characters.find(c=>c.id==='defender')!.currentHP).toBeLessThan(65);
    expect(finalState.combatLog.some(e=>e.data?.abilityName==='Parry')).toBe(false);
  });
});

describe('normal AI planning for the canonical choice Multiattack',()=>{
  it.each([1,10])('chooses the parent action at distance %s rather than a lone attack or proactive Parry',distance=>{
    const source=INGESTED_MONSTERS.warrior_veteran;
    const veteran=createMockCombatCharacter({id:'veteran',name:'Highwayman',team:'enemy',stats:source.baseStats,
      abilities:source.abilities,position:{x:2,y:2},currentHP:65,maxHP:65});
    const target=createMockCombatCharacter({id:'target',team:'player',currentHP:100,maxHP:100,position:{x:2+distance,y:2}});
    const tiles:BattleMapData['tiles']=new Map();
    for(let x=0;x<25;x++)for(let y=0;y<5;y++)tiles.set(x+'-'+y,{id:x+'-'+y,coordinates:{x,y},
      terrain:'floor',movementCost:1,blocksMovement:false,blocksLoS:false,elevation:0,decoration:null,effects:[]});
    const action=evaluateCombatTurn(veteran,[veteran,target],{dimensions:{width:25,height:5},tiles,theme:'forest',seed:1});
    expect(action).toMatchObject({type:'ability',abilityId:'multiattack',targetCharacterIds:['target'],cost:{type:'action'}});
  });
  it('does not infer free choice from a fixed mixed sequence',()=>{
    const source=INGESTED_MONSTERS.warrior_veteran;
    const actor=createMockCombatCharacter({abilities:source.abilities});
    const ability={...source.abilities.find(a=>a.id==='multiattack')!,description:'The warrior makes one Greatsword attack and one Heavy Crossbow attack.'};
    expect(repeatedMultiattackOptions(actor,ability)).toEqual([]);
  });
});
