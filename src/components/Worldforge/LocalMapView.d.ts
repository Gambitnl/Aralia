/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/07/2026, 22:34:53
 * Dependents: components/Worldforge/AtlasDemo.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from "react";
import type { LocalArtifact } from "../../systems/worldforge/artifacts";
import { type GroundFocus } from "../../systems/worldforge/leaf3d/atlasGroundDrilldown";
import { type OverlayMarker } from "./overlay";
/**
 * Interactive viewport for the L2 LOCAL layer (3,000 ft / 600×600 5-ft
 * cells) — the third step of the Worldforge zoom chain (Atlas → Region →
 * LOCAL) and the visual quality bar for replacing the legacy Submap
 * (Remy's 2026-06-11 focus). Mirrors RegionMapView's interaction grammar:
 * drag-pan, wheel zoom toward cursor, zoom-out-past-floor or Esc to ascend.
 *
 * Terrain caching: the artifact rasterizes ONCE per seedPath into a
 * native-resolution (600×600) offscreen canvas; pans/zooms blit it scaled.
 * Feature glyphs redraw at view scale each frame so they stay crisp.
 */
export interface LocalMapViewProps {
    local: LocalArtifact;
    width?: number;
    height?: number;
    onAscend: () => void;
    /** Atlas biome hue — carries the L0→L1→L2 coherence chain (localDraw). */
    biomeColor?: string;
    onEnterGround?: (focus: GroundFocus) => void;
    /** Exact-feet discoveries belonging to this canonical world/Local. */
    markers?: OverlayMarker[];
}
/**
 * L2 map readout placement. The Worldforge shell owns the top-left mobile
 * controls, so the local identity chip drops below that stack on phone widths
 * while preserving the original top-left position on desktop.
 */
export declare const localMapInfoChipClassName = "absolute top-40 left-2 right-2 z-10 bg-gray-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-gray-800 pointer-events-none select-none font-mono sm:top-4 sm:left-4 sm:right-auto";
declare const _default: React.NamedExoticComponent<LocalMapViewProps>;
export default _default;
