/**
 * @file canopyInterior.test.ts — canopy → lighting-modulation math (forests
 * Task 11). Pure-part tests only: the ~2 s damp and the R3F render behavior
 * are deferred to the in-game eyeball (they need a live frame loop).
 */
import { describe, expect, it } from 'vitest';
import {
  CANOPY_FOG,
  CANOPY_LIGHT_MUL,
  FEY_LIGHT_MUL,
} from '@/systems/worldforge/forests/forestTunables';
import {
  GROUND_FOG_FAR,
  GROUND_FOG_NEAR,
  NEUTRAL_INTERIOR,
  bumpFogOneStep,
  canopyInterior,
} from '../canopyInterior';

describe('canopyInterior (canopy atmosphere modulation, forests Task 11)', () => {
  it('null canopy → null interior (non-forest windows stay byte-identical)', () => {
    expect(canopyInterior(null)).toBeNull();
    expect(canopyInterior(undefined)).toBeNull();
  });

  it('ordinary canopy: standard dim + the fog grade as-is', () => {
    expect(canopyInterior({ shade: true, fog: 'light', forestKind: 'ordinary' })).toEqual({
      lightMul: CANOPY_LIGHT_MUL,
      fogNear: CANOPY_FOG.light[0],
      fogFar: CANOPY_FOG.light[1],
    });
    expect(canopyInterior({ shade: true, fog: 'medium', forestKind: null })).toEqual({
      lightMul: CANOPY_LIGHT_MUL,
      fogNear: CANOPY_FOG.medium[0],
      fogFar: CANOPY_FOG.medium[1],
    });
  });

  it('fey canopy dims LESS (strange light, not dark) and keeps its fog grade', () => {
    expect(canopyInterior({ shade: true, fog: 'light', forestKind: 'fey' })).toEqual({
      lightMul: FEY_LIGHT_MUL,
      fogNear: CANOPY_FOG.light[0],
      fogFar: CANOPY_FOG.light[1],
    });
  });

  it('haunted canopy bumps fog one step heavier (light→medium→heavy→heavy)', () => {
    expect(canopyInterior({ shade: true, fog: 'light', forestKind: 'haunted' })).toEqual({
      lightMul: CANOPY_LIGHT_MUL,
      fogNear: CANOPY_FOG.medium[0],
      fogFar: CANOPY_FOG.medium[1],
    });
    expect(canopyInterior({ shade: true, fog: 'medium', forestKind: 'haunted' })).toEqual({
      lightMul: CANOPY_LIGHT_MUL,
      fogNear: CANOPY_FOG.heavy[0],
      fogFar: CANOPY_FOG.heavy[1],
    });
    // Already-heavy saturates instead of stepping off the scale.
    expect(canopyInterior({ shade: true, fog: 'heavy', forestKind: 'haunted' })).toEqual({
      lightMul: CANOPY_LIGHT_MUL,
      fogNear: CANOPY_FOG.heavy[0],
      fogFar: CANOPY_FOG.heavy[1],
    });
  });

  it('bumpFogOneStep covers the full ladder', () => {
    expect(bumpFogOneStep('light')).toBe('medium');
    expect(bumpFogOneStep('medium')).toBe('heavy');
    expect(bumpFogOneStep('heavy')).toBe('heavy');
  });

  it('the neutral interior matches the base ground fog + unit light multiplier', () => {
    // The damp converges to THIS when leaving canopy; it must equal the base
    // fog args World3DLighting uses when interior is null, or exiting a forest
    // would visibly pop at the null handoff.
    expect(NEUTRAL_INTERIOR).toEqual({
      lightMul: 1,
      fogNear: GROUND_FOG_NEAR,
      fogFar: GROUND_FOG_FAR,
    });
    expect(GROUND_FOG_NEAR).toBe(450);
    expect(GROUND_FOG_FAR).toBe(2000);
  });
});
