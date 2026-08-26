/**
 * agora-db71.2: AmbientWeather shipped built-but-unmounted because
 * vfx/VFXSystem.tsx was outside PK-04's file ownership. These tests pin the
 * mount itself — the one thing the ambientWeather unit tests next door cannot
 * see, because they exercise the field math directly rather than the scene.
 *
 * The real AmbientWeather runs here (only `useFrame` and `Html` are stubbed),
 * so the assertions prove the actual wiring: an outdoor board gets the <points>
 * cloud, and a roofed board gets nothing because AMBIENT_WEATHER_BY_BIOME
 * resolves cave/dungeon to null.
 *
 * Called by: Vitest test runner (BattleMap vfx suite)
 * Depends on: VFXSystem.tsx, environmentEffects.tsx
 */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VFXSystem from '../VFXSystem';
import {
  AMBIENT_WEATHER_PROFILES,
  resolveAmbientWeather,
} from '../environmentEffects';
import { BATTLE_MAP_BIOMES, type BattleMapData } from '../../../../types/combat';

vi.mock('@react-three/fiber', () => ({
  useFrame: () => undefined,
}));

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
}));

const mapWith = (theme: BattleMapData['theme']): BattleMapData =>
  ({
    theme,
    seed: 1234,
    dimensions: { width: 12, height: 10 },
    tiles: new Map(),
  }) as unknown as BattleMapData;

const renderVfx = (theme: BattleMapData['theme']) =>
  render(<VFXSystem mapData={mapWith(theme)} characters={[]} />);

describe('VFXSystem ambient weather mount', () => {
  it('renders the weather point cloud on an outdoor board', () => {
    const { container } = renderVfx('snow');
    const points = container.querySelectorAll('points');
    expect(points).toHaveLength(1);

    const material = points[0].querySelector('pointsMaterial');
    expect(material).not.toBeNull();
    expect(material?.getAttribute('color')).toBe(
      AMBIENT_WEATHER_PROFILES.snow.color
    );
  });

  it('renders no weather on a roofed board', () => {
    for (const theme of ['cave', 'dungeon'] as const) {
      const { container } = renderVfx(theme);
      expect(resolveAmbientWeather(mapWith(theme))).toBeNull();
      expect(container.querySelectorAll('points')).toHaveLength(0);
    }
  });

  it('mounts exactly one point cloud for every biome that has weather', () => {
    for (const theme of BATTLE_MAP_BIOMES) {
      const { container } = renderVfx(theme);
      const expected = resolveAmbientWeather(mapWith(theme)) ? 1 : 0;
      expect(container.querySelectorAll('points')).toHaveLength(expected);
    }
  });
});
