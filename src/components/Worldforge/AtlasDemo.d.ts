/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/07/2026, 00:38:29
 * Dependents: App.tsx
 * Imports: 21 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This component provides an interactive developer dashboard to test and explore
 * the procedural world generation engine.
 *
 * It provides inputs for configuring world seed, heightmap template, and cell density,
 * triggers the procedural generation pipeline synchronously, and displays the map output
 * inside the canonical AtlasSvgView viewport. It also supports descending (clicking)
 * into a refined L1 local region view for any selected land cell.
 *
 * Called by: Dev sandbox, orchestrator proof rigs, or game setup screens.
 * Depends on:
 *   - generateAtlas.ts (L0 atlas generator)
 *   - generateRegion.ts (L1 region generator)
 *   - regionDraw.ts (pure L1 region renderer)
 *   - AtlasSvgView.tsx (canonical interactive L0 viewport)
 */
import React from "react";
import type { LocalArtifact, RegionArtifact } from "../../systems/worldforge/artifacts";
import { type OverlayMarker } from "./overlay";
import { type AtlasGroundDrilldown, type GroundFocus } from "../../systems/worldforge/leaf3d/atlasGroundDrilldown";
import type { DiscoveredHiddenSite } from "../../types/state";
/**
 * Convert the measured Worldforge workspace into a canvas size. Width follows
 * the real container so phone viewports do not receive a 480px-wide canvas that
 * spills offscreen; height keeps a small floor so hidden/initial measurements
 * still produce a drawable surface.
 */
export declare function measureAtlasDemoMapSize(rect: {
    width: number;
    height: number;
}): {
    width: number;
    height: number;
};
/**
 * Shared breadcrumb overlay classes. Phone layouts need explicit left and
 * right bounds plus wrapping because local-view coordinates can be longer than
 * the available map width; desktop keeps the original compact top-right strip.
 */
export declare const atlasDemoBreadcrumbClassName = "absolute top-20 left-2 right-2 z-20 flex max-w-[calc(100%-1rem)] flex-col items-start gap-1 px-3 py-2 bg-gray-900/85 backdrop-blur-md border border-gray-800 rounded-lg text-xs select-none shadow-xl sm:top-3 sm:left-auto sm:right-3 sm:max-w-[calc(100%-1.5rem)] sm:flex-row sm:items-center sm:gap-4";
export declare const atlasDemoBreadcrumbIdentityClassName = "flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 font-mono text-gray-400";
export declare const atlasDemoBreadcrumbHintClassName = "flex max-w-full items-start gap-1.5 text-[10px] text-gray-500 sm:items-center";
export interface AtlasHierarchyCrumb {
    tier: 'world' | 'cell' | 'region' | 'local' | 'town' | 'ground';
    label: string;
    current: boolean;
}
/**
 * Build the visible hierarchy from the artifacts currently retained by Atlas.
 * The list is additive rather than hard-coded to a terminal depth: future site,
 * building, room, and interior tiers can append crumbs without redefining the
 * existing World -> Cell -> Region -> Local -> Town -> Ground contract.
 */
export declare function atlasHierarchyCrumbs(input: {
    viewMode: 'atlas' | 'region' | 'local' | 'ground';
    selectedCellId: number | null;
    local: LocalArtifact | null;
    groundFocus?: GroundFocus | null;
}): AtlasHierarchyCrumb[];
interface AtlasDemoProps {
    /** Bind the atlas to the active run instead of exposing the standalone generator. */
    embeddedInGame?: boolean;
    /** Canonical game seed used by start selection, travel, 3D, and persistence. */
    worldSeed?: number;
    /** Hand the exact selected hierarchy to PLAYING's established ground scene. */
    onEnterPlayingGround?: (drilldown: AtlasGroundDrilldown) => void;
    /** Transient receipt used to restore the same Local after PLAYING ground closes. */
    groundReturnReceipt?: AtlasGroundDrilldown | null;
    /** Persistent hidden places discovered through the exact PLAYING Local. */
    discoveredHiddenSites?: DiscoveredHiddenSite[];
}
/**
 * Project versioned ground discoveries into the native Atlas overlay space.
 * Exact absolute feet work unchanged on L0, Region, and Local canvases because
 * their shared overlay renderer owns the feet-to-screen conversion.
 */
export declare function atlasDiscoveryMarkersForWorld(sites: DiscoveredHiddenSite[], worldSeed: number): OverlayMarker[];
/**
 * Resolve the exact Atlas hierarchy represented by a PLAYING return receipt.
 * This pure boundary makes object identity and the one-level Local return rule
 * deterministic enough to test without mounting the full FMG canvas.
 */
export declare function atlasHierarchyForGroundReturn(drilldown: AtlasGroundDrilldown | null | undefined): {
    viewMode: "atlas" | "local";
    selectedCellId: number | null;
    regionArtifact: RegionArtifact | null;
    localArtifact: LocalArtifact | null;
};
declare const AtlasDemo: React.FC<AtlasDemoProps>;
export default AtlasDemo;
