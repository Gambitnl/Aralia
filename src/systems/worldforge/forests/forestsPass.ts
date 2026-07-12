/**
 * @file forestsPass.ts — world-gen pass: name the forests (stage 36).
 *
 * Forests campaign Task 2 (spec 2026-07-11-forests-design §1): flood-fill
 * contiguous forest-biome pack cells into clusters (Task 1's pure core),
 * assign kinds, name each forest from its seed cell's culture plus a word
 * bank, anchor a label pole, and write the result to `pack.forests`.
 * A pure dedup pass (Remy ruling 2026-07-11) then pulls duplicate names
 * apart with a geographic suffix — see dedupeForestNames.
 * Task 8a adds forest POI markers (hunter camps, shrines, hermit hollows,
 * beast dens) APPENDED to `pack.markers` after naming. Task 9 then retargets
 * the roads campaign's village forest-spur routes onto those POIs (pure
 * geometry, zero draws — see retargetSpursToPois).
 *
 * WORLD-PRESERVATION DOCTRINE (binding, from the roads campaign): this pass
 * consumes ZERO shared-stream randomness — no Math.random (which is still
 * Alea(seed) when generateWorld calls us), no rw/gauss/P, no Names.*. All
 * draws come from an OWN SeededRandom stream derived from the world seed:
 * a 31-multiplier string hash of the seed, salted with 0x466f7265 ("Fore")
 * so the stream is unique to forests. The pass only ADDS `pack.forests` and
 * APPENDS POI markers to `pack.markers` (never reordering or rewriting the
 * FMG stage-34 markers); every pre-existing golden stays byte-identical.
 *
 * NOTE on culture adjectives: the zones-generator pattern uses
 * getAdjective(culture name), but getAdjective draws P(rule.probability)
 * from Math.random per scanned rule (fmg/utils/languageUtils.ts header) —
 * NOT pure, so using it here would leak shared-stream draws. Per the task
 * resolution we use the RAW culture name instead ("Angshire Woods").
 */
import { SeededRandom } from '@/utils/random';
import type { Pack } from '../fmg/features';
import type { Marker } from '../fmg/markers-generator';
import { getPolesOfInaccessibility } from '../fmg/utils/pathUtils';
import { dedupeNamesGeographic } from '../naming/dedupeNames';
import {
  clusterForestCells,
  assignForestKinds,
  nameForest,
  type ForestCluster,
  type ForestKind,
} from './forestClusters';
import {
  FOREST_MIN_CELLS,
  FOREST_POI_ICONS,
  FOREST_POI_MAX_PER_FOREST,
  FOREST_POI_PER_CELLS,
  FOREST_POI_WEIGHTS,
  HAUNTED_BEAST_DEN_WEIGHT,
  type ForestWordBankKey,
} from './forestTunables';

/** One named forest on the pack (mirrored to AtlasForest by the adapter). */
export interface PackForest {
  /** 1-based forest id — 0 is reserved for "no forest" (FMG id convention). */
  i: number;
  /** "<Culture> <BankWord>", e.g. "Angshire Wildwood". */
  name: string;
  kind: ForestKind;
  /** Member pack-cell ids, ascending. Every cell is in exactly one forest. */
  cells: number[];
  /** Label anchor (pole of inaccessibility), FMG pixel space like cells.p. */
  pole: [number, number];
}

/**
 * Generate `pack.forests` from the world seed. Deterministic; additive-only;
 * draws exclusively from its own seeded stream (see file header).
 *
 * Call AFTER biomes and the civilization layer exist (generateWorld stage 36)
 * — the pass reads cells.biome, cells.f, cells.burg, cells.culture and
 * cultures for kinds and names.
 */
export function generateForests(pack: Pack, seed: string): void {
  const biome = pack.cells.biome;
  if (!biome) {
    throw new Error(
      'generateForests: pack.cells.biome is missing — Biomes.define must run before the forests pass',
    );
  }

  // Own RNG stream (see file header): hash the seed string, salt with "Fore".
  let h = 0;
  for (const ch of seed) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  const rng = new SeededRandom((h ^ 0x466f7265) >>> 0);

  const neighbors = (c: number): number[] => pack.cells.c?.[c] ?? [];
  const clusters = clusterForestCells(biome, neighbors, pack.cells.i.length);

  /** Fraction of a cluster in rainforest: temperate rainforest (8) counts
   * full, tropical rainforest (7) counts half — steers the ancient crown
   * toward the oldest-feeling woods. */
  const rainforestShare = (cluster: ForestCluster): number => {
    let count8 = 0;
    let count7 = 0;
    for (const cell of cluster.cellIds) {
      if (biome[cell] === 8) count8++;
      else if (biome[cell] === 7) count7++;
    }
    return (count8 + count7 * 0.5) / cluster.cellIds.length;
  };

  /** COARSE binary isolation (per task resolution): 1 when no burg sits in
   * the cluster's cells or their direct neighbors, else 0. Burgs spawned by
   * later passes (ensureIslandHarbors) are intentionally not seen. */
  const isolation = (cluster: ForestCluster): number => {
    const burg = pack.cells.burg;
    if (!burg) return 1; // no settlement layer at all — everything is lonely
    for (const cell of cluster.cellIds) {
      if (burg[cell] > 0) return 0;
      for (const neighbor of neighbors(cell)) {
        if (burg[neighbor] > 0) return 0;
      }
    }
    return 1;
  };

  // Kind rolls consume the stream first, in cluster id order (Task 1 core).
  const kinds = assignForestKinds(clusters, {
    landmassOf: (cell) => pack.cells.f?.[cell] ?? 0, // FMG feature id
    rainforestShare,
    isolation,
    rng,
  });

  /** Word bank: strict-majority biome flavor first — taiga (9) → 'taiga',
   * tropical (5/7) → 'jungle' — else the forest's kind bank ('ordinary'
   * included). Per the binding task resolution; majority means > half. */
  const bankKeyFor = (
    cluster: ForestCluster,
    kind: ForestKind,
  ): ForestWordBankKey => {
    let taiga = 0;
    let tropical = 0;
    for (const cell of cluster.cellIds) {
      if (biome[cell] === 9) taiga++;
      else if (biome[cell] === 5 || biome[cell] === 7) tropical++;
    }
    const half = cluster.cellIds.length / 2;
    if (taiga > half) return 'taiga';
    if (tropical > half) return 'jungle';
    return kind;
  };

  // Label poles: one isoline id per forest (ids start at 1 so 0 = not-forest).
  const cellToForestId = new Map<number, number>();
  for (const cluster of clusters) {
    for (const cell of cluster.cellIds) cellToForestId.set(cell, cluster.id + 1);
  }
  const poles: Record<string, [number, number]> = getPolesOfInaccessibility(
    pack,
    (cell: number) => cellToForestId.get(cell) ?? 0,
  );

  // Name picks consume the stream second, again in cluster id order.
  pack.forests = clusters.map((cluster) => {
    const kind = kinds.get(cluster.id)!;
    const cultureName =
      pack.cultures?.[pack.cells.culture?.[cluster.seedCell] ?? 0]?.name ??
      'Wild';
    const name = nameForest(bankKeyFor(cluster, kind), cultureName, rng);
    // Isoline pole when the walk produced one; else the seed cell's point
    // (possible for degenerate rings, e.g. chains shorter than 3 vertices).
    const pole = poles[String(cluster.id + 1)] ?? [
      pack.cells.p[cluster.seedCell][0],
      pack.cells.p[cluster.seedCell][1],
    ];
    return { i: cluster.id + 1, name, kind, cells: cluster.cellIds, pole };
  });

  // Duplicate names pull apart with a geographic suffix (Remy ruling
  // 2026-07-11). RNG-FREE — pure pole geometry — so slotting it here keeps
  // the pinned draw order (kinds → names → POIs) byte-identical.
  dedupeForestNames(pack.forests);

  // POI markers draw LAST on the forests stream (Task 8a): every kind roll
  // and every name pick above has already consumed its draws, so placement
  // appends draws to OUR stream without shifting anything the Task-2 stream
  // contract pins (forest kinds/names stay byte-identical). The shared Alea
  // stream is untouched as ever.
  placeForestPois(pack, pack.forests, rng);

  // Spur retargeting (Task 9) runs dead last, AFTER placeForestPois, so it
  // sees the final marker set. It consumes ZERO draws on ANY stream — pure
  // deterministic geometry — which is why it takes no rng: the stream-mirror
  // and name-pin tests stay green unmodified with or without routes present.
  retargetSpursToPois(pack);
}

// ---------------------------------------------------------------------------
// Duplicate-name dedup (Remy ruling 2026-07-11) — same-named forests gain a
// geographic suffix so every forest name on the atlas is unique. The dedup
// itself MOVED VERBATIM to naming/dedupeNames.ts (mountains Task 2 sanctioned
// refactor — mountain ranges share it); this forests-era name stays exported
// for existing importers. Zero behavior change: the stream-mirror and dedup
// suites pass unmodified.
// ---------------------------------------------------------------------------

/** Forests-era alias of the shared geographic dedup (see block comment). */
export const dedupeForestNames: (forests: PackForest[]) => void =
  dedupeNamesGeographic;

// ---------------------------------------------------------------------------
// Forest POI markers (Task 8a) — camps, shrines, hollows, dens in the deep
// woods, appended to pack.markers for the map + discovery layers. The type
// weights, haunted-den boost, and icons are tunables (forestTunables.ts);
// the pool expansion below preserves their declaration order — the seed
// contract the stream-mirror and pinned-seed haunted tests pin.
// ---------------------------------------------------------------------------

/** Expand the weight table into the uniform-pick pool for one forest kind. */
function forestPoiTypePool(kind: ForestKind): string[] {
  const pool: string[] = [];
  for (const [type, weight] of FOREST_POI_WEIGHTS) {
    const effective =
      kind === 'haunted' && type === 'beast-den'
        ? HAUNTED_BEAST_DEN_WEIGHT
        : weight;
    for (let k = 0; k < effective; k++) pool.push(type);
  }
  return pool;
}

/**
 * Place POI markers inside qualifying forests, appending to `pack.markers`.
 *
 * Contract (Task 8a + controller fix wave, binding):
 * - Only forests with >= FOREST_MIN_CELLS * 2 cells get POIs; each gets
 *   min(FOREST_POI_MAX_PER_FOREST, max(1, floor(cells / FOREST_POI_PER_CELLS))).
 * - Cell pick prefers INTERIOR cells (every neighbor in the same forest),
 *   falling back to any cluster cell; candidates stay sorted by cell id
 *   (forest.cells is ascending); cells already carrying ANY marker — FMG
 *   stage-34 markers and earlier POIs alike — leave the candidate set. One
 *   draw via rng.nextInt(0, candidates.length) per POI, then one for type.
 * - Marker ids continue from the current max + 1 (0 on a fresh array); the
 *   array is only created when at least one POI actually places.
 * - NO notes/legend entries — legend text generators draw from the shared
 *   stream, which is forbidden here (world-preservation doctrine).
 */
function placeForestPois(
  pack: Pack,
  forests: PackForest[],
  rng: SeededRandom,
): void {
  const neighbors = (c: number): number[] => pack.cells.c?.[c] ?? [];
  const placed: Array<Omit<Marker, 'i'>> = [];

  // Occupied discipline (mirrors FMG's): never stack a POI on a cell that
  // already carries a marker. Picked POI cells join the set as they place.
  const packWithMarkers = pack as Pack & { markers?: Marker[] };
  const occupied = new Set<number>(
    (packWithMarkers.markers ?? []).map((marker) => marker.cell),
  );

  for (const forest of forests) {
    if (forest.cells.length < FOREST_MIN_CELLS * 2) continue;
    const count = Math.min(
      FOREST_POI_MAX_PER_FOREST,
      Math.max(1, Math.floor(forest.cells.length / FOREST_POI_PER_CELLS)),
    );

    const inForest = new Set(forest.cells);
    // forest.cells ascends (clusterForestCells sorts), so both candidate
    // arrays below are already sorted by cell id — the determinism contract.
    const interior = forest.cells.filter((cell) =>
      neighbors(cell).every((neighbor) => inForest.has(neighbor)),
    );
    const pool = forestPoiTypePool(forest.kind);

    for (let k = 0; k < count; k++) {
      let candidates = interior.filter((cell) => !occupied.has(cell));
      if (candidates.length === 0) {
        candidates = forest.cells.filter((cell) => !occupied.has(cell));
      }
      if (candidates.length === 0) break; // every cluster cell is markered
      const cell = candidates[rng.nextInt(0, candidates.length)];
      occupied.add(cell);
      const type = pool[rng.nextInt(0, pool.length)];
      placed.push({
        type,
        icon: FOREST_POI_ICONS[type],
        x: pack.cells.p[cell][0],
        y: pack.cells.p[cell][1],
        cell,
      });
    }
  }

  if (placed.length === 0) return; // no qualifying forest — leave pack alone

  const markers =
    packWithMarkers.markers ?? (packWithMarkers.markers = []);
  let nextId =
    markers.reduce((max, marker) => Math.max(max, marker.i), -1) + 1;
  for (const poi of placed) markers.push({ i: nextId++, ...poi });
}

// ---------------------------------------------------------------------------
// Spur retargeting (Task 9) — village forest spurs bend onto forest POIs, so
// paths lead to camps and shrines instead of arbitrary trees.
// ---------------------------------------------------------------------------

/** The marker types spurs retarget onto — exactly the Task 8a POI set. */
const FOREST_POI_TYPES: ReadonlySet<string> = new Set(
  Object.keys(FOREST_POI_ICONS),
);

/**
 * Rewrite every village forest-spur route (`pack.routes` entries with
 * `group === 'paths'`, from the roads campaign's generatePaths) so it ends on
 * the nearest forest POI cell, when one is in walking range.
 *
 * Contract (Task 9, binding):
 * - ZERO RNG on any stream — pure deterministic geometry over the final
 *   marker set. Runs LAST in generateForests, after placeForestPois, so it
 *   sees both FMG stage-34 markers and the freshly placed POIs.
 * - Per spur: BFS from the route's first cell (`points[0][2]`, the village;
 *   the start cell itself is never tested, mirroring generatePaths) over LAND
 *   cells only (`cells.h >= 20`, neighbors from `cells.c` in array order),
 *   bounded at 400 dequeued cells — the same bound generatePaths used. The
 *   FIRST POI cell discovered wins: nearest by BFS depth, with equal-depth
 *   ties inherently resolved by visit order (parent dequeue order, then
 *   neighbor array order) — deterministic because both orders are.
 * - On a hit the route's cell chain is rebuilt village→POI from the BFS
 *   parent map and `points` rewritten as `[x, y, cellId]` triples from
 *   `pack.cells.p` — EXCEPT the first point, which keeps the route's existing
 *   burg-adjusted point verbatim. No other route field changes.
 * - No POI in range → the route stays untouched (a dead-end spur into the
 *   woods is legitimate).
 * - The cell-link index is NOT rebuilt: paths were never in it (invariant
 *   shared by Routes.generate and ensureIslandHarbors' rebuildRouteLinks).
 */
function retargetSpursToPois(pack: Pack): void {
  const routes = pack.routes;
  if (!routes) return; // crafted packs without a road network
  const markers = (pack as Pack & { markers?: Marker[] }).markers ?? [];

  const poiCells = new Set<number>();
  for (const marker of markers) {
    if (FOREST_POI_TYPES.has(marker.type)) poiCells.add(marker.cell);
  }
  if (poiCells.size === 0) return; // a world without POIs keeps its spurs

  const cells = pack.cells;
  const isLand = (c: number): boolean => (cells.h?.[c] ?? 0) >= 20;

  for (const route of routes) {
    if (route.group !== 'paths') continue;
    const firstPoint = route.points[0];
    const village = firstPoint[2];

    // Bounded land BFS, mirroring generatePaths' forest search structure
    // (routes-generator.ts): the bound counts DEQUEUED cells, and target
    // membership is tested at discovery time.
    const parent = new Map<number, number>();
    const seen = new Set<number>([village]);
    const queue: number[] = [village];
    let found = -1;
    let visited = 0;
    while (queue.length && visited < 400 && found < 0) {
      const cur = queue.shift()!;
      visited++;
      for (const nb of cells.c?.[cur] ?? []) {
        if (seen.has(nb) || !isLand(nb)) continue;
        seen.add(nb);
        parent.set(nb, cur);
        if (poiCells.has(nb)) {
          found = nb;
          break;
        }
        queue.push(nb);
      }
    }
    if (found < 0) continue; // no POI in range — the dead-end spur remains

    // Rebuild the village→POI cell chain from the parent map.
    const chain: number[] = [];
    for (let c = found; c !== village; c = parent.get(c)!) chain.push(c);
    chain.push(village);
    chain.reverse();

    route.points = chain.map((c, idx) =>
      idx === 0 ? firstPoint : [cells.p[c][0], cells.p[c][1], c],
    );
  }
}
