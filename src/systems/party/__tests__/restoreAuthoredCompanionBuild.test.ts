import {describe,it,expect} from 'vitest';
import {COMPANIONS} from '../../../data/companions';
import {generateNPC} from '../../../services/npcGenerator';
import {promoteCompanionToMember} from '../npcToPartyMember';
import {restoreAuthoredCompanionBuild} from '../restoreAuthoredCompanionBuild';
import {appReducer} from '../../../state/appState';
import {createMockGameState,createMockPlayerCharacter} from '../../../utils/core/factories';

function fixture(){
  const companion={...structuredClone(COMPANIONS.elara_vance),inParty:true};
  const npc=generateNPC({id:companion.id,name:companion.identity.name,role:'unique',classId:'cleric',level:1});
  npc.stats.maxHp=10;npc.stats.hp=10;
  const character={...promoteCompanionToMember(companion).character,hp:3,conditions:['exhaustion'],xp:0};
  return {companion,npc,character};
}
describe('legacy authored companion mechanics recovery',()=>{
  it('repairs an ordinary serialized full load once while keeping world, companion and inventory continuity',()=>{
    const {companion,npc,character}=fixture();
    const saved=JSON.parse(JSON.stringify(createMockGameState({
      party:[createMockPlayerCharacter({id:'leader'}),character],
      companions:{[companion.id]:companion},generatedNpcs:{[npc.id]:npc},
    })));
    const loaded=appReducer(createMockGameState(),{type:'LOAD_GAME_SUCCESS',payload:saved});
    expect(loaded.party[1].finalAbilityScores).toEqual(npc.biography.abilityScores);
    expect(loaded.party[1].hp).toBe(3);
    expect(loaded.party[1].conditions).toEqual(['exhaustion']);
    expect(loaded.companions).toEqual(saved.companions);
    expect(loaded.generatedNpcs).toEqual(saved.generatedNpcs);
    expect(loaded.inventory).toEqual(saved.inventory);
    expect(loaded.worldSeed).toBe(saved.worldSeed);
    const again=appReducer(createMockGameState(),{type:'LOAD_GAME_SUCCESS',payload:JSON.parse(JSON.stringify(loaded))});
    expect(again.party).toEqual(loaded.party);
  });
  it('recovers the same met build without healing, changing resources or overwriting the person',()=>{
    const {companion,npc,character}=fixture();
    const before=JSON.stringify({companion,npc,character});
    const actual=restoreAuthoredCompanionBuild(character,companion,npc);
    expect(actual.finalAbilityScores).toEqual(npc.biography.abilityScores);
    expect(actual.equippedItems).toEqual(npc.equippedItems);
    expect(actual.hp).toBe(3);expect(actual.maxHp).toBe(10);
    expect(actual.conditions).toBe(character.conditions);
    expect(actual.hitPointDice).toBe(character.hitPointDice);
    // The formerly missing pool gains capacity, never ready casts on Load.
    expect(actual.spellSlots?.level_1).toEqual({current:0,max:2});
    expect(Object.values(actual.spellSlots ?? {}).every(pool=>pool.current===0)).toBe(true);
    expect(actual.richNpcData).toBe(character.richNpcData);
    expect(JSON.stringify({companion,npc,character})).toBe(before);
  });
  it('is once-only even after the recovered equipment is removed or HP is lost',()=>{
    const {companion,npc,character}=fixture();
    const recovered=restoreAuthoredCompanionBuild(character,companion,npc);
    const later={...recovered,hp:1,equippedItems:{}};
    expect(restoreAuthoredCompanionBuild(later,companion,npc)).toBe(later);
  });
  it.each(['scores','gear','skill','spells','level','xp'] as const)('leaves a customized or progressed %s build unchanged',kind=>{
    const {companion,npc,character}=fixture();
    if(kind==='scores')character.finalAbilityScores={...character.finalAbilityScores,Wisdom:16};
    if(kind==='gear')character.equippedItems={...npc.equippedItems};
    if(kind==='skill')character.skills=[{id:'religion',name:'Religion',ability:'Wisdom'} as never];
    if(kind==='spells')character.spellbook={knownSpells:[],preparedSpells:['bless'],cantrips:[]};
    if(kind==='level')character.level=2;
    if(kind==='xp')character.xp=50;
    expect(restoreAuthoredCompanionBuild(character,companion,npc)).toBe(character);
  });
  it('requires this active person and a matching valid mechanical source',()=>{
    const {companion,npc,character}=fixture();
    expect(restoreAuthoredCompanionBuild(character,undefined,npc)).toBe(character);
    expect(restoreAuthoredCompanionBuild(character,{...companion,inParty:false},npc)).toBe(character);
    expect(restoreAuthoredCompanionBuild(character,companion,{...npc,id:'other'})).toBe(character);
    expect(restoreAuthoredCompanionBuild(character,companion,{...npc,stats:{...npc.stats,maxHp:NaN}})).toBe(character);
  });
});
