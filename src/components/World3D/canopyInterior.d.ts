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
 * back to `interior: null` (byte-identical base behavior) cannot pop.
 * 2026-07-21 far-shells lift: open-air fog moved from 450/2000 out to
 * 600/15000 so the region ring and atlas horizon actually show — distant
 * ranges silhouette through the haze instead of the old 2 km white-out.
 * Canopy fog grades (forest draw-in) are absolute values and unaffected. */
export declare const GROUND_FOG_NEAR = 600;
export declare const GROUND_FOG_FAR = 15000;
/** The no-canopy resting state the damp converges to outside the woods. */
export declare const NEUTRAL_INTERIOR: Readonly<CanopyInterior>;
type FogGrade = 'light' | 'medium' | 'heavy';
/** One step heavier on the fog ladder; heavy saturates. */
export declare function bumpFogOneStep(fog: FogGrade): FogGrade;
/**
 * The lighting modulation for a window's canopy, or null when there is no
 * canopy — the null is load-bearing: World3DLighting with `interior: null`
 * renders exactly the pre-canopy scene (non-forest windows stay byte-identical).
 */
export declare function canopyInterior(canopy: GroundWorld['canopy']): CanopyInterior | null;
export {};
