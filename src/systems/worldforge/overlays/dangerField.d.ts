/**
 * @file dangerField.ts — PROTOTYPE (2026-06-26). The first Worldforge map layer
 * DERIVED FROM WORLD STATE rather than read straight from the generator pack.
 *
 * Branch: "layers that mean something" + "controlled blending". Most atlas
 * overlays (biomes, states, temperature) are static facts of the generated
 * world. This one answers a question a PARTY actually has mid-adventure — "where
 * is it dangerous to go?" — by fusing the (previously inert) event zones
 * (wars / plagues / disasters) with terrain hostility and bleeding the threat
 * outward from its source.
 *
 * It is intentionally a heuristic first cut. The architecture is the point: a
 * pure `(atlas, opts) => per-cell scalar field` that a ramp/hatch renderer
 * consumes. The same shape extends to:
 *   - TIME SCRUBBER: pass the world state at time T (zones/factions then).
 *   - GAMEPLAY: feed real encounter tables, faction aggression, bounty levels.
 *   - KNOWN-VS-RUMORED: mask the field by what the party has actually learned.
 */
import type { FmgAtlasResult } from '../fmg/generateAtlas';
/**
 * One dungeon site's danger contribution (Pillar 2, Task 8). A site whose apex
 * occupation is still UNCLEARED radiates a modest LOCAL danger bump around its
 * cell — a den that raids the neighbourhood, not a war that engulfs a province.
 * Cleared sites contribute nothing. `strength` overrides the default per-site
 * bump (0..1 at the site's own cell); omit for the standard local threat.
 */
export interface DungeonDangerSite {
    cellId: number;
    cleared: boolean;
    /** Peak danger at the site cell (0..1). Defaults to DUNGEON_SITE_STRENGTH. */
    strength?: number;
}
export interface DangerFieldOptions {
    /** How far (cell rings) zone threat bleeds outward; each ring decays by `falloff`. */
    spreadRings?: number;
    falloff?: number;
    /** Per-ring zone weight multiplier applied before falloff (tunes overall intensity). */
    intensity?: number;
    /**
     * Dungeon sites (Pillar 2, Task 8). Each UNCLEARED site adds a BFS-bled local
     * danger bump around its cell (same ring-bleed as zones, but a shorter reach
     * and a modest weight — a local threat, not a war). OMITTING this leaves the
     * output byte-identical to the pre-Task-8 field (flag-gated; the function
     * stays pure). Cleared sites are ignored.
     */
    dungeonSites?: ReadonlyArray<DungeonDangerSite>;
}
/** Default peak danger at an uncleared dungeon site's own cell (0..1). Modest:
 * a den bleeds the neighbourhood, it does not saturate a region like a war. */
export declare const DUNGEON_SITE_STRENGTH = 0.45;
/**
 * Compute a per-cell danger scalar in [0,1], indexed by FMG cell id. Land cells
 * only (water = 0). Deterministic: pure function of the atlas pack.
 */
export declare function computeDangerField(atlas: FmgAtlasResult, opts?: DangerFieldOptions): Float32Array;
export interface DangerCell {
    i: number;
    danger: number;
}
/**
 * Cells whose danger clears `threshold`, with their scalar — the render input for
 * the hatch overlay. Below threshold a cell reads as "safe" and is left unhatched
 * so the base coloring stays clean (controlled blending, not mud).
 */
export declare function dangerCellsAbove(field: Float32Array, threshold?: number): DangerCell[];
