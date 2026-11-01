/**
 * Send every changed flow texel to the GPU without resending the unchanged
 * kilometers of dry ground. The solver, half-float values, texture size and
 * filtering are unchanged. New or unsupported textures use Three's full upload.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/10/2026, 01:27:32
 * Dependents: components/World3D/water/riverReachScene.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';

import { riverFlowDirtyRect, validFlowDelta, type RiverFlowTextureDelta } from '@/systems/world3d/river/riverFlowTextureDelta';
import { riverPatchRects } from '@/systems/world3d/river/riverFlowPatch';
export { riverFlowDirtyRect, type RiverFlowDirtyRect } from '@/systems/world3d/river/riverFlowTextureDelta';
const lineage = new WeakMap<THREE.DataTexture, { epoch: string; revision: number; data: Uint16Array }>();

// Three r172 has no DataTexture dirty-rectangle API. Keep the small backend
// bridge here, with explicit residency/format guards and the native fallback.
type UploadRenderer = {
  backend: {
    isWebGPUBackend?: boolean;
    device?: { queue: Pick<GPUQueue, 'writeTexture'> };
    get(texture: THREE.Texture): { texture?: GPUTexture; textureDescriptorGPU?: { format?: string } };
  };
  _textures?: { get(texture: THREE.Texture): { initialized?: boolean; version?: number } };
};

/**
 * Copy one resident flow texture into another on the GPU (2026-10-21: the
 * previous live picture, for the blend in createRiverWaterMaterial). Queue
 * order puts the copy before a later writeTexture of the new picture. Returns
 * false, and copies nothing, when either texture is not yet on the GPU or the
 * sizes differ; the caller then draws the new picture without a blend.
 */
export function copyRiverFlowTexture(renderer: THREE.WebGPURenderer, from: THREE.DataTexture, to: THREE.DataTexture): boolean {
  const backend = (renderer as unknown as { backend: UploadRenderer['backend'] & { device?: GPUDevice } }).backend;
  if (!backend.isWebGPUBackend || !backend.device) return false;
  const a = backend.get(from).texture, b = backend.get(to).texture;
  if (!a || !b || a.width !== b.width || a.height !== b.height || a.format !== b.format) return false;
  try {
    const encoder = backend.device.createCommandEncoder();
    encoder.copyTextureToTexture({ texture: a }, { texture: b }, { width: a.width, height: a.height, depthOrArrayLayers: 1 });
    backend.device.queue.submit([encoder.finish()]);
    return true;
  } catch { return false; }
}

export function updateRiverFlowTexture(renderer: THREE.WebGPURenderer, texture: THREE.DataTexture, next: Uint16Array, delta?: RiverFlowTextureDelta, channel: 0 | 1 | 2 = 0): void {
  const image = texture.image as { data: Uint16Array; width: number; height: number };
  const previous = image.data;
  const prior = lineage.get(texture), valid = validFlowDelta(delta, image.width, image.height);
  const trusted = valid && prior?.data === previous && prior.epoch === delta.epoch && prior.revision === delta.baseRevision;
  // Advance provenance even after an exact fallback scan. A skipped packet,
  // mapper restart or externally replaced array can never suppress a change.
  if (valid) lineage.set(texture, { epoch: delta.epoch, revision: delta.revision, data: next });
  else lineage.delete(texture);
  const target = regionTarget(renderer, texture, next);

  if (target) {
    const dirty = trusted ? delta.rectangles[channel] : riverFlowDirtyRect(previous, next, image.width, image.height);
    if (dirty) {
      // The source view keeps its full row stride. WebGPU copies only this
      // rectangle; no packed staging array or extra full-map copy is needed.
      // Enqueue before adopting the CPU array so a failed write leaves the
      // previous CPU/GPU association intact for the native full-upload path.
      try {
        writeRect(target, next, image.width, dirty);
      } catch {
        image.data = next; texture.needsUpdate = true; return;
      }
    }
    // The resident GPU texture already has exactly these bits. Keeping its
    // version avoids a second, full upload when either render pass samples it.
    image.data = next;
    return;
  }
  image.data = next;
  texture.needsUpdate = true;
}

/** The resident GPU texture a region write can reach, or null when only Three's full upload is safe. */
function regionTarget(renderer: THREE.WebGPURenderer, texture: THREE.DataTexture, next: Uint16Array): { queue: Pick<GPUQueue, 'writeTexture'>; texture: GPUTexture } | null {
  const image = texture.image as { data: Uint16Array; width: number; height: number };
  const previous = image.data;
  const r = renderer as unknown as UploadRenderer;
  const backend = r.backend;
  const tracked = r._textures?.get(texture);
  const gpu = backend.isWebGPUBackend ? backend.get(texture) : null;
  const ok = backend.isWebGPUBackend && backend.device && gpu?.texture
    && gpu.textureDescriptorGPU?.format === 'rgba16float'
    && tracked?.initialized === true && tracked.version === texture.version
    && texture.format === THREE.RGBAFormat && texture.type === THREE.HalfFloatType
    && !texture.flipY && !texture.generateMipmaps && texture.mipmaps.length === 0
    && previous instanceof Uint16Array && previous.length === next.length
    && next.length === image.width * image.height * 4;
  return ok ? { queue: backend.device!.queue, texture: gpu!.texture! } : null;
}

function writeRect(target: { queue: Pick<GPUQueue, 'writeTexture'>; texture: GPUTexture }, next: Uint16Array, width: number, rect: { x: number; y: number; width: number; height: number }): void {
  target.queue.writeTexture(
    { texture: target.texture, mipLevel: 0, origin: { x: rect.x, y: rect.y, z: 0 } },
    next.buffer,
    { offset: next.byteOffset + (rect.y * width + rect.x) * 8, bytesPerRow: width * 8 },
    { width: rect.width, height: rect.height, depthOrArrayLayers: 1 },
  );
}

/**
 * A PATCH PICTURE'S UPLOAD (2026-10-27, GG-430). RiverLiveClient wrote the
 * patch rows into `next` in place, so `next` can be the array the texture
 * already holds and a compare with it finds no change. Write the patch's row
 * spans, merged into a few rectangles (riverPatchRects), from `next`. Without
 * a resident GPU texture, Three uploads the whole array as before.
 */
export function updateRiverFlowTexturePatch(renderer: THREE.WebGPURenderer, texture: THREE.DataTexture, next: Uint16Array, rows: Int32Array): void {
  const image = texture.image as { data: Uint16Array; width: number; height: number };
  // A patch is no delta revision; a later delta picture starts a fresh lineage.
  lineage.delete(texture);
  // Rows are enough only when the texture already holds these kept arrays (a
  // caller that dropped the full picture before this patch gets a full upload).
  const target = image.data === next ? regionTarget(renderer, texture, next) : null;
  if (target) {
    try {
      for (const rect of riverPatchRects(rows)) writeRect(target, next, image.width, rect);
      image.data = next;
      return;
    } catch { /* the full upload below sends every texel */ }
  }
  image.data = next;
  texture.needsUpdate = true;
}
