/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 14:18:09
 * Dependents: App.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/components/Worldforge/MapSurfaceToggle.tsx
 * Floating toggle between the normal game view and the full atlas explorer.
 * Both routes use the same canonical AtlasSvgView at world level; the saved
 * `classic` and `worldforge` values remain unchanged for compatibility.
 *
 * Mounted as a fixed overlay in the PLAYING phase so it is reachable from
 * either surface. Dispatches SET_MAP_SURFACE via the useMapSurface hook.
 */
import React from 'react';
declare const MapSurfaceToggle: React.FC;
export default MapSurfaceToggle;
