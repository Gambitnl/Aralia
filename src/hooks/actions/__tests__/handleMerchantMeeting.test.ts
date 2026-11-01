/** A registered shopkeeper is not automatically someone the player has met.
 * These integration checks use the real NPC memory reducers and owned stock. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleOpenDynamicMerchant } from '../handleMerchantInteraction';
import { businessAttendance } from '@/systems/economy/businessAttendance';
import { generateNPC } from '@/services/npcGenerator';
import { generateNpcBusiness } from '@/systems/economy/NpcBusinessManager';
import { SeededRandom } from '@/utils/random';
import { createMockGameState, createMockPlayerCharacter } from '@/utils/core';
import { createEmptyMemory } from '@/utils/world/memoryUtils';
import { appReducer } from '@/state/appState';
import type { AppAction } from '@/state/actionTypes';
import type { GameState, Action } from '@/types';

vi.mock('@/systems/economy/businessAttendance',()=>({businessAttendance:vi.fn(async()=>({open:true,hours:'08:00–18:00'}))}));

const id='npc_burg_3_plot_15';
function fresh(){
  const npc=generateNPC({id,name:'Tomas Ashwright',role:'merchant',occupation:'tavern',worldSeed:77});
  const business={...generateNpcBusiness(npc,'cell_3052','tavern',1,new SeededRandom(77)),stock:[],name:'The Silver Tankard'};
  const linked={...npc,businessId:business.id};
  return createMockGameState({worldSeed:77,currentLocationId:'cell_3052',gameTime:new Date('0351-01-01T17:42:00Z'),
    party:[createMockPlayerCharacter({id:'mara',name:'Mara Tanner'})],generatedNpcs:{[id]:linked},worldBusinesses:{[business.id]:business},
    metNpcIds:[],npcMemory:{[id]:{...createEmptyMemory(),disposition:40,knownFacts:[{id:'prior-price',text:'A prior pricing agreement.',strength:1,lifespan:1,source:'direct',isPublic:false,timestamp:1}]}}});
}
async function visit(initial:GameState,initialTab?:'gossip'){
  let state=initial;
  const dispatch=vi.fn((action:AppAction)=>{state=appReducer(state,action);});
  const addMessage=vi.fn();
  await handleOpenDynamicMerchant({gameState:initial,dispatch,addMessage,addGeminiLog:vi.fn(),generalActionContext:'A normal staffed town visit',
    action:{type:'open_dynamic_merchant',payload:{merchantType:'shop_tavern',buildingId:id,initialTab}} as unknown as Action});
  return {state,dispatch,addMessage};
}
describe('merchant meetings retain personal continuity',()=>{
  beforeEach(()=>vi.mocked(businessAttendance).mockResolvedValue({open:true,hours:'08:00–18:00'}));
  it('records first contact for a pre-registered keeper without inventing recognition',async()=>{
    const before=fresh(),{state,addMessage}=await visit(before);
    expect(addMessage).toHaveBeenCalledWith('You meet Tomas Ashwright.','system');
    expect(addMessage).not.toHaveBeenCalledWith('You recognize Tomas Ashwright.','system');
    expect(state.metNpcIds).toContain(id);
    expect(state.npcMemory[id].knownFacts).toEqual(expect.arrayContaining([expect.objectContaining({factKey:'player_met_npc',text:'Met Mara Tanner.',source:'direct'})]));
    expect(state.npcMemory[id].lastInteractionTimestamp).toBe(before.gameTime.getTime());
    expect(state.npcMemory[id].disposition).toBe(40);
    expect(state.generatedNpcs[id]).toBe(before.generatedNpcs[id]);
    expect(state.worldBusinesses).toBe(before.worldBusinesses);
  });
  it('preserves the first meeting and pricing history on a returning visit',async()=>{
    const first=await visit(fresh());
    const originalFact=first.state.npcMemory[id].knownFacts.find(fact=>fact.factKey==='player_met_npc');
    const time=new Date(first.state.gameTime.getTime()+60000);
    const {state,addMessage}=await visit({...first.state,gameTime:time});
    expect(addMessage).toHaveBeenCalledWith('You recognize Tomas Ashwright.','system');
    expect(state.npcMemory[id].knownFacts.filter(fact=>fact.factKey==='player_met_npc')).toEqual([originalFact]);
    expect(state.npcMemory[id].knownFacts.some(fact=>fact.id==='prior-price')).toBe(true);
    expect(state.npcMemory[id].lastInteractionTimestamp).toBe(time.getTime());
  });
  it('does not manufacture a meeting when source attendance refuses the visit',async()=>{
    vi.mocked(businessAttendance).mockResolvedValue({open:false,hours:'08:00–18:00',reason:'The keeper is not on duty.'});
    const before=fresh(),{state,addMessage}=await visit(before);
    expect(addMessage).toHaveBeenCalledWith('The keeper is not on duty.','system');
    expect(state.metNpcIds).toEqual([]);
    expect(state.npcMemory[id]).toBe(before.npcMemory[id]);
  });
  it('lets the first-contact owner create a missing legacy memory without replacing the keeper',async()=>{
    const before={...fresh(),npcMemory:{}}, {state}=await visit(before);
    expect(state.npcMemory[id].knownFacts.some(fact=>fact.factKey==='player_met_npc')).toBe(true);
    expect(state.npcMemory[id].lastInteractionTimestamp).toBe(before.gameTime.getTime());
    expect(state.generatedNpcs[id]).toBe(before.generatedNpcs[id]);
  });
});

it('records direct confirmation after hearsay without changing an existing price agreement',async()=>{
  vi.mocked(businessAttendance).mockResolvedValue({open:true,hours:'08:00–18:00'});
  const before=fresh();before.metNpcIds=[id];
  const gossip={id:'old-gossip',text:'Met Mara Tanner.',source:'gossip' as const,sourceNpcId:'elara_vance',isPublic:true,timestamp:1,strength:2,lifespan:999,factKey:'player_met_npc'};
  before.npcMemory[id].knownFacts.push(gossip);
  const first=await visit(before),facts=first.state.npcMemory[id].knownFacts;
  expect(facts).toContain(gossip);
  const own=facts.filter(f=>f.factKey==='player_met_npc'&&f.source==='direct');
  expect(own).toHaveLength(1);expect(own[0].timestamp).toBe(before.gameTime.getTime());
  expect(facts.find(f=>f.id==='prior-price')).toEqual(before.npcMemory[id].knownFacts[0]);
  expect(first.state.npcMemory[id].disposition).toBe(40);
  const again=await visit({...first.state,gameTime:new Date(before.gameTime.getTime()+60000)});
  expect(again.state.npcMemory[id].knownFacts).toEqual(facts);
});

it('carries a rumor inquiry through attendance, stock, and the real UI reducer without charging',async()=>{
 vi.mocked(businessAttendance).mockResolvedValue({open:true,hours:'08:00–18:00'});
 const before=fresh(),{state}=await visit(before,'gossip');
 expect(state.merchantModal).toMatchObject({isOpen:true,merchantId:id,initialTab:'gossip'});
 expect(state.gold).toBe(before.gold);expect(state.inventory).toEqual(before.inventory);
 vi.mocked(businessAttendance).mockResolvedValue({open:false,hours:'08:00–18:00',reason:'Closed.'});
 expect((await visit(before,'gossip')).state.merchantModal.isOpen).toBe(false);
});
