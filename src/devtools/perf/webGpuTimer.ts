// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 05:00:48
 * Dependents: devtools/perf/rendererProbe.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { FramePassGpu } from './gpuTimer';
import { recordPerfOverhead } from './perfOverhead';

/** The calls shared by the WebGL and WebGPU pass clocks. */
export interface PassClock {
  begin(frame: number, pass: number): void;
  pause(): void;
  closeFrame(frame: number): void;
  collect(): FramePassGpu[];
  dispose(): void;
}

interface Slot {
  queries: GPUQuerySet;
  resolve: GPUBuffer;
  read: GPUBuffer;
  pairs: number[];
  frame: number;
  invalid: boolean;
}

const PAIRS = 256;
const SLOTS = 4;
const DEVICE_OWNER = new WeakSet<GPUDevice>();

/**
 * Timestamp every physical render/compute pass, including generated mip passes.
 * This avoids r172's reused render descriptors retaining only their first clock.
 * Readback is asynchronous and the pool is fixed: a delayed result skips whole
 * frames rather than blocking a draw or publishing a partial GPU total.
 * The sum excludes uploads, copies, queue gaps and browser presentation.
 */
export class WebGpuPassTimer implements PassClock {
  private readonly free: Slot[] = [];
  private readonly all: Slot[] = [];
  private readonly ready: FramePassGpu[] = [];
  private open: Slot | null = null;
  private activePass: number | null = null;
  private frame = -1;
  private disposed = false;
  private allocationFailed = false;
  private capturePending = false;
  // A fifth, diagnostic-only readback slot prevents the four HUD slots from
  // starving a scan under load. Native frame sampling keeps its existing pool.
  private diagnostic: Slot | null = null;
  private readonly original: GPUDevice['createCommandEncoder'];
  private readonly originalDescriptor: PropertyDescriptor | undefined;
  private readonly wrapped: GPUDevice['createCommandEncoder'];

  static forRenderer(renderer: unknown): WebGpuPassTimer | null {
    const backend = (renderer as { backend?: { device?: GPUDevice; trackTimestamp?: boolean } })?.backend;
    const device = backend?.device;
    // Preserve another clock's ownership, including Three's opt-in query path.
    if (!device?.features?.has('timestamp-query') || backend?.trackTimestamp || DEVICE_OWNER.has(device)) return null;
    try { return new WebGpuPassTimer(device); } catch { return null; }
  }

  private constructor(private readonly device: GPUDevice) {
    this.original = device.createCommandEncoder;
    this.originalDescriptor = Object.getOwnPropertyDescriptor(device, 'createCommandEncoder');
    const timer = this;
    this.wrapped = function (descriptor?: GPUCommandEncoderDescriptor): GPUCommandEncoder {
      const encoder = timer.original.call(device, descriptor);
      if (timer.disposed) return encoder;
      const overheadStart = performance.now();
      const render = encoder.beginRenderPass;
      const compute = encoder.beginComputePass;
      encoder.beginRenderPass = function (d) { return render.call(encoder, timer.stamp(d)); };
      encoder.beginComputePass = function (d = {}) { return compute.call(encoder, timer.stamp(d)); };
      recordPerfOverhead('probe', performance.now() - overheadStart);
      return encoder;
    };
    device.createCommandEncoder = this.wrapped;
    DEVICE_OWNER.add(device);
  }

  private stamp<T extends GPURenderPassDescriptor | GPUComputePassDescriptor>(descriptor: T): T {
    const slot = this.open;
    if (!slot || this.activePass === null || slot.invalid) return descriptor;
    // Never replace a caller's timestamps. One unmeasured pass invalidates the
    // whole frame, so the panel cannot mistake a subset for all GPU pass work.
    if (descriptor.timestampWrites || slot.pairs.length >= PAIRS) {
      slot.invalid = true;
      return descriptor;
    }
    const index = slot.pairs.length * 2;
    const overheadStart = performance.now();
    slot.pairs.push(this.activePass);
    const stamped = { ...descriptor, timestampWrites: {
      querySet: slot.queries, beginningOfPassWriteIndex: index, endOfPassWriteIndex: index + 1,
    } };
    recordPerfOverhead('probe', performance.now() - overheadStart);
    return stamped;
  }

  begin(frame: number, pass: number): void {
    if (this.disposed) return;
    if (frame !== this.frame) {
      this.frame = frame;
      this.open = this.free.pop() ?? (!this.allocationFailed && this.all.length - (this.diagnostic ? 1 : 0) < SLOTS ? this.makeSlot() : null);
      if (this.open) {
        this.open.frame = frame;
        this.open.pairs.length = 0;
        this.open.invalid = false;
      }
    }
    this.activePass = pass;
  }

  pause(): void { this.activePass = null; }

  closeFrame(frame: number): void {
    if (this.disposed || this.open?.frame !== frame) return;
    const slot = this.open;
    this.open = null;
    this.activePass = null;
    if (slot.invalid || slot.pairs.length === 0) { this.free.push(slot); return; }
    const bytes = slot.pairs.length * 16;
    try {
      // Use the original encoder: the resolve itself is outside every pass.
      const encoder = this.original.call(this.device);
      encoder.resolveQuerySet(slot.queries, 0, slot.pairs.length * 2, slot.resolve, 0);
      encoder.copyBufferToBuffer(slot.resolve, 0, slot.read, 0, bytes);
      this.device.queue.submit([encoder.finish()]);
      void slot.read.mapAsync(GPUMapMode.READ, 0, bytes).then(() => {
        if (this.disposed) return;
        const overheadStart = performance.now();
        const values = new BigUint64Array(slot.read.getMappedRange(0, bytes));
        const passes = new Map<number, number>();
        let valid = true;
        for (let i = 0; i < slot.pairs.length; i++) {
          const start = values[i * 2], end = values[i * 2 + 1];
          // Timestamp counters can reset. Negative or unwritten pairs are not
          // a GPU spike or zero work; discard their entire frame.
          if (start === 0n || end < start) { valid = false; break; }
          const ms = Number(end - start) / 1e6;
          const pass = slot.pairs[i];
          passes.set(pass, (passes.get(pass) ?? 0) + ms);
        }
        slot.read.unmap();
        if (valid) {
          this.ready.push({ frame: slot.frame, totalMs: [...passes.values()].reduce((a, b) => a + b, 0), passes });
          if (this.ready.length > SLOTS) this.ready.shift();
        }
        this.free.push(slot);
        recordPerfOverhead('probe', performance.now() - overheadStart);
      }).catch(() => {
        if (!this.disposed) {
          try { slot.read.unmap(); } catch { /* Failed maps may already be unmapped. */ }
          this.free.push(slot);
        }
      });
    } catch { this.free.push(slot); }
  }

  collect(): FramePassGpu[] { return this.ready.splice(0); }


  /** Capture named offscreen comparisons without mixing them into the FPS HUD.
   * Normal draws keep their own open slot. A busy/lost clock returns unknown;
   * it never stalls the visible render or reports missing timestamps as zero.
   */
  async capture(draw: (section: (id: number, render: () => void) => void) => void): Promise<Map<number, number> | null> {
    if (this.disposed || this.capturePending) return null;
    const slot = this.diagnostic ?? (!this.allocationFailed ? (this.diagnostic = this.makeSlot()) : null);
    if (!slot) return null;
    this.capturePending = true;
    const previous = { open: this.open, active: this.activePass };
    slot.pairs.length = 0; slot.invalid = false;
    this.open = slot; this.activePass = null;
    try {
      draw((id, render) => { this.activePass = id; try { render(); } finally { this.activePass = null; } });
    } catch (error) {
      this.capturePending = false; throw error;
    } finally { this.open = previous.open; this.activePass = previous.active; }
    if (slot.invalid || slot.pairs.length === 0) { this.capturePending = false; return null; }
    let mapped = false;
    try {
      const bytes = slot.pairs.length * 16, encoder = this.original.call(this.device);
      encoder.resolveQuerySet(slot.queries, 0, slot.pairs.length * 2, slot.resolve, 0);
      encoder.copyBufferToBuffer(slot.resolve, 0, slot.read, 0, bytes);
      this.device.queue.submit([encoder.finish()]);
      await slot.read.mapAsync(GPUMapMode.READ, 0, bytes); mapped = true;
      if (this.disposed) return null;
      const values = new BigUint64Array(slot.read.getMappedRange(0, bytes)), result = new Map<number, number>();
      for (let i = 0; i < slot.pairs.length; i++) {
        const start = values[i * 2], end = values[i * 2 + 1];
        if (start === 0n || end < start) return null;
        const id = slot.pairs[i]; result.set(id, (result.get(id) ?? 0) + Number(end - start) / 1e6);
      }
      return result;
    } catch { return null; }
    finally {
      if (mapped && !this.disposed) slot.read.unmap();
      this.capturePending = false;
    }
  }

  private makeSlot(): Slot | null {
    const allocated: { destroy(): void }[] = [];
    try {
      const queries = this.device.createQuerySet({ type: 'timestamp', count: PAIRS * 2 }); allocated.push(queries);
      const resolve = this.device.createBuffer({ size: PAIRS * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }); allocated.push(resolve);
      const read = this.device.createBuffer({ size: PAIRS * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); allocated.push(read);
      const slot = { queries, resolve, read, pairs: [], frame: -1, invalid: false };
      this.all.push(slot);
      return slot;
    } catch {
      // A lost or constrained device must never make instrumentation throw
      // through the native draw. Dispose a partial allocation and stop retries.
      for (const resource of allocated) resource.destroy();
      this.allocationFailed = true;
      return null;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    // Restore only our own wrapper; another owner may have wrapped it later.
    if (this.device.createCommandEncoder === this.wrapped) {
      if (this.originalDescriptor) Object.defineProperty(this.device, 'createCommandEncoder', this.originalDescriptor);
      else delete (this.device as unknown as Record<string, unknown>).createCommandEncoder;
    }
    DEVICE_OWNER.delete(this.device);
    for (const slot of this.all) {
      slot.queries.destroy(); slot.resolve.destroy(); slot.read.destroy();
    }
    this.open = null;
    this.free.length = 0;
    this.ready.length = 0;
  }
}
