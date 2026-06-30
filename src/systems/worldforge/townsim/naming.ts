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
import { RACE_NAMES } from '../../../data/names/raceNames';

const GENERIC_GIVEN = [
  'Ada', 'Bryn', 'Cael', 'Dara', 'Edda', 'Finn', 'Gwen', 'Hale',
  'Isa', 'Joss', 'Kael', 'Lira', 'Maro', 'Nessa', 'Orin', 'Pell',
];
const GENERIC_SURNAMES = [
  'Ash', 'Brook', 'Crane', 'Dale', 'Frost', 'Gale', 'Holt', 'Lark',
  'Mire', 'Reed', 'Stone', 'Thorn', 'Vale', 'Wren',
];

/** Map a townsfolk race to a RACE_NAMES key, falling back to 'human'. */
function raceKey(race: string): string {
  const k = race.toLowerCase();
  return RACE_NAMES[k] ? k : 'human';
}

/** The surname portion of a full name (last token), or null if single-token. */
function surnameOf(name: string): string | null {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : null;
}

/**
 * A newborn's full name: race/sex-appropriate given name + the family surname
 * inherited from `parentName` (or a fresh surname if the parent has none).
 * Draws (in order): sex coin, given-name pick, and a surname pick only when the
 * parent has no surname to inherit.
 */
export function newbornName(rng: SeededRandom, race: string, parentName: string): string {
  const pools = RACE_NAMES[raceKey(race)] ?? RACE_NAMES.human;
  const givenPool = rng.next() < 0.5 ? pools.male : pools.female;
  const given = givenPool && givenPool.length > 0 ? rng.pick(givenPool) : rng.pick(GENERIC_GIVEN);
  const inherited = surnameOf(parentName);
  const surname =
    inherited ??
    rng.pick(pools.surnames && pools.surnames.length > 0 ? pools.surnames : GENERIC_SURNAMES);
  return `${given} ${surname}`;
}
