// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 04/08/2026, 02:05:27
 * Dependents: components/World3D/canopyInterior.ts, components/Worldforge/AtlasSvgView.tsx, components/Worldforge/atlasSvg.ts, components/Worldforge/forestGlyphs.ts, systems/worldforge/forests/clumpField.ts, systems/worldforge/forests/forestClusters.ts, systems/worldforge/forests/forestsPass.ts, systems/worldforge/local/generateLocal.ts, systems/worldforge/travel/atlasTravelGraph.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file forestTunables.ts — every gameplay-feel constant for the forest system.
 *
 * ALL numbers here are TUNABLE starting values (spec 2026-07-11-forests-design).
 * One module on purpose: Remy tunes forest feel here without hunting through
 * the clustering, naming, map renderers, and 3D atmosphere code that consume
 * these.
 */
import type { ForestKind } from './forestClusters';

// ---------------------------------------------------------------------------
// Clustering + kind assignment
// ---------------------------------------------------------------------------

/** FMG biome indices that count as forest: 5 tropical seasonal forest,
 * 6 temperate deciduous forest, 7 tropical rainforest, 8 temperate rainforest,
 * 9 taiga. Contiguous runs of these cells become one named forest. */
export const FOREST_BIOME_IDS: Set<number> = new Set([5, 6, 7, 8, 9]);

/** Contiguous forest clusters below this cell count stay anonymous — copses,
 * not forests. They get no name, label, kind, or POIs. */
export const FOREST_MIN_CELLS = 4;

/** A cluster needs at least this many cells to qualify as its landmass's one
 * ancient forest (the biggest/oldest wood; rainforest-rich clusters preferred). */
export const ANCIENT_MIN_CELLS = 24;

/** Chance (out of 100) that a qualifying non-ancient cluster rolls haunted /
 * fey. A cluster only rolls at all when it has >= FOREST_MIN_CELLS * 2 cells;
 * smaller ones are plain ordinary. */
export const HAUNTED_PERCENT = 6;
export const FEY_PERCENT = 4;

/** Isolated clusters (isolation > 0.5, far from burgs) multiply their haunted
 * roll band by this — lonely woods gather dark stories. */
export const HAUNTED_ISOLATION_WEIGHT = 2;

// ---------------------------------------------------------------------------
// Naming — culture adjective + a word from the kind/flavor bank
// ---------------------------------------------------------------------------

/** Kind banks plus two biome-flavor banks the caller picks (taiga clusters
 * bias to Pinewood/Firwood, rainforest to Jungle/Tangle). */
export type ForestWordBankKey = ForestKind | 'taiga' | 'jungle';

export const FOREST_WORD_BANKS: Record<ForestWordBankKey, string[]> = {
  ordinary: ['Forest', 'Woods', 'Wood', 'Wildwood', 'Weald', 'Timberwood'],
  ancient: ['Elderwood', 'Oldgrowth', 'Ancientwood', 'Hoarwood'],
  haunted: ['Gloomwood', 'Hagwood', 'Murkwood', 'Shadowood', 'Wraithwood'],
  fey: ['Glimmerwood', 'Feywood', 'Shimmerwood', 'Brightwood'],
  taiga: ['Pinewood', 'Firwood', 'Taiga', 'Frostwood'],
  jungle: ['Jungle', 'Tangle', 'Greendeep', 'Vinewood'],
};

// ---------------------------------------------------------------------------
// POIs + navigation
// ---------------------------------------------------------------------------

/** One forest POI (hunter camp / hermit hollow / shrine / den) per roughly
 * 40 forest cells — minimum 1 for clusters >= FOREST_MIN_CELLS * 2. Retuned
 * 10 -> 40 (controller ruling 2026-07-11: the old density read as marker
 * spam on large worlds, not enrichment). */
export const FOREST_POI_PER_CELLS = 40;

/** Hard cap per forest — even the largest elderwood gets at most this many
 * POIs, so vast woods keep reading as wilderness, not a bazaar. */
export const FOREST_POI_MAX_PER_FOREST = 5;

/** Marker icon per POI type (the FMG marker `icon` field). */
export const FOREST_POI_ICONS: Record<string, string> = {
  'hunter-camp': '🏕️',
  'hermit-hollow': '🛖',
  'forest-shrine': '⛩️',
  'beast-den': '🐾',
};

/** POI type weights, expanded into a pick pool in DECLARATION ORDER (the FMG
 * biomes parsedIcons idiom: push each type `weight` times, pick uniformly).
 * Row order is part of the seed contract — reordering rows reshuffles which
 * type each pinned-seed draw lands on even when the weights stay the same. */
export const FOREST_POI_WEIGHTS: ReadonlyArray<readonly [string, number]> = [
  ['hunter-camp', 4],
  ['forest-shrine', 3],
  ['hermit-hollow', 2],
  ['beast-den', 3],
];

/** In haunted forests beast-den's weight doubles — the dark woods are fed. */
export const HAUNTED_BEAST_DEN_WEIGHT = 6;

/** Haunted and fey forests raise the getting-lost DC ladder by this much —
 * they actively mislead travelers. */
export const FOREST_NAV_DC_BUMP = 2;

// ---------------------------------------------------------------------------
// 2D map: forest labels (italic, sized by cluster area)
// ---------------------------------------------------------------------------

/** Label font size lerps MIN -> MAX as the cluster grows from FOREST_MIN_CELLS
 * to FOREST_LABEL_FULL_SIZE_CELLS (screen px, matching LABEL_FONT's scale).
 * LIVE since the 2026-07-11 rulings: atlasSvg's buildLabels applies the lerp
 * per forest label. */
export const FOREST_LABEL_FONT_MIN = 9;
export const FOREST_LABEL_FONT_MAX = 16;
export const FOREST_LABEL_FULL_SIZE_CELLS = 80;

/** Declutter priority — BELOW state (0), capital (1), and town (2), so forest
 * names never crowd civilization off the map. */
export const FOREST_LABEL_PRIORITY = 3;

/** Zoom (view.k) below which forest labels hide entirely — between capitals
 * (1.2) and towns (2.0), so woods name themselves as you lean in but never
 * clutter the far overview. Declutter's `forestMinScale` option defaults to
 * this. */
export const FOREST_LABEL_MIN_ZOOM = 1.5;

/** Forest label ink: muted green fill, distinct from the state purple and burg
 * near-black, with a dark outline (labels sit ON green forest fill, where the
 * white halo other labels use would glare). */
export const FOREST_LABEL_COLOR = '#3f6d4a';
export const FOREST_LABEL_OUTLINE = '#152a1c';

// ---------------------------------------------------------------------------
// 2D map: tree glyph stamps (lights up the dead FMG icons/iconsDensity data)
// ---------------------------------------------------------------------------

/** Glyphs per cell = round(the biome's iconsDensity × this), capped at
 * GLYPH_MAX_PER_CELL. Density-only on purpose — cell area does NOT enter, so
 * every cell of a biome carries the same glyph count regardless of its size
 * (FMG iconsDensity runs 0–250; 120 × 1/45 ≈ 3 stamps for deciduous forest). */
export const GLYPH_DENSITY_SCALE = 1 / 45;
export const GLYPH_MAX_PER_CELL = 6;

/** Zoom ramp: glyphs are hidden below MIN zoom (map stays clean when far
 * out), then thin in until full density at FULL zoom and beyond. */
export const GLYPH_MIN_ZOOM = 0.8;
export const GLYPH_FULL_ZOOM = 2.5;

/** Kind tints for glyphs/fill — subtle, readable side by side, never garish:
 * ancient slightly deeper green, haunted desaturated + cooler, fey slightly
 * luminous. Ordinary forests keep the plain biome color (no entry). */
export const FOREST_TINTS: Record<Exclude<ForestKind, 'ordinary'>, string> = {
  ancient: '#1d6b38',
  haunted: '#4a5a4e',
  fey: '#37b06f',
};

// ---------------------------------------------------------------------------
// 3D deep forest: thickets, clearings, undergrowth, canopy atmosphere
// ---------------------------------------------------------------------------

/** Clearing-noise seed salt and frequency (cycles per kilofoot) for vegetation
 * placement. Grass uses the same noise PRIMITIVE with different salts and
 * frequencies, so tree clearings and grass gaps do NOT visually align yet —
 * see the forests spec's Open list.
 *
 * These two are now the MIDDLE octave of the three-octave clump field in
 * clumpField.ts, which is what keeps the ~333 ft clearing structure this pass
 * tuned. There is no longer a hard threshold: a boolean cutoff draws a visible
 * contour through the forest, so acceptance is a continuous probability
 * instead (see CLUMP_ACCEPT_BASE below). */
export const CLEARING_SALT = 7031;
export const CLEARING_FREQ = 3;

/** The other two octaves of the clump field, in cycles per kilofoot: stands
 * and clearings at ~1000 ft, knots at ~125 ft. One octave gives an even
 * sprinkle with soft variation; three multiplied give a heavy-tailed field
 * with solid knots and genuinely open floor between them. */
export const CLUMP_STAND_FREQ = 1;
export const CLUMP_KNOT_FREQ = 8;

/** How much the two finer octaves are allowed to modulate the stand octave,
 * as [floor, range]. Neither reaches zero on its own — only the stand octave
 * can empty the ground — or the field punches pinholes everywhere and the
 * clearings stop reading as places. */
export const CLUMP_MID_MIX: readonly [number, number] = [0.30, 0.70];
export const CLUMP_KNOT_MIX: readonly [number, number] = [0.55, 0.45];

/** Acceptance probability = BASE + GAIN × clump^POW.
 *
 * Tuned against the rendered scatter, not by eye on the numbers. The first
 * pass used a square and a gain of 10, and it measured fine — the clearings
 * really were emptier — while the picture still read as an even speckle. The
 * reason is CONTRAST between the middle quartiles rather than between the
 * extremes: at those values acceptance ran 0.60 in the field's lower quartile
 * and saturated in its upper, a spread of only 1.7x, and the eye cannot see a
 * 1.7x density step through a canopy. Cubing and dropping the base widens that
 * spread to about 4x, which is where the thickets start reading as thickets.
 *
 * The cost is a lower expectation, which is why the clumped attempt budget in
 * generateLocal is doubled. Raising GAIN or lowering POW walks the whole thing
 * back toward the even scatter this replaced. */
export const CLUMP_ACCEPT_BASE = 0.02;
export const CLUMP_ACCEPT_GAIN = 12;
export const CLUMP_ACCEPT_POW = 3;

/** Clump value at which a candidate counts as fully inside a thicket. Feeds
 * the per-feature `dens` that sizes plants — biggest in the middle, seedlings
 * around the outside. Sits near the field's 75th percentile so a useful
 * fraction of the ground reaches it. */
export const CLUMP_DENS_FULL = 0.34;

/** Fraction of the minimum-separation radius given back at full `dens`. A
 * fixed spacing rule caps how tight a thicket can get no matter what the
 * density field says; relaxing it toward a clump's middle is what lets a knot
 * close over. Only ever shrinks the radius. */
export const CLUMP_SEP_RELIEF = 0.5;

/** Undergrowth: scrub-species instance density multiplier under dense canopy
 * (relative to the biome's normal scrub density). */
export const UNDERGROWTH_MULT = 2.5;

/**
 * Understory densities, as multipliers on the biome's existing bush and tree
 * density (2026-08-04). Multipliers rather than absolutes so a sparse
 * grassland stays sparse: a fixed fern count would carpet a savannah.
 *
 * Ferns outnumber everything. That is not a stylistic choice — ground cover
 * genuinely is the most numerous thing on a forest floor, and a handful of
 * ferns per acre reads as someone having placed a few ferns.
 *
 * Logs are the opposite: rare, but each one does more work for believability
 * than any other object down here, because a fallen tree is evidence that the
 * wood has a history. Their min-separation is set high in generateLocal for
 * the same reason — two crossing logs read as a dam.
 */
/*
 * Retuned once the shapes were fixed (2026-08-05). Both moves are consequences
 * of the geometry pass, not second thoughts about how a wood is populated.
 *
 * Ferns came down because each one now costs 341 triangles instead of 159 and
 * covers a meter of ground standing 0.6 m tall instead of lying 0.23 m flat.
 * At 4.5 the floor was carrying that in one instanced draw for no gain: the
 * plants were already overlapping into a mat, and a mat is a texture, not
 * ground cover. Fewer, larger, legible ferns is the same coverage read better
 * and about a fifth off the triangle bill.
 *
 * Logs went UP because the old ones were half the length they were meant to
 * be — the unit-frame bug fixed in understoryMeshSource — so the density that
 * looked correct was tuned against a 2 m branch. Against the 4.2 m deadfall
 * they were always supposed to be, 0.22 leaves a wood with almost no
 * evidence of its own history in it.
 */
export const FERN_MULT = 3.6;
export const SAPLING_MULT = 1.6;
export const LOG_MULT = 0.3;

/** Canopy interior: ambient light multiplier while the player's cell has
 * canopyShade — the woods close over you. */
export const CANOPY_LIGHT_MUL = 0.65;

/** Canopy fog draw-in [near, far] distances in METERS (the three.js scene fog
 * scale — the open-ground baseline is [450, 2000] m) per the biome's fog grade
 * while inside dense forest. Haunted forests push one step heavier. */
export const CANOPY_FOG: Record<'light' | 'medium' | 'heavy', [number, number]> = {
  light: [300, 1400],
  medium: [220, 1000],
  heavy: [150, 700],
};

/** Fey forests dim less than plain canopy (their light is strange, not dark);
 * the renderer tints it faintly instead. */
export const FEY_LIGHT_MUL = 0.75;
