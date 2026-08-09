/**
 * The one line a 3D surface adds to be measured.
 *
 * Drop `<PerfProbe id="water" label="Water" />` inside any `<Canvas>` and the
 * shared overlay picks it up. Nothing else in the scene changes: the probe
 * draws nothing, owns no state the scene can see, and never takes over the
 * render loop.
 *
 * It runs at the default `useFrame` priority, which means it runs BEFORE the
 * frame is drawn. That ordering is the point — see `sampleRenderer`.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { acquirePerfSession, releasePerfSession } from './perfRegistry';
import { GpuFrameTimer } from './gpuTimer';

interface PerfProbeProps {
  /** Stable id for this surface. One per canvas. */
  id: string;
  /** What the overlay calls it. Defaults to the id. */
  label?: string;
  /**
   * Count every render pass in the frame, not only the last one.
   *
   * Three clears its counters at the start of each `render()`. A scene with a
   * post-processing stack renders several times per frame, so the default
   * behavior leaves the counters holding the final fullscreen quad — one draw
   * call and two triangles, for a dungeon with forty thousand.
   *
   * Turning the automatic clear off and clearing once per frame instead gives
   * the whole frame's total. Set this to false for a scene that reads
   * `gl.info` in its OWN `useFrame`: this probe runs first and would hand it a
   * freshly cleared counter.
   */
  countAllPasses?: boolean;
  /**
   * Measure GPU time per frame with `EXT_disjoint_timer_query_webgl2`.
   *
   * On by default. Turn it off for a scene that issues its own occlusion or
   * timer queries, because the extension allows only ONE elapsed-time query to
   * be open on a context at a time.
   */
  gpuTiming?: boolean;
}

interface RendererInfo {
  autoReset?: boolean;
  reset?: () => void;
}

export function PerfProbe({
  id,
  label,
  countAllPasses = true,
  gpuTiming = true,
}: PerfProbeProps): null {
  const gl = useThree((state) => state.gl);
  const session = useMemo(() => acquirePerfSession(id, label ?? id), [id, label]);
  const gpu = useRef<GpuFrameTimer | null>(null);

  useEffect(() => {
    return () => releasePerfSession(id);
    // `session` is in the list so a changed id releases the id it acquired.
  }, [id, session]);

  useEffect(() => {
    if (!countAllPasses) return;
    const info = (gl as unknown as { info?: RendererInfo }).info;
    if (!info || typeof info.autoReset !== 'boolean') return;
    const previous = info.autoReset;
    info.autoReset = false;
    return () => {
      info.autoReset = previous;
    };
  }, [gl, countAllPasses]);

  useEffect(() => {
    if (!gpuTiming) {
      session.setGpuUnavailable('disabled');
      return;
    }
    const attempt = GpuFrameTimer.forRenderer(gl);
    gpu.current = attempt.timer;
    session.setGpuUnavailable(attempt.reason);
    return () => {
      gpu.current?.dispose();
      gpu.current = null;
    };
  }, [gl, gpuTiming, session]);

  useFrame(() => {
    // Read first: the counters still hold everything the PREVIOUS frame drew.
    session.sampleRenderer(gl);
    if (countAllPasses) (gl as unknown as { info?: RendererInfo }).info?.reset?.();
    /* The GPU query opens here, before the render calls, and closes in a
     * microtask.
     *
     * The microtask runs once this whole animation-frame task finishes — after
     * React Three Fiber has issued the frame's renders, and before the browser
     * presents. Closing the query there measures the drawing alone. Closing it
     * at the start of the next frame instead would include the GPU's idle wait
     * for the display, and every vsync-locked scene would report its GPU time
     * as the frame time. */
    const timer = gpu.current;
    if (timer) session.recordGpu(timer.beginFrame());

    /* The same microtask closes the CPU measurement.
     *
     * It runs when this animation-frame task is done, so the interval covers
     * the frame's React Three Fiber work and its render calls — the CPU cost of
     * the frame, with none of the wait for the display in it. Frame time minus
     * this is idle, which is what turns "CPU bound" into "has headroom". */
    const cpuStart = performance.now();
    queueMicrotask(() => {
      timer?.endFrame();
      session.recordCpuFrame(performance.now() - cpuStart);
    });

    session.frame();
  });

  return null;
}

export default PerfProbe;
