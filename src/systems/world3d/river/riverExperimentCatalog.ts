/** Names the small studies beside the river and their honest evidence limits.
 * Adding a descriptor creates another isolated platform. Frozen failures never
 * become runnable merely because a scene displays their saved geometry.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/10/2026, 11:20:35
 * Dependents: components/World3D/water/RiverExperimentPanel.tsx, components/World3D/water/riverExperimentStations.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export interface RiverExperimentDescriptor {
  id: string;
  name: string;
  status: string;
  summary: string;
  limitation: string;
  mode: 'stored' | 'live';
  /** Uniform display magnification changes presentation only, never physics. */
  displayScale: number;
}
export const RIVER_EXPERIMENTS: readonly RiverExperimentDescriptor[] = [
  {id:'oblique-interface',name:'Oblique interface',status:'Reconstruction failed',mode:'stored',displayScale:25,summary:'Shared transport retained the paired thin slab, but its reconstruction moved the mean center by 0.0433249 m; the limit is 0.00625 m. Accepted time remains 0 s.',limitation:'Before and rejected states are actual captured faces. Diagnostic appearance only; no accepted cascade motion.'},
  // Keep the complete tall U visible from the same inspection camera as the pools.
  {id:'connected-basin',name:'Connected U basin',status:'Retained pressure control',mode:'stored',displayScale:3,summary:'Stored liquid in the connected U-shaped control. The local pressure solve reduced its reported divergence without adding or deleting occupied water.',limitation:'A retained local pressure check does not qualify general pressure, transport or waterfall motion. Original solver source hashes were not recorded in this capture.'},
  {id:'source-pool',name:'Source on / off pool',status:'Live shallow-water study',mode:'live',displayScale:1,summary:'A separate small basin uses the existing native shallow-water solver. Source changes preserve water already admitted.',limitation:'Depth-averaged surface flow only. No 3D free fall, air entrainment or waterfall acceptance. Runs only while selected.'},
];
export type ExperimentPoint = [number,number,number];
export interface RiverExperimentCapture {
  schema: number;
  id: string;
  captureSha256: string;
  capturePath: string;
  time: number | null;
  solverSources: Record<string,string> | null;
  receipt: Record<string,unknown>;
  states: Array<{id:string;label:string;kind:'retained'|'rejected';pieces:ExperimentPoint[][][]}>;
}
