/**
 * @file staple.ts
 * The one line that puts the performance tool on a 3D page.
 *
 * Import it FIRST in a page entry, before the page's own components:
 *
 * ```ts
 * import './devtools/perf/staple';
 * ```
 *
 * It does two things, in this order:
 *
 * 1. It installs the renderer probe, so every three.js renderer the page
 *    builds from then on is measured — R3F canvases, raw WebGL loops and raw
 *    WebGPU loops — with nothing added to any scene.
 * 2. It mounts the performance display (fps pill, Alt+P for the panel) in a
 *    React root of its own.
 *
 * Why at the entry and not in a component: a renderer built before the probe
 * is installed is never found. Module code at the top of an entry runs before
 * any React tree renders, so no scene can mount first.
 */
import { installPerfAutoProbe } from './rendererProbe';
import { mountPerfOverlay } from './PerfOverlayHost';

installPerfAutoProbe();
if (typeof document !== 'undefined') mountPerfOverlay();
