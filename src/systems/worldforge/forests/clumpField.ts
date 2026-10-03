/**
 * @file clumpField.ts — where vegetation crowds and where it opens out.
 *
 * Every scatter this project has shipped has been statistically even. The
 * per-vertex tree scatter was even, the blue-noise rejection sampler in
 * generateLocal is even by construction, and the single-octave clearing gate
 * bolted onto it only cut holes in an otherwise even field. Evenness is the
 * thing that gives a procedural forest away — it survives fog, it survives
 * good tree meshes, and it reads as an orchard from thirty meters out.
 *
 * Real vegetation is patchy at every scale because it is competing for light
 * and water that are themselves patchy. A treefall gap grows a near-impassable
 * thicket; fifteen meters away under closed canopy the floor is almost bare.
 * That structure is what this field buys, for three noise lookups per
 * candidate.
 *
 * Three decisions here are load-bearing, and each replaces something the old
 * gate got wrong:
 *
 * 1. THREE OCTAVES, MULTIPLIED. One octave gives a field whose histogram peaks
 *    in the middle, so the result is an even sprinkle with soft density
 *    variation — which is the lattice it was meant to hide, only blurrier. Two
 *    still leaves a recognizable mean everywhere. Multiplying three makes the
 *    product properly heavy-tailed: most of the ground sits well below the
 *    mean and a small fraction saturates, which is what gives dense knots with
 *    open floor between them. Measured over 2.6M samples the field has mean
 *    0.25, median 0.24, and a 99th percentile of 0.61.
 *
 * 2. A PROBABILITY, NOT A BOOLEAN. The old gate was `noise > threshold`, and a
 *    hard cutoff draws a contour line through the forest: on one side full
 *    density, on the other side nothing, with a visible edge between them that
 *    no amount of jitter hides. Acceptance varies continuously instead, so the
 *    thicket thins toward its margin the way a real one does.
 *
 * 3. WORLD FEET, NOT WINDOW-LOCAL. The field is sampled at absolute world feet
 *    so two adjacent local windows evaluate the same world foot to the same
 *    value and a thicket continues across the seam instead of restarting. This
 *    is the same reasoning grassField and the old clearing gate already used.
 *
 * The field is deliberately NOT limited to dense forest. A grassland with its
 * trees spread evenly is an orchard, and a savannah's trees clump for exactly
 * the same reasons a rainforest's do.
 */
import { patchNoise2 } from '../vegetation/grassField';
import {
  CLEARING_FREQ,
  CLEARING_SALT,
  CLUMP_ACCEPT_BASE,
  CLUMP_ACCEPT_GAIN,
  CLUMP_ACCEPT_POW,
  CLUMP_DENS_FULL,
  CLUMP_KNOT_FREQ,
  CLUMP_KNOT_MIX,
  CLUMP_MID_MIX,
  CLUMP_SEP_RELIEF,
  CLUMP_STAND_FREQ,
} from './forestTunables';

/**
 * Raw patchiness at a world point, in feet. Runs roughly 0..0.75 with a mean
 * near 0.25; it is a shape, not a probability, and callers should go through
 * {@link clumpAccept} rather than thresholding it.
 *
 * The middle octave keeps CLEARING_SALT and CLEARING_FREQ, so the ~333 ft
 * clearing structure the forests pass tuned survives this change and only
 * gains a coarser stand scale above it and a finer knot scale below.
 */
export function clumpAt(xFt: number, yFt: number): number {
  const u = xFt / 1000;
  const v = yFt / 1000;
  const stand = patchNoise2(u, v, CLEARING_SALT, CLUMP_STAND_FREQ);
  const clump = patchNoise2(u, v, CLEARING_SALT + 1013, CLEARING_FREQ);
  const knot = patchNoise2(u, v, CLEARING_SALT + 2027, CLUMP_KNOT_FREQ);
  // The two finer octaves modulate rather than replace: each is remapped into
  // a band that never reaches zero, so a knot can thin a stand but only the
  // stand octave can empty the ground completely. Letting all three reach zero
  // independently punches pinholes everywhere and the clearings stop reading
  // as places.
  return (
    stand *
    (CLUMP_MID_MIX[0] + CLUMP_MID_MIX[1] * clump) *
    (CLUMP_KNOT_MIX[0] + CLUMP_KNOT_MIX[1] * knot)
  );
}

/**
 * Acceptance probability for a candidate sitting at `clump`.
 *
 * Raised to a power, because the point is to redistribute density rather than
 * to dim it uniformly: a linear map moves the mean and leaves the shape alone,
 * while an exponent pushes the low ground down and lets the high ground
 * saturate. Probabilities above 1 simply always accept, which is what makes
 * the dense knots fill in solid.
 *
 * The number that matters is the spread between the field's middle quartiles,
 * NOT between its extremes — see CLUMP_ACCEPT_POW for the measurement that
 * moved these values. Most of a window sits in the middle, so that is the only
 * contrast the eye ever gets to see.
 */
export function clumpAccept(clump: number): number {
  return CLUMP_ACCEPT_BASE + CLUMP_ACCEPT_GAIN * Math.pow(clump, CLUMP_ACCEPT_POW);
}

/**
 * How deep into a clump a point sits: 0 at the ragged edge, 1 well inside.
 *
 * Species use this to size themselves, so the biggest individuals stand in the
 * middle of a thicket and the seedlings ring its outside — which is how a real
 * cohort grows, and is a whole extra axis of variation for one multiply.
 */
export function clumpDens(clump: number): number {
  return Math.min(1, clump / CLUMP_DENS_FULL);
}

/**
 * Minimum-separation multiplier for a candidate at `dens`.
 *
 * A fixed minimum separation is a hard ceiling on how tight a thicket can get,
 * so the clump field can raise the *chance* of a tree landing somewhere but
 * never the density once the spacing rule binds. Relaxing the rule toward the
 * middle of a clump is what lets a knot actually close over. It only ever
 * shrinks the separation, which matters to the caller: a spatial index sized
 * for the unrelaxed radius stays correct.
 */
export function clumpSeparationScale(dens: number): number {
  return 1 - CLUMP_SEP_RELIEF * dens;
}
