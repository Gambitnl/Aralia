/** Shared information must remain attributed hearsay, with no reward or consent
 * inferred from listening. Actual conversation/reload proof is recorded separately. */
import { describe, expect, it } from 'vitest';
import { createMockGameState, createMockPlayerCharacter } from '@/utils/core';
import { COMPANIONS } from '@/data/companions';
import type { CompanionRumorSelection } from '@/types/companions';
import { ItemType } from '@/types/items';
import { companionReducer } from '../companionReducer';
import { companionRumorRecall, rumorOpinion, shareableRumorNotes } from '@/systems/companions/companionRumors';

const description='Purchased from The Silver Tankard — Tomas Ashwright: "The Iolodidau Channels: Half the undercity has been underwater for forty years."';
const fresh=()=>createMockGameState({
  worldSeed:77,currentLocationId:'cell_3052',currentLocationActiveDynamicNpcIds:['elara_vance'],metNpcIds:['elara_vance'],
  party:[createMockPlayerCharacter({id:'mara',name:'Mara Tanner'})],companions:{elara_vance:structuredClone(COMPANIONS.elara_vance)},
  inventory:[{id:'rumor_gossip_dungeon_source',sourceId:'gossip_dungeon_source',name:'Rumor',type:ItemType.Service,description,weight:0}],
  gold:8,questLog:[],gameTime:new Date('0351-01-01T17:42:00Z'),
  activeConversation:{id:'elara',participants:['elara_vance'],messages:[],startedAt:1,isPlayerTurn:true,pendingResponse:false},
});
const selection:CompanionRumorSelection={companionId:'elara_vance',inventoryIndex:0,itemId:'rumor_gossip_dungeon_source',sourceId:'gossip_dungeon_source',description};
const discuss=(state= fresh(),payload=selection)=>companionReducer(state,{type:'DISCUSS_COMPANION_RUMOR',payload});

describe('explicit companion shared accounts',()=>{
  it('records the exact account as player-reported hearsay and keeps every gameplay gate intact',()=>{
    const state=fresh(),patch=discuss(state),c=patch.companions!.elara_vance;
    expect(c.memories.at(-1)).toMatchObject({type:'event',timestamp:state.gameTime.getTime(),hearsay:{sourceId:selection.sourceId,account:description,subject:'The Iolodidau Channels',sharedById:'mara',sharedInWorldSeed:77}});
    expect(patch.activeConversation!.messages.every(message=>message.memoryHandled)).toBe(true);
    expect(patch.activeConversation!.messages.at(-1)!.text).toContain('safe way in and a way back');
    expect(patch.activeConversation!.messages.at(-1)!.text).toContain('restore the desecrated Temple of the Morning');
    expect(patch.activeConversation!.messages.at(-1)!.text).not.toContain('fallen paladin');
    for(const key of ['identity','goals','relationships','inventory','questline'] as const)expect(c[key]).toBe(state.companions.elara_vance[key]);
    expect(c.inParty).toBe(state.companions.elara_vance.inParty);
    for(const key of ['inventory','gold','party','questLog','playerGroundPos'] as const)expect(patch).not.toHaveProperty(key);
  });
  it('revisits a note without duplicating memory, discovered preference or approval',()=>{
    const state=fresh(),first={...state,...discuss(state)},second=discuss(first);
    expect(second.companions!.elara_vance.memories).toBe(first.companions.elara_vance.memories);
    expect(second.companions!.elara_vance.discoveredFacts).toBe(first.companions.elara_vance.discoveredFacts);
    expect(second.activeConversation!.messages.at(-2)!.text).toContain('consider "The Iolodidau Channels" again');
    expect(second.companions!.elara_vance.relationships).toBe(state.companions.elara_vance.relationships);
  });
  it.each(['absent','unmet','closed','pending','npc-turn','foreign-world','wrong-place'] as const)('rejects stale or unavailable speaker: %s',condition=>{
    const state=fresh();
    if(condition==='absent')state.currentLocationActiveDynamicNpcIds=[];
    if(condition==='unmet')state.metNpcIds=[];
    if(condition==='closed')state.activeConversation=null;
    if(condition==='pending')state.activeConversation!.pendingResponse=true;
    if(condition==='npc-turn')state.activeConversation!.isPlayerTurn=false;
    if(condition==='foreign-world'||condition==='wrong-place')state.companions.elara_vance.whereabouts={worldSeed:condition==='foreign-world'?78:77,locationId:condition==='wrong-place'?'cell_3000':'cell_3052',source:'encounter',observedAt:1};
    expect(discuss(state)).toEqual({});
  });
  it.each(['replaced','moved','edited','secret','physical'] as const)('rechecks retained receipt: %s',condition=>{
    const state=fresh();
    if(condition==='replaced')state.inventory[0]={...state.inventory[0],sourceId:'different'};
    if(condition==='moved')state.inventory=[];
    if(condition==='edited')state.inventory[0]={...state.inventory[0],description:'Another account'};
    if(condition==='secret')state.inventory[0]={...state.inventory[0],name:'Secret Info'};
    if(condition==='physical')state.inventory[0]={...state.inventory[0],type:ItemType.FoodDrink};
    expect(discuss(state)).toEqual({});
  });
  it('retains earlier quoted words if the owned receipt later gains new information',()=>{
    const state=fresh(),first={...state,...discuss(state)};
    first.inventory=[{...first.inventory[0],description:description+' A later annotation.'}];
    const next=discuss(first,{...selection,description:first.inventory[0].description});
    expect(next.companions!.elara_vance.memories.slice(-2).map(memory=>memory.hearsay!.account)).toEqual([description,first.inventory[0].description]);
  });
  it('recalls a serialized shared account only in its own world and keeps the exact source ID',()=>{
    const next={...fresh(),...discuss()};
    const c=JSON.parse(JSON.stringify(next.companions.elara_vance));
    expect(companionRumorRecall(c,77)).toBe('I remember the account you showed me about The Iolodidau Channels.');
    expect(companionRumorRecall(c,78)).toBe('');
    expect(c.memories.at(-1).hearsay.sourceId).toBe(selection.sourceId);
  });
  it('gives Kaelen distinct practical terms without disclosing his secret debt',()=>{
    const reply=rumorOpinion(COMPANIONS.kaelen_thorne,description).reply;
    expect(reply).toContain('clear terms');
    expect(reply).not.toContain('Zhentarim');
    expect(reply).not.toBe(rumorOpinion(COMPANIONS.elara_vance,description).reply);
  });
  it('does not expose an unowned offer as something the player can share',()=>{
    expect(shareableRumorNotes({...fresh(),inventory:[]})).toEqual([]);
  });
});
