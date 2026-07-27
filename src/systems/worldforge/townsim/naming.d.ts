/**
 * @file naming.ts — believable newborn names for the living-world sim.
 *
 * A newborn takes a race/sex-appropriate given name and INHERITS the family
 * surname from a parent (so families read as families in the chronicle:
 * "Bryn Stone" → child "Ada Stone"). Pure & deterministic — all choices come
 * from the supplied SeededRandom; falls back gracefully for races without a
 * dedicated name set.
 */
import type { SeededRandom } from '../../../utils/random/seededRandom';
/**
 * A newborn's full name: race/sex-appropriate given name + the family surname
 * inherited from `parentName` (or a fresh surname if the parent has none).
 * Draws (in order): sex coin, given-name pick, and a surname pick only when the
 * parent has no surname to inherit.
 */
export declare function newbornName(rng: SeededRandom, race: string, parentName: string): string;
