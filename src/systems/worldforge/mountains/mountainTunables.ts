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

// ---------------------------------------------------------------------------
// Clustering — ranges, cores, peaks
// ---------------------------------------------------------------------------

/** Encoded pack height (0–100 scale, land >= 20) at or above which a cell is
 * highland enough to join a range — the line hills already use in the port. */
export const RANGE_MIN_H = 50;

/** Contiguous highland clusters below this cell count stay anonymous hills —
 * no name, label, kind, or peaks. */
export const RANGE_MIN_CELLS = 5;

/** Core-mountain line: cluster cells at/above this are coreCells and peak
 * candidates — the de-facto h >= 70 mountain threshold volcanoes and sacred
 * mountains already use. */
export const PEAK_MIN_H = 70;

/** Named-peak cap per range (highest kept) — labels stay landmarks, not noise. */
export const PEAKS_PER_RANGE_MAX = 4;

// ---------------------------------------------------------------------------
// Naming — culture adjective + kind bank / peak form / pass word
// ---------------------------------------------------------------------------

/** Range word banks by kind: "<CultureAdjective> <BankWord>" (Elden Spine).
 * Volcanic ranges smoulder, highlands roll, true ranges loom. */
export const RANGE_WORD_BANKS: Record<RangeKind, string[]> = {
  range: ['Spine', 'Reach', 'Range', 'Heights', 'Teeth', 'Crags', 'Wall'],
  highlands: ['Downs', 'Highlands', 'Moors', 'Fells'],
  volcanic: ['Furnace', 'Anvil', 'Ashreach', 'Cinderwall'],
};

/** Peak name FORMS over the culture adjective — the rng picks the form, then
 * '{a}' is replaced with the adjective ("Mount Elden", "Elden Horn"). */
export const PEAK_NAME_FORMS: string[] = [
  'Mount {a}', '{a} Peak', '{a} Horn', '{a} Tor', '{a} Fang',
];

/** Pass words: "<stem> <word>" (Elden Horn Col). Exported raw so pass naming
 * can also index deterministically without rng: PASS_WORDS[cellId % length]. */
export const PASS_WORDS: string[] = ['Pass', 'Gap', 'Col', 'Saddle'];

// ---------------------------------------------------------------------------
// Travel — climb cost + high-country navigation
// ---------------------------------------------------------------------------

/** Off-route cells at 50 <= h < 70 add this to the open-terrain nav DC —
 * trackless high country misleads even when it is not a crag face. */
export const HIGHLAND_NAV_DC_BUMP = 3;

/** Climb speed divisor grows by this per encoded-h point ASCENDED across an
 * edge (an h+10 climb ~= x0.67 speed off-road) — ascents slow, passes matter. */
export const CLIMB_ASCENT_PER_H = 0.05;

/** Descending costs too (scree, braking), but far less than climbing. */
export const CLIMB_DESCENT_PER_H = 0.015;

/** Per-tier multiplier on the delta-h penalty: engineered grades halve it on
 * maintained tiers, trails soften a quarter, bare paths feel the full slope. */
export const CLIMB_TIER_SOFTEN: Record<RouteTier, number> = {
  highway: 0.5, road: 0.5, trail: 0.75, path: 1,
};

// ---------------------------------------------------------------------------
// Trip events — one roll per committed trip (Remy ruling 2026-07-11)
// ---------------------------------------------------------------------------

/** Chance the single per-trip event roll fires at all. */
export const TRIP_EVENT_CHANCE = 0.25;

/** Ordered drama priority for picking the trip's governing legacy biome id:
 * the FIRST id in this list that the route crosses wins; if none match, the
 * route's most-crossed non-plain id governs; else the 'general' pool. */
export const TRIP_EVENT_DRAMA: string[] = [
  'mountain_crag', 'mountain_alpine', 'mountain_glacier',
  'forest_haunted', 'forest_fey', 'highland_vale',
  'wetland_marsh', 'desert_dune',
];

// ---------------------------------------------------------------------------
// 3D high country — elevation curve, ridges, snow, tree line
// ---------------------------------------------------------------------------

/** Top of the piecewise elevation curve at normalized height n = 1 — replaces
 * the flat n x 2000 mapping that squashed all relief under ~610 m. */
export const MOUNTAIN_MAX_ELEV_FT = 7000;

/** Window base-n above which ridged noise ramps in — lowland windows keep
 * their rolling look, mountain windows grow real peaks. */
export const RIDGE_START_N = 0.55;

/** Ridged-noise amplitude share at full ramp — how jagged the high country reads. */
export const RIDGE_AMPLITUDE = 0.25;

/** Vertical span (ft) the ridged component can add at full ramp. */
export const RIDGE_SPAN_FT = 2500;

/** Temperature class for the tree line — resolved per biome by treelineClassOf. */
export type TreelineClass = 'cold' | 'temperate' | 'none';

/** Window-normalized elevation above which trees stop, per class — cold
 * biomes lose trees sooner; 'none' sits above the domain (no tree line). */
export const TREELINE_N: Record<TreelineClass, number> = {
  cold: 0.55, temperate: 0.62, none: 1.1,
};

/** Cold-class biomes (FMG indices): 9 Taiga, 10 Tundra, 11 Glacier. */
export const TREELINE_COLD_BIOMES: Set<number> = new Set([9, 10, 11]);

/** Tropical biomes carry no alpine tree line: 1 Hot desert, 3 Savanna,
 * 5 Tropical seasonal forest, 7 Tropical rainforest. */
export const TREELINE_TROPICAL_BIOMES: Set<number> = new Set([1, 3, 5, 7]);

/** Biome index -> tree-line class: taiga/tundra/glacier cold; tropical none;
 * everything else temperate. */
export function treelineClassOf(biomeId: number): TreelineClass {
  if (TREELINE_COLD_BIOMES.has(biomeId)) return 'cold';
  if (TREELINE_TROPICAL_BIOMES.has(biomeId)) return 'none';
  return 'temperate';
}

/** Encoded-height units where snow blending starts (falls with latitude band
 * in the renderer — this is the temperate baseline). */
export const SNOW_LINE_H = 55;

/** Snow-cap blend target color (linear RGB 0–1) — near-white with a cool cast. */
export const SNOW_RGB: [number, number, number] = [0.92, 0.93, 0.95];

/** Glacier ice material color (linear RGB 0–1) — bluer than snow, kills the
 * brown-glacier bug. */
export const ICE_RGB: [number, number, number] = [0.86, 0.9, 0.95];

// ---------------------------------------------------------------------------
// 2D map: mountain glyph stamps (peak carets + hill chevrons, both renderers)
// ---------------------------------------------------------------------------

/** Chevron band start: single soft hill stroke on cells 50 <= h < 70. */
export const GLYPH_HILL_MIN_H = 50;

/** Caret band: two-stroke ink peak on cells h >= 70. */
export const GLYPH_PEAK_MIN_H = 70;

/** Carets on cells at/above this gain the snow-gap tip. */
export const GLYPH_SNOW_TIP_MIN_H = 80;

/** Mountain glyphs per cell (1..max, scaled by h) — relief reads as marks,
 * not texture; far sparser than the forest stamp layer. */
export const MOUNTAIN_GLYPH_MAX_PER_CELL = 2;

/** Zoom ramp, same shape as forest glyphs so the two layers thin in together:
 * hidden below MIN, full density at FULL and beyond. */
export const MOUNTAIN_GLYPH_MIN_ZOOM = 0.8;
export const MOUNTAIN_GLYPH_FULL_ZOOM = 2.5;

// ---------------------------------------------------------------------------
// 2D map: range + peak labels
// ---------------------------------------------------------------------------

/** Range label font size lerps MIN -> MAX (screen px) as the cluster grows to
 * RANGE_LABEL_FULL_SIZE_CELLS — spaced small-caps, the forest-label lerp pattern. */
export const RANGE_LABEL_FONT_MIN = 10;
export const RANGE_LABEL_FONT_MAX = 18;
export const RANGE_LABEL_FULL_SIZE_CELLS = 60;

/** Extra tracking (em) for the spaced small-caps range style. */
export const RANGE_LABEL_LETTER_SPACING_EM = 0.15;

/** Declutter priority — ranges outrank woods: 3, with FOREST labels moving
 * 3 -> 4 (Task 3 edits atlasSvg's forest entry); both stay below towns (2). */
export const RANGE_LABEL_PRIORITY = 3;

/** Zoom (view.k) below which range labels hide — macro geography names itself
 * earlier than forests (1.5), alongside capitals (1.2). */
export const RANGE_LABEL_MIN_ZOOM = 1.2;

/** Range label ink: stony grey-brown with a dark outline (sits on rock-toned
 * fills where the white halo would glare). */
export const RANGE_LABEL_COLOR = '#5f564b';
export const RANGE_LABEL_OUTLINE = '#221d18';

/** Peak labels: tiny fixed size, high zoom only, lowest declutter rank —
 * "▲ Name" appears when leaning all the way in (towns show at 2.0). */
export const PEAK_LABEL_FONT = 8;
export const PEAK_LABEL_PRIORITY = 5;
export const PEAK_LABEL_MIN_ZOOM = 2.2;

/** Peak label ink — same family as range ink, a shade darker for the tiny size. */
export const PEAK_LABEL_COLOR = '#4f463c';
