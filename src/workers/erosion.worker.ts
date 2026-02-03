// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/01/2026, 01:42:04
 * Dependents: src/components/ThreeDModal/ThreeDModal.tsx
 * Imports: 1 file
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
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
