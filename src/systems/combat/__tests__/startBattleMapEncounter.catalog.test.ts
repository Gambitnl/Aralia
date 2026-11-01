import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {CombatCharacter} from '../../../types/combat';

// The first test uses the real lazy catalog and enemy converter. It verifies
// the dispatched actor, rather than mocking a successful readiness call.
beforeEach(()=>vi.resetModules());
describe('encounter start catalog readiness',()=>{
  it('constructs a real Bandit after an earlier cold lookup, instead of a generic fallback',async()=>{
    const registry=await import('../../../data/adapters/runtimeMonsterRegistry');
    expect(registry.getMonster('Bandit')).toBeUndefined();
    const {handleStartBattleMapEncounter}=await import('../startBattleMapEncounter');
    const dispatch=vi.fn();
    await handleStartBattleMapEncounter(dispatch,{
      monsters:[{id:'bandit',name:'Bandit',quantity:1,cr:'1/8',description:'Existing source creature'}],
    });
    await registry.ensureMonsterRegistryLoaded();
    const source=registry.getMonster('Bandit');
    expect(source).toBeDefined();
    const actor=dispatch.mock.calls[0][0].payload.startBattleMapEncounterData.combatants[0];
    expect(actor.maxHP).toBe(source!.maxHP);
    expect(actor.armorClass).toBe(source!.armorClass);
    expect(actor.abilities.map((ability:{id:string})=>ability.id)).toEqual(expect.arrayContaining(source!.abilities.map(ability=>ability.id)));
    expect(actor.abilities.some((ability:{id:string})=>ability.id==='basic_attack')).toBe(false);
  });

  it('keeps prepared source actors without loading or rebuilding the catalog',async()=>{
    const registry=await import('../../../data/adapters/runtimeMonsterRegistry');
    const {handleStartBattleMapEncounter}=await import('../startBattleMapEncounter');
    const dispatch=vi.fn();
    const actor={id:'preserved-source-actor',name:'Existing Defender',maxHP:23} as CombatCharacter;
    await handleStartBattleMapEncounter(dispatch,{monsters:[],combatants:[actor]});
    expect(dispatch.mock.calls[0][0].payload.startBattleMapEncounterData.combatants).toEqual([actor]);
    expect(registry.getMonster('Bandit')).toBeUndefined();
  });

  it('keeps an empty inert request lazy',async()=>{
    const registry=await import('../../../data/adapters/runtimeMonsterRegistry');
    const {handleStartBattleMapEncounter}=await import('../startBattleMapEncounter');
    const dispatch=vi.fn();
    await handleStartBattleMapEncounter(dispatch,{monsters:[]});
    expect(dispatch.mock.calls[0][0].payload.startBattleMapEncounterData.combatants).toEqual([]);
    expect(registry.getMonster('Bandit')).toBeUndefined();
  });
});
