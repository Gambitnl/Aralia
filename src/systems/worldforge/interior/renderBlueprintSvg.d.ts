/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 15:47:14
 * Dependents: components/DesignPreview/steps/PreviewBlueprint.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file renderBlueprintSvg.ts
 * @description Pure 2D module-map blueprint renderer over a BlueprintPlan.
 *
 * Task 11 of the Building Blueprint Pipeline. Takes the canonical
 * `BlueprintPlan` (Tasks 1-8: irregular footprints, cells-based rooms, wall
 * RUNS with real thickness, spatial door swings, per-room windows) and returns
 * an SVG string. No DOM, no React, no three.js, no RNG — deterministic pure
 * string building, so it runs headless for golden rendering and in the
 * browser alike.
 *
 * Sheet furniture (round-1 critique fixes folded in):
 *  - walls drawn from `wallRuns` at true `thicknessFt`, straddling the line
 *  - doors: 3 ft leaves (data-door-ft, never a full 5 ft cell) with a swing
 *    arc driven by `openDir`/`swingInto`, plus jambs in the 5 ft opening
 *  - windows as glazing ticks (data-window) across the outer wall band
 *  - floor lighting clamped: the radial gradient's radius covers the far
 *    corner and its darkest stop stays warm — corner cells never go near-black
 *  - room purpose labels at `room.anchor` (dominant-baseline centered),
 *    abbreviated/wrapped to fit, DROPPED entirely when the room is too small
 *  - room numbers (data-room-num) + a keyed legend beside the sheet
 *  - graphic scale bar (data-scale-bar), north arrow, title block with
 *    building type / floor name / seed (options arg)
 *  - exterior apron tint around the footprint, doorstep + entry arrow
 */
import type { BlueprintPlan, RoofPlan } from './blueprintTypes';
import { type BuildingOccupancy } from './occupancy';
import type { ContainerManifest } from './manifests';
/** Estimated glyph advance as a fraction of font-size (serif, ~worst case). */
export declare const LABEL_CHAR_W = 0.62;
/**
 * Fit a label into `maxPx` at font-size `fs`: full text, else a 2-line wrap
 * (when `maxLines` allows), else an abbreviation, else null (DROP the label —
 * a too-small room gets no label rather than ink across its walls).
 */
export declare function fitLabel(label: string, maxPx: number, fs: number, maxLines?: number): string[] | null;
export interface RenderBlueprintOptions {
    /** Shown in the title block when provided (the plan itself carries no seed). */
    seed?: number | string;
    /**
     * Living-overlay extras (Task 13 — ALL optional and additive; existing
     * callers unchanged). When `occupancy` is present a `<g data-occupancy>`
     * group is appended: room claim labels (data-claim), one dot per member at
     * their station for `hour` (data-station), a warm halo on lit hearths
     * (data-hearth-halo), and container markers with `<title>` tooltips listing
     * the manifest entries (data-container). The overlay reads ONLY from these
     * passed objects — never from the generator.
     */
    occupancy?: BuildingOccupancy;
    manifests?: ContainerManifest[];
    /** Hour of day 0–23 for the station dots + hearth state. Default 12. */
    hour?: number;
    /** Household members, indexed like OccupantStation.memberIndex; a dot is
     *  labeled with the member's GIVEN name (first token of `name`). */
    members?: ReadonlyArray<{
        name: string;
    }>;
    /**
     * Solved roof overlay (BGv2 Task 6 — optional and additive like the
     * occupancy extras). When present a `<g data-roof>` group is drawn OVER the
     * floor plan in the sheet's drafting ink: plane outlines faintly tinted
     * (data-roof-plane), ridges solid (data-roof-ridge), valleys dashed
     * (data-roof-valley), chimneys as small filled squares (data-roof-chimney),
     * dormers as carets (data-roof-dormer), tower caps hatched (data-roof-cap).
     * Roof coordinates are plan feet — the same frame as the rooms; the eave
     * overhang extends past the walls onto the apron.
     */
    roof?: RoofPlan;
}
/** Render one floor of a BlueprintPlan as a module-style blueprint SVG string. */
export declare function renderBlueprintSvg(plan: BlueprintPlan, level: number, options?: RenderBlueprintOptions): string;
