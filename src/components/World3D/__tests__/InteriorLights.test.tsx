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
import { chunkOriginWorld } from '@/systems/world3d/coords';
import { HEARTH_GLOW_HEX } from '@/systems/worldforge/bridge/interiorParts';
import type { LoadedChunk } from '@/systems/world3d/types';
import InteriorLights, {
  collectInteriorLighting,
  INTERIOR_LIGHT_TUNING,
} from '../InteriorLights';

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
  parts: [
    { x: 0, z: 0, w: 7, d: 0.3, h: 3, colorHex: '#b09a72' }, // wall (no glow)
    // lit hearth furnishing at local (1.2, 0.8), baseY 0, h 1.4
    { x: 1.2, z: 0.8, w: 1.4, d: 0.7, h: 1.4, colorHex: '#b5552e', emissiveHex: HEARTH_GLOW_HEX },
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

    // One shell with padded half-extents from the wall envelope.
    expect(shells).toHaveLength(1);
    expect(shells[0].halfW).toBeCloseTo(7 / 2 + 0.5, 5);
    expect(shells[0].halfD).toBeCloseTo(5 / 2 + 0.5, 5);
    expect(shells[0].baseY).toBe(10);
  });

  it('only hearth-glow parts become lights; plain furnishings/walls do not', () => {
    const house = litHouse('h1', 0, 0);
    // add a cold hearth (no emissive) and a window-glow pane — neither is a flame.
    house.parts.push({ x: 3, z: 0, w: 1, d: 1, h: 1, colorHex: '#b5552e' } as never);
    house.parts.push({ x: -2, z: 0, w: 0.9, d: 0.3, h: 1, colorHex: '#2f3a4d', emissiveHex: '#ffb066' } as never);
    const { hearths } = collectInteriorLighting([chunkWith([house])], ORIGIN);
    expect(hearths).toHaveLength(1); // still exactly the one HEARTH_GLOW_HEX part
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

describe('InteriorLights component', () => {
  it('mounts the hard-capped hearth light set + one fill when lit buildings load', () => {
    // Five lit houses — more than the cap — must still mount only MAX + 1 lights.
    const houses = Array.from({ length: 5 }, (_, i) => litHouse(`h${i}`, i * 12, 0));
    const { container } = render(<InteriorLights loaded={[chunkWith(houses)]} origin={ORIGIN} />);
    const lights = container.querySelectorAll('pointLight');
    expect(lights.length).toBe(INTERIOR_LIGHT_TUNING.MAX_HEARTH_LIGHTS + 1); // +1 fill
  });

  it('renders nothing when no interior-bearing buildings are loaded', () => {
    const marker = { id: 't', kind: 'town' as const, localX: 0, localZ: 0, surfaceY: 5, radius: 6, walled: false };
    const { container } = render(<InteriorLights loaded={[chunkWith([marker])]} origin={ORIGIN} />);
    expect(container.querySelectorAll('pointLight').length).toBe(0);
  });
});
