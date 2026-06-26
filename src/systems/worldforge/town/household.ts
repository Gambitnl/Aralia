/**
 * @file household.ts — lazy named household for one town building.
 *
 * "Who are they?" answered on demand. The population pass ({@link assignTownPopulation})
 * gives every home an occupant COUNT but no names — naming all 120k souls of a capital
 * eagerly is wasteful. Instead each building's household is generated lazily and
 * deterministically from the town seed + the building's stable `homeId`, so inspecting
 * a house always yields the same family, but unvisited houses cost nothing.
 *
 * Reuses the roster's family shapes in spirit (a married couple with children, a single
 * parent, lone folk) without depending on the whole-town roster pass.
 */
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import type { BuildingType } from './population';
import type { AgeBand } from '../roster/types';

export interface HouseholdMember {
  name: string;
  ageBand: AgeBand;
  age: number;
  /** Role within the household for UI flavour. */
  role: 'head' | 'spouse' | 'child' | 'elder' | 'kin' | 'lodger';
}

export interface Household {
  homeId: string;
  /** Family surname (the household is "the <surname>s"). */
  surname: string;
  /** Building type the family lives in (cottage/townhouse/tenement/farmstead). */
  dwelling: BuildingType;
  members: HouseholdMember[];
  /** One-line description for tooltips ("The Ashbournes — a family of 5"). */
  summary: string;
}

// Deterministic name material. Kept self-contained so a household never needs the
// heavy FMG culture namer; varied enough that adjacent homes read distinct.
const GIVEN_M = ['Aldric', 'Bram', 'Cale', 'Doran', 'Edmund', 'Faelan', 'Garrick', 'Hew', 'Ivo', 'Joss', 'Ksiv', 'Loran', 'Marek', 'Ned', 'Oswin', 'Pell', 'Roban', 'Sten', 'Tomas', 'Ulric', 'Wat'];
const GIVEN_F = ['Adela', 'Bryn', 'Cora', 'Della', 'Edith', 'Fenna', 'Gwen', 'Hilda', 'Isolde', 'Jora', 'Katla', 'Lys', 'Mara', 'Nessa', 'Orla', 'Petra', 'Rosa', 'Senna', 'Talia', 'Ysolde'];
const GIVEN_C = ['Tib', 'Wren', 'Pip', 'Lark', 'Robin', 'Sela', 'Cob', 'Maddy', 'Fen', 'Bess', 'Dob', 'Nan'];
const SUR_A = ['Ash', 'Brook', 'Black', 'Cole', 'Dun', 'Fair', 'Green', 'Hart', 'Iron', 'Marsh', 'Oak', 'Stone', 'Thorn', 'West', 'White', 'Wood'];
const SUR_B = ['bourne', 'croft', 'down', 'field', 'ford', 'hall', 'ham', 'hill', 'ley', 'mill', 'smith', 'stead', 'ton', 'well', 'wick', 'wright'];

const AGE_RANGE: Record<AgeBand, [number, number]> = { child: [3, 15], adult: [19, 56], elder: [58, 86] };

interface Rng { next(): number }
const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng.next() * arr.length)] ?? arr[0];
const ageIn = (rng: Rng, band: AgeBand): number => {
  const [lo, hi] = AGE_RANGE[band];
  return lo + Math.floor(rng.next() * (hi - lo + 1));
};

/**
 * Generate (lazily) the named household living in one building. `occupants` is the
 * resident count from {@link assignTownPopulation}; `dwelling` its building type.
 * Deterministic per (town seed, homeId).
 */
export function generateHousehold(
  townSeed: SeedPath,
  homeId: string,
  occupants: number,
  dwelling: BuildingType = 'cottage',
): Household {
  const rng = rngFromPath(streamPath(townSeed, `home:${homeId}`));
  const surname = pick(rng, SUR_A) + pick(rng, SUR_B);
  const n = Math.max(1, occupants);
  const members: HouseholdMember[] = [];

  // Tenements hold several unrelated households crammed in; cottages/townhouses/
  // farmsteads hold one family. We name one representative family + lodgers.
  const head: HouseholdMember = {
    name: `${pick(rng, rng.next() < 0.5 ? GIVEN_M : GIVEN_F)} ${surname}`,
    ageBand: n >= 2 && rng.next() < 0.18 ? 'elder' : 'adult',
    age: 0, role: 'head',
  };
  head.age = ageIn(rng, head.ageBand);
  members.push(head);

  let remaining = n - 1;
  // A spouse for most multi-person homes.
  if (remaining > 0 && rng.next() < 0.78) {
    const sp: HouseholdMember = {
      name: `${pick(rng, rng.next() < 0.5 ? GIVEN_M : GIVEN_F)} ${surname}`,
      ageBand: head.ageBand === 'elder' ? 'elder' : 'adult', age: 0, role: 'spouse',
    };
    sp.age = ageIn(rng, sp.ageBand);
    members.push(sp); remaining--;
  }
  // Children fill the next slots, then any extra adults are kin/lodgers.
  const kids = dwelling === 'tenement' ? Math.min(remaining, 1 + Math.floor(rng.next() * 2)) : remaining;
  for (let i = 0; i < remaining; i++) {
    if (i < kids) {
      const c: HouseholdMember = { name: `${pick(rng, GIVEN_C)} ${surname}`, ageBand: 'child', age: 0, role: 'child' };
      c.age = ageIn(rng, 'child'); members.push(c);
    } else {
      const isElder = rng.next() < 0.25;
      const k: HouseholdMember = {
        name: `${pick(rng, rng.next() < 0.5 ? GIVEN_M : GIVEN_F)} ${dwelling === 'tenement' ? pick(rng, SUR_A) + pick(rng, SUR_B) : surname}`,
        ageBand: isElder ? 'elder' : 'adult', age: 0, role: dwelling === 'tenement' ? 'lodger' : (isElder ? 'elder' : 'kin'),
      };
      k.age = ageIn(rng, k.ageBand); members.push(k);
    }
  }

  const kidCount = members.filter((m) => m.role === 'child').length;
  const summary =
    n === 1 ? `${head.name} lives here alone`
      : dwelling === 'tenement' ? `${members.length} lodgers crammed into a tenement`
        : `The ${surname}s — a household of ${n}${kidCount ? `, ${kidCount} child${kidCount > 1 ? 'ren' : ''}` : ''}`;

  return { homeId, surname, dwelling, members, summary };
}
