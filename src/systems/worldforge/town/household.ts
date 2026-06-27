/**
 * @file household.ts — lazy named household for one town building.
 *
 * "Who are they?" answered on demand. The population pass ({@link assignTownPopulation})
 * gives every home an occupant COUNT but no names — naming all 120k souls of a capital
 * eagerly is wasteful. Instead each building's household is generated lazily and
 * deterministically from the town seed + the building's stable `homeId`, so inspecting
 * a house always yields the same family, but unvisited houses cost nothing.
 *
 * Bridges to the whole-town roster/agent-sim: ancestry is drawn from the SAME
 * `TOWNSFOLK_RACES` distribution the roster uses, and occupations come from the
 * economy graph (proprietor/staff/labourer + workplace type) the population pass wires.
 */
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import type { BuildingType } from './population';
import type { AgeBand } from '../roster/types';
import { TOWNSFOLK_RACES } from '../roster/family';

export interface HouseholdMember {
  name: string;
  ageBand: AgeBand;
  age: number;
  /** Ancestry (a `raceGroups` name) — blood relatives share it; a married-in spouse may differ. */
  race: string;
  /** Role within the household for UI flavour. */
  role: 'head' | 'spouse' | 'child' | 'elder' | 'kin' | 'lodger';
  /** What they do — derived from the building's economy role (empty for children). */
  occupation: string;
}

/** Work context for the home, from the economy graph (population.assignWorkplaces). */
export interface HouseholdWork {
  role?: 'proprietor' | 'staff' | 'labourer';
  /** The workplace's building type (inn/smithy/…), when role is proprietor/staff. */
  workplaceType?: BuildingType;
}

export interface Household {
  homeId: string;
  /** Family surname (the household is "the <surname>s"). */
  surname: string;
  /** Building type the family lives in (cottage/townhouse/tenement/farmstead). */
  dwelling: BuildingType;
  /** Bloodline ancestry of the household head. */
  ancestry: string;
  /** The head's trade — the household's public identity ("blacksmith", "farmer"). */
  occupation: string;
  members: HouseholdMember[];
  /** One-line description for tooltips ("The Ashbournes — a smith's household of 5"). */
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

// Trade nouns by workplace type — the proprietor's title and a staffer's role.
const PROPRIETOR_TRADE: Partial<Record<BuildingType, string>> = {
  inn: 'innkeeper', tavern: 'taverner', shop: 'shopkeeper', smithy: 'blacksmith', workshop: 'master artisan', civic: 'town official',
};
const STAFF_TRADE: Partial<Record<BuildingType, string>> = {
  inn: 'inn servant', tavern: 'serving-hand', shop: 'shop hand', smithy: "smith's apprentice", workshop: 'journeyman', civic: 'clerk',
};

interface Rng { next(): number }
const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng.next() * arr.length)] ?? arr[0];
const ageIn = (rng: Rng, band: AgeBand): number => {
  const [lo, hi] = AGE_RANGE[band];
  return lo + Math.floor(rng.next() * (hi - lo + 1));
};

/** The head's trade from dwelling + economy role. */
function headOccupation(dwelling: BuildingType, work?: HouseholdWork): string {
  if (dwelling === 'farmstead') return 'farmer';
  if (work?.role === 'proprietor' && work.workplaceType) return PROPRIETOR_TRADE[work.workplaceType] ?? 'tradesfolk';
  if (work?.role === 'staff' && work.workplaceType) return STAFF_TRADE[work.workplaceType] ?? 'labourer';
  return 'labourer';
}

/**
 * Generate (lazily) the named household living in one building. `occupants` is the
 * resident count from {@link assignTownPopulation}; `dwelling` its building type;
 * `work` the economy role (so the head gets a real trade). Deterministic per
 * (town seed, homeId).
 */
export function generateHousehold(
  townSeed: SeedPath,
  homeId: string,
  occupants: number,
  dwelling: BuildingType = 'cottage',
  work?: HouseholdWork,
): Household {
  const rng = rngFromPath(streamPath(townSeed, `home:${homeId}`));
  const surname = pick(rng, SUR_A) + pick(rng, SUR_B);
  const ancestry = pick(rng, TOWNSFOLK_RACES);
  const occupation = headOccupation(dwelling, work);
  const n = Math.max(1, occupants);
  const members: HouseholdMember[] = [];

  // Tenements hold several unrelated households crammed in; cottages/townhouses/
  // farmsteads hold one family. We name one representative family + lodgers.
  const head: HouseholdMember = {
    name: `${pick(rng, rng.next() < 0.5 ? GIVEN_M : GIVEN_F)} ${surname}`,
    ageBand: n >= 2 && rng.next() < 0.18 ? 'elder' : 'adult',
    age: 0, race: ancestry, role: 'head', occupation: '',
  };
  head.age = ageIn(rng, head.ageBand);
  head.occupation = head.ageBand === 'elder' ? `retired ${occupation}` : occupation;
  members.push(head);

  let remaining = n - 1;
  // A spouse for most multi-person homes (may have married in from another ancestry).
  if (remaining > 0 && rng.next() < 0.78) {
    const sp: HouseholdMember = {
      name: `${pick(rng, rng.next() < 0.5 ? GIVEN_M : GIVEN_F)} ${surname}`,
      ageBand: head.ageBand === 'elder' ? 'elder' : 'adult', age: 0,
      race: rng.next() < 0.12 ? pick(rng, TOWNSFOLK_RACES) : ancestry,
      role: 'spouse', occupation: 'keeps the household',
    };
    sp.age = ageIn(rng, sp.ageBand);
    members.push(sp); remaining--;
  }
  // Children fill the next slots, then any extra adults are kin/lodgers.
  const kids = dwelling === 'tenement' ? Math.min(remaining, 1 + Math.floor(rng.next() * 2)) : remaining;
  for (let i = 0; i < remaining; i++) {
    if (i < kids) {
      members.push({ name: `${pick(rng, GIVEN_C)} ${surname}`, ageBand: 'child', age: ageIn(rng, 'child'), race: ancestry, role: 'child', occupation: '' });
    } else {
      const lodger = dwelling === 'tenement';
      const isElder = rng.next() < 0.25;
      members.push({
        name: `${pick(rng, rng.next() < 0.5 ? GIVEN_M : GIVEN_F)} ${lodger ? pick(rng, SUR_A) + pick(rng, SUR_B) : surname}`,
        ageBand: isElder ? 'elder' : 'adult',
        age: ageIn(rng, isElder ? 'elder' : 'adult'),
        race: lodger ? pick(rng, TOWNSFOLK_RACES) : ancestry,
        role: lodger ? 'lodger' : (isElder ? 'elder' : 'kin'),
        occupation: isElder ? 'retired' : lodger ? 'lodger' : 'helps the household',
      });
    }
  }

  const kidCount = members.filter((m) => m.role === 'child').length;
  const trade = dwelling === 'farmstead' ? 'farming' : `${occupation}'s`;
  const article = /^[aeiou]/i.test(trade) ? 'an' : 'a';
  const summary =
    n === 1 ? `${head.name}, ${occupation}, lives here alone`
      : dwelling === 'tenement' ? `${members.length} lodgers crammed into a tenement`
        : `The ${surname}s — ${article} ${trade} household of ${n}${kidCount ? `, ${kidCount} child${kidCount > 1 ? 'ren' : ''}` : ''}`;

  return { homeId, surname, dwelling, ancestry, occupation, members, summary };
}
