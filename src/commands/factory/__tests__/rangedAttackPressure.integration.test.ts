/** Native Bandit positions: the next ranged attack must honor nearby enemies and existing riders. */
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createMockCombatCharacter,createMockCombatState,createMockGameState} from '@/utils/core';
import {SpellCommandFactory} from '../SpellCommandFactory';
import {AbilityCommandFactory} from '../AbilityCommandFactory';
import * as dice from '@/systems/dice/rollers';
import guidingBolt from '@/data/spells/level-1/guiding-bolt.json';
import type {BattleMapTile,CombatCharacter,CombatState,Ability} from '@/types/combat';
import {evaluateCombatTurn} from '@/utils/combat/combatAI';
import {INGESTED_MONSTERS} from '@/data/monsters.generated';
import type {Spell} from '@/types/spells';
const source=JSON.stringify(guidingBolt);
afterEach(()=>{expect(JSON.stringify(guidingBolt)).toBe(source);vi.restoreAllMocks();});
function scene(adjacent=true){
 const caster=createMockCombatCharacter({id:'mara',name:'Mara',team:'player',position:{x:20,y:14},level:1,spellcastingAbility:'wisdom',stats:{wisdom:16}});
 const target=createMockCombatCharacter({id:'bandit',name:'Bandit',team:'enemy',position:adjacent?{x:19,y:15}:{x:19,y:17},armorClass:12,baseAC:12,currentHP:100,maxHP:100});
 const tiles=new Map<string,BattleMapTile>();for(let x=0;x<25;x++)for(let y=0;y<20;y++)tiles.set(x+'-'+y,{id:x+'-'+y,coordinates:{x,y},terrain:'grass',elevation:0,movementCost:1,blocksLoS:false,blocksMovement:false,decoration:null,effects:[]});
 return {caster,target,state:createMockCombatState({characters:[caster,target],combatLog:[],mapData:{dimensions:{width:25,height:20},tiles,theme:'forest',seed:817390039}})};
}
async function guide(caster:CombatCharacter,target:CombatCharacter,state:CombatState){const commands=await SpellCommandFactory.createCommands(guidingBolt as unknown as Spell,caster,[target],1,createMockGameState());let next=state;for(const c of commands)next=await c.execute(next);return next;}
describe('native ranged close-combat boundary',()=>{
 it('rolls the native adjacent Guiding Bolt with disadvantage and names why',async()=>{
  const s=scene(),roll=vi.spyOn(dice,'rollD20').mockImplementation(o=>o?.disadvantage?2:18);const next=await guide(s.caster,s.target,s.state);
  expect(roll).toHaveBeenCalledWith(expect.objectContaining({disadvantage:true}));
  expect(next.combatLog.find(e=>e.data?.attackType==='spell')?.message).toMatch(/Disadvantage.*nearby enemy/i);
  expect(next.characters.find(c=>c.id==='bandit')?.currentHP).toBe(100);
 });
 it('keeps the native withdrawn position clear until the Bandit actually approaches again',async()=>{
  const s=scene(false),roll=vi.spyOn(dice,'rollD20').mockReturnValue(18);await guide(s.caster,s.target,s.state);
  expect(roll.mock.calls[0][0]?.disadvantage).not.toBe(true);
 });
 it('applies and consumes a Guiding Bolt incoming rider on a spell miss',async()=>{
  const s=scene(false),roll=vi.spyOn(dice,'rollD20').mockReturnValue(1);
  s.target.activeEffects=[{id:'prior-guide',spellId:'guiding-bolt',casterId:'other-cleric',sourceName:'Guiding Bolt',type:'buff',duration:{type:'caster_turn_end',value:1},startTime:0,mechanics:{attackRollDirection:'incoming',attackRollModifier:'advantage',attackRollKind:'any',attackRollConsumption:'next_attack'}}];
  s.state.characters=[s.caster,s.target];const next=await guide(s.caster,s.target,s.state);
  expect(roll).toHaveBeenCalledWith(expect.objectContaining({advantage:true}));expect(next.characters.find(c=>c.id==='bandit')?.activeEffects?.some(e=>e.id==='prior-guide')).toBe(false);
  expect(next.characters.find(c=>c.id==='bandit')?.currentHP).toBe(100);
 });
 it('also penalizes a source-style ranged weapon without changing its printed bonus',async()=>{
  const s=scene(),roll=vi.spyOn(dice,'rollD20').mockReturnValue(2);
  const crossbow:Ability={id:'light_crossbow',name:'Light Crossbow',description:'Published source ranged weapon attack.',type:'attack',attackType:'weapon',attackBonus:3,cost:{type:'action'},targeting:'single_enemy',range:16,effects:[{type:'damage',dice:'1d8+1',damageType:'piercing'}]};
  const commands=AbilityCommandFactory.createCommands(crossbow,s.target,[s.caster],createMockGameState());let next=s.state;for(const c of commands)next=await c.execute(next);
  expect(roll).toHaveBeenCalledWith(expect.objectContaining({disadvantage:true}));expect(crossbow.attackBonus).toBe(3);expect(next.combatLog.some(e=>/nearby enemy/i.test(e.message))).toBe(true);
 });
});

it('cancels a real incoming mark against nearby pressure and spends it even on a miss',async()=>{
 const s=scene(),roll=vi.spyOn(dice,'rollD20').mockReturnValue(1);
 s.target.activeEffects=[{id:'prior-mark',spellId:'guiding-bolt',casterId:'other',sourceName:'Guiding Bolt',type:'buff',duration:{type:'caster_turn_end',value:1},startTime:0,mechanics:{attackRollDirection:'incoming',attackRollModifier:'advantage',attackRollKind:'any',attackRollConsumption:'next_attack'}}];s.state.characters=[s.caster,s.target];
 const next=await guide(s.caster,s.target,s.state);expect(roll).toHaveBeenCalledWith({advantage:false,disadvantage:false});expect(next.combatLog.find(e=>e.data?.attackType==='spell')?.message).toContain('Advantage and Disadvantage cancel out');expect(next.characters.find(c=>c.id==='bandit')?.activeEffects?.some(e=>e.id==='prior-mark')).toBe(false);
});
it('applies persistent numeric Bless-like roll bonuses without spending a weapon-only mark',async()=>{
 const s=scene(false);vi.spyOn(dice,'rollD20').mockReturnValue(10);
 s.caster.activeEffects=[{id:'bless-flat',spellId:'bless',casterId:'priest',sourceName:'Bless',type:'buff',duration:{type:'rounds',value:3},startTime:0,mechanics:{attackRollDirection:'outgoing',attackRollModifier:'bonus',attackRollKind:'any',attackRollValue:2,attackRollConsumption:'while_active'}},{id:'weapon-mark',spellId:'frostbite',casterId:'enemy',sourceName:'Frostbite',type:'debuff',duration:{type:'rounds',value:1},startTime:0,mechanics:{attackRollDirection:'outgoing',attackRollModifier:'disadvantage',attackRollKind:'weapon',attackRollConsumption:'next_attack'}}];s.state.characters=[s.caster,s.target];
 const next=await guide(s.caster,s.target,s.state);expect(next.combatLog.find(e=>e.data?.attackType==='spell')?.message).toContain('10 + 7 = 17');expect(next.characters.find(c=>c.id==='mara')?.activeEffects?.map(e=>e.id)).toEqual(['bless-flat','weapon-mark']);
});
it('lets the actual Bandit prefer its Scimitar while pressured and its crossbow at range',()=>{
 vi.spyOn(Math,'random').mockReturnValue(0.5);const s=scene(),source=INGESTED_MONSTERS.bandit,before=JSON.stringify(source);
 const enemy=createMockCombatCharacter({id:'native-bandit',name:'Bandit',team:'enemy',stats:source.baseStats,abilities:source.abilities,currentHP:11,maxHP:11,position:{x:19,y:15}});
 const near=evaluateCombatTurn(enemy,[enemy,s.caster],s.state.mapData!);expect(near.abilityId).toMatch(/scimitar/i);
 const far={...s.caster,position:{x:23,y:15}},ranged=evaluateCombatTurn(enemy,[enemy,far],s.state.mapData!);expect(ranged.abilityId).toMatch(/crossbow/i);expect(JSON.stringify(source)).toBe(before);
});
