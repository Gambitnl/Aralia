/**
 * @file nightLightModel.ts — how bright the street frame is at each hour, from
 * the sun model (GG-594 follow-up, Remy 2026-11-02: "Adapt a little at night").
 *
 * WHY. Eye adaptation (src/systems/world3d/eyeAdaptation.ts) lifts a frame that
 * is darker than its key. By day the key sits under the street, so only a dark
 * room is lifted. At night the whole street is dark, so a fixed key would lift
 * the night street toward day, and the meter alone cannot tell "night" from "a
 * dark room by day". This model gives the meter the normal street level for
 * the hour. The key then follows the night street (plus a small lift), and
 * only a frame darker than that night street is lifted more.
 *
 * THE MODEL. The night look does not come from light intensity: `sunFromTime`
 * keeps the key light at 1.5 and raises the hemisphere light to 6.0 at night.
 * It comes from color (a moonlit key, a navy sky light) and from the dark sky
 * dome and fog. So the model sums three linear luminances from the same sun
 * state the renderer uses, each with a weight fitted to the meter:
 *   street = SUN * sunColor * sunIntensity * max(0, dir.y)   direct key on the ground
 *          + SKY * hemiSkyColor * hemiIntensity               sky light
 *          + DOME * (skyZenith + skyHorizon) / 2              the sky in view
 * Fitted to the meter's log2 average at the town demo's start view (WebGL,
 * 2026-11-02, `.agent/scratch/houselight/nightcal`): rms 0.17 stop over six
 * hours; a ground-light term alone misses by 0.62 stop rms.
 */
import * as THREE from 'three';
import { sunFromTime } from './World3DLighting';

/** The fitted weights (log2) and the measurements they were fitted to. */
export const NIGHT_LIGHT_FIT = {
  SUN_LOG2: -4.6,
  SKY_LOG2: -6.05,
  DOME_LOG2: -5,
  /** [hour, measured log2 average of the street start view at exposure 1]. */
  CALIBRATION: [[13, -3.64], [19, -4.87], [20, -6.18], [21, -5.83], [23, -5.66], [2, -5.82]] as ReadonlyArray<readonly [number, number]>,
} as const;

const scratch = new THREE.Color();
/** Linear Rec. 709 luminance of a color given as hex (three converts sRGB hex to linear). */
function lumOf(hex: number): number {
  scratch.setHex(hex);
  return 0.2126 * scratch.r + 0.7152 * scratch.g + 0.0722 * scratch.b;
}

/** The modeled log2 average luminance of the street frame at this hour. */
export function streetLog2At(hours: number): number {
  const s = sunFromTime(hours);
  const sun = lumOf(s.sunColor) * s.sunIntensity * Math.max(0, s.direction[1]);
  const sky = lumOf(s.hemiSkyColor) * s.hemiIntensity;
  const dome = (lumOf(s.skyZenith) + lumOf(s.skyHorizon)) / 2;
  const { SUN_LOG2, SKY_LOG2, DOME_LOG2 } = NIGHT_LIGHT_FIT;
  return Math.log2(2 ** SUN_LOG2 * sun + 2 ** SKY_LOG2 * sky + 2 ** DOME_LOG2 * dome);
}
