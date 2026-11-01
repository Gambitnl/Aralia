/** Reached furnishings must use the ordinary physical examination owner;
 * prompts cannot authorize other rooms, old sources or paused interactions. */
import React from 'react';
import {act,cleanup,render} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {GroundFurnishingContext} from '../GroundFurnishingContext';
import {mountedFurnishings,nearbyFurnishingCandidates,NearbyFurnishing,type NearbyFurnishingAction} from '../NearbyFurnishing';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {LoadedChunk} from '@/systems/world3d/types';
import type {BlueprintPlan} from '@/systems/worldforge/interior/blueprintTypes';
import type {AvatarFootfall} from '../groundFurnishingInteraction';
const f=vi.hoisted(()=>({frame:null as null|((state:unknown,delta:number)=>void)}));
vi.mock('@react-three/fiber',()=>({useFrame:(fn:typeof f.frame)=>{f.frame=fn;}}));
vi.mock('../terrain/groundSurfaceYM',()=>({groundSurfaceYM:()=>4}));
afterEach(cleanup);

function fixture(){
 const part={x:0,z:0,w:.8,d:.5,h:.8,colorHex:'#65462f',furnishing:{level:0,index:0,roomId:0,kind:'desk'}};
 const building={id:'wf-plot-40-56',xM:100,zM:200,cornersM:[{x:95,z:195},{x:105,z:195},{x:105,z:205},{x:95,z:205}],parts:[part,{...part}]};
 const ground={buildings:[building,{...building,id:'wf-plot-40-57'},{...building,id:'not-town'}]} as unknown as GroundWorld;
 const loaded=[{bundle:{sites:[{id:building.id},{id:'not-town'}]}}] as LoadedChunk[];
 const plan={widthFt:10,depthFt:5,siteOriginFt:{x:2.5,y:2.5},floors:[{level:0,rooms:[
  {id:0,cells:[{cx:0,cy:0}],purpose:'study'},{id:1,cells:[{cx:1,cy:0}],purpose:'study'}],
  furnishings:[{kind:'desk',roomId:0,x:2.5,y:2.5,rotation:0}]}]} as BlueprintPlan;
 return {ground,loaded,plan,feet:{xM:100,zM:200,yM:4} as AvatarFootfall|null};
}

describe('mounted furnishing nomination',()=>{
 it('keeps one original pick per furnishing and excludes unloaded/non-town sources',()=>{
  const q=fixture(),c=mountedFurnishings(q.ground,q.loaded);
  expect(c).toHaveLength(1);expect(c[0].pick.part).toBe(q.ground.buildings[0].parts[0]);
  expect(c[0].name).toBe('desk');
 });
 it('does not nominate absent, invalid, remote or other-floor feet',()=>{
  const q=fixture(),c=mountedFurnishings(q.ground,q.loaded);
  for(const feet of [null,{xM:NaN,zM:200,yM:4},{xM:110,zM:200,yM:4},{xM:100,zM:200,yM:7}])
   expect(nearbyFurnishingCandidates(c,feet)).toEqual([]);
 });
});

describe('live furnishing publisher',()=>{
 function setup(){
  const q=fixture(),onSelect=vi.fn(),onChange=vi.fn();let enabled=true;
  let resolvePlan=vi.fn(async()=>q.plan);
  const view=()=> <GroundFurnishingContext.Provider value={{origin:{x:0,z:0},onSelect}}><NearbyFurnishing ground={q.ground} loaded={q.loaded} enabled={enabled} readFootfall={()=>q.feet} resolvePlan={resolvePlan} onChange={onChange}/></GroundFurnishingContext.Provider>;
  const rendered=render(view());
  const frame=()=>act(()=>{f.frame!({},.11);});
  const ready=async()=>{frame();await act(async()=>{await Promise.resolve();});frame();};
  const actions=()=>onChange.mock.calls.at(-1)?.[0] as NearbyFurnishingAction[];
  return {q,onSelect,onChange,rendered,ready,frame,actions,
   pause:()=>{enabled=false;rendered.rerender(view());},
   unload:()=>{q.loaded=[];rendered.rerender(view());},
   invalidate:()=>{resolvePlan=vi.fn(async()=>({...q.plan,floors:[]}));rendered.rerender(view());}};
 }
 it('loads only a reached plan, then delegates the real pick once without changing feet',async()=>{
  const t=setup(),before=JSON.stringify(t.q.feet);await t.ready();
  expect(t.actions()).toHaveLength(1);act(()=>t.actions()[0].activate());
  expect(t.onSelect.mock.calls[0][0].part).toBe(t.q.ground.buildings[0].parts[0]);
  expect(t.onSelect.mock.calls[0][0].siteId).toBe('wf-plot-40-56');
  expect(t.onSelect).toHaveBeenCalledTimes(1);expect(JSON.stringify(t.q.feet)).toBe(before);
 });
 it('refreshes location hints while the same source remains reached',async()=>{
  const t=setup();t.q.feet={xM:100.7,zM:200,yM:4};await t.ready();
  const before=t.actions()[0];
  expect(before.detail).toBe('study · west · 1 ft away');
  t.q.feet={xM:99.3,zM:200,yM:4};t.frame();
  expect(t.actions()[0].id).toBe(before.id);
  expect(t.actions()[0].detail).toBe('study · east · 1 ft away');
  expect(t.onSelect).not.toHaveBeenCalled();
 });
 it('describes a rotated site in world directions without replacing its receipt',async()=>{
  const t=setup();
  // The same 5-ft room is rotated clockwise from its local frame into world Z.
  t.q.ground.buildings[0].cornersM=[{x:95,z:205},{x:95,z:195},{x:105,z:195},{x:105,z:205}];
  t.q.feet={xM:100,zM:200.7,yM:4};
  t.rendered.unmount();
  const onChange=vi.fn();render(<GroundFurnishingContext.Provider value={{origin:{x:0,z:0},onSelect:t.onSelect}}>
    <NearbyFurnishing ground={t.q.ground} loaded={t.q.loaded} enabled readFootfall={()=>t.q.feet} resolvePlan={async()=>t.q.plan} onChange={onChange}/>
  </GroundFurnishingContext.Provider>);
  act(()=>f.frame!({},.11));await act(async()=>{await Promise.resolve();});act(()=>f.frame!({},.11));
  const actions=onChange.mock.calls.at(-1)![0] as NearbyFurnishingAction[];
  expect(actions[0].detail).toBe('study · north · 1 ft away');
  act(()=>actions[0].activate());expect(t.onSelect.mock.calls[0][0].part).toBe(t.q.ground.buildings[0].parts[0]);
 });
 it('withholds a nearby piece across the room boundary',async()=>{
  const t=setup();t.q.feet={xM:101,zM:200,yM:4};await t.ready();expect(t.actions()).toEqual([]);
 });
 it.each(['pause','unload'] as const)('withdraws on %s and rejects a retained action',async(kind)=>{
  const t=setup();await t.ready();const old=t.actions()[0];t[kind]();t.frame();
  expect(t.actions()).toEqual([]);act(()=>old.activate());expect(t.onSelect).not.toHaveBeenCalled();
 });
 it('rejects a retained action after walking out of reach',async()=>{
  const t=setup();await t.ready();const old=t.actions()[0];t.q.feet={xM:106,zM:200,yM:4};
  act(()=>old.activate());expect(t.onSelect).not.toHaveBeenCalled();t.frame();expect(t.actions()).toEqual([]);
 });
 it('clears the old plan and prompt when source history changes',async()=>{
  const t=setup();await t.ready();const old=t.actions()[0];t.invalidate();t.frame();
  expect(t.actions()).toEqual([]);act(()=>old.activate());expect(t.onSelect).not.toHaveBeenCalled();
  await t.ready();expect(t.actions()).toEqual([]);
 });
 it('does not permit an action retained after unmount',async()=>{
  const t=setup();await t.ready();const old=t.actions()[0];t.rendered.unmount();
  expect(t.actions()).toEqual([]);act(()=>old.activate());expect(t.onSelect).not.toHaveBeenCalled();
 });
});
