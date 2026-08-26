import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  AMBIENT_WEATHER_BY_BIOME,
  AMBIENT_WEATHER_MAX_PARTICLES,
  AMBIENT_WEATHER_PROFILES,
  ambientWeatherParticleCount,
  createAmbientWeatherField,
  resolveAmbientWeather,
  stepAmbientWeatherField,
  type AmbientWeatherProfile,
} from '../environmentEffects';
import { BATTLE_MAP_BIOMES, type BattleMapData } from '../../../../types/combat';
import { TILE_SIZE } from '../vfxConstants';

/**
 * Ambient weather (agora-43ae) is a look feature, but the parts a screenshot
 * cannot prove are testable: the biome mapping is total, the field is seeded
 * (so a board renders the same weather every time), the density is capped, and
 * the per-frame step keeps every particle inside the board volume forever.
 */

const mapWith = (
  theme: BattleMapData['theme'],
  width = 10,
  height = 10,
  seed = 42
): BattleMapData =>
  ({ theme, seed, dimensions: { width, height }, tiles: new Map() }) as unknown as BattleMapData;

const attributeFrom = (positions: Float32Array): THREE.BufferAttribute =>
  new THREE.BufferAttribute(positions, 3);

describe('ambient weather biome mapping', () => {
  it('answers for every biome the generator can roll', () => {
    for (const biome of BATTLE_MAP_BIOMES) {
      expect(AMBIENT_WEATHER_BY_BIOME).toHaveProperty(biome);
    }
    expect(Object.keys(AMBIENT_WEATHER_BY_BIOME).sort()).toEqual([...BATTLE_MAP_BIOMES].sort());
  });

  it('renders no weather on the roofed biomes', () => {
    expect(resolveAmbientWeather(mapWith('cave'))).toBeNull();
    expect(resolveAmbientWeather(mapWith('dungeon'))).toBeNull();
  });

  it('gives each outdoor biome a kind with a profile behind it', () => {
    for (const biome of BATTLE_MAP_BIOMES) {
      const kind = resolveAmbientWeather(mapWith(biome));
      if (kind === null) continue;
      expect(AMBIENT_WEATHER_PROFILES[kind].kind).toBe(kind);
    }
  });

  it('reads snow on a snow board and dust on a desert board', () => {
    expect(resolveAmbientWeather(mapWith('snow'))).toBe('snow');
    expect(resolveAmbientWeather(mapWith('desert'))).toBe('dust');
    expect(resolveAmbientWeather(mapWith('coast'))).toBe('rain');
    expect(resolveAmbientWeather(mapWith('jungle'))).toBe('spores');
  });
});

describe('ambient weather field seeding', () => {
  const rain = AMBIENT_WEATHER_PROFILES.rain;

  it('is deterministic for a given map seed', () => {
    const a = createAmbientWeatherField(rain, { width: 8, height: 6 }, 1234);
    const b = createAmbientWeatherField(rain, { width: 8, height: 6 }, 1234);

    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.phases)).toEqual(Array.from(b.phases));
  });

  it('produces a different field for a different seed', () => {
    const a = createAmbientWeatherField(rain, { width: 8, height: 6 }, 1234);
    const b = createAmbientWeatherField(rain, { width: 8, height: 6 }, 9876);

    expect(Array.from(a.positions)).not.toEqual(Array.from(b.positions));
  });

  it('scatters every particle inside the board volume', () => {
    const field = createAmbientWeatherField(rain, { width: 8, height: 6 }, 7);

    for (let i = 0; i < field.count; i++) {
      expect(field.positions[i * 3]).toBeGreaterThanOrEqual(0);
      expect(field.positions[i * 3]).toBeLessThanOrEqual(8 * TILE_SIZE);
      expect(field.positions[i * 3 + 1]).toBeGreaterThanOrEqual(0);
      expect(field.positions[i * 3 + 1]).toBeLessThanOrEqual(rain.ceiling);
      expect(field.positions[i * 3 + 2]).toBeGreaterThanOrEqual(0);
      expect(field.positions[i * 3 + 2]).toBeLessThanOrEqual(6 * TILE_SIZE);
    }
  });

  it('scales with board area and stops at the particle cap', () => {
    expect(ambientWeatherParticleCount(rain, { width: 10, height: 10 })).toBe(
      Math.round(rain.densityPerTile * 100)
    );
    // A 120x90 board would want ~11,880 drops; the cap thins it instead.
    expect(ambientWeatherParticleCount(rain, { width: 120, height: 90 })).toBe(
      AMBIENT_WEATHER_MAX_PARTICLES
    );
  });
});

describe('ambient weather stepping', () => {
  const dimensions = { width: 8, height: 6 };

  it('falls downward for rain and wraps back to the ceiling', () => {
    const profile = AMBIENT_WEATHER_PROFILES.rain;
    const positions = attributeFrom(new Float32Array([1, 0.05, 1]));
    const phases = new Float32Array([0]);

    stepAmbientWeatherField(positions, phases, profile, dimensions, 1 / 60, 0);
    // 7.5 u/s * (1/60) s = 0.125, which puts it below the floor and wraps.
    expect(positions.getY(0)).toBeCloseTo(0.05 - 0.125 + profile.ceiling, 5);
  });

  it('rises for spores and wraps back to the floor', () => {
    const profile = AMBIENT_WEATHER_PROFILES.spores;
    const positions = attributeFrom(new Float32Array([1, profile.ceiling - 0.001, 1]));
    const phases = new Float32Array([0]);

    stepAmbientWeatherField(positions, phases, profile, dimensions, 1, 0);
    expect(positions.getY(0)).toBeLessThan(1);
    expect(positions.getY(0)).toBeGreaterThanOrEqual(0);
  });

  it('keeps every particle inside the volume over a long run', () => {
    const profile = AMBIENT_WEATHER_PROFILES.snow;
    const field = createAmbientWeatherField(profile, dimensions, 99);
    const positions = attributeFrom(field.positions);

    for (let frame = 0; frame < 600; frame++) {
      stepAmbientWeatherField(positions, field.phases, profile, dimensions, 1 / 60, frame / 60);
    }

    for (let i = 0; i < field.count; i++) {
      expect(positions.getY(i)).toBeGreaterThanOrEqual(0);
      expect(positions.getY(i)).toBeLessThanOrEqual(profile.ceiling);
      expect(positions.getX(i)).toBeGreaterThanOrEqual(0);
      expect(positions.getX(i)).toBeLessThanOrEqual(dimensions.width * TILE_SIZE);
      expect(positions.getZ(i)).toBeGreaterThanOrEqual(0);
      expect(positions.getZ(i)).toBeLessThanOrEqual(dimensions.height * TILE_SIZE);
    }
  });

  it('keeps horizontal drift bounded instead of walking off one side', () => {
    // Integrating sin(wt) gives (1 - cos(wt)) / w, so the wander is bounded at
    // 2 * driftAmplitude / driftSpeed: a dust mote sways around its own column
    // instead of migrating across the map the way a random walk would.
    const profile: AmbientWeatherProfile = AMBIENT_WEATHER_PROFILES.dust;
    const startX = 4;
    const positions = attributeFrom(new Float32Array([startX, 2, 3]));
    const phases = new Float32Array([0]);

    let maxExcursion = 0;
    for (let frame = 0; frame < 1200; frame++) {
      stepAmbientWeatherField(positions, phases, profile, dimensions, 1 / 60, frame / 60);
      maxExcursion = Math.max(maxExcursion, Math.abs(positions.getX(0) - startX));
    }

    const analyticBound = (2 * profile.driftAmplitude) / profile.driftSpeed;
    expect(maxExcursion).toBeLessThanOrEqual(analyticBound * 1.05);
    // And it really does sway — a bound that nothing approaches proves nothing.
    expect(maxExcursion).toBeGreaterThan(analyticBound * 0.5);
  });

  it('marks the attribute for upload so the GPU sees the new frame', () => {
    // `needsUpdate` is write-only on a BufferAttribute; setting it true bumps
    // `version`, and `version` is what the renderer actually reads.
    const profile = AMBIENT_WEATHER_PROFILES.rain;
    const positions = attributeFrom(new Float32Array([1, 2, 1]));
    const before = positions.version;

    stepAmbientWeatherField(positions, new Float32Array([0]), profile, dimensions, 1 / 60, 0);

    expect(positions.version).toBeGreaterThan(before);
  });
});
