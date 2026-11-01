/** Wares must resolve the registered person's actual storefront, never invent a shop or select someone else's stock. */
import {describe,it,expect} from 'vitest';
import {processTopicSelection} from '../dialogueService';
import type {GameState,NPC} from '../../types';
import type {DialogueSession} from '../../types/dialogue';
const npc={id:'keeper',name:'A keeper',role:'merchant',businessId:'shop'} as NPC;
const shop={id:'shop',name:'A real shop',ownerId:'keeper',businessType:'general_store',stock:[{itemId:'torch',quantity:9}]};
const state=(extra:unknown={})=>({generatedNpcs:{keeper:npc},worldBusinesses:{shop},...extra as object} as unknown as GameState);
const select=(s=state())=>processTopicSelection('global_trade',s,{npcId:'keeper',discussedTopicIds:[]} as DialogueSession,0,npc);
describe('dialogue storefront handoff',()=>{
 it('routes the registered keeper to the exact stocked business',()=>{expect(select().openMerchant).toEqual({npcId:'keeper',businessId:'shop'})});
 it('retains the storefront when it is sold out',()=>{expect(select(state({worldBusinesses:{shop:{...shop,stock:[]}}})).openMerchant).toEqual({npcId:'keeper',businessId:'shop'})});
 it('uses a unique owned storefront for legacy records without a business link',()=>{expect(select(state({generatedNpcs:{keeper:{...npc,businessId:undefined}}})).openMerchant).toEqual({npcId:'keeper',businessId:'shop'})});
 it('does not open a linked business owned by someone else',()=>{expect(select(state({worldBusinesses:{shop:{...shop,ownerId:'other'}}})).openMerchant).toBeUndefined()});
 it('does not guess between multiple unlinked businesses',()=>{expect(select(state({generatedNpcs:{keeper:{...npc,businessId:undefined}},worldBusinesses:{shop,other:{...shop,id:'other'}}})).openMerchant).toBeUndefined()});
 it('retains the legacy topic path when no registered storefront exists',()=>{const result=select(state({worldBusinesses:{}}));expect(result.openMerchant).toBeUndefined();expect(result.responsePrompt).toBe('I would like to trade.')});
 it('never re-generates a static authored NPC merely to open a business',()=>{expect(select(state({generatedNpcs:{}})).openMerchant).toBeUndefined()});
 it('prepares a handoff without changing stock, gold or inventory',()=>{const s=state({gold:20,inventory:[{id:'keepsake'}]}),before=JSON.stringify(s);select(s);expect(JSON.stringify(s)).toBe(before)});
});

describe('tavern rumor inquiry',()=>{
 const ask=(s:GameState, speaker=npc)=>processTopicSelection('global_rumors',s,{npcId:'keeper',discussedTopicIds:[]} as DialogueSession,0,speaker);
 const tavern=()=>state({worldBusinesses:{shop:{...shop,businessType:'tavern'}}});
 it('offers the existing rumor counter without giving away its contents or charging',()=>{const s=tavern(),before=JSON.stringify(s),result=ask(s);expect(result.openMerchant).toEqual({npcId:'keeper',businessId:'shop',initialTab:'gossip'});expect(result.directReply).toBeUndefined();expect(JSON.stringify(s)).toBe(before)});
 it('preserves ordinary conversation for other residents and businesses',()=>{expect(ask(state()).openMerchant).toBeUndefined();expect(ask(state({worldBusinesses:{}})).openMerchant).toBeUndefined()});
 it('does not bypass authored rumor answers or another speaker',()=>{const guarded={...npc,knowledgeProfile:{baseOpenness:50,topicOverrides:{global_rumors:{known:true,customResponse:'Ask someone else.'}}}} as NPC;expect(ask(tavern(),guarded).openMerchant).toBeUndefined();expect(ask(tavern(),{...npc,id:'other'}).openMerchant).toBeUndefined()});
});
