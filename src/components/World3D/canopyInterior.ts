/**
 * @file canopyInterior.ts — canopy → lighting-modulation math (forests Task 11).
 *
 * The pure half of the canopy atmosphere: `GroundWorld.canopy` (resolved once
 * per window by the bridge) → the light-multiplier + fog distances the scene
 * feeds `World3DLighting`. Kept out of the components so the fey/haunted rules
 * test without React or three:
 *   - plain canopy dims ambient by CANOPY_LIGHT_MUL and pulls fog to the
 *     biome def's grade;
 *   - fey woods dim LESS (their light is strange, not dark);
 *   - haunted woods push the fog ONE step heavier (light→medium→heavy→heavy).
 *
 * The ~2 s entry/exit damp lives in World3DScene (CanopyDampedLighting);
 * World3DLighting stays render-pure and just consumes the damped values.
 */
import {
  CANOPY_FOG,
  CANOPY_LIGHT_MUL,
  FEY_LIGHT_MUL,
} from '@/systems/worldforge/forests/forestTunables';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';

/** Damped/applied lighting modulation World3DLighting consumes. */
export interface CanopyInterior {
  /** Multiplier on the hemisphere (ambient) intensity. */
  lightMul: number;
  /** Fog near/far override (ground profile), same units as the base fog args. */
  fogNear: number;
  fogFar: number;
}

/** Base ground-profile fog distances (World3DLighting's open-air values).
 * The canopy damp converges to THESE when leaving the woods, so the handoff
 * back to `interior: null` (byte-identical base behavior) cannot pop. */
export const GROUND_FOG_NEAR = 450;
export const GROUND_FOG_FAR = 2000;

/** The no-canopy resting state the damp converges to outside the woods. */
export const NEUTRAL_INTERIOR: Readonly<CanopyInterior> = Object.freeze({
  lightMul: 1,
  fogNear: GROUND_FOG_NEAR,
  fogFar: GROUND_FOG_FAR,
});

type FogGrade = 'light' | 'medium' | 'heavy';

/** One step heavier on the fog ladder; heavy saturates. */
export function bumpFogOneStep(fog: FogGrade): FogGrade {
  return fog === 'light' ? 'medium' : 'heavy';
}

/**
 * The lighting modulation for a window's canopy, or null when there is no
 * canopy — the null is load-bearing: World3DLighting with `interior: null`
 * renders exactly the pre-canopy scene (non-forest windows stay byte-identical).
 */
export function canopyInterior(
  canopy: GroundWorld['canopy'],
): CanopyInterior | null {
  if (!canopy) return null;
  const fog = canopy.forestKind === 'haunted' ? bumpFogOneStep(canopy.fog) : canopy.fog;
  const [fogNear, fogFar] = CANOPY_FOG[fog];
  return {
    lightMul: canopy.forestKind === 'fey' ? FEY_LIGHT_MUL : CANOPY_LIGHT_MUL,
    fogNear,
    fogFar,
  };
}
