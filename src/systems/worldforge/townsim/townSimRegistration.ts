/**
 * @file townSimRegistration.ts — Plan D: build a living-world sim state for a
 * REAL burg (not a demo town), so visiting a town registers it into the sim.
 *
 * Uses the SAME canonical town pipeline the 3D world renders from
 * (getCanonicalTownPlan → toArtifactPlan → generateTownRoster with the burg's
 * culture namer), so the chronicle is about this burg's real people. Then tags
 * key NPCs (Plan B) and seeds the life-event sim (Plan A) starting at the
 * current game day.
 *
 * Per the no-fallback directive, this does not swallow errors: it is only called
 * for real town tiles, where the canonical town generation already succeeds
 * (it's what renders the 3D town the player is entering).
 */
import { SeededRandom } from '../../../utils/random/seededRandom';
import { getBridgeAtlas, getBurgNamer } from '../bridge/legacySubmapBridge';
import { getCanonicalTownPlan, canonicalTownSeedPath } from '../town/canonicalTown';
import { toArtifactPlan } from '../town/townPlanAdapter';
import { generateTownRoster } from '../roster/generateTownRoster';
import { assignFamilies } from '../roster/family';
import { makeSeedPath, seedFromPath } from '../seedPath';
import { DAYS_PER_YEAR } from './constants';
import { assignKeyNpcs } from './keyNpcs';
import { initTownSimState } from './townSim';
import { advanceTown } from './townSimRegistry';
import type { TownSimState } from './types';

/**
 * Years of history simulated BEFORE the player's first visit, so a town arrives
 * with a populated recent chronicle (deaths, marriages, successions, festivals)
 * instead of an empty one. The generated roster therefore seeds the town as it
 * stood ~BACKSTORY_YEARS ago; the sim then evolves it forward to the present.
 */
const BACKSTORY_YEARS = 3;

/**
 * Build the TownSimState for a burg, current as of `currentDay`. The town is
 * seeded BACKSTORY_YEARS in the past and simulated forward to `currentDay` so it
 * arrives with real recent history. Deterministic from (worldSeed, burgId): the
 * per-(burg,day) re-seeding in advanceTown makes the backfill reproducible.
 */
export function buildTownSimStateForBurg(
  worldSeed: number,
  burgId: number,
  currentDay: number,
): TownSimState {
  const atlas = getBridgeAtlas(worldSeed);
  const enginePlan = getCanonicalTownPlan(atlas, worldSeed, burgId);
  const { plan } = toArtifactPlan(enginePlan, burgId);

  const seedPath = canonicalTownSeedPath(worldSeed, burgId);
  const nameFor = getBurgNamer(worldSeed, burgId);
  const roster = generateTownRoster(plan, seedPath, { nameFor });

  const families = assignFamilies(
    roster.occupants,
    makeSeedPath(worldSeed, `burg:${burgId}`, 's:family'),
  );
  const keyRng = new SeededRandom(
    seedFromPath(makeSeedPath(worldSeed, `burg:${burgId}`, 's:keynpc')),
  );
  const keyRoles = assignKeyNpcs(plan, roster, { rng: keyRng });

  // Seed in the past (roster ages reflect the town then), then simulate forward
  // to the present so the chronicle is already populated on arrival.
  const seeded = initTownSimState(burgId, roster, families, keyRoles, currentDay - BACKSTORY_YEARS * DAYS_PER_YEAR);
  return advanceTown(seeded, worldSeed, currentDay);
}
