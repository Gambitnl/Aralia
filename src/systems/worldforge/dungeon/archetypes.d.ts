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
import type { BuilderArchetype, DungeonTheme, EventKind, RoomPurpose, RoomShape } from './types';
export interface RoomSpec {
    purpose: RoomPurpose;
    w: readonly [number, number];
    h: readonly [number, number];
    shape: RoomShape;
    /** Where it attaches: 'entry' (map edge), 'prev' (last placed), a purpose name, or 'spine'. */
    anchor: 'entry' | 'prev' | 'spine' | RoomPurpose;
    /** Preferred attach direction relative to the plan's flow axis. */
    dir: 'flow' | 'left' | 'right' | 'back' | 'any';
    corridor: readonly [number, number];
}
export interface ArchetypeData {
    archetype: BuilderArchetype;
    /** Builder identity pools — a name is picked per dungeon, e.g. "the Marrowick family". */
    builderPatterns: readonly string[];
    namePool: readonly string[];
    /** Dungeon display-name patterns using real facts: '{N}' builder stem, '{P}' place noun. */
    titlePatterns: readonly string[];
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
export declare const ARCHETYPES: Record<BuilderArchetype, ArchetypeData>;
/** Fungal is not a builder — its bloom event chain overtakes any archetype;
 * it maps to mausoleum and the theming comes from the bloom events. */
export declare const THEME_ARCHETYPE: Record<DungeonTheme, BuilderArchetype>;
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
export declare const FURNITURE: Readonly<Partial<Record<RoomPurpose, readonly {
    kind: string;
    layout: 'rows' | 'walls' | 'center' | 'scatter';
    countPerCells: number;
    /** Drawn glyph footprint multiplier (default 1). Bigger = one distinct piece. */
    scale?: number;
}[]>>>;
