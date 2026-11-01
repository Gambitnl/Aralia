import { afterEach, describe, expect, it } from 'vitest';
import { getCameraHold, holdCamera, releaseCamera } from '../cameraHold';

describe('camera hold (2026-10-30)', () => {
  afterEach(() => releaseCamera());

  it('holds a pose with its note until release, and exposes the probe hooks', () => {
    expect(getCameraHold()).toBeNull();
    holdCamera([1, 2, 3], [4, 5, 6], 'the river probe');
    expect(getCameraHold()).toEqual({ cam: [1, 2, 3], target: [4, 5, 6], note: 'the river probe' });
    releaseCamera();
    expect(getCameraHold()).toBeNull();
    const w = window as unknown as { __wf3dHoldCamera?: unknown; __wf3dReleaseCamera?: unknown };
    expect(w.__wf3dHoldCamera).toBe(holdCamera);
    expect(w.__wf3dReleaseCamera).toBe(releaseCamera);
  });

  it('refuses a pose that is not finite', () => {
    expect(() => holdCamera([0, Number.NaN, 0], [0, 0, 0])).toThrow(/finite/);
    expect(getCameraHold()).toBeNull();
  });
});
