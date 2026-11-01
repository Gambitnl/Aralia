/** Keep existing GPU buffers when a new native water sheet fits them exactly. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 05/10/2026, 04:17:39
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';

function compatible(a: THREE.BufferAttribute, b: THREE.BufferAttribute): boolean {
  return a.itemSize === b.itemSize && a.normalized === b.normalized
    && a.usage === b.usage && a.gpuType === b.gpuType
    && a.array.constructor === b.array.constructor && a.array.length === b.array.length;
}

function adopt(a: THREE.BufferAttribute, b: THREE.BufferAttribute): void {
  let changed = false;
  for (let i = 0; i < a.array.length; i += 1) {
    if (a.array[i] !== b.array[i]) { changed = true; break; }
  }
  // The mapper's new arrays become the drawn arrays without another copy.
  // Attribute identity keeps the allocated GPU buffer; unchanged indices
  // need no upload. Positions and normals still upload whenever they change.
  a.array = b.array;
  if (changed) a.needsUpdate = true;
}

/**
 * Adopt an equal-sized replacement and dispose its unused geometry wrapper.
 * False leaves both geometries untouched: a changed wet topology or attribute
 * layout must follow the existing replacement/disposal path. No capacity is
 * guessed, no faces are removed, and no standing-wave values are recalculated.
 * This is an experiment until native frame comparisons establish a benefit.
 */
export function reuseRiverGeometryBuffers(current: THREE.BufferGeometry, next: THREE.BufferGeometry): boolean {
  const names = Object.keys(current.attributes);
  if (names.length !== Object.keys(next.attributes).length) return false;
  for (const name of names) {
    const a = current.getAttribute(name), b = next.getAttribute(name);
    if (!(a instanceof THREE.BufferAttribute) || !(b instanceof THREE.BufferAttribute) || !compatible(a, b)) return false;
  }
  const aIndex = current.getIndex(), bIndex = next.getIndex();
  if (!!aIndex !== !!bIndex || (aIndex && bIndex && !compatible(aIndex, bIndex))) return false;

  // Validate the entire layout before changing any attribute. A late mismatch
  // must not leave a partly updated sheet on the fallback path.
  for (const name of names) adopt(current.getAttribute(name) as THREE.BufferAttribute, next.getAttribute(name) as THREE.BufferAttribute);
  if (aIndex && bIndex) adopt(aIndex, bIndex);
  current.boundingBox = next.boundingBox;
  current.boundingSphere = next.boundingSphere;
  current.userData = next.userData;
  current.setDrawRange(next.drawRange.start, next.drawRange.count);
  current.clearGroups();
  for (const group of next.groups) current.addGroup(group.start, group.count, group.materialIndex);
  next.dispose();
  return true;
}
