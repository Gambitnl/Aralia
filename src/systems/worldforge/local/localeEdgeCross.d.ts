/**
 * @file localeEdgeCross.ts — pure edge-cross math for seamless walking (Stage 5).
 *
 * When the player walks off the current Locale's extent, two pure questions drive
 * the cross (the side-effecting parts — resolving the neighbour cell and
 * re-streaming the ground — live in World3DWrapper):
 *   - did the position exit, and in which WORLD direction? (`detectEdgeCross`)
 *   - where in the neighbour's (same-size) Locale should the player re-appear,
 *     so it reads as a continuous step rather than a jump? (`entryFeetAfterCross`)
 *
 * Locale-local feet: x = feet east from the west edge, y = feet south from the
 * north edge (mirrors `groundPosToLocaleFeet`). World direction: +x = east,
 * +y = south (matches atlas graph space, so it composes with
 * `cellNeighbourInDirection`). Pure — no atlas, no grid, no React.
 */
/** A world-space crossing direction; each axis is -1, 0, or +1. */
export interface CrossDir {
    dx: -1 | 0 | 1;
    dy: -1 | 0 | 1;
}
/**
 * The world direction in which a Locale-local position (feet) has exited the
 * extent, or `null` while still inside (edges inclusive count as inside). A
 * corner exit returns a diagonal (both axes set) — `cellNeighbourInDirection`
 * then picks the best-aligned neighbour.
 */
export declare function detectEdgeCross(feet: {
    x: number;
    y: number;
}, extentFt: {
    x: number;
    y: number;
}): CrossDir | null;
/**
 * The entry position (feet) in the neighbour's Locale after crossing `dir`. The
 * player re-appears just inside the OPPOSITE edge (`inset` feet in) with the
 * un-crossed (tangential) coordinate preserved and clamped — so stepping east out
 * of cell A lands you at the west edge of cell B at the same north/south offset,
 * reading as one continuous stride. Assumes both Locales share `extentFt` (they
 * do today: a fixed 3000ft window).
 */
export declare function entryFeetAfterCross(exitFeet: {
    x: number;
    y: number;
}, dir: CrossDir, extentFt: {
    x: number;
    y: number;
}, inset?: number): {
    x: number;
    y: number;
};
