/**
 * Eye adaptation (GG-594 part 1): the shared meter decode, the exposure rule
 * and the time response. The GPU meters encode with the same constants; these
 * tests pin the CPU half of that contract.
 */
import { describe, expect, it } from 'vitest';
import {
  EYE_ADAPTATION,
  EyeAdaptation,
  adaptExposure,
  daylightWeight,
  decodeLog2Luminance,
  encodeLog2Luminance,
  maxExposureAt,
  meterLog2Average,
  targetExposure,
} from '../eyeAdaptation';

const { METER_W, METER_H, LOG2_MIN, LOG2_MAX, KEY_LOG2, MAX_EXPOSURE, BRIGHTEN_TAU_S, DARKEN_TAU_S } = EYE_ADAPTATION;

/** An RGBA8 meter grid with every texel at the code for `lum`. */
function grid(lum: number, width: number = METER_W, height: number = METER_H, rowTexels: number = width): Uint8Array {
  const px = new Uint8Array(rowTexels * height * 4);
  const code = Math.round(encodeLog2Luminance(lum) * 255);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) px[(y * rowTexels + x) * 4] = code;
  return px;
}

describe('eye adaptation meter code', () => {
  it('round-trips a luminance to within one 8-bit step', () => {
    const step = (LOG2_MAX - LOG2_MIN) / 255;
    for (const lum of [0.001, 0.02, 0.18, 1, 6]) {
      const code = Math.round(encodeLog2Luminance(lum) * 255);
      expect(Math.abs(decodeLog2Luminance(code) - Math.log2(lum))).toBeLessThanOrEqual(step / 2 + 1e-9);
    }
  });

  it('clamps black and over-range light to the ends of the code', () => {
    expect(encodeLog2Luminance(0)).toBe(0);
    expect(encodeLog2Luminance(2 ** (LOG2_MAX + 3))).toBe(1);
  });

  it('averages in log space: a geometric mean, so one bright window does not swamp a dim room', () => {
    // Half the grid at 1/64, half at 1: the geometric mean is 1/8 (log2 -3);
    // an arithmetic mean would be about 0.51.
    const px = grid(1 / 64);
    const bright = Math.round(encodeLog2Luminance(1) * 255);
    for (let i = 0; i < METER_W * METER_H / 2; i++) px[i * 4] = bright;
    expect(meterLog2Average(px, METER_W, METER_H)).toBeCloseTo(-3, 1);
  });

  it('skips the padding of a row when the readback pads its rows', () => {
    const px = grid(0.25, 8, 4, 16);
    // Fill the padding with full code: it must not count.
    for (let y = 0; y < 4; y++) for (let x = 8; x < 16; x++) px[(y * 16 + x) * 4] = 255;
    expect(meterLog2Average(px, 8, 4, 16)).toBeCloseTo(-2, 1);
  });
});

describe('eye adaptation exposure rule', () => {
  it('leaves a frame at or above the key at exposure 1 (outdoor day keeps its look)', () => {
    expect(targetExposure(KEY_LOG2, MAX_EXPOSURE)).toBe(1);
    expect(targetExposure(KEY_LOG2 + 2, MAX_EXPOSURE)).toBe(1);
  });

  it('lifts a frame below the key to the key, up to the cap', () => {
    expect(targetExposure(KEY_LOG2 - 2, MAX_EXPOSURE)).toBeCloseTo(4, 6);
    expect(targetExposure(KEY_LOG2 - 10, MAX_EXPOSURE)).toBe(MAX_EXPOSURE);
  });

  it('allows the full range by day and none at night, with a smooth dusk', () => {
    expect(daylightWeight(13)).toBe(1);
    expect(maxExposureAt(13)).toBe(MAX_EXPOSURE);
    expect(daylightWeight(1)).toBe(0);
    expect(maxExposureAt(1)).toBe(1);
    // Dusk: the sun sets at 20 h; the range shrinks through it without a jump.
    let last = maxExposureAt(19);
    for (let h = 19.05; h <= 21; h += 0.05) {
      const m = maxExposureAt(h);
      expect(m).toBeLessThanOrEqual(last + 1e-9);
      expect(last - m).toBeLessThan(1.5);
      last = m;
    }
    expect(targetExposure(KEY_LOG2 - 6, maxExposureAt(1))).toBe(1);
  });
});

describe('eye adaptation time response', () => {
  it('reaches 1 - 1/e of the log step in one time constant, slower to brighten than to darken', () => {
    const up = adaptExposure(1, 8, BRIGHTEN_TAU_S);
    expect(Math.log2(up)).toBeCloseTo(3 * (1 - Math.exp(-1)), 6);
    const down = adaptExposure(8, 1, DARKEN_TAU_S);
    expect(Math.log2(down)).toBeCloseTo(3 * Math.exp(-1), 6);
    expect(BRIGHTEN_TAU_S).toBeGreaterThan(DARKEN_TAU_S);
  });

  it('does not depend on the frame rate', () => {
    let a = 1;
    for (let i = 0; i < 60; i++) a = adaptExposure(a, 8, 1 / 60);
    let b = 1;
    for (let i = 0; i < 30; i++) b = adaptExposure(b, 8, 1 / 30);
    expect(a).toBeCloseTo(b, 9);
    expect(adaptExposure(3, 8, 0)).toBe(3);
  });
});

describe('EyeAdaptation controller', () => {
  it('holds exposure 1 until the first reading, then moves toward the measured target', async () => {
    const eye = new EyeAdaptation();
    eye.hours = 13;
    expect(eye.step(0.1)).toBe(1);
    // A dim room: two stops under the key.
    const room = grid(2 ** (KEY_LOG2 - 2));
    eye.read(() => Promise.resolve(room), METER_W, METER_H);
    await Promise.resolve();
    await Promise.resolve();
    expect(eye.measuredLog2).toBeCloseTo(KEY_LOG2 - 2, 1);
    let e = 1;
    for (let i = 0; i < 600; i++) e = eye.step(1 / 60);
    expect(eye.target).toBeCloseTo(4, 0);
    expect(e).toBeCloseTo(eye.target, 2);
  });

  it('keeps one readback in flight and paces them by frame count', () => {
    const eye = new EyeAdaptation();
    const starts: number[] = [];
    let release: (px: Uint8Array) => void = () => {};
    for (let f = 1; f <= 12; f++) {
      if (eye.wantsReading()) {
        starts.push(f);
        eye.read(() => new Promise<Uint8Array>((r) => { release = r; }), METER_W, METER_H);
      }
    }
    // Frame 4 starts a read; frames 8 and 12 find it still in flight.
    expect(starts).toEqual([EYE_ADAPTATION.METER_EVERY_FRAMES]);
    release(grid(0.1));
  });

  it('pins the exposure while a rig holds it', () => {
    const eye = new EyeAdaptation();
    eye.hold = 2.5;
    expect(eye.step(1)).toBe(2.5);
    eye.hold = null;
    expect(eye.step(0)).toBe(2.5);
  });
});
