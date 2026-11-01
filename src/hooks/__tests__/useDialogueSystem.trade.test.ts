/** Opening a shop belongs to the existing action processor. A raw reducer dispatch must never pretend it opened stock. */
import {describe,it,expect,vi} from 'vitest';
import {renderHook,act} from '@testing-library/react';
import {useDialogueSystem} from '../useDialogueSystem';
import type {GameState} from '../../types';
import type {ProcessTopicResult} from '../../services/dialogueService';
const state=()=>({activeDialogueSession:{npcId:'keeper',discussedTopicIds:[]},gameTime:new Date('0351-01-03T16:00:00Z'),generatedNpcs:{keeper:{id:'keeper',name:'A keeper',role:'merchant',businessId:'shop'}},worldBusinesses:{shop:{id:'shop',ownerId:'keeper',name:'The Actual Shop',businessType:'general_store',stock:[]}}} as unknown as GameState);
const trade={status:'neutral',responsePrompt:'I would like to trade.',unlocks:[],openMerchant:{npcId:'keeper',businessId:'shop'}} as unknown as ProcessTopicResult;
describe('dialogue shop action routing',()=>{
 it('records the question once and invokes the existing merchant action once',()=>{const dispatch=vi.fn(),process=vi.fn(),{result}=renderHook(()=>useDialogueSystem(state(),dispatch,process));act(()=>result.current.handleTopicOutcome(trade,'global_trade'));expect(process).toHaveBeenCalledExactlyOnceWith({type:'OPEN_DYNAMIC_MERCHANT',label:'Browse The Actual Shop',payload:{merchantType:'general_store',buildingId:'keeper'}});expect(dispatch.mock.calls.map(c=>c[0].type)).toEqual(['DISCUSS_TOPIC'])});
 it('reports a missing action processor before recording effects',()=>{const dispatch=vi.fn(),{result}=renderHook(()=>useDialogueSystem(state(),dispatch));expect(()=>result.current.handleTopicOutcome(trade,'global_trade')).toThrow();expect(dispatch).not.toHaveBeenCalled()});
 it('refuses a stale business ownership change before dispatching',()=>{const s=state();s.worldBusinesses.shop.ownerId='someone-else';const dispatch=vi.fn(),process=vi.fn(),{result}=renderHook(()=>useDialogueSystem(s,dispatch,process));expect(()=>result.current.handleTopicOutcome(trade,'global_trade')).toThrow();expect(process).not.toHaveBeenCalled();expect(dispatch).not.toHaveBeenCalled()});
 it('refuses another speakers handoff before dispatching',()=>{const s=state();s.activeDialogueSession!.npcId='other';const dispatch=vi.fn(),process=vi.fn(),{result}=renderHook(()=>useDialogueSystem(s,dispatch,process));expect(()=>result.current.handleTopicOutcome(trade,'global_trade')).toThrow();expect(process).not.toHaveBeenCalled();expect(dispatch).not.toHaveBeenCalled()});
});

it('hands a tavern inquiry to gossip and rechecks its current business type',()=>{
 const s=state();s.worldBusinesses.shop.businessType='tavern';const inquiry={...trade,openMerchant:{...trade.openMerchant!,initialTab:'gossip' as const}};
 const dispatch=vi.fn(),process=vi.fn(),{result,rerender}=renderHook(()=>useDialogueSystem(s,dispatch,process));
 act(()=>result.current.handleTopicOutcome(inquiry,'global_rumors'));
 expect(process).toHaveBeenCalledExactlyOnceWith({type:'OPEN_DYNAMIC_MERCHANT',label:'Browse The Actual Shop',payload:{merchantType:'tavern',buildingId:'keeper',initialTab:'gossip'}});
 dispatch.mockClear();process.mockClear();s.worldBusinesses.shop.businessType='smithy';rerender();
 expect(()=>result.current.handleTopicOutcome(inquiry,'global_rumors')).toThrow();expect(dispatch).not.toHaveBeenCalled();expect(process).not.toHaveBeenCalled();
});
