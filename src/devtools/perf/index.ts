/**
 * The performance toolkit for every 3D surface in the project.
 *
 * Two lines wire a surface up:
 *
 * 1. `<PerfProbe id="water" label="Water" />` inside the `<Canvas>`.
 * 2. `<PerfOverlay />` once on the page. The design preview already has one.
 *
 * A surface that drives its own `requestAnimationFrame` loop instead of React
 * Three Fiber uses the session directly:
 *
 * ```ts
 * const perf = acquirePerfSession('creaturelab', 'Creature Lab');
 * // each frame, before renderer.render(...):
 * perf.sampleRenderer(renderer);
 * perf.frame();
 * // on teardown:
 * releasePerfSession('creaturelab');
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
} from './perfRegistry';

export { PerfProbe } from './PerfProbe';
export { PerfOverlay } from './PerfOverlay';
