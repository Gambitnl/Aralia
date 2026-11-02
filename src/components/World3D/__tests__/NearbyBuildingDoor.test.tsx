/** Nearby entry actions use actual feet, mounted source doors and the existing
 * door callback. Stale prompts and crossing residents must never toggle a leaf. */
import React from 'react';
import {act,cleanup,render} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {GroundFurnishingContext} from '../GroundFurnishingContext';
import {createGroundDoorStore} from '../groundDoorStore';
import {mountedBuildingDoors,nearestBuildingDoor,NearbyBuildingDoor,type NearbyBuildingDoorAction} from '../NearbyBuildingDoor';
import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {LoadedChunk} from '@/systems/world3d/types';
import type {AvatarFootfall} from '../groundFurnishingInteraction';
const f=vi.hoisted(()=>({frame:null as null|((state:unknown,delta:number)=>void)}));
vi.mock('@react-three/fiber',()=>({useFrame:(fn:typeof f.frame)=>{f.frame=fn;}}));
vi.mock('@/systems/world3d/groundSurfaceYM',()=>({groundSurfaceYM:()=>4}));
afterEach(cleanup);
function fixture(){
  const part={x:0,z:0,w:.9144,d:.06,h:2.13,colorHex:'#65462f',door:{id:'entry',level:0,index:0,axis:'x' as const,swingX:0,swingZ:1}};
  const building={id:'wf-plot-675-35',name:'The Howling Shield',xM:100,zM:200,cornersM:[{x:95,z:195},{x:105,z:195},{x:105,z:205},{x:95,z:205}],parts:[part]};
  const ground={buildings:[building,{...building,id:'wf-plot-675-36'},{...building,id:'not-a-town-door'}]} as unknown as GroundWorld;
  const loaded=[{bundle:{sites:[{id:building.id},{id:'not-a-town-door'}]}}] as LoadedChunk[];
  const candidates=[{id:building.id+'/entry',name:building.name,pick:{siteId:building.id,part,transform:{groupX:100,groupZ:200,surfaceY:4,rotationY:0,doorZSign:-1}}}];
  return {ground,loaded,candidates,feet:{xM:100,zM:200.8,yM:4} as AvatarFootfall|null};
}
describe('nearest mounted town door',()=>{
  it('retains source part identity and excludes unloaded or non-town buildings',()=>{
    const q=fixture(),doors=mountedBuildingDoors(q.ground,q.loaded);
    expect(doors).toHaveLength(1);expect(doors[0].pick.part).toBe(q.candidates[0].pick.part);
    expect(doors[0].pick.transform.surfaceY).toBe(4);
  });
  for(const yaw of [0,.7])for(const sign of [-1,1])it(`uses real body reach under yaw ${yaw}, sign ${sign}`,()=>{
    const q=fixture(),p=q.candidates[0].pick;p.transform.rotationY=yaw;p.transform.doorZSign=sign;
    const localZ=.8*-sign;
    const feet={xM:100+Math.sin(yaw)*localZ,zM:200+Math.cos(yaw)*localZ,yM:4};
    expect(nearestBuildingDoor(q.candidates,feet,new Set())?.candidate).toBe(q.candidates[0]);
  });
  it('withholds absent, remote, invalid and other-floor bodies',()=>{
    const q=fixture();for(const feet of [null,{xM:100,zM:204,yM:4},{xM:100,zM:200,yM:7},{xM:NaN,zM:200,yM:4}])
      expect(nearestBuildingDoor(q.candidates,feet,new Set())).toBeNull();
  });
  it('measures the actual swung leaf rather than retaining the closed rectangle',()=>{
    const q=fixture(),opens=new Set([q.candidates[0].id]);
    const found=nearestBuildingDoor(q.candidates,{xM:98.2,zM:200.8,yM:4},opens);
    expect(found?.open).toBe(true);
    expect(nearestBuildingDoor(q.candidates,{xM:98.2,zM:200.8,yM:4},new Set())).toBeNull();
  });
});
describe('live nearby door publisher',()=>{
  function setup(){
    const q=fixture(),onDoor=vi.fn(),onChange=vi.fn();let enabled=true;
    // GG-580: door state reaches the publisher through the scene's door store.
    const doors=createGroundDoorStore({openDoors:new Set<string>(),doorUsers:new Map<string,readonly string[]>()});
    const context={origin:{x:0,z:0},onDoor,doors};
    const view=()=> <GroundFurnishingContext.Provider value={context}><NearbyBuildingDoor ground={q.ground} loaded={q.loaded} enabled={enabled} readFootfall={()=>q.feet} onChange={onChange}/></GroundFurnishingContext.Provider>;
    const rendered=render(view());const frame=()=>act(()=>{f.frame!({},.11);});
    const action=()=>onChange.mock.calls.at(-1)?.[0] as NearbyBuildingDoorAction|null;
    return {q,onDoor,onChange,rendered,frame,action,pause:()=>{enabled=false;rendered.rerender(view());},unload:()=>{q.loaded=[];rendered.rerender(view());},open:()=>{act(()=>doors.set({...doors.read(),openDoors:new Set([q.candidates[0].id])}));},users:()=>{act(()=>doors.set({...doors.read(),doorUsers:new Map([[q.candidates[0].id,['Fenna Hartham']]])}));}};
  }
  it('publishes a single nearby action and delegates without selecting from a camera or moving feet',()=>{
    const t=setup(),before=JSON.stringify(t.q.feet);t.frame();t.frame();
    expect(t.onChange).toHaveBeenCalledTimes(1);act(()=>t.action()!.activate());
    expect(t.onDoor).toHaveBeenCalledOnce();expect(JSON.stringify(t.q.feet)).toBe(before);
  });
  it('rechecks feet when an old button is activated',()=>{
    const t=setup();t.frame();const old=t.action()!;t.q.feet={xM:100,zM:210,yM:4};
    act(()=>old.activate());expect(t.onDoor).not.toHaveBeenCalled();t.frame();expect(t.action()).toBeNull();
  });
  it('preserves crossing residents priority even before the next prompt refresh',()=>{
    const t=setup();t.frame();const old=t.action()!;t.users();act(()=>old.activate());
    expect(t.onDoor).not.toHaveBeenCalled();t.frame();expect(t.action()?.users).toEqual(['Fenna Hartham']);
  });
  it('disarms old actions while paused and after unmount',()=>{
    const t=setup();t.frame();const old=t.action()!;t.pause();act(()=>old.activate());
    expect(t.onDoor).not.toHaveBeenCalled();t.rendered.unmount();act(()=>old.activate());
    expect(t.onDoor).not.toHaveBeenCalled();expect(t.action()).toBeNull();
  });
  it('does not invert a door that changed since the displayed verb',()=>{
    const t=setup();t.frame();const old=t.action()!;t.open();act(()=>old.activate());
    expect(t.onDoor).not.toHaveBeenCalled();t.frame();expect(t.action()?.open).toBe(true);
  });
  it('disarms a prompt when its source leaves the mounted set',()=>{
    const t=setup();t.frame();const old=t.action()!;t.unload();act(()=>old.activate());
    expect(t.onDoor).not.toHaveBeenCalled();t.frame();expect(t.action()).toBeNull();
  });
});
