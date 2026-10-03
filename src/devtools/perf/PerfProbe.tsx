/**
 * The one line an R3F canvas adds to get a stable name in the panel.
 *
 * Drop `<PerfProbe id="water" label="Water" />` inside any `<Canvas>`. The
 * probe draws nothing, owns no state the scene can see, and never takes over
 * the render loop.
 *
 * WHAT CHANGED ON 2026-09-29. This component used to do the measuring itself,
 * in a `useFrame`. The renderer probe (rendererProbe.ts) now measures every
 * three.js renderer at its `render` call, whether or not a `PerfProbe` is
 * mounted. What this component still adds is the NAME: a stable `id` that
 * capture rigs ask `window.__araliaPerf` for, and a label for the panel tab.
 * A canvas without one is still measured, and is labeled by its window title.
 *
 * Two measurement changes came with the move, both toward the true number:
 *
 * - CPU time now starts at the top of the animation-frame callback. The
 *   `useFrame` version started when ITS callback ran, after every `useFrame`
 *   registered before it, so it missed their cost.
 * - Every pass is counted without touching `gl.info.autoReset`. See
 *   `countAllPasses` below.
 */

import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { instrumentRenderer } from './rendererProbe';

interface PerfProbeProps {
  /** Stable id for this surface. One per canvas. */
  id: string;
  /** What the overlay calls it. Defaults to the id. */
  label?: string;
  /**
   * NO LONGER USED; kept so existing call sites compile.
   *
   * This used to turn `gl.info.autoReset` off so the counters held every
   * render pass of a frame, not only the last one (a post-processed dungeon
   * read "1 draw call" without it). That also handed a cleared counter to any
   * scene that read `gl.info` in its own `useFrame`, so EntityDebugScene had
   * to pass `false`. The renderer probe now adds up each `render` call's
   * counters itself, which counts every pass and leaves `autoReset` alone.
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

export function PerfProbe({ id, label, gpuTiming = true }: PerfProbeProps): null {
  const gl = useThree((state) => state.gl);

  // A layout effect, so the name is in place before R3F draws the first frame.
  // The returned release hands the renderer back to automatic naming.
  useLayoutEffect(
    () => instrumentRenderer(gl, { id, label: label ?? id, gpuTiming }),
    [gl, id, label, gpuTiming],
  );

  return null;
}

export default PerfProbe;
