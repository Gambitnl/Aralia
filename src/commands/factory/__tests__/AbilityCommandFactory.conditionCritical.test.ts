/**
 * GF-G59 exercises the production attack, damage and downed-hit boundary.
 * Fixed dice are disposable fixture inputs, never changes to a live encounter.
 * Conditions grant Advantage; a nearby hit becomes critical only after it hits.
 */
import { describe, expect, it, vi } from 'vitest';
import { AbilityCommandFactory } from '../AbilityCommandFactory';
import { CommandExecutor } from '../../base/CommandExecutor';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/core';
import { addUnconsciousCondition } from '@/utils/combat/deathSaveUtils';
import { INGESTED_MONSTERS } from '@/data/monsters.generated';
import type { Ability, BattleMapData, CombatCharacter } from '@/types/combat';
import { SpellCommandFactory } from '../SpellCommandFactory';
import fireBolt from '@/data/spells/level-0/fire-bolt.json';
import eldritchBlast from '@/data/spells/level-0/eldritch-blast.json';
import type { Spell } from '@/types/spells';
import * as diceRollers from '@/systems/dice/rollers';

const strike: Ability = {
  id: 'condition-strike', name: 'Condition Strike', description: 'Fixture attack',
  type: 'attack', attackBonus: 0, cost: { type: 'action' },
  targeting: 'single_enemy', range: 1,
  effects: [{ type: 'damage', dice: '1d6+2', damageType: 'piercing' }],
};

async function resolve(input: {
  condition?: string; distance?: number; face?: number; ac?: number;
  ability?: Ability; altitude?: number; size?: CombatCharacter['stats']['size'];
  casterConditions?: CombatCharacter['conditions']; liveCondition?: string;
} = {}) {
  const attacker = createMockCombatCharacter({
    id: 'attacker', team: 'player', position: {x: 2, y: 2},
    conditions: input.casterConditions ?? [],
    stats: {...createMockCombatCharacter().stats, size: input.size ?? 'Medium'},
  });
  const target = createMockCombatCharacter({
    id: 'target', name: 'Target', team: 'enemy', position: {x: 2+(input.distance ?? 1), y: 2},
    armorClass: input.ac ?? 10, baseAC: input.ac ?? 10, currentHP: 100, maxHP: 100,
    conditions: input.condition ? [{name: input.condition, duration: {type: 'rounds', value: 3}, appliedTurn: 1}] : [],
    ...(input.altitude ? {aerialMovement: {isFlying: true, canHover: true, altitudeFeet: input.altitude}} : {}),
  });
  let draws = 0;
  const commands = AbilityCommandFactory.createCommands(
    input.ability ?? strike, attacker, [target], createMockGameState(), undefined, undefined,
    {attackRollRng: () => {draws++; return ((input.face ?? 12)-0.5)/20;}, damageRng: () => 0},
  );
  const liveTarget = input.liveCondition
    ? {...target, conditions: [{name: input.liveCondition, duration: {type: 'rounds' as const, value: 3}, appliedTurn: 1}]} : target;
  const mapData: BattleMapData = {dimensions: {width: 12, height: 12}, tiles: new Map(), theme: 'forest', seed: 59};
  const result = await CommandExecutor.execute(commands, createMockCombatState({
    characters: [attacker, liveTarget], mapData, combatLog: [], activeLightSources: [],
  }));
  const attack = result.finalState.combatLog.find(entry => entry.data?.attackRoll !== undefined)!;
  return {result, attack, draws, target: result.finalState.characters.find(c=>c.id==='target')!};
}

describe('condition-derived attack criticals', () => {
  it.each(['Paralyzed', 'Unconscious'])('turns a non-natural-20 nearby hit on %s into one critical packet', async condition => {
    const {attack, target, draws} = await resolve({condition});
    expect(draws).toBe(2);
    expect(attack.data).toMatchObject({attackRoll: 12, isHit: true, isCritical: true,
      conditionCritical: {condition, distanceFeet: 5}});
    expect(attack.message).toContain(`Target ${condition}`);
    expect(attack.message).toContain('CRITICAL HIT!');
    // Only damage dice double: 2d6+2 at minimum is4, not6.
    expect(target.currentHP).toBe(96);
  });

  it.each(['Paralyzed', 'Unconscious'])('keeps Advantage against distant %s without granting a critical', async condition => {
    const {attack, target, draws} = await resolve({condition, distance: 2, ability: {...strike, range: 12}});
    expect(draws).toBe(2);
    expect(attack.data).toMatchObject({isHit: true, isCritical: false});
    expect(target.currentHP).toBe(97);
  });

  it.each([1, 12])('does not turn a miss at face%s into a critical hit', async face => {
    const {attack, target} = await resolve({condition: 'Paralyzed', face, ac: 25});
    expect(attack.data).toMatchObject({isHit: false, isCritical: false, isAutoMiss: face === 1});
    expect(target.currentHP).toBe(100);
  });

  it('uses the condition rule for a nearby ranged spell attack too', async () => {
    const {attack, target} = await resolve({condition: 'Paralyzed', ability: {...strike, attackType: 'spell', range: 24}});
    expect(attack.data).toMatchObject({isHit: true, isCritical: true});
    expect(target.currentHP).toBe(96);
  });

  it('honors occupied footprint distance rather than top-left square distance', async () => {
    const {attack} = await resolve({condition: 'Paralyzed', size: 'Large', distance: 2});
    expect(attack.data).toMatchObject({isCritical: true, conditionCritical: {distanceFeet: 5}});
  });

  it('does not grant a critical across ten feet of vertical separation', async () => {
    const {attack} = await resolve({condition: 'Paralyzed', altitude: 10});
    expect(attack.data).toMatchObject({isHit: true, isCritical: false});
  });

  it('lets outgoing Disadvantage cancel condition Advantage while retaining critical-on-hit', async () => {
    const {attack, draws} = await resolve({condition: 'Paralyzed', casterConditions: [{name: 'Prone', duration: {type: 'rounds', value: 2}, appliedTurn: 1}]});
    expect(draws).toBe(1);
    expect(attack.message).toContain('cancel out');
    expect(attack.data).toMatchObject({isHit: true, isCritical: true});
  });

  it('reads conditions from the live target at command execution', async () => {
    const {attack} = await resolve({liveCondition: 'Paralyzed'});
    expect(attack.data).toMatchObject({isCritical: true});
  });

  it.each(['Stunned', 'Prone', undefined])('does not promote nearby %s into a critical condition', async condition => {
    const {attack} = await resolve({condition});
    expect(attack.data).toMatchObject({isHit: true, isCritical: false});
  });

  it('settles one ordinary-face Ghoul Bite on a downed player as two failures, not one per damage type', async () => {
    const source = INGESTED_MONSTERS.ghoul;
    const ghoul = createMockCombatCharacter({id:'ghoul', name:source.name, team:'enemy',
      stats:source.baseStats, position:{x:2,y:2}});
    const target = addUnconsciousCondition(createMockCombatCharacter({id:'target', team:'player',
      position:{x:3,y:2}, currentHP:0, maxHP:10, armorClass:10}));
    const bite = source.abilities.find(a=>a.id==='bite')!;
    const commands = AbilityCommandFactory.createCommands(bite,ghoul,[target],createMockGameState(),undefined,undefined,
      {attackRollRng:()=>((12-0.5)/20), damageRng:()=>0});
    const {finalState}=await CommandExecutor.execute(commands,createMockCombatState({characters:[ghoul,target],combatLog:[]}));
    expect(finalState.characters.find(c=>c.id==='target')?.deathSaves?.failures).toBe(2);
    expect(finalState.combatLog.filter(entry=>entry.data?.damageEventBoundary==='post_hp')).toHaveLength(1);
    expect(finalState.combatLog.some(entry=>entry.message.includes('adds 2 failed death saves (critical hit)'))).toBe(true);
  });

  it('rechecks a target downed by the first authored Bite before the second Bite rolls', async () => {
    const source=INGESTED_MONSTERS.ghoul;
    const ghoul=createMockCombatCharacter({id:'ghoul',team:'enemy',stats:source.baseStats,position:{x:2,y:2},abilities:source.abilities});
    const target=createMockCombatCharacter({id:'target',team:'player',position:{x:3,y:2},currentHP:3,maxHP:10,armorClass:10});
    const multiattack=source.abilities.find(a=>a.id==='multiattack')!;
    const commands=AbilityCommandFactory.createCommands(multiattack,ghoul,[target],createMockGameState(),undefined,undefined,
      {attackRollRng:()=>((12-0.5)/20),damageRng:()=>0});
    const {finalState}=await CommandExecutor.execute(commands,createMockCombatState({characters:[ghoul,target],combatLog:[]}));
    const attacks=finalState.combatLog.filter(e=>e.data?.attackRoll!==undefined);
    expect(attacks.map(e=>e.data?.isCritical)).toEqual([false,true]);
    expect(finalState.characters.find(c=>c.id==='target')?.deathSaves?.failures).toBe(2);
    expect(finalState.combatLog.filter(e=>e.data?.damageEventBoundary==='post_hp')).toHaveLength(2);
  });
});

describe('dedicated spell-attack condition rule', () => {
  async function cast(input: {distance?: number; face?: number; ac?: number; spell?: Spell; level?: number;
    condition?: string; secondTarget?: boolean} = {}) {
    const caster = createMockCombatCharacter({id:'caster',team:'player',position:{x:2,y:2},level:input.level ?? 1,
      spellcastingAbility:'intelligence',stats:{...createMockCombatCharacter().stats,intelligence:16}});
    const target = createMockCombatCharacter({id:'target',name:'Target',team:'enemy',position:{x:2+(input.distance??1),y:2},
      currentHP:100,maxHP:100,armorClass:input.ac??10,
      conditions:[{name:input.condition??'Paralyzed',duration:{type:'rounds',value:3},appliedTurn:1}]});
    const second = {...target,id:'second',position:{x:5,y:2},conditions:[]};
    const targets = input.secondTarget ? [target,second] : [target];
    const roll = vi.spyOn(diceRollers,'rollD20').mockReturnValue(input.face??12);
    // Keep the real damage roller with a supported fixed RNG, so actual
    // critical dice reach the HP owner rather than a mocked damage result.
    const actualDamage = diceRollers.rollDamage;
    vi.spyOn(diceRollers,'rollDamage').mockImplementation((notation,critical,min=1)=>actualDamage(notation,critical,min,()=>0));
    try {
      const commands=await SpellCommandFactory.createCommands(input.spell??fireBolt as unknown as Spell,caster,targets,0,createMockGameState());
      const result=await CommandExecutor.execute(commands,createMockCombatState({characters:[caster,...targets],combatLog:[],activeLightSources:[]}));
      return {result, rolls:roll.mock.calls.map(call=>call[0]), attacks:result.finalState.combatLog.filter(e=>e.data?.attackType==='spell'&&e.data?.rollResult!==undefined)};
    } finally {vi.restoreAllMocks();}
  }

  it.each(['Paralyzed','Unconscious'])('makes a nearby Fire Bolt hit against %s critical with real doubled damage dice',async condition=>{
    const {result,attacks,rolls}=await cast({condition});
    expect(rolls[0]).toMatchObject({advantage:true,disadvantage:false});
    expect(attacks[0].data).toMatchObject({isHit:true,isCrit:true,conditionCritical:{condition,distanceFeet:5}});
    expect(attacks[0].message).toContain(`${condition}: hit within 5 ft is critical`);
    expect(result.finalState.characters.find(c=>c.id==='target')?.currentHP).toBe(98);
  });

  it('grants distant condition Advantage without promoting Fire Bolt damage',async()=>{
    const {result,attacks,rolls}=await cast({distance:2});
    expect(rolls[0]).toMatchObject({advantage:true});
    expect(attacks[0].data).toMatchObject({isHit:true,isCrit:false});
    expect(result.finalState.characters.find(c=>c.id==='target')?.currentHP).toBe(99);
  });

  it.each([1,12])('keeps a spell miss at face%s from becoming a critical',async face=>{
    const {result,attacks}=await cast({face,ac:40});
    expect(attacks[0].data).toMatchObject({isHit:false,isCrit:false});
    expect(result.finalState.characters.find(c=>c.id==='target')?.currentHP).toBe(100);
  });

  it('recomputes condition benefits for each Eldritch Blast target instead of leaking the first beam critical',async()=>{
    const {result,attacks}=await cast({spell:eldritchBlast as unknown as Spell,level:5,secondTarget:true});
    expect(attacks).toHaveLength(2);
    expect(attacks.map(e=>e.data?.isCrit)).toEqual([true,false]);
    expect(result.finalState.characters.find(c=>c.id==='target')?.currentHP).toBe(98);
    expect(result.finalState.characters.find(c=>c.id==='second')?.currentHP).toBe(99);
  });
});
