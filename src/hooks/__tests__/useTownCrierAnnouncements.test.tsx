/** Exercise actual scheduled announcements, persisted source memory and reloads. */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTownCrierAnnouncements } from '../useTownCrierAnnouncements';
import { GamePhase } from '../../types/core';
import type { GameState, GameMessage } from '../../types';
import type { TownSimState, LifeEvent } from '../../systems/worldforge/townsim/types';

const fixture=vi.hoisted(()=>({town:undefined as TownSimState|undefined,hooks:[] as string[],revisions:[] as unknown[]}));
vi.mock('../../systems/worldforge/townsim/chronicleForLocation',()=>({resolveTownForLocation:()=>fixture.town}));
vi.mock('../../systems/worldforge/bridge/legacySubmapBridge',()=>({getBridgeAtlas:()=>({})}));
vi.mock('../../systems/worldforge/town/canonicalTown',()=>({getCanonicalTownPersonality:(_atlas:unknown,_seed:number,_burg:number,revision?:unknown)=>(fixture.revisions.push(revision),{profile:{encounterHooks:fixture.hooks}})}));
const old:LifeEvent={id:204,day:-372,kind:'role_succession',subjectId:1,relatedIds:[],summary:'Faelan succeeded Senna as priest.'};
const town=(events:LifeEvent[]=[old],burgId=675):TownSimState=>({burgId,layoutRevision:2,villagers:{},chronicle:{burgId,events,nextEventId:300},lastSimDay:5,nextVillagerId:1});
// The location resolver is mocked; unrelated combat and character state is not
// needed to exercise this hook's real scheduled dispatch and saved-log behavior.
const state=(messages:GameMessage[]=[]):GameState=>({phase:GamePhase.PLAYING,worldSeed:1793146029630,playerCell:{cellId:4337},currentLocationId:'cell_4337',townSim:{675:fixture.town},gameTime:new Date('0351-01-05T12:00:00Z'),messages} as unknown as GameState);
const tick=(n=1)=>act(()=>vi.advanceTimersByTime(105000*n));
const published=(dispatch:ReturnType<typeof vi.fn>)=>dispatch.mock.calls.map(([a])=>a.payload as GameMessage);

beforeEach(()=>{vi.useFakeTimers();fixture.town=town();fixture.hooks=[];fixture.revisions=[];});
afterEach(()=>{vi.useRealTimers();});

describe('town crier announcement memory',()=>{
 it('dates the actual old source and does not chant a sole headline between state commits',()=>{
  const dispatch=vi.fn(),s=state(),before=JSON.stringify(fixture.town);
  renderHook(()=>useTownCrierAnnouncements(s,dispatch));
  tick(4);
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(published(dispatch)[0].text).toContain('377 days ago');
  expect(published(dispatch)[0].text).toContain(old.summary);
  expect(published(dispatch)[0].metadata?.townCrier).toMatchObject({worldSeed:s.worldSeed,burgId:675,kind:'headline',eventId:204,sourceDay:-372,summary:old.summary});
  expect(JSON.stringify(fixture.town)).toBe(before);
 });

 it('announces each source once, then admits genuinely new news without a stale closure',()=>{
  fixture.town=town([{...old,id:205,day:5,summary:'A fire swept the market.',kind:'disaster'},old]);
  const dispatch=vi.fn(),s=state();
  const {rerender}=renderHook(({value})=>useTownCrierAnnouncements(value,dispatch),{initialProps:{value:s}});
  tick(4);
  expect(published(dispatch).map(m=>m.text)).toEqual([expect.stringContaining("today's news"),expect.stringContaining('377 days ago')]);
  fixture.town=town([...fixture.town!.chronicle.events,{...old,id:206,day:5,summary:'The new council was appointed.'}]);
  rerender({value:{...s,messages:published(dispatch)}});
  tick();
  expect(published(dispatch)).toHaveLength(3);
  expect(published(dispatch)[2].text).toContain('The new council');
 });

 it('uses saved source metadata after a JSON round trip and remount',()=>{
  const dispatch=vi.fn(),s=state();
  const first=renderHook(()=>useTownCrierAnnouncements(s,dispatch));tick();first.unmount();
  const saved=JSON.parse(JSON.stringify(published(dispatch))) as GameMessage[];
  const next=vi.fn();
  renderHook(()=>useTownCrierAnnouncements(state(saved),next));tick(3);
  expect(next).not.toHaveBeenCalled();
  expect(saved[0].text).toContain('377 days ago');
 });

 it('scopes identical event IDs to their world and town',()=>{
  const dispatch=vi.fn(),s=state();
  const {rerender}=renderHook(({value})=>useTownCrierAnnouncements(value,dispatch),{initialProps:{value:s}});
  tick();
  const heard=published(dispatch);
  fixture.town=town([old],700);
  rerender({value:{...s,messages:heard}});tick();
  rerender({value:{...s,worldSeed:s.worldSeed+1,messages:published(dispatch)}});tick();
  expect(published(dispatch)).toHaveLength(3);
 });

 it('keeps unproven legacy lines unchanged and creates a dated source record only when heard',()=>{
  const legacy:GameMessage={id:1,sender:'npc',timestamp:new Date('0351-01-05T10:00:00Z'),text:`A town crier proclaims: "${old.summary}"`,metadata:{type:'banter'}};
  const messages=[legacy],before=JSON.stringify(messages),dispatch=vi.fn();
  renderHook(()=>useTownCrierAnnouncements(state(messages),dispatch));tick(3);
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(messages)).toBe(before);
  expect(legacy.metadata).toEqual({type:'banter'});
  expect(published(dispatch)[0].text).toContain('377 days ago');
 });

 it('retains authored standing business once per town and game day across reloads',()=>{
  fixture.town=town([]);fixture.hooks=['The smith seeks star-iron.'];
  const dispatch=vi.fn(),s=state();
  const first=renderHook(()=>useTownCrierAnnouncements(s,dispatch));tick(3);first.unmount();
  expect(published(dispatch)).toHaveLength(1);
  expect(published(dispatch)[0].text).toContain('The smith seeks star-iron.');
  const next=vi.fn(),saved=state(JSON.parse(JSON.stringify(published(dispatch))));
  const {rerender}=renderHook(({value})=>useTownCrierAnnouncements(value,next),{initialProps:{value:saved}});
  tick();expect(next).not.toHaveBeenCalled();
  rerender({value:{...saved,gameTime:new Date('0351-01-06T12:00:00Z')}});tick();
  expect(next).toHaveBeenCalledTimes(1);
 });

 it('does not retain unsaved hearing after loading a different message history',()=>{
  const dispatch=vi.fn(),s=state();
  const {rerender}=renderHook(({value})=>useTownCrierAnnouncements(value,dispatch),{initialProps:{value:s}});
  tick();rerender({value:{...s,messages:[]}});tick();
  expect(dispatch).toHaveBeenCalledTimes(2);
 });

 it('does not infer a source match from a reused ID or malformed metadata',()=>{
  const wrong:GameMessage={id:1,sender:'npc',timestamp:new Date(),text:'old text',metadata:{townCrier:{worldSeed:1793146029630,burgId:675,kind:'headline',eventId:204,sourceDay:-400,eventKind:'role_succession',summary:old.summary}}};
  const dispatch=vi.fn();renderHook(()=>useTownCrierAnnouncements(state([wrong]),dispatch));tick();
  expect(dispatch).toHaveBeenCalledTimes(1);
 });

 it('skips invalid clocks, untracked towns, ambiguous events and inactive play, then cleans its timer',()=>{
  const dispatch=vi.fn(),s=state();
  const {rerender,unmount}=renderHook(({value})=>useTownCrierAnnouncements(value,dispatch),{initialProps:{value:{...s,gameTime:new Date('invalid')}}});
  tick();rerender({value:{...s,phase:GamePhase.MAIN_MENU}});tick();
  fixture.town=undefined;rerender({value:s});tick();
  fixture.town=town([old,{...old,summary:'Conflicting source.'}]);tick();
  expect(dispatch).not.toHaveBeenCalled();
  unmount();tick();expect(dispatch).not.toHaveBeenCalled();
 });
});

describe('town crier layout source',()=>{
 it('selects standing business from the saved earlier profile',()=>{
  fixture.town=town([]);fixture.town.layoutRevision=1;fixture.hooks=['The herders need help.'];
  const dispatch=vi.fn();renderHook(()=>useTownCrierAnnouncements(state(),dispatch));tick();
  expect(fixture.revisions).toEqual([1]);expect(published(dispatch)[0].text).toContain('The herders need help.');
 });
 it('retains recorded headlines while deferring unverified standing business',()=>{
  fixture.town=town();delete fixture.town.layoutRevision;fixture.hooks=['Unverified errand'];
  const dispatch=vi.fn();renderHook(()=>useTownCrierAnnouncements(state(),dispatch));tick(3);
  expect(published(dispatch)).toHaveLength(1);expect(published(dispatch)[0].text).toContain(old.summary);
  expect(fixture.revisions).toEqual([]);
 });
});
