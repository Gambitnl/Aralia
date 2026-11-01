/** Render-only counterpart to groundChunkWorker: reuse its canonical sampler
 * and the shared mesh algorithms, keeping moving detail off the browser thread.
 * Inputs are cloned, not transferred. No player or authoritative ground is edited. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 02:25:41
 * Dependents: components/World3D/useFootingMeshes.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { groundSurfaceY, type GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { buildFootingMeshes, footingMeshTransfers, type FootingMeshRequest } from '@/systems/world3d/footingMeshJob';

export type FootingSamplerSource = Pick<GroundWorld, 'cols' | 'rows' | 'heights'>;
export type FootingWorkerRequest = { type: 'init'; ground: FootingSamplerSource }
  | { type: 'build'; request: FootingMeshRequest };
export type FootingWorkerResponse = { id: number; outputs: ReturnType<typeof buildFootingMeshes> }
  | { id: number; error: string };
let ground: FootingSamplerSource | undefined;
self.onmessage = (event: MessageEvent<FootingWorkerRequest>) => {
  const message = event.data;
  if (message.type === 'init') { ground = message.ground; return; }
  if (!ground) return;
  const source = ground;
  try {
    // groundSurfaceY reads precisely cols, rows and heights. Keeping that source
    // subset avoids copying residents/buildings to a drawing-only worker.
    const outputs = buildFootingMeshes(message.request, (x, z) => groundSurfaceY(source as GroundWorld, x, z));
    self.postMessage({ id: message.request.id, outputs } satisfies FootingWorkerResponse, { transfer: footingMeshTransfers(outputs) });
  } catch (error) {
    self.postMessage({ id: message.request.id, error: String(error) } satisfies FootingWorkerResponse);
  }
};
