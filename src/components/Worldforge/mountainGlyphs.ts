/**
 * @file mountainGlyphs.ts — ONE relief-glyph language for the 2D atlas.
 *
 * Peak carets (▲) and hill chevrons render on cells h >= 50.
 * Determinism: NO SeededRandom stream (glyphs are decoration and must never
 * disturb worldgen RNG draws). Every random-looking choice is an integer hash
 * of (cellId, salt) using Knuth's multiplicative constant 2654435761
 * (= floor(2^32 / golden ratio)) via `Math.imul`, so identical inputs always
 * produce identical glyph layouts — pure function of cellId + poly + h.
 *
 * Both renderers (canvas atlasDraw and SVG AtlasLayers) read this module.
 * Glyphs render UNDER forest glyphs (elevation truth below decoration).
 */
import {
  GLYPH_PEAK_MIN_H,
  GLYPH_HILL_MIN_H,
  GLYPH_SNOW_TIP_MIN_H,
} from '../../systems/worldforge/mountains/mountainTunables';

// ---------------------------------------------------------------------------
// Relief band type and glyph interface
// ---------------------------------------------------------------------------

export type ReliefBand = 'peak' | 'hill';

/** One stamped relief glyph: position (map space), band, size, and snow flag. */
export interface ReliefGlyph {
  x: number;
  y: number;
  band: ReliefBand;
  s: number;
  snowTip: boolean;
}

// ---------------------------------------------------------------------------
// Band classification by height
// ---------------------------------------------------------------------------

/**
 * Map encoded height (0–100 scale) to a relief band, or null if below hill threshold.
 * - h >= PEAK_MIN_H (70) → 'peak'
 * - HILL_MIN_H (50) <= h < PEAK_MIN_H → 'hill'
 * - h < HILL_MIN_H → null
 */
export function reliefBandForHeight(h: number): ReliefBand | null {
  if (h >= GLYPH_PEAK_MIN_H) return 'peak';
  if (h >= GLYPH_HILL_MIN_H) return 'hill';
  return null;
}

// ---------------------------------------------------------------------------
// Deterministic integer hashing (Knuth multiplicative, no RNG stream)
// ---------------------------------------------------------------------------

/**
 * Mix two 32-bit lanes into one well-scrambled unsigned 32-bit value.
 * Knuth-style multiplicative hashing: `Math.imul(x, 2654435761)` with
 * xor-shift avalanche between rounds. Stateless — same (a, b) → same hash.
 */
function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 2654435761);
  h ^= h >>> 15;
  h = Math.imul(h ^ b, 2654435761);
  h ^= h >>> 13;
  h = Math.imul(h, 2654435761);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Hash of (a, b) mapped to a fraction in [0, 1). */
function frac(a: number, b: number): number {
  return mix(a, b) / 4294967296; // 2^32
}

// ---------------------------------------------------------------------------
// Point-in-polygon (standard even-odd ray cast over the poly ring)
// ---------------------------------------------------------------------------

function pointInPolygon(x: number, y: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ---------------------------------------------------------------------------
// Glyph placement
// ---------------------------------------------------------------------------

/**
 * Deterministic relief-glyph stamps for one cell.
 *
 * Count = 1 for peaks (singular, dramatic), 2 for hills (clustered).
 * Positions are hashed fractions over the polygon's bbox, rejection-tested
 * inside the polygon; at most `count * 8` attempts.
 * Size scales with h: `s = 0.8 + (h - HILL_MIN_H) / 50 * 1.2` (0.8 at h50 to ~2.0 at h100).
 * snowTip only when h >= GLYPH_SNOW_TIP_MIN_H (80) and band === 'peak'.
 */
export function cellReliefGlyphs(
  cellId: number,
  poly: Array<[number, number]>,
  h: number,
  band: ReliefBand,
): ReliefGlyph[] {
  const count = band === 'peak' ? 1 : 2;
  if (count <= 0 || poly.length < 3) return [];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of poly) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }

  // Compute size: scales from 0.8 at h=50 to ~2.0 at h=100.
  const s = Math.max(0.4, Math.min(3, 0.8 + ((h - GLYPH_HILL_MIN_H) / 50) * 1.2));
  const snowTip = band === 'peak' && h >= GLYPH_SNOW_TIP_MIN_H;

  const out: ReliefGlyph[] = [];
  const maxAttempts = count * 8;
  // Four hash lanes per attempt (x, y, unused, unused) — lane salts never
  // collide across attempts.
  for (let attempt = 0; attempt < maxAttempts && out.length < count; attempt++) {
    const x = minX + frac(cellId, attempt * 4) * (maxX - minX);
    const y = minY + frac(cellId, attempt * 4 + 1) * (maxY - minY);
    if (!pointInPolygon(x, y, poly)) continue;
    out.push({ x, y, band, s, snowTip });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Glyph geometry — compact SVG path per band (Path2D-compatible: M/L/a/Z)
// ---------------------------------------------------------------------------

/** Format a coordinate: round to 2 decimals, normalize -0. */
function f(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(r === 0 ? 0 : r);
}

/**
 * The snow-cap sub-path ONLY: a tiny detached inner ∧ near a peak's apex,
 * anchored at the same (x, y) BASE and scaled by `s`. Split out (Task 9) so
 * the atlas renderers can stroke the cap WHITE while the peak body strokes in
 * the band ink — one geometry, two colors, no double-inking. `reliefGlyphPath`
 * appends exactly this string for snow-tipped peaks, so the two never diverge.
 */
export function reliefGlyphCapPath(x: number, y: number, s: number): string {
  return `M${f(x - 0.6 * s)} ${f(y - 2.2 * s)}L${f(x)} ${f(y - 2.8 * s)}L${f(x + 0.6 * s)} ${f(y - 2.2 * s)}`;
}

/**
 * Tiny SVG path for relief glyph, anchored at (x, y) = BASE of the glyph
 * (glyphs grow upward, i.e. toward negative y), scaled by `s`. The same
 * strings drive canvas rendering via `new Path2D(d)`.
 *
 * Peak: two-stroke ▲ (open, not closed). When snowTip, append a detached
 * tiny inner ∧ cap just below the apex (see `reliefGlyphCapPath`).
 * Hill: single soft chevron arc (shallow, half-ellipse).
 */
export function reliefGlyphPath(
  band: ReliefBand,
  x: number,
  y: number,
  s: number,
  snowTip: boolean,
): string {
  if (band === 'peak') {
    // Two-stroke peak: left edge, apex, right edge (open ∧).
    let path = `M${f(x - 1.4 * s)} ${f(y)}L${f(x)} ${f(y - 3.2 * s)}L${f(x + 1.4 * s)} ${f(y)}`;
    // Snow-cap: tiny detached inner ∧ near the apex when h >= 80.
    if (snowTip) {
      path += reliefGlyphCapPath(x, y, s);
    }
    return path;
  } else {
    // Hill: single soft arc (low bump). M to left, a to right.
    return `M${f(x - 1.6 * s)} ${f(y)}a${f(1.6 * s)} ${f(1.1 * s)} 0 0 1 ${f(3.2 * s)} 0`;
  }
}

// ---------------------------------------------------------------------------
// Glyph ink color
// ---------------------------------------------------------------------------

/**
 * Ink tint for a relief band. Peak carets are dark ink; hill chevrons are softer grey.
 * Snow caps are stroked white by the RENDERER (Task 9), not here.
 */
export function reliefInk(band: ReliefBand): string {
  return band === 'peak' ? '#3d3833' : '#5a5248';
}
