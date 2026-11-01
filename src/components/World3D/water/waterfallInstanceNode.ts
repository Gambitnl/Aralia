/**
 * Keeps the native droplet matrix/normal shader, while forwarding its changed
 * matrix prefix to Three's internal WebGPU instance buffer. The installed Three
 * version forwards only the version, otherwise uploading all reserved droplets.
 * This adapter is local to the waterfall glyphs; it changes no water or optics.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/10/2026, 22:05:50
 * Dependents: components/World3D/water/waterfallContactView.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { nodeObject, positionLocal } from 'three/tsl';

export class WaterfallInstanceNode extends THREE.InstancedMeshNode {
  // Present in this Three implementation, but omitted from its declaration.
  declare buffer: THREE.InstancedInterleavedBuffer | null;

  override update(frame: THREE.NodeFrame): void {
    const changed = this.buffer && this.instanceMatrix.version !== this.buffer.version;
    if (changed) {
      this.buffer!.clearUpdateRanges();
      for (const range of this.instanceMatrix.updateRanges) {
        this.buffer!.addUpdateRange(range.start, range.count);
      }
    }
    // Native version propagation prevents later depth/reflection draws from
    // uploading the same matrices again after consuming the first range.
    super.update(frame);
  }
}

/** These fixed glyphs have no morphs, skinning or displacement. Use the native
 * instancing node's full position/normal transform with the upload adapter. */
export class WaterfallGlyphMaterial extends THREE.NodeMaterial {
  override setupPosition(builder: THREE.NodeBuilder): THREE.Node {
    nodeObject(new WaterfallInstanceNode(builder.object as THREE.InstancedMesh)).append();
    return positionLocal;
  }
}
