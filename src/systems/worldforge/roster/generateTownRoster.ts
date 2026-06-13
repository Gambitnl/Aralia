import type { TownPlan } from '../artifacts';
import { generateInterior } from '../interior/generateInterior';
import {
  childSeedPath,
  rngFromPath,
  streamPath,
  type SeedPath,
} from '../seedPath';
import type { AgeBand, Occupant, Occupation, TownPlot, TownRoster } from './types';

/**
 * This file turns a generated Worldforge town plan into the people who live
 * and work there.
 *
 * The town generator owns streets and building plots. The interior generator
 * owns bedroom counts for each house. This roster pass sits between them:
 * every house receives a household sized to its bedrooms, and adult residents
 * are assigned to nearby market or workshop jobs. Names are injected so the
 * later FMG culture-name bridge can plug in without changing roster logic.
 *
 * Called by: future Worldforge ground/interior agent placement.
 * Depends on: TownPlan, generateInterior, and seedPath deterministic streams.
 */

// ============================================================================
// Public Options
// ============================================================================
// The roster is deterministic, but culture-specific name generation is not part
// of this slice. Tests and future bridges provide a seeded callback here.
// ============================================================================

export interface GenerateTownRosterOptions {
  nameFor: (rng: { next(): number }) => string;
}

// ============================================================================
// Internal Records
// ============================================================================
// This section tracks the mutable bookkeeping needed while building the pure
// output. The bookkeeping never leaves this file.
// ============================================================================

interface HousePlan {
  plot: TownPlot;
  capacity: number;
  centroid: [number, number];
}

interface WorkerNeed {
  plot: TownPlot;
  occupation: Extract<Occupation, 'shopkeeper' | 'artisan'>;
  centroid: [number, number];
}

// ============================================================================
// Main Generator
// ============================================================================
// This section creates households first, then layers work assignments over the
// adult population. Stable ids come from insertion order: houses are sorted by
// plot id, occupants are created in household order, and emergency worker
// occupants are appended only when no existing adult is free.
// ============================================================================

export function generateTownRoster(
  plan: TownPlan,
  seedPath: SeedPath,
  opts: GenerateTownRosterOptions,
): TownRoster {
  const rosterPath = childSeedPath(seedPath, `roster:${plan.burgId}`);
  const houses = plan.plots
    .filter((plot) => plot.role === 'house')
    .map((plot) => ({
      plot,
      capacity: capacityForHouse(plot, seedPath),
      centroid: centroidOf(plot),
    }))
    .sort((a, b) => a.plot.id - b.plot.id);
  const occupants: Occupant[] = [];
  const householdCounts = new Map<number, number>();
  let nextId = 1;

  for (const house of houses) {
    const householdRng = rngFromPath(streamPath(rosterPath, `household:${house.plot.id}`));
    const householdSize = chooseHouseholdSize(house.capacity, householdRng);
    const ageBands = chooseAgeBands(householdSize, householdRng);

    for (const ageBand of ageBands) {
      occupants.push(
        createOccupant(nextId, ageBand, house.plot.id, 'resident', undefined, rosterPath, opts),
      );
      nextId++;
    }

    householdCounts.set(house.plot.id, householdSize);
  }

  const workerNeeds = plan.plots
    .filter((plot) => plot.role === 'market' || plot.role === 'workshop')
    .map<WorkerNeed>((plot) => ({
      plot,
      occupation: plot.role === 'market' ? 'shopkeeper' : 'artisan',
      centroid: centroidOf(plot),
    }))
    .sort((a, b) => a.plot.id - b.plot.id);

  for (const need of workerNeeds) {
    const worker =
      findNearestAvailableAdult(occupants, need, houses) ??
      createOverflowWorker(need, houses, householdCounts, nextId, rosterPath, opts);

    if (!worker) continue;

    if (worker.id === nextId) {
      occupants.push(worker);
      householdCounts.set(worker.homePlotId, (householdCounts.get(worker.homePlotId) ?? 0) + 1);
      nextId++;
    }

    worker.workPlotId = need.plot.id;
    worker.occupation = need.occupation;
  }

  return {
    burgId: plan.burgId,
    occupants,
  };
}

// ============================================================================
// Household Sizing
// ============================================================================
// This section makes each house population agree with the room-packing pass.
// The bedroom cap is strict because interiors and visible occupants must not
// disagree when agents are later placed into rooms.
// ============================================================================

function capacityForHouse(plot: TownPlot, seedPath: SeedPath): number {
  const bedroomCount = generateInterior(plot, seedPath).rooms.filter(
    (room) => room.role === 'bedroom',
  ).length;
  return Math.max(1, 2 * bedroomCount + 1);
}

function chooseHouseholdSize(capacity: number, rng: { next(): number }): number {
  const weightedSizes = [1, 2, 2, 3, 3, 3, 4, 4, 5, 6];
  const picked = weightedSizes[Math.floor(rng.next() * weightedSizes.length)] ?? 3;
  return Math.max(1, Math.min(capacity, picked));
}

function chooseAgeBands(size: number, rng: { next(): number }): AgeBand[] {
  const ages: AgeBand[] = ['adult'];

  while (ages.length < size) {
    const roll = rng.next();
    if (roll < 0.55) {
      ages.push('adult');
    } else if (roll < 0.82) {
      ages.push('child');
    } else {
      ages.push('elder');
    }
  }

  return ages;
}

// ============================================================================
// Worker Assignment
// ============================================================================
// This section assigns one adult worker per market or workshop. Existing adults
// are preferred and sorted by walking-distance proxy: home centroid to work
// plot centroid. If every adult is already busy, a new adult worker is placed
// into the nearest house that still has bedroom capacity.
// ============================================================================

function findNearestAvailableAdult(
  occupants: Occupant[],
  need: WorkerNeed,
  houses: HousePlan[],
): Occupant | undefined {
  const houseById = new Map(houses.map((house) => [house.plot.id, house]));

  return occupants
    .filter((occupant) => occupant.ageBand === 'adult' && occupant.workPlotId === undefined)
    .map((occupant) => ({
      occupant,
      distance: distance(houseById.get(occupant.homePlotId)?.centroid, need.centroid),
    }))
    .sort((a, b) => a.distance - b.distance || a.occupant.id - b.occupant.id)[0]?.occupant;
}

function createOverflowWorker(
  need: WorkerNeed,
  houses: HousePlan[],
  householdCounts: Map<number, number>,
  id: number,
  rosterPath: SeedPath,
  opts: GenerateTownRosterOptions,
): Occupant | undefined {
  const house = houses
    .filter((candidate) => (householdCounts.get(candidate.plot.id) ?? 0) < candidate.capacity)
    .map((candidate) => ({
      house: candidate,
      distance: distance(candidate.centroid, need.centroid),
    }))
    .sort((a, b) => a.distance - b.distance || a.house.plot.id - b.house.plot.id)[0]?.house;

  if (!house) return undefined;

  return createOccupant(id, 'adult', house.plot.id, need.occupation, need.plot.id, rosterPath, opts);
}

// ============================================================================
// Occupant Creation
// ============================================================================
// This section centralizes names and stable ids. Each occupant gets an isolated
// name stream so future age or worker-assignment draws do not rename people.
// ============================================================================

function createOccupant(
  id: number,
  ageBand: AgeBand,
  homePlotId: number,
  occupation: Occupation,
  workPlotId: number | undefined,
  rosterPath: SeedPath,
  opts: GenerateTownRosterOptions,
): Occupant {
  const nameRng = rngFromPath(streamPath(rosterPath, `name:${id}`));
  const occupant: Occupant = {
    id,
    name: opts.nameFor(nameRng),
    ageBand,
    homePlotId,
    occupation,
  };

  if (workPlotId !== undefined) {
    occupant.workPlotId = workPlotId;
  }

  return occupant;
}

// ============================================================================
// Geometry Helpers
// ============================================================================
// This section keeps the distance preference independent from any renderer. A
// simple footprint centroid is enough for assigning nearby shopkeepers because
// towns already place plots beside their streets.
// ============================================================================

function centroidOf(plot: TownPlot): [number, number] {
  const total = plot.footprint.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]] as [number, number],
    [0, 0] as [number, number],
  );
  return [total[0] / plot.footprint.length, total[1] / plot.footprint.length];
}

function distance(a: [number, number] | undefined, b: [number, number]): number {
  if (!a) return Number.POSITIVE_INFINITY;
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
