/** Release the river view's shared GPU attributes once when the whole view closes.
 * Camera and reflection vegetation keep separate geometry objects over the same
 * attributes. They must retain that sharing while the view is alive.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/10/2026, 04:14:34
 * Dependents: components/World3D/water/riverReachScene.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { BufferAttribute, InterleavedBufferAttribute } from 'three';

type Attribute = BufferAttribute | InterleavedBufferAttribute;
type AttributeBackend = {
  has(owner: object): boolean;
  get(owner: object): { buffer?: object };
  destroyAttribute(attribute: Attribute): void;
};

/** Run synchronous final teardown; restore the renderer hook even on failure. */
export function withRiverGeometryDisposal(renderer: { backend: unknown }, release: () => void): void {
  // HACK: The installed Three renderer tests a deleted attribute against
  // undefined, but its DataMap returns null. A second geometry can therefore
  // try to destroy the same shared buffer after it has already been removed.
  // Limit this compatibility adapter to this renderer's final teardown. Once
  // Three fixes its ownership check, remove the adapter and retain the controls.
  const backend = renderer.backend as AttributeBackend;
  const nativeDestroy = backend.destroyAttribute;
  const released = new WeakSet<object>();
  backend.destroyAttribute = function (attribute): void {
    const owner = (attribute as InterleavedBufferAttribute).isInterleavedBufferAttribute
      ? (attribute as InterleavedBufferAttribute).data : attribute;
    // Undrawn geometry has no GPU allocation. Distinct interleaved attributes
    // may also name one allocation, so deduplicate by the actual GPU buffer.
    if (!this.has(owner)) return;
    const buffer = this.get(owner).buffer;
    if (buffer === undefined || released.has(buffer)) return;
    nativeDestroy.call(this, attribute);
    released.add(buffer);
  };
  try { release(); } finally { backend.destroyAttribute = nativeDestroy; }
}
