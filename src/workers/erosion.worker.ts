// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 27/02/2026, 09:35:42
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// import { HydraulicErosion } from '../components/ThreeDModal/Experimental/HydraulicErosion';

// Simplified worker that does nothing for now to fix build
/*
self.onmessage = async (e: MessageEvent) => {
  const { heightMap, iterations } = e.data;
  const eroded = HydraulicErosion.erode(heightMap, iterations);
  self.postMessage(eroded);
};
*/
self.onmessage = (e: MessageEvent) => {
    // Echo back the data
    self.postMessage(e.data.heightMap);
};
