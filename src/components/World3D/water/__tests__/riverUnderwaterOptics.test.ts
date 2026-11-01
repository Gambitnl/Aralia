/** Physical regression checks for the underwater window and capture boundaries. */
import { describe, expect, it } from 'vitest';
import { underwaterFresnel, underwaterSceneSampleValid, WATER_TO_AIR_IOR } from '../riverUnderwaterOptics';

describe('underwater interface', () => {
  it('reflects about 2% head-on and all light beyond the critical angle', () => {
    expect(underwaterFresnel(1)).toBeCloseTo(((WATER_TO_AIR_IOR - 1) / (WATER_TO_AIR_IOR + 1)) ** 2, 10);
    const critical = Math.asin(1 / WATER_TO_AIR_IOR);
    expect(critical * 180 / Math.PI).toBeCloseTo(48.6, 1);
    expect(underwaterFresnel(Math.cos(critical + 0.001))).toBe(1);
    expect(underwaterFresnel(Math.cos(critical - 0.001))).toBeLessThan(1);
    for (let angle = 0; angle <= 90; angle++) {
      const reflected = underwaterFresnel(Math.cos(angle * Math.PI / 180));
      expect(reflected).toBeGreaterThanOrEqual(0);
      expect(reflected).toBeLessThanOrEqual(1);
    }
  });
  it('rejects edge repeats, behind-camera projections, foreground and wrong-medium geometry', () => {
    const valid = { clipW: 1, u: 0.5, v: 0.5, rayDistance: 10, sceneY: 2, interfaceY: 0, transmitted: true };
    expect(underwaterSceneSampleValid(valid)).toBe(true);
    for (const invalid of [{ u: -1 }, { v: 1 }, { clipW: -1 }, { u: NaN }, { rayDistance: -0.5 }, { sceneY: -2 }]) {
      expect(underwaterSceneSampleValid({ ...valid, ...invalid })).toBe(false);
    }
    expect(underwaterSceneSampleValid({ ...valid, sceneY: -2, transmitted: false })).toBe(true);
    expect(underwaterSceneSampleValid({ ...valid, transmitted: false })).toBe(false);
  });
  it('allows a bed reflection toward the camera even when its view depth equals the interface', () => {
    // Camera (0,-1,0) sees interface P=(0,0,1). The reflected ray reaches
    // bed H=(0,-.5,1.5): both have view depth -sqrt(2), but H lies forward
    // along the reflected ray. Camera depth ordering is not ray ordering.
    const cameraToInterface = [0, 1, 1];
    const cameraToBed = [0, 0.5, 1.5];
    const viewForward = [0, Math.SQRT1_2, Math.SQRT1_2];
    const reflectedDirection = [0, -Math.SQRT1_2, Math.SQRT1_2];
    const bedFromInterface = [0, -0.5, 0.5];
    const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);
    expect(dot(cameraToInterface, viewForward)).toBeCloseTo(dot(cameraToBed, viewForward), 10);
    const reflectedDistance = dot(bedFromInterface, reflectedDirection);
    expect(underwaterSceneSampleValid({ clipW: Math.SQRT2, u: 0.5, v: 0.8,
      rayDistance: reflectedDistance, sceneY: -0.5, interfaceY: 0, transmitted: false })).toBe(true);
  });
});
