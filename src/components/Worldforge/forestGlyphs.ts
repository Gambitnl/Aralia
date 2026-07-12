/**
 * @file forestGlyphs.ts — ONE tree-glyph language for the 2D atlas.
 *
 * Lights up FMG's until-now-dead icon tables (`biomesData.iconsDensity` +
 * `biomesData.icons`): each cell stamps a few tiny hand-drawn-style glyphs
 * (deciduous, conifer, palm, swamp tufts, ...) picked from its biome's
 * weighted vocabulary. Both renderers (canvas atlasDraw and SVG AtlasLayers)
 * read this module, so the map cannot show two different tree languages —
 * the same cross-boundary pattern routeMapStyle.ts uses toward routeTerrain:
 * lives in components/, stays React-free, imports only forests/ tunables +
 * types.
 *
 * Determinism: NO SeededRandom stream (glyphs are decoration and must never
 * disturb worldgen RNG draws). Every random-looking choice is an integer hash
 * of (cellId, salt) using Knuth's multiplicative constant 2654435761
 * (= floor(2^32 / golden ratio)) via `Math.imul`, so identical inputs always
 * produce identical glyph layouts — pure function of cellId + poly + tables.
 */
import type { ForestKind } from '../../systems/worldforge/forests/forestClusters';
import {
  FOREST_TINTS,
  GLYPH_DENSITY_SCALE,
  GLYPH_MAX_PER_CELL,
} from '../../systems/worldforge/forests/forestTunables';

/** The FMG icon vocabulary (every name that appears in biomes.ts `icons`). */
const GLYPH_KINDS = [
  'deciduous',
  'conifer',
  'acacia',
  'palm',
  'swamp',
  'dune',
  'cactus',
  'deadTree',
  'grass',
] as const;

export type GlyphKind = (typeof GLYPH_KINDS)[number];

const GLYPH_KIND_SET: ReadonlySet<string> = new Set(GLYPH_KINDS);

function isGlyphKind(name: string): name is GlyphKind {
  return GLYPH_KIND_SET.has(name);
}

/** One stamped glyph: position (map space), kind, and size multiplier. */
export interface CellGlyph {
  x: number;
  y: number;
  g: GlyphKind;
  s: number;
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
 * Deterministic glyph stamps for one cell.
 *
 * Count = `min(GLYPH_MAX_PER_CELL, round(iconsDensity[biomeIndex] *
 * GLYPH_DENSITY_SCALE))`. Positions are hashed fractions over the polygon's
 * bbox, rejection-tested inside the polygon; at most `count * 8` attempts,
 * so a cell whose polygon rejects everything simply returns fewer glyphs.
 * Glyph name comes from the biome's weighted-expanded `icons` list picked by
 * hash; size is 1.0 jittered ±20% by hash.
 *
 * `_kind` (the cell's forest-cluster kind) is accepted so both renderers can
 * pass it alongside — reserved for kind-flavored glyph biasing later. Today
 * it does NOT affect output (output is a pure function of cellId + poly +
 * tables); kind only affects color, via {@link forestTint}.
 */
export function cellGlyphs(
  cellId: number,
  poly: Array<[number, number]>,
  biomeIndex: number,
  biomesData: { iconsDensity: ArrayLike<number>; icons: string[][] },
  _kind: ForestKind | null,
): CellGlyph[] {
  const density = biomesData.iconsDensity[biomeIndex] ?? 0;
  const count = Math.min(GLYPH_MAX_PER_CELL, Math.round(density * GLYPH_DENSITY_SCALE));
  if (count <= 0 || poly.length < 3) return [];

  const names = (biomesData.icons[biomeIndex] ?? []).filter(isGlyphKind);
  if (names.length === 0) return [];

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

  const out: CellGlyph[] = [];
  const maxAttempts = count * 8;
  // Four hash lanes per attempt (x, y, glyph pick, size) — lane salts never
  // collide across attempts because no lane uses attempt * 4 + 4.
  for (let attempt = 0; attempt < maxAttempts && out.length < count; attempt++) {
    const x = minX + frac(cellId, attempt * 4) * (maxX - minX);
    const y = minY + frac(cellId, attempt * 4 + 1) * (maxY - minY);
    if (!pointInPolygon(x, y, poly)) continue;
    const g = names[mix(cellId, attempt * 4 + 2) % names.length];
    const s = 1 + (frac(cellId, attempt * 4 + 3) * 2 - 1) * 0.2;
    out.push({ x, y, g, s });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Glyph geometry — compact SVG path per kind (Path2D-compatible: M/L/a/Z)
// ---------------------------------------------------------------------------

/** Format a coordinate: round to 2 decimals, normalize -0. */
function f(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(r === 0 ? 0 : r);
}

/**
 * Tiny SVG path for glyph `g`, anchored at (x, y) = BASE of the glyph
 * (glyphs grow upward, i.e. toward negative y), scaled by `s`. The same
 * strings drive canvas rendering via `new Path2D(d)`.
 */
export function glyphPath(g: GlyphKind, x: number, y: number, s: number): string {
  switch (g) {
    case 'deciduous':
      // Stem line + circle canopy (two arcs).
      return (
        `M${f(x)} ${f(y)}L${f(x)} ${f(y - 1.8 * s)}` +
        `M${f(x - 1.2 * s)} ${f(y - 2.6 * s)}` +
        `a${f(1.2 * s)} ${f(1.2 * s)} 0 1 0 ${f(2.4 * s)} 0` +
        `a${f(1.2 * s)} ${f(1.2 * s)} 0 1 0 ${f(-2.4 * s)} 0`
      );
    case 'conifer':
      // Stem + triangle.
      return (
        `M${f(x)} ${f(y)}L${f(x)} ${f(y - 0.9 * s)}` +
        `M${f(x - 1.1 * s)} ${f(y - 0.9 * s)}L${f(x)} ${f(y - 3.2 * s)}` +
        `L${f(x + 1.1 * s)} ${f(y - 0.9 * s)}Z`
      );
    case 'acacia':
      // Stem + flat-top canopy arc (closed flat along the bottom).
      return (
        `M${f(x)} ${f(y)}L${f(x)} ${f(y - 1.9 * s)}` +
        `M${f(x - 1.7 * s)} ${f(y - 1.9 * s)}` +
        `a${f(1.7 * s)} ${f(1 * s)} 0 0 1 ${f(3.4 * s)} 0Z`
      );
    case 'palm':
      // Stem + two crossing frond arcs.
      return (
        `M${f(x)} ${f(y)}L${f(x)} ${f(y - 2.2 * s)}` +
        `M${f(x - 1.7 * s)} ${f(y - 1.6 * s)}` +
        `a${f(1.9 * s)} ${f(1.9 * s)} 0 0 1 ${f(3.2 * s)} ${f(-1.1 * s)}` +
        `M${f(x + 1.7 * s)} ${f(y - 1.6 * s)}` +
        `a${f(1.9 * s)} ${f(1.9 * s)} 0 0 0 ${f(-3.2 * s)} ${f(-1.1 * s)}`
      );
    case 'swamp':
      // Three short vertical reed strokes.
      return (
        `M${f(x - s)} ${f(y)}L${f(x - s)} ${f(y - 1.1 * s)}` +
        `M${f(x)} ${f(y)}L${f(x)} ${f(y - 1.7 * s)}` +
        `M${f(x + s)} ${f(y)}L${f(x + s)} ${f(y - 1.1 * s)}`
      );
    case 'grass':
      // Two angled blade strokes.
      return (
        `M${f(x)} ${f(y)}L${f(x - 0.8 * s)} ${f(y - 1.5 * s)}` +
        `M${f(x)} ${f(y)}L${f(x + 0.7 * s)} ${f(y - 1.3 * s)}`
      );
    case 'dune':
      // One low arc (half ellipse, shallow).
      return `M${f(x - 2 * s)} ${f(y)}a${f(2 * s)} ${f(0.9 * s)} 0 0 1 ${f(4 * s)} 0`;
    case 'cactus':
      // Vertical bar + one L-shaped arm.
      return (
        `M${f(x)} ${f(y)}L${f(x)} ${f(y - 2.3 * s)}` +
        `M${f(x)} ${f(y - 1.3 * s)}L${f(x + 0.9 * s)} ${f(y - 1.3 * s)}` +
        `L${f(x + 0.9 * s)} ${f(y - 2 * s)}`
      );
    case 'deadTree':
      // Bare Y — trunk to fork, two dead branches.
      return (
        `M${f(x)} ${f(y)}L${f(x)} ${f(y - 1.3 * s)}L${f(x - 0.9 * s)} ${f(y - 2.5 * s)}` +
        `M${f(x)} ${f(y - 1.3 * s)}L${f(x + 0.8 * s)} ${f(y - 2.3 * s)}`
      );
  }
}

// ---------------------------------------------------------------------------
// Kind tint
// ---------------------------------------------------------------------------

/**
 * Glyph/fill tint for a forest kind. Ordinary forests (and non-forest cells)
 * return null — keep the plain biome color.
 */
export function forestTint(kind: ForestKind | null): string | null {
  if (kind === null || kind === 'ordinary') return null;
  return FOREST_TINTS[kind];
}
