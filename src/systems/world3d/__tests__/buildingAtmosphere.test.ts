/**
 * These tests protect the Building Lab's hour-driven atmosphere and smoke.
 *
 * They pin the previous noon presentation, prove that values blend between
 * authored hours, and verify that chimney motion is a bounded pure function of
 * real chimney boxes plus explicit seconds. No browser or frame clock is needed.
 */

import { describe, expect, it } from 'vitest';
import {
  buildingAtmosphereAtHour,
  chimneySmokeSources,
  MAX_SMOKE_CHIMNEYS,
  normalizeAtmosphereHour,
  sampleChimneySmoke,
  SMOKE_PARTICLES_PER_CHIMNEY,
} from '../buildingAtmosphere';

// ============================================================================
// Continuous light and haze
// ============================================================================
// Noon must stay visually compatible with the renderer this pass extends, while
// neighbouring times must be genuine interpolated states rather than switches.
// ============================================================================

describe('buildingAtmosphereAtHour', () => {
  it('preserves the previous noon light, sky, ground, and shadow strengths', () => {
    const noon = buildingAtmosphereAtHour(12);

    expect(noon).toMatchObject({
      hour: 12,
      mood: 'day',
      skyColor: '#8fa3b8',
      groundColor: '#4c5a3c',
      sunColor: '#fff1da',
      sunIntensity: 1.8,
      sunPositionScale: [1.2, 1.8, 0.9],
      hemisphereIntensity: 0.55,
      sideFillIntensity: 0.35,
      overheadFillIntensity: 0.95,
      roofEmissiveIntensity: 0.28,
      contactShadowOpacity: 0.68,
      groundFogOpacity: 0,
    });
  });

  it('blends continuously between authored hour anchors', () => {
    const dawnAnchor = buildingAtmosphereAtHour(6.5);
    const morningAnchor = buildingAtmosphereAtHour(8.5);
    const between = buildingAtmosphereAtHour(7.5);

    expect(between.sunIntensity).toBeCloseTo(
      (dawnAnchor.sunIntensity + morningAnchor.sunIntensity) / 2,
      8,
    );
    expect(between.sunPositionScale[1]).toBeCloseTo(
      (dawnAnchor.sunPositionScale[1] + morningAnchor.sunPositionScale[1]) / 2,
      8,
    );
    expect(between.skyColor).not.toBe(dawnAnchor.skyColor);
    expect(between.skyColor).not.toBe(morningAnchor.skyColor);
  });

  it('keeps low warm light and stronger haze around dawn and golden hour', () => {
    const dawn = buildingAtmosphereAtHour(6.5);
    const noon = buildingAtmosphereAtHour(12);
    const golden = buildingAtmosphereAtHour(18);

    expect(dawn.sunPositionScale[1]).toBeLessThan(noon.sunPositionScale[1]);
    expect(golden.sunPositionScale[1]).toBeLessThan(noon.sunPositionScale[1]);
    expect(dawn.groundFogOpacity).toBeGreaterThan(noon.groundFogOpacity);
    expect(golden.hazeNearScale).toBeLessThan(noon.hazeNearScale);
    expect(dawn.sunColor).not.toBe(noon.sunColor);
    expect(golden.sunColor).not.toBe(noon.sunColor);
  });

  it('wraps the clock without changing a repeated day', () => {
    expect(normalizeAtmosphereHour(25.5)).toBe(1.5);
    expect(normalizeAtmosphereHour(-1)).toBe(23);
    expect(buildingAtmosphereAtHour(18)).toEqual(buildingAtmosphereAtHour(42));
    expect(buildingAtmosphereAtHour(Number.NaN)).toEqual(buildingAtmosphereAtHour(12));
  });

  it('stays continuous across the midnight wrap', () => {
    const beforeMidnight = buildingAtmosphereAtHour(23.999);
    const afterMidnight = buildingAtmosphereAtHour(0.001);

    expect(Math.abs(beforeMidnight.sunIntensity - afterMidnight.sunIntensity)).toBeLessThan(0.001);
    expect(Math.abs(
      beforeMidnight.sunPositionScale[1] - afterMidnight.sunPositionScale[1],
    )).toBeLessThan(0.001);
    expect(beforeMidnight.skyColor).toBe(afterMidnight.skyColor);
    expect(beforeMidnight.hazeColor).toBe(afterMidnight.hazeColor);
  });
});

// ============================================================================
// Real, bounded chimney sources
// ============================================================================
// Non-chimney geometry must never emit smoke, and large roofs stay within the
// explicit particle budget used by the isolated preview.
// ============================================================================

describe('chimney smoke sampling', () => {
  const boxes = [
    { kind: 'wall', x: 0, y: 0, z0: 0, h: 10 },
    ...Array.from({ length: 7 }, (_, index) => ({
      kind: 'chimney',
      x: index * 2,
      y: index,
      z0: 10,
      h: 4 + index,
    })),
  ];

  it('uses only real chimney boxes and applies the strict chimney cap', () => {
    const sources = chimneySmokeSources(boxes);

    expect(sources).toHaveLength(MAX_SMOKE_CHIMNEYS);
    expect(sources[0]).toEqual({ x: 0, y: 0, topFt: 14 });
    expect(sources.at(-1)).toEqual({ x: 6, y: 3, topFt: 17 });
    expect(chimneySmokeSources([boxes[0]])).toEqual([]);
  });

  it('emits a fixed number of non-shadow particle facts per chimney', () => {
    const sources = chimneySmokeSources(boxes);
    const smoke = sampleChimneySmoke(sources, 2.5);

    expect(smoke).toHaveLength(MAX_SMOKE_CHIMNEYS * SMOKE_PARTICLES_PER_CHIMNEY);
    expect(smoke.every((particle) => particle.opacity >= 0 && particle.opacity <= 0.22)).toBe(true);
    expect(smoke.every((particle) => particle.zFt > sources[particle.chimneyIndex].topFt)).toBe(true);
    expect(smoke.every((particle) => particle.scale >= 0.34 && particle.scale < 1.16)).toBe(true);
    expect(smoke.every((particle) => Number.isFinite(particle.x + particle.y + particle.zFt))).toBe(true);
  });

  it('is byte-stable for the same explicit seconds and moves for a later sample', () => {
    const sources = chimneySmokeSources(boxes);
    const first = sampleChimneySmoke(sources, 3.25);
    const repeated = sampleChimneySmoke(sources, 3.25);
    const later = sampleChimneySmoke(sources, 3.75);

    expect(repeated).toEqual(first);
    expect(later).not.toEqual(first);
  });

  it('treats an invalid time as the documented zero-second proof sample', () => {
    const sources = chimneySmokeSources(boxes);
    expect(sampleChimneySmoke(sources, Number.NaN)).toEqual(sampleChimneySmoke(sources, 0));
  });
});
