/**
 * @file riverWidth.ts — how wide a river is, in one place.
 *
 * This is the SINGLE source for river width. It had been copy-pasted into
 * `generateRegion.generateRiverBanks` and `town/townRiverCourse`, and the two
 * copies had already drifted (one guarded a null discharge, the other did not).
 * Width now feeds the region ribbon, the town ribbon, the 3D channel AND the
 * bridge deck that spans it, so a drifting copy would put a bridge over the
 * wrong-sized river.
 */

/**
 * Channel width in feet for a river carrying `discharge`.
 *
 * ## Why this curve
 *
 * The previous formula was `50 + sqrt(discharge) * 20`. Measured across the 215
 * rivers of world 903674813 it produced:
 *
 * | | discharge | old width |
 * |---|---|---|
 * | narrowest | 35 | 51 m |
 * | median | 93 | 74 m |
 * | widest | 1493 | 251 m |
 *
 * The narrowest river in the entire world was wider than the Thames at Oxford
 * (~40 m), and the median was half the Seine. The `50 +` floor meant no
 * waterway could ever be under 15 m, so Aralia had no streams — only great
 * rivers, everywhere, which is what made them read as fat bands cutting towns
 * in half (Remy, 2026-07-31).
 *
 * ## The exponent is not 0.5, and that is deliberate
 *
 * Hydraulic geometry says width scales as roughly Q^0.5, and that is the
 * physically honest exponent. It does not work here: FMG's discharge only spans
 * ~43x across the whole world, and a square root compresses that to ~6.5x. With
 * sqrt you can have 5 m streams or a 200 m great river, never both.
 *
 * 0.8 spreads the same discharge range over ~20x, which buys the full ladder
 * from a stream you could ford to a river that needs a bridge. Physical
 * fidelity is traded for legible variety on purpose: the player reads relative
 * size, and a world where every river looks identical carries no information.
 *
 * Resulting spread on the same 215 rivers:
 *
 * | | discharge | new width | reads as |
 * |---|---|---|---|
 * | narrowest | 35 | ~5 m | a stream |
 * | p25 | 69 | ~9 m | a brook |
 * | median | 93 | ~11 m | a small river |
 * | p75 | 153 | ~17 m | a river |
 * | p90 | 280 | ~27 m | Thames at Oxford |
 * | widest | 1493 | ~103 m | a great river |
 *
 * `RIVER_WIDTH_SCALE` is the dial. Raising it widens every river in the world
 * proportionally, in 2D and 3D, including the bridge decks that span them.
 */
const RIVER_WIDTH_SCALE = 0.98; // feet at discharge = 1
const RIVER_WIDTH_EXPONENT = 0.8;

export function riverWidthFt(discharge: number | undefined | null): number {
  const q = Math.max(0, discharge ?? 0);
  if (q <= 0) return 0;
  return RIVER_WIDTH_SCALE * Math.pow(q, RIVER_WIDTH_EXPONENT);
}
