/** Exercise the real keyboard and avatar together with the native wrapper's
 * requested destination versus ten-hertz accepted-footfall reporting. Separate
 * controller tests cannot detect a movement budget lost between those owners. */
import React, { useCallback, useRef, useState } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import PlayerAvatar from '../PlayerAvatar';
import { GroundKeyboardDriver } from '../useGroundKeyboardControls';
import type { GroundMovementIntent } from '../groundLocomotion';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { PlayerCharacter } from '@/types/character';

const harness = vi.hoisted(() => ({ frames: new Map<number, (state: unknown, dt: number) => void>(), now: 1000, waterY: undefined as number | undefined }));
const camera = new THREE.PerspectiveCamera();
const controls = { target: new THREE.Vector3(0, 1, 0), update: vi.fn() };
vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, dt: number) => void, priority = 0) => harness.frames.set(priority, callback),
  useThree: () => ({ camera, controls }),
}));
vi.mock('@react-three/drei', () => ({ Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/systems/entities3d/parts', () => ({ registerAllParts: vi.fn() }));
vi.mock('@/systems/entities3d/generateEntityBlueprint', () => ({ generateEntityBlueprint: () => ({ frame: {} }) }));
vi.mock('@/systems/entities3d/recipeFromCharacter', () => ({ recipeFromCharacter: () => ({}) }));
vi.mock('@/systems/entities3d/types', () => ({ heightM: () => 1.7 }));
vi.mock('@/systems/entities3d/three/assembleEntity', () => ({
  gameBodyOptions: () => ({}),
  assembleEntity: () => {
    const group = new THREE.Group(), head = new THREE.Group(), mouth = new THREE.Mesh(new THREE.BoxGeometry(.08, .01, .04));
    head.position.y = 1.8; mouth.name = 'mouthLine'; mouth.position.y = -.25; head.add(mouth); group.add(head);
    return { group, retain: vi.fn(), release: vi.fn(), update: vi.fn() };
  },
}));
vi.mock('@/systems/worldforge/bridge/groundWaterSurfaceQuery', () => ({ publishedGroundWaterSurfaceYAt: () => harness.waterY }));
vi.mock('../webgpuWorldFlag', () => ({ isWebGpuWorldEnabled: () => false }));
vi.mock('../worldEntityGpu', () => ({ adaptWorldEntityForWebGpu: vi.fn() }));
vi.mock('../terrain/groundSurfaceYM', () => ({ groundSurfaceYM: () => 0 }));

const ground = { rivers: [], buildings: [], extentMetersX: 1000, extentMetersZ: 1000 } as unknown as GroundWorld;
const character = { name: 'Sana', speed: 30 } as PlayerCharacter;
const origin = { x: 100, z: 100 };
type Feet = { xM: number; zM: number; yM: number };

function NativePair({ intent, report, available = true, requests }: { intent: GroundMovementIntent; report: (feet: Feet) => void; available?: boolean; requests?: (xM: number, zM: number) => void }) {
  const [accepted, setAccepted] = useState<Feet>({ xM: 100, zM: 100, yM: 0 });
  const [, wake] = useState(0);
  const actual = useRef(accepted), target = useRef<{ xM: number; zM: number } | null>(null), lastSavedAt = useRef(0);
  const onPosition = useCallback((feet: Feet) => {
    actual.current = feet; report(feet);
    if (harness.now - lastSavedAt.current >= 100) {
      lastSavedAt.current = harness.now; setAccepted(feet);
      if (target.current && Math.hypot(target.current.xM - feet.xM, target.current.zM - feet.zM) < .02) target.current = null;
    }
  }, [report]);
  const onPick = useCallback((xM: number, zM: number) => { requests?.(xM, zM); target.current = { xM, zM }; wake(v => v + 1); }, [requests]);
  const onStop = useCallback((feet: Feet) => { target.current = null; actual.current = feet; setAccepted(feet); }, []);
  const getFootfall = useCallback(() => actual.current, []);
  const requested = { ...accepted, ...target.current };
  return <>
    <PlayerAvatar ground={ground} groundPos={requested} sceneOrigin={origin} startSurfaceY={0} character={character}
      movementIntent={intent} onPositionChange={onPosition} />
    <GroundKeyboardDriver groundWorld={ground} playerGroundPos={requested} sceneOrigin={origin} character={character}
      movementIntent={intent} getFootfall={getFootfall} onGroundPick={available ? onPick : undefined} onGroundStop={available ? onStop : undefined} />
  </>;
}

describe('native coupled ground movement', () => {
  beforeEach(() => {
    harness.frames.clear(); harness.now = 1000; harness.waterY = undefined;
    camera.position.set(0, 5, 10); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
    controls.target.set(0, 1, 0);
    vi.spyOn(performance, 'now').mockImplementation(() => harness.now);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it.each([[undefined, 1, .05, 40], [.5, 2, .05, 40], [undefined, 1, .016, 125], [.5, 2, .016, 125]] as const)('spends one physical budget at water %s, cost %s, delta %s', (waterY, cost, delta, count) => {
    harness.waterY = waterY;
    const intent: GroundMovementIntent = { sprinting: false }, positions: Feet[] = [];
    const report = (feet: Feet) => positions.push(feet);
    const requests = vi.fn();
    const view = render(<NativePair intent={intent} report={report} requests={requests} />);
    const position = new THREE.Vector3(0, 0, 0);
    Object.assign(view.getByTestId('player-avatar'), { position });
    const frame = () => act(() => {
      harness.now += delta * 1000;
      for (const [, run] of [...harness.frames].sort((a, b) => a[0] - b[0])) run({ clock: { elapsedTime: harness.now / 1000 }, camera, controls }, delta);
    });
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS' })));
    for (let i = 0; i < count; i++) frame();
    act(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 's', code: 'KeyS' })));
    expect(position.z).toBeCloseTo(1.524 * 2 / cost, 5);
    const released = position.clone();
    for (let i = 0; i < 8; i++) frame();
    expect(position.toArray()).toEqual(released.toArray());
    expect(positions.at(-1)?.zM).toBeCloseTo(100 + position.z, 8);
    expect(camera.position.z - controls.target.z).toBeCloseTo(10, 8);
    expect(requests).not.toHaveBeenCalled();
  });

  it('does not arm native movement without an active movement callback', () => {
    const intent: GroundMovementIntent = { sprinting: false }, report = vi.fn();
    const view = render(<NativePair intent={intent} report={report} available={false} />);
    const position = new THREE.Vector3();
    Object.assign(view.getByTestId('player-avatar'), { position });
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS' })));
    act(() => {
      harness.now += 100;
      for (const [, run] of [...harness.frames].sort((a, b) => a[0] - b[0])) run({ clock: { elapsedTime: 1 }, camera, controls }, .1);
    });
    expect(position.toArray()).toEqual([0, 0, 0]);
    expect(intent.keyboardOwnsFeet).not.toBe(true);
  });

  it('stops at the reached feet on blur instead of resuming the old click target', () => {
    const intent: GroundMovementIntent = { sprinting: false }, report = vi.fn();
    const view = render(<NativePair intent={intent} report={report} />);
    const position = new THREE.Vector3();
    Object.assign(view.getByTestId('player-avatar'), { position });
    const frame = () => act(() => {
      harness.now += 50;
      for (const [, run] of [...harness.frames].sort((a, b) => a[0] - b[0])) run({ clock: { elapsedTime: harness.now / 1000 }, camera, controls }, .05);
    });
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS' })));
    for (let i = 0; i < 4; i++) frame();
    act(() => window.dispatchEvent(new Event('blur')));
    const reached = position.clone();
    for (let i = 0; i < 8; i++) frame();
    expect(position.toArray()).toEqual(reached.toArray());
    expect(reached.z).toBeCloseTo(.3048, 7);
  });

  it('detaches held native keys when a modal removes movement admission', () => {
    const intent: GroundMovementIntent = { sprinting: false }, report = vi.fn();
    const view = render(<NativePair intent={intent} report={report} />);
    const position = new THREE.Vector3();
    Object.assign(view.getByTestId('player-avatar'), { position });
    const frame = () => act(() => {
      harness.now += 50;
      for (const [, run] of [...harness.frames].sort((a, b) => a[0] - b[0])) run({ clock: { elapsedTime: harness.now / 1000 }, camera, controls }, .05);
    });
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS' })));
    for (let i = 0; i < 4; i++) frame();
    const reached = position.clone();
    view.rerender(<NativePair intent={intent} report={report} available={false} />);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS' })));
    for (let i = 0; i < 4; i++) frame();
    expect(position.toArray()).toEqual(reached.toArray());
  });
});
