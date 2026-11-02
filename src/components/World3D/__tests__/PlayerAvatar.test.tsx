/** Destination changes must stride the existing body, never reset its R3F pose. */
import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {ActorPersonalSpaceContext} from '../ActorPersonalSpaceContext';
import PlayerAvatar from '../PlayerAvatar';
import type { PlayerCharacter } from '@/types/character';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';

const harness = vi.hoisted(() => ({ frame: null as null | ((state: unknown, delta: number) => void), waterY: undefined as number | undefined, wideOnUpdate: false }));
vi.mock('@react-three/fiber', () => ({ useFrame: (frame: typeof harness.frame) => { harness.frame = frame; } }));
vi.mock('@react-three/drei', () => ({ Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/systems/entities3d/parts', () => ({ registerAllParts: vi.fn() }));
vi.mock('@/systems/entities3d/generateEntityBlueprint', () => ({ generateEntityBlueprint: () => ({ frame: {} }) }));
vi.mock('@/systems/entities3d/recipeFromCharacter', () => ({ recipeFromCharacter: () => ({}) }));
vi.mock('@/systems/entities3d/types', () => ({ heightM: () => 1.7 }));
vi.mock('@/systems/entities3d/three/assembleEntity', () => ({
  gameBodyOptions: () => ({}),
  assembleEntity: () => {
    const group = new THREE.Group(), head = new THREE.Group(), mouth = new THREE.Mesh(new THREE.BoxGeometry(.08, .01, .04));
    // Real mouth ink is below a positioned head; its ancestor matrices have
    // not been rendered when PlayerAvatar first measures standing clearance.
    head.position.y = 1.8;
    mouth.name = 'mouthLine'; mouth.position.y = -.25; head.add(mouth); group.add(head);
    return { group, retain: vi.fn(), release: vi.fn(), update: vi.fn(()=>{
      if(harness.wideOnUpdate&&!group.getObjectByName('wideBody')){
        const body=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.7,.8),new THREE.MeshBasicMaterial());
        body.name='wideBody';body.position.y=.85;group.add(body);
      }
    }) };
  },
}));
vi.mock('@/systems/worldforge/bridge/groundWaterSurfaceQuery', () => ({ inspectGroundWater: () => ({status: 'valid', surfaceY: harness.waterY}) }));
vi.mock('../webgpuWorldFlag', () => ({ isWebGpuWorldEnabled: () => false }));
vi.mock('../worldEntityGpu', () => ({ adaptWorldEntityForWebGpu: vi.fn() }));
vi.mock('@/systems/world3d/groundSurfaceYM', () => ({ groundSurfaceYM: (_ground: unknown, x: number) => x / 100 }));

const character = { name: 'Sana' } as PlayerCharacter;
const ground = { rivers: [] } as unknown as GroundWorld;

describe('player avatar movement', () => {
  it('walks a companion from retained feet, holds a paused route and never lifts the camera', () => {
    const target: { current: { xM: number; zM: number } | null } = { current: null };
    const view = render(<PlayerAvatar ground={ground} sceneOrigin={{ x: 100, z: 200 }} startSurfaceY={1}
      character={character} actorId="sana" trackCamera={false} routeTarget={target} groundPos={{ xM: 100, zM: 200, yM: 1 }} />);
    const group = view.getByTestId('companion-avatar-sana'), position = new THREE.Vector3(0, 1, 0);
    Object.assign(group, { position });
    const camera = new THREE.Vector3(0, 10, 10), controls = { target: { y: 1 }, update: vi.fn() };
    const frame = { clock: { elapsedTime: 1 }, camera: { position: camera }, controls };
    target.current = { xM: 105, zM: 200 };
    harness.frame!(frame, .1);
    expect(position.x).toBeCloseTo(.1524);
    expect(position.y).toBeCloseTo(1.001524);
    expect(camera.toArray()).toEqual([0, 10, 10]); expect(controls.target.y).toBe(1); expect(controls.update).not.toHaveBeenCalled();
    target.current = null; const reached = position.clone(); harness.frame!(frame, .1);
    expect(position.toArray()).toEqual(reached.toArray());
    expect(group.getAttribute('position')).toBe('0,1,0');
  });
  beforeEach(() => { harness.frame = null; harness.waterY = undefined; harness.wideOnUpdate = false; });

  it('resolves a new arrival with no ground position instead of preserving the old camera datum', () => {
    const props = { ground, sceneOrigin: { x: 100, z: 200 }, startSurfaceY: 6.166488720703125, character };
    const view = render(<PlayerAvatar {...props} groundPos={null} />);
    expect(view.getByTestId('player-avatar').getAttribute('position')).toBe('0,1,0');
    const position = new THREE.Vector3(0, 1, 0);
    Object.assign(view.getByTestId('player-avatar'), { position });
    act(() => harness.frame!({ clock: { elapsedTime: 1 }, camera: { position: new THREE.Vector3() } }, .1));
    expect(position.toArray()).toEqual([0, 1, 0]);
    expect(view.queryByRole('status')).toBeNull();
  });

  it('holds unsupported accepted footing on mount, idle frames and click requests with a visible explanation', () => {
    const reported = vi.fn(), stopped = vi.fn(), yM = 6.166488720703125;
    const mountedHeights: number[] = [];
    const props = { ground, sceneOrigin: { x: 100, z: 200 }, startSurfaceY: 1,
      character, onPositionChange: reported, onMovementBlocked: stopped,
      walkingSurfaces: { surfaceHeightsAt: () => mountedHeights, intersectsBody: () => false } };
    const view = render(<PlayerAvatar {...props} groundPos={{ xM: 100, zM: 200, yM }} />);
    expect(view.getByTestId('player-avatar').getAttribute('position')).toBe(`0,${yM},0`);
    const position = new THREE.Vector3(0, yM, 0);
    Object.assign(view.getByTestId('player-avatar'), { position });
    const camera = new THREE.Vector3(0, 10, 10);
    act(() => harness.frame!({ clock: { elapsedTime: 1 }, camera: { position: camera } }, .1));
    expect(position.toArray()).toEqual([0, yM, 0]);
    expect(camera.toArray()).toEqual([0, 10, 10]);
    expect(view.getByRole('status').textContent).toMatch(/footing.*unavailable.*movement.*paused/i);
    view.rerender(<PlayerAvatar {...props} groundPos={{ xM: 105, zM: 200, yM }} />);
    act(() => harness.frame!({ clock: { elapsedTime: 2 }, camera: { position: camera } }, .1));
    expect(position.toArray()).toEqual([0, yM, 0]);
    expect(reported).toHaveBeenLastCalledWith({ xM: 100, zM: 200, yM });
    expect(stopped).toHaveBeenLastCalledWith({ xM: 100, zM: 200, yM });
    // A streamed structural surface can qualify these exact feet later. It
    // clears the warning without relocating them or replaying a canceled click.
    view.rerender(<PlayerAvatar {...props} groundPos={{ xM: 100, zM: 200, yM }} />);
    mountedHeights.push(yM);
    act(() => harness.frame!({ clock: { elapsedTime: 3 }, camera: { position: camera } }, .1));
    expect(position.toArray()).toEqual([0, yM, 0]);
    expect(view.queryByRole('status')).toBeNull();
    view.rerender(<PlayerAvatar {...props} groundPos={{ xM: 105, zM: 200, yM }} />);
    act(() => harness.frame!({ clock: { elapsedTime: 4 }, camera: { position: camera } }, .1));
    expect(position.x).toBeCloseTo(.1524);
    expect(position.y).toBe(yM);
  });

  it('keeps the reconciler anchor stable and reports real, speed-bounded footfalls', () => {
    const reported = vi.fn();
    const origin = { x: 100, z: 200 };
    const props = { ground, sceneOrigin: origin, startSurfaceY: 1, character, onPositionChange: reported };
    const view = render(<PlayerAvatar {...props} groundPos={{ xM: 100, zM: 200 }} />);
    const group = view.getByTestId('player-avatar');
    expect(group.getAttribute('position')).toBe('0,1,0');
    // JSDOM does not reconcile Three objects. Supply the actual mutable pose
    // that R3F owns, and independently assert the position prop stays stable.
    const position = new THREE.Vector3(0, 1, 0);
    Object.assign(group, { position });
    view.rerender(<PlayerAvatar {...props} groundPos={{ xM: 105, zM: 200 }} />);
    expect(group.getAttribute('position')).toBe('0,1,0');
    harness.frame!({ clock: { elapsedTime: 1 }, camera: { position: new THREE.Vector3() } }, 0.1);
    expect(position.x).toBeCloseTo(.1524);
    expect(position.y).toBeCloseTo(1.001524);
    expect(reported).toHaveBeenLastCalledWith({ xM: expect.closeTo(100.1524, 8), zM: 200, yM: expect.closeTo(1.001524, 8) });
    for (let i = 0; i < 200; i++) harness.frame!({ clock: { elapsedTime: 2 + i / 10 }, camera: { position: new THREE.Vector3() } }, 0.1);
    expect(position.x).toBeCloseTo(5);
    expect(position.x).toBeLessThanOrEqual(5);
  });

  it('uses character pace and shared Shift intent for clicks without jumping after a stalled frame', () => {
    const movementIntent = { sprinting: false };
    const props = { ground, sceneOrigin: { x: 100, z: 200 }, startSurfaceY: 1,
      character: { ...character, speed: 20 }, movementIntent };
    const view = render(<PlayerAvatar {...props} groundPos={{ xM: 100, zM: 200 }} />);
    const position = new THREE.Vector3(0, 1, 0);
    Object.assign(view.getByTestId('player-avatar'), { position });
    view.rerender(<PlayerAvatar {...props} groundPos={{ xM: 110, zM: 200 }} />);
    const frame = { clock: { elapsedTime: 1 }, camera: { position: new THREE.Vector3() } };
    harness.frame!(frame, .1);
    expect(position.x).toBeCloseTo(.1016);
    movementIntent.sprinting = true;
    harness.frame!(frame, 2);
    expect(position.x).toBeCloseTo(.3048);
    movementIntent.sprinting = false;
    harness.frame!(frame, .1);
    expect(position.x).toBeCloseTo(.4064);
  });

  it('preserves a zero-speed character instead of inventing a default walking pace', () => {
    const props = { ground, sceneOrigin: { x: 100, z: 200 }, startSurfaceY: 1,
      character: { ...character, speed: 0 }, movementIntent: { sprinting: true } };
    const view = render(<PlayerAvatar {...props} groundPos={{ xM: 100, zM: 200 }} />);
    const position = new THREE.Vector3(0, 1, 0);
    Object.assign(view.getByTestId('player-avatar'), { position });
    view.rerender(<PlayerAvatar {...props} groundPos={{ xM: 105, zM: 200 }} />);
    harness.frame!({ clock: { elapsedTime: 1 }, camera: { position: new THREE.Vector3() } }, 1);
    expect(position.toArray()).toEqual([0, 1, 0]);
  });

  it('reanchors on a genuine ground change without reusing the old scene pose', () => {
    const props = { ground, sceneOrigin: { x: 100, z: 200 }, startSurfaceY: 1, character };
    const view = render(<PlayerAvatar {...props} groundPos={{ xM: 100, zM: 200 }} />);
    view.rerender(<PlayerAvatar {...props} sceneOrigin={{ x: 300, z: 400 }} groundPos={{ xM: 305, zM: 410 }} />);
    expect(view.getByTestId('player-avatar').getAttribute('position')).toBe('5,3.05,10');
  });

  it('stops the visible body at a thin wall and reports reached position to cancel the destination', () => {
    const solidGround = { rivers: [], buildings: [{ xM: 0, zM: 0,
      cornersM: [{ x: -5, z: -5 }, { x: 5, z: -5 }, { x: 5, z: 5 }, { x: -5, z: 5 }],
      parts: [{ x: 0, z: 0, w: 0.1, d: 8, h: 3, colorHex: '#cfc7b8' }],
    }] } as unknown as GroundWorld;
    const stopped = vi.fn();
    const props = { ground: solidGround, sceneOrigin: { x: 0, z: 0 }, startSurfaceY: 0, character, onMovementBlocked: stopped };
    const view = render(<PlayerAvatar {...props} groundPos={{ xM: -0.5, zM: 0 }} />);
    const position = new THREE.Vector3(-0.5, 0, 0);
    Object.assign(view.getByTestId('player-avatar'), { position });
    view.rerender(<PlayerAvatar {...props} groundPos={{ xM: 3, zM: 0 }} />);
    act(() => harness.frame!({ clock: { elapsedTime: 1 }, camera: { position: new THREE.Vector3() } }, 0.1));
    expect(position.x).toBeCloseTo(-0.351);
    expect(stopped).toHaveBeenLastCalledWith({ xM: position.x, zM: 0, yM: position.y });
    expect(view.getByTestId('ground-movement-blocked').textContent).toContain('That direction was blocked');
    // Releasing input preserves the refusal long enough to read it. A new
    // permitted approach clears it without moving the wall or resetting feet.
    const reached = position.clone();
    view.rerender(<PlayerAvatar {...props} groundPos={{ xM: reached.x, zM: reached.z, yM: reached.y }} />);
    act(() => harness.frame!({ clock: { elapsedTime: 2 }, camera: { position: new THREE.Vector3() } }, .1));
    expect(position.toArray()).toEqual(reached.toArray());
    expect(view.getByTestId('ground-movement-blocked')).toBeTruthy();
    view.rerender(<PlayerAvatar {...props} groundPos={{ xM: -2, zM: 0 }} />);
    act(() => harness.frame!({ clock: { elapsedTime: 3 }, camera: { position: new THREE.Vector3() } }, .1));
    expect(position.x).toBeLessThan(reached.x);
    expect(view.queryByTestId('ground-movement-blocked')).toBeNull();
  });

  it('uses actual body anatomy and the water budget for a click stride, with visible wading feedback', () => {
    harness.waterY = 2.3; // Authored query fixture: 1.3 m over the supported 1 m feet.
    const props = { ground, sceneOrigin: { x: 100, z: 200 }, startSurfaceY: 1, character };
    const view = render(<PlayerAvatar {...props} groundPos={{ xM: 100, zM: 200, yM: 1 }} />);
    const position = new THREE.Vector3(0, 1, 0);
    Object.assign(view.getByTestId('player-avatar'), { position });
    view.rerender(<PlayerAvatar {...props} groundPos={{ xM: 105, zM: 200 }} />);
    act(() => harness.frame!({ clock: { elapsedTime: 1 }, camera: { position: new THREE.Vector3() } }, .1));
    expect(position.x).toBeCloseTo(.0762);
    expect(view.getByTestId('ground-water-notice').textContent).toContain('extra movement');
    expect(position.y).toBeCloseTo((100 + position.x) / 100);
  });
  it('refuses a visible resident and admits the same step after that body unmounts',()=>{
    const space=new Map([['resident:rosa',{xM:100.3,zM:200,yM:1,radiusM:.3,heightM:1.8}]]);
    const stopped=vi.fn();
    const view=render(<ActorPersonalSpaceContext.Provider value={space}><PlayerAvatar ground={ground} sceneOrigin={{x:100,z:200}}
      startSurfaceY={1} character={character} groundPos={{xM:105,zM:200,yM:1}} onMovementBlocked={stopped}/></ActorPersonalSpaceContext.Provider>);
    const group=view.getByTestId('player-avatar'),position=new THREE.Vector3(0,1,0);
    Object.assign(group,{position});
    const frame={clock:{elapsedTime:1},camera:{position:new THREE.Vector3(0,10,10)}};
    act(()=>harness.frame!(frame,.1));
    expect(position.x).toBe(0);expect(stopped).toHaveBeenCalled();
    expect(view.getByTestId('ground-movement-blocked').textContent).toMatch(/blocked/i);
    expect(space.get('player')?.xM).toBe(100);
    space.delete('resident:rosa');
    act(()=>harness.frame!(frame,.1));
    expect(position.x).toBeGreaterThan(0);
    expect(view.queryByTestId('ground-movement-blocked')).toBeNull();
    view.unmount();expect(space.has('player')).toBe(false);
  });

  it('reserves the fully posed body rather than its smaller assembly placeholder',()=>{
    harness.wideOnUpdate=true;
    const space=new Map([['resident:rosa',{xM:100.9,zM:200,yM:1,radiusM:.3,heightM:1.8}]]);
    const view=render(<ActorPersonalSpaceContext.Provider value={space}><PlayerAvatar ground={ground} sceneOrigin={{x:100,z:200}} startSurfaceY={1} character={character} groundPos={{xM:105,zM:200,yM:1}}/></ActorPersonalSpaceContext.Provider>);
    const position=new THREE.Vector3(0,1,0);Object.assign(view.getByTestId('player-avatar'),{position});
    act(()=>harness.frame!({clock:{elapsedTime:1},camera:{position:new THREE.Vector3()}},.1));
    expect(position.x).toBe(0);expect(space.get('player')!.radiusM).toBeGreaterThan(.7);
  });

  it('uses the drawn box to pass a neighbor whose circular margin is empty',()=>{
    const space=new Map([['resident:rosa',{xM:100.5,zM:200.5,yM:1,radiusM:.8,heightM:1.8,footprint:{minXM:-.1,maxXM:.1,minZM:-.1,maxZM:.1,yawRad:0}}]]);
    const view=render(<ActorPersonalSpaceContext.Provider value={space}><PlayerAvatar ground={ground} sceneOrigin={{x:100,z:200}} startSurfaceY={1} character={character} groundPos={{xM:105,zM:200,yM:1}}/></ActorPersonalSpaceContext.Provider>);
    const position=new THREE.Vector3(0,1,0);Object.assign(view.getByTestId('player-avatar'),{position});
    act(()=>harness.frame!({clock:{elapsedTime:1},camera:{position:new THREE.Vector3()}},.1));
    expect(position.x).toBeGreaterThan(0);expect(view.queryByTestId('ground-movement-blocked')).toBeNull();
    expect(space.get('player')).toHaveProperty('footprint.minXM');expect(space.get('player')).toHaveProperty('footprint.maxZM');
  });

});

describe('GG-537 load step for saved feet that lost their support', () => {
  beforeEach(() => { harness.frame = null; harness.waterY = undefined; harness.wideOnUpdate = false; });
  // The terrain mock rises 0.01 m per meter of x; at x = 100 m it stands at 1 m.
  const sinzheimGround = { rivers: [], extentMetersX: 1000, extentMetersZ: 1000 } as unknown as GroundWorld;
  const yM = 8.45;

  it('seats the body on the ground below once the full-detail chunk mounts, and says so', () => {
    const stopped = vi.fn();
    let ready = false;
    const props = { ground: sinzheimGround, sceneOrigin: { x: 100, z: 200 }, startSurfaceY: 1, character, onMovementBlocked: stopped,
      walkingSurfaces: { surfaceHeightsAt: () => [], intersectsBody: () => false, supportReadyAt: () => ready } };
    const view = render(<PlayerAvatar {...props} groundPos={{ xM: 100, zM: 200, yM }} />);
    const position = new THREE.Vector3(0, yM, 0);
    Object.assign(view.getByTestId('player-avatar'), { position });
    const camera = new THREE.Vector3(0, 10, 10), controls = { target: { x: 0, y: 1, z: 0 }, update: vi.fn() };
    // Before the chunk under the feet mounts, the old refusal stands and nothing moves.
    act(() => harness.frame!({ clock: { elapsedTime: 1 }, camera: { position: camera }, controls }, .1));
    expect(position.toArray()).toEqual([0, yM, 0]);
    expect(view.getByTestId('ground-footing-unavailable')).toBeTruthy();
    ready = true;
    act(() => harness.frame!({ clock: { elapsedTime: 2 }, camera: { position: camera }, controls }, .1));
    expect(position.x).toBeCloseTo(0); expect(position.z).toBeCloseTo(0); expect(position.y).toBeCloseTo(1);
    expect(stopped).toHaveBeenCalledWith({ xM: 100, zM: 200, yM: expect.closeTo(1, 6) });
    // The view moves down with the body, as it does for a climb.
    expect(camera.y).toBeCloseTo(10 - 7.45); expect(controls.target.y).toBeCloseTo(1 - 7.45);
    // 8.45 - 1 is 7.4499... in floating point, so the notice rounds to 7.4.
    expect(view.getByTestId('ground-footing-reseated').textContent)
      .toBe('The ground or water here changed since this save. You were moved 7.4 m to the nearest ground to stand.');
    expect(view.queryByTestId('ground-footing-unavailable')).toBeNull();
    // The step runs once per load: later frames neither move nor re-announce it.
    stopped.mockClear();
    act(() => harness.frame!({ clock: { elapsedTime: 3 }, camera: { position: camera }, controls }, .1));
    expect(position.y).toBeCloseTo(1); expect(stopped).not.toHaveBeenCalled();
  });

  it('leaves supported saved feet exactly where they are', () => {
    const stopped = vi.fn();
    const props = { ground: sinzheimGround, sceneOrigin: { x: 100, z: 200 }, startSurfaceY: 1, character, onMovementBlocked: stopped,
      walkingSurfaces: { surfaceHeightsAt: () => [yM], intersectsBody: () => false, supportReadyAt: () => true } };
    const view = render(<PlayerAvatar {...props} groundPos={{ xM: 100, zM: 200, yM }} />);
    const position = new THREE.Vector3(0, yM, 0);
    Object.assign(view.getByTestId('player-avatar'), { position });
    act(() => harness.frame!({ clock: { elapsedTime: 1 }, camera: { position: new THREE.Vector3(0, 10, 10) } }, .1));
    expect(position.toArray()).toEqual([0, yM, 0]);
    expect(stopped).not.toHaveBeenCalled();
    expect(view.queryByTestId('ground-footing-reseated')).toBeNull();
  });
});
