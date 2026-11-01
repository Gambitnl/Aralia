/** Ordinary household residents must not advertise a shop they do not own.
 * The same rule rejects stale trade selections before session/cost mutations. */
import {describe,it,expect} from 'vitest';
import {getAvailableTopics,processTopicSelection} from '../dialogueService';
import type {GameState,NPC} from '../../types';
import type {DialogueSession} from '../../types/dialogue';
const resident=(extra:Partial<NPC>={})=>({id:'child',name:'Cob',role:'civilian',baseDescription:'A household child.',initialPersonalityPrompt:'Cob lives with his family.',...extra} as NPC);
const state=(npc:NPC,worldBusinesses:unknown={})=>({gameTime:new Date('0351-01-03T16:00:00Z'),npcMemory:{child:{disposition:100}},generatedNpcs:{child:npc},activeRumors:[],worldBusinesses,inventory:[],gold:20,questLog:[],discoveryLog:[],companions:{}} as unknown as GameState);
const session=()=>({npcId:'child',discussedTopicIds:[]} as DialogueSession);
const trade=(s:GameState,npc?:NPC)=>getAvailableTopics(s,'child',session(),npc).some(t=>t.id==='global_trade');
describe('source-backed trade topics',()=>{
 it('keeps personal questions but removes invented wares from a child',()=>{const npc=resident(),s=state(npc);expect(trade(s,npc)).toBe(false);expect(getAvailableTopics(s,'child',session(),npc).some(t=>t.id==='global_who_are_you')).toBe(true)});
 it('resolves the generated speaker when a caller omits the optional NPC',()=>{const npc=resident();expect(trade(state(npc))).toBe(false)});
 it('preserves ordinary merchant-role topics',()=>{const npc=resident({role:'merchant'});expect(trade(state(npc),npc)).toBe(true)});
 it('allows a real stocked business owner even when the role is civilian',()=>{const npc=resident({businessId:'shop'});expect(trade(state(npc,{shop:{id:'shop',ownerId:'child',stock:[]}}),npc)).toBe(true)});
 it('does not grant a shop from a dangling or another owners business link',()=>{const npc=resident({businessId:'shop'});expect(trade(state(npc),npc)).toBe(false);expect(trade(state(npc,{shop:{ownerId:'other',stock:[]}}),npc)).toBe(false)});
 it('does not turn a simulation-only business into a storefront',()=>{const npc=resident();expect(trade(state(npc,{farm:{ownerId:'child'}}),npc)).toBe(false)});
 it('rejects a stale trade choice before changing the session or charging anything',()=>{const npc=resident(),s=state(npc),d=session(),before=JSON.stringify(s);expect(()=>processTopicSelection('global_trade',s,d,0,npc)).toThrow();expect(d.discussedTopicIds).toEqual([]);expect(JSON.stringify(s)).toBe(before)});
});
