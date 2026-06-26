// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 19:15:38
 * Dependents: systems/worldforge/fmg/generateWorld.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Burg } from './burgs-generator';
import type { Route } from './routes-generator';

/**
 * This file guarantees that important islands can be reached by maritime travel.
 *
 * The FMG world generator can create islands with no port, which means the
 * multimodal travel graph has nowhere legal to board or leave a ferry. This
 * post-generation pass finds each landmass, promotes or spawns one small port on
 * significant portless landmasses, and updates sea-route links so the travel UI
 * can discover the new harbor without hand-authored map data.
 *
 * Called by: generateWorld.ts after the normal FMG route generation stage.
 * Depends on: the packed FMG cells, burg list, and route list that earlier FMG
 * stages already produced.
 */

// ============================================================================
// Public Types
// ============================================================================
// These shapes intentionally describe only the FMG fields the harbor pass needs.
// Keeping the surface narrow lets tests use small fixtures while the real pack
// can still pass through unchanged.
// ============================================================================

export interface IslandHarborCells {
  i: ArrayLike<number>;
  c: number[][];
  h: ArrayLike<number>;
  p: ArrayLike<[number, number]>;
  haven?: ArrayLike<number>;
  harbor?: ArrayLike<number>;
  f?: ArrayLike<number>;
  burg?: Uint16Array;
  culture?: ArrayLike<number>;
  state?: ArrayLike<number>;
  pop?: ArrayLike<number>;
  routes?: Record<number, Record<number, number>>;
}

export interface IslandHarborFeature {
  i: number;
  type: string;
  land: boolean;
  cells: number;
}

export interface IslandHarborPack {
  cells: IslandHarborCells;
  features: Array<IslandHarborFeature | 0>;
  burgs?: Array<Burg | 0>;
  routes?: Route[];
}

export interface EnsureIslandHarborsOptions {
  /**
   * Minimum connected land cells before a landmass is considered worth docking.
   * Components with a burg are always significant even when they are smaller.
   */
  minLandCells?: number;
}

export interface EnsureIslandHarborsReport {
  promotedBurgIds: number[];
  spawnedBurgIds: number[];
  skippedComponentCells: number[][];
}

interface LandComponent {
  cells: number[];
  burgs: Burg[];
}

const LAND_HEIGHT = 20;
const DEFAULT_MIN_LAND_CELLS = 8;

// ============================================================================
// Cell And Component Helpers
// ============================================================================
// This section turns the packed FMG graph into land components. Water cells are
// boundaries, so each component represents one island or mainland landmass.
// ============================================================================

function isLand(pack: IslandHarborPack, cell: number): boolean {
  return (pack.cells.h[cell] ?? 0) >= LAND_HEIGHT;
}

function liveBurgs(pack: IslandHarborPack): Burg[] {
  return (pack.burgs ?? []).filter(
    (burg): burg is Burg => Boolean(burg && typeof burg !== 'number' && burg.i && !burg.removed),
  );
}

function collectLandComponents(pack: IslandHarborPack): LandComponent[] {
  const seen = new Set<number>();
  const components: LandComponent[] = [];
  const burgs = liveBurgs(pack);

  for (const cell of Array.from(pack.cells.i)) {
    if (seen.has(cell) || !isLand(pack, cell)) continue;

    const cells: number[] = [];
    const queue = [cell];
    seen.add(cell);

    while (queue.length) {
      const current = queue.shift() as number;
      cells.push(current);

      for (const next of pack.cells.c[current] ?? []) {
        if (seen.has(next) || !isLand(pack, next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }

    const cellSet = new Set(cells);
    components.push({
      cells,
      burgs: burgs.filter((burg) => cellSet.has(burg.cell)),
    });
  }

  return components;
}

// ============================================================================
// Harbor Selection
// ============================================================================
// This section picks the most conservative harbor candidate: an existing coastal
// burg if one exists, otherwise the best coastal cell on the landmass.
// ============================================================================

function waterFeatureFor(pack: IslandHarborPack, cell: number): number {
  const haven = pack.cells.haven?.[cell] ?? 0;
  return haven > 0 ? (pack.cells.f?.[haven] ?? 0) : 0;
}

function hasUsableHarbor(pack: IslandHarborPack, cell: number): boolean {
  return Boolean((pack.cells.harbor?.[cell] ?? 0) > 0 && waterFeatureFor(pack, cell));
}

function compareHarborCells(pack: IslandHarborPack, a: number, b: number): number {
  const harborA = pack.cells.harbor?.[a] ?? Number.MAX_SAFE_INTEGER;
  const harborB = pack.cells.harbor?.[b] ?? Number.MAX_SAFE_INTEGER;
  if (harborA !== harborB) return harborA - harborB;

  const popA = pack.cells.pop?.[a] ?? 0;
  const popB = pack.cells.pop?.[b] ?? 0;
  if (popA !== popB) return popB - popA;

  return a - b;
}

function findBestCoastalBurg(pack: IslandHarborPack, component: LandComponent): Burg | null {
  const candidates = component.burgs
    .filter((burg) => !burg.port && hasUsableHarbor(pack, burg.cell))
    .sort((a, b) => compareHarborCells(pack, a.cell, b.cell));

  return candidates[0] ?? null;
}

function findBestHarborCell(pack: IslandHarborPack, component: LandComponent): number | null {
  const candidates = component.cells
    .filter((cell) => !pack.cells.burg?.[cell] && hasUsableHarbor(pack, cell))
    .sort((a, b) => compareHarborCells(pack, a, b));

  return candidates[0] ?? null;
}

// ============================================================================
// Port And Route Writes
// ============================================================================
// This section is the only mutating part of the pass. It preserves existing
// burgs/routes, then appends the smallest extra data needed for the new dock.
// ============================================================================

function ensureBurgArray(pack: IslandHarborPack): Array<Burg | 0> {
  if (!pack.burgs) pack.burgs = [0];
  if (!pack.burgs[0]) pack.burgs[0] = 0;
  return pack.burgs;
}

function promoteBurgToPort(pack: IslandHarborPack, burg: Burg): Burg {
  burg.port = waterFeatureFor(pack, burg.cell);
  burg.feature = pack.cells.f?.[burg.cell] ?? burg.feature;
  burg.type = 'Naval';
  return burg;
}

function spawnPortBurg(pack: IslandHarborPack, cell: number): Burg {
  const burgs = ensureBurgArray(pack);
  const id = burgs.length;
  const point = pack.cells.p[cell] ?? [0, 0];

  const burg: Burg = {
    i: id,
    cell,
    x: point[0],
    y: point[1],
    state: pack.cells.state?.[cell] ?? 0,
    culture: pack.cells.culture?.[cell] ?? 0,
    name: `Fishing Village ${id}`,
    feature: pack.cells.f?.[cell] ?? 0,
    capital: 0,
    port: waterFeatureFor(pack, cell),
    population: 0.05,
    type: 'Naval',
    group: 'village',
  };

  burgs.push(burg);
  if (pack.cells.burg) pack.cells.burg[cell] = id;
  return burg;
}

function routeCells(route: Route): number[] {
  if (route.cells?.length) return route.cells;
  return route.points.map((point) => point[2]).filter((cell) => Number.isFinite(cell));
}

function addRouteLink(
  links: Record<number, Record<number, number>>,
  from: number,
  to: number,
  routeId: number,
): void {
  if (!links[from]) links[from] = {};
  links[from][to] = routeId;
}

function rebuildRouteLinks(pack: IslandHarborPack): void {
  const links: Record<number, Record<number, number>> = {};

  for (const route of pack.routes ?? []) {
    const cells = routeCells(route);
    for (let i = 0; i < cells.length - 1; i++) {
      const from = cells[i];
      const to = cells[i + 1];
      if (from === to) continue;
      addRouteLink(links, from, to, route.i);
      addRouteLink(links, to, from, route.i);
    }
  }

  pack.cells.routes = links;
}

function existingSeaRouteCells(pack: IslandHarborPack, waterFeature: number): number[] {
  return (pack.routes ?? [])
    .filter((route) => route.group === 'searoutes' && route.feature === waterFeature)
    .flatMap(routeCells);
}

function ensureSeaRoute(pack: IslandHarborPack, port: Burg): void {
  const waterCell = pack.cells.haven?.[port.cell] ?? 0;
  if (!waterCell) return;

  const waterFeature = waterFeatureFor(pack, port.cell);
  if (!waterFeature) return;

  if (!pack.routes) pack.routes = [];
  const existingCells = existingSeaRouteCells(pack, waterFeature).filter((cell) => cell !== waterCell);
  if (!existingCells.length) {
    rebuildRouteLinks(pack);
    return;
  }

  const point = (cell: number): number[] => {
    const [x, y] = pack.cells.p[cell] ?? [0, 0];
    return [x, y, cell];
  };

  const target = existingCells.sort((a, b) => compareHarborCells(pack, a, b))[0];
  const routeId = pack.routes.length;
  pack.routes.push({
    i: routeId,
    group: 'searoutes',
    feature: waterFeature,
    points: [point(waterCell), point(target)],
    cells: [waterCell, target],
  });

  rebuildRouteLinks(pack);
}

// ============================================================================
// Public Pass
// ============================================================================
// This is the one function generation calls. It reports exactly what changed so
// tests, dashboards, and future Atlas tooling can explain the automatic edits.
// ============================================================================

export function ensureIslandHarbors(
  pack: IslandHarborPack,
  options: EnsureIslandHarborsOptions = {},
): EnsureIslandHarborsReport {
  const minLandCells = options.minLandCells ?? DEFAULT_MIN_LAND_CELLS;
  const report: EnsureIslandHarborsReport = {
    promotedBurgIds: [],
    spawnedBurgIds: [],
    skippedComponentCells: [],
  };

  for (const component of collectLandComponents(pack)) {
    const hasPort = component.burgs.some((burg) => Boolean(burg.port));
    if (hasPort) continue;

    const significant = component.cells.length >= minLandCells || component.burgs.length > 0;
    if (!significant) {
      report.skippedComponentCells.push([...component.cells].sort((a, b) => a - b));
      continue;
    }

    const existingBurg = findBestCoastalBurg(pack, component);
    if (existingBurg) {
      const port = promoteBurgToPort(pack, existingBurg);
      report.promotedBurgIds.push(port.i as number);
      ensureSeaRoute(pack, port);
      continue;
    }

    const harborCell = findBestHarborCell(pack, component);
    if (harborCell == null) {
      report.skippedComponentCells.push([...component.cells].sort((a, b) => a - b));
      continue;
    }

    const port = spawnPortBurg(pack, harborCell);
    report.spawnedBurgIds.push(port.i as number);
    ensureSeaRoute(pack, port);
  }

  return report;
}
