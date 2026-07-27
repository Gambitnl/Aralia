/**
 * @file mountainTunables.ts — every gameplay-feel constant for the mountains system.
 *
 * ALL numbers here are TUNABLE starting values (spec 2026-07-11-mountains-design).
 * One module on purpose: Remy tunes mountain feel here without hunting through
 * the clustering, naming, travel mechanics, map renderers, and 3D high-country
 * code that consume these.
 */
import type { RangeKind } from './mountainClusters';
import type { RouteTier } from '../travel/routeTerrain';
/** Encoded pack height (0–100 scale, land >= 20) at or above which a cell is
 * highland enough to join a range — the line hills already use in the port. */
export declare const RANGE_MIN_H = 50;
/** Contiguous highland clusters below this cell count stay anonymous hills —
 * no name, label, kind, or peaks. */
export declare const RANGE_MIN_CELLS = 5;
/** Core-mountain line: cluster cells at/above this are coreCells and peak
 * candidates — the de-facto h >= 70 mountain threshold volcanoes and sacred
 * mountains already use. */
export declare const PEAK_MIN_H = 70;
/** Named-peak cap per range (highest kept) — labels stay landmarks, not noise. */
export declare const PEAKS_PER_RANGE_MAX = 4;
/** Range word banks by kind: "<CultureAdjective> <BankWord>" (Elden Spine).
 * Volcanic ranges smoulder, highlands roll, true ranges loom. */
export declare const RANGE_WORD_BANKS: Record<RangeKind, string[]>;
/** Peak name FORMS over the culture adjective — the rng picks the form, then
 * '{a}' is replaced with the adjective ("Mount Elden", "Elden Horn"). */
export declare const PEAK_NAME_FORMS: string[];
/** Pass words: "<stem> <word>" (Elden Horn Col). Exported raw so pass naming
 * can also index deterministically without rng: PASS_WORDS[cellId % length]. */
export declare const PASS_WORDS: string[];
/** Off-route cells at 50 <= h < 70 add this to the open-terrain nav DC —
 * trackless high country misleads even when it is not a crag face. */
export declare const HIGHLAND_NAV_DC_BUMP = 3;
/** Climb speed divisor grows by this per encoded-h point ASCENDED across an
 * edge (an h+10 climb ~= x0.67 speed off-road) — ascents slow, passes matter. */
export declare const CLIMB_ASCENT_PER_H = 0.05;
/** Descending costs too (scree, braking), but far less than climbing. */
export declare const CLIMB_DESCENT_PER_H = 0.015;
/** Per-tier multiplier on the delta-h penalty: engineered grades halve it on
 * maintained tiers, trails soften a quarter, bare paths feel the full slope. */
export declare const CLIMB_TIER_SOFTEN: Record<RouteTier, number>;
/** Chance the single per-trip event roll fires at all. */
export declare const TRIP_EVENT_CHANCE = 0.25;
/** Ordered drama priority for picking the trip's governing legacy biome id:
 * the FIRST id in this list that the route crosses wins; if none match, the
 * route's most-crossed non-plain id governs; else the 'general' pool. */
export declare const TRIP_EVENT_DRAMA: string[];
/** Top of the piecewise elevation curve at normalized height n = 1 — replaces
 * the flat n x 2000 mapping that squashed all relief under ~610 m. */
export declare const MOUNTAIN_MAX_ELEV_FT = 7000;
/** Window base-n above which ridged noise ramps in — lowland windows keep
 * their rolling look, mountain windows grow real peaks. */
export declare const RIDGE_START_N = 0.55;
/** Ridged-noise amplitude share at full ramp — how jagged the high country reads.
 * (2026-07-21 look pass: 0.25 → 0.12 — the old amplitude pushed most peak-window
 * samples past n = 1, clamping the high country into a needle-studded mesa.) */
export declare const RIDGE_AMPLITUDE = 0.12;
/** Vertical span (ft) the ridged component can add at full ramp. Doubles as the
 * crest wavelength of the ridged noise — 5,000 ft gives massif-scale crests
 * instead of the 2,500 ft spike field the first pass produced. */
export declare const RIDGE_SPAN_FT = 5000;
/** Temperature class for the tree line — resolved per biome by treelineClassOf. */
export type TreelineClass = 'cold' | 'temperate' | 'none';
/** Window-normalized elevation above which trees stop, per class — cold
 * biomes lose trees sooner; 'none' sits above the domain (no tree line). */
export declare const TREELINE_N: Record<TreelineClass, number>;
/** Cold-class biomes (FMG indices): 9 Taiga, 10 Tundra, 11 Glacier. */
export declare const TREELINE_COLD_BIOMES: Set<number>;
/** Tropical biomes carry no alpine tree line: 1 Hot desert, 3 Savanna,
 * 5 Tropical seasonal forest, 7 Tropical rainforest. */
export declare const TREELINE_TROPICAL_BIOMES: Set<number>;
/** Biome index -> tree-line class: taiga/tundra/glacier cold; tropical none;
 * everything else temperate. */
export declare function treelineClassOf(biomeId: number): TreelineClass;
/** Encoded-height units where snow blending starts (falls with latitude band
 * in the renderer — this is the temperate baseline, 25°..60° latitude). */
export declare const SNOW_LINE_H = 55;
/** Polar snow line (|latitude| > 60°): snow reaches far lower down. */
export declare const SNOW_LINE_POLAR = 35;
/** Tropical snow line (|latitude| < 25°): only the very highest ground whitens. */
export declare const SNOW_LINE_TROPICAL = 75;
/** Encoded-height span above the snow line over which the tint ramps from the
 * biome color to full SNOW_RGB (t = min(1, (h − snowLineH) / SNOW_BAND)). */
export declare const SNOW_BAND = 12;
/**
 * Latitude (degrees, +N/−S) of an atlas cell at graph-y `cellY`. Mirrors the
 * FMG climate convention exactly (climate.ts: `latN − (y/graphHeight)·latT`,
 * latT = latN − latS): the map's north edge (y = 0) sits at `latN`, the south
 * edge (y = graphHeight) at `latS`, linear between. Returns `null` when the
 * pack carries no map coordinates (crafted/atlas-only worlds) or the graph is
 * degenerate — the caller then falls back to the temperate snow line. Pure.
 */
export declare function latitudeAtGraphY(cellY: number, graphHeight: number, coords: {
    latN: number;
    latS: number;
} | null | undefined): number | null;
/**
 * Resolve the encoded-height snow line for a window from its anchor cell's
 * latitude, via a simple 3-band table (spec §5): polar caps snow low, the
 * tropics push it high, temperate latitudes keep the baseline. A `null`
 * latitude (no map coordinates) falls back to the temperate baseline. Pure.
 */
export declare function resolveSnowLine(anchorLatitudeDeg: number | null): number;
/** Temperate snow line (25°..60° latitude), absolute local-elevation feet. */
export declare const SNOW_LINE_FT_TEMPERATE = 4300;
/** Polar snow line (|latitude| > 60°): snow reaches far lower down. */
export declare const SNOW_LINE_FT_POLAR = 2200;
/** Tropical snow line (|latitude| < 25°): only the very highest ground whitens. */
export declare const SNOW_LINE_FT_TROPICAL = 6100;
/**
 * Resolve the ABSOLUTE snow line (local-elevation feet) for a window from its
 * anchor cell's latitude — the same 3-band table as `resolveSnowLine`, in the
 * elevation-curve domain. `null` latitude falls back to temperate. Pure.
 */
export declare function resolveSnowLineFt(anchorLatitudeDeg: number | null): number;
/** Snow-cap blend target color (linear RGB 0–1) — near-white with a cool cast. */
export declare const SNOW_RGB: [number, number, number];
/** Glacier ice material color (linear RGB 0–1) — bluer than snow, kills the
 * brown-glacier bug. */
export declare const ICE_RGB: [number, number, number];
/** Chevron band start: single soft hill stroke on cells 50 <= h < 70. */
export declare const GLYPH_HILL_MIN_H = 50;
/** Caret band: two-stroke ink peak on cells h >= 70. */
export declare const GLYPH_PEAK_MIN_H = 70;
/** Carets on cells at/above this gain the snow-gap tip. */
export declare const GLYPH_SNOW_TIP_MIN_H = 80;
/** Mountain glyphs per cell (1..max, scaled by h) — relief reads as marks,
 * not texture; far sparser than the forest stamp layer. */
export declare const MOUNTAIN_GLYPH_MAX_PER_CELL = 2;
/** Zoom ramp, same shape as forest glyphs so the two layers thin in together:
 * hidden below MIN, full density at FULL and beyond. */
export declare const MOUNTAIN_GLYPH_MIN_ZOOM = 0.8;
export declare const MOUNTAIN_GLYPH_FULL_ZOOM = 2.5;
/** Range label font size lerps MIN -> MAX (screen px) as the cluster grows to
 * RANGE_LABEL_FULL_SIZE_CELLS — spaced small-caps, the forest-label lerp pattern. */
export declare const RANGE_LABEL_FONT_MIN = 10;
export declare const RANGE_LABEL_FONT_MAX = 18;
export declare const RANGE_LABEL_FULL_SIZE_CELLS = 60;
/** Extra tracking (em) for the spaced small-caps range style. */
export declare const RANGE_LABEL_LETTER_SPACING_EM = 0.15;
/** Declutter priority — ranges outrank woods: 3, with FOREST labels moving
 * 3 -> 4 (Task 3 edits atlasSvg's forest entry); both stay below towns (2). */
export declare const RANGE_LABEL_PRIORITY = 3;
/** Zoom (view.k) below which range labels hide — macro geography names itself
 * earlier than forests (1.5), alongside capitals (1.2). */
export declare const RANGE_LABEL_MIN_ZOOM = 1.2;
/** Range label ink: stony grey-brown with a dark outline (sits on rock-toned
 * fills where the white halo would glare). */
export declare const RANGE_LABEL_COLOR = "#5f564b";
export declare const RANGE_LABEL_OUTLINE = "#221d18";
/** Peak labels: tiny fixed size, high zoom only, lowest declutter rank —
 * "▲ Name" appears when leaning all the way in (towns show at 2.0). */
export declare const PEAK_LABEL_FONT = 8;
export declare const PEAK_LABEL_PRIORITY = 5;
export declare const PEAK_LABEL_MIN_ZOOM = 2.2;
/** Peak label ink — same family as range ink, a shade darker for the tiny size. */
export declare const PEAK_LABEL_COLOR = "#4f463c";
