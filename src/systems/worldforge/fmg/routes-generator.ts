/**
 * @file routes-generator.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/modules/routes-generator.ts. See
 * ./ATTRIBUTION.md.
 *
 * Ported: generate() — burg sorting by feature, Urquhart-graph edge
 * selection (Delaunator), A* path segments (findPath with land/water cost
 * evaluators), route merging, sharp-angle point smoothing (getPoints, uses
 * findClosestCell against pack.cells.q) and buildLinks; plus the
 * read-only helpers later stages use (isConnected, areConnected, getRoute,
 * hasRoad, isCrossroad, getConnectivityRate).
 *
 * RNG: the whole generate() path is draw-free, verified against upstream —
 * the only RNG in the module (`generateName`'s rw/ra) belongs to the
 * route-naming UI and is stripped (see below). Determinism still depends on
 * iteration order (Object.entries over feature ids, FlatQueue pops) which is
 * preserved verbatim.
 *
 * Stripped: generateName (route label generator + its prefix/descriptor/
 * suffix/model data — only called by the routes overview/editor UI, never in
 * generate()), getPath (d3 curveCatmullRom SVG path builder), getLength
 * (reads rendered SVGPathElement), connect()/getNextId/remove (burg-editor
 * handlers; remove touches the viewbox SVG).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Delaunator from "delaunator";
import { distanceSquared } from "./utils/functionUtils";
import { findClosestCell } from "./utils/graphUtils";
import { findPath } from "./utils/pathUtils";
import { rn } from "./utils/numberUtils";
import {
  ROAD_BURG_MIN_POPULATION,
  PATH_SPUR_PERCENT,
  PATH_SPUR_MAX_DEPTH,
} from "../travel/roadTunables";
import type { Pack } from "./features";
import type { Grid } from "./utils/graphUtils";
import type { BiomesData } from "./biomes";
import type { Burg } from "./burgs-generator";
import type { Point } from "./voronoi";

const ROUTES_SHARP_ANGLE = 135;
const ROUTES_VERY_SHARP_ANGLE = 115;

const MIN_PASSABLE_SEA_TEMP = -4;
const ROUTE_TYPE_MODIFIERS: Record<string, number> = {
  "-1": 1, // coastline
  "-2": 1.8, // sea
  "-3": 4, // open sea
  "-4": 6, // ocean
  default: 8, // far ocean
};

export interface Route {
  i: number;
  // Tier vocabulary (road-systems Task 5): highways = capital trunk network,
  // roads = town↔town links, trails = village links, paths = forest spurs
  // (Task 7's generator; the group is in the union now so types settle once).
  group: "highways" | "roads" | "trails" | "paths" | "searoutes";
  feature: number;
  points: number[][];
  cells?: number[];
  merged?: boolean;
}

export interface RoutesContext {
  pack: Pack;
  grid: Grid;
  biomesData: BiomesData;
}

export class RoutesModule {
  constructor(private ctx: RoutesContext) {}

  buildLinks(routes: Route[]): Record<number, Record<number, number>> {
    const links: Record<number, Record<number, number>> = {};

    for (const { points, i: routeId } of routes) {
      const cells = points.map((p) => p[2]);

      for (let i = 0; i < cells.length - 1; i++) {
        const cellId = cells[i];
        const nextCellId = cells[i + 1];

        if (cellId !== nextCellId) {
          if (!links[cellId]) links[cellId] = {};
          links[cellId][nextCellId] = routeId;

          if (!links[nextCellId]) links[nextCellId] = {};
          links[nextCellId][cellId] = routeId;
        }
      }
    }

    return links;
  }

  private sortBurgsByFeature(burgs: Burg[]) {
    const burgsByFeature: Record<number, Burg[]> = {};
    const capitalsByFeature: Record<number, Burg[]> = {};
    const portsByFeature: Record<number, Burg[]> = {};

    const addBurg = (
      collection: Record<number, Burg[]>,
      feature: number,
      burg: Burg,
    ) => {
      if (!collection[feature]) collection[feature] = [];
      collection[feature].push(burg);
    };

    for (const burg of burgs) {
      if (burg.i && !burg.removed) {
        const { feature, capital, port } = burg;
        addBurg(burgsByFeature, feature as number, burg);
        if (capital) addBurg(capitalsByFeature, feature as number, burg);
        if (port) addBurg(portsByFeature, port as number, burg);
      }
    }

    return { burgsByFeature, capitalsByFeature, portsByFeature };
  }

  // Urquhart graph is obtained by removing the longest edge from each triangle in the Delaunay triangulation
  // this gives us an aproximation of a desired road network, i.e. connections between burgs
  // code from https://observablehq.com/@mbostock/urquhart-graph
  private calculateUrquhartEdges(points: Point[]) {
    const score = (p0: number, p1: number) =>
      distanceSquared(points[p0], points[p1]);

    const { halfedges, triangles } = Delaunator.from(points);
    const n = triangles.length;

    const removed = new Uint8Array(n);
    const edges = [];

    for (let e = 0; e < n; e += 3) {
      const p0 = triangles[e],
        p1 = triangles[e + 1],
        p2 = triangles[e + 2];

      const p01 = score(p0, p1),
        p12 = score(p1, p2),
        p20 = score(p2, p0);

      removed[
        p20 > p01 && p20 > p12
          ? Math.max(e + 2, halfedges[e + 2])
          : p12 > p01 && p12 > p20
            ? Math.max(e + 1, halfedges[e + 1])
            : Math.max(e, halfedges[e])
      ] = 1;
    }

    for (let e = 0; e < n; ++e) {
      if (e > halfedges[e] && !removed[e]) {
        const t0 = triangles[e];
        const t1 = triangles[e % 3 === 2 ? e - 2 : e + 1];
        edges.push([t0, t1]);
      }
    }

    return edges;
  }

  private createCostEvaluator({
    isWater,
    connections,
  }: {
    isWater: boolean;
    connections: Map<string, boolean>;
  }) {
    const { pack, grid, biomesData } = this.ctx;
    const cells = pack.cells as any;

    function getLandPathCost(current: number, next: number) {
      if (cells.h[next] < 20) return Infinity; // ignore water cells

      const habitability = biomesData.habitability[cells.biome[next]];
      if (!habitability) return Infinity; // inhabitable cells are not passable (e.g. glacier)

      const distanceCost = distanceSquared(cells.p[current], cells.p[next]);
      const habitabilityModifier = 1 + Math.max(100 - habitability, 0) / 1000; // [1, 1.1];
      const heightModifier = 1 + Math.max(cells.h[next] - 25, 25) / 25; // [1, 3];
      const connectionModifier = connections.has(`${current}-${next}`)
        ? 0.5
        : 1;
      const burgModifier = cells.burg[next] ? 1 : 3;

      const pathCost =
        distanceCost *
        habitabilityModifier *
        heightModifier *
        connectionModifier *
        burgModifier;
      return pathCost;
    }

    function getWaterPathCost(current: number, next: number) {
      if (cells.h[next] >= 20) return Infinity; // ignore land cells
      if (grid.cells.temp![cells.g[next]] < MIN_PASSABLE_SEA_TEMP)
        return Infinity; // ignore too cold cells

      const distanceCost = distanceSquared(cells.p[current], cells.p[next]);
      const typeModifier =
        ROUTE_TYPE_MODIFIERS[cells.t[next]] || ROUTE_TYPE_MODIFIERS.default;
      const connectionModifier = connections.has(`${current}-${next}`)
        ? 0.5
        : 1;

      const pathCost = distanceCost * typeModifier * connectionModifier;
      return pathCost;
    }
    return isWater ? getWaterPathCost : getLandPathCost;
  }

  private getRouteSegments(
    pathCells: number[],
    connections: Map<string, boolean>,
  ) {
    const segments = [];
    let segment = [];

    for (let i = 0; i < pathCells.length; i++) {
      const cellId = pathCells[i];
      const nextCellId = pathCells[i + 1];
      const isConnected =
        connections.has(`${cellId}-${nextCellId}`) ||
        connections.has(`${nextCellId}-${cellId}`);

      if (isConnected) {
        if (segment.length) {
          // segment stepped into existing segment
          segment.push(pathCells[i]);
          segments.push(segment);
          segment = [];
        }
        continue;
      }

      segment.push(pathCells[i]);
    }

    if (segment.length > 1) segments.push(segment);

    return segments;
  }

  private findPathSegments({
    isWater,
    connections,
    start,
    exit,
  }: {
    isWater: boolean;
    connections: Map<string, boolean>;
    start: number;
    exit: number;
  }) {
    const getCost = this.createCostEvaluator({ isWater, connections });
    const pathCells = findPath(
      start,
      (current) => current === exit,
      getCost,
      this.ctx.pack,
    );
    if (!pathCells) return [];
    const segments = this.getRouteSegments(pathCells, connections);
    return segments;
  }

  private generateMainRoads(connections: Map<string, boolean>) {
    const { capitalsByFeature } = this.sortBurgsByFeature(this.ctx.pack.burgs!);
    const mainRoads: Route[] = [];

    for (const [key, featureCapitals] of Object.entries(capitalsByFeature)) {
      const points = featureCapitals.map((burg) => [burg.x, burg.y] as Point);
      const urquhartEdges = this.calculateUrquhartEdges(points);
      urquhartEdges.forEach(([fromId, toId]) => {
        const start = featureCapitals[fromId].cell;
        const exit = featureCapitals[toId].cell;

        const segments = this.findPathSegments({
          isWater: false,
          connections,
          start,
          exit,
        });
        for (const segment of segments) {
          this.addConnections(segment, connections);
          mainRoads.push({ feature: Number(key), cells: segment } as Route);
        }
      });
    }

    return mainRoads;
  }

  private addConnections(
    segment: number[],
    connections: Map<string, boolean>,
  ) {
    for (let i = 0; i < segment.length; i++) {
      const cellId = segment[i];
      const nextCellId = segment[i + 1];
      if (nextCellId) {
        connections.set(`${cellId}-${nextCellId}`, true);
        connections.set(`${nextCellId}-${cellId}`, true);
      }
    }
  }

  private isTownBurg(burg: Burg): boolean {
    // Towns anchor roads; villages anchor trails. Capitals/ports always qualify.
    return Boolean(burg.capital) || Boolean(burg.port) ||
      ((burg.population as number | undefined) ?? 0) >= ROAD_BURG_MIN_POPULATION;
  }

  private generateTrails(connections: Map<string, boolean>) {
    const { burgsByFeature } = this.sortBurgsByFeature(this.ctx.pack.burgs!);
    const townRoads: Route[] = [];
    const villageTrails: Route[] = [];

    for (const [key, featureBurgs] of Object.entries(burgsByFeature)) {
      const points = featureBurgs.map((burg) => [burg.x, burg.y] as Point);
      const urquhartEdges = this.calculateUrquhartEdges(points);
      urquhartEdges.forEach(([fromId, toId]) => {
        const from = featureBurgs[fromId];
        const to = featureBurgs[toId];
        // Both endpoints are towns → a road; otherwise a village trail.
        const isRoad = this.isTownBurg(from) && this.isTownBurg(to);

        const segments = this.findPathSegments({
          isWater: false,
          connections,
          start: from.cell,
          exit: to.cell,
        });
        for (const segment of segments) {
          this.addConnections(segment, connections);
          (isRoad ? townRoads : villageTrails).push({
            feature: Number(key),
            cells: segment,
          } as Route);
        }
      });
    }

    return { townRoads, villageTrails };
  }

  /** Knuth-hash a burg id to a stable 0..99 bucket (deterministic spur pick). */
  private spurBucket(burgId: number): number {
    return Math.abs(Math.imul(burgId, 2654435761)) % 100;
  }

  /**
   * Village forest spurs: a share of villages get a short hunters'/woodcutters'
   * path from the village into the nearest forest, so faint paths lead INTO the
   * woods (and can fade there) instead of only linking settlements. Deterministic:
   * spur selection hashes the burg id; the target is the first forest cell found
   * by BFS, walked PATH_SPUR_MAX_DEPTH cells deeper along forest neighbors.
   */
  private generatePaths(connections: Map<string, boolean>) {
    const cells = this.ctx.pack.cells as any;
    const FOREST_IDS = new Set([5, 6, 7, 8, 9]);
    const isForest = (c: number): boolean => FOREST_IDS.has(cells.biome?.[c] ?? 0);
    const isLand = (c: number): boolean => (cells.h?.[c] ?? 0) >= 20;
    const paths: Route[] = [];

    for (const burg of this.ctx.pack.burgs!) {
      if (!burg.i || burg.removed || this.isTownBurg(burg)) continue; // villages only
      if (this.spurBucket(burg.i as number) >= PATH_SPUR_PERCENT) continue;

      // BFS from the village for the nearest forest cell (bounded search).
      const seen = new Set<number>([burg.cell as number]);
      const queue: number[] = [burg.cell as number];
      let entry = -1;
      let visited = 0;
      while (queue.length && visited < 400 && entry < 0) {
        const cur = queue.shift()!;
        visited++;
        for (const nb of cells.c?.[cur] ?? []) {
          if (seen.has(nb) || !isLand(nb)) continue;
          seen.add(nb);
          if (isForest(nb)) { entry = nb; break; }
          queue.push(nb);
        }
      }
      if (entry < 0) continue; // no forest near this village

      // Walk deeper: follow forest neighbors up to PATH_SPUR_MAX_DEPTH cells,
      // picking the lowest-id neighbor for determinism.
      let target = entry;
      for (let d = 0; d < PATH_SPUR_MAX_DEPTH; d++) {
        const deeper = (cells.c?.[target] ?? [])
          .filter((nb: number) => isForest(nb) && !seen.has(nb))
          .sort((a: number, b: number) => a - b)[0];
        if (deeper == null) break;
        seen.add(deeper);
        target = deeper;
      }

      const segments = this.findPathSegments({
        isWater: false, connections, start: burg.cell as number, exit: target,
      });
      for (const segment of segments) {
        this.addConnections(segment, connections);
        paths.push({ feature: burg.feature as number, cells: segment } as Route);
      }
    }

    return paths;
  }

  private generateSeaRoutes(connections: Map<string, boolean>) {
    const { portsByFeature } = this.sortBurgsByFeature(this.ctx.pack.burgs!);
    const seaRoutes: Route[] = [];

    for (const [featureId, featurePorts] of Object.entries(portsByFeature)) {
      const points = featurePorts.map((burg) => [burg.x, burg.y] as Point);
      const urquhartEdges = this.calculateUrquhartEdges(points);

      urquhartEdges.forEach(([fromId, toId]) => {
        const start = featurePorts[fromId].cell;
        const exit = featurePorts[toId].cell;
        const segments = this.findPathSegments({
          isWater: true,
          connections,
          start,
          exit,
        });
        for (const segment of segments) {
          this.addConnections(segment, connections);
          seaRoutes.push({
            feature: Number(featureId),
            cells: segment,
          } as Route);
        }
      });
    }

    return seaRoutes;
  }

  private preparePointsArray(): Point[] {
    const { cells, burgs } = this.ctx.pack as any;
    return cells.p.map(([x, y]: Point, cellId: number) => {
      const burgId = cells.burg[cellId];
      if (burgId) return [burgs[burgId].x, burgs[burgId].y];
      return [x, y];
    });
  }

  private getPoints(group: string, cells: number[], points: Point[]) {
    const pack = this.ctx.pack as any;
    const data = cells.map((cellId) => [...points[cellId], cellId]);

    // resolve sharp angles
    if (group !== "searoutes") {
      for (let i = 1; i < cells.length - 1; i++) {
        const cellId = cells[i];
        if (pack.cells.burg[cellId]) continue;

        const [prevX, prevY] = data[i - 1];
        const [currX, currY] = data[i];
        const [nextX, nextY] = data[i + 1];

        const dAx = prevX - currX;
        const dAy = prevY - currY;
        const dBx = nextX - currX;
        const dBy = nextY - currY;
        const angle = Math.abs(
          (Math.atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy) * 180) /
            Math.PI,
        );

        if (angle < ROUTES_SHARP_ANGLE) {
          const middleX = (prevX + nextX) / 2;
          const middleY = (prevY + nextY) / 2;
          let newX: number, newY: number;

          if (angle < ROUTES_VERY_SHARP_ANGLE) {
            newX = rn((currX + middleX * 2) / 3, 2);
            newY = rn((currY + middleY * 2) / 3, 2);
          } else {
            newX = rn((currX + middleX) / 2, 2);
            newY = rn((currY + middleY) / 2, 2);
          }

          if (findClosestCell(newX, newY, undefined, pack) === cellId) {
            data[i] = [newX, newY, cellId];
            points[cellId] = [data[i][0], data[i][1]]; // change cell coordinate for all routes
          }
        }
      }
    }

    return data; // [[x, y, cell], [x, y, cell]];
  }

  // merge routes so that the last cell of one route is the first cell of the next route
  private mergeRoutes(routes: Route[]): Route[] {
    let routesMerged = 0;

    for (let i = 0; i < routes.length; i++) {
      const thisRoute = routes[i];
      if (thisRoute.merged) continue;

      for (let j = i + 1; j < routes.length; j++) {
        const nextRoute = routes[j];
        if (nextRoute.merged) continue;

        if (nextRoute.cells!.at(0) === thisRoute.cells!.at(-1)) {
          routesMerged++;
          thisRoute.cells = thisRoute.cells!.concat(nextRoute.cells!.slice(1));
          nextRoute.merged = true;
        }
      }
    }

    return routesMerged > 1 ? this.mergeRoutes(routes) : routes;
  }

  private createRoutesData(routes: Route[], connections: Map<string, boolean>) {
    // Order matters: main roads claim their corridors (via addConnections)
    // BEFORE trails generate, so trails never re-path an existing trunk. The
    // tier split below changes only grouping/labeling, not this order.
    const mainRoads = this.generateMainRoads(connections);
    const { townRoads, villageTrails } = this.generateTrails(connections);
    const seaRoutes = this.generateSeaRoutes(connections);
    const pointsArray = this.preparePointsArray();

    // Merge + emit per group so tiers never blend into one another.
    const emit = (list: Route[], group: Route["group"]) => {
      for (const { feature, cells, merged } of this.mergeRoutes(list)) {
        if (merged) continue;
        const points = this.getPoints(group, cells!, pointsArray);
        routes.push({ i: routes.length, group, feature, points });
      }
    };
    emit(mainRoads, "highways");
    emit(townRoads, "roads");
    emit(villageTrails, "trails");
    // Forest spurs generate last among land groups (after trails claimed their
    // corridors, so spurs never steal them) and only ADD connections.
    const paths = this.generatePaths(connections);
    emit(paths, "paths");
    emit(seaRoutes, "searoutes");

    return routes;
  }

  generate(lockedRoutes: Route[] = []) {
    const pack = this.ctx.pack;
    const connections = new Map<string, boolean>();
    lockedRoutes.forEach((route: Route) => {
      this.addConnections(
        route.points.map((p) => p[2]),
        connections,
      );
    });

    pack.routes = this.createRoutesData(lockedRoutes, connections);
    // Forest-spur paths (road-systems Task 7) stay OUT of the cell-link
    // index: every later FMG stage reads these links (religions expansion,
    // Burgs.specify populations/features, markers, zones), so indexing the
    // new spurs would change burg populations and shift the RNG stream away
    // from the frozen golden world (same doctrine as hasRoad/isCrossroad
    // below). Gameplay consumers read pack.routes directly, so paths still
    // reach travel graphs, renderers and the region generator.
    (pack.cells as any).routes = this.buildLinks(
      pack.routes.filter((route) => route.group !== "paths"),
    );
  }

  // utility functions
  isConnected(cellId: number): boolean {
    const routes = (this.ctx.pack.cells as any).routes;
    return routes[cellId] && Object.keys(routes[cellId]).length > 0;
  }

  areConnected(from: number, to: number): boolean {
    const routeId = (this.ctx.pack.cells as any).routes[from]?.[to];
    return routeId !== undefined;
  }

  getRoute(from: number, to: number): Route | null {
    const routeId = (this.ctx.pack.cells as any).routes[from]?.[to];
    if (routeId === undefined) return null;

    const route = this.ctx.pack.routes!.find((route) => route.i === routeId);
    if (!route) return null;

    return route;
  }

  hasRoad(cellId: number): boolean {
    const connections = (this.ctx.pack.cells as any).routes[cellId];
    if (!connections) return false;

    return Object.values(connections).some((routeId) => {
      const route = this.ctx.pack.routes!.find(
        (route) => route.i === routeId,
      );
      if (!route) return false;
      // Behavior-preserving: the pre-split "roads" trunk network is now
      // labeled "highways" (identical corridors). Matching "highways" keeps
      // this FMG-internal generation heuristic byte-identical to the frozen
      // golden world; the town-link "roads" tier (formerly part of "trails")
      // is deliberately excluded so specify()'s RNG stream does not shift.
      return route.group === "highways";
    });
  }

  isCrossroad(cellId: number): boolean {
    const connections = (this.ctx.pack.cells as any).routes[cellId];
    if (!connections) return false;
    if (Object.keys(connections).length > 3) return true;
    const roadConnections = Object.values(connections).filter((routeId) => {
      const route = this.ctx.pack.routes!.find(
        (route) => route.i === routeId,
      );
      // Trunk junctions: the former "roads" network is now "highways" (see
      // hasRoad). Preserved verbatim to keep the golden world frozen.
      return route?.group === "highways";
    });
    return roadConnections.length > 2;
  }

  getConnectivityRate(cellId: number): number {
    const connections = (this.ctx.pack.cells as any).routes[cellId];
    if (!connections) return 0;

    // Behavior-preserving rates: the pre-split world had only "roads" (0.2)
    // and "trails" (0.1). "roads" became "highways" (keep 0.2); the old
    // "trails" split into town "roads" + village "trails" (both keep 0.1) so
    // definePopulation() computes byte-identical populations against the
    // frozen golden. "paths" (Task 7) mirrors the faintest trail tier.
    // Re-tuning these to reflect the new tier hierarchy is a deliberate
    // world-break requiring owner approval (see fmgWorld.test.ts header).
    const connectivityRateMap: Record<string, number> = {
      highways: 0.2,
      roads: 0.1,
      trails: 0.1,
      paths: 0.1,
      searoutes: 0.2,
      default: 0.1,
    };

    const connectivity = (Object.values(connections) as number[]).reduce(
      (acc: number, routeId: number) => {
        const route = this.ctx.pack.routes!.find(
          (route) => route.i === routeId,
        );
        if (!route) return acc;
        const rate =
          connectivityRateMap[route.group] || connectivityRateMap.default;
        return acc + rate;
      },
      0.8,
    );

    return connectivity;
  }
}
