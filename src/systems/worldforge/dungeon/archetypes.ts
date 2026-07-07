/**
 * @file archetypes.ts
 * @description Builder-archetype data for the history-first dungeon generator
 * (spec docs/superpowers/specs/2026-07-05-procedural-dungeon-generator.md,
 * approved layout mocks .agent/scratch/dungeon-layout-mocks.html, tone
 * reference .agent/scratch/dungeon-history-mock-event-logs.md).
 *
 * PURE DATA. No functions, no randomness, zero THREE imports. The Task 3
 * builder consumes this: it places `core` rooms once (in order), then places
 * `repeat` units until the requested room count, resolves anchors, and rolls
 * ranges with the seeded RNG.
 *
 * Anchor semantics the builder honors (encoded here, interpreted there):
 * - 'entry'  — attaches at the map edge; the first room of the plan.
 * - 'prev'   — attaches to the previously placed room.
 * - 'spine'  — attaches along the archetype's spine corridor run.
 * - a RoomPurpose — attaches to the (first) placed room of that purpose.
 *
 * Name register rule (Remy-approved): grounded English/fantasy surnames and
 * company/hold names in the vein of Marrowick, Deepvein, the Pale Watch.
 * NEVER apostrophe-gibberish syllables.
 */

import type {
  BuilderArchetype,
  DungeonTheme,
  EventKind,
  RoomPurpose,
  RoomShape,
} from './types';

export interface RoomSpec {
  purpose: RoomPurpose;
  w: readonly [number, number]; // cell range, inclusive
  h: readonly [number, number];
  shape: RoomShape;
  /** Where it attaches: 'entry' (map edge), 'prev' (last placed), a purpose name, or 'spine'. */
  anchor: 'entry' | 'prev' | 'spine' | RoomPurpose;
  /** Preferred attach direction relative to the plan's flow axis. */
  dir: 'flow' | 'left' | 'right' | 'back' | 'any';
  corridor: readonly [number, number]; // corridor length range in cells (0 = shared wall door)
}

export interface ArchetypeData {
  archetype: BuilderArchetype;
  /** Builder identity pools — a name is picked per dungeon, e.g. "the Marrowick family". */
  builderPatterns: readonly string[]; // e.g. 'the {N} family', 'the {N} Company' — {N} from namePool
  namePool: readonly string[]; // proper-noun stems: Marrowick, Deepvein, Pale Watch…
  /** Dungeon display-name patterns using real facts: '{N}' builder stem, '{P}' place noun. */
  titlePatterns: readonly string[]; // e.g. 'The {N} Crypt', 'The Drowned {N} Workings'
  /** Interim substitution for the {T} town token until world attachment supplies a real town name. */
  townPlaceholder?: string;
  /** Room programs: core rooms placed once, repeat units placed until roomCount. */
  core: readonly RoomSpec[];
  repeat: readonly RoomSpec[];
  /** Which purposes can flood / are treated as "low". */
  floodable: readonly RoomPurpose[];
  /** Event-chain template: kinds eligible for this archetype with weights. */
  eventWeights: Readonly<Partial<Record<EventKind, number>>>;
}

/* ------------------------------------------------------------------------ */
/* Mausoleum — processional symmetry: stair → antechamber → chapel, a spine  */
/* corridor behind, burial galleries branching off it, ossuary at the end,   */
/* treasury behind the chapel with one door.                                 */
/* ------------------------------------------------------------------------ */

const MAUSOLEUM: ArchetypeData = {
  archetype: 'mausoleum',
  builderPatterns: ['the {N} family', 'the {N} line', 'House {N}'],
  namePool: [
    'Marrowick',
    'Veyne',
    'Ashcombe',
    'Halloway',
    'Corvel',
    'Draymoor',
    'Osgrave',
    'Wrenfield',
    'Fennick',
    'Coldbarrow',
  ],
  titlePatterns: ['The {N} Crypt', 'The {N} Mausoleum', 'The {N} Vaults', 'The Tomb of House {N}'],
  core: [
    // ROOM-SIZE ×2 (Remy 2026-07-07): every dimension range is scaled ≈×1.4 so the
    // interior FLOOR AREA of each room roughly DOUBLES — the crypt reads as grand
    // burial HALLS, not cramped cells, and furniture (coffins/pews) sits as
    // distinct pieces with aisle space rather than a packed 2-cell lattice. Cells
    // stay 5 ft (feet-canon); the rooms are physically bigger. The small-vs-large
    // hierarchy is preserved (a stair is still small next to the chapel hall).
    { purpose: 'stair', w: [4, 6], h: [6, 8], shape: 'rect', anchor: 'entry', dir: 'flow', corridor: [0, 0] },
    { purpose: 'antechamber', w: [7, 10], h: [6, 8], shape: 'rect', anchor: 'prev', dir: 'flow', corridor: [0, 1] },
    // The chapel is the DOMINANT central shape — biggest room on the plan, a large
    // octagon the entrance procession (stair → antechamber → chapel) reads toward.
    // Gallery wings spread around and behind it (see placeRepeats).
    { purpose: 'chapel', w: [15, 19], h: [15, 19], shape: 'octagon', anchor: 'prev', dir: 'flow', corridor: [0, 1] },
    // Treasury opens DIRECTLY off the chapel through a shared-wall door (no hall).
    { purpose: 'treasury', w: [6, 8], h: [6, 8], shape: 'rect', anchor: 'chapel', dir: 'right', corridor: [0, 0] },
    // The spine itself is a corridor run the builder carves behind the chapel
    // (Task 3); the ossuary caps its far end.
    { purpose: 'ossuary', w: [8, 11], h: [7, 10], shape: 'rect', anchor: 'spine', dir: 'flow', corridor: [0, 1] },
    { purpose: 'embalming', w: [7, 10], h: [6, 8], shape: 'rect', anchor: 'antechamber', dir: 'left', corridor: [0, 0] },
  ],
  repeat: [
    // Galleries form room-through-room CHAINS: the first gallery of a wing attaches
    // to a spine anchor, then 1-3 more galleries chain DIRECTLY off the previous
    // one through a shared-wall door (corridor 0-1). The player walks the spine a
    // little, then moves gallery → gallery → gallery without a hall. corridor
    // [0,1] is the chain door; the builder (placeRepeats) drives the chaining.
    // ×2 size: a burial gallery is now ~8-13 × 10-15 cells (≈40 → ≈110 floor
    // cells), a spacious hall of DISTINCT coffins with a real processional aisle.
    { purpose: 'burial-gallery', w: [8, 13], h: [10, 15], shape: 'rect', anchor: 'spine', dir: 'any', corridor: [0, 1] },
  ],
  floodable: ['ossuary', 'burial-gallery'],
  eventWeights: {
    seal: 3,
    collapse: 2,
    tunnel: 2,
    plunder: 2,
    awaken: 3,
    'brick-off': 2,
    reoccupy: 1,
    fire: 1,
    bloom: 1,
  },
};

/* ------------------------------------------------------------------------ */
/* Mine — rectilinear built rooms cluster at the surface (hoist, store,      */
/* barracks), then organic-edged vein galleries chase the vein down via      */
/* sloped declines. Flow axis is diagonal-stepping (Task 3 flowDir           */
/* alternation). Deeper = rougher; the sump sits at the lowest point.        */
/* ------------------------------------------------------------------------ */

const MINE: ArchetypeData = {
  archetype: 'mine',
  builderPatterns: ['the {N} Company', 'the {N} Mining Company', 'the {N} Consortium'],
  namePool: [
    'Deepvein',
    'Orefall',
    'Grayhammer',
    'Stonereach',
    'Coldseam',
    'Ironledger',
    'Silverbrace',
    'Redgall',
    'Duncastle',
    'Brakewell',
  ],
  titlePatterns: [
    'The {N} Workings',
    'The Old {N} Mine',
    'The {N} Delvings',
    'The Drowned {N} Workings',
  ],
  core: [
    // ROOM-SIZE ×2 (Remy 2026-07-07): dimension ranges scaled ≈×1.4 → ≈2× floor
    // area per chamber. The workings read as substantial caverns; the wide vein
    // size band is preserved so it stays varied, not an egg carton.
    // The adit is the narrow entry corridor-room driven in from the surface.
    { purpose: 'adit', w: [3, 4], h: [8, 13], shape: 'rect', anchor: 'entry', dir: 'flow', corridor: [0, 0] },
    { purpose: 'hoist', w: [10, 13], h: [10, 13], shape: 'rect', anchor: 'prev', dir: 'flow', corridor: [1, 3] },
    { purpose: 'tool-store', w: [6, 8], h: [6, 8], shape: 'rect', anchor: 'hoist', dir: 'left', corridor: [0, 1] },
    { purpose: 'barracks', w: [8, 11], h: [8, 11], shape: 'rect', anchor: 'hoist', dir: 'right', corridor: [0, 1] },
    // The sump is the LAST room the builder places — after all repeat units —
    // so it lands at the lowest point of the vein chase (Task 3 ordering).
    { purpose: 'sump', w: [7, 10], h: [7, 10], shape: 'ellipse', anchor: 'prev', dir: 'flow', corridor: [1, 3] },
  ],
  repeat: [
    // DEFECT B (egg monotony): vein-galleries span a WIDE size band — small
    // pockets (7-9) through large chambers (18-22) — so the read is varied cave
    // workings, not an egg carton. The builder additionally rolls an occasional
    // 'compound' chamber and a rectilinear timbered store-room mid-depth (see
    // buildIntact placeRepeats), so shape varies too, not just size.
    // Chambers along a drift connect chamber-to-chamber where adjacent: a short
    // door (corridor 0-2) butts the next chamber against the previous one, so the
    // player walks THROUGH the workings rather than down a hall poking into each.
    // The diagonal down-right descent still reads because each drift steps its
    // axis; the occasional longer gap is what a decline would be. (×2 size band.)
    { purpose: 'vein-gallery', w: [7, 22], h: [7, 22], shape: 'ellipse', anchor: 'prev', dir: 'flow', corridor: [0, 2] },
  ],
  floodable: ['vein-gallery', 'sump'],
  eventWeights: {
    flood: 3,
    collapse: 2,
    tunnel: 2,
    den: 3,
    plunder: 1,
    bloom: 1,
  },
};

/* ------------------------------------------------------------------------ */
/* Fortress — defensive logic: one way in through the gatehouse funnel, the  */
/* great hall as the hub, service wings flanking it, the chapel wing deepest */
/* from the gate. The builder draws the curtain-wall shell heavier than      */
/* interior partitions (Task 3).                                             */
/* ------------------------------------------------------------------------ */

const FORTRESS: ArchetypeData = {
  archetype: 'fortress',
  builderPatterns: ['the {N}', 'the Order of the {N}', 'the {N} garrison'],
  namePool: [
    'Pale Watch',
    'Grey Vigil',
    'Iron Ward',
    'Winter Guard',
    'Last Banner',
    'Cold March',
    'Broken Shield',
    'Ashen Standard',
  ],
  titlePatterns: ['The Fall of the {N}', 'The {N} Hold', '{N} Keep', 'The Ruin of the {N}'],
  core: [
    // ROOM-SIZE ×2 (Remy 2026-07-07): dimension ranges scaled ≈×1.4 → ≈2× floor
    // area. The great hall becomes a genuine baronial hall; service wings stay
    // proportionally smaller (hierarchy preserved). Cells stay 5 ft.
    { purpose: 'gatehouse', w: [8, 11], h: [8, 11], shape: 'rect', anchor: 'entry', dir: 'flow', corridor: [0, 0] },
    { purpose: 'great-hall', w: [14, 19], h: [13, 17], shape: 'rect', anchor: 'prev', dir: 'flow', corridor: [1, 2] },
    { purpose: 'barracks', w: [8, 11], h: [7, 10], shape: 'rect', anchor: 'great-hall', dir: 'left', corridor: [0, 1] },
    { purpose: 'armory', w: [7, 10], h: [6, 8], shape: 'rect', anchor: 'barracks', dir: 'flow', corridor: [0, 1] },
    { purpose: 'granary', w: [7, 10], h: [7, 10], shape: 'rect', anchor: 'great-hall', dir: 'right', corridor: [0, 1] },
    { purpose: 'kitchen', w: [7, 10], h: [6, 8], shape: 'rect', anchor: 'granary', dir: 'flow', corridor: [0, 1] },
    { purpose: 'chapel-wing', w: [10, 13], h: [8, 11], shape: 'rect', anchor: 'great-hall', dir: 'back', corridor: [3, 5] },
    { purpose: 'cellar', w: [7, 10], h: [7, 10], shape: 'rect', anchor: 'kitchen', dir: 'right', corridor: [1, 2] },
  ],
  repeat: [
    // 'prev' here means "any already-placed core room" — the builder picks
    // one seeded-at-random rather than strictly the last placed (Task 3).
    // Wing rooms interconnect room-to-room through a shared-wall door (corridor
    // 0-1), so a wing reads as a suite of adjoining chambers, not hall-fed cells.
    { purpose: 'passage-room', w: [6, 10], h: [6, 10], shape: 'rect', anchor: 'prev', dir: 'any', corridor: [0, 1] },
  ],
  floodable: ['cellar'],
  eventWeights: {
    fire: 2,
    'brick-off': 2,
    collapse: 1,
    den: 3,
    plunder: 2,
    flood: 1,
    bloom: 1,
  },
};

/* ------------------------------------------------------------------------ */
/* Waterworks — infrastructure logic: channels are the skeleton, dry         */
/* maintenance walks run alongside, everything meets at the junction         */
/* chamber, two round cisterns anchor the ends, entry is a ladder shaft      */
/* from the street plus the barred outfall.                                  */
/*                                                                           */
/* Built by the town, not a named family/company: '{T}' stays a literal      */
/* placeholder until Pillar 2 supplies the town name.                         */
/* ------------------------------------------------------------------------ */

const WATERWORKS: ArchetypeData = {
  archetype: 'waterworks',
  builderPatterns: ['the {T} wardens', 'the {T} undercity', 'the {T} works board'],
  // District/ward stems for channel and cistern names — grounded town-English.
  namePool: ['Lowgate', 'Millrace', 'Saltmarket', 'Bridgeward', 'Tanner Row', 'Rookery', 'Copperhill', 'Fleetditch'],
  townPlaceholder: 'the old town',
  titlePatterns: [
    'The Old {T} Sewers',
    'The Cisterns of {T}',
    'The {N} Channels',
    'The {T} Undercity',
  ],
  core: [
    // ROOM-SIZE ×2 (Remy 2026-07-07): chamber dimension ranges scaled ≈×1.4 → ≈2×
    // floor area (junction hall + round cisterns become cathedral-scale basins).
    // The maintenance-walk stays 3 cells WIDE — it is the channel-side corridor-
    // room, not a furniture chamber; only its LENGTH grows. Its fixed h==3 also
    // keeps the gozzysBlend skip + the drawer's wet-channel read intact.
    { purpose: 'ladder-shaft', w: [4, 6], h: [4, 6], shape: 'rect', anchor: 'entry', dir: 'flow', corridor: [0, 0] },
    // Corridor-like room, 3 cells wide, running alongside the channel.
    { purpose: 'maintenance-walk', w: [9, 14], h: [3, 3], shape: 'rect', anchor: 'prev', dir: 'flow', corridor: [0, 0] },
    { purpose: 'junction', w: [13, 17], h: [13, 17], shape: 'octagon', anchor: 'prev', dir: 'flow', corridor: [0, 1] },
    // Two cisterns anchor the ends, reached by long channels in opposite dirs.
    { purpose: 'cistern', w: [13, 17], h: [13, 17], shape: 'ellipse', anchor: 'junction', dir: 'left', corridor: [4, 7] },
    { purpose: 'cistern', w: [13, 17], h: [13, 17], shape: 'ellipse', anchor: 'junction', dir: 'right', corridor: [4, 7] },
    { purpose: 'outfall', w: [5, 7], h: [6, 8], shape: 'rect', anchor: 'junction', dir: 'back', corridor: [2, 4] },
  ],
  repeat: [
    { purpose: 'maintenance-walk', w: [9, 14], h: [3, 3], shape: 'rect', anchor: 'prev', dir: 'flow', corridor: [0, 1] },
    { purpose: 'passage-room', w: [6, 10], h: [6, 10], shape: 'rect', anchor: 'prev', dir: 'any', corridor: [1, 2] },
  ],
  floodable: ['cistern', 'maintenance-walk', 'junction', 'outfall'],
  eventWeights: {
    'brick-off': 2,
    tunnel: 2,
    collapse: 2,
    flood: 3,
    den: 3,
    bloom: 2,
  },
};

/* ------------------------------------------------------------------------ */

export const ARCHETYPES: Record<BuilderArchetype, ArchetypeData> = {
  mausoleum: MAUSOLEUM,
  mine: MINE,
  fortress: FORTRESS,
  waterworks: WATERWORKS,
};

/** Fungal is not a builder — its bloom event chain overtakes any archetype;
 * it maps to mausoleum and the theming comes from the bloom events. */
export const THEME_ARCHETYPE: Record<DungeonTheme, BuilderArchetype> = {
  crypt: 'mausoleum',
  cavern: 'mine',
  frost: 'fortress',
  sewer: 'waterworks',
  fungal: 'mausoleum',
};

/**
 * Purpose-driven furniture: what an intact room contains, placed for use.
 * `countPerCells` = one item per this many floor cells; 0 = exactly one item
 * regardless of room size (centerpiece convention).
 * `scale` = the drawn footprint multiplier the drawer applies to the glyph
 * (PreviewDungeon renders each piece at `cell * scale`). Default 1.
 *
 * ROOM-SIZE ×2 tuning (Remy 2026-07-07): after the room dimensions doubled in
 * area, furniture would otherwise just get PROPORTIONALLY MORE tiny pieces and
 * stay cramped. So the row/wall furniture that reads as a "packed 2-cell lattice"
 * (coffins, pews, tables, bunks, racks) gets BOTH a HIGHER countPerCells (fewer,
 * spread out — a spacious gallery with a real aisle) AND a LARGER scale (~1.6-1.9
 * → each coffin/pew occupies ~2-3 cells and reads as ONE distinct object). Scatter
 * clutter (grain-jars) and centerpieces keep their look.
 */
export const FURNITURE: Readonly<
  Partial<Record<RoomPurpose, readonly {
    kind: string;
    layout: 'rows' | 'walls' | 'center' | 'scatter';
    countPerCells: number;
    /** Drawn glyph footprint multiplier (default 1). Bigger = one distinct piece. */
    scale?: number;
  }[]>>
> = {
  // A burial gallery is now ~110 floor cells; at countPerCells 12 that is ~8-9
  // coffins, which the pitch-4 rows grid seats as 2 flanking FILES (central file
  // culled for the processional aisle) with a clear gap between each — a hall of
  // nameable sarcophagi, not a chained-segment carpet. scale 1.5 → each coffin is
  // ~2.5 cells long (Remy's "distinct piece occupying ~2-3 cells"), NOT so long it
  // touches its neighbour (which re-created the chained look at scale 1.9).
  'burial-gallery': [{ kind: 'sarcophagus', layout: 'rows', countPerCells: 12, scale: 1.5 }],
  chapel: [
    { kind: 'altar', layout: 'center', countPerCells: 0, scale: 1.6 },
    { kind: 'pew', layout: 'rows', countPerCells: 12, scale: 1.5 },
  ],
  ossuary: [{ kind: 'bone-niche', layout: 'walls', countPerCells: 7, scale: 1.4 }],
  treasury: [{ kind: 'chest', layout: 'center', countPerCells: 0, scale: 1.6 }],
  embalming: [{ kind: 'stone-slab', layout: 'center', countPerCells: 0, scale: 1.7 }],
  barracks: [{ kind: 'bunk', layout: 'walls', countPerCells: 9, scale: 1.5 }],
  armory: [{ kind: 'weapon-rack', layout: 'walls', countPerCells: 7, scale: 1.4 }],
  granary: [{ kind: 'grain-jar', layout: 'scatter', countPerCells: 6, scale: 1.3 }],
  'great-hall': [
    // A long-table is genuinely elongated; scale 1.8 reads as a refectory board.
    { kind: 'long-table', layout: 'rows', countPerCells: 22, scale: 1.8 },
    { kind: 'hearth', layout: 'walls', countPerCells: 60, scale: 1.6 },
  ],
  hoist: [{ kind: 'hoist-wheel', layout: 'center', countPerCells: 0, scale: 1.7 }],
  'tool-store': [{ kind: 'tool-rack', layout: 'walls', countPerCells: 7, scale: 1.4 }],
  // Cisterns are built empty — water, not furniture.
  cistern: [],
};
