/**
 * The reflection and main camera draw the same opaque river objects within a
 * frame. Refresh those objects' world positions once, then let both cameras
 * reuse them. Camera transforms, lights, material updates and draw calls still
 * run normally. Restore the scene's original update policy even if a pass fails.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 03:28:50
 * Dependents: components/World3D/water/riverReachScene.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

interface MatrixScene {
  matrixWorldAutoUpdate: boolean;
  updateMatrixWorld: () => void;
}

export function shareRiverWorldMatrices(scene: MatrixScene, drawPasses: () => void): void {
  const automatic = scene.matrixWorldAutoUpdate;
  if (automatic) scene.updateMatrixWorld();
  scene.matrixWorldAutoUpdate = false;
  try { drawPasses(); } finally { scene.matrixWorldAutoUpdate = automatic; }
}
