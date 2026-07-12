/**
 * @file entityOverlays.test.ts — the combat overlay timing contract.
 */
import { describe, it, expect } from 'vitest';
import { combatOverlayPose, OVERLAY_DURATIONS } from '../entityOverlays';

describe('combatOverlayPose', () => {
  it('idles flat', () => {
    expect(combatOverlayPose('idle', 2)).toEqual({ pitch: 0, yOffset: 0, settled: false });
  });

  it('melee lunges forward mid-swing and returns by the end', () => {
    const mid = combatOverlayPose('attack_melee', OVERLAY_DURATIONS.attack_melee / 2);
    expect(mid.pitch).toBeGreaterThan(0.3);
    const end = combatOverlayPose('attack_melee', OVERLAY_DURATIONS.attack_melee);
    expect(Math.abs(end.pitch)).toBeLessThan(1e-9);
  });

  it('hit react recoils backward', () => {
    expect(combatOverlayPose('hit_react', 0.25).pitch).toBeLessThan(-0.2);
  });

  it('cast rises then lands', () => {
    expect(combatOverlayPose('cast_spell', 0.5).yOffset).toBeGreaterThan(0.1);
    expect(combatOverlayPose('cast_spell', 1.0).yOffset).toBeCloseTo(0, 6);
  });

  it('death falls to flat and reports settled, then stays down', () => {
    const falling = combatOverlayPose('death', 0.3);
    expect(falling.pitch).toBeLessThan(0);
    expect(falling.settled).toBe(false);
    const down = combatOverlayPose('death', OVERLAY_DURATIONS.death);
    expect(down.pitch).toBeCloseTo(-Math.PI / 2, 4);
    expect(down.settled).toBe(true);
    const later = combatOverlayPose('death', 10);
    expect(later.pitch).toBeCloseTo(-Math.PI / 2, 4);
    expect(later.settled).toBe(true);
  });
});
