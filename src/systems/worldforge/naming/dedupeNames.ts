/**
 * @file naming/dedupeNames.ts — geographic-suffix name dedup shared by the
 * Aralia world-gen naming passes (forest names, mountain range names).
 *
 * MOVED VERBATIM out of forestsPass.ts by the mountains campaign (Task 2's
 * sanctioned refactor): same compass buckets, same lowest-id-keeps-bare rule,
 * same Greater/Lesser fallback — zero behavior change, proven by the forests
 * stream-mirror + dedup suites passing UNMODIFIED against forestsPass's
 * re-export. PURE GEOMETRY — zero draws on ANY stream — so passes can slot it
 * after naming without shifting a single pinned draw.
 */

/** The fields the dedup reads — PackForest and PackRange both satisfy it
 * structurally (their extra fields are ignored). */
export interface GeographicNamed {
  /** 1-based feature id — the LOWEST id keeps the bare name. */
  i: number;
  name: string;
  /** Member cell ids — only the count matters (Greater/Lesser rank). */
  cells: number[];
  /** Label pole, FMG pixel space — the compass-bearing source. */
  pole: [number, number];
}

/** Full-word 8-way compass, ordered counter-clockwise from East — the same
 * angle bucketing as navDrift's bearingToDirection (atlas y grows DOWN, SVG
 * convention, so north is −y), spelled out for display names. */
const DEDUP_COMPASS = [
  'East',
  'Northeast',
  'North',
  'Northwest',
  'West',
  'Southwest',
  'South',
  'Southeast',
] as const;

/** 8-way compass word of (dx, dy) in atlas space; identical poles read North
 * (mirrors bearingToDirection's degenerate case). */
function compassWordOf(dx: number, dy: number): string {
  if (dx === 0 && dy === 0) return 'North';
  const deg = ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360;
  return DEDUP_COMPASS[Math.round(deg / 45) % 8];
}

/**
 * Rename duplicate feature names apart with a geographic suffix. For each
 * group of features sharing one name, the LOWEST-id feature keeps the bare
 * name; every other member gains ` of the <Compass>` from the 8-way bearing
 * of ITS pole relative to the bare-name feature's pole. When a later member
 * lands a compass word an earlier member already claimed (rare), it takes
 * ` the Greater` / ` the Lesser` INSTEAD of the compass word — by cell count
 * against that first claimant (ties read Lesser) — processed
 * lowest-id-first, so the outcome is deterministic.
 *
 * PURE GEOMETRY — zero draws on ANY stream — which is why the naming passes
 * can slot it between naming and later stages without shifting a single
 * draw their stream-mirror tests pin.
 */
export function dedupeNamesGeographic(features: GeographicNamed[]): void {
  const byName = new Map<string, GeographicNamed[]>();
  for (const feature of features) {
    const group = byName.get(feature.name);
    if (group) group.push(feature);
    else byName.set(feature.name, [feature]);
  }
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.i - b.i); // lowest id keeps the bare name
    const keeper = group[0];
    const claimed = new Map<string, GeographicNamed>(); // compass word → first claimant
    for (let m = 1; m < group.length; m++) {
      const member = group[m];
      const compass = compassWordOf(
        member.pole[0] - keeper.pole[0],
        member.pole[1] - keeper.pole[1],
      );
      const first = claimed.get(compass);
      if (!first) {
        claimed.set(compass, member);
        member.name = `${member.name} of the ${compass}`;
      } else {
        const rank =
          member.cells.length > first.cells.length ? 'Greater' : 'Lesser';
        member.name = `${member.name} the ${rank}`;
      }
    }
  }
}
