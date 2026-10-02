/**
 * The performance toolkit for every 3D surface in the project.
 *
 * ONE LINE PER PAGE, NONE PER SURFACE (since 2026-09-29):
 *
 * `import './devtools/perf/staple';` at the top of a page entry installs the
 * renderer probe and mounts the display. The probe then measures every
 * three.js renderer the page builds — an R3F canvas, a raw WebGL loop, a raw
 * WebGPU loop — at its `render` and `compute` calls. The Design Preview, the
 * game (dev only), the building lab and the character atelier already have it.
 *
 * OPTIONAL, to give a surface a stable id and label for capture rigs:
 *
 * - `<PerfProbe id="water" label="Water" />` inside an R3F `<Canvas>`.
 * - `instrumentRenderer(renderer, { id: 'ocean', label: 'Ocean' })` for a raw loop.
 * - `data-perf-id="river" data-perf-label="River"` on any element around the canvas.
 *
 * A surface with none of these is still measured, and the panel names it
 * after the window it sits in.
 *
 * To put a surface's own numbers beside the frame times:
 *
 * ```ts
 * perfSessionForRenderer(renderer)?.setStat('wet cells', 9137);
 * ```
 *
 * To attribute a slow frame to one piece of work, record a span:
 *
 * ```ts
 * getPerfSession('volume')?.measure('remesh', () => rebuildSurface());
 * ```
 *
 * GPU time per frame comes from `EXT_disjoint_timer_query_webgl2` and needs no
 * wiring — the probe sets it up. It answers whether a slow frame is the CPU's
 * fault or the GPU's, which the frame time alone never can. A browser that
 * withholds the extension, or a WebGPU surface, says so in the panel rather
 * than showing a zero. Pass `gpuTiming={false}` for a scene that issues its own
 * timer or occlusion queries, because only one may be open at a time.
 *
 * The low-level session API (`acquirePerfSession`, `sampleRenderer`, `frame`)
 * still works for a surface that is not a three.js renderer at all.
 */

export { FrameStats, RollingMs, SpanTimer, STALL_MS } from './frameStats';
export type { FrameReading } from './frameStats';

export { PerfSession, describeGpu, classifyBottleneck } from './perfSession';
export type {
  PerfSnapshot,
  RendererCounters,
  SurfaceSize,
  GraphicsApi,
  GpuReading,
  Bottleneck,
  BottleneckVerdict,
} from './perfSession';

export { GpuFrameTimer } from './gpuTimer';
export { StallLog, describeStall } from './stallLog';
export type { StallRecord, StallContributor } from './stallLog';
export type { GpuTimerUnavailable, GpuTimerAttempt, GpuResult } from './gpuTimer';

export {
  acquirePerfSession,
  releasePerfSession,
  getPerfSession,
  getPerfSessions,
  subscribePerfSessions,
  clearPerfSessions,
  requestPerfPanel,
} from './perfRegistry';

export { installPerfAutoProbe, instrumentRenderer, perfSessionForRenderer } from './rendererProbe';
export type { InstrumentOptions } from './rendererProbe';
export type { SessionOrigin, SurfaceStat, RendererFrameReading, PassReading, PassSample, FrameCosts } from './perfSession';
// The diagnosis (2026-09-29): pure rules, the scene walk and the screen share.
export { analyzeVsync, readWork, memoryTrend, budgetMsFor } from './diagnose';
export type { VsyncReading, WorkReading, MemoryTrend, BudgetChoice } from './diagnose';
export { takeInventory, groupOf } from './sceneInventory';
export type { SceneInventory, InventoryGroup } from './sceneInventory';
export { measureScreenShare } from './viewCoverage';

export { PerfProbe } from './PerfProbe';
// The overlay reaches the page through its host, which owns the second React
// root. See PerfOverlayHost.tsx for what sharing a root cost.
export { PerfOverlay, mountPerfOverlay } from './PerfOverlayHost';
export { PerfOverlayView } from './PerfOverlay';
export { PerfWindowBadge } from './PerfWindowBadge';
export { PerfFpsText } from './PerfFpsText';
