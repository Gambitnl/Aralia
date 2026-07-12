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

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (s: number): number => s * s * (3 - 2 * s);

/** Durations (seconds) — matched to CharacterActor's auto-return timers. */
export const OVERLAY_DURATIONS: Record<string, number> = {
  hit_react: 0.5,
  attack_melee: 0.8,
  attack_ranged: 0.6,
  cast_spell: 1.0,
  death: 0.7,
};

export function combatOverlayPose(animState: AnimationState, animTime: number): OverlayPose {
  switch (animState) {
    case 'attack_melee': {
      const u = clamp01(animTime / OVERLAY_DURATIONS.attack_melee);
      return { pitch: Math.sin(Math.PI * u) * 0.42, yOffset: 0, settled: false };
    }
    case 'attack_ranged': {
      const u = clamp01(animTime / OVERLAY_DURATIONS.attack_ranged);
      return { pitch: Math.sin(Math.PI * u) * -0.14, yOffset: 0, settled: false };
    }
    case 'cast_spell': {
      const u = clamp01(animTime / OVERLAY_DURATIONS.cast_spell);
      return { pitch: 0, yOffset: Math.sin(Math.PI * u) * 0.14, settled: false };
    }
    case 'hit_react': {
      const u = clamp01(animTime / OVERLAY_DURATIONS.hit_react);
      return { pitch: Math.sin(Math.PI * u) * -0.32, yOffset: 0, settled: false };
    }
    case 'death': {
      const u = smooth(clamp01(animTime / OVERLAY_DURATIONS.death));
      return { pitch: -Math.PI * 0.5 * u, yOffset: 0, settled: u >= 1 };
    }
    default:
      return { pitch: 0, yOffset: 0, settled: false };
  }
}
