/**
 * This file proves the new Worldforge town roster pass behaves like a stable
 * game-system contract, not a one-off data sketch.
 *
 * It builds rosters from both a real generated town and a tiny hand-authored
 * town. The real town catches integration drift with the existing town and
 * interior generators; the synthetic town pins workshop and market behavior
 * that the current town generator does not always emit yet.
 *
 * Called by: Vitest when agents verify `src/systems/worldforge/roster/`.
 * Depends on: generateTownRoster, generateTownPlan, generateInterior, seedPath.
 */

import { generateInterior } from '../../interior/generateInterior';
import { rootSeedPath } from '../../seedPath';
import { generateTownPlan as generateEngineTown } from '../../town/townEngine';
import { toArtifactPlan } from '../../town/townPlanAdapter';
import type { RegionTownSite, TownPlan } from '../../artifacts';
import { generateTownRoster, houseBedroomCount } from '../generateTownRoster';

// ============================================================================
// Fixtures
// ============================================================================
// This section keeps test towns small and readable. The generated fixture copies
// the town-test pattern so roster tests exercise the same shape real Worldforge
// towns already produce.
// ============================================================================

const WORLD_SEED = 42;
const SEED_PATH = rootSeedPath(WORLD_SEED);

function makeSite(envelopeSize: number, gateCount: number, burgId = 77): RegionTownSite {
  const envelope = {
    x: 10_000,
    y: 20_000,
    width: envelopeSize,
    height: envelopeSize,
  };
  const cx = envelope.x + envelope.width / 2;
  const cy = envelope.y + envelope.height / 2;
  const gates: RegionTownSite['gates'] = [];

  for (let i = 0; i < gateCount; i++) {
    const angle = (i / gateCount) * Math.PI * 2;
    gates.push([
      cx + Math.cos(angle) * (envelopeSize / 2),
      cy + Math.sin(angle) * (envelopeSize / 2),
    ]);
  }

  return { burgId, envelope, gates };
}

function generatedPlan(): TownPlan {
  // The owned Voronoi-ward generator (`townEngine`) + `toArtifactPlan` — the same
  // path live towns use, after the retired rect `generateTownPlan.ts`. The site
  // envelope becomes the generation footprint.
  const { envelope, burgId } = makeSite(2_000, 4);
  const footprint: Array<[number, number]> = [
    [envelope.x, envelope.y],
    [envelope.x + envelope.width, envelope.y],
    [envelope.x + envelope.width, envelope.y + envelope.height],
    [envelope.x, envelope.y + envelope.height],
  ];
  return toArtifactPlan(generateEngineTown(footprint, SEED_PATH, { population: 4000 }), burgId).plan;
}

function syntheticPlan(): TownPlan {
  return {
    burgId: 314,
    streets: [
      {
        id: 1,
        centerline: [
          [0, 0],
          [260, 0],
        ],
        widthFt: 20,
      },
    ],
    plots: [
      {
        id: 10,
        role: 'house',
        storeys: 1,
        footprint: [
          [0, 40],
          [60, 40],
          [60, 85],
          [0, 85],
        ],
      },
      {
        id: 11,
        role: 'house',
        storeys: 1,
        footprint: [
          [90, 40],
          [150, 40],
          [150, 85],
          [90, 85],
        ],
      },
      {
        id: 20,
        role: 'market',
        storeys: 2,
        footprint: [
          [30, -90],
          [110, -90],
          [110, -30],
          [30, -30],
        ],
      },
      {
        id: 30,
        role: 'workshop',
        storeys: 1,
        footprint: [
          [170, 40],
          [230, 40],
          [230, 85],
          [170, 85],
        ],
      },
    ],
  };
}

const nameFor = (rng: { next(): number }): string => `Name-${Math.floor(rng.next() * 10_000)}`;

// ============================================================================
// Shared Checks
// ============================================================================
// This section uses aggregate counters instead of per-occupant expect calls.
// That matches the Worldforge test convention for large generated structures.
// ============================================================================

function householdCounts(roster: ReturnType<typeof generateTownRoster>): Map<number, number> {
  const counts = new Map<number, number>();
  for (const occupant of roster.occupants) {
    counts.set(occupant.homePlotId, (counts.get(occupant.homePlotId) ?? 0) + 1);
  }
  return counts;
}

function capacityForHouse(plan: TownPlan): Map<number, number> {
  const capacities = new Map<number, number>();
  for (const plot of plan.plots) {
    if (plot.role !== 'house') continue;
    // Reuse the production bedroom count (all floors) so this check can't drift
    // from the roster's own capacity math the way a local copy silently did.
    const bedroomCount = houseBedroomCount(generateInterior(plot, SEED_PATH));
    capacities.set(plot.id, 2 * bedroomCount + 1);
  }
  return capacities;
}

// ============================================================================
// Roster Behavior
// ============================================================================
// These tests define the public promise for the roster pass: deterministic
// people, valid housing, valid work assignments, and a frozen sample output.
// ============================================================================

it('is deterministic for a real generated town', () => {
  const plan = generatedPlan();
  const first = generateTownRoster(plan, SEED_PATH, { nameFor });
  const second = generateTownRoster(plan, SEED_PATH, { nameFor });

  expect(second).toEqual(first);
});

it('keeps every generated-town occupant in an existing house within bedroom capacity', () => {
  const plan = generatedPlan();
  const roster = generateTownRoster(plan, SEED_PATH, { nameFor });
  const houseIds = new Set(plan.plots.filter((plot) => plot.role === 'house').map((plot) => plot.id));
  const capacities = capacityForHouse(plan);
  const counts = householdCounts(roster);

  let invalidHome = 0;
  let overCapacity = 0;
  for (const occupant of roster.occupants) {
    if (!houseIds.has(occupant.homePlotId)) invalidHome++;
  }
  for (const [plotId, count] of counts) {
    if (count > (capacities.get(plotId) ?? 0)) overCapacity++;
  }

  expect(invalidHome).toBe(0);
  expect(overCapacity).toBe(0);
});

it('assigns market and workshop workers from valid adult households', () => {
  const plan = syntheticPlan();
  const roster = generateTownRoster(plan, SEED_PATH, { nameFor });
  const ids = new Set<number>();
  const homeHouseIds = new Set(plan.plots.filter((plot) => plot.role === 'house').map((plot) => plot.id));
  const marketIds = new Set(plan.plots.filter((plot) => plot.role === 'market').map((plot) => plot.id));
  const workshopIds = new Set(plan.plots.filter((plot) => plot.role === 'workshop').map((plot) => plot.id));

  let duplicateIds = 0;
  let invalidHomes = 0;
  let invalidWorkers = 0;
  let marketShopkeepers = 0;
  let workshopArtisans = 0;
  for (const occupant of roster.occupants) {
    if (ids.has(occupant.id)) duplicateIds++;
    ids.add(occupant.id);
    if (!homeHouseIds.has(occupant.homePlotId)) invalidHomes++;
    if (occupant.workPlotId !== undefined && occupant.ageBand !== 'adult') invalidWorkers++;
    if (occupant.workPlotId !== undefined && !marketIds.has(occupant.workPlotId) && !workshopIds.has(occupant.workPlotId)) invalidWorkers++;
    if (occupant.occupation === 'shopkeeper' && marketIds.has(occupant.workPlotId ?? -1)) marketShopkeepers++;
    if (occupant.occupation === 'artisan' && workshopIds.has(occupant.workPlotId ?? -1)) workshopArtisans++;
  }

  expect(duplicateIds).toBe(0);
  expect(invalidHomes).toBe(0);
  expect(invalidWorkers).toBe(0);
  expect(marketShopkeepers).toBeGreaterThanOrEqual(marketIds.size);
  expect(workshopArtisans).toBeGreaterThanOrEqual(workshopIds.size);
});

it('keeps every household anchored by at least one adult', () => {
  const roster = generateTownRoster(syntheticPlan(), SEED_PATH, { nameFor });
  const adultCounts = new Map<number, number>();
  const allHomes = new Set<number>();
  for (const occupant of roster.occupants) {
    allHomes.add(occupant.homePlotId);
    if (occupant.ageBand === 'adult') {
      adultCounts.set(occupant.homePlotId, (adultCounts.get(occupant.homePlotId) ?? 0) + 1);
    }
  }

  let missingAdults = 0;
  for (const homePlotId of allHomes) {
    if ((adultCounts.get(homePlotId) ?? 0) < 1) missingAdults++;
  }

  expect(missingAdults).toBe(0);
});

it('matches the frozen roster golden for a tiny mixed-use town', () => {
  const roster = generateTownRoster(syntheticPlan(), SEED_PATH, { nameFor });

  expect(roster).toMatchSnapshot('synthetic-roster-golden');
});
