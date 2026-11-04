/** Policy fixtures for a physically blocked follower. Frame retries only renew
 * the saved target; PlayerAvatar still owns every admitted footfall. Native
 * play must separately prove that a cleared route produces real movement. */
import React from 'react';
import {act,render} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import PartyGroundActors from '../PartyGroundActors';
import type PlayerAvatar from '../PlayerAvatar';
import type {PartyCompanionPresence} from '@/systems/companions/companionWhereabouts';

const driver=vi.hoisted(()=>({frame:null as null|((state:{clock:{elapsedTime:number}})=>void),avatar:null as unknown as React.ComponentProps<typeof PlayerAvatar>}));
vi.mock('@react-three/fiber',async()=>{
 const React=await import('react');
 return {useFrame(callback:typeof driver.frame){React.useLayoutEffect(()=>{driver.frame=callback;});}};
});
vi.mock('../PlayerAvatar',()=>({default:(props:React.ComponentProps<typeof PlayerAvatar>)=>{driver.avatar=props;return null;}}));

function setup(distance=5,canFollow=true){
 const member={character:{id:'elara_vance',name:'Elara Vance'},position:{xM:0,yM:0,zM:0},trail:[{xM:1,yM:0,zM:0},{xM:distance,yM:0,zM:0}],canFollow} as PartyCompanionPresence;
 const props={members:[member],leader:{current:{xM:distance,yM:0,zM:0}},ground:{},sceneOrigin:{},openDoors:new Set<string>(),onPosition:vi.fn()} as unknown as React.ComponentProps<typeof PartyGroundActors>;
 const view=render(<PartyGroundActors {...props}/>);
 const tick=(time:number)=>act(()=>driver.frame!({clock:{elapsedTime:time}}));
 tick(0);
 return {view,props,member,tick};
}

describe('guarded follower retry',()=>{
 beforeEach(()=>{driver.frame=null;});
 it('retries a stationary leader trail after a bounded wait without relocating anyone',()=>{
  const {props,member,tick}=setup();
  act(()=>driver.avatar.onMovementBlocked?.({xM:0,yM:0,zM:0}));
  tick(.5);expect(driver.avatar.routeTarget?.current).toBeNull();
  tick(.76);expect(driver.avatar.routeTarget?.current).toMatchObject({xM:1,zM:0});
  expect(member.position).toEqual({xM:0,yM:0,zM:0});expect(props.onPosition).not.toHaveBeenCalled();
 });
 it('spaces repeated static obstructions rather than retrying every frame',()=>{
  const {tick}=setup();act(()=>driver.avatar.onMovementBlocked?.({xM:0,yM:0,zM:0}));tick(.76);
  act(()=>driver.avatar.onMovementBlocked?.({xM:0,yM:0,zM:0}));tick(1);
  expect(driver.avatar.routeTarget?.current).toBeNull();tick(1.52);
  expect(driver.avatar.routeTarget?.current).not.toBeNull();
 });
 it('preserves the intentional following gap after a retry',()=>{
  const {tick}=setup(2);act(()=>driver.avatar.onMovementBlocked?.({xM:0,yM:0,zM:0}));tick(1);
  expect(driver.avatar.routeTarget?.current).toBeNull();
 });
 it('does not retry or move while conversation pauses following',()=>{
  const {view,props,tick}=setup();act(()=>driver.avatar.onMovementBlocked?.({xM:0,yM:0,zM:0}));
  view.rerender(<PartyGroundActors {...props} paused/>);tick(100);
  expect(driver.avatar.routeTarget?.current).toBeNull();expect(props.onPosition).not.toHaveBeenCalled();
 });
 it('clears the blocked notice only after an actual reported footfall',()=>{
  const {tick}=setup();act(()=>driver.avatar.onMovementBlocked?.({xM:0,yM:0,zM:0}));tick(1);
  expect(driver.avatar.actorNotice).toContain('blocked');
  act(()=>driver.avatar.onPositionChange?.({xM:.1,yM:0,zM:0}));
  expect(driver.avatar.actorNotice).toBeNull();
 });
 it('observes accumulated small leader steps before the stationary retry deadline',()=>{
  const {props,tick}=setup();act(()=>driver.avatar.onMovementBlocked?.({xM:0,yM:0,zM:0}));
  props.leader.current!.xM=5.05;tick(.1);expect(driver.avatar.routeTarget?.current).toBeNull();
  props.leader.current!.xM=5.10;tick(.2);expect(driver.avatar.routeTarget?.current).toBeNull();
  props.leader.current!.xM=5.16;tick(.3);expect(driver.avatar.routeTarget?.current).not.toBeNull();
 });
 it('does not resume a missing trail from a distant leader',()=>{
  const {props,tick}=setup(5,false);tick(100);
  expect(driver.avatar.routeTarget?.current).toBeNull();expect(props.onPosition).not.toHaveBeenCalled();
 });
});
