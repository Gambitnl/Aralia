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
export declare function dedupeNamesGeographic(features: GeographicNamed[]): void;
