/** Native Sten dialogue invented a workplace name. Ground names and direct
 * contact in their existing owners without inventing jobs, visits or facts. */
import {describe,it,expect} from 'vitest';
import {buildNpcDialoguePromptContext} from '../dialogueService';
import {createMockGameState} from '../../utils/core/factories';
import {createEmptyMemory} from '../../utils/world/memoryUtils';
import type {NPC,GameState,KnownFact} from '../../types';
const npc={id:'sten',name:'Sten Ironwell',initialPersonalityPrompt:'You are an innkeeper.'} as NPC;
const meeting:KnownFact={id:'original',factKey:'player_met_npc',text:'Met Sana Ashford.',source:'direct',isPublic:true,timestamp:1,strength:3,lifespan:999};
const make=(businesses:unknown={},facts:KnownFact[]=[],contactStatus?:'first-meeting'|'returning')=>createMockGameState({worldBusinesses:businesses as GameState['worldBusinesses'],npcMemory:{sten:{...createEmptyMemory(),disposition:50,knownFacts:facts}},activeDialogueSession:{npcId:'sten',discussedTopicIds:[],...(contactStatus?{contactStatus}:{})}});
describe('source-backed NPC identity context',()=>{
 it('names the owned business without converting the legacy shop type into a job',()=>{
  const text=buildNpcDialoguePromptContext(make({shop:{id:'shop',ownerId:'sten',name:'The Shadowed Enchantments',businessType:'enchanter_shop'}}),'sten',npc);
  expect(text).toContain('The Shadowed Enchantments');expect(text).not.toContain('enchanter_shop');expect(text).toContain('Do not invent');
 });
 it('does not borrow another owner workplace name',()=>{
  const text=buildNpcDialoguePromptContext(make({shop:{id:'shop',ownerId:'other',name:'Someone Else Inn'}}),'sten',npc);
  expect(text).not.toContain('Someone Else Inn');expect(text).toContain('leave it unnamed');
 });
 it('keeps supplied owned names when there is more than one business',()=>{
  const text=buildNpcDialoguePromptContext(make({a:{ownerId:'sten',name:'Old Mill'},b:{ownerId:'sten',name:'Market Stall'}}),'sten',npc);
  expect(text).toContain('Old Mill');expect(text).toContain('Market Stall');
 });
 it('passes the existing direct meeting to the model with its return context',()=>{
  const text=buildNpcDialoguePromptContext(make({},[meeting],'returning'),'sten',npc);
  expect(text).toContain('Met Sana Ashford.');expect(text).toContain('previously met');expect(text).toContain('other shared history');
 });
 it('does not call the newly recorded first contact a previous visit',()=>{
  const text=buildNpcDialoguePromptContext(make({},[meeting],'first-meeting'),'sten',npc);
  expect(text).toContain('Met Sana Ashford.');expect(text).toContain('first conversation');expect(text).not.toContain('previously met');
 });
 it('does not turn a gossip copy of a meeting into direct contact',()=>{
  const text=buildNpcDialoguePromptContext(make({},[{...meeting,source:'gossip'}],'returning'),'sten',npc);
  expect(text).not.toContain('Met Sana Ashford.');
 });
 it('does not write identity, meeting, business or stock state while building context',()=>{
  const state=make({a:{ownerId:'sten',name:'Old Mill',stock:[]}},[meeting],'returning');const before=JSON.stringify(state);
  buildNpcDialoguePromptContext(state,'sten',npc);expect(JSON.stringify(state)).toBe(before);
 });
});
