/**
 * @file townSnapshot.ts
 * @description Bridges the occupant schedule (WHEN/what) to town space (WHERE):
 * given a town plan, its roster, and an hour, returns every occupant's activity
 * AND concrete position. Point-in-time snapshots use plot centroids, while
 * motion snapshots use the street graph's canonical doors whenever available
 * so starting a route, finishing it, and waiting at a building share one point.
 *
 * Still pure data — `hour` is a parameter, not a live clock — so a renderer,
 * debug overlay, or future needs/economy sim can ask "who is where, doing what,
 * at hour H?" and get one deterministic answer. This is the layer a 3D agent
 * placement pass consumes; it owns no rendering and no time source.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 03/11/2026, 05:10:22
 * Dependents: components/World3D/InteriorOccupants.tsx, components/World3D/residentDoorUse.ts, components/Worldforge/TownAgentSnapshotView.tsx, systems/worldforge/bridge/groundAgentMotion.ts, systems/worldforge/bridge/residentDoorRoutes.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TownPlan } from '../artifacts';
import type { Occupant, TownRoster, TownPlot } from './types';
import { occupantLocationAt, occupantWorkPlotId, type ActivityKind, type ScheduleBlock } from './occupantSchedule';
import { ERRAND_ROLES, errandPlotFor } from './errands';
import {
  frontDoorForPlot,
  routeAlongStreets,
  positionAlongPath,
  pathLength,
  type StreetGraph,
  type Point,
} from './agentPath';

export interface AgentSnapshot {
  occupantId: number;
  name: string;
  activity: ActivityKind;
  /** The plot they are at this hour (home or work). */
  plotId: number;
  /** World position: the centroid of that plot's footprint (town/graph coords). */
  x: number;
  y: number;
}

function centroidOf(plot: TownPlot): [number, number] {
  const sum = plot.footprint.reduce<[number, number]>(
    (acc, p) => [acc[0] + p[0], acc[1] + p[1]],
    [0, 0],
  );
  const n = plot.footprint.length || 1;
  return [sum[0] / n, sum[1] / n];
}

/**
 * Every occupant's activity + position at `hour` (0–23). Occupants whose
 * scheduled plot is missing from the plan are skipped (defensive; a roster
 * always references plan plots). Deterministic and pure.
 */
export function townSnapshotAt(
  plan: TownPlan,
  roster: TownRoster,
  hour: number,
): AgentSnapshot[] {
  const centroids = new Map<number, [number, number]>();
  for (const plot of plan.plots) centroids.set(plot.id, centroidOf(plot));

  const out: AgentSnapshot[] = [];
  for (const occ of roster.occupants as Occupant[]) {
    const block = occupantLocationAt(occ, hour);
    const c = centroids.get(block.plotId);
    if (!c) continue;
    out.push({
      occupantId: occ.id,
      name: occ.name,
      activity: block.activity,
      plotId: block.plotId,
      x: c[0],
      y: c[1],
    });
  }
  return out;
}

/** Count of occupants by activity at `hour` — a cheap town-rhythm read. */
export function activityTallyAt(
  plan: TownPlan,
  roster: TownRoster,
  hour: number,
): Record<ActivityKind, number> {
  const tally: Record<ActivityKind, number> = { sleeping: 0, home: 0, working: 0, out: 0 };
  for (const a of townSnapshotAt(plan, roster, hour)) tally[a.activity]++;
  return tally;
}

/** An agent placed with continuous (possibly in-transit) motion. */
export interface MovingAgentSnapshot extends AgentSnapshot {
  /** True while the agent is walking a street route between two plots. */
  moving: boolean;
  /**
   * True when the person is outside a building: walking, at an errand place
   * in front of its door, or OUT with no errand place (at their own door).
   * False when they are inside (home, asleep, at work) or still inside before
   * a delayed departure. The 3D street crowd draws only outdoor people.
   */
  outdoors: boolean;
  /** For a person at an errand place: the point the group there faces. */
  faceX?: number;
  faceY?: number;
}

/** Legacy preview-only commute window. Named household people instead use
 * measured route length at the shared walking speed. The same duration feeds
 * the street position and the room body's arrival gate. */
const COMMUTE_FRAC = 0.5;
export const TOWN_WALK_METERS_PER_SECOND = 1.2;
/** Household people leave up to this many minutes after the hour (NPC life,
 * 2026-11-02). Before, every leg started at :00, so the streets had one rush of
 * 20 to 60 s per hour and stood empty for the rest of it. */
const DEPARTURE_SPREAD_MIN = 40;

/** Small stable hash of (id, salt) for per-person timing. No RNG. */
function stableHash(id: number, salt: number): number {
  let h = 2166136261 ^ id ^ Math.imul(salt + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Where the MOTION layer puts a person at `hour`. It is the schedule block,
 * except that an OUT block goes to the person's errand place when `graph`
 * knows one (roster/errands.ts). The schedule itself still reports home for
 * OUT, so interior and business consumers are unchanged.
 */
export function occupantStopAt(occupant: Occupant, hour: number, graph?: StreetGraph): ScheduleBlock {
  const block = occupantLocationAt(occupant, hour);
  if (block.activity !== 'out' || !graph) return block;
  const errand = errandPlotFor(graph, occupant);
  return errand === undefined ? block : { ...block, plotId: errand };
}

/**
 * Hours a person waits after the start of `legHour` before a leg begins. The
 * leg that ends in the block starting at `legHour` departs this late. Legacy
 * preview people (no household id) keep their on-the-hour departures.
 */
export function legDepartureDelayHours(occupant: Occupant, legHour: number): number {
  if (!occupant.householdMemberId) return 0;
  const hour = ((Math.floor(legHour) % 24) + 24) % 24;
  return (stableHash(occupant.id, hour) % DEPARTURE_SPREAD_MIN) / 60;
}

// The street crowd asks for every person's stop several times a second, and
// recentCommute looks back up to 24 hours each time. The schedule repeats every
// 24 hours and depends only on the occupant record (and the graph's errand
// places), so one 24-entry table per person serves all of those reads. A
// WeakMap keeps it with the occupant, one table per graph (door use asks
// without a graph, the motion layer with one).
const stopTables = new WeakMap<Occupant, Map<StreetGraph | null, ScheduleBlock[]>>();

function stopTable(occupant: Occupant, graph: StreetGraph | undefined): ScheduleBlock[] {
  let byGraph = stopTables.get(occupant);
  if (!byGraph) { byGraph = new Map(); stopTables.set(occupant, byGraph); }
  const cached = byGraph.get(graph ?? null);
  if (cached) return cached;
  const stops: ScheduleBlock[] = [];
  for (let h = 0; h < 24; h++) stops.push(occupantStopAt(occupant, h, graph));
  byGraph.set(graph ?? null, stops);
  return stops;
}

const wrap24 = (hour: number) => ((Math.floor(hour) % 24) + 24) % 24;

/** Latest change to the current destination, including travel across hours.
 * With `graph`, OUT blocks count as legs to the errand place (occupantStopAt). */
export function recentCommute(occupant: Occupant, hour: number, graph?: StreetGraph) {
  const stops = stopTable(occupant, graph);
  const current = stops[wrap24(hour)];
  for (let elapsed = 0; elapsed < 24; elapsed++) {
    const previous = stops[wrap24(hour - elapsed - 1)];
    if (previous.plotId !== current.plotId) return { from: previous.plotId, to: current.plotId, elapsed };
  }
  return undefined;
}

function routeHours(graph: StreetGraph, occupant: Occupant, fromId: number, toId: number, measuredForAll = false): number {
  return legInfo(graph, occupant, fromId, toId, measuredForAll).hours;
}

// Per-person motion facts that never change for one graph: the errand spot in
// front of each plot, and each leg's walked route and duration. The 3D crowd
// reads them for every person several times a second (2,109 people cost about
// 17 ms a pass before this cache, 2026-11-02).
interface PersonMotionCache {
  spots: Map<number, ErrandSpot | null>;
  legs: Map<string, { route: Point[] | undefined; hours: number }>;
}
const personMotion = new WeakMap<StreetGraph, WeakMap<Occupant, PersonMotionCache>>();

function personCache(graph: StreetGraph, occupant: Occupant): PersonMotionCache {
  let byOccupant = personMotion.get(graph);
  if (!byOccupant) { byOccupant = new WeakMap(); personMotion.set(graph, byOccupant); }
  let cache = byOccupant.get(occupant);
  if (!cache) { cache = { spots: new Map(), legs: new Map() }; byOccupant.set(occupant, cache); }
  return cache;
}

function cachedSpot(graph: StreetGraph, occupant: Occupant, plotId: number): ErrandSpot | undefined {
  const cache = personCache(graph, occupant);
  let spot = cache.spots.get(plotId);
  if (spot === undefined) { spot = errandSpotFor(graph, occupant, plotId) ?? null; cache.spots.set(plotId, spot); }
  return spot ?? undefined;
}

function legInfo(graph: StreetGraph, occupant: Occupant, fromId: number, toId: number, measuredForAll: boolean) {
  const cache = personCache(graph, occupant);
  const key = `${fromId}>${toId}${measuredForAll ? 'm' : ''}`;
  let info = cache.legs.get(key);
  if (!info) {
    const route = legRoute(graph, occupant, fromId, toId);
    // Source household people walk the real route at the indoor body's speed.
    // Legacy preview people retain their established timing until unified,
    // except in the 3D crowd (measuredForAll): there a 30-minute leg over a
    // 30 m street read as a walk cycle on the spot.
    const hours = (!occupant.householdMemberId && !measuredForAll) || !route
      ? COMMUTE_FRAC
      : pathLength(route) * 0.3048 / TOWN_WALK_METERS_PER_SECOND / 3600;
    info = { route, hours };
    cache.legs.set(key, info);
  }
  return info;
}

/** A person at an errand place stands in front of its door, in a small group. */
export interface ErrandSpot {
  /** Where this person stands (plan feet). */
  spot: Point;
  /** The point the group faces (plan feet). */
  face: Point;
}

/** Standing points per errand place, spread evenly (an R2 sequence). The
 * first version had 10 fixed slots, and a midday crowd of 30 at one market
 * door stood inside each other (392 pairs closer than 0.5 m at 13:00 in the
 * demo town, 2026-11-02). */
const ERRAND_POINTS = 96;
/** The standing zone runs this far along the street each way from the door (ft). */
const ERRAND_ALONG_FT = 26;
/** A zone never runs narrower than this each way, beside a close neighbor (ft). */
const ERRAND_MIN_ALONG_FT = 4;

// GG-601 (2026-11-02): one standing slot per person at each errand place.
// The hash slot let two people of one group stand inside each other, and the
// zones of neighbor places overlapped (89 pairs closer than 0.5 m at 13:00 in
// the demo town). Every caller that has the roster registers it first. Each
// person takes the lowest slot that is free when they arrive (the slots of
// people who stay are held to one hour after they leave, for the walk), so
// the slot numbers stay as small as the largest group, and two people at the
// place at one time never share a slot.
interface ErrandSlots { rosters: WeakSet<readonly Occupant[]>; slot: WeakMap<Occupant, number> }
const errandSlotsByGraph = new WeakMap<StreetGraph, ErrandSlots>();

/** Hand out the standing slots of every errand place for one town's people.
 * Call it before any motion read for this graph; a second call with the same
 * roster array costs nothing. */
export function registerErrandGroups(graph: StreetGraph, occupants: readonly Occupant[]): void {
  let entry = errandSlotsByGraph.get(graph);
  if (!entry) { entry = { rosters: new WeakSet(), slot: new WeakMap() }; errandSlotsByGraph.set(graph, entry); }
  if (entry.rosters.has(occupants)) return;
  entry.rosters.add(occupants);
  const byPlace = new Map<number, Array<{ occupant: Occupant; start: number; end: number }>>();
  for (const occupant of occupants) {
    const place = errandPlotFor(graph, occupant);
    if (place === undefined || place === occupant.homePlotId || place === occupantWorkPlotId(occupant)) continue;
    let start = -1, end = -1;
    for (let h = 0; h < 24; h++) {
      if (occupantLocationAt(occupant, h).activity !== 'out') continue;
      if (start < 0) start = h;
      end = h + 1;
    }
    if (start < 0) continue;
    const list = byPlace.get(place) ?? [];
    list.push({ occupant, start, end });
    byPlace.set(place, list);
  }
  for (const list of byPlace.values()) {
    list.sort((x, y) => x.start - y.start || x.occupant.id - y.occupant.id);
    const freeFrom: number[] = []; // per slot: the hour it is free again
    for (const { occupant, start, end } of list) {
      let slot = freeFrom.findIndex((hour) => hour <= start);
      if (slot < 0) { slot = freeFrom.length; freeFrom.push(0); }
      freeFrom[slot] = end + 1;
      entry!.slot.set(occupant, slot);
      // A spot or leg read before this call used the hash slot: drop it.
      const cache = personCache(graph, occupant);
      cache.spots.clear();
      cache.legs.clear();
    }
  }
}

/** Grid spacing of registered slots (ft): 0.76 m between neighbors. */
const ERRAND_SLOT_FT = 2.5;

const zoneHalfByGraph = new WeakMap<StreetGraph, Map<number, number>>();

/** Half the zone length along the street: up to ERRAND_ALONG_FT, and short of
 * half the gap to the nearest other errand place's door. */
function zoneHalfAlongFt(graph: StreetGraph, plotId: number): number {
  let byPlot = zoneHalfByGraph.get(graph);
  if (!byPlot) {
    byPlot = new Map();
    const places = [...graph.plotEntrances.values()]
      .filter((e) => e.role !== undefined && (ERRAND_ROLES as readonly string[]).includes(e.role));
    for (const place of places) {
      let gap = Infinity;
      for (const other of places) {
        if (other.plotId !== place.plotId) gap = Math.min(gap, Math.hypot(other.door[0] - place.door[0], other.door[1] - place.door[1]));
      }
      byPlot.set(place.plotId, Math.max(ERRAND_MIN_ALONG_FT, Math.min(ERRAND_ALONG_FT, gap / 2 - 1.5)));
    }
    zoneHalfByGraph.set(graph, byPlot);
  }
  return byPlot.get(plotId) ?? ERRAND_ALONG_FT;
}

/** The spot in front of `plotId`'s door when that plot is this person's
 * errand place (not their home or work). Undefined for any other plot.
 * People stand on the street side of the door, spread along the street, and
 * face the middle of the group. */
export function errandSpotFor(graph: StreetGraph, occupant: Occupant, plotId: number): ErrandSpot | undefined {
  if (plotId === occupant.homePlotId || plotId === occupantWorkPlotId(occupant)) return undefined;
  if (errandPlotFor(graph, occupant) !== plotId) return undefined;
  return frontageStandingSpot(graph, occupant, plotId, errandSlotsByGraph.get(graph)?.slot.get(occupant));
}

/** A scheduled worker whose room packet cannot admit them still exists on
 * the public frontage. Reuse the errand standing layout, at the street end
 * of the connector, rather than stacking bodies in the doorway. This is a
 * waiting place, not an indoor station, a completed commute or permission.
 * The keeper's workPlotId and every job/schedule/source identity stay intact.
 * Room capacity and physical staff entry remain separate unfinished work. */
export function workplaceWaitingSpotFor(graph:StreetGraph,occupant:Occupant,people:readonly Occupant[]):ErrandSpot|undefined {
  const plotId=occupant.employment?.plotId;
  if(plotId===undefined||occupant.workPlotId===plotId||!people.includes(occupant))return undefined;
  let slots=workplaceWaitingSlots.get(people);
  if(!slots){
    slots=new WeakMap();workplaceWaitingSlots.set(people,slots);
    const groups=new Map<number,Occupant[]>();
    for(const person of people){const place=person.employment?.plotId;if(place===undefined||person.workPlotId===place)continue;
      const group=groups.get(place)??[];group.push(person);groups.set(place,group);}
    for(const group of groups.values())group.sort((a,b)=>a.id-b.id).forEach((person,index)=>slots!.set(person,index));
  }
  return frontageStandingSpot(graph,occupant,plotId,slots.get(occupant),true);
}
const workplaceWaitingSlots=new WeakMap<readonly Occupant[],WeakMap<Occupant,number>>();

function frontageStandingSpot(graph:StreetGraph,occupant:Occupant,plotId:number,slot?:number,waiting=false):ErrandSpot|undefined {
  const entrance = graph.plotEntrances.get(plotId);
  if (!entrance) return undefined;
  const [dx, dy] = entrance.door;
  // Outward = toward the street; a door on the street uses centroid → door.
  let ux = entrance.streetPoint[0] - dx, uy = entrance.streetPoint[1] - dy;
  if (Math.hypot(ux, uy) < 1) { ux = dx - entrance.centroid[0]; uy = dy - entrance.centroid[1]; }
  const len = Math.hypot(ux, uy) || 1;
  ux /= len; uy /= len;
  // Along = the street's own direction at the entrance (or the door's side).
  const seg = graph.segments[entrance.streetSegmentIndex];
  let tx = -uy, ty = ux;
  if (seg) {
    const [ax, ay] = graph.nodes[seg.fromNode], [bx, by] = graph.nodes[seg.toNode];
    const tl = Math.hypot(bx - ax, by - ay);
    if (tl > 1) { tx = (bx - ax) / tl; ty = (by - ay) / tl; }
  }
  // Errand groups use the connector before the street center (GG-601).
  // Workers without an interior station wait at its street end instead of
  // occupying the door. These are targets, not a substitute for body/terrain
  // admission or proof that a workplace has room for its scheduled staff.
  const near = waiting ? Math.max(3, entrance.connectorLengthFt) : Math.min(3, Math.max(1.5, entrance.connectorLengthFt * 0.4));
  const far = entrance.connectorLengthFt - 1.5;
  const half = zoneHalfAlongFt(graph, plotId);
  let along: number, depth: number;
  if (slot !== undefined) {
    // A registered slot: a grid that fills from the door outward, the middle
    // of each row first (0, +1, -1, +2, ...). A big group runs deeper into the
    // street rather than into a neighbor's zone. A small stable jitter keeps
    // the rows from reading as a drill line; it never closes the gap below
    // 2.5 - 0.8 = 1.7 ft (0.52 m).
    const columns = 2 * Math.floor(half / ERRAND_SLOT_FT) + 1; // symmetric: no column past the edge
    const row = Math.floor(slot / columns), column = slot % columns;
    const offset = column === 0 ? 0 : (column % 2 ? 1 : -1) * Math.ceil(column / 2);
    const jitter = (salt: number) => ((stableHash(occupant.id, salt) % 1000) / 1000 - 0.5) * 0.8;
    along = offset * ERRAND_SLOT_FT + jitter(102);
    depth = near + row * ERRAND_SLOT_FT + jitter(103);
  } else {
    // An unregistered caller (a test, a lone preview person) keeps the stable
    // hash point of the R2 sequence.
    const k = stableHash(occupant.id, 101) % ERRAND_POINTS;
    const u = (0.5 + k * 0.7548776662) % 1, v = (0.5 + k * 0.5698402910) % 1;
    along = (u - 0.5) * 2 * half;
    depth = near + (Math.max(far, near + 2) - near) * v;
  }
  const mid = (near + Math.max(far, near + 2)) / 2;
  return {
    spot: [dx + ux * depth + tx * along, dy + uy * depth + ty * along],
    face: [dx + ux * mid, dy + uy * mid],
  };
}

/** The walked polyline of one leg: door to door along the streets, plus the
 * short step to or from an errand spot. Undefined when a plot has no door. */
function legRoute(graph: StreetGraph, occupant: Occupant, fromId: number, toId: number): Point[] | undefined {
  const a = frontDoorForPlot(graph, fromId), b = frontDoorForPlot(graph, toId);
  if (!a || !b) return undefined;
  const base = scheduledRoute(graph, fromId, toId, a, b);
  const startSpot = cachedSpot(graph, occupant, fromId), endSpot = cachedSpot(graph, occupant, toId);
  if (!startSpot && !endSpot) return base;
  return [...(startSpot ? [startSpot.spot] : []), ...base, ...(endSpot ? [endSpot.spot] : [])];
}

/** Time still owed outside from the start of this hour. A room cannot claim
 * the resident until this measured door-to-door street leg has arrived. */
export function commuteArrivalDelayAtHour(graph: StreetGraph, occupant: Occupant, hour: number): number {
  const leg = recentCommute(occupant, hour, graph);
  if (!leg) return 0;
  // The delayed departure and the walk both come before the room may claim
  // the body. This matches the street position in townMotionSnapshotAt.
  const depart = legDepartureDelayHours(occupant, hour - leg.elapsed);
  return Math.max(0, depart + routeHours(graph, occupant, leg.from, leg.to) - leg.elapsed);
}

// A generated graph and its plot doors are immutable. Scheduled commuters ask
// for the same directed plot-to-plot paths on every motion tick, so retain those
// polylines with the graph that owns them. Callers only sample these arrays;
// none mutate them, and WeakMap ownership lets retired towns be collected.
const scheduledRoutesByGraph = new WeakMap<StreetGraph, Map<string, Point[]>>();

function scheduledRoute(
  graph: StreetGraph,
  fromPlotId: number,
  toPlotId: number,
  from: Point,
  to: Point,
): Point[] {
  let routes = scheduledRoutesByGraph.get(graph);
  if (!routes) {
    routes = new Map();
    scheduledRoutesByGraph.set(graph, routes);
  }

  const key = `${fromPlotId}>${toPlotId}`;
  const cached = routes.get(key);
  if (cached) return cached;

  const route = routeAlongStreets(graph, from, to);
  routes.set(key, route);
  return route;
}

// The people who can be outside a building at some time in hour `hr`: OUT,
// or on a leg that began less than two hours ago (it may still be walking or
// waiting to leave). Everyone else is inside for the whole hour. The street
// crowd asks for outdoor people several times a second; this list is built
// once per graph, roster and hour (about 1,000 of 3,521 at 13:00 in
// Borieborum, 2026-11-02).
const candidatesByGraph = new WeakMap<StreetGraph, WeakMap<TownRoster, Map<number, Occupant[]>>>();
function outdoorCandidates(graph: StreetGraph, roster: TownRoster, hr: number): Occupant[] {
  let byRoster = candidatesByGraph.get(graph);
  if (!byRoster) { byRoster = new WeakMap(); candidatesByGraph.set(graph, byRoster); }
  let byHour = byRoster.get(roster);
  if (!byHour) { byHour = new Map(); byRoster.set(roster, byHour); }
  let list = byHour.get(hr);
  if (!list) {
    list = (roster.occupants as Occupant[]).filter((occ) => {
      if (stopTable(occ, graph)[hr].activity === 'out') return true;
      const leg = recentCommute(occ, hr, graph);
      return !!leg && leg.elapsed < 2;
    });
    byHour.set(hr, list);
  }
  return list;
}

// Plot centroids per immutable plan (the motion pass used to rebuild them).
const centroidsByPlan = new WeakMap<TownPlan, Map<number, [number, number]>>();
function centroidsFor(plan: TownPlan): Map<number, [number, number]> {
  let centroids = centroidsByPlan.get(plan);
  if (!centroids) {
    centroids = new Map();
    for (const plot of plan.plots) centroids.set(plot.id, centroidOf(plot));
    centroidsByPlan.set(plan, centroids);
  }
  return centroids;
}

/** Keep a known building endpoint at its door; legacy/no-street plans retain their centroid. */
function settledPointForPlot(
  graph: StreetGraph,
  plotId: number,
  centroid: Point,
): Point {
  return frontDoorForPlot(graph, plotId) ?? centroid;
}

/**
 * Like `townSnapshotAt`, but at a FRACTIONAL `clock` (hours, e.g. 7.5) and with
 * continuous positions: an agent whose scheduled plot just changed walks the
 * street route between the two plots (via `routeAlongStreets`/`positionAlongPath`)
 * across the commute window instead of teleporting at the boundary. The town
 * feels alive — people are seen moving between home and work — while staying pure
 * and deterministic. Build the `graph` once with `buildStreetGraph(plan)`.
 */
export function townMotionSnapshotAt(
  plan: TownPlan,
  graph: StreetGraph,
  roster: TownRoster,
  clock: number,
  /** measuredWalk: every person walks at TOWN_WALK_METERS_PER_SECOND (3D crowd).
   *  outdoorsOnly: return only people outside a building (the street crowd's
   *  pass skips the rest before it builds their records). */
  options: { measuredWalk?: boolean; outdoorsOnly?: boolean } = {},
): MovingAgentSnapshot[] {
  const centroids = centroidsFor(plan);
  const measured = !!options.measuredWalk;

  const wrapped = ((clock % 24) + 24) % 24;
  const hr = Math.floor(wrapped);
  const frac = wrapped - hr;

  registerErrandGroups(graph, roster.occupants);
  const out: MovingAgentSnapshot[] = [];
  const people = options.outdoorsOnly ? outdoorCandidates(graph, roster, hr) : (roster.occupants as Occupant[]);
  for (const occ of people) {
    // The OUT block walks to the errand place when the graph has one.
    const cur = stopTable(occ, graph)[hr];
    const destCentroid = centroids.get(cur.plotId);
    if (!destCentroid) continue; // defensive: roster always references plan plots
    const destSpot = cachedSpot(graph, occ, cur.plotId);
    const dest = destSpot?.spot ?? settledPointForPlot(graph, cur.plotId, destCentroid);
    const base = { occupantId: occ.id, name: occ.name, activity: cur.activity, plotId: cur.plotId };

    // A leg that began two or more hours ago has long arrived (the longest
    // departure delay plus walk is well under that), so skip its route.
    const recent = recentCommute(occ, hr, graph);
    const leg = recent && recent.elapsed < 2 ? recent : undefined;
    const fromCentroid = leg ? centroids.get(leg.from) : undefined;
    const fromSpot = leg ? cachedSpot(graph, occ, leg.from) : undefined;
    const from = fromCentroid
      ? fromSpot?.spot ?? settledPointForPlot(graph, leg!.from, fromCentroid)
      : undefined;
    const info = leg ? legInfo(graph, occ, leg.from, leg.to, measured) : undefined;
    const duration = info?.hours ?? 0;
    // A household leg departs a little after the hour (legDepartureDelayHours).
    const walked = (leg?.elapsed ?? 0) + frac - (leg ? legDepartureDelayHours(occ, hr - leg.elapsed) : 0);
    if (from && duration > 0 && walked < duration) {
      if (walked < 0) {
        // Not left yet: still inside the origin building, or still with the
        // group at the errand place before the walk home.
        if (!fromSpot && options.outdoorsOnly) continue;
        out.push({ ...base, x: from[0], y: from[1], moving: false, outdoors: !!fromSpot,
          ...(fromSpot ? { faceX: fromSpot.face[0], faceY: fromSpot.face[1] } : {}) });
        continue;
      }
      // Both route ends are already canonical doors (or errand spots). This
      // prevents the first frame from popping before the street walk begins.
      const route = info?.route
        ?? scheduledRoute(graph, leg!.from, cur.plotId, from as Point, dest as Point);
      const [x, y] = positionAlongPath(route, walked / duration);
      out.push({ ...base, x, y, moving: true, outdoors: true });
    } else {
      // Remain at the route's destination door (or errand spot) after arrival.
      // Plans without a usable entrance preserve their centroid fallback.
      const outdoors = !!destSpot || cur.activity === 'out';
      if (!outdoors && options.outdoorsOnly) continue;
      out.push({ ...base, x: dest[0], y: dest[1], moving: false,
        outdoors,
        ...(destSpot ? { faceX: destSpot.face[0], faceY: destSpot.face[1] } : {}) });
    }
  }
  return out;
}
