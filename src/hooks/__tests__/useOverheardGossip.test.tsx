/** Scheduled gossip must retain source identity and six game hours across saves. */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOverheardGossip } from '../useOverheardGossip';
import { GamePhase } from '../../types/core';
import type { GameState, GameMessage } from '../../types';
import type { TownSimState, LifeEvent } from '../../systems/worldforge/townsim/types';

const fixture=vi.hoisted(()=>({town:undefined as TownSimState|undefined}));
vi.mock('../../systems/worldforge/townsim/chronicleForLocation',()=>({resolveTownForLocation:()=>fixture.town}));
const event:LifeEvent={id:91,day:-51,kind:'came_of_age',subjectId:1,relatedIds:[],summary:'Tib came of age.'};
const town=(events:LifeEvent[]=[event],burgId=675):TownSimState=>({burgId,villagers:{},chronicle:{burgId,events,nextEventId:300},lastSimDay:5,nextVillagerId:1});
// Only the hook's inputs are needed; expensive location generation is mocked.
const state=(messages:GameMessage[]=[],hour=12):GameState=>({phase:GamePhase.PLAYING,worldSeed:1793146029630,playerCell:{cellId:4337},currentLocationId:'cell_4337',townSim:{675:fixture.town},gameTime:new Date(`0351-01-05T${String(hour).padStart(2,'0')}:00:00Z`),messages} as unknown as GameState);
const tick=(n=1)=>act(()=>vi.advanceTimersByTime(75000*n));
const published=(d:ReturnType<typeof vi.fn>)=>d.mock.calls.map(([a])=>a.payload as GameMessage);
beforeEach(()=>{vi.useFakeTimers();fixture.town=town();});
afterEach(()=>{vi.useRealTimers();});

describe('saved overheard gossip',()=>{
 it('dates one real source and suppresses repeats before the log commits',()=>{
  const d=vi.fn(),s=state(),before=JSON.stringify(fixture.town);
  renderHook(()=>useOverheardGossip(s,d));tick(4);
  expect(d).toHaveBeenCalledTimes(1);
  expect(published(d)[0].text).toContain('56 days ago');
  expect(published(d)[0].metadata?.townGossip).toMatchObject({worldSeed:s.worldSeed,burgId:675,eventId:91,sourceDay:-51,eventKind:'came_of_age',summary:event.summary,heardAtGameMs:s.gameTime.getTime()});
  expect(JSON.stringify(fixture.town)).toBe(before);
 });

 it('uses six game hours rather than wall time and reopens exactly at the boundary',()=>{
  const d=vi.fn(),s=state();
  const {rerender}=renderHook(({value})=>useOverheardGossip(value,d),{initialProps:{value:s}});
  tick(100);expect(d).toHaveBeenCalledTimes(1);
  rerender({value:{...s,gameTime:new Date('0351-01-05T17:59:59Z')}});tick();
  expect(d).toHaveBeenCalledTimes(1);
  rerender({value:{...s,gameTime:new Date('0351-01-05T18:00:00Z')}});tick();expect(d).toHaveBeenCalledTimes(2);
 });

 it('keeps a serialized hearing through remount and expires it after six hours',()=>{
  const d=vi.fn(),first=renderHook(()=>useOverheardGossip(state(),d));tick();first.unmount();
  const saved=JSON.parse(JSON.stringify(published(d))) as GameMessage[],next=vi.fn();
  const {rerender}=renderHook(({value})=>useOverheardGossip(value,next),{initialProps:{value:state(saved,17)}});
  tick(3);expect(next).not.toHaveBeenCalled();
  rerender({value:state(saved,18)});tick();expect(next).toHaveBeenCalledTimes(1);
 });

 it('scopes reused event IDs to their world, town and unchanged event details',()=>{
  const d=vi.fn(),s=state();
  const {rerender}=renderHook(({value})=>useOverheardGossip(value,d),{initialProps:{value:s}});
  tick();fixture.town=town([event],700);
  rerender({value:{...s,messages:published(d)}});tick();
  rerender({value:{...s,worldSeed:s.worldSeed+1,messages:published(d)}});tick();
  fixture.town=town([{...event,day:4,summary:'A different recorded event.'}],700);
  rerender({value:{...s,worldSeed:s.worldSeed+1,messages:published(d)}});tick();
  expect(published(d)).toHaveLength(4);
  expect(published(d)[3].text).toContain('Yesterday');
 });

 it('retains old prose without inventing provenance and admits genuinely new news',()=>{
  const legacy:GameMessage={id:1,sender:'npc',text:'A passerby mutters: "Tib came of age."',timestamp:new Date(),metadata:{type:'banter'}};
  const messages=[legacy],before=JSON.stringify(messages),d=vi.fn(),s=state(messages);
  const {rerender}=renderHook(({value})=>useOverheardGossip(value,d),{initialProps:{value:s}});
  tick(3);expect(d).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(messages)).toBe(before);
  fixture.town=town([event,{...event,id:92,day:5,kind:'festival',summary:'The town held a festival.'}]);
  rerender({value:{...s,messages:[...messages,...published(d)]}});tick();
  expect(published(d)[1].text).toContain('Today');
 });

 it('does not carry unsaved or future hearing into a restored older history',()=>{
  const d=vi.fn(),s=state();
  const {rerender}=renderHook(({value})=>useOverheardGossip(value,d),{initialProps:{value:s}});
  tick();const future=published(d);
  rerender({value:state([],12)});tick();expect(d).toHaveBeenCalledTimes(2);
  rerender({value:state(future,11)});tick();expect(d).toHaveBeenCalledTimes(3);
 });

 it('uses the newest valid hearing and ignores malformed or player-authored provenance',()=>{
  const d=vi.fn(),first=renderHook(()=>useOverheardGossip(state(),d));tick();first.unmount();
  const m=published(d)[0],source=m.metadata!.townGossip as Record<string,unknown>;
  const recent={...m,metadata:{...m.metadata,townGossip:{...source,heardAtGameMs:state([],13).gameTime.getTime()}}};
  const next=vi.fn(),{rerender}=renderHook(({value})=>useOverheardGossip(value,next),{initialProps:{value:state([recent,m],18)}});
  tick();expect(next).not.toHaveBeenCalled();
  rerender({value:state([{...recent,sender:'player'},{...m,metadata:{townGossip:{...source,heardAtGameMs:'invalid'}}}],18)});tick();
  expect(next).toHaveBeenCalledTimes(1);
 });

 it('keeps the headline channel separate without repeating a two-item gossip pool',()=>{
  const d=vi.fn();fixture.town=town([event,{...event,id:92,day:4,kind:'birth'}, {...event,id:93,day:5,kind:'role_succession'}]);
  renderHook(()=>useOverheardGossip(state(),d));tick(5);
  expect(published(d).map(m=>(m.metadata!.townGossip as {eventId:number}).eventId)).toEqual([92,91]);
 });

 it('retains the existing 24-report window rather than silently extending the pool',()=>{
  fixture.town=town(Array.from({length:25},(_,i)=>({...event,id:i+1,day:-i})));
  const d=vi.fn();renderHook(()=>useOverheardGossip(state(),d));tick(30);
  const ids=published(d).map(m=>(m.metadata!.townGossip as {eventId:number}).eventId);
  expect(ids).toHaveLength(24);
  expect(ids).not.toContain(25);
 });

 it('skips invalid time, inactive play, untracked or ambiguous sources, and cleans its interval',()=>{
  const d=vi.fn(),s=state();
  const {rerender,unmount}=renderHook(({value})=>useOverheardGossip(value,d),{initialProps:{value:{...s,gameTime:new Date('invalid')}}});
  tick();rerender({value:{...s,phase:GamePhase.MAIN_MENU}});tick();
  fixture.town=undefined;rerender({value:s});tick();
  fixture.town=town([event,{...event,summary:'Conflicting record.'}]);tick();
  expect(d).not.toHaveBeenCalled();unmount();tick();expect(d).not.toHaveBeenCalled();
 });
});
