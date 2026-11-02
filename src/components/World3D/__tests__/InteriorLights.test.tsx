/**
 * @file InteriorLights.test.tsx
 * Interior-lighting slice. Covers the load-bearing PURE selector
 * (collectInteriorLighting) — hearth world-position projection and shell-bounds
 * extraction from loaded chunks — plus a smoke render proving the component
 * mounts the capped light set (or nothing) without a WebGL context.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { chunkOriginWorld } from '@/systems/world3d/coords';
import { sunFromTime } from '../World3DLighting';
import { markInteriorLive } from '../liveInteriors';
import type { LoadedChunk } from '@/systems/world3d/types';
import InteriorLights, {
  collectInteriorLighting,
  INTERIOR_LIGHT_TUNING,
} from '../InteriorLights';
import { InteriorHourProvider } from '../InteriorHourContext';

// R3F's useFrame is not driven in JSDOM; a no-op keeps the mount cheap. The
// intrinsic <pointLight> elements are rendered by the r3f reconciler in the real
// app, but under this mock they fall through to React's DOM path — enough to
// prove the correct COUNT of light nodes mounts.
vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn() }));

const ORIGIN = { x: 0, z: 0 };

/** A loaded chunk carrying one interior-bearing building with a lit hearth. */
function chunkWith(sites: LoadedChunk['bundle']['sites']): LoadedChunk {
  return {
    cx: 0,
    cy: 0,
    lod: 'full',
    bundle: { cx: 0, cy: 0, sites } as LoadedChunk['bundle'],
  } as LoadedChunk;
}

/** hearthHours schedule lit only at 19:00 — proves the schedule flows through. */
const HEARTH_HOURS_19 = (() => {
  const a = Array(24).fill(false);
  a[19] = true;
  return a;
})();

const litHouse = (id: string, localX: number, localZ: number) => ({
  id,
  kind: 'ruin' as const,
  localX,
  localZ,
  surfaceY: 10,
  radius: 6,
  walled: false,
  boxWidth: 8,
  boxDepth: 6,
  boxHeight: 3,
  wallWidthM: 7,
  wallDepthM: 5,
  rotationY: 0,
  doorZSign: -1 as const,
  hearthHours: HEARTH_HOURS_19,
  parts: [
    { x: 0, z: 0, w: 7, d: 0.3, h: 3, colorHex: '#b09a72' }, // wall (no glow)
    // hearth furnishing at local (1.2, 0.8), baseY 0, h 1.4 — tagged lightRole.
    { x: 1.2, z: 0.8, w: 1.4, d: 0.7, h: 1.4, colorHex: '#b5552e', lightRole: 'hearth' as const },
  ],
});

describe('collectInteriorLighting', () => {
  it('projects the lit-hearth part into scene space (rotationY 0, doorZSign -1)', () => {
    const chunk = chunkWith([litHouse('h1', 20, 30)]);
    const { hearths, shells } = collectInteriorLighting([chunk], ORIGIN);
    const base = chunkOriginWorld(0, 0); // chunk-local frame origin in world = scene here

    expect(hearths).toHaveLength(1);
    // rot 0, doorSign -1 → rx = p.x, rz = p.z; scene = chunkOrigin + localX/Z + part.
    expect(hearths[0].x).toBeCloseTo(base.x + 20 + 1.2, 5);
    expect(hearths[0].z).toBeCloseTo(base.y + 30 + 0.8, 5);
    // y = surfaceY + baseY(0) + h/2.
    expect(hearths[0].y).toBeCloseTo(10 + 1.4 / 2, 5);
    // The site's 24-hour hearth schedule rides along on each light.
    expect(hearths[0].hearthHours?.[19]).toBe(true);
    expect(hearths[0].hearthHours?.[12]).toBe(false);

    // One shell with padded half-extents from the wall envelope.
    expect(shells).toHaveLength(1);
    expect(shells[0].halfW).toBeCloseTo(7 / 2 + 0.5, 5);
    expect(shells[0].halfD).toBeCloseTo(5 / 2 + 0.5, 5);
    expect(shells[0].baseY).toBe(10);
  });

  it('only lightRole "hearth" parts become lights; walls and windows do not', () => {
    const house = litHouse('h1', 0, 0);
    // add an untagged furnishing and a window-pane (lightRole 'window') — neither
    // is a hearth flame, so neither becomes a point light.
    house.parts.push({ x: 3, z: 0, w: 1, d: 1, h: 1, colorHex: '#b5552e' } as never);
    house.parts.push({ x: -2, z: 0, w: 0.9, d: 0.3, h: 1, colorHex: '#2f3a4d', lightRole: 'window' } as never);
    const { hearths } = collectInteriorLighting([chunkWith([house])], ORIGIN);
    expect(hearths).toHaveLength(1); // still exactly the one lightRole 'hearth' part
  });

  it('sites without interior parts contribute no hearths and no shells', () => {
    const marker = { id: 't', kind: 'town' as const, localX: 0, localZ: 0, surfaceY: 5, radius: 6, walled: false };
    const { hearths, shells } = collectInteriorLighting([chunkWith([marker])], ORIGIN);
    expect(hearths).toEqual([]);
    expect(shells).toEqual([]);
  });

  it('applies group yaw when projecting the hearth (rotationY 90°)', () => {
    const house = litHouse('h1', 0, 0);
    house.rotationY = Math.PI / 2; // 90° CCW about +Y
    const { hearths } = collectInteriorLighting([chunkWith([house])], ORIGIN);
    const base = chunkOriginWorld(0, 0);
    // local (lx, lz) = (1.2, 0.8) [doorSign -1 → lz = 0.8]; rotate by +90°:
    // rx = lx*cos + lz*sin = 0.8 ; rz = -lx*sin + lz*cos = -1.2
    expect(hearths[0].x).toBeCloseTo(base.x + 0.8, 5);
    expect(hearths[0].z).toBeCloseTo(base.y - 1.2, 5);
  });
});

/** The light pools' fixed sizes: hearths + lamps (no fill, GG-594 part 1); window slots. */
const POINT_LIGHTS = INTERIOR_LIGHT_TUNING.MAX_HEARTH_LIGHTS + INTERIOR_LIGHT_TUNING.MAX_LAMP_LIGHTS;
const AREA_LIGHTS = INTERIOR_LIGHT_TUNING.MAX_WINDOW_LIGHTS;

/**
 * Run the component's frame loop once. Under the DOM fallback the light refs
 * are DOM nodes, so give each one the three fields the loop writes.
 */
function runFrame(container: HTMLElement, camera: THREE.Vector3): void {
  for (const el of container.querySelectorAll('pointLight, rectAreaLight')) {
    Object.assign(el, { position: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), color: new THREE.Color(), lookAt: vi.fn() });
  }
  const frame = vi.mocked(useFrame).mock.calls.at(-1)![0];
  frame({ camera: { position: camera }, scene: { getObjectByName: () => undefined } } as never, 1 / 60);
}

/** One room (6 m by 4 m floor) with a pane in its +z wall, facing +z. */
const sunHouse = (litHours?: boolean[]) => ({
  id: 'sun', kind: 'ruin' as const, localX: 0, localZ: 0, surfaceY: 0, radius: 6, walled: false,
  boxWidth: 7, boxDepth: 5, boxHeight: 3, wallWidthM: 6, wallDepthM: 4, rotationY: 0, doorZSign: -1 as const,
  ...(litHours ? { litHours } : {}),
  parts: [
    { x: 0, z: 0, w: 6, d: 4, h: 0.1, baseY: -0.1, colorHex: '#9a8a72', walkSurface: 'floor' },
    { x: 0, z: 2.15, w: 1.2, d: 0.04, h: 1.2, baseY: 0.9, colorHex: '#2f3a4d', lightRole: 'window' as const },
  ],
});

describe('InteriorLights component', () => {
  it('mounts only the hard-capped light pools when lit buildings load', () => {
    // Five lit houses — more than the cap — must still mount only the pools.
    const houses = Array.from({ length: 5 }, (_, i) => litHouse(`h${i}`, i * 12, 0));
    const { container } = render(
      <InteriorHourProvider clock={19}>
        <InteriorLights loaded={[chunkWith(houses)]} origin={ORIGIN} />
      </InteriorHourProvider>,
    );
    expect(container.querySelectorAll('pointLight').length).toBe(POINT_LIGHTS);
    expect(container.querySelectorAll('rectAreaLight').length).toBe(AREA_LIGHTS);
  });

  it('keeps the same light count when the loaded buildings have no hearth, lamp or lit window (GG-594 part 3)', () => {
    const plain = { ...litHouse('p', 0, 0), hearthHours: undefined, parts: [{ x: 0, z: 0, w: 7, d: 0.3, h: 3, colorHex: '#b09a72' }] };
    const { container } = render(
      <InteriorHourProvider clock={19}>
        <InteriorLights loaded={[chunkWith([plain])]} origin={ORIGIN} />
      </InteriorHourProvider>,
    );
    expect(container.querySelectorAll('pointLight').length).toBe(POINT_LIGHTS);
    expect(container.querySelectorAll('rectAreaLight').length).toBe(AREA_LIGHTS);
  });

  it('adds no camera-inside fill light: a camera in a dark house changes no light (GG-594 part 1)', () => {
    // A house at 03:00: its hearth is cold and its windows are dark. The
    // removed fill lit such a room; now every point light stays at 0.
    const { container } = render(
      <InteriorHourProvider clock={3}>
        <InteriorLights loaded={[chunkWith([litHouse('h', 0, 0)])]} origin={ORIGIN} />
      </InteriorHourProvider>,
    );
    runFrame(container, new THREE.Vector3(0, 11.5, 0));
    const points = [...container.querySelectorAll('pointLight')];
    expect(points).toHaveLength(POINT_LIGHTS);
    for (const el of points) {
      expect((el as unknown as { intensity: number }).intensity).toBe(0);
      expect((el as unknown as { visible?: boolean }).visible).not.toBe(false);
    }
  });

  it('dims a hearth by intensity and never by visible (GG-594 part 3)', () => {
    const lit = render(
      <InteriorHourProvider clock={19}>
        <InteriorLights loaded={[chunkWith([litHouse('h', 0, 0)])]} origin={ORIGIN} />
      </InteriorHourProvider>,
    );
    runFrame(lit.container, new THREE.Vector3(0, 12, 0));
    const hearths = [...lit.container.querySelectorAll('pointLight')].slice(0, INTERIOR_LIGHT_TUNING.MAX_HEARTH_LIGHTS);
    expect(hearths.map((el) => (el as unknown as { intensity: number }).intensity))
      .toEqual([INTERIOR_LIGHT_TUNING.HEARTH_INTENSITY, 0, 0, 0]);
    for (const el of hearths) expect((el as unknown as { visible?: boolean }).visible).not.toBe(false);
    lit.unmount();
    // At 03:00 the hearth is cold: every slot stays mounted at intensity 0.
    const cold = render(
      <InteriorHourProvider clock={3}>
        <InteriorLights loaded={[chunkWith([litHouse('h', 0, 0)])]} origin={ORIGIN} />
      </InteriorHourProvider>,
    );
    runFrame(cold.container, new THREE.Vector3(0, 12, 0));
    const coldHearths = [...cold.container.querySelectorAll('pointLight')].slice(0, INTERIOR_LIGHT_TUNING.MAX_HEARTH_LIGHTS);
    expect(coldHearths).toHaveLength(INTERIOR_LIGHT_TUNING.MAX_HEARTH_LIGHTS);
    for (const el of coldHearths) {
      expect((el as unknown as { intensity: number }).intensity).toBe(0);
      expect((el as unknown as { visible?: boolean }).visible).not.toBe(false);
    }
  });

  it('puts the sun bounce on a free window slot, facing up from the sunlit floor (GG-594 part 2)', () => {
    // 13:00: the sun stands 62 degrees up, due +z, so it shines in this pane.
    const house = sunHouse();
    const unmark = markInteriorLive(house);
    const { container } = render(
      <InteriorHourProvider clock={13}>
        <InteriorLights loaded={[chunkWith([house])]} origin={ORIGIN} sunHours={13} />
      </InteriorHourProvider>,
    );
    runFrame(container, new THREE.Vector3(0, 1.6, 0));
    unmark();
    const rects = [...container.querySelectorAll('rectAreaLight')] as unknown as Array<{
      intensity: number; width: number; height: number; position: THREE.Vector3; up: THREE.Vector3; color: THREE.Color; lookAt: ReturnType<typeof vi.fn>;
    }>;
    const sun = sunFromTime(13);
    expect(rects[0].intensity).toBeCloseTo((sun.sunIntensity * sun.direction[1]) / Math.PI, 9);
    expect(rects[0].width).toBeCloseTo(1.2, 9);
    // Depth = pane height * (s . n) / s.y.
    expect(rects[0].height).toBeCloseTo((1.2 * sun.direction[2]) / sun.direction[1], 9);
    expect(rects[0].position.y).toBeCloseTo(0.02, 9);
    expect(rects[0].position.z).toBeLessThan(2.15);
    expect(rects[0].up.toArray()).toEqual([0, 0, 1]);
    // It looks straight up from the patch.
    const [lx, ly, lz] = rects[0].lookAt.mock.calls[0] as number[];
    expect(lx).toBeCloseTo(rects[0].position.x, 9);
    expect(ly - rects[0].position.y).toBeCloseTo(0.98, 9);
    expect(lz).toBeCloseTo(rects[0].position.z, 9);
    const rho = new THREE.Color(sun.sunColor).multiply(new THREE.Color('#9a8a72'));
    expect(rects[0].color.g).toBeCloseTo(rho.g, 9);
    for (const r of rects.slice(1)) expect(r.intensity).toBe(0);
  });

  it('lets a lit window keep its slot and moves the bounce to the next one', () => {
    const allDay = Array(24).fill(true);
    const house = sunHouse(allDay);
    const unmark = markInteriorLive(house);
    const { container } = render(
      <InteriorHourProvider clock={13}>
        <InteriorLights loaded={[chunkWith([house])]} origin={ORIGIN} sunHours={13} />
      </InteriorHourProvider>,
    );
    runFrame(container, new THREE.Vector3(0, 1.6, 0));
    unmark();
    const rects = [...container.querySelectorAll('rectAreaLight')] as unknown as Array<{ intensity: number; up: THREE.Vector3 }>;
    const sun = sunFromTime(13);
    expect(rects[0].up.toArray()).toEqual([0, 1, 0]);
    expect(rects[0].intensity).toBeCloseTo(1.1, 9);
    expect(rects[1].intensity).toBeCloseTo((sun.sunIntensity * sun.direction[1]) / Math.PI, 9);
    for (const r of rects.slice(2)) expect(r.intensity).toBe(0);
  });

  it('gives no bounce in a closed shell: only live rooms let the sun in', () => {
    // The same sunlit house, but SiteBuilding has not mounted its rooms.
    const { container } = render(
      <InteriorHourProvider clock={13}>
        <InteriorLights loaded={[chunkWith([sunHouse()])]} origin={ORIGIN} sunHours={13} />
      </InteriorHourProvider>,
    );
    runFrame(container, new THREE.Vector3(0, 1.6, 0));
    for (const r of container.querySelectorAll('rectAreaLight')) expect((r as unknown as { intensity: number }).intensity).toBe(0);
  });

  it('lights a table lamp only while its rooms are live', () => {
    const evening = Array(24).fill(false).map((_, h) => h >= 18);
    const house = {
      ...sunHouse(evening),
      parts: [...sunHouse().parts, { x: -1, z: -0.5, w: 1.6, d: 0.9, h: 0.8, colorHex: '#c8a24a', furnishing: { kind: 'table' } }],
    };
    const lampIntensities = (live: boolean) => {
      const unmark = live ? markInteriorLive(house) : () => {};
      const { container, unmount } = render(
        <InteriorHourProvider clock={20}>
          <InteriorLights loaded={[chunkWith([house as never])]} origin={ORIGIN} sunHours={20} />
        </InteriorHourProvider>,
      );
      runFrame(container, new THREE.Vector3(0, 1.6, 0));
      const lamps = [...container.querySelectorAll('pointLight')]
        .slice(INTERIOR_LIGHT_TUNING.MAX_HEARTH_LIGHTS, INTERIOR_LIGHT_TUNING.MAX_HEARTH_LIGHTS + INTERIOR_LIGHT_TUNING.MAX_LAMP_LIGHTS)
        .map((el) => (el as unknown as { intensity: number }).intensity);
      unmark();
      unmount();
      return lamps;
    };
    expect(lampIntensities(true)).toEqual([8, 0, 0, 0]);
    expect(lampIntensities(false)).toEqual([0, 0, 0, 0]);
  });

  it('gives no bounce when the sun is on the far side of the house', () => {
    // The house turned half round: its pane faces -z, the 13:00 sun is at +z.
    const house = { ...sunHouse(), rotationY: Math.PI };
    const unmark = markInteriorLive(house);
    const { container } = render(
      <InteriorHourProvider clock={13}>
        <InteriorLights loaded={[chunkWith([house])]} origin={ORIGIN} sunHours={13} />
      </InteriorHourProvider>,
    );
    runFrame(container, new THREE.Vector3(0, 1.6, 0));
    unmark();
    for (const r of container.querySelectorAll('rectAreaLight')) expect((r as unknown as { intensity: number }).intensity).toBe(0);
  });

  it('renders nothing when no interior-bearing buildings are loaded', () => {
    const marker = { id: 't', kind: 'town' as const, localX: 0, localZ: 0, surfaceY: 5, radius: 6, walled: false };
    const { container } = render(
      <InteriorHourProvider clock={19}>
        <InteriorLights loaded={[chunkWith([marker])]} origin={ORIGIN} />
      </InteriorHourProvider>,
    );
    expect(container.querySelectorAll('pointLight').length).toBe(0);
  });
});
