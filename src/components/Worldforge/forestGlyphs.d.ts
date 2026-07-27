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
/** The FMG icon vocabulary (every name that appears in biomes.ts `icons`). */
declare const GLYPH_KINDS: readonly ["deciduous", "conifer", "acacia", "palm", "swamp", "dune", "cactus", "deadTree", "grass"];
export type GlyphKind = (typeof GLYPH_KINDS)[number];
/** One stamped glyph: position (map space), kind, and size multiplier. */
export interface CellGlyph {
    x: number;
    y: number;
    g: GlyphKind;
    s: number;
}
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
export declare function cellGlyphs(cellId: number, poly: Array<[number, number]>, biomeIndex: number, biomesData: {
    iconsDensity: ArrayLike<number>;
    icons: string[][];
}, _kind: ForestKind | null): CellGlyph[];
/**
 * Tiny SVG path for glyph `g`, anchored at (x, y) = BASE of the glyph
 * (glyphs grow upward, i.e. toward negative y), scaled by `s`. The same
 * strings drive canvas rendering via `new Path2D(d)`.
 */
export declare function glyphPath(g: GlyphKind, x: number, y: number, s: number): string;
/**
 * Glyph/fill tint for a forest kind. Ordinary forests (and non-forest cells)
 * return null — keep the plain biome color.
 */
export declare function forestTint(kind: ForestKind | null): string | null;
export {};
