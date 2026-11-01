import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {MonsterData} from '../../../types/ui';

// These fixtures test registry identity/readiness only, not creature mechanics.
const fixture=vi.hoisted(()=>({data:{} as Record<string,MonsterData>,load:vi.fn()}));
vi.mock('../../monsters',()=>({MONSTERS_DATA:fixture.data,loadMonstersData:fixture.load}));
const creature=(id:string,name:string)=>({id,name} as MonsterData);
const bandit=creature('bandit','Bandit');
const authored=creature('hoarfrost_wraith','Hoarfrost Wraith');
beforeEach(()=>{
  vi.resetModules();
  for(const key of Object.keys(fixture.data))delete fixture.data[key];
  fixture.data.hoarfrost_wraith=authored;
  fixture.load.mockReset().mockImplementation(async()=>{fixture.data.bandit=bandit;return fixture.data;});
});

describe('runtime monster catalog readiness',()=>{
  it.each(['constructor','__proto__'])('does not treat inherited catalog property %s as a creature',async key=>{
    const registry=await import('../runtimeMonsterRegistry');
    expect(registry.getMonster(key)).toBeUndefined();
  });

  it('loads ingested creatures after a cold lookup sees a partial authored catalog',async()=>{
    const registry=await import('../runtimeMonsterRegistry');
    expect(registry.getMonster('Hoarfrost Wraith')).toBe(authored);
    expect(registry.getMonster('Bandit')).toBeUndefined();
    expect(fixture.load).not.toHaveBeenCalled();
    await registry.ensureMonsterRegistryLoaded();
    expect(fixture.load).toHaveBeenCalledOnce();
    expect(registry.getMonster('Bandit')).toBe(bandit);
    expect(registry.getMonster('Hoarfrost Wraith')).toBe(authored);
  });

  it('also resolves the same creature when initialization happens before lookup',async()=>{
    const registry=await import('../runtimeMonsterRegistry');
    await registry.ensureMonsterRegistryLoaded();
    expect(registry.getMonster('Bandit')).toBe(bandit);
  });

  it('sees catalog data loaded by another existing owner after a cold read',async()=>{
    const registry=await import('../runtimeMonsterRegistry');
    expect(registry.getMonster('Bandit')).toBeUndefined();
    await fixture.load();
    expect(registry.getMonster('Bandit')).toBe(bandit);
  });

  it('preserves a runtime override when the ingested catalog later supplies its key',async()=>{
    const registry=await import('../runtimeMonsterRegistry');
    const override=creature('bandit','The Registered Bandit');
    registry.registerMonster(override);
    await registry.ensureMonsterRegistryLoaded();
    expect(fixture.load).toHaveBeenCalledOnce();
    expect(registry.getMonster('Bandit')).toBe(override);
    expect(registry.getMonster('Hoarfrost Wraith')).toBe(authored);
  });

  it('preserves a new runtime creature and does not load the catalog merely to register it',async()=>{
    const registry=await import('../runtimeMonsterRegistry');
    const custom=creature('wayfarer_warden','Wayfarer Warden');
    registry.registerMonster(custom);
    expect(registry.getMonster('Wayfarer Warden')).toBe(custom);
    expect(fixture.load).not.toHaveBeenCalled();
    await registry.ensureMonsterRegistryLoaded();
    expect(registry.getMonster('Wayfarer Warden')).toBe(custom);
    expect(registry.getMonster('Bandit')).toBe(bandit);
  });

  it('does not report readiness while the catalog loader is still pending',async()=>{
    let finish:(()=>void)|undefined;
    fixture.load.mockImplementation(()=>new Promise(resolve=>{
      finish=()=>{fixture.data.bandit=bandit;resolve(fixture.data);};
    }));
    const registry=await import('../runtimeMonsterRegistry');
    registry.getMonster('Hoarfrost Wraith');
    let ready=false;
    const loading=registry.ensureMonsterRegistryLoaded().then(()=>{ready=true;});
    await Promise.resolve();
    try{expect(ready).toBe(false);}finally{finish?.();}
    await loading;
    expect(registry.getMonster('Bandit')).toBe(bandit);
  });
});
