/**
 * @file actorStatusShading.ts — the body-shading half of the combat actor's
 * status story (3d-combat-map G10).
 *
 * WHAT THIS IS: a pure lookup that turns a `CombatCharacter`'s life state and
 * active conditions into the four body-shading numbers `useFresnelRim` feeds
 * its shader patch — rim color/intensity (silhouette pop, G9) and tint/
 * desaturation (defeat and status readability, G10).
 *
 * WHY IT IS ITS OWN FILE: `CharacterActor.tsx` is already the widest file in
 * the actor tree and is queued for a split. Keeping the palette and the
 * condition→color mapping out here means the split moves a component, not a
 * table, and the same mapping can later be reused by the 2D token or the
 * WebGPU scene without importing a React component.
 *
 * WHERE THE COLORS LIVE (task agora-f821.24): NOT here. Every condition hue,
 * tint strength, desaturation and precedence number now comes from the shared
 * palette `src/utils/visuals/conditionPalette.ts`, which the 2D chip strip and
 * the WebGPU token read from the same file. This module keeps only what is
 * shading rather than palette: the rim numbers, the defeat override, and the
 * burning flicker envelope (motion, not color).
 *
 * WHAT IS PRESERVED: the chip strip stays the authoritative *name* readout.
 * This adds a body-level cue for the conditions that read at 20-world-unit
 * tactical zoom, where a 14px chip does not. A condition whose palette row
 * carries `tintColor: null` gets no tint — it still shows a chip.
 *
 * BURNING FLICKER (task agora-6ab9, 2026-09-20): the burning tint is no longer
 * a constant. `resolveActorBodyShading` now also returns a `flicker` recipe for
 * the burning family, and `flickerTintStrength` turns that recipe plus a clock
 * reading into the tint strength for one frame. `useFresnelRim` calls it in its
 * own `useFrame` and writes the result straight into the live uniform, so the
 * body pulses without a React re-render and without a shader recompile.
 *
 * The flicker changes ONE number. It adds no color. The chip/body hue
 * disagreement the deepdive found (rose against orange) was ruled by Remy on
 * 2026-09-21: Set C, one hex for both surfaces, and it now lives in the
 * palette rather than in a table here.
 */
import type { CombatCharacter } from '../../../types/combat';
import { resolveDominantCondition } from '../../../utils/visuals/conditionPalette';

/**
 * A repeating swing applied to `tintStrength`, for conditions that must read as
 * ALIVE at tactical zoom. Fire is the only one so far.
 *
 * The swing is two sine waves at rates that do not divide each other, so the
 * pattern never settles into a visible loop. It is fully deterministic: the
 * only inputs are this recipe and the render clock, so two runs of the same
 * encounter light the same way.
 */
export interface ActorTintFlicker {
  /** How far `tintStrength` swings each side of its resting value (0..1). */
  amplitude: number;
  /** Primary flame rate, in cycles per second. */
  hz: number;
  /** Second rate, in cycles per second. It must not divide `hz`. */
  harmonicHz: number;
  /** Share of the swing the second rate carries (0..1). */
  harmonicWeight: number;
  /** Offset in seconds, per actor, so two burning creatures pulse apart. */
  phase: number;
}

/** The body-shading numbers a single actor's shader patch is driven with. */
export interface ActorBodyShading {
  /** Rim color (fresnel edge). Cool by default; warmed for defeat. */
  rimColor: number;
  /** Rim strength. Raised over the old close-up value for tactical zoom. */
  rimIntensity: number;
  /** Fresnel exponent. Lower = wider rim band. */
  rimPower: number;
  /** Overlay hue applied to the lit body color, or null for none. */
  tintColor: number | null;
  /** How far the body moves toward `tintColor` (0..1). */
  tintStrength: number;
  /** How far the body moves toward greyscale first (0..1). */
  desaturate: number;
  /** Per-frame swing for `tintStrength`, or null for a steady tint. */
  flicker: ActorTintFlicker | null;
}

/**
 * G9 baseline. The old close-up values (intensity 0.75, power 2.6) were tuned
 * against a MeshStandardMaterial box model at conversational distance. The
 * shipping body is a toon-shaded generated entity whose own `toonMaterial`
 * rim is only 0.12 — at 20 world units against forest clutter that reads as
 * no edge at all. 1.15 with a wider band (power 2.1) is the separation value:
 * strong enough to draw an edge over dark canopy, still under the 1.4 that an
 * earlier pass found washed armor color out.
 */
const BASE: ActorBodyShading = {
  rimColor: 0xbfd8ff, // cool backlight — biome-neutral, reads over green/brown
  rimIntensity: 1.15,
  rimPower: 2.1,
  tintColor: null,
  tintStrength: 0,
  desaturate: 0,
  flicker: null,
};

/**
 * Defeat (G10). Three cues at once so the state survives any single one being
 * hidden: the body drops most of its color, takes a blood tint, and the rim
 * turns warm so even the silhouette reads "not a live combatant".
 */
const DEFEATED: ActorBodyShading = {
  rimColor: 0xff8a7a,
  rimIntensity: 0.9,
  rimPower: 2.4,
  tintColor: 0xd32f2f,
  tintStrength: 0.42,
  desaturate: 0.72,
  flicker: null,
};

/**
 * The burning swing. 0.5 plus or minus 0.16 keeps the tint inside 0.34..0.66,
 * so the body never loses its own armor color at the low end and never goes
 * flat orange at the high end. 6.1 Hz is the rate a small real fire flickers
 * at; the 9.7 Hz partial breaks the beat. `phase` is filled in per actor below.
 */
const BURNING_FLICKER: ActorTintFlicker = {
  amplitude: 0.16,
  hz: 6.1,
  harmonicHz: 9.7,
  harmonicWeight: 0.35,
  phase: 0,
};

/**
 * A stable 0..1 second offset for one actor, hashed from its id. Two creatures
 * that catch fire on the same turn must not pulse in step, and the id is the
 * only value that is both stable and different per actor. This is the same
 * hash `CharacterActor` already uses for its no-enemy facing fallback, so the
 * actor tree keeps one idiom. It is presentation, not game logic, and it draws
 * no random numbers.
 */
function flickerPhase(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}

/** Every status name on a character, lowercased, in a stable order. */
function statusNames(character: CombatCharacter): string[] {
  const out: string[] = [];
  for (const c of character.conditions ?? []) out.push(String(c.name).toLowerCase());
  for (const s of character.statusEffects ?? []) out.push(String(s.name).toLowerCase());
  return out;
}

/** The palette key whose body tint moves. Fire that holds still is not fire. */
const FLICKERING_KEY = 'ignited';

/**
 * Resolve the body shading for one actor.
 *
 * Precedence: defeat beats every condition (a corpse is not "poisoned green"),
 * then whichever condition the shared palette calls dominant, then the plain
 * silhouette baseline. Rim values always come from the baseline unless defeat
 * overrides them — a tinted living body still needs the same edge separation.
 *
 * The severity ladder and the substring-free lookup both belong to the palette
 * now. A condition the palette knows but has no agreed color for resolves with
 * `tintColor: null`, and this returns the untinted baseline rather than
 * guessing a hue.
 */
export function resolveActorBodyShading(character: CombatCharacter): ActorBodyShading {
  if (character.currentHP <= 0) return DEFEATED;
  const dominant = resolveDominantCondition(statusNames(character));
  if (dominant === null || dominant.tintColor === null) return BASE;
  return {
    ...BASE,
    tintColor: dominant.tintColor,
    tintStrength: dominant.tintStrength,
    desaturate: dominant.desaturate,
    flicker:
      dominant.key === FLICKERING_KEY
        ? { ...BURNING_FLICKER, phase: flickerPhase(character.id) }
        : null,
  };
}

/**
 * The tint strength for ONE frame of a flickering actor.
 *
 * Pure and allocation-free, because `useFresnelRim` calls it once per burning
 * actor per frame. The result is clamped to 0..1: the shader reads it as a mix
 * factor, and a value outside that range would push the body past its own tint
 * color.
 *
 * @param base          the resting `tintStrength` from `resolveActorBodyShading`.
 * @param flicker       the recipe from the same call.
 * @param timeSeconds   the render clock, in seconds.
 */
export function flickerTintStrength(
  base: number,
  flicker: ActorTintFlicker,
  timeSeconds: number,
): number {
  const t = (timeSeconds + flicker.phase) * Math.PI * 2;
  const primary = Math.sin(t * flicker.hz);
  const harmonic = Math.sin(t * flicker.harmonicHz);
  const swing = primary * (1 - flicker.harmonicWeight) + harmonic * flicker.harmonicWeight;
  const value = base + swing * flicker.amplitude;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Exported for tests and for any future biome-specific rim experiment. */
export const ACTOR_SHADING_BASE = BASE;
export const ACTOR_SHADING_DEFEATED = DEFEATED;
/** Exported so a test can pin the burning swing without re-declaring it. */
export const ACTOR_BURNING_FLICKER = BURNING_FLICKER;
