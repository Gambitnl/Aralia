/**
 * @file dungeonSites.ts — Pillar 2, Task 1: enumerate a world's dungeon SITES
 * from the real atlas.
 *
 * A "site" is a placeable dungeon opportunity BEFORE any interior is generated:
 * where it is (cellId / burg), how you get in (entranceKind), and what flavor it
 * is (theme + builder archetype). Later tasks turn a site into DungeonParams
 * (deriveIdentity), a chronicle, and a real interior. This module is pure and
 * cached per world seed, exactly like `getBridgeAtlas`.
 *
 * SOURCES (Level 1):
 *  (a) FMG markers of types dungeons / caves / necropolises / disturbed-burials
 *      → a site AT the marker's cell. We bind to the ATLAS-LEVEL `atlas.markers`
 *      (== `pack.markers`, the materialized POI list carried on the cached
 *      world result — generateWorld.ts:404, features Marker{ i, type, cell,
 *      x, y }). These markers are placed with `Math.random` during world gen,
 *      but the atlas is generated ONCE per seed and cached, so the marker list
 *      is stable for the life of the process — every `enumerateDungeonSites`
 *      call reads the same frozen list. We bind here (not to per-region
 *      RegionArtifact.markers) because pack markers carry the `cell` id we need
 *      to anchor identity to the site's cell; region markers only carry Feet
 *      x/y and are materialized lazily per region, so they are neither global
 *      nor cell-addressed. posFt comes from `pack.cells.p[cell] ×
 *      FEET_PER_FMG_PIXEL` (same convention as describeCell).
 *  (b) Burgs with `temple === 1` → a 'temple-stair' crypt under the temple, at
 *      the burg's cell. sitePath `wf:<seed>/burg:<burgId>/dungeon:crypt`.
 *  (c) Sewers are CAPPED per state: among a state's walled burgs, only the
 *      single most populous one qualifies (ties broken by capital flag, then
 *      lowest burg id), and only if its population ≥ 10 (≥10k souls). That
 *      keeps sewer counts near "one per sizable state" instead of ~10× every
 *      other source. sitePath `wf:<seed>/burg:<burgId>/dungeon:sewer`.
 *
 * CIVILIZATION ARCHAEOLOGY (Task 2, origin 'civ') — dungeons the WORLD'S OWN
 * generated history placed. Read from `pack.zones` (the FMG event zones the
 * danger field also consumes — Zone{ i, name, type, cells }) and mountain
 * terrain. Every civ site records WHY in `provenance`, which Task 4's chronicle
 * quotes. All deterministic (new `s:civ-sites` stream only), deduped by cellId
 * against the sources above (marker/temple/sewer WIN a shared cell), and capped
 * ≤ 3 per state:
 *  (d) WAR zones (types Invasion / Rebels / Crusade — armed conflict, NOT
 *      peaceful Proselytism) → one 'fortress'-archetype border-fortress ruin on
 *      the zone's COMMANDING cell (highest land cell; ties → lowest cellId).
 *      Theme 'frost' when temp ≤ −2 °C, else 'crypt' (theme and archetype vary
 *      independently — generateDungeon's params.archetype overrides the
 *      theme→archetype default; archetype drives structure, theme palette).
 *      sitePath `wf:<seed>/cell:<cell>/dungeon:z<zoneId>`.
 *  (e) PLAGUE zones (type Disease) touching a burg (seat cell in or adjacent to
 *      a zone cell) → one 'mausoleum' necropolis crypt at that burg's cell.
 *      sitePath `wf:<seed>/cell:<cell>/dungeon:z<zoneId>`.
 *  (f) MINES → 'mine'-archetype cave-mouths on mountain cells (h ≥ 70) within
 *      graph radius 4 of a live burg. World budget ≤ ~1 per two states, ≤ 1 per
 *      state, filled by a seeded shuffle of the candidate cells (stable per
 *      seed). sitePath `wf:<seed>/cell:<cell>/dungeon:mine`.
 * Zone-derived paths key on the zone id (`z<zoneId>`) so two zones sharing a
 * commanding cell can't collide; mines use the fixed `mine` suffix (deduped by
 * cell, so ≤ 1 per cell). None can collide with `dungeon:m<markerId>` because a
 * civ candidate cell already holding a marker site is skipped.
 *
 * Determinism: no Math.random here. The only randomness is the seeded
 * weighted theme pick for ambiguous `dungeons` markers, drawn on a NEW named
 * stream (`s:site-theme`) off the site's own path — so it cannot perturb any
 * existing worldforge golden. Output is sorted (cellId, entranceKind, burgId)
 * for a stable order.
 *
 * Traps honored (recon §Traps): identity anchors to the marker/burg cell,
 * never the player's streamed cell; burg loops skip i===0 / removed; frozen
 * seed grammar (new draws on new streams only). Zero THREE imports.
 */
import type { Feet } from '../../units';
import type { SeedPath } from '../../seedPath';
import type { DungeonTheme, BuilderArchetype } from '../types';
export type EntranceKind = 'ruin-door' | 'cave-mouth' | 'temple-stair' | 'sewer-grate';
/** 'civ' is reserved for Task 2 archaeology sites; sewers are 'town'. */
export type SiteOrigin = 'marker' | 'temple' | 'town' | 'civ';
/**
 * Why a `civ`-origin site exists — the world-history fact that grounds it.
 * Task 4's chronicle quotes these (the real zone name, e.g. "the War of the
 * Onerean Occupation"). Only civ sites carry provenance.
 * - `war-zone`: a border-fortress ruin left by an armed conflict zone.
 * - `plague-zone`: a necropolis crypt swollen by a Disease zone's dead.
 * - `ore-mountain`: a delved mine on high ground worked out of a nearby burg.
 */
export interface SiteProvenance {
    kind: 'war-zone' | 'plague-zone' | 'ore-mountain';
    zoneId?: number;
    zoneName?: string;
}
/**
 * A dungeon opportunity anchored to the world, before any interior exists.
 * `posFt` is the site mouth in Worldforge feet (atlas cell center × feet/px).
 */
export interface DungeonSite {
    sitePath: SeedPath;
    cellId: number;
    burgId?: number;
    entranceKind: EntranceKind;
    theme: DungeonTheme;
    archetype: BuilderArchetype;
    origin: SiteOrigin;
    /** Marker `i` for 'marker'-origin sites; absent otherwise. */
    markerRef?: number;
    /** Present only for 'civ'-origin sites — the world-history fact behind them. */
    provenance?: SiteProvenance;
    posFt: {
        x: Feet;
        y: Feet;
    };
}
/** Legal (theme, archetype) pairs, by construction. Exported for tests. */
export declare const THEME_ARCHETYPE: Record<DungeonTheme, BuilderArchetype>;
/**
 * Enumerate every Level-1 dungeon site for a world. Cached per seed (the atlas
 * it reads is itself cached, so the result is stable across calls).
 */
export declare function enumerateDungeonSites(worldSeed: number): DungeonSite[];
