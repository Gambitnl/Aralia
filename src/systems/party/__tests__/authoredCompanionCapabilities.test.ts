import {describe,it,expect} from 'vitest';
import {COMPANIONS} from '../../../data/companions';
import {ELARA_CLERIC_BUILD} from '../../../data/companionBuilds';
import {promoteCompanionToMember} from '../npcToPartyMember';
import {authoredCompanionCapabilities} from '../authoredCompanionCapabilities';

function fixture(){
  const companion={...structuredClone(COMPANIONS.elara_vance),inParty:true};
  const character={...promoteCompanionToMember(companion).character,hp:3,
    conditions:['exhaustion'],retainedNpcBuild:{version:1 as const,npcId:companion.id}};
  return {character,companion};
}
describe('authored companion capabilities',()=>{
  it('assembles explicit cleric skills and casting without replacing the existing person or restoring spent pools',()=>{
    const {character,companion}=fixture();
    const before=JSON.stringify({character,companion});
    const result=authoredCompanionCapabilities(character,companion);
    expect(result.skills.map(s=>s.id).sort()).toEqual(['history','insight','medicine','persuasion','religion']);
    expect(result.spellbook?.cantrips).toEqual(['sacred-flame','light','guidance','resistance','thaumaturgy']);
    expect(result.spellbook?.preparedSpells).toEqual(ELARA_CLERIC_BUILD.preparedSpellIds);
    expect(result.spellSlots?.level_1).toEqual({current:0,max:2});
    expect(result.limitedUses?.['feat_magic_initiate_healing-word']).toMatchObject({current:0,max:1});
    expect(result.selectedDivineOrder).toBe('Protector');
    expect(result.feats).toEqual(['magic_initiate','healer']);
    expect(result.hp).toBe(3);expect(result.maxHp).toBe(character.maxHp);
    expect(result.abilityScores).toBe(character.abilityScores);
    expect(result.finalAbilityScores).toBe(character.finalAbilityScores);
    expect(result.conditions).toBe(character.conditions);
    expect(result.equippedItems).toBe(character.equippedItems);
    expect(result.richNpcData).toBe(character.richNpcData);
    expect(JSON.stringify({character,companion})).toBe(before);
  });
  it('initializes ordinary new-recruit capacity but never refills a subsequently spent legacy pool',()=>{
    const {character,companion}=fixture();
    const fresh=authoredCompanionCapabilities(character,companion,'new-recruit');
    expect(fresh.spellSlots?.level_1).toEqual({current:2,max:2});
    const spent={...fresh,spellSlots:{...fresh.spellSlots!,level_1:{current:0,max:2}}};
    expect(authoredCompanionCapabilities(spent,companion)).toBe(spent);
  });
  it('preserves an existing resource pool even when recovering missing class choices',()=>{
    const {character,companion}=fixture();
    const slots={level_1:{current:1,max:2}} as NonNullable<typeof character.spellSlots>;
    expect(authoredCompanionCapabilities({...character,spellSlots:slots},companion).spellSlots).toBe(slots);
  });
  it('leaves other people, custom builds and progressed characters unchanged',()=>{
    const {character,companion}=fixture();
    expect(authoredCompanionCapabilities(character,{...companion,id:'another'})).toBe(character);
    const custom={...character,spellbook:{cantrips:['light'],knownSpells:[],preparedSpells:[]}};
    expect(authoredCompanionCapabilities(custom,companion)).toBe(custom);
    const progressed={...character,xp:30};
    expect(authoredCompanionCapabilities(progressed,companion)).toBe(progressed);
    expect(authoredCompanionCapabilities(character,companion,'legacy',{rulesEdition:'2014'})).toBe(character);
  });
});
