/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/07/2026, 10:13:14
 * Dependents: components/Worldforge/AtlasDemo.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from "react";
import type { RegionArtifact } from "../../systems/worldforge/artifacts";
import { type OverlayMarker } from "./overlay";
export interface RegionMapViewProps {
    region: RegionArtifact;
    width?: number;
    height?: number;
    onAscend: () => void;
    markers?: OverlayMarker[];
    /**
     * Click-to-descend into the L2 LOCAL layer (zoom chain step 3). Called
     * with the clicked point in FEET (region/world space) when the pointer
     * travels < 5 px between down and up (i.e., a click, not a pan).
     */
    onDescend?: (xFt: number, yFt: number) => void;
    /** Anchor cell's atlas biome color — see RegionDrawOptions.biomeColor. */
    biomeColor?: string;
}
/**
 * L1 map readout placement. On cramped map panes the global Worldforge
 * controls occupy the top-left corner, so this chip moves below them without
 * changing the desktop placement.
 */
export declare const regionMapInfoChipClassName = "absolute top-40 left-2 right-2 z-10 bg-gray-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-gray-800 pointer-events-none select-none font-mono sm:top-4 sm:left-4 sm:right-auto";
declare const _default: React.NamedExoticComponent<RegionMapViewProps>;
export default _default;
