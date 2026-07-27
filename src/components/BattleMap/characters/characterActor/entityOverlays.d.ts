/**
 * @file entityOverlays.ts — combat action poses layered on generated entities.
 *
 * The entity generator handles idle/walk through its gait drivers; combat
 * actions (lunge, recoil, cast, death fall) are simple whole-body overlays
 * applied to the entity's root: a pitch (radians, + = lunge forward toward
 * facing), a vertical offset (meters), and the death fall. Pure math so the
 * timing contract is testable without a renderer.
 */
import type { AnimationState } from './models';
export interface OverlayPose {
    /** Whole-body pitch in radians; positive pitches forward (attack lunge). */
    pitch: number;
    /** Vertical offset in meters (cast rise). */
    yOffset: number;
    /** True once the death fall has fully landed — callers may freeze updates. */
    settled: boolean;
}
/** Durations (seconds) — matched to CharacterActor's auto-return timers. */
export declare const OVERLAY_DURATIONS: Record<string, number>;
export declare function combatOverlayPose(animState: AnimationState, animTime: number): OverlayPose;
