export type ReliefBand = 'peak' | 'hill';
/** One stamped relief glyph: position (map space), band, size, and snow flag. */
export interface ReliefGlyph {
    x: number;
    y: number;
    band: ReliefBand;
    s: number;
    snowTip: boolean;
}
/**
 * Map encoded height (0–100 scale) to a relief band, or null if below hill threshold.
 * - h >= PEAK_MIN_H (70) → 'peak'
 * - HILL_MIN_H (50) <= h < PEAK_MIN_H → 'hill'
 * - h < HILL_MIN_H → null
 */
export declare function reliefBandForHeight(h: number): ReliefBand | null;
/**
 * Deterministic relief-glyph stamps for one cell.
 *
 * Count = 1 for peaks (singular, dramatic), 2 for hills (clustered).
 * Positions are hashed fractions over the polygon's bbox, rejection-tested
 * inside the polygon; at most `count * 8` attempts.
 * Size scales with h: `s = 0.8 + (h - HILL_MIN_H) / 50 * 1.2` (0.8 at h50 to ~2.0 at h100).
 * snowTip only when h >= GLYPH_SNOW_TIP_MIN_H (80) and band === 'peak'.
 */
export declare function cellReliefGlyphs(cellId: number, poly: Array<[number, number]>, h: number, band: ReliefBand): ReliefGlyph[];
/**
 * The snow-cap sub-path ONLY: a tiny detached inner ∧ near a peak's apex,
 * anchored at the same (x, y) BASE and scaled by `s`. Split out (Task 9) so
 * the atlas renderers can stroke the cap WHITE while the peak body strokes in
 * the band ink — one geometry, two colors, no double-inking. `reliefGlyphPath`
 * appends exactly this string for snow-tipped peaks, so the two never diverge.
 */
export declare function reliefGlyphCapPath(x: number, y: number, s: number): string;
/**
 * Tiny SVG path for relief glyph, anchored at (x, y) = BASE of the glyph
 * (glyphs grow upward, i.e. toward negative y), scaled by `s`. The same
 * strings drive canvas rendering via `new Path2D(d)`.
 *
 * Peak: two-stroke ▲ (open, not closed). When snowTip, append a detached
 * tiny inner ∧ cap just below the apex (see `reliefGlyphCapPath`).
 * Hill: single soft chevron arc (shallow, half-ellipse).
 */
export declare function reliefGlyphPath(band: ReliefBand, x: number, y: number, s: number, snowTip: boolean): string;
/**
 * Ink tint for a relief band. Peak carets are dark ink; hill chevrons are softer grey.
 * Snow caps are stroked white by the RENDERER (Task 9), not here.
 */
export declare function reliefInk(band: ReliefBand): string;
