/**
 * Find exact flow-texture changes away from the rendering thread. All fields
 * still travel at full resolution. The retained previous half arrays belong
 * only to this mapper; transferred snapshots never detach or rewrite them.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/10/2026, 01:27:32
 * Dependents: components/World3D/water/riverFlowTextureUpload.ts, systems/world3d/river/riverMapWorker.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type RiverFlowDirtyRect = { x: number; y: number; width: number; height: number };
export type RiverFlowTextureDelta = {
  epoch: string; revision: number; baseRevision: number | null; width: number; height: number;
  rectangles: [RiverFlowDirtyRect | null, RiverFlowDirtyRect | null, RiverFlowDirtyRect | null];
};

/** Compare stored bits, including signed zero and NaN payloads. The rectangle
 * includes every changed channel; unchanged texels inside it are harmless. */
export function riverFlowDirtyRect(previous: Uint16Array, next: Uint16Array, width: number, height: number): RiverFlowDirtyRect | null {
  if (previous.length !== next.length || next.length !== width * height * 4) throw new Error('Flow texture dimensions do not match the supplied RGBA arrays.');
  const aligned = previous.byteOffset % 4 === 0 && next.byteOffset % 4 === 0;
  const a = aligned ? new Uint32Array(previous.buffer, previous.byteOffset, previous.byteLength / 4) : previous;
  const b = aligned ? new Uint32Array(next.buffer, next.byteOffset, next.byteLength / 4) : next;
  const words = aligned ? 2 : 4, rowWords = width * words;
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * rowWords;
    let first = 0;
    while (first < rowWords && a[row + first] === b[row + first]) first++;
    if (first === rowWords) continue;
    let last = rowWords - 1;
    while (last > first && a[row + last] === b[row + last]) last--;
    minX = Math.min(minX, Math.floor(first / words)); maxX = Math.max(maxX, Math.floor(last / words));
    minY = Math.min(minY, y); maxY = y;
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export class RiverFlowTextureDeltaTracker {
  private previous: [Uint16Array, Uint16Array, Uint16Array] | null = null;
  private revision = 0;
  private width = 0;
  private height = 0;
  constructor(private readonly epoch: string) { if (!epoch) throw new Error('Flow delta epoch is required.'); }
  get retainedBytes(): number { return this.previous?.reduce((n, a) => n + a.byteLength, 0) ?? 0; }

  capture(width: number, height: number, fields: [Uint16Array, Uint16Array, Uint16Array]): RiverFlowTextureDelta {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0
      || fields.some(a => a.length !== width * height * 4)) throw new Error('Invalid flow delta dimensions.');
    const prior = this.previous && width === this.width && height === this.height ? this.previous : null;
    const full = (): RiverFlowDirtyRect => ({ x: 0, y: 0, width, height });
    const rectangles = prior ? fields.map((a, i) => riverFlowDirtyRect(prior[i], a, width, height)) : [full(), full(), full()];
    const baseRevision = prior ? this.revision : null;
    // A fixed three-field cache: one extra 142 MB at the current full-course
    // grid, rather than a history growing with time. Physics owns none of it.
    if (prior) fields.forEach((a, i) => prior[i].set(a));
    else this.previous = fields.map(a => a.slice()) as [Uint16Array, Uint16Array, Uint16Array];
    this.width = width; this.height = height;
    return { epoch: this.epoch, revision: ++this.revision, baseRevision, width, height,
      rectangles: rectangles as RiverFlowTextureDelta['rectangles'] };
  }
}

/** Packet-shape checks cannot replace lineage checks at the resident texture. */
export function validFlowDelta(delta: RiverFlowTextureDelta | undefined, width: number, height: number): delta is RiverFlowTextureDelta {
  return !!delta && typeof delta.epoch === 'string' && delta.epoch.length > 0
    && Number.isSafeInteger(delta.revision) && delta.revision > 0
    && (delta.baseRevision === null || Number.isSafeInteger(delta.baseRevision) && delta.baseRevision >= 0 && delta.baseRevision < delta.revision)
    && delta.width === width && delta.height === height && Array.isArray(delta.rectangles) && delta.rectangles.length === 3
    && delta.rectangles.every(r => r === null || !!r && [r.x, r.y, r.width, r.height].every(Number.isSafeInteger)
      && r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 && r.x + r.width <= width && r.y + r.height <= height);
}
