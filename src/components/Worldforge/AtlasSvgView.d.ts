/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 20/07/2026, 00:38:58
 * Dependents: components/DesignPreview/steps/PreviewStartSelect.tsx, components/MapPane.tsx, components/Worldforge/AtlasDemo.tsx, components/Worldforge/SpawnPreview.tsx, components/Worldforge/StartPointSelection.tsx
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
import type { FmgAtlasResult } from '../../systems/worldforge/fmg/generateAtlas';
import { type CellTraits, type AtlasSvgModel } from './atlasSvg';
import type { DungeonDangerSite } from '../../systems/worldforge/overlays/dangerField';
import type { RoutePlan } from '../../systems/travel/routePlanning';
import type { MultiModalRoute } from '../../systems/travel/multiModalRoute';
export interface AtlasSvgViewProps {
    atlas: FmgAtlasResult;
    width?: number;
    height?: number;
    /** Always-on "you are here" marker, in graph coords (SP0 T7). */
    marker?: {
        x: number;
        y: number;
    } | null;
    /**
     * Bump this to fire a short "look here!" pulse around the marker (e.g. when a
     * town is selected on the start screen). Each new value restarts the pulse, so
     * switching markers stops the old one and starts a fresh one at the new spot.
     */
    pulseToken?: number | null;
    /** Discovered-place pins, in graph coords (SP4 atlas pins). */
    markers?: Array<{
        x: number;
        y: number;
        label?: string;
    }>;
    /** Fired with the picked cell's traits on click (SP0 T7). */
    onPickCell?: (info: CellTraits) => void;
    /** Travel mode: when true, hovering a cell previews the fastest route to it. */
    travelActive?: boolean;
    /** Plan the fastest route from the player to a hovered cell id (MapPane supplies). */
    planRoute?: (toCell: number) => RoutePlan | null;
    /** Plan a pre-segmented mixed land/sea route for the hovered cell. */
    planMultiModalRoute?: (toCell: number) => MultiModalRoute | null;
    /**
     * Hired-ferry fare (gp) for a previewed multimodal route, appended to the
     * readout so the player sees the cost before committing (travel G15). Returns
     * null when no fare applies (owned ship, all-land trip, or non-ferry mode).
     */
    ferryFareForRoute?: (route: MultiModalRoute) => number | null;
    /**
     * Faint-path warning for a previewed land route: true when the route follows
     * a faint forest path, so the readout warns the player the trail can fade
     * (a get-lost risk) BEFORE they commit. MapPane owns the atlas nav info and
     * supplies the check; this just renders the appended warning.
     */
    faintPathForRoute?: (route: RoutePlan) => boolean;
    /**
     * Name of the largest named forest a previewed land route crosses, or null
     * when it crosses none. MapPane owns the atlas forests and supplies the
     * lookup; this just renders the appended "through the <Name>" piece.
     */
    forestNameForRoute?: (route: RoutePlan) => string | null;
    /**
     * Name of the FIRST named mountain pass a previewed land route crests, or
     * null when it crests none. MapPane owns the atlas passes and supplies the
     * lookup; this just threads the value into the readout ("via <Name>" —
     * formatRouteSummary owns the pass-beats-forest one-flavor-clause rule).
     */
    passNameForRoute?: (route: RoutePlan) => string | null;
    /** Transport label for the travel readout (e.g. "on foot", "by horse"). */
    transportLabel?: string;
    /**
     * Provisioning rings (travel logistics): one glowing contour per resource
     * horizon. MapPane passes the in-range cell set for each binding resource
     * (food, water) so the player sees how far current supplies reach BEFORE
     * clicking. Two rings appear only when the food and water horizons differ.
     */
    provisionRings?: Array<{
        cellIds: number[];
        color: string;
        label?: string;
    }>;
    /**
     * Provisions readout for the hovered route's duration (minutes): the line of
     * supply the trip would cost ("Food: 6 days" / "Water: 2 days · short 1 day").
     * MapPane owns the provisioning math; this just renders the returned string.
     */
    provisionLineForMinutes?: (minutes: number) => {
        text: string;
        color: string;
    } | null;
    /**
     * Scope for persisted layer prefs (map coloring + feature toggles). Pass a
     * stable per-world/per-save id (e.g. the world seed) so different campaigns
     * remember different views; omit for a single shared/global scope.
     */
    prefsScope?: string | number;
    /**
     * How the world is fitted into the (width × height) viewport when the box
     * aspect ratio differs from the world's.
     *  - `'contain'` (default): scale by the tighter axis so the WHOLE world is
     *    visible. The leftover area along the looser axis is painted as continuous
     *    ocean (a full-viewport sea backdrop), NOT a flat dark letterbox band, so
     *    a non-aspect-matched container (e.g. a full panel) reads as one seamless
     *    map rather than a map sandwiched between empty bars.
     *  - `'cover'`: scale by the looser axis so the world FILLS the viewport with
     *    no margins, cropping the overflowing edge. Opt-in — callers that hand an
     *    aspect-matched box (StartPointSelection) are unaffected either way, since
     *    contain == cover when the aspects already match.
     */
    fitMode?: 'contain' | 'cover';
    /**
     * Pillar 2, Task 8 (living ecology): live dungeon-site states for the danger
     * overlay. Each UNCLEARED site bumps the danger field around its cell, so the
     * overlay visibly reacts to nearby uncleared dungeons. Omit for the pre-Task-8
     * field (the danger term is flag-gated — no sites means byte-identical output).
     */
    dungeonSites?: ReadonlyArray<DungeonDangerSite>;
    /**
     * Optional model already built by the responsive atlas worker. MapPane passes
     * this so opening or regenerating a world never performs the pure path merge
     * on the interaction thread. Other established callers may omit it and keep
     * the original synchronous behavior.
     */
    preparedModel?: AtlasSvgModel;
}
/**
 * Return the fit-view label budget used by the full zoom-aware display policy.
 * This compatibility export keeps existing callers and focused tests on the
 * same small-viewport contract while settlementDisplayBudget owns expansion.
 */
export declare function labelBudgetForViewport(width: number, height: number): number;
declare const AtlasSvgView: React.FC<AtlasSvgViewProps>;
export default AtlasSvgView;
