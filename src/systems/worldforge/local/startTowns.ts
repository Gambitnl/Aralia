/**
 * @file startTowns.ts — selectable starting towns for the Start Point Selection step.
 *
 * After character creation the player chooses where to begin, and the design
 * constraint is that they may only start *inside a town* (never open wilderness
 * or ocean). This enumerates the WF/FMG world's real burgs as pickable start
 * points, grouped by their country/region (state), with the display + spawn data
 * the selection UI needs: graph coords for the atlas pin, the atlas cell to spawn
 * at, and a population estimate for sizing/sorting.
 *
 * Pure: no React/DOM. Deterministic from the world.
 */
import type { FmgWorldResult } from '../fmg/generateWorld';

/** People-per-population-point (FMG default) — burg.population is in points. */
const DEFAULT_POPULATION_RATE = 1000;
const DEFAULT_URBANIZATION = 1;

export interface SelectableTown {
  /** Index into `pack.burgs`. */
  burgIndex: number;
  /** WF atlas cell the burg sits on (`burg.cell`) — the spawn cell. */
  atlasCellId: number;
  /** Town name. */
  name: string;
  /** Graph-space coords (for placing a pin on the atlas). */
  x: number;
  y: number;
  /** Capital of its state. */
  isCapital: boolean;
  /** Coastal/harbour town. */
  isPort: boolean;
  /** Estimated inhabitants (population points × rate × urbanization). */
  population: number;
  /** Owning state index (`0` = neutral / no state). */
  stateIndex: number;
  /** Owning state's name (`'Neutral'` for state 0 / unnamed). */
  stateName: string;
}

export interface TownRegion {
  stateIndex: number;
  stateName: string;
  /** Towns in this region, capitals first then by descending population. */
  towns: SelectableTown[];
}

interface BurgLike {
  i?: number; cell?: number; capital?: number; removed?: boolean;
  name?: string; x?: number; y?: number; port?: number; population?: number; state?: number;
}
interface StateLike { i?: number; name?: string; fullName?: string; removed?: boolean }

/**
 * Estimated inhabitants from a burg's population points. The generation inputs
 * (populationRate/urbanization) aren't carried on the result, so we use FMG's
 * defaults — this is a display estimate for sizing/sorting, not a canon figure.
 */
function estimateInhabitants(points: number | undefined): number {
  return Math.max(0, Math.round((points ?? 0) * DEFAULT_POPULATION_RATE * DEFAULT_URBANIZATION));
}

/**
 * All real, pickable starting towns in the world: every non-placeholder,
 * non-removed burg anchored to a land cell. Sorted capitals-first, then by
 * descending population, so the most prominent settlements lead the list.
 */
export function listSelectableTowns(world: FmgWorldResult): SelectableTown[] {
  const burgs = (world.pack.burgs ?? []) as BurgLike[];
  const states = (world.pack.states ?? []) as StateLike[];
  const stateName = (idx: number | undefined): string => {
    if (!idx) return 'Neutral';
    const s = states[idx];
    return (s && !s.removed && (s.fullName || s.name)) || 'Neutral';
  };

  const towns: SelectableTown[] = [];
  for (let i = 0; i < burgs.length; i++) {
    const b = burgs[i];
    if (!b || b.i === 0 || b.removed) continue;
    if (typeof b.cell !== 'number') continue;
    towns.push({
      burgIndex: typeof b.i === 'number' ? b.i : i,
      atlasCellId: b.cell,
      name: b.name || `Town ${i}`,
      x: b.x ?? 0,
      y: b.y ?? 0,
      isCapital: !!b.capital,
      isPort: !!b.port,
      population: estimateInhabitants(b.population),
      stateIndex: b.state ?? 0,
      stateName: stateName(b.state),
    });
  }

  towns.sort((a, b) =>
    (Number(b.isCapital) - Number(a.isCapital)) || (b.population - a.population),
  );
  return towns;
}

/**
 * The selectable towns grouped by their country/region (state), so the player
 * can first narrow to a continent/country and then pick a town within it.
 * Regions are sorted by total population (most-settled first); neutral last.
 */
export function groupTownsByState(towns: SelectableTown[]): TownRegion[] {
  const byState = new Map<number, TownRegion>();
  for (const town of towns) {
    let region = byState.get(town.stateIndex);
    if (!region) {
      region = { stateIndex: town.stateIndex, stateName: town.stateName, towns: [] };
      byState.set(town.stateIndex, region);
    }
    region.towns.push(town);
  }

  const regions = [...byState.values()];
  const pop = (r: TownRegion): number => r.towns.reduce((sum, t) => sum + t.population, 0);
  regions.sort((a, b) => {
    // Neutral (state 0) always sorts last; otherwise most-populous first.
    if ((a.stateIndex === 0) !== (b.stateIndex === 0)) return a.stateIndex === 0 ? 1 : -1;
    return pop(b) - pop(a);
  });
  return regions;
}
