/**
 * @file mountainsPass.ts — world-gen pass: name the ranges and peaks (stage 37).
 *
 * Mountains campaign Task 2 (spec 2026-07-11-mountains-design §1): flood-fill
 * contiguous highland pack cells into ranges (Task 1's pure core), classify
 * range/highlands/volcanic, name each range from its seed cell's culture plus
 * a kind word bank, find and name each range's strict local-maximum peaks,
 * anchor a label pole, and write the result to `pack.ranges` + `pack.peaks`.
 * The shared geographic dedup (naming/dedupeNames.ts, the forests ruling)
 * then pulls duplicate RANGE names apart; peaks skip dedup on purpose —
 * "Mount X" twins are tolerable and ADOPTED names must never mutate.
 *
 * PASSES (mountains Task 4): after all naming settles, `detectPasses` walks
 * every highway/road/trail and writes `pack.passes` — one named pass per
 * crest where a route crosses a range. RNG-FREE by design: detection is pure
 * geometry over routes × ranges and naming indexes PASS_WORDS by cellId, so
 * it can run AFTER the adoption-affected peak naming without any stream
 * coupling (the pinned mirror test needs no draw for passes).
 *
 * WORLD-PRESERVATION DOCTRINE (binding, from the roads campaign): this pass
 * consumes ZERO shared-stream randomness — no Math.random (which is still
 * Alea(seed) when generateWorld calls us), no rw/gauss/P, no Names.*. All
 * draws come from an OWN SeededRandom stream derived from the world seed:
 * a 31-multiplier string hash of the seed, salted with 0x4d6f756e ("Moun")
 * so the stream is unique to mountains. The pass only ADDS `pack.ranges`,
 * `pack.peaks`, and `pack.passes`; every pre-existing golden stays
 * byte-identical.
 *
 * THE STREAM CONTRACT (pinned by the mirror test): per range in cluster id
 * order — ONE nameRange draw; then per its peaks in findPeaks order — one
 * namePeak draw ONLY when the peak does not ADOPT a marker name. Kind
 * classification, the pole walk, and pass detection/naming are draw-free.
 *
 * PEAK NAME ADOPTION: volcanoes and sacred mountains already carry "Mount X"
 * names in their legend notes (markers-generator addVolcano /
 * addSacredMountain, note id template `"marker" + marker.i` — the id string
 * both `add()` call sites pass). When a peak cell or any direct neighbor
 * hosts such a marker, the peak adopts the note's name VERBATIM — pure
 * string reuse, no draw. The optional `notes` parameter supplies those
 * notes (generateWorld threads its in-scope array); without it — or when no
 * note matches the marker's id — there is nothing to adopt and the peak
 * rolls a fresh name like any other (crafted packs and note-less callers
 * get the all-fresh stream by design, not by accident).
 *
 * NOTE on culture adjectives: as in forestsPass, getAdjective draws from
 * Math.random per scanned rule — NOT pure — so the RAW culture name of the
 * range's seed cell is the adjective for the range AND its peaks ("Elden
 * Spine" shelters "Mount Elden", the tunables' own pairing).
 */
import { SeededRandom } from '@/utils/random';
import type { Pack } from '../fmg/features';
import type { Marker } from '../fmg/markers-generator';
import type { Route } from '../fmg/routes-generator';
import { getPolesOfInaccessibility } from '../fmg/utils/pathUtils';
import { dedupeNamesGeographic } from '../naming/dedupeNames';
import {
  clusterRangeCells,
  findPeaks,
  rangeKindOf,
  nameRange,
  namePeak,
  type RangeKind,
} from './mountainClusters';
import { PASS_WORDS, PEAK_NAME_FORMS } from './mountainTunables';
import { buildRangeLookup } from './rangeForCell';

/** One named range on the pack (mirrored to AtlasRange by the adapter). */
export interface PackRange {
  /** 1-based range id — 0 is reserved for "no range" (FMG id convention). */
  i: number;
  /** "<Culture> <BankWord>", e.g. "Elden Spine" (post-dedup unique). */
  name: string;
  kind: RangeKind;
  /** Member pack-cell ids, ascending. Every range cell is in exactly one range. */
  cells: number[];
  /** The h >= PEAK_MIN_H core-mountain subset of cells, ascending. */
  coreCells: number[];
  /** Label anchor (pole of inaccessibility), FMG pixel space like cells.p. */
  pole: [number, number];
}

/** One named peak on the pack (mirrored to AtlasPeak by the adapter). */
export interface PackPeak {
  /** 1-based peak id, global across ranges in creation order. */
  i: number;
  /** Owning range's 1-based id. */
  rangeI: number;
  /** The peak's pack cell. */
  cellId: number;
  /** Encoded pack height (0–100 scale) at the peak cell. */
  h: number;
  /** Adopted marker-note name ("Mount X") or a fresh culture+form name. */
  name: string;
}

/** One named pass on the pack — detected and filled by `detectPasses` (the
 * LAST step of generateMountains), mirrored to AtlasPass by the adapter. */
export interface PackPass {
  /** 1-based pass id. */
  i: number;
  /** The range this pass crosses (1-based id). */
  rangeI: number;
  /** The crossing's highest route cell. */
  cellId: number;
  name: string;
  /** Routes (pack route ids) that cross through this pass. */
  routeIds: number[];
}

/** Marker types whose legend-note names peaks adopt (spec §1). */
const ADOPTABLE_MARKER_TYPES: ReadonlySet<string> = new Set([
  'volcanoes',
  'sacred-mountains',
]);

/**
 * Generate `pack.ranges` + `pack.peaks` from the world seed. Deterministic;
 * additive-only; draws exclusively from its own seeded stream (file header).
 *
 * Call AFTER the FMG markers stage and the forests pass (generateWorld stage
 * 37) — the pass reads cells.h, cells.culture, cultures, and pack.markers
 * (volcano kind + name adoption). `notes` is the world's legend-note array
 * (generateWorld's in-scope `notes`); optional — see the adoption header.
 */
export function generateMountains(
  pack: Pack,
  seed: string,
  notes?: Array<{ id: string; name: string }>,
): void {
  // Own RNG stream (see file header): hash the seed string, salt with "Moun".
  let h = 0;
  for (const ch of seed) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  const rng = new SeededRandom((h ^ 0x4d6f756e) >>> 0);

  const heights = pack.cells.h;
  const neighbors = (c: number): number[] => pack.cells.c?.[c] ?? [];
  const clusters = clusterRangeCells(heights, neighbors, pack.cells.i.length);

  // Marker indexes: volcano cells drive the 'volcanic' kind; adoptable
  // markers (volcano + sacred mountain) drive peak-name adoption. First
  // marker per cell wins in pack.markers array order (FMG's occupied
  // discipline never stacks markers, so this is belt-and-braces determinism).
  const markers = (pack as Pack & { markers?: Marker[] }).markers ?? [];
  const volcanoCells = new Set<number>();
  const adoptableByCell = new Map<number, Marker>();
  for (const marker of markers) {
    if (marker.type === 'volcanoes') volcanoCells.add(marker.cell);
    if (
      ADOPTABLE_MARKER_TYPES.has(marker.type) &&
      !adoptableByCell.has(marker.cell)
    ) {
      adoptableByCell.set(marker.cell, marker);
    }
  }

  /** Adopted name for a peak cell: the cell's own marker first, then direct
   * neighbors in adjacency-array order — the FIRST candidate whose marker
   * note resolves (note id `"marker" + marker.i`, the markers-generator
   * template) wins. Draw-free. Undefined when nothing resolves. */
  const adoptedNameFor = (cell: number): string | undefined => {
    if (!notes || notes.length === 0) return undefined;
    for (const candidate of [cell, ...neighbors(cell)]) {
      const marker = adoptableByCell.get(candidate);
      if (!marker) continue;
      const note = notes.find((n) => n.id === `marker${marker.i}`);
      if (note) return note.name;
    }
    return undefined;
  };

  // Label poles: one isoline id per range (ids start at 1 so 0 = not-range).
  const cellToRangeId = new Map<number, number>();
  for (const cluster of clusters) {
    for (const cell of cluster.cellIds) cellToRangeId.set(cell, cluster.id + 1);
  }
  const poles: Record<string, [number, number]> = getPolesOfInaccessibility(
    pack,
    (cell: number) => cellToRangeId.get(cell) ?? 0,
  );

  // Name draws follow the stream contract (file header): range name, then
  // its non-adopted peaks, per cluster in id order.
  const ranges: PackRange[] = [];
  const peaks: PackPeak[] = [];
  for (const cluster of clusters) {
    const kind = rangeKindOf(cluster, (c) => volcanoCells.has(c)); // draw-free
    const cultureName =
      pack.cultures?.[pack.cells.culture?.[cluster.seedCell] ?? 0]?.name ??
      'Wild';
    const name = nameRange(kind, cultureName, rng); // ONE draw
    // Isoline pole when the walk produced one; else the seed cell's point
    // (possible for degenerate rings, e.g. chains shorter than 3 vertices).
    const pole = poles[String(cluster.id + 1)] ?? [
      pack.cells.p[cluster.seedCell][0],
      pack.cells.p[cluster.seedCell][1],
    ];
    ranges.push({
      i: cluster.id + 1,
      name,
      kind,
      cells: cluster.cellIds,
      coreCells: cluster.coreCells,
      pole,
    });

    for (const cell of findPeaks(cluster, heights, neighbors)) {
      const adopted = adoptedNameFor(cell); // draw-free
      peaks.push({
        i: peaks.length + 1,
        rangeI: cluster.id + 1,
        cellId: cell,
        h: heights[cell],
        // Adopted peaks consume NO draw — the stream contract's one branch.
        name: adopted ?? namePeak(cultureName, rng),
      });
    }
  }

  pack.ranges = ranges;
  pack.peaks = peaks;

  // Duplicate RANGE names pull apart with the shared geographic suffix
  // (Remy ruling 2026-07-11, forests precedent). RNG-FREE — pure pole
  // geometry — so slotting it here keeps the pinned draw order intact.
  // Peaks are deliberately NOT deduped (file header).
  dedupeNamesGeographic(pack.ranges);

  // Passes LAST (Task 4): rng-free, so it reads the POST-dedup range names
  // and the final (possibly adopted) peak names without touching the pinned
  // draw order above.
  detectPasses(pack);
}

// ---------------------------------------------------------------------------
// Pass detection + naming (mountains Task 4) — RNG-FREE (file header).
// ---------------------------------------------------------------------------

/** Route tiers that can crest a range as a NAMED pass: engineered/maintained
 * ways only. Bare forest paths and sea lanes never make a pass. */
const PASS_ROUTE_GROUPS: ReadonlySet<Route['group']> = new Set([
  'highways',
  'roads',
  'trails',
]);

/** How far (BFS steps over cells.c) the stem hunt looks for a same-range
 * peak around a pass crest before falling back to the range's first word. */
const PASS_STEM_BFS_STEPS = 3;

/** The bank/form words of PEAK_NAME_FORMS ('Mount', 'Peak', 'Horn', ...) —
 * the tokens a peak name sheds to become a pass stem. */
const PEAK_FORM_WORDS: ReadonlySet<string> = new Set(
  PEAK_NAME_FORMS.flatMap((form) => form.split(' ').filter((w) => w !== '{a}')),
);

/** A peak name's stem: the bank/form word dropped — trailing first ("Astel
 * Horn" → "Astel"), else leading ("Mount Trubc" → "Trubc"). Names carrying
 * no form word (bare adopted names) stay whole. */
function peakStem(name: string): string {
  const words = name.split(' ');
  if (words.length >= 2 && PEAK_FORM_WORDS.has(words[words.length - 1])) {
    return words.slice(0, -1).join(' ');
  }
  if (words.length >= 2 && PEAK_FORM_WORDS.has(words[0])) {
    return words.slice(1).join(' ');
  }
  return name;
}

/**
 * Detect and name `pack.passes` — the LAST step of generateMountains.
 *
 * DETECTION (the binding rule): for each route whose group is a pass-worthy
 * tier, walk its point cellIds (`points[k][2]`); every contiguous run of
 * cells inside ANY named range crests at its max-h cell (tie → lowest
 * cellId) — a run of length 1 still crests (a route clipping a range corner
 * tops out somewhere). Candidates dedup by cellId across routes, merging
 * routeIds (sorted asc); `pack.passes` is ordered by cellId asc, ids 1-based.
 *
 * NAMING, deterministic and draw-free: stem = the nearest peak of the SAME
 * range within PASS_STEM_BFS_STEPS over cells.c (depth ties → lowest peak
 * cellId) with its form word stripped, else the range name's FIRST word;
 * the pass word indexes PASS_WORDS by `cellId % length` instead of an rng
 * pick, which is what keeps this whole step off the mountains stream.
 */
function detectPasses(pack: Pack): void {
  const heights = pack.cells.h;
  const neighbors = (c: number): number[] => pack.cells.c?.[c] ?? [];
  const { rangeIdOf } = buildRangeLookup(pack);

  // 1. Crest candidates, deduped by cellId with merged routeIds.
  const byCell = new Map<number, { rangeI: number; routeIds: Set<number> }>();
  for (const route of pack.routes ?? []) {
    if (!PASS_ROUTE_GROUPS.has(route.group)) continue;
    let crest = -1; // current run's best cell; -1 = not inside a run
    const commitRun = (): void => {
      if (crest < 0) return;
      const entry = byCell.get(crest);
      if (entry) entry.routeIds.add(route.i);
      else byCell.set(crest, { rangeI: rangeIdOf(crest)!, routeIds: new Set([route.i]) });
      crest = -1;
    };
    for (const point of route.points) {
      const cell = point[2];
      if (rangeIdOf(cell) == null) {
        commitRun(); // the run (if any) ended at a non-range cell
        continue;
      }
      if (
        crest < 0 ||
        heights[cell] > heights[crest] ||
        (heights[cell] === heights[crest] && cell < crest)
      ) {
        crest = cell;
      }
    }
    commitRun(); // a run that reaches the route's end still crests
  }

  // 2. Stem lookup support: peak-by-cell, range-by-id.
  const peakByCell = new Map<number, PackPeak>();
  for (const peak of pack.peaks ?? []) peakByCell.set(peak.cellId, peak);
  const rangeById = new Map<number, PackRange>();
  for (const range of pack.ranges ?? []) rangeById.set(range.i, range);

  /** Nearest same-range peak within the BFS budget (depth ties → lowest
   * peak cellId) stripped to its stem, else the range name's first word. */
  const stemFor = (cellId: number, rangeI: number): string => {
    let frontier = [cellId];
    const visited = new Set<number>([cellId]);
    for (let depth = 0; depth <= PASS_STEM_BFS_STEPS; depth++) {
      let best: PackPeak | undefined;
      for (const cell of frontier) {
        const peak = peakByCell.get(cell);
        if (!peak || peak.rangeI !== rangeI) continue;
        if (!best || peak.cellId < best.cellId) best = peak;
      }
      if (best) return peakStem(best.name);
      if (depth === PASS_STEM_BFS_STEPS) break;
      const next: number[] = [];
      for (const cell of frontier) {
        for (const neighbor of neighbors(cell)) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
      frontier = next;
    }
    return rangeById.get(rangeI)!.name.split(' ')[0];
  };

  // 3. Emit ordered by cellId asc, 1-based ids, deterministic word pick.
  const cellIds = [...byCell.keys()].sort((a, b) => a - b);
  pack.passes = cellIds.map((cellId, index) => {
    const { rangeI, routeIds } = byCell.get(cellId)!;
    return {
      i: index + 1,
      rangeI,
      cellId,
      name: `${stemFor(cellId, rangeI)} ${PASS_WORDS[cellId % PASS_WORDS.length]}`,
      routeIds: [...routeIds].sort((a, b) => a - b),
    };
  });
}
