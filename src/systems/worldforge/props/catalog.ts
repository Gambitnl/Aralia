/**
 * @file catalog.ts — FULL prop catalog for the Beautification Wave.
 *
 * Source of truth: docs/superpowers/research/2026-07-03-prop-catalog-strawman.md
 * (all 16 context tables). Referee data is transcribed VERBATIM from the
 * strawman; this file is Remy-editable CONTENT. `WAVE1_PROPS` keeps the
 * original 14 backbone defs; `EXPANDED_PROPS` carries the rest of the strawman;
 * `PROP_CATALOG` / `PROPS_BY_ID` are the full set.
 *
 * Material mapping note: the strawman uses "organic" for plant matter, which is
 * not in `MaterialType`. Per propSchema.ts, organic → 'wood'. Boulders / logs
 * are "solid"; hollow props (crate/barrel) carry WALL thickness.
 * Non-plant "organic" heaps (dung, refuse) map to 'dirt' — treating muck as
 * wood would give it silly spell-penetration; noted per entry.
 *
 * A prop that appears in several contexts (crate, barrel, cart…) is ONE
 * definition with a union of placement tags — that reuse is exactly why these 14
 * are WAVE-1. Where the strawman gave a prop different sight/cover in different
 * rows (a crate "y (if stacked)"), the standalone form is taken and the stacked
 * form lives in its own def (`crate-stack`).
 *
 * ── Expansion merges (strawman rows folded into ONE def; decided here) ───────
 *  • fountain            = market "Fountain / market cross" + wealthy
 *                          "Ornamental well / fountain" (same referee row).
 *  • lantern-post        = tavern lantern post + wealthy wrought variant
 *                          (variant selector picks the form).
 *  • statue              = wealthy "Statue / plinth" + graveyard
 *                          "Statue (saint/mourner)".
 *  • brazier             = gate "Guard brazier" + graveyard "Offering brazier /
 *                          candle stand".
 *  • grindstone          = smithy grindstone + farmstead spare millstone.
 *  • iron-fence          = wealthy "Wrought-iron fence + gate" + graveyard
 *                          "Iron fence rail".
 *  • chicken-coop        = poor-quarter hutch + farmstead coop.
 *  • rock-outcrop        = rocky-hills "Rock outcrop / crag" + defile
 *                          "Concealing crag (full cover)".
 *  • rubble-pile         = ruin rubble + defile "Rockfall / rubble choke".
 *  • bramble-patch       = forest bramble + ruin "Bramble-choked doorway".
 *  • milestone / wayside-shrine — village-lane + road/trailside rows.
 *  Poor-quarter "broken fence", "cracked water butt", "handcart (broken)" and
 *  defile "dense thicket" / "fallen log (barricade)" reuse WAVE-1 defs
 *  (fence-run / barrel / cart / bush / fallen-log) via placement tags.
 *
 * ── Target facts (spell-targeting envelope) ──────────────────────────────────
 * Every def also carries the three spell-target facts the combat referee reads:
 *  • isFixedToSurface — true for rooted/embedded/built props (fence, wall, well,
 *    tree, terrain mass), false for discrete movable objects (crate, cart,
 *    sack, boat). Movement/telekinesis spells treat true as immovable and only
 *    apply their pound limits to false objects.
 *  • weightPounds — a plausible authored weight. The strawman did not specify
 *    weights, so these are round, physics-plausible estimates open to Remy
 *    refinement (not canonical strawman data).
 *  • isMagical — false for the whole mundane catalog; a future enchanted prop
 *    flips it true without a code change.
 */
import type { PropDefinition } from './propSchema';

/** The 14 WAVE-1 prop definitions, in strawman table order. */
export const WAVE1_PROPS: readonly PropDefinition[] = [
  {
    id: 'crate',
    isFixedToSurface: false,
    weightPounds: 25,
    isMagical: false,
    name: 'Crate',
    sizeClass: 'S',
    referee: {
      cover: 'half',
      blocksLoS: false, // standalone; stacked form is `crate-stack`
      blocksMovement: true,
      difficultTerrain: false,
      material: 'wood',
      thicknessInches: 1, // wall thickness
    },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['market', 'docks', 'smithy', 'warehouse', 'tavern', 'poor-quarter', 'gate'],
  },
  {
    id: 'barrel',
    isFixedToSurface: false,
    weightPounds: 30,
    isMagical: false,
    name: 'Barrel',
    sizeClass: 'S',
    referee: {
      cover: 'half',
      blocksLoS: true,
      blocksMovement: true,
      difficultTerrain: false,
      material: 'wood',
      thicknessInches: 1, // wall thickness
    },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['docks', 'tavern', 'market', 'smithy', 'farmstead', 'cellar', 'gate', 'poor-quarter'],
  },
  {
    id: 'sack',
    isFixedToSurface: false,
    weightPounds: 15,
    isMagical: false,
    name: 'Sack / grain bag',
    sizeClass: 'S',
    referee: {
      cover: 'none',
      blocksLoS: false,
      blocksMovement: false,
      difficultTerrain: false,
      material: 'fabric',
      thicknessInches: 0.5,
    },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['market', 'docks', 'farmstead', 'mill', 'poor-quarter'],
  },
  {
    id: 'fence-run',
    isFixedToSurface: true,
    weightPounds: 200,
    isMagical: false,
    name: 'Wooden fence / rail run',
    sizeClass: 'L',
    referee: {
      cover: 'half',
      blocksLoS: false,
      blocksMovement: false, // rails — vault/squeeze
      difficultTerrain: false,
      material: 'wood',
      thicknessInches: 3,
    },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['farmstead', 'village-lane', 'poor-quarter', 'pasture'],
  },
  {
    id: 'woodpile',
    isFixedToSurface: false,
    weightPounds: 400,
    isMagical: false,
    name: 'Firewood / log pile',
    sizeClass: 'M',
    referee: {
      cover: 'half',
      blocksLoS: true,
      blocksMovement: true,
      difficultTerrain: false,
      material: 'wood',
      thicknessInches: 4, // stacked cylinders — effective span
    },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['smithy', 'tavern', 'poor-quarter', 'farmstead', 'village-lane'],
  },
  {
    id: 'cart',
    isFixedToSurface: false,
    weightPounds: 150,
    isMagical: false,
    name: 'Cart (two-wheel handcart)',
    sizeClass: 'M',
    referee: {
      cover: 'half',
      blocksLoS: false,
      blocksMovement: true, // the bed blocks; strawman "partial (bed blocks)"
      difficultTerrain: false,
      material: 'wood',
      thicknessInches: 2,
    },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['market', 'village-lane', 'farmstead', 'gate', 'smithy', 'road'],
  },
  {
    id: 'market-stall',
    isFixedToSurface: true,
    weightPounds: 250,
    isMagical: false,
    name: 'Market stall',
    sizeClass: 'M',
    referee: {
      cover: 'half',
      blocksLoS: false, // open front
      blocksMovement: false,
      difficultTerrain: false,
      material: 'wood',
      thicknessInches: 1.5,
    },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['market'],
  },
  {
    id: 'well',
    isFixedToSurface: true,
    weightPounds: 2000,
    isMagical: false,
    name: 'Well (stone)',
    sizeClass: 'S',
    referee: {
      cover: 'half',
      blocksLoS: false, // partial in strawman → treat standalone as open
      blocksMovement: true,
      difficultTerrain: false,
      material: 'stone',
      thicknessInches: 8,
    },
    flammable: false,
    destructible: false, // "inert; hard"
    gen: 'PC',
    placementTags: ['village-lane', 'market', 'poor-quarter', 'farmstead'],
  },
  {
    id: 'boulder',
    isFixedToSurface: true,
    weightPounds: 400,
    isMagical: false,
    name: 'Boulder (scatter)',
    sizeClass: 'M',
    referee: {
      cover: 'half', // half–three-quarters in strawman; half is the common rung
      blocksLoS: true,
      blocksMovement: true,
      difficultTerrain: false,
      material: 'stone',
      thicknessInches: 30, // solid
    },
    flammable: false,
    destructible: false,
    gen: 'NC',
    placementTags: ['rocky-hills', 'forest', 'riverbank', 'defile', 'ruin', 'road'],
  },
  {
    id: 'fallen-log',
    isFixedToSurface: true,
    weightPounds: 300,
    isMagical: false,
    name: 'Fallen log',
    sizeClass: 'L',
    referee: {
      cover: 'half',
      blocksLoS: false,
      blocksMovement: false, // vault-over
      difficultTerrain: false,
      material: 'wood',
      thicknessInches: 18, // solid trunk
    },
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['forest', 'riverbank', 'defile', 'ruin'],
  },
  {
    id: 'bush',
    isFixedToSurface: true,
    weightPounds: 40,
    isMagical: false,
    name: 'Bush / thicket clump',
    sizeClass: 'S',
    referee: {
      cover: 'half',
      blocksLoS: true,
      blocksMovement: false,
      difficultTerrain: true, // "flammable; difficult" in forest rows
      material: 'wood', // organic → wood
      thicknessInches: 6,
    },
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['forest', 'riverbank', 'roadside', 'graveyard', 'road'],
  },
  {
    id: 'haystack',
    isFixedToSurface: false,
    weightPounds: 200,
    isMagical: false,
    name: 'Hay bale / haystack',
    sizeClass: 'M',
    referee: {
      cover: 'half',
      blocksLoS: true,
      blocksMovement: true,
      difficultTerrain: false,
      material: 'wood', // dry organic → wood
      thicknessInches: 24,
    },
    flammable: true, // "very flammable"
    destructible: true,
    gen: 'NC',
    placementTags: ['farmstead', 'village', 'market'],
  },
  {
    id: 'crate-stack',
    isFixedToSurface: false,
    weightPounds: 150,
    isMagical: false,
    name: 'Wooden crate-stack / pallet',
    sizeClass: 'M',
    referee: {
      cover: 'three-quarters',
      blocksLoS: true,
      blocksMovement: true,
      difficultTerrain: false,
      material: 'wood',
      thicknessInches: 1, // wall
    },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['docks', 'market', 'warehouse'],
  },
  {
    id: 'water-trough',
    isFixedToSurface: false,
    weightPounds: 80,
    isMagical: false,
    name: 'Water trough',
    sizeClass: 'S',
    referee: {
      cover: 'half',
      blocksLoS: false,
      blocksMovement: true,
      difficultTerrain: false,
      material: 'wood',
      thicknessInches: 2,
    },
    flammable: false, // holds water; strawman "destructible (spills)"
    destructible: true,
    gen: 'PC',
    placementTags: ['village-lane', 'farmstead', 'smithy', 'gate'],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// EXPANDED catalog — the rest of the strawman (all 16 contexts).
// Transcription conventions (same as WAVE-1):
//  • strawman Move "partial" / "(vault)" → blocksMovement: false (vault/squeeze).
//  • strawman Move "y (difficult)" or fire-col "difficult" → difficultTerrain:
//    true, blocksMovement: false (schema forbids both).
//  • strawman Sight "partial" → blocksLoS: false (well precedent: standalone
//    treated as open) unless the row is a wall-like mass.
//  • "inert; hard" → flammable: false, destructible: false.
//  • organic plant → 'wood'; muck/refuse/earthworks → 'dirt' (decided here).
// ─────────────────────────────────────────────────────────────────────────────

/** Strawman entries beyond WAVE-1, grouped by first context, table order. */
export const EXPANDED_PROPS: readonly PropDefinition[] = [
  // ── 1. Market square ────────────────────────────────────────────────────
  {
    id: 'produce-basket',
    isFixedToSurface: false,
    weightPounds: 5,
    isMagical: false,
    name: 'Produce basket',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'wood', thicknessInches: 0.3 },
    flammable: true,
    destructible: true,
    gen: 'NC', // weave
    placementTags: ['market'],
  },
  {
    id: 'awning-pole',
    isFixedToSurface: true,
    weightPounds: 25,
    isMagical: false,
    name: 'Awning / canopy pole',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 3 }, // "y (pole only)"
    flammable: true,
    destructible: true, // strawman fire-col says only "flammable"; a wood pole is choppable — decided destructible
    gen: 'PC',
    placementTags: ['market'],
  },
  {
    id: 'notice-board',
    isFixedToSurface: true,
    weightPounds: 30,
    isMagical: false,
    name: 'Public notice board',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 2 },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['market'],
  },
  {
    id: 'fountain',
    isFixedToSurface: true,
    weightPounds: 3000,
    isMagical: false,
    name: 'Fountain / market cross',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 8 }, // sight "partial" → open (well precedent)
    flammable: false,
    destructible: false, // "inert; hard-destruct"
    gen: 'HA',
    placementTags: ['market', 'wealthy-quarter'], // merged: ornamental well/fountain (wealthy) — same referee row
  },
  {
    id: 'trestle-table',
    isFixedToSurface: false,
    weightPounds: 80,
    isMagical: false,
    name: 'Trestle table + benches',
    sizeClass: 'M',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'wood', thicknessInches: 2 }, // move "partial" → vault
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['market', 'tavern'],
  },
  // ── 2. Docks / harbor ───────────────────────────────────────────────────
  {
    id: 'mooring-post',
    isFixedToSurface: true,
    weightPounds: 150,
    isMagical: false,
    name: 'Mooring post / bollard',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 6 },
    flammable: false, // "inert; hard" — weathered, tar-soaked post treated as inert per strawman
    destructible: false,
    gen: 'PC',
    placementTags: ['docks'],
  },
  {
    id: 'coiled-rope',
    isFixedToSurface: false,
    weightPounds: 15,
    isMagical: false,
    name: 'Coiled rope',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'wood', thicknessInches: 2 }, // organic → wood
    flammable: true,
    destructible: true, // rope is cuttable — decided (strawman fire-col only says "flammable")
    gen: 'NC', // torus/spiral
    placementTags: ['docks'],
  },
  {
    id: 'fishing-net',
    isFixedToSurface: false,
    weightPounds: 30,
    isMagical: false,
    name: 'Fishing net (draped)',
    sizeClass: 'M',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'fabric', thicknessInches: 0.2 }, // "n (snags)" → passable
    flammable: true,
    destructible: true,
    gen: 'NC', // drape
    placementTags: ['docks'],
  },
  {
    id: 'net-drying-rack',
    isFixedToSurface: true,
    weightPounds: 60,
    isMagical: false,
    name: 'Net-drying rack',
    sizeClass: 'L',
    referee: { cover: 'none', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 3 }, // "y (frame)"
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['docks'],
  },
  {
    id: 'fish-barrel',
    isFixedToSurface: false,
    weightPounds: 25,
    isMagical: false,
    name: 'Fish barrel / crate (open)',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 1 }, // open-top → no sight block
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['docks', 'market'],
  },
  {
    id: 'dock-crane',
    isFixedToSurface: true,
    weightPounds: 1500,
    isMagical: false,
    name: 'Crane / hoist (dock)',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 8 }, // sight "partial" → open frame
    flammable: true,
    destructible: true,
    gen: 'HA',
    placementTags: ['docks'],
  },
  {
    id: 'rowboat',
    isFixedToSurface: false,
    weightPounds: 300,
    isMagical: false,
    name: 'Rowboat / skiff (beached)',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'wood', thicknessInches: 1.5 }, // hull WALL; move "partial (hull)" → vault
    flammable: true,
    destructible: true,
    gen: 'NC', // hull curve
    placementTags: ['docks', 'riverbank'],
  },
  {
    id: 'anchor',
    isFixedToSurface: false,
    weightPounds: 400,
    isMagical: false,
    name: 'Anchor (iron)',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'metal', thicknessInches: 2 },
    flammable: false,
    destructible: false, // "inert; hard"
    gen: 'NC',
    placementTags: ['docks'],
  },
  {
    id: 'gangplank',
    isFixedToSurface: false,
    weightPounds: 40,
    isMagical: false,
    name: 'Gangplank',
    sizeClass: 'M',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'wood', thicknessInches: 2 },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['docks'],
  },
  // ── 3. Smithy street ────────────────────────────────────────────────────
  {
    id: 'anvil',
    isFixedToSurface: false,
    weightPounds: 300,
    isMagical: false,
    name: 'Anvil + stump',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'metal', thicknessInches: 4 },
    flammable: false,
    destructible: false, // "inert; hard"
    gen: 'NC', // horn curve
    placementTags: ['smithy'],
  },
  {
    id: 'forge',
    isFixedToSurface: true,
    weightPounds: 2000,
    isMagical: false,
    name: 'Forge / furnace',
    sizeClass: 'M',
    referee: { cover: 'three-quarters', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 10 },
    flammable: false, // holds fire, is not consumed by it
    destructible: false,
    gen: 'HA',
    placementTags: ['smithy'],
  },
  {
    id: 'grindstone',
    isFixedToSurface: false,
    weightPounds: 250,
    isMagical: false,
    name: 'Grindstone (foot-treadle)',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 4 },
    flammable: false,
    destructible: false,
    gen: 'NC', // wheel
    placementTags: ['smithy', 'farmstead'], // merged: farmstead spare millstone
  },
  {
    id: 'coal-heap',
    isFixedToSurface: false,
    weightPounds: 500,
    isMagical: false,
    name: 'Coal / ore heap',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: true, material: 'stone', thicknessInches: 12 }, // loose heap effective span
    flammable: false, // strawman says "inert" despite being coal — heaped raw ore/coal doesn't catch from a spark
    destructible: true, // scatterable heap — decided
    gen: 'NC', // heap
    placementTags: ['smithy'],
  },
  {
    id: 'tool-rack',
    isFixedToSurface: false,
    weightPounds: 40,
    isMagical: false,
    name: 'Tool rack (tongs / hammers)',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 2 },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['smithy'],
  },
  {
    id: 'metal-bar-stack',
    isFixedToSurface: false,
    weightPounds: 300,
    isMagical: false,
    name: 'Metal-bar stack / billets',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'metal', thicknessInches: 1 },
    flammable: false,
    destructible: false, // "inert; hard"
    gen: 'PC',
    placementTags: ['smithy'],
  },
  // ── 4. Tavern surroundings ──────────────────────────────────────────────
  {
    id: 'tavern-sign',
    isFixedToSurface: true,
    weightPounds: 20,
    isMagical: false,
    name: 'Hanging tavern sign',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 2 }, // "y (post)"
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['tavern'],
  },
  {
    id: 'lantern-post',
    isFixedToSurface: true,
    weightPounds: 40,
    isMagical: false,
    name: 'Lantern post',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 4 }, // glass pane on top; post is the referee body
    flammable: true, // wood post; the wealthy wrought variant is a `variation.variant` form
    destructible: true, // "glass breaks"
    gen: 'PC',
    placementTags: ['tavern', 'wealthy-quarter'], // merged: wealthy wrought lantern post
  },
  {
    id: 'slop-bucket',
    isFixedToSurface: false,
    weightPounds: 20,
    isMagical: false,
    name: 'Slop bucket / washtub',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'wood', thicknessInches: 1 },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['tavern'],
  },
  {
    id: 'overturned-barrel',
    isFixedToSurface: false,
    weightPounds: 30,
    isMagical: false,
    name: 'Overturned barrel (table)',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 1 }, // on its end as a table → below eye line
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['tavern'],
  },
  // ── 5. Poor quarter ─────────────────────────────────────────────────────
  {
    id: 'rubbish-heap',
    isFixedToSurface: false,
    weightPounds: 120,
    isMagical: false,
    name: 'Rubbish / refuse heap',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: true, material: 'dirt', thicknessInches: 10 }, // organic/dirt refuse → dirt (decided)
    flammable: true,
    destructible: true,
    gen: 'NC', // heap
    placementTags: ['poor-quarter'],
  },
  {
    id: 'washing-line',
    isFixedToSurface: false,
    weightPounds: 10,
    isMagical: false,
    name: 'Washing line + laundry',
    sizeClass: 'L',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'fabric', thicknessInches: 0.2 },
    // strawman Move "y (posts)": the LINE is overhead — treating the whole L-run
    // as impassable would wall off alleys, so decided passable (posts alone are
    // sub-cell). Cloth "sways" → no reliable sight block either.
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['poor-quarter'],
  },
  {
    id: 'chicken-coop',
    isFixedToSurface: false,
    weightPounds: 40,
    isMagical: false,
    name: 'Chicken coop / hutch',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 1 }, // wall thickness (hollow)
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['poor-quarter', 'farmstead'], // merged: farmstead coop row
  },
  {
    id: 'crockery-scatter',
    isFixedToSurface: false,
    weightPounds: 15,
    isMagical: false,
    name: 'Chamber-pot / crockery scatter',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'glass', thicknessInches: 0.3 }, // glass/ceramic
    flammable: false,
    destructible: true, // "breaks"
    gen: 'PC',
    placementTags: ['poor-quarter'],
  },
  // ── 6. Wealthy quarter ──────────────────────────────────────────────────
  {
    id: 'hedge-run',
    isFixedToSurface: true,
    weightPounds: 200,
    isMagical: false,
    name: 'Ornamental hedge run',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 12 },
    // strawman gives Move y AND "difficult"; schema forbids both — a trimmed
    // dense hedge reads impassable, so blocksMovement wins (decided).
    flammable: true, // "(dry)"
    destructible: true,
    gen: 'NC',
    placementTags: ['wealthy-quarter', 'road'], // merged: road/trailside "Bush / hedgerow" L-run form
  },
  {
    id: 'iron-fence',
    isFixedToSurface: true,
    weightPounds: 500,
    isMagical: false,
    name: 'Wrought-iron fence + gate',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'metal', thicknessInches: 1 },
    flammable: false,
    destructible: false, // "inert; hard"
    gen: 'HA',
    placementTags: ['wealthy-quarter', 'graveyard'], // merged: graveyard iron fence rail
  },
  {
    id: 'stone-planter',
    isFixedToSurface: true,
    weightPounds: 150,
    isMagical: false,
    name: 'Stone planter / urn',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 4 },
    flammable: false,
    destructible: false,
    gen: 'NC', // lathe
    placementTags: ['wealthy-quarter'],
  },
  {
    id: 'statue',
    isFixedToSurface: true,
    weightPounds: 800,
    isMagical: false,
    name: 'Statue / plinth',
    sizeClass: 'M',
    referee: { cover: 'three-quarters', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 12 },
    flammable: false,
    destructible: false,
    gen: 'HA',
    placementTags: ['wealthy-quarter', 'graveyard'], // merged: graveyard saint/mourner statue
  },
  {
    id: 'stone-bench',
    isFixedToSurface: true,
    weightPounds: 400,
    isMagical: false,
    name: 'Stone bench',
    sizeClass: 'M',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 6 },
    flammable: false,
    destructible: false,
    gen: 'PC',
    placementTags: ['wealthy-quarter'],
  },
  {
    id: 'carriage',
    isFixedToSurface: false,
    weightPounds: 1200,
    isMagical: false,
    name: 'Carriage (four-wheel)',
    sizeClass: 'L',
    referee: { cover: 'three-quarters', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 2 },
    flammable: true,
    destructible: true,
    gen: 'HA',
    placementTags: ['wealthy-quarter'],
  },
  {
    id: 'topiary',
    isFixedToSurface: false,
    weightPounds: 150,
    isMagical: false,
    name: 'Topiary / potted tree',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 6 },
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['wealthy-quarter'],
  },
  // ── 7. Farmstead ────────────────────────────────────────────────────────
  {
    id: 'plough',
    isFixedToSurface: false,
    weightPounds: 200,
    isMagical: false,
    name: 'Plough / harrow',
    sizeClass: 'M',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'wood', thicknessInches: 3 }, // move "partial" → vault
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['farmstead'],
  },
  {
    id: 'pigpen',
    isFixedToSurface: false,
    weightPounds: 120,
    isMagical: false,
    name: 'Pigpen / livestock hurdle',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'wood', thicknessInches: 2 },
    // strawman Move y — but hurdles are low vaultable rails; fence-run precedent
    // (rails → vault → passable) wins for consistency (decided).
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['farmstead'],
  },
  {
    id: 'scarecrow',
    isFixedToSurface: true,
    weightPounds: 30,
    isMagical: false,
    name: 'Scarecrow',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 2 }, // "y (post)"
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['farmstead'],
  },
  {
    id: 'beehive',
    isFixedToSurface: false,
    weightPounds: 20,
    isMagical: false,
    name: 'Beehive skep',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 1 }, // coiled straw → wood; hollow wall
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['farmstead'],
  },
  // ── 8. Village lane ─────────────────────────────────────────────────────
  {
    id: 'milestone',
    isFixedToSurface: true,
    weightPounds: 200,
    isMagical: false,
    name: 'Milestone / waymarker',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 6 },
    flammable: false,
    destructible: false,
    gen: 'PC',
    placementTags: ['village-lane', 'road'], // merged: road/trailside milestone row
  },
  {
    id: 'wayside-shrine',
    isFixedToSurface: true,
    weightPounds: 300,
    isMagical: false,
    name: 'Wayside shrine',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 8 },
    flammable: false,
    destructible: false,
    gen: 'NC',
    placementTags: ['village-lane', 'road'], // merged: road/trailside shrine row
  },
  {
    id: 'wood-bench',
    isFixedToSurface: false,
    weightPounds: 40,
    isMagical: false,
    name: 'Bench (rough wood)',
    sizeClass: 'M',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 2 },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['village-lane'],
  },
  {
    id: 'dung-heap',
    isFixedToSurface: false,
    weightPounds: 150,
    isMagical: false,
    name: 'Dung / muck heap',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: true, material: 'dirt', thicknessInches: 10 }, // muck → dirt, not wood (decided)
    flammable: true, // dry dung burns — strawman "flammable; difficult"
    destructible: true,
    gen: 'NC', // heap
    placementTags: ['village-lane'],
  },
  // ── 9. Town gate / walls ────────────────────────────────────────────────
  {
    id: 'wall-merlon',
    isFixedToSurface: true,
    weightPounds: 1000,
    isMagical: false,
    name: 'Wall merlon / crenellation',
    sizeClass: 'L',
    referee: { cover: 'three-quarters', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 24 },
    flammable: false,
    destructible: false,
    gen: 'PC',
    placementTags: ['gate'],
  },
  {
    id: 'wooden-gate',
    isFixedToSurface: true,
    weightPounds: 400,
    isMagical: false,
    name: 'Wooden gate (double-leaf)',
    sizeClass: 'L',
    referee: { cover: 'full', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 4 },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['gate'],
  },
  {
    id: 'portcullis',
    isFixedToSurface: true,
    weightPounds: 800,
    isMagical: false,
    name: 'Portcullis',
    sizeClass: 'L',
    referee: { cover: 'three-quarters', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'metal', thicknessInches: 2 }, // sight "partial" → see between the bars
    flammable: false,
    destructible: false, // "inert; hard"
    gen: 'NC',
    placementTags: ['gate'],
  },
  {
    id: 'brazier',
    isFixedToSurface: true,
    weightPounds: 60,
    isMagical: false,
    name: 'Brazier / candle stand',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'metal', thicknessInches: 2 },
    flammable: false, // HOLDS fire; the fire-hazard packet reads this pairing later
    destructible: true, // a standing metal bowl tips over (decided)
    gen: 'NC', // bowl
    placementTags: ['gate', 'graveyard'], // merged: graveyard offering brazier / candle stand
  },
  {
    id: 'weapon-rack',
    isFixedToSurface: false,
    weightPounds: 60,
    isMagical: false,
    name: 'Weapon rack (spears)',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 2 },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['gate'],
  },
  {
    id: 'sandbag-rampart',
    isFixedToSurface: true,
    weightPounds: 600,
    isMagical: false,
    name: 'Sandbag / earth rampart',
    sizeClass: 'L',
    referee: { cover: 'three-quarters', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'dirt', thicknessInches: 12 }, // fabric/dirt → the MASS is earth (decided)
    flammable: true, // "(bags)"
    destructible: true,
    gen: 'PC',
    placementTags: ['gate'],
  },
  {
    id: 'checkpoint-bar',
    isFixedToSurface: true,
    weightPounds: 60,
    isMagical: false,
    name: 'Barrier / checkpoint bar',
    sizeClass: 'M',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 4 },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['gate'],
  },
  {
    id: 'wall-ladder',
    isFixedToSurface: true,
    weightPounds: 40,
    isMagical: false,
    name: 'Wall ladder',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 2 },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['gate'],
  },
  // ── 10. Graveyard / temple yard ─────────────────────────────────────────
  {
    id: 'gravestone',
    isFixedToSurface: true,
    weightPounds: 300,
    isMagical: false,
    name: 'Gravestone / headstone',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 4 },
    flammable: false,
    destructible: false,
    gen: 'PC',
    placementTags: ['graveyard'],
  },
  {
    id: 'tomb',
    isFixedToSurface: true,
    weightPounds: 1500,
    isMagical: false,
    name: 'Tomb / sarcophagus',
    sizeClass: 'M',
    referee: { cover: 'three-quarters', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 10 },
    flammable: false,
    destructible: false,
    gen: 'NC',
    placementTags: ['graveyard'],
  },
  {
    id: 'stone-cross',
    isFixedToSurface: true,
    weightPounds: 600,
    isMagical: false,
    name: 'Stone cross / monument',
    sizeClass: 'M',
    referee: { cover: 'three-quarters', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 8 },
    flammable: false,
    destructible: false,
    gen: 'HA',
    placementTags: ['graveyard'],
  },
  {
    id: 'lych-gate',
    isFixedToSurface: true,
    weightPounds: 500,
    isMagical: false,
    name: 'Lych-gate',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 4 },
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['graveyard'],
  },
  {
    id: 'boundary-wall',
    isFixedToSurface: true,
    weightPounds: 1500,
    isMagical: false,
    name: 'Low boundary wall',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 12 },
    flammable: false,
    destructible: false,
    gen: 'PC',
    placementTags: ['graveyard'],
  },
  {
    id: 'grave-mound',
    isFixedToSurface: true,
    weightPounds: 300,
    isMagical: false,
    name: 'Fresh-dug grave mound',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: true, material: 'dirt', thicknessInches: 12 },
    flammable: false,
    destructible: true, // loose earth — diggable/scatterable (decided)
    gen: 'NC', // mound
    placementTags: ['graveyard'],
  },
  // ── 11. Forest ──────────────────────────────────────────────────────────
  {
    id: 'tree-stump',
    isFixedToSurface: true,
    weightPounds: 150,
    isMagical: false,
    name: 'Tree stump',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 20 }, // solid
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['forest'],
  },
  {
    id: 'deadfall',
    isFixedToSurface: true,
    weightPounds: 200,
    isMagical: false,
    name: 'Deadfall / branch tangle',
    sizeClass: 'M',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: false, difficultTerrain: true, material: 'wood', thicknessInches: 6 }, // move "partial" + "difficult"
    flammable: true, // "very flammable"
    destructible: true,
    gen: 'NC',
    placementTags: ['forest'],
  },
  {
    id: 'mossy-rock-cluster',
    isFixedToSurface: true,
    weightPounds: 800,
    isMagical: false,
    name: 'Mossy rock cluster',
    sizeClass: 'M',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 24 }, // solid
    flammable: false,
    destructible: false,
    gen: 'NC',
    placementTags: ['forest'],
  },
  {
    id: 'bramble-patch',
    isFixedToSurface: true,
    weightPounds: 60,
    isMagical: false,
    name: 'Bramble patch',
    sizeClass: 'M',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: false, difficultTerrain: true, material: 'wood', thicknessInches: 6 }, // "y (difficult)"
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['forest', 'ruin'], // merged: ruin "Bramble-choked doorway"
  },
  {
    id: 'mushroom-ring',
    isFixedToSurface: true,
    weightPounds: 5,
    isMagical: false,
    name: 'Mushroom ring / fungal shelf',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'wood', thicknessInches: 2 },
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['forest'],
  },
  {
    id: 'fern-clump',
    isFixedToSurface: true,
    weightPounds: 10,
    isMagical: false,
    name: 'Fern / undergrowth clump',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'wood', thicknessInches: 3 },
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['forest'],
  },
  // ── 12. Rocky hills ─────────────────────────────────────────────────────
  {
    id: 'rock-outcrop',
    isFixedToSurface: true,
    weightPounds: 2000,
    isMagical: false,
    name: 'Rock outcrop / crag',
    sizeClass: 'L',
    referee: { cover: 'full', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 48 }, // solid
    flammable: false,
    destructible: false,
    gen: 'HA',
    placementTags: ['rocky-hills', 'defile'], // merged: defile "Concealing crag (full cover)"
  },
  {
    id: 'scree-field',
    isFixedToSurface: true,
    weightPounds: 1000,
    isMagical: false,
    name: 'Scree / loose-rock field',
    sizeClass: 'L',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: true, material: 'stone', thicknessInches: 6 }, // loose
    flammable: false,
    destructible: false,
    gen: 'NC', // scatter
    placementTags: ['rocky-hills'],
  },
  {
    id: 'standing-stone',
    isFixedToSurface: true,
    weightPounds: 800,
    isMagical: false,
    name: 'Standing stone / menhir',
    sizeClass: 'M',
    referee: { cover: 'three-quarters', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 18 },
    flammable: false,
    destructible: false,
    gen: 'NC',
    placementTags: ['rocky-hills'],
  },
  {
    id: 'cave-mouth',
    isFixedToSurface: true,
    weightPounds: 8000,
    isMagical: false,
    name: 'Cave mouth / overhang',
    sizeClass: 'L',
    referee: { cover: 'full', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 60 }, // solid cliff mass
    flammable: false,
    destructible: false,
    gen: 'HA',
    placementTags: ['rocky-hills'],
  },
  {
    id: 'dry-stone-wall',
    isFixedToSurface: true,
    weightPounds: 1500,
    isMagical: false,
    name: 'Dry stone wall (ruined)',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 18 },
    flammable: false,
    destructible: false, // "inert; hard"
    gen: 'PC',
    placementTags: ['rocky-hills'],
  },
  {
    id: 'gorse-shrub',
    isFixedToSurface: true,
    weightPounds: 30,
    isMagical: false,
    name: 'Gorse / hardy shrub',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 5 },
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['rocky-hills'],
  },
  {
    id: 'cairn',
    isFixedToSurface: true,
    weightPounds: 150,
    isMagical: false,
    name: 'Small cairn',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 12 },
    flammable: false,
    destructible: false, // "inert; hard"
    gen: 'PC',
    placementTags: ['rocky-hills'],
  },
  // ── 13. Riverbank ───────────────────────────────────────────────────────
  {
    id: 'reed-bed',
    isFixedToSurface: true,
    weightPounds: 60,
    isMagical: false,
    name: 'Reed / rush bed',
    sizeClass: 'M',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: false, difficultTerrain: true, material: 'wood', thicknessInches: 4 }, // "y (difficult)"
    flammable: true, // "(dry)"
    destructible: true,
    gen: 'NC',
    placementTags: ['riverbank'],
  },
  {
    id: 'driftwood-pile',
    isFixedToSurface: false,
    weightPounds: 250,
    isMagical: false,
    name: 'Driftwood pile',
    sizeClass: 'M',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'wood', thicknessInches: 5 }, // move "partial" → vault
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['riverbank'],
  },
  {
    id: 'gravel-bar',
    isFixedToSurface: true,
    weightPounds: 800,
    isMagical: false,
    name: 'Gravel / shingle bar',
    sizeClass: 'L',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: true, material: 'stone', thicknessInches: 4 },
    // strawman Move says "n" but its fire-col says "difficult terrain" — the
    // difficult reading wins (loose shingle underfoot), decided here.
    flammable: false,
    destructible: false,
    gen: 'NC',
    placementTags: ['riverbank'],
  },
  {
    id: 'stepping-stones',
    isFixedToSurface: true,
    weightPounds: 200,
    isMagical: false,
    name: 'Stepping stones',
    sizeClass: 'S', // strawman "S×n" — a line of S instances
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'stone', thicknessInches: 8 },
    flammable: false,
    destructible: false,
    gen: 'PC',
    placementTags: ['riverbank'],
  },
  {
    id: 'muddy-flat',
    isFixedToSurface: true,
    weightPounds: 1500,
    isMagical: false,
    name: 'Muddy flat',
    sizeClass: 'L',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: true, material: 'dirt', thicknessInches: 6 }, // "y (difficult)"; dirt/mud → dirt
    flammable: false,
    destructible: false,
    gen: 'PC',
    placementTags: ['riverbank'],
  },
  {
    id: 'jetty-post',
    isFixedToSurface: true,
    weightPounds: 80,
    isMagical: false,
    name: 'Old jetty post (rotted)',
    sizeClass: 'S',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 6 },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['riverbank'],
  },
  // ── 14. Road / trailside ────────────────────────────────────────────────
  {
    id: 'fingerpost',
    isFixedToSurface: true,
    weightPounds: 20,
    isMagical: false,
    name: 'Fingerpost / signpost',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 3 },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['road'],
  },
  {
    id: 'log-bridge',
    isFixedToSurface: true,
    weightPounds: 150,
    isMagical: false,
    name: 'Log bridge / plank crossing',
    sizeClass: 'M',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'wood', thicknessInches: 2 },
    flammable: true,
    destructible: true,
    gen: 'PC',
    placementTags: ['road'],
  },
  {
    id: 'ditch-bank',
    isFixedToSurface: true,
    weightPounds: 2000,
    isMagical: false,
    name: 'Ditch / bank',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: false, difficultTerrain: true, material: 'dirt', thicknessInches: 18 }, // "y (difficult)"
    flammable: false,
    destructible: false, // earthwork — not meaningfully destructible in combat
    gen: 'PC',
    placementTags: ['road'],
  },
  {
    id: 'firepit',
    isFixedToSurface: true,
    weightPounds: 150,
    isMagical: false,
    name: 'Rest-stop firepit',
    sizeClass: 'S',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 4 },
    flammable: false, // HOLDS fire
    destructible: false,
    gen: 'PC',
    placementTags: ['road'],
  },
  // ── 15. Ruin site ───────────────────────────────────────────────────────
  {
    id: 'broken-wall',
    isFixedToSurface: true,
    weightPounds: 2000,
    isMagical: false,
    name: 'Broken wall segment',
    sizeClass: 'L',
    referee: { cover: 'three-quarters', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 18 },
    flammable: false,
    destructible: false,
    gen: 'PC',
    placementTags: ['ruin'],
  },
  {
    id: 'toppled-column',
    isFixedToSurface: true,
    weightPounds: 2500,
    isMagical: false,
    name: 'Toppled column',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'stone', thicknessInches: 24 }, // solid; move "partial (vault)"
    flammable: false,
    destructible: false,
    gen: 'NC',
    placementTags: ['ruin'],
  },
  {
    id: 'standing-column',
    isFixedToSurface: true,
    weightPounds: 3000,
    isMagical: false,
    name: 'Standing column (partial)',
    sizeClass: 'M',
    referee: { cover: 'three-quarters', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 14 },
    flammable: false,
    destructible: false,
    gen: 'NC',
    placementTags: ['ruin'],
  },
  {
    id: 'rubble-pile',
    isFixedToSurface: true,
    weightPounds: 900,
    isMagical: false,
    name: 'Rubble pile',
    sizeClass: 'M',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: false, difficultTerrain: true, material: 'stone', thicknessInches: 8 }, // loose; "y (difficult)"
    flammable: false,
    destructible: false,
    gen: 'NC', // heap
    placementTags: ['ruin', 'defile'], // merged: defile "Rockfall / rubble choke"
  },
  {
    id: 'collapsed-archway',
    isFixedToSurface: true,
    weightPounds: 4000,
    isMagical: false,
    name: 'Collapsed archway',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 20 },
    flammable: false,
    destructible: false,
    gen: 'HA',
    placementTags: ['ruin'],
  },
  {
    id: 'overgrown-statue',
    isFixedToSurface: true,
    weightPounds: 800,
    isMagical: false,
    name: 'Overgrown statue (broken)',
    sizeClass: 'M',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 10 },
    flammable: false,
    destructible: false,
    gen: 'HA',
    placementTags: ['ruin'],
  },
  {
    id: 'ivy-mass',
    isFixedToSurface: true,
    weightPounds: 40,
    isMagical: false,
    name: 'Ivy / creeper mass',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 4 },
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['ruin'],
  },
  {
    id: 'flagstone-floor',
    isFixedToSurface: true,
    weightPounds: 1500,
    isMagical: false,
    name: 'Sunken flagstone floor',
    sizeClass: 'L',
    referee: { cover: 'none', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'stone', thicknessInches: 4 },
    flammable: false,
    destructible: false,
    gen: 'PC',
    placementTags: ['ruin'],
  },
  {
    id: 'roof-beam-charred',
    isFixedToSurface: false,
    weightPounds: 250,
    isMagical: false,
    name: 'Fallen roof beam (charred)',
    sizeClass: 'L',
    referee: { cover: 'half', blocksLoS: false, blocksMovement: false, difficultTerrain: false, material: 'wood', thicknessInches: 10 }, // solid beam; move "partial" → vault
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['ruin'],
  },
  // ── 16. Ambush-worthy defile ────────────────────────────────────────────
  // (Mostly a placement PATTERN over hill/forest props — strawman open q. 5.
  //  Only the two genuinely new forms get defs; the rest reuse boulder /
  //  fallen-log / bush / rock-outcrop / rubble-pile via the 'defile' tag.)
  {
    id: 'dead-snag',
    isFixedToSurface: true,
    weightPounds: 400,
    isMagical: false,
    name: 'Dead snag / lean tree',
    sizeClass: 'M',
    referee: { cover: 'half', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'wood', thicknessInches: 12 },
    flammable: true,
    destructible: true,
    gen: 'NC',
    placementTags: ['defile'],
  },
  {
    id: 'sniper-ledge',
    isFixedToSurface: true,
    weightPounds: 1500,
    isMagical: false,
    name: 'Sniper ledge / rock shelf',
    sizeClass: 'M',
    referee: { cover: 'three-quarters', blocksLoS: true, blocksMovement: true, difficultTerrain: false, material: 'stone', thicknessInches: 30 },
    flammable: false,
    destructible: false,
    gen: 'NC',
    placementTags: ['defile'],
  },
] as const;

/** The FULL catalog: WAVE-1 backbone + the expanded strawman set. */
export const PROP_CATALOG: readonly PropDefinition[] = [...WAVE1_PROPS, ...EXPANDED_PROPS];

/** Fast lookup over the FULL catalog (built once at module load). */
export const PROPS_BY_ID: ReadonlyMap<string, PropDefinition> = new Map(
  PROP_CATALOG.map((d) => [d.id, d]),
);

/**
 * Fast lookup for the WAVE-1 backbone only. The GroundWorld bridge (rendering +
 * referee imprint) still keys off THIS map — expanded defs stay data-only until
 * the wiring packet switches the bridge to `PROPS_BY_ID`.
 */
export const WAVE1_PROPS_BY_ID: ReadonlyMap<string, PropDefinition> = new Map(
  WAVE1_PROPS.map((d) => [d.id, d]),
);

/** All placement tags present in the FULL catalog (deduped, sorted). */
export function allPlacementTags(): string[] {
  const tags = new Set<string>();
  for (const d of PROP_CATALOG) for (const t of d.placementTags) tags.add(t);
  return [...tags].sort();
}

// ── Surface gates (surface-gate wave, WorldClaw stage 2) ────────────────────

/**
 * How each prop family tolerates the ground it lands on. Read by the placement
 * engine's stage-2 gate: a candidate whose surface fails its gate is REJECTED,
 * and a candidate that passes is tilted and sunk to fit.
 *
 * Families, not per-id rows, because tolerance follows FORM:
 *  • lying stone — a boulder or outcrop takes almost any slope and lies flat on
 *    it, tilting the full way to the normal. It sinks deep: half its own base
 *    radius of drop, so it beds into the hillside instead of hovering.
 *  • standing stone — a cairn or gravestone was PLACED by someone, so it stays
 *    near-upright and needs ground a person could stand a stone on.
 *  • vegetation — a bush leans a little; a log lies down.
 *  • built — a stall, cart or fence needs level, low ground. Nobody builds a
 *    market stall on a 25-degree bank.
 *  • water-edge — reeds and gravel bars need nearly flat, low ground.
 *
 * Angles in degrees for legibility; `surfaceGateFor` converts to radians.
 * Elevations are FEET above sea level in the ground window's own frame.
 */
interface PropSurfaceGateSpec {
  maxSlopeDeg: number;
  maxTiltDeg: number;
  baseRadiusFt: number;
  minElevationFt?: number;
  maxElevationFt?: number;
  slopeScaleFloor?: number;
}

const LYING_STONE: PropSurfaceGateSpec = {
  maxSlopeDeg: 45, maxTiltDeg: 45, baseRadiusFt: 3, slopeScaleFloor: 0.85,
};
const STANDING_STONE: PropSurfaceGateSpec = {
  maxSlopeDeg: 20, maxTiltDeg: 6, baseRadiusFt: 2, slopeScaleFloor: 0.9,
};
const LYING_WOOD: PropSurfaceGateSpec = {
  maxSlopeDeg: 35, maxTiltDeg: 35, baseRadiusFt: 4, slopeScaleFloor: 0.85,
};
const SHRUB: PropSurfaceGateSpec = {
  maxSlopeDeg: 32, maxTiltDeg: 12, baseRadiusFt: 2, slopeScaleFloor: 0.7,
};
const BUILT: PropSurfaceGateSpec = {
  maxSlopeDeg: 10, maxTiltDeg: 3, baseRadiusFt: 1.5,
};
const WATER_EDGE: PropSurfaceGateSpec = {
  maxSlopeDeg: 8, maxTiltDeg: 4, baseRadiusFt: 2,
};

const PROP_SURFACE_FAMILY: Readonly<Record<string, PropSurfaceGateSpec>> = {
  // Lying stone.
  boulder: LYING_STONE, 'rock-outcrop': LYING_STONE, 'mossy-rock-cluster': LYING_STONE,
  'rubble-pile': LYING_STONE, 'gravel-bar': WATER_EDGE, 'toppled-column': LYING_STONE,
  'broken-wall': LYING_STONE, 'sniper-ledge': LYING_STONE,
  // Standing stone / placed masonry.
  cairn: STANDING_STONE, 'standing-stone': STANDING_STONE, gravestone: STANDING_STONE,
  tomb: STANDING_STONE, 'stone-cross': STANDING_STONE, milestone: STANDING_STONE,
  'wayside-shrine': STANDING_STONE, statue: STANDING_STONE, 'stone-planter': STANDING_STONE,
  'stone-bench': STANDING_STONE, 'boundary-wall': STANDING_STONE, 'dry-stone-wall': STANDING_STONE,
  brazier: STANDING_STONE, fingerpost: STANDING_STONE, grindstone: STANDING_STONE,
  well: BUILT, 'lantern-post': STANDING_STONE, 'mooring-post': STANDING_STONE,
  'jetty-post': STANDING_STONE, 'dead-snag': STANDING_STONE, 'tree-stump': LYING_WOOD,
  // Lying wood.
  'fallen-log': LYING_WOOD, deadfall: LYING_WOOD, 'driftwood-pile': LYING_WOOD,
  'log-bridge': LYING_WOOD, 'roof-beam-charred': LYING_WOOD, woodpile: LYING_WOOD,
  // Vegetation.
  bush: SHRUB, 'bramble-patch': SHRUB, 'fern-clump': SHRUB, 'gorse-shrub': SHRUB,
  'hedge-run': SHRUB, topiary: BUILT, 'ivy-mass': SHRUB, 'mushroom-ring': WATER_EDGE,
  'reed-bed': WATER_EDGE,
};

/**
 * The gate for a prop id. Anything with no family row is BUILT: a manufactured
 * object needs level ground, which is the conservative call — it keeps clutter
 * off banks rather than letting an un-classified prop through un-gated.
 */
export function surfaceGateFor(defId: string): {
  minElevationFt?: number;
  maxElevationFt?: number;
  maxSlopeRad: number;
  maxTiltRad: number;
  baseRadiusFt: number;
  slopeScaleFloor?: number;
} {
  const spec = PROP_SURFACE_FAMILY[defId] ?? BUILT;
  const rad = (d: number): number => (d * Math.PI) / 180;
  return {
    minElevationFt: spec.minElevationFt,
    maxElevationFt: spec.maxElevationFt,
    maxSlopeRad: rad(spec.maxSlopeDeg),
    maxTiltRad: rad(spec.maxTiltDeg),
    baseRadiusFt: spec.baseRadiusFt,
    slopeScaleFloor: spec.slopeScaleFloor,
  };
}
