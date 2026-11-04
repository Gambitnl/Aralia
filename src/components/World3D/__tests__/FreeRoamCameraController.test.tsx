import React from 'react';
import {fireEvent, render} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as THREE from 'three';
const fixture = vi.hoisted(() => ({
  frame: null as null | ((state: any, delta: number) => void),
  controlsFrame: null as null | ((state: any, delta: number) => void),
  start: undefined as undefined | (() => void),
  controls: {enabled: true, minDistance: 2, target: {x: 0, y: 0, z: 0,
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; },
    toArray() { return [this.x, this.y, this.z]; }}, update: vi.fn()},
}));
vi.mock('@react-three/fiber', () => ({useFrame: (frame: any, priority = 0) => {
  if (priority < 0) fixture.controlsFrame = frame;
  else fixture.frame = frame;
} }));
vi.mock('@react-three/drei', async () => {
  const React = await import('react');
  const {useFrame} = await import('@react-three/fiber');
  return {MapControls: React.forwardRef((_props, ref) => {
    useFrame(() => { if (fixture.controls.enabled !== false) fixture.controls.update(); }, -1);
    fixture.start = (_props as {onStart?: () => void}).onStart;
    React.useImperativeHandle(ref, () => fixture.controls);
    return null;
  })};
});
import FreeRoamCameraController from '../FreeRoamCameraController';

describe('explicit camera commands', () => {
  beforeEach(() => fixture.controls.update.mockReset());
  it('applies camera damping once per rendered frame before wall corrections', () => {
    const camera = new THREE.PerspectiveCamera();
    render(<FreeRoamCameraController initialTarget={[0,0,0]} sceneOrigin={{x:0,z:0}} onPositionChange={vi.fn()} />);
    fixture.controlsFrame!({camera}, .016);
    fixture.frame!({camera}, .016);
    expect(fixture.controls.update).toHaveBeenCalledTimes(1);
  });
  it('applies the same command refined after the inn geometry loads, once at unchanged feet', () => {
    const camera = new THREE.PerspectiveCamera(), body = [0,1,0] as const, notify = vi.fn();
    let innLoaded = false;
    const view = (position: readonly [number,number,number]) => <FreeRoamCameraController
      initialTarget={body} sceneOrigin={{x:0,z:0}} onPositionChange={notify}
      getPlayerTarget={() => body} playerSightline={(_focus, eye) => innLoaded && eye[2] > 2.5 ? 2.5 : null}
      frameRequest={{kind:'player',nonce:201,target:body,position,height:0}}/>;
    const {rerender} = render(view([0,1,6]));
    fixture.frame!({camera},.1); notify.mockClear();
    innLoaded = true; fixture.frame!({camera},.1);
    expect(camera.position.z).toBeLessThan(3);
    // Streaming discovers a different legal heading at these same feet.
    rerender(view([4,1,0])); fixture.frame!({camera},.1);
    expect(camera.position.toArray()).toEqual([4,1,0]);
    camera.position.set(3.5,1,0);
    fixture.frame!({camera},0);
    expect(camera.position.toArray()).toEqual([3.5,1,0]);
    expect(fixture.controls.target.toArray()).toEqual(body);
    expect(notify).not.toHaveBeenCalled();
  });
  it.each(['keyboard', 'pointer'] as const)('leaves deliberate %s control ahead of a later streamed refinement', input => {
    const camera = new THREE.PerspectiveCamera(), body = [0,1,0] as const;
    const view = (position: readonly [number,number,number], nonce=202) => <FreeRoamCameraController
      initialTarget={body} sceneOrigin={{x:0,z:0}} onPositionChange={vi.fn()}
      getPlayerTarget={() => body} playerSightline={() => null}
      frameRequest={{kind:'player',nonce,target:body,position,height:0}}/>;
    const {rerender} = render(view([0,1,6])); fixture.frame!({camera},.1);
    if (input === 'keyboard') fireEvent.keyDown(window,{code:'KeyW',key:'w'});
    else fixture.start!();
    rerender(view([4,1,0])); fixture.frame!({camera},.1);
    expect(camera.position.toArray()).toEqual([0,1,6]);
    if (input === 'keyboard') fireEvent.keyUp(window,{code:'KeyW',key:'w'});
    // A later explicit To Player is still a new command.
    rerender(view([4,1,0],203)); fixture.frame!({camera},.1);
    expect(camera.position.toArray()).toEqual([4,1,0]);
  });
  it('does not reframe a streamed result around feet that have moved since the command', () => {
    const camera = new THREE.PerspectiveCamera(); let body: readonly [number,number,number] = [0,1,0];
    const view = (position: readonly [number,number,number]) => <FreeRoamCameraController
      initialTarget={[0,1,0]} sceneOrigin={{x:0,z:0}} onPositionChange={vi.fn()}
      getPlayerTarget={() => body} playerSightline={() => null}
      frameRequest={{kind:'player',nonce:204,target:body,position,height:0}}/>;
    const {rerender} = render(view([0,1,6])); fixture.frame!({camera},.1);
    body = [1,1,0]; rerender(view([5,1,0])); fixture.frame!({camera},.1);
    expect(camera.position.toArray()).toEqual([0,1,6]);
    expect(fixture.controls.target.toArray()).toEqual([0,1,0]);
  });
  it('keeps the requested arm over a bank when a higher pitch clears the same heading', () => {
    const camera = new THREE.PerspectiveCamera(), body = [0,1.15,0] as const;
    const radius = Math.hypot(6,1.45);
    // A low eye meets the rising bank after 2.6 m. A higher eye clears it;
    // shortening to about two meters instead makes the lead body crowd/fade.
    const sightline = (focus: readonly number[], eye: readonly number[]) => {
      const horizontal = Math.hypot(eye[0]-focus[0],eye[2]-focus[2]);
      const length = Math.hypot(horizontal,eye[1]-focus[1]);
      return length > 2.6 && eye[1]-focus[1] < horizontal*.45 ? 2.6 : null;
    };
    render(<FreeRoamCameraController initialTarget={body} sceneOrigin={{x:0,z:0}}
      onPositionChange={vi.fn()} minDistance={2} getPlayerTarget={() => body}
      playerSightline={sightline}
      frameRequest={{kind:'player',nonce:106,target:body,position:[0,2.6,6],height:1.45}} />);
    for(let frame=0;frame<20;frame++)fixture.frame!({camera},.1);
    expect(camera.position.distanceTo(new THREE.Vector3(...body))).toBeCloseTo(radius);
    expect(camera.position.y).toBeGreaterThan(body[1]+3);
    expect(camera.position.x).toBeCloseTo(0);
    expect(camera.position.z).toBeGreaterThan(0);
    expect(fixture.controls.target.toArray()).toEqual(body);
    expect(sightline(body,camera.position.toArray())).toBeNull();
  });
  it('keeps a damped turn when a shorter arm clears its requested heading', () => {
    const camera = new THREE.PerspectiveCamera(), body = [0,1,0] as const, notify = vi.fn();
    let turn = false, blocked = true, momentum = 0;
    const controls = fixture.controls as typeof fixture.controls & {enableDamping: boolean};
    controls.enableDamping = true;
    controls.update.mockImplementation(() => {
      if (turn) { camera.position.set(6,1,0); turn = false; momentum = 1; }
      else camera.position.x += momentum;
      momentum *= controls.enableDamping ? .5 : 0;
    });
    render(<FreeRoamCameraController initialTarget={body} sceneOrigin={{x:0,z:0}}
      onPositionChange={notify} minDistance={2} getPlayerTarget={() => body}
      playerSightline={(_focus, eye) => blocked && eye[0] > 2.5 ? 2.5 : null}
      frameRequest={{kind:'player',nonce:105,target:body,position:[0,1,6],height:0}} />);
    fixture.controlsFrame!({camera}, .1); fixture.frame!({camera}, .1); notify.mockClear();
    turn = true; fixture.controlsFrame!({camera}, .1); fixture.frame!({camera}, .1);
    expect(camera.position.x).toBeCloseTo(2.3);
    expect(camera.position.z).toBeCloseTo(0);
    expect(controls.target.toArray()).toEqual(body);
    expect(momentum).toBe(0);
    expect(controls.enableDamping).toBe(true);
    expect(notify).not.toHaveBeenCalled();
    blocked = false;
    for (let frame = 0; frame < 20; frame++) fixture.frame!({camera}, .1);
    expect(camera.position.x).toBeCloseTo(6);
    expect(camera.position.z).toBeCloseTo(0);
  });
  it('rejects an obstructed orbit using the still-clear prior view without moving its focus', () => {
    const camera = new THREE.PerspectiveCamera(), body = [0, 1, 0] as const, notify = vi.fn();
    render(<FreeRoamCameraController initialTarget={body} sceneOrigin={{x:0,z:0}}
      onPositionChange={notify} minDistance={2} getPlayerTarget={() => body}
      playerSightline={(_focus, eye) => eye[0] > .01 ? .1 : null}
      frameRequest={{kind:'player',nonce:101,target:body,position:[0,1,6],height:0}} />);
    fixture.frame!({camera}, .1); notify.mockClear();
    camera.position.set(6, 1, 0);
    fixture.frame!({camera}, .1);
    expect(camera.position.toArray()).toEqual([0, 1, 6]);
    expect(fixture.controls.target.toArray()).toEqual(body);
    expect(notify).not.toHaveBeenCalled();
  });
  it('checks the pose after orbit damping, then drains blocked momentum before restoring a clear view', () => {
    const camera = new THREE.PerspectiveCamera(), body = [0,1,0] as const;
    let momentum = 0;
    const controls = fixture.controls as typeof fixture.controls & {enableDamping: boolean};
    controls.enableDamping = true;
    controls.update.mockImplementation(() => {
      camera.position.x += momentum;
      camera.position.z = Math.sqrt(Math.max(0, 36 - camera.position.x ** 2));
      momentum *= controls.enableDamping ? .5 : 0;
    });
    render(<FreeRoamCameraController initialTarget={body} sceneOrigin={{x:0,z:0}}
      onPositionChange={vi.fn()} minDistance={2} getPlayerTarget={() => body}
      playerSightline={(_focus, eye) => eye[0] > .01 ? .1 : null}
      frameRequest={{kind:'player',nonce:102,target:body,position:[0,1,6],height:0}} />);
    fixture.controlsFrame!({camera}, .1); fixture.frame!({camera}, .1);
    momentum = 6;
    fixture.controlsFrame!({camera}, .1); fixture.frame!({camera}, .1);
    expect(camera.position.toArray()).toEqual([0,1,6]);
    expect(momentum).toBe(0);
    expect(controls.enableDamping).toBe(true);
    fixture.frame!({camera}, .1);
    expect(camera.position.toArray()).toEqual([0,1,6]);
  });
  it('does not restore a remembered view after a door blocks it', () => {
    const camera = new THREE.PerspectiveCamera(), body = [0,1,0] as const;
    let closed = false;
    render(<FreeRoamCameraController initialTarget={body} sceneOrigin={{x:0,z:0}}
      onPositionChange={vi.fn()} getPlayerTarget={() => body}
      playerSightline={(_focus, eye) => closed || eye[0] > .01 ? .1 : null}
      frameRequest={{kind:'player',nonce:103,target:body,position:[0,1,6],height:0}} />);
    fixture.frame!({camera}, .1);
    closed = true; camera.position.set(6,1,0);
    fixture.frame!({camera}, .1);
    expect(camera.position.toArray()).not.toEqual([0,1,6]);
    expect(fixture.controls.target.toArray()).toEqual(body);
  });
  it('does not turn a moving player toward an older clear camera heading', () => {
    const camera = new THREE.PerspectiveCamera(); let body: [number,number,number] = [0,1,0];
    render(<FreeRoamCameraController initialTarget={body} sceneOrigin={{x:0,z:0}}
      onPositionChange={vi.fn()} getPlayerTarget={() => body}
      playerSightline={(focus, eye) => eye[0] - focus[0] > .01 ? .1 : null}
      frameRequest={{kind:'player',nonce:104,target:body,position:[0,1,6],height:0}} />);
    fixture.frame!({camera}, .1);
    body = [1,1,0]; fixture.controls.target.set(...body); camera.position.set(7,1,0);
    fixture.frame!({camera}, .1);
    expect(camera.position.toArray()).toEqual([7,1,0]);
    expect(fixture.controls.target.toArray()).toEqual(body);
  });
  it('restores the requested player distance after a wall clears without another framing command', () => {
    const camera=new THREE.PerspectiveCamera(); let blocked=true;
    const onPositionChange=vi.fn();
    render(<FreeRoamCameraController initialTarget={[0,1,0]} sceneOrigin={{x:0,z:0}}
      onPositionChange={onPositionChange} minDistance={2}
      playerSightline={(_focus,eye)=>blocked&&eye[2]>1.5?1.5:null}
      frameRequest={{kind:'player',nonce:21,target:[0,1,0],position:[0,1,6],height:0}} />);
    fixture.frame!({camera},.1);
    expect(camera.position.z).toBe(1.3);
    // The first tick reports the initial streaming target; recovery must not
    // report another position or turn a camera-radius change into movement.
    onPositionChange.mockClear();
    blocked=false; fixture.frame!({camera},.1);
    expect(camera.position.z).toBeGreaterThan(1.3);
    expect(camera.position.z).toBeLessThan(6);
    for(let i=0;i<30;i++)fixture.frame!({camera},.1);
    expect(camera.position.toArray()).toEqual([0,1,6]);
    expect(fixture.controls.target.toArray()).toEqual([0,1,0]);
    expect(onPositionChange).not.toHaveBeenCalled();
  });
  it('looks under a porch without changing heading, then restores the chosen elevation after leaving it', () => {
    const camera = new THREE.PerspectiveCamera(); let porch = true;
    const onPositionChange = vi.fn(), body = [0, 1, 0] as const;
    const pitch = .8, radius = 6;
    render(<FreeRoamCameraController initialTarget={body} sceneOrigin={{x:0,z:0}}
      onPositionChange={onPositionChange} minDistance={2} getPlayerTarget={() => body}
      playerSightline={(focus, eye) => porch && Math.atan2(eye[1]-focus[1],
        Math.hypot(eye[0]-focus[0],eye[2]-focus[2])) > .35
        && Math.hypot(eye[0]-focus[0],eye[1]-focus[1],eye[2]-focus[2]) > 1.3 ? 1.5 : null}
      frameRequest={{kind:'player',nonce:31,target:body,
        position:[radius*Math.cos(pitch)*.6,1+radius*Math.sin(pitch),radius*Math.cos(pitch)*.8],height:4}} />);
    for(let i=0;i<30;i++)fixture.frame!({camera},.1);
    expect(camera.position.distanceTo(new THREE.Vector3(...body))).toBeCloseTo(radius);
    expect(Math.atan2(camera.position.y-1,Math.hypot(camera.position.x,camera.position.z))).toBeCloseTo(Math.PI/10);
    expect(camera.position.x/camera.position.z).toBeCloseTo(.75);
    expect(fixture.controls.target.toArray()).toEqual(body);
    onPositionChange.mockClear(); porch = false;
    for(let i=0;i<30;i++)fixture.frame!({camera},.1);
    expect(Math.atan2(camera.position.y-1,Math.hypot(camera.position.x,camera.position.z))).toBeCloseTo(pitch);
    expect(camera.position.distanceTo(new THREE.Vector3(...body))).toBeCloseTo(radius);
    expect(camera.position.x/camera.position.z).toBeCloseTo(.75);
    expect(onPositionChange).not.toHaveBeenCalled();
  });
  it('respects a new orbit elevation while using a porch fallback', () => {
    const camera = new THREE.PerspectiveCamera(), body = [0,1,0] as const;
    render(<FreeRoamCameraController initialTarget={body} sceneOrigin={{x:0,z:0}}
      onPositionChange={vi.fn()} minDistance={2} getPlayerTarget={() => body}
      playerSightline={(focus,eye) => eye[1]-focus[1] > 2 ? 1.5 : null}
      frameRequest={{kind:'player',nonce:32,target:body,position:[0,5,5],height:4}} />);
    for(let i=0;i<30;i++)fixture.frame!({camera},.1);
    camera.position.set(0,1+3*Math.sin(.1),3*Math.cos(.1));
    for(let i=0;i<30;i++)fixture.frame!({camera},.1);
    expect(camera.position.y).toBeCloseTo(1+3*Math.sin(.1));
    expect(camera.position.z).toBeCloseTo(3*Math.cos(.1));
  });
  it('retains a deliberate orbit zoom instead of restoring an older player command', () => {
    const camera=new THREE.PerspectiveCamera();
    render(<FreeRoamCameraController initialTarget={[0,1,0]} sceneOrigin={{x:0,z:0}}
      onPositionChange={vi.fn()} minDistance={2} playerSightline={()=>null}
      frameRequest={{kind:'player',nonce:22,target:[0,1,0],position:[0,1,6],height:0}} />);
    fixture.frame!({camera},.1); camera.position.set(0,1,3);
    for(let i=0;i<30;i++)fixture.frame!({camera},.1);
    expect(camera.position.toArray()).toEqual([0,1,3]);
  });
  it('leaves an intentionally panned-away view outside player framing checks', () => {
    const camera = new THREE.PerspectiveCamera(), sightline = vi.fn(() => null);
    render(<FreeRoamCameraController initialTarget={[0, 1, 0]} sceneOrigin={{x: 0, z: 0}}
      onPositionChange={vi.fn()} playerSightline={sightline} getPlayerTarget={() => [0, 1, 0]}
      frameRequest={{kind: 'player', nonce: 9, target: [0, 1, 0], position: [0, 3, 6], height: 2}} />);
    fixture.frame!({camera}, 0.01);
    sightline.mockClear();
    fixture.controls.target.set(10, 1, 0); camera.position.set(10, 3, 6);
    fixture.frame!({camera}, 0.01);
    expect(sightline).not.toHaveBeenCalled();
    expect(camera.position.toArray()).toEqual([10, 3, 6]);
  });
  it('keeps a shortened clear arm instead of dollying it back through the wall next frame', () => {
    const camera = new THREE.PerspectiveCamera();
    fixture.controls.update.mockImplementation(() => {
      if (camera.position.z < fixture.controls.minDistance) camera.position.z = fixture.controls.minDistance;
    });
    render(<FreeRoamCameraController initialTarget={[0, 1, 0]} sceneOrigin={{x: 0, z: 0}}
      onPositionChange={vi.fn()} minDistance={2}
      playerSightline={(_focus, eye) => eye[2] > 1.5 ? 1.5 : null}
      frameRequest={{kind: 'player', nonce: 8, target: [0, 1, 0], position: [0, 1, 6], height: 0}} />);
    fixture.frame!({camera}, 0.01); fixture.frame!({camera}, 0.01);
    expect(camera.position.z).toBe(1.3);
  });
  it('retracts a blocked player arm without moving its focus or reporting movement', () => {
    const camera = new THREE.PerspectiveCamera(), onPositionChange = vi.fn();
    render(<FreeRoamCameraController initialTarget={[0, 0, 0]} sceneOrigin={{x: 0, z: 0}}
      onPositionChange={onPositionChange} minDistance={2}
      playerSightline={(_focus, eye) => eye[2] > 1.5 ? 1.5 : null}
      frameRequest={{kind: 'player', nonce: 4, target: [0, 1, 0], position: [0, 1, 6], height: 0}} />);
    fixture.frame!({camera}, 0.01);
    expect(camera.position.toArray()).toEqual([0, 1, 1.3]);
    expect(fixture.controls.target.toArray()).toEqual([0, 1, 0]);
    expect(onPositionChange).not.toHaveBeenCalled();
  });
  it('follows actual floor height while centered, leaving a deliberately panned view alone', () => {
    const camera = new THREE.PerspectiveCamera(); let height = 1;
    render(<FreeRoamCameraController initialTarget={[0, 0, 0]} sceneOrigin={{x: 0, z: 0}}
      onPositionChange={vi.fn()} getPlayerTarget={() => [0, height, 0]}
      frameRequest={{kind: 'player', nonce: 5, target: [0, 1, 0], position: [0, 3, 6], height: 2}} />);
    fixture.frame!({camera}, 0.01); height = 2.5; fixture.frame!({camera}, 0.01);
    expect(fixture.controls.target.y).toBe(2.5); expect(camera.position.y).toBe(4.5);
    fixture.controls.target.x = 20; height = 4; fixture.frame!({camera}, 0.01);
    expect(fixture.controls.target.y).toBe(2.5); expect(camera.position.y).toBe(4.5);
  });
  it('applies town and player commands with equal counters, then leaves ordinary orbit alone', () => {
    const camera = new THREE.PerspectiveCamera(), onPositionChange = vi.fn();
    const props = {initialTarget: [0, 0, 0] as [number, number, number], sceneOrigin: {x: 100, z: 100}, onPositionChange};
    const {rerender} = render(<FreeRoamCameraController {...props} frameRequest={{kind: 'town', nonce: 1, target: [0, 0, 0], height: 100}} />);
    fixture.frame!({camera}, 0.01);
    expect(camera.position.y).toBe(100);
    rerender(<FreeRoamCameraController {...props} frameRequest={{kind: 'player', nonce: 1, target: [3, 1.15, 4], position: [4, 3, 5], height: 1.85}} />);
    fixture.frame!({camera}, 0.01);
    expect(camera.position.toArray()).toEqual([4, 3, 5]);
    expect(fixture.controls.target.toArray()).toEqual([3, 1.15, 4]);
    camera.position.set(8, 9, 10);
    fixture.frame!({camera}, 0.01);
    expect(camera.position.toArray()).toEqual([8, 9, 10]);
    expect(onPositionChange).not.toHaveBeenCalled();
  });
});


describe('walking-scale camera projection',()=>{
 it('keeps a half-meter-away point inside the frustum on the real sub-meter camera arm',()=>{
  const camera=new THREE.PerspectiveCamera(55,1.6,1,60000),body=[0,1.15,0] as const;
  const update=vi.spyOn(camera,'updateProjectionMatrix'),notify=vi.fn();
  render(<FreeRoamCameraController initialTarget={body} sceneOrigin={{x:0,z:0}} onPositionChange={notify}
   playerSightline={()=>null} getPlayerTarget={()=>body}
   frameRequest={{kind:'player',nonce:91,target:body,position:[0,1.15,.82],height:0}}/>);
  fixture.frame!({camera},.1);camera.lookAt(...body);camera.updateMatrixWorld();
  const point=new THREE.Vector3(0,1.15,.32).project(camera);
  expect(point.z).toBeGreaterThanOrEqual(-1);expect(point.z).toBeLessThanOrEqual(1);
  expect(camera.near).toBeGreaterThan(0);expect(camera.near).toBeLessThan(.1);expect(camera.far).toBe(60000);
  expect(camera.position.toArray()).toEqual([0,1.15,.82]);expect(fixture.controls.target.toArray()).toEqual(body);
  notify.mockClear();fixture.frame!({camera},.01);expect(update).toHaveBeenCalledOnce();expect(notify).not.toHaveBeenCalled();
 });
 it('restores the original projection for town overview and on controller removal',()=>{
  const camera=new THREE.PerspectiveCamera(55,1.6,1,60000),body=[0,1.15,0] as const;
  const props={initialTarget:body,sceneOrigin:{x:0,z:0},onPositionChange:vi.fn(),playerSightline:()=>null,getPlayerTarget:()=>body};
  const {rerender,unmount}=render(<FreeRoamCameraController {...props} frameRequest={{kind:'player',nonce:92,target:body,position:[0,1.15,.82],height:0}}/>);
  fixture.frame!({camera},.01);expect(camera.near).toBeGreaterThan(0);expect(camera.near).toBeLessThan(.1);
  rerender(<FreeRoamCameraController {...props} frameRequest={{kind:'town',nonce:93,target:body,height:100}}/>);
  fixture.frame!({camera},.01);expect(camera.near).toBe(1);expect(camera.far).toBe(60000);
  rerender(<FreeRoamCameraController {...props} frameRequest={{kind:'player',nonce:94,target:body,position:[0,1.15,.82],height:0}}/>);
  fixture.frame!({camera},.01);expect(camera.near).toBeGreaterThan(0);expect(camera.near).toBeLessThan(.1);unmount();expect(camera.near).toBe(1);
 });
 it('preserves a nearer source plane and a later projection owner on removal',()=>{
  const camera=new THREE.PerspectiveCamera(55,1.6,.025,60000),body=[0,1.15,0] as const;
  const {unmount}=render(<FreeRoamCameraController initialTarget={body} sceneOrigin={{x:0,z:0}} onPositionChange={vi.fn()}
   playerSightline={()=>null} getPlayerTarget={()=>body} frameRequest={{kind:'player',nonce:95,target:body,position:[0,1.15,.82],height:0}}/>);
  fixture.frame!({camera},.01);expect(camera.near).toBe(.025);
  camera.near=.125;camera.updateProjectionMatrix();unmount();expect(camera.near).toBe(.125);
 });
});
