import {describe,it,expect,vi,beforeEach} from 'vitest';
import {renderHook,act} from '@testing-library/react';
import {useDialogueSystem} from '../useDialogueSystem';
import type {GameState} from '../../types';
const model=vi.hoisted(()=>({generateNPCResponse:vi.fn(),prepareNPCResponse:vi.fn()}));
vi.mock('../../services/ollamaTextService',()=>model);
const state=(npcId='roban')=>({worldSeed:42,activeDialogueSession:{npcId,discussedTopicIds:[]},generatedNpcs:{[npcId]:{id:npcId,name:npcId,initialPersonalityPrompt:'A real household shopkeeper.'}},npcMemory:{},townRumors:[],gameTime:new Date('2026-01-01T12:00:00Z')} as unknown as GameState);
describe('dialogue reply failures preserve actual speech ownership',()=>{
 beforeEach(()=>vi.clearAllMocks());
 it('prepares actual typed speech before generation and forwards the same cancellation signal',async()=>{
  model.prepareNPCResponse.mockImplementation(async (_signal,onStart)=>{onStart();return {status:'ready',model:'selected-local-model'};});
  model.generateNPCResponse.mockResolvedValue({success:true,data:{text:'A bounded answer.'}});
  const dispatch=vi.fn(),{result}=renderHook(()=>useDialogueSystem(state(),dispatch));
  const controller=new AbortController(),onPreparationChange=vi.fn();
  await expect(result.current.generateResponse('Where are rations?',controller.signal,{kind:'speech',onPreparationChange})).resolves.toBe('A bounded answer.');
  expect(model.prepareNPCResponse).toHaveBeenCalledWith(controller.signal,expect.any(Function));
  expect(onPreparationChange).toHaveBeenCalledWith(true);
  expect(onPreparationChange).toHaveBeenLastCalledWith(false);
  expect(model.generateNPCResponse.mock.calls[0][3]).toEqual({signal:controller.signal});
 });
 it('does not prepare authored topic replies or continue generation after readiness cancellation',async()=>{
  model.prepareNPCResponse.mockResolvedValue({status:'cancelled'});
  model.generateNPCResponse.mockResolvedValue({success:true,data:{text:'Must not publish.'}});
  const dispatch=vi.fn(),{result}=renderHook(()=>useDialogueSystem(state(),dispatch));
  await expect(result.current.generateResponse('Resolved topic prompt',undefined,{kind:'topic'})).resolves.toBe('Must not publish.');
  expect(model.prepareNPCResponse).not.toHaveBeenCalled();
  const controller=new AbortController();
  await expect(result.current.generateResponse('Where is the shop?',controller.signal,{kind:'speech'})).rejects.toThrow();
  expect(model.generateNPCResponse).toHaveBeenCalledOnce();
  expect(dispatch).toHaveBeenCalledOnce();
 });
 it('surfaces preparation failure without starting generation or publishing speech',async()=>{
  model.prepareNPCResponse.mockResolvedValue({status:'error',error:'Local model preparation failed.'});
  model.generateNPCResponse.mockResolvedValue({success:true,data:{text:'Must not be requested.'}});
  const dispatch=vi.fn(),{result}=renderHook(()=>useDialogueSystem(state(),dispatch));
  await expect(result.current.generateResponse('Where is the shop?',undefined,{kind:'speech'})).rejects.toThrow('Local model preparation failed.');
  expect(model.generateNPCResponse).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
 });
 it('rejects an unsuccessful provider result instead of publishing an ellipsis',async()=>{model.generateNPCResponse.mockResolvedValue({success:false,error:'Request timed out',data:null});const dispatch=vi.fn(),{result}=renderHook(()=>useDialogueSystem(state(),dispatch));await expect(result.current.generateResponse('Who are you?')).rejects.toThrow();expect(dispatch).not.toHaveBeenCalled();});
 it('answers explicit local ration questions with source or honest uncertainty without invoking a model',async()=>{
  const initial=state();initial.npcMemory.roban={interactions:[{id:'old-quote',date:1,type:'dialogue',summary:"Marge has rations in her shop.",attitudeChange:0,significance:3,
    dialogue:{topicId:'generated_exchange',speakerKey:'legacy-quote',source:{kind:'generated-exchange',requestId:'old',playerPrompt:'Where can I find provisions?'}}}]} as unknown as GameState['npcMemory'][string];
  const dispatch=vi.fn(),{result}=renderHook(()=>useDialogueSystem(initial,dispatch));
  const answer=await result.current.generateResponse('I am Bram. Elara and I need food for our return journey. Where can I buy rations nearby?',undefined,{kind:'speech'});
  expect(answer).toMatch(/can't point you to a nearby source for rations/i);
  expect(model.prepareNPCResponse).not.toHaveBeenCalled();expect(model.generateNPCResponse).not.toHaveBeenCalled();
  expect(dispatch).toHaveBeenCalledOnce();expect(dispatch.mock.calls[0][0].payload.dialogue).toMatchObject({topicId:'global_directions',
   source:{kind:'local-directions',snapshot:answer,query:{outcome:'unknown',itemRequested:true,itemId:'rations',
    playerPrompt:'I am Bram. Elara and I need food for our return journey. Where can I buy rations nearby?'}}});
 });
 it('rejects empty successful output without recording speech',async()=>{model.generateNPCResponse.mockResolvedValue({success:true,data:{text:'  '}});const dispatch=vi.fn(),{result}=renderHook(()=>useDialogueSystem(state(),dispatch));await expect(result.current.generateResponse('Who are you?')).rejects.toThrow();expect(dispatch).not.toHaveBeenCalled();});
});

describe('late generated speech is not published as an observed NPC answer',()=>{
 beforeEach(()=>model.generateNPCResponse.mockReset());
 it('does not store a canceled window reply',async()=>{let finish!:(value:unknown)=>void;model.generateNPCResponse.mockReturnValue(new Promise(r=>{finish=r}));const dispatch=vi.fn(),{result}=renderHook(()=>useDialogueSystem(state(),dispatch));const controller=new AbortController(),pending=result.current.generateResponse('Who are you?',controller.signal);const rejected=expect(pending).rejects.toThrow();controller.abort();finish({success:true,data:{text:'A late line.'}});await rejected;expect(dispatch).not.toHaveBeenCalled();});
 it('does not store an answer from a conversation that changed speaker',async()=>{let finish!:(value:unknown)=>void;model.generateNPCResponse.mockReturnValue(new Promise(r=>{finish=r}));const dispatch=vi.fn(),{result,rerender}=renderHook(({s})=>useDialogueSystem(s,dispatch),{initialProps:{s:state()}});const pending=result.current.generateResponse('Who are you?'),rejected=expect(pending).rejects.toThrow();rerender({s:state('fenna')});finish({success:true,data:{text:'Roban answered late.'}});await rejected;expect(dispatch).not.toHaveBeenCalled();});
 it('retains only the newest reply when requests finish out of order',async()=>{let finish!:(value:unknown)=>void;model.generateNPCResponse.mockReturnValueOnce(new Promise(r=>{finish=r})).mockResolvedValueOnce({success:true,data:{text:'The current answer.'}});const dispatch=vi.fn(),{result}=renderHook(()=>useDialogueSystem(state(),dispatch));const pending=result.current.generateResponse('Old question'),rejected=expect(pending).rejects.toThrow();await act(async()=>{expect(await result.current.generateResponse('New question')).toBe('The current answer.')});finish({success:true,data:{text:'The obsolete answer.'}});await rejected;expect(dispatch).toHaveBeenCalledOnce();expect(dispatch).toHaveBeenCalledWith({type:'SET_LAST_NPC_INTERACTION',payload:expect.objectContaining({npcId:'roban',response:'The current answer.',dialogue:expect.objectContaining({source:expect.objectContaining({playerPrompt:'New question'})})})});});
 it.each(['world','profile','closed'])('rejects a same-speaker result after its %s changes',async kind=>{
  let finish!:(value:unknown)=>void;model.generateNPCResponse.mockReturnValueOnce(new Promise(r=>{finish=r}));
  const dispatch=vi.fn(),original=state(),{result,rerender}=renderHook(({s})=>useDialogueSystem(s,dispatch),{initialProps:{s:original}});
  const pending=result.current.generateResponse('Any news?'),rejected=expect(pending).rejects.toThrow();
  expect(model.generateNPCResponse).toHaveBeenCalledOnce();
  const changed={...original};
  if(kind==='world')changed.worldSeed=43;
  if(kind==='profile')changed.generatedNpcs={roban:{...original.generatedNpcs.roban,initialPersonalityPrompt:'A different current profile.'}};
  if(kind==='closed')changed.activeDialogueSession=null;
  rerender({s:changed});finish({success:true,data:{text:'Outdated speech.'}});await rejected;expect(dispatch).not.toHaveBeenCalled();
 });
});
