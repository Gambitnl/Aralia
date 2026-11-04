/** Exercise real reducer commits, item continuity and world-clock visibility;
 * a successful status message alone cannot satisfy these cases. */
import {describe,it,expect} from 'vitest';
import {createMockGameState,createMockPlayerCharacter} from '../../../utils/core/factories';
import {GamePhase,type GameState,type CastSpellPayload,type Item} from '../../../types';
import {characterReducer} from '../../../state/reducers/characterReducer';
import {activeObjectLights,prepareObjectLightCast} from '../objectLightCasting';
import {UnderdarkMechanics} from '../../underdark/UnderdarkMechanics';

function fixture(){
  const item={id:'mace',name:'Mace',type:'weapon',weight:4} as Item;
  const state=createMockGameState();
  state.phase=GamePhase.PLAYING;state.gameTime=new Date('0351-01-05T13:16:42Z');
  const base=createMockPlayerCharacter();
  state.party=[{...base,id:'elara',name:'Elara',hp:10,
    spellbook:{cantrips:['light'],knownSpells:[],preparedSpells:[]},
    equippedItems:{MainHand:item},spellSlots:{...base.spellSlots!,level_1:{current:2,max:2}}}];
  state.underdark={...state.underdark,activeLightSources:[]};
  const payload:CastSpellPayload={characterId:'elara',spellId:'light',spellLevel:0,
    outOfCombat:{targetCharacterId:'elara',light:{slot:'MainHand',sourceItem:item,castId:'one',color:'#fff1ca'}}};
  return {state,payload,item};
}
function commit(state:GameState,payload:CastSpellPayload):GameState {
  return {...state,...characterReducer(state,{type:'CAST_SPELL',payload})};
}
describe('Light bound to an owned object',()=>{
  it('refuses the old no-object cast instead of awarding a phantom body light',()=>{
    const {state,payload}=fixture();delete payload.outOfCombat!.light;
    expect(prepareObjectLightCast(state,payload)).toHaveProperty('error');
    expect(characterReducer(state,{type:'CAST_SPELL',payload})).toEqual({});
  });
  it('atomically marks the reviewed object, preserves slots and records the actual caster',()=>{
    const {state,payload,item}=fixture(),next=commit(state,payload);
    expect(item.lightSpellId).toBeUndefined();
    expect(next.party[0].spellSlots).toEqual(state.party[0].spellSlots);
    expect(next.party[0].equippedItems?.MainHand?.lightSpellId).toBe('object-light:elara:one');
    expect(activeObjectLights(next)).toMatchObject([{bearerId:'elara',brightRadius:20,dimRadius:20,
      expiresAtGameTime:state.gameTime.getTime()+3600000,objectLight:{casterId:'elara',slot:'MainHand'}}]);
    expect(next.messages.at(-1)?.text).toContain('their Mace');
  });
  it('refuses a stale object, forged equipment or a duplicate queued cast',()=>{
    const {state,payload,item}=fixture();
    const stale={...state,party:[{...state.party[0],equippedItems:{MainHand:{...item}}}]};
    expect(prepareObjectLightCast(stale,payload)).toHaveProperty('error');
    const next=commit(state,payload);
    expect(commit(next,payload)).toEqual(next);
  });
  it.each(['unknown','incapacitated','combat'] as const)('refuses %s casting without changing the object',reason=>{
    const {state,payload}=fixture();
    if(reason==='unknown')state.party[0].spellbook!.cantrips=[];
    if(reason==='incapacitated')state.party[0].conditions=['Unconscious'];
    if(reason==='combat')state.phase=GamePhase.COMBAT;
    expect(prepareObjectLightCast(state,payload)).toHaveProperty('error');
    expect(state.party[0].equippedItems?.MainHand?.lightSpellId).toBeUndefined();
  });
  it('replaces only this caster’s prior source, preserving torches and historical buffs',()=>{
    const {state,payload}=fixture();
    state.underdark.activeLightSources=[{id:'torch',type:'torch',name:'Torch',radius:40,durationRemaining:20,isActive:true},
      {id:'other',type:'spell',name:'Other Light',radius:40,durationRemaining:20,isActive:true,
        objectLight:{spellId:'light',casterId:'other',slot:'MainHand',color:'#ffffff'}}];
    let next=commit(state,payload);
    const newPayload={...payload,outOfCombat:{...payload.outOfCombat!,light:{...payload.outOfCombat!.light!,
      sourceItem:next.party[0].equippedItems!.MainHand!,castId:'two'}}};
    next=commit(next,newPayload);
    expect(next.underdark.activeLightSources.map(s=>s.id)).toEqual(['torch','other','object-light:elara:two']);
  });
  it('survives serialization, follows the marked item to another party hand and retains caster identity',()=>{
    const {state,payload}=fixture(),saved=commit(state,payload);
    const loaded=JSON.parse(JSON.stringify(saved)) as GameState;loaded.gameTime=new Date(saved.gameTime);
    const item=loaded.party[0].equippedItems!.MainHand!;
    loaded.party[0].equippedItems={};
    loaded.party.push({...loaded.party[0],id:'bram',equippedItems:{OffHand:item}});
    expect(activeObjectLights(loaded)).toMatchObject([{bearerId:'bram',objectLight:{casterId:'elara',slot:'OffHand'}}]);
  });
  it('conceals stowed equipment, restores it without recasting and never refreshes the expiry',()=>{
    const {state,payload}=fixture(),next=commit(state,payload),item=next.party[0].equippedItems!.MainHand!;
    next.inventory.push(item);next.party[0].equippedItems={};
    expect(activeObjectLights(next)).toEqual([]);
    next.gameTime=new Date(state.gameTime.getTime()+30*60000);
    next.party[0].equippedItems={OffHand:next.inventory.pop()!};
    expect(activeObjectLights(next)[0].durationRemaining).toBe(30);
    next.gameTime=new Date(state.gameTime.getTime()+3600000);
    expect(activeObjectLights(next)).toEqual([]);
  });
  it('world time stops treating packed or expired spell objects as bright light',()=>{
    const {state,payload}=fixture(),next=commit(state,payload);
    next.underdark.currentDepth=100;
    next.party[0].equippedItems={};
    const tick=UnderdarkMechanics.processTime(next,6);
    expect(tick.underdark.activeLightSources[0].isActive).toBe(false);
    expect(tick.underdark.lightLevel).not.toBe('bright');
    next.gameTime=new Date(state.gameTime.getTime()+3600001);
    expect(UnderdarkMechanics.processTime(next,6).underdark.activeLightSources[0].isActive).toBe(false);
  });
});
