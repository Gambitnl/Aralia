/** Source-contract checks for the owner's CR3 Highwayman choice. They use the
 * real catalog and existing conversion/strike expansion, without starting a
 * game or claiming NPC targeting, Parry execution or a played outcome. */
import {beforeAll,describe,expect,it} from 'vitest';
import {generateGroundHostiles,declaredGroundHostileChallengeRating} from '../../../worldforge/bridge/groundHostiles';
import {ensureMonsterRegistryLoaded,getMonster} from '../../../../data/adapters/runtimeMonsterRegistry';
import {createEnemyFromMonster} from '../../../../utils/combat/createEnemyFromMonster';
import {expandMultiattackStrikes} from '../../../../utils/combat/multiattackUtils';
import {resolveSurfaceHostileTemplate} from '../surfaceHostileTemplate';

beforeAll(async()=>{await ensureMonsterRegistryLoaded();},60000);

describe('owner-approved CR3 Highwayman source profile',()=>{
  it('binds generated Highwaymen to the explicit existing CR3 martial profile',()=>{
    const bodies=Array.from({length:16},(_,i)=>generateGroundHostiles([
      {type:'brigands',icon:'test marker',x:200,y:200},
      {type:'brigands',icon:'test marker',x:350,y:350},
    ],undefined,i+1,0,0,500,500)).flat().filter(h=>h.name==='Highwayman');
    expect(bodies.length).toBeGreaterThan(0);
    for(const body of bodies){
      expect(body.monsterId).toBe('Warrior Veteran');
      expect(declaredGroundHostileChallengeRating(body)).toBe('3');
    }
  });

  it('continues refusing an older weaker Bandit reference after the source binding changes',async()=>{
    expect(declaredGroundHostileChallengeRating({name:'Highwayman',monsterId:'Bandit'})).toBe('3');
    expect(await resolveSurfaceHostileTemplate({id:'stale-world-body',name:'Highwayman',monsterId:'Bandit'}))
      .toEqual({status:'source-gap',detail:'Its source declares CR 3, but the Bandit template is CR 1/8.'});
  });

  it('retains the source name and full canonical defenses, health and abilities without scaling',async()=>{
    const source=getMonster('Warrior Veteran');
    expect(source).toMatchObject({id:'warrior_veteran',baseStats:{cr:'3',speed:30},maxHP:65,armorClass:17});
    const result=await resolveSurfaceHostileTemplate({id:'source-highwayman',name:'Highwayman',monsterId:'Warrior Veteran'});
    expect(result.status).toBe('ready');
    if(result.status!=='ready')throw Error(result.detail);
    expect(result.monster).toMatchObject({id:'warrior_veteran',name:'Highwayman',cr:'3',quantity:1});
    const actor=createEnemyFromMonster(result.monster,0);
    expect(actor).toMatchObject({name:'Highwayman 1',currentHP:65,maxHP:65,armorClass:17,baseAC:17,cr:'3'});
    expect(actor.stats).toEqual(source!.baseStats);
    expect(actor.abilities).toEqual(expect.arrayContaining(source!.abilities!));
    expect(actor.abilities.find(a=>a.id==='parry')).toMatchObject({name:'Parry',cost:{type:'reaction'}});
  });

  it('expands the authored two melee or ranged attacks with their own rolls, bonuses and damage',async()=>{
    const result=await resolveSurfaceHostileTemplate({id:'source-highwayman',name:'Highwayman',monsterId:'Warrior Veteran'});
    if(result.status!=='ready')throw Error(result.detail);
    const actor=createEnemyFromMonster(result.monster,0),ability=actor.abilities.find(a=>a.id==='multiattack')!;
    expect(ability.multiattackCount).toBe(2);
    const melee=expandMultiattackStrikes({attacker:actor,ability,targetIds:['target','target'],rng:()=>0.4});
    expect(melee.failure).toBeUndefined();expect(melee.strikes).toHaveLength(2);
    for(const strike of melee.strikes)expect(strike).toMatchObject({attackBonus:5,damageFormula:'2d6 + 3',damageType:'slashing',weaponType:'melee'});
    const ranged=expandMultiattackStrikes({attacker:actor,ability,targetIds:['target','target'],replacementByIndex:{0:'heavy_crossbow',1:'heavy_crossbow'},rng:()=>0.7});
    expect(ranged.failure).toBeUndefined();expect(ranged.strikes).toHaveLength(2);
    for(const strike of ranged.strikes)expect(strike).toMatchObject({attackBonus:3,damageFormula:'2d10 + 1',damageType:'piercing',weaponType:'ranged'});
  });
});
