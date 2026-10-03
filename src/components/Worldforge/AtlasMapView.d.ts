/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 20/07/2026, 00:39:28
 * Dependents: None (Orphan)
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This component provides an interactive map viewer for the procedural atlas.
 *
 * It embeds a 2D canvas, handles user interactions for panning and zooming,
 * and calls the pure draw core to redraw the map cells, coastlines, and rivers.
 * To optimize rendering performance during pan actions, it caches the drawn
 * layers onto an offscreen canvas. Panning simply copies the offscreen canvas,
 * whereas zooming invalidates the cache and triggers a redraw.
 *
 * The duplicate world-map route no longer imports this component. It remains
 * isolated as reference-only canvas code while a separate deletion audit can
 * decide whether any rendering ideas still deserve migration; current game and
 * developer surfaces use AtlasSvgView instead.
 *
 * Called by: no runtime screen.
 * Depends on: atlasDraw.ts (for the retained canvas reference), generateAtlas.ts
 */
import React from "react";
import { type AtlasOverlayMode, type AtlasView } from "./atlasDraw";
import type { FmgAtlasResult } from "../../systems/worldforge/fmg/generateAtlas";
import { type OverlayMarker } from "./overlay";
export interface AtlasMapViewProps {
    /** The generated atlas data from the FMG procedural engine. */
    atlas: FmgAtlasResult;
    /** Width of the map canvas container in pixels. Default is 960. */
    width?: number;
    /** Height of the map canvas container in pixels. Default is 540. */
    height?: number;
    /** Toggle scale bar rendering. Default is true. */
    showScaleBar?: boolean;
    /** Toggle graticule grid rendering. Default is false. */
    showGraticule?: boolean;
    /** Toggle political overlay rendering. Default is false. */
    showPolitical?: boolean;
    /** Mutually exclusive atlas cell tint source. Political remains the default mode. */
    overlayMode?: AtlasOverlayMode;
    showMarkers?: boolean;
    showZones?: boolean;
    showMilitary?: boolean;
    /** Voronoi cell mesh overlay (Azgaar "Cells" layer). Default false. */
    showCells?: boolean;
    /** Callback triggered when a Voronoi cell is clicked (scroll auto-descend). */
    onCellClick?: (cellId: number) => void;
    /** Callback triggered when a cell is selected by a pointer click (inspect). */
    onCellSelect?: (cellId: number) => void;
    /** Currently selected cell id to highlight, or null for none. */
    selectedCellId?: number | null;
    /** Travel mode: shows the cell mesh and highlights the cell under the cursor. */
    travelMode?: boolean;
    /** Optional viewport parameters to restore. */
    initialView?: AtlasView;
    /** Optional callback to notify viewport parameter updates. */
    onViewChange?: (view: AtlasView) => void;
    /** If true, zoom auto-descent is disabled. */
    cooldownActive?: boolean;
    /** Optional array of live overlay markers. */
    markers?: OverlayMarker[];
}
declare const _default: React.NamedExoticComponent<AtlasMapViewProps>;
export default _default;
