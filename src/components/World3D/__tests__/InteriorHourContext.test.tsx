import { describe, expect, test } from 'vitest';
import { emissiveForPart } from '../InteriorHourContext';
import { WINDOW_GLOW_HEX, HEARTH_GLOW_HEX } from '@/systems/worldforge/bridge/interiorParts';

describe('emissiveForPart', () => {
  test('lights a window only in its lit hours', () => {
    const litHours = Array(24).fill(false);
    litHours[20] = true;
    expect(emissiveForPart('window', 20, litHours, undefined)).toEqual({
      emissive: WINDOW_GLOW_HEX,
      emissiveIntensity: 1.1,
    });
    expect(emissiveForPart('window', 12, litHours, undefined)).toEqual({
      emissive: '#000000',
      emissiveIntensity: 0,
    });
  });

  test('lights a hearth only in its lit hours', () => {
    const hearthHours = Array(24).fill(false);
    hearthHours[19] = true;
    expect(emissiveForPart('hearth', 19, undefined, hearthHours)).toEqual({
      emissive: HEARTH_GLOW_HEX,
      emissiveIntensity: 1.1,
    });
    expect(emissiveForPart('hearth', 12, undefined, hearthHours)).toEqual({
      emissive: '#000000',
      emissiveIntensity: 0,
    });
  });

  test('leaves non-light parts dark', () => {
    expect(emissiveForPart(undefined, 20, undefined, undefined)).toEqual({
      emissive: '#000000',
      emissiveIntensity: 0,
    });
  });

  test('wraps out-of-range and fractional hours into 0-23', () => {
    const litHours = Array(24).fill(false);
    litHours[20] = true;
    // 20.7 floors to 20; -4 wraps to 20; 44 wraps to 20.
    expect(emissiveForPart('window', 20.7, litHours, undefined).emissiveIntensity).toBe(1.1);
    expect(emissiveForPart('window', -4, litHours, undefined).emissiveIntensity).toBe(1.1);
    expect(emissiveForPart('window', 44, litHours, undefined).emissiveIntensity).toBe(1.1);
  });

  test('a window with no schedule stays dark', () => {
    expect(emissiveForPart('window', 20, undefined, undefined)).toEqual({
      emissive: '#000000',
      emissiveIntensity: 0,
    });
  });
});
