/** Nearby pressure follows real footprints, conditions, perception and feature scope. */
import {describe,it,expect} from 'vitest';
import {createMockCombatCharacter,createMockCombatState} from '@/utils/core';
import {rangedAttackPressure,isRangedAttackAbility,hasCrossbowCloseCombatException} from '../rangedAttackPressure';
import fireBolt from '@/data/spells/level-0/fire-bolt.json';
import type {Ability,BattleMapTile,CombatCharacter} from '@/types/combat';
function fixture(){
 const actor=createMockCombatCharacter({id:'mara',team:'player',position:{x:2,y:2}}),enemy=createMockCombatCharacter({id:'bandit',team:'enemy',position:{x:1,y:3}});
 const tiles=new Map<string,BattleMapTile>();for(let x=0;x<7;x++)for(let y=0;y<7;y++)tiles.set(x+'-'+y,{id:x+'-'+y,coordinates:{x,y},terrain:'grass',elevation:0,movementCost:1,blocksLoS:false,blocksMovement:false,decoration:null,effects:[]});
 const state=createMockCombatState({characters:[actor,enemy],mapData:{dimensions:{width:7,height:7},tiles,theme:'forest',seed:1}});
 return {actor,enemy,state};
}
const condition=(name:string)=>({name,duration:{type:'rounds' as const,value:1},source:'fixture',appliedTurn:0});
describe('nearby ranged pressure',()=>{
 it('uses diagonal footprint adjacency even after the enemy spends its reaction',()=>{const s=fixture();s.enemy.actionEconomy.reaction={used:true,remaining:0};expect(rangedAttackPressure(s.state,s.actor)).toBe(true);});
 it('does not use an extended weapon reach as the five-foot boundary',()=>{const s=fixture();s.enemy.position={x:0,y:2};expect(rangedAttackPressure(s.state,s.actor)).toBe(false);});
 it.each(['friendly','dead','incapacitated','blinded'])('excludes a %s observer',kind=>{const s=fixture();if(kind==='friendly')s.enemy.team='player';if(kind==='dead')s.enemy.currentHP=0;if(kind==='incapacitated')s.enemy.conditions=[condition('Stunned')];if(kind==='blinded')s.enemy.conditions=[condition('Blinded')];expect(rangedAttackPressure(s.state,s.actor)).toBe(false);});
 it('keeps blindsight useful while a nearby observer is blinded',()=>{const s=fixture();s.enemy.conditions=[condition('Blinded')];s.enemy.stats.senses={darkvision:0,blindsight:10,tremorsense:0,truesight:0};expect(rangedAttackPressure(s.state,s.actor)).toBe(true);});
 it('does not let truesight cure blindness',()=>{const s=fixture();s.enemy.conditions=[condition('Blinded')];s.enemy.stats.senses={darkvision:0,blindsight:0,tremorsense:0,truesight:30};expect(rangedAttackPressure(s.state,s.actor)).toBe(false);});
 it('requires an appropriate sense to see an invisible attacker',()=>{const s=fixture();s.actor.conditions=[condition('Invisible')];expect(rangedAttackPressure(s.state,s.actor)).toBe(false);s.enemy.stats.senses={darkvision:0,blindsight:0,tremorsense:0,truesight:30};expect(rangedAttackPressure(s.state,s.actor)).toBe(true);});
 it('respects observer-relative Hidden detection and legacy Hidden records',()=>{const s=fixture();s.actor.statusEffects=[{id:'hidden',name:'Hidden',type:'buff',duration:1}];expect(rangedAttackPressure(s.state,s.actor)).toBe(false);});
 it('respects the real dark board and darkvision',()=>{const s=fixture();s.state.mapData!.theme='dungeon';expect(rangedAttackPressure(s.state,s.actor)).toBe(false);s.enemy.stats.senses={darkvision:60,blindsight:0,tremorsense:0,truesight:0};expect(rangedAttackPressure(s.state,s.actor)).toBe(true);});
 it('retains opaque terrain and a distant flying altitude',()=>{const s=fixture();s.state.mapData!.tiles.get('2-2')!.blocksLoS=true;expect(rangedAttackPressure(s.state,s.actor)).toBe(false);s.state.mapData!.tiles.get('2-2')!.blocksLoS=false;s.enemy.aerialMovement={isFlying:true,altitudeFeet:20} as CombatCharacter['aerialMovement'];expect(rangedAttackPressure(s.state,s.actor)).toBe(false);});
 it('uses the nearest square of a Large creature',()=>{const s=fixture();s.enemy.position={x:0,y:2};s.enemy.stats.size='Large';expect(rangedAttackPressure(s.state,s.actor)).toBe(true);});
 it('scopes Crossbow Expert to crossbows in the current 2024 campaign',()=>{const s=fixture();s.actor.feats=['crossbow_expert'];const bow={id:'bow',name:'Longbow',type:'attack',range:30} as Ability,crossbow={...bow,name:'Light Crossbow'};expect(hasCrossbowCloseCombatException(s.actor,crossbow)).toBe(true);expect(hasCrossbowCloseCombatException(s.actor,bow)).toBe(false);expect(hasCrossbowCloseCombatException(s.actor)).toBe(false);});
 it('does not mistake a save spell or reach weapon for a ranged attack',()=>{expect(isRangedAttackAbility({type:'spell',range:12,spell:{id:'sacred-flame',attackType:''}} as Ability)).toBe(false);expect(isRangedAttackAbility({type:'spell',range:24,spell:{id:'guiding-bolt',attackType:''}} as Ability)).toBe(true);expect(isRangedAttackAbility({type:'attack',range:2,weapon:{id:'glaive',name:'Glaive',category:'martial_melee',properties:['Reach']}} as Ability)).toBe(false);});
});

it('matches the existing source Fire Bolt object-hit bridge and modern observer detection',()=>{
 expect(isRangedAttackAbility({type:'spell',range:24,spell:fireBolt} as Ability)).toBe(true);
 const s=fixture();s.actor.statusEffects=[{id:'owned-hidden',name:'Hidden',type:'buff',duration:1,stealth:{ownerId:'hide-source',stealthDc:15,detectedBy:[],breaksOnAttack:true}}];
 expect(rangedAttackPressure(s.state,s.actor)).toBe(false);
 s.actor.statusEffects[0].stealth!.detectedBy=['bandit'];expect(rangedAttackPressure(s.state,s.actor)).toBe(true);
});

it('uses the existing elevation-aware range instead of adjacency alone',()=>{
 const s=fixture();expect(rangedAttackPressure(s.state,s.actor)).toBe(true);
 s.state.mapData!.tiles.get('1-3')!.elevation=1;
 expect(rangedAttackPressure(s.state,s.actor)).toBe(false);
});
