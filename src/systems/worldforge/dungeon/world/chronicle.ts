/**
 * @file chronicle.ts — Pillar 2, Task 4: ground a dungeon's history in the
 * world's REAL named events.
 *
 * A dungeon's decay log (simulateHistory) is, by itself, anonymous: "the hold
 * burned ninety years ago". This layer hands the simulator a small set of
 * `ChronicleRef`s — the real atlas event zones near the site — so a matching
 * event can QUOTE one: "the hold burned in the Onerean Occupation". The zone
 * names are the world's own (zones-generator.ts builds them from state, culture,
 * and disease vocabularies), so a fortress ruin cites the war that razed it and
 * a plague crypt cites the pestilence that filled it — and two dungeons near the
 * SAME zone name the SAME event, at the SAME era.
 *
 * SOURCES. Two, in priority order:
 *  1. The site's PROVENANCE zone (Task 2 civ sites carry `provenance.zoneId`).
 *     Always included when present — a war-fortress must be able to cite its
 *     war. Ore-mountain provenance carries NO zone (mines are delved quietly,
 *     not razed), so those sites simply get no provenance ref; their history
 *     stays local unless a nearby zone happens to reach them.
 *  2. NEARBY zones — any event zone with a cell within `NEAR_GRAPH_HOPS` graph
 *     hops of the site's cell. A dungeon within a couple of cells of a war's
 *     edge plausibly saw that war. Dedup against the provenance zone by id.
 *
 * AGES. Zones carry no explicit year (FMG never dates them). So each zone's
 * `yearsAgo` is DERIVED — a seeded age drawn from a per-zone-KIND band (war /
 * plague / eruption differ; see {@link AGE_BANDS}). The draw streams off the
 * WORLD ROOT (`s:chronicle`), keyed by the zone's id — NOT off any site path.
 * That is the whole point of cross-site consistency: every site that references
 * zone 4 draws zone 4's age from the identical stream, so the age is a property
 * of the WORLD, not of whichever dungeon asked. (Tested: two sites near one zone
 * report the same `yearsAgo`.)
 *
 * Determinism: no Math.random. Ages draw on a NEW `s:chronicle` stream off the
 * world root — perturbs no existing worldforge or dungeon golden. Output is
 * sorted (provenance first, then by zoneId) for a stable order.
 *
 * Zero THREE imports; pure data.
 */
import { rootSeedPath, streamPath, childSeedPath, rngFromPath, fnv1a } from '../../seedPath';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { worldChronicleFor } from '../../chronicle/worldChronicle';
import type { ChronicleRef, ChronicleShape } from '../types';
import type { DungeonSite } from './dungeonSites';

export type { ChronicleKind, ChronicleRef, ChronicleShape } from '../types';

/** How many graph hops from the site cell a zone may reach and still count as
 * "near" the dungeon. ~2 = the site's cell, its neighbors, and their neighbors. */
const NEAR_GRAPH_HOPS = 2;

/** FMG zone `type` → chronicle kind. Only these types are chronicled; peaceful
 * Proselytism, faults, avalanches, tsunamis, etc. leave no dungeon-grade scar. */
const ZONE_KIND: Readonly<Record<string, 'war' | 'plague' | 'eruption'>> = {
  Invasion: 'war',
  Rebels: 'war',
  Crusade: 'war',
  Disease: 'plague',
  Eruption: 'eruption',
};

/**
 * FMG zone `type` → grammatical shape of its name. Type "Rebels" names are ALL
 * faction-shaped — zones-generator.ts builds them as "{state adjective} {plural
 * faction noun}" from the Rebels family (Rebels, Insurrection, Mutineers,
 * Insurgents, Rebellion, Renegades, Revolters, Revolutionaries, Rioters,
 * Separatists, Secessionists, Conspiracy; zones-generator.ts:202-217), e.g.
 * "Damunvilian Rebels". Every other chronicled type names a HAPPENING
 * (Invasion → "Onerean Occupation", Disease → "Pink Cholera", Eruption →
 * "Dunstonbeck Eruption"), so it defaults to 'event'.
 */
const ZONE_SHAPE: Readonly<Record<string, ChronicleShape>> = {
  Rebels: 'faction',
};

/**
 * Seeded age band (years-ago, inclusive) per chronicle kind. Zones carry no
 * date, so an age is drawn uniformly from the kind's band on the `s:chronicle`
 * stream. Bands overlap the simulator's own event ages (80–500 → decaying), so
 * a bound event's snapped era stays plausible against the rest of its log:
 *  - war: a razed hold is old but not ancient — living memory to a few
 *    generations (60–400).
 *  - plague: pestilence recurs; crypts fill within a couple of centuries (40–260).
 *  - eruption: a mountain's fire is the oldest scar of the three (150–600).
 */
/** Only the three ATLAS-ZONE kinds are dated here; the world-chronicle kinds
 * (schism/crusade/migration/fall) carry their own ages from worldChronicle.ts. */
type ZoneKind = 'war' | 'plague' | 'eruption';
const AGE_BANDS: Readonly<Record<ZoneKind, readonly [number, number]>> = {
  war: [60, 400],
  plague: [40, 260],
  eruption: [150, 600],
};

interface ZoneLike {
  i: number;
  type?: string;
  name?: string;
  cells?: number[];
}

interface ChronicleCells {
  c?: ReadonlyArray<ReadonlyArray<number>>;
  state?: ArrayLike<number>;
}

/**
 * The world-consistent age of a zone. Streams off the WORLD ROOT (not the site),
 * keyed by zone id, so every site that references this zone derives the SAME age.
 * Drawn uniformly from the kind's band; deterministic (no Math.random).
 */
function zoneYearsAgo(worldSeed: number, zoneId: number, kind: ZoneKind): number {
  const chroniclePath = streamPath(rootSeedPath(worldSeed), 'chronicle');
  const rng = rngFromPath(childSeedPath(chroniclePath, `z${zoneId}`));
  const [lo, hi] = AGE_BANDS[kind];
  // nextInt is max-EXCLUSIVE → +1 to include `hi`.
  return rng.nextInt(lo, hi + 1);
}

/**
 * Cells within `hops` graph hops of `start`, as a Set (includes `start`). Pure
 * BFS over the FMG cell neighbor graph (cells.c). Small radius, so cheap.
 */
function cellsWithinHops(
  cells: ChronicleCells,
  start: number,
  hops: number,
): Set<number> {
  const seen = new Set<number>([start]);
  if (!cells.c) return seen;
  let frontier = [start];
  for (let ring = 0; ring < hops && frontier.length; ring++) {
    const next: number[] = [];
    for (const cell of frontier) {
      const nbrs = cells.c[cell];
      if (!nbrs) continue;
      for (const j of nbrs) {
        if (seen.has(j)) continue;
        seen.add(j);
        next.push(j);
      }
    }
    frontier = next;
  }
  return seen;
}

/**
 * Build the chronicle for a site: the real world events near it, each with a
 * world-consistent derived age. Provenance zone first (always, when present),
 * then any other event zone whose cells reach within `NEAR_GRAPH_HOPS` of the
 * site cell. Deduped by zoneId, sorted provenance-first then by zoneId.
 *
 * Cross-site consistency: the same zone yields the same `{kind, name, zoneId,
 * yearsAgo}` for EVERY site that references it (ages stream off the world root).
 */
export function chronicleForSite(worldSeed: number, site: DungeonSite): ChronicleRef[] {
  const atlas = getBridgeAtlas(worldSeed);
  const cells = atlas.pack.cells as ChronicleCells;
  const rawZones = ((atlas.pack as { zones?: ZoneLike[] }).zones ?? []).filter(
    (z) => z && Array.isArray(z.cells),
  );

  // Zone id → the ref it produces, so provenance + nearby can't double-list one.
  const byId = new Map<number, ChronicleRef>();
  // Preserve provenance-first ordering: provenance zone ids come first.
  const order: number[] = [];

  const addZone = (z: ZoneLike): void => {
    const kind = ZONE_KIND[z.type ?? ''];
    if (!kind) return; // not a chronicle-grade zone type
    if (byId.has(z.i)) return;
    const ref: ChronicleRef = {
      kind,
      shape: ZONE_SHAPE[z.type ?? ''] ?? 'event',
      name: z.name ?? '',
      zoneId: z.i,
      yearsAgo: zoneYearsAgo(worldSeed, z.i, kind),
    };
    byId.set(z.i, ref);
    order.push(z.i);
  };

  // 1 ── provenance zone (always, when the site carries one). Ore-mountain sites
  //      have no provenance zone, so nothing is added here for them.
  const provId = site.provenance?.zoneId;
  if (provId != null) {
    const z = rawZones.find((zz) => zz.i === provId);
    if (z) addZone(z);
  }

  // 2 ── nearby zones — any chronicle-grade zone reaching within NEAR_GRAPH_HOPS.
  const near = cellsWithinHops(cells, site.cellId, NEAR_GRAPH_HOPS);
  // Stable pass order by zone id so the sort below is trivially stable.
  const sortedZones = [...rawZones].sort((a, b) => a.i - b.i);
  for (const z of sortedZones) {
    if (byId.has(z.i)) continue;
    if (!ZONE_KIND[z.type ?? '']) continue;
    if ((z.cells ?? []).some((cid) => near.has(cid))) addZone(z);
  }

  const zoneRefs = order.map((id) => byId.get(id)!);

  // 3 ── nearby WORLD-CHRONICLE entries (beyond zones). Up to WORLD_REF_CAP entries
  //      whose cells reach within WORLD_NEAR_HOPS of the site, OR whose actors
  //      include the site's own state. Mapped onto the ChronicleRef shape with a
  //      STABLE synthetic zoneId (a negative hash of the entry id) that can never
  //      collide with a real atlas zone id (those are small non-negative). When no
  //      world entry is near, this appends nothing — so a site far from every new
  //      entry returns byte-identically to before this change.
  const worldRefs = nearbyWorldRefs(worldSeed, cells, site);
  return [...zoneRefs, ...worldRefs];
}

/** How far (graph hops) a world-chronicle entry may reach and still bind a site. */
const WORLD_NEAR_HOPS = 3;
/** At most this many world-chronicle refs are offered to a single site. */
const WORLD_REF_CAP = 2;

/**
 * Stable synthetic zoneId for a world-chronicle entry: a NEGATIVE fnv1a hash of
 * its string id, guaranteed distinct from real atlas zone ids (≥ 0) and stable
 * per entry, so binding/summary arithmetic and the tests' distinctness checks hold.
 */
function syntheticZoneId(entryId: string): number {
  return -(fnv1a(entryId) % 2000000000) - 1;
}

/**
 * Up to {@link WORLD_REF_CAP} world-chronicle entries near a site, mapped to
 * ChronicleRefs. "Near" = an entry cell within {@link WORLD_NEAR_HOPS} hops of the
 * site cell, or the entry's actors include the site's state. Deterministic (stable
 * entry order + synthetic ids). Kept OUT of `chronicleForSite`'s zone dedup map so
 * it can never alter the zone-ref output — a byte-compat guarantee.
 */
function nearbyWorldRefs(
  worldSeed: number,
  cells: ChronicleCells,
  site: DungeonSite,
): ChronicleRef[] {
  const { entries } = worldChronicleFor(worldSeed);
  if (entries.length === 0) return [];
  const near = cellsWithinHops(cells, site.cellId, WORLD_NEAR_HOPS);
  const siteState = cells.state ? cells.state[site.cellId] : undefined;
  const out: ChronicleRef[] = [];
  for (const e of entries) {
    if (out.length >= WORLD_REF_CAP) break;
    const cellHit = e.cells.some((cid) => near.has(cid));
    const stateHit =
      siteState !== undefined &&
      siteState > 0 &&
      (e.actors.stateIds?.includes(siteState) ?? false);
    if (!cellHit && !stateHit) continue;
    out.push({
      kind: e.kind,
      shape: e.shape,
      name: e.name,
      zoneId: syntheticZoneId(e.id),
      yearsAgo: e.yearsAgo,
    });
  }
  return out;
}
