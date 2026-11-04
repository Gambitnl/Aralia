import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,render} from '@testing-library/react';
import * as THREE from 'three';
import type {GameState,PlayerCharacter} from '../../../types';
import type {EntityHandle} from '../../../systems/entities3d/three/assembleEntity';
import GroundCarriedTorch from '../GroundCarriedTorch';

const harness=vi.hoisted(()=>({context:null as null|{state:GameState},frame:null as null|(()=>void)}));
vi.mock('../../../state/GameContext',()=>({useOptionalGameState:()=>harness.context}));
vi.mock('@react-three/fiber',()=>({useFrame:(frame:()=>void)=>{harness.frame=frame;}}));
afterEach(()=>{cleanup();harness.context=null;harness.frame=null;});
const character={id:'dara',equippedItems:{OffHand:{id:'shield'}}} as unknown as PlayerCharacter;
function fixture(){
 const now=new Date('0351-01-05T09:12:37Z');
 const source={id:'earned',type:'torch',isActive:true,bearerId:'dara',sourceItem:{id:'torch'},durationRemaining:59,expiresAtGameTime:now.getTime()+59*60000};
 harness.context={state:{party:[character],gameTime:now,inventory:[{id:'torch'}],underdark:{activeLightSources:[source]}} as unknown as GameState};
 const group=new THREE.Group();group.rotation.y=Math.PI/2;
 const handle={group,pose:{anchors:{handR:{pos:new THREE.Vector3(.3,.8,0),quat:new THREE.Quaternion()},handL:{pos:new THREE.Vector3(-.3,.8,0),quat:new THREE.Quaternion()}}}} as unknown as EntityHandle;
 return {source,handle};
}
describe('actual ground carried torch',()=>{
 it('projects a marked held object with both hands occupied, not an unbound Light buff',()=>{
  const {handle}=fixture();
  const full={...character,equippedItems:{MainHand:{id:'mace',lightSpellId:'spell'},OffHand:{id:'shield'}}} as unknown as PlayerCharacter;
  const state=harness.context!.state;state.party=[full];
  state.underdark.activeLightSources=[{id:'spell',name:'Light',type:'spell',isActive:true,radius:40,durationRemaining:60,
    expiresAtGameTime:state.gameTime.getTime()+3600000,objectLight:{spellId:'light',casterId:full.id!,slot:'MainHand',color:'#fff1ca'}}];
  const view=render(<GroundCarriedTorch character={full} handle={handle}/>);
  expect(view.queryByTestId('ground-carried-torch')).toBeNull();
  expect(view.getByTestId('ground-object-light').getAttribute('name')).toContain('spell:handR');
  state.party=[{...full,equippedItems:{}}];view.rerender(<GroundCarriedTorch character={state.party[0]} handle={handle}/>);
  expect(view.queryByTestId('ground-object-light')).toBeNull();
 });
 it('does not light an owned unlit torch or a preview without game state',()=>{
  const {handle}=fixture();harness.context!.state.underdark.activeLightSources=[];
  const view=render(<GroundCarriedTorch character={character} handle={handle}/>);
  expect(view.queryByTestId('ground-carried-torch')).toBeNull();
  harness.context=null;view.rerender(<GroundCarriedTorch character={character} handle={handle}/>);
  expect(view.queryByTestId('ground-carried-torch')).toBeNull();
 });
 it.each(['different bearer','expired','inactive'] as const)('does not project a %s light',kind=>{
  const {source,handle}=fixture();
  if(kind==='different bearer')source.bearerId='someone-else';
  if(kind==='expired')source.expiresAtGameTime=harness.context!.state.gameTime.getTime();
  if(kind==='inactive')source.isActive=false;
  expect(render(<GroundCarriedTorch character={character} handle={handle}/>).queryByTestId('ground-carried-torch')).toBeNull();
 });
 it('follows the actual free hand and model facing without moving the body or extending fuel',async()=>{
  const {handle,source}=fixture(),before=JSON.stringify(source);
  const view=render(<GroundCarriedTorch character={character} handle={handle}/>);
  const root=view.getByTestId('ground-carried-torch'),position=new THREE.Vector3(),quaternion=new THREE.Quaternion();
  Object.assign(root,{position,quaternion});harness.frame!();
  expect(root.getAttribute('name')).toBe('world3d:carried-torch:earned:handR');
  // Exercise Three's actual property writer as well as this DOM harness. A
  // debug data-hand attribute previously passed DOM tests but crashed R3F.
  const {applyProps}=await vi.importActual<typeof import('@react-three/fiber')>('@react-three/fiber');
  const sceneProps=Object.fromEntries([...root.attributes].filter(a=>a.name!=='data-testid').map(a=>[a.name,a.value]));
  const sceneGroup=new THREE.Group();
  expect(()=>applyProps(sceneGroup,sceneProps)).not.toThrow();
  expect(sceneGroup.name).toBe('world3d:carried-torch:earned:handR');
  expect(position.x).toBeCloseTo(0);expect(position.y).toBeCloseTo(.8);expect(position.z).toBeCloseTo(-.3);
  expect(quaternion.equals(handle.group.quaternion)).toBe(true);
  expect(handle.group.position.toArray()).toEqual([0,0,0]);expect(JSON.stringify(source)).toBe(before);
  expect(Number(view.container.querySelector('pointLight')?.getAttribute('distance'))).toBeCloseTo(12.192);
 });
 it('uses the free off hand and removes the visual when the source is extinguished',()=>{
  const {handle}=fixture(),other={...character,equippedItems:{MainHand:{id:'sword'}}} as unknown as PlayerCharacter;
  const view=render(<GroundCarriedTorch character={other} handle={handle}/>);
  expect(view.getByTestId('ground-carried-torch').getAttribute('name')).toBe('world3d:carried-torch:earned:handL');
  harness.context!.state.underdark.activeLightSources=[];view.rerender(<GroundCarriedTorch character={other} handle={handle}/>);
  expect(view.queryByTestId('ground-carried-torch')).toBeNull();
 });
 it.each(['both occupied','two-handed'] as const)('does not invent a spare hand for %s',slots=>{
  const {handle}=fixture();
  const equippedItems=slots==='two-handed'?{MainHand:{id:'greatsword',type:'weapon',properties:['Two-Handed']}}:{MainHand:{id:'sword'},OffHand:{id:'shield'}};
  const full={...character,equippedItems} as unknown as PlayerCharacter;
  expect(render(<GroundCarriedTorch character={full} handle={handle}/>).queryByTestId('ground-carried-torch')).toBeNull();
 });
});
