/**
 * @file forestTunables.ts — every gameplay-feel constant for the forest system.
 *
 * ALL numbers here are TUNABLE starting values (spec 2026-07-11-forests-design).
 * One module on purpose: Remy tunes forest feel here without hunting through
 * the clustering, naming, map renderers, and 3D atmosphere code that consume
 * these.
 */
import type { ForestKind } from './forestClusters';
/** FMG biome indices that count as forest: 5 tropical seasonal forest,
 * 6 temperate deciduous forest, 7 tropical rainforest, 8 temperate rainforest,
 * 9 taiga. Contiguous runs of these cells become one named forest. */
export declare const FOREST_BIOME_IDS: Set<number>;
/** Contiguous forest clusters below this cell count stay anonymous — copses,
 * not forests. They get no name, label, kind, or POIs. */
export declare const FOREST_MIN_CELLS = 4;
/** A cluster needs at least this many cells to qualify as its landmass's one
 * ancient forest (the biggest/oldest wood; rainforest-rich clusters preferred). */
export declare const ANCIENT_MIN_CELLS = 24;
/** Chance (out of 100) that a qualifying non-ancient cluster rolls haunted /
 * fey. A cluster only rolls at all when it has >= FOREST_MIN_CELLS * 2 cells;
 * smaller ones are plain ordinary. */
export declare const HAUNTED_PERCENT = 6;
export declare const FEY_PERCENT = 4;
/** Isolated clusters (isolation > 0.5, far from burgs) multiply their haunted
 * roll band by this — lonely woods gather dark stories. */
export declare const HAUNTED_ISOLATION_WEIGHT = 2;
/** Kind banks plus two biome-flavor banks the caller picks (taiga clusters
 * bias to Pinewood/Firwood, rainforest to Jungle/Tangle). */
export type ForestWordBankKey = ForestKind | 'taiga' | 'jungle';
export declare const FOREST_WORD_BANKS: Record<ForestWordBankKey, string[]>;
/** One forest POI (hunter camp / hermit hollow / shrine / den) per roughly
 * 40 forest cells — minimum 1 for clusters >= FOREST_MIN_CELLS * 2. Retuned
 * 10 -> 40 (controller ruling 2026-07-11: the old density read as marker
 * spam on large worlds, not enrichment). */
export declare const FOREST_POI_PER_CELLS = 40;
/** Hard cap per forest — even the largest elderwood gets at most this many
 * POIs, so vast woods keep reading as wilderness, not a bazaar. */
export declare const FOREST_POI_MAX_PER_FOREST = 5;
/** Marker icon per POI type (the FMG marker `icon` field). */
export declare const FOREST_POI_ICONS: Record<string, string>;
/** POI type weights, expanded into a pick pool in DECLARATION ORDER (the FMG
 * biomes parsedIcons idiom: push each type `weight` times, pick uniformly).
 * Row order is part of the seed contract — reordering rows reshuffles which
 * type each pinned-seed draw lands on even when the weights stay the same. */
export declare const FOREST_POI_WEIGHTS: ReadonlyArray<readonly [string, number]>;
/** In haunted forests beast-den's weight doubles — the dark woods are fed. */
export declare const HAUNTED_BEAST_DEN_WEIGHT = 6;
/** Haunted and fey forests raise the getting-lost DC ladder by this much —
 * they actively mislead travelers. */
export declare const FOREST_NAV_DC_BUMP = 2;
/** Label font size lerps MIN -> MAX as the cluster grows from FOREST_MIN_CELLS
 * to FOREST_LABEL_FULL_SIZE_CELLS (screen px, matching LABEL_FONT's scale).
 * LIVE since the 2026-07-11 rulings: atlasSvg's buildLabels applies the lerp
 * per forest label. */
export declare const FOREST_LABEL_FONT_MIN = 9;
export declare const FOREST_LABEL_FONT_MAX = 16;
export declare const FOREST_LABEL_FULL_SIZE_CELLS = 80;
/** Declutter priority — BELOW state (0), capital (1), and town (2), so forest
 * names never crowd civilization off the map. */
export declare const FOREST_LABEL_PRIORITY = 3;
/** Zoom (view.k) below which forest labels hide entirely — between capitals
 * (1.2) and towns (2.0), so woods name themselves as you lean in but never
 * clutter the far overview. Declutter's `forestMinScale` option defaults to
 * this. */
export declare const FOREST_LABEL_MIN_ZOOM = 1.5;
/** Forest label ink: muted green fill, distinct from the state purple and burg
 * near-black, with a dark outline (labels sit ON green forest fill, where the
 * white halo other labels use would glare). */
export declare const FOREST_LABEL_COLOR = "#3f6d4a";
export declare const FOREST_LABEL_OUTLINE = "#152a1c";
/** Glyphs per cell = round(the biome's iconsDensity × this), capped at
 * GLYPH_MAX_PER_CELL. Density-only on purpose — cell area does NOT enter, so
 * every cell of a biome carries the same glyph count regardless of its size
 * (FMG iconsDensity runs 0–250; 120 × 1/45 ≈ 3 stamps for deciduous forest). */
export declare const GLYPH_DENSITY_SCALE: number;
export declare const GLYPH_MAX_PER_CELL = 6;
/** Zoom ramp: glyphs are hidden below MIN zoom (map stays clean when far
 * out), then thin in until full density at FULL zoom and beyond. */
export declare const GLYPH_MIN_ZOOM = 0.8;
export declare const GLYPH_FULL_ZOOM = 2.5;
/** Kind tints for glyphs/fill — subtle, readable side by side, never garish:
 * ancient slightly deeper green, haunted desaturated + cooler, fey slightly
 * luminous. Ordinary forests keep the plain biome color (no entry). */
export declare const FOREST_TINTS: Record<Exclude<ForestKind, 'ordinary'>, string>;
/** Two-octave clearing-noise gate for TREE placement (grass uses the same
 * noise PRIMITIVE with different salts/frequencies, so tree clearings and
 * grass gaps do NOT visually align yet — see the forests spec's Open list):
 * seed salt, noise frequency (cycles per kilofoot), and the gate threshold
 * (noise below it = clearing, no trees). */
export declare const CLEARING_SALT = 7031;
export declare const CLEARING_FREQ = 3;
export declare const CLEARING_THRESHOLD = 0.35;
/** Undergrowth: scrub-species instance density multiplier under dense canopy
 * (relative to the biome's normal scrub density). */
export declare const UNDERGROWTH_MULT = 2.5;
/** Canopy interior: ambient light multiplier while the player's cell has
 * canopyShade — the woods close over you. */
export declare const CANOPY_LIGHT_MUL = 0.65;
/** Canopy fog draw-in [near, far] distances in METERS (the three.js scene fog
 * scale — the open-ground baseline is [450, 2000] m) per the biome's fog grade
 * while inside dense forest. Haunted forests push one step heavier. */
export declare const CANOPY_FOG: Record<'light' | 'medium' | 'heavy', [number, number]>;
/** Fey forests dim less than plain canopy (their light is strange, not dark);
 * the renderer tints it faintly instead. */
export declare const FEY_LIGHT_MUL = 0.75;
