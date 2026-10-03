/**
 * @file rendererProbe.ts
 * The renderer probe: it measures EVERY three.js renderer on a page, with no
 * wiring in the scene, and says what each frame spent its time on.
 *
 * WHY THIS EXISTS
 *
 * Until 2026-09-29 a 3D surface reported to the shared panel only if its
 * author added a `PerfProbe` or called `acquirePerfSession`. Seven surfaces
 * never did, and eleven grew a counter of their own instead. The probe
 * measures at the one place every surface must pass through: the renderer's
 * own `render` and `compute` calls. That is the same for React Three Fiber,
 * for a raw WebGL loop and for a raw WebGPU loop. See
 * docs/architecture/domains/perf-tools.md.
 *
 * DIAGNOSE, NOT GAUGE (2026-09-29, second pass). Remy read "58 fps, 17.2 ms,
 * 7 renders per frame, slow frames outside the measured frame" on the river
 * and asked what would make it more indicative. So the probe now also:
 *
 * - keeps EACH render and compute call as a named pass, with its own CPU time,
 *   triangles and (on WebGL) GPU time, including a pass nested inside another
 *   (the shadow map inside a scene render, a WebGPU shadow or post pass);
 * - wraps the graphics API calls that upload data or compile shaders
 *   (`texImage2D`, `bufferSubData`, `linkProgram` on WebGL; `writeBuffer`,
 *   `writeTexture`, `createRenderPipeline` on WebGPU), so a slow frame can say
 *   "texture upload, 4.1 MB, 3.2 ms" instead of "unattributed CPU";
 * - splits the frame's CPU time into named parts that add up: the page's
 *   script before the first draw, each pass's draw submission, the script
 *   between draws and after the last one, and the uploads and compiles;
 * - reads Chrome's Long Animation Frame report for a slow frame, which names
 *   style and layout and the other scripts that ran outside this surface's
 *   frame callback;
 * - walks the scenes it saw once a second (sceneInventory.ts) for triangles
 *   by group and what the camera sees.
 *
 * HOW IT FINDS A RENDERER. three gives no single hook, so there are three
 * routes:
 *
 * 1. A WebGLRenderer announces itself. Its constructor dispatches an
 *    `observe` event on `window.__THREE_DEVTOOLS__` when that object exists.
 *    The probe makes that object exist before any scene mounts, then wraps
 *    the instance's own `render`. (WebGLRenderer defines its methods inside
 *    the constructor, so there is no prototype to wrap.)
 * 2. A WebGPURenderer announces nothing. Its backend asks a canvas for a
 *    'webgpu' context during `init`, so the probe watches `getContext` and, the
 *    first time a page asks for one, loads 'three/webgpu' — the module the
 *    page already loaded, so the import costs nothing — and wraps `render`,
 *    `renderAsync`, `compute` and `computeAsync` on the class.
 * 3. `instrumentRenderer(renderer, { id, label })` wraps a renderer that is
 *    handed in. `PerfProbe` uses it with R3F's `gl`.
 *
 * WHAT A FRAME IS. Every renderer call made during one display frame belongs
 * to one frame. The browser gives every animation-frame callback of one
 * display frame the SAME timestamp, so that timestamp is the frame's key. A
 * call outside any callback (a timer, an `await` that resumed) joins the frame
 * of the last callback when that callback ran less than RAF_ACTIVE_MS ago.
 * With no animation frame at all, one task (with its microtasks) is one frame.
 *
 * WHAT IT COUNTS, AND WHY IT NEVER TOUCHES `renderer.info.autoReset`. The
 * probe reads the counters before and after each call and adds up the
 * difference. WebGLRenderer with `autoReset` on clears the counters at the
 * START of each `render`, so after the call they hold that call's work;
 * WebGPURenderer in r172 never resets inside a call.
 *
 * HOW A PASS IS NAMED, in this order: a `userData.perfPass` tag on the scene,
 * the camera or the render target; the target texture's `name`; otherwise
 * "<scene> → <target>", where the scene is its name, its single child's name,
 * "fullscreen quad", or "scene of N objects", and the target is "screen" or
 * its size. The river names nothing today, so its passes read by size; the
 * domain doc carries the one-line tags that would name them.
 *
 * WHAT IT CANNOT MEASURE, said in the panel instead of shown as zero:
 *
 * - GPU time on WebGPU, per frame or per pass. three r172 timestamp queries
 *   record only the first pass (see perfSession.ts, GPU_UNAVAILABLE_TEXT).
 * - GPU work between two passes on WebGL (a `readPixels`, a clear outside a
 *   render call). The per-pass queries cover the passes, not the gaps.
 * - A canvas drawn by something other than three (the Pixi battle board).
 * - A renderer built before the probe was installed, or one in a worker.
 * - A garbage collection's time. The probe sees one only as a fall in the
 *   heap, and only where the heap reading is precise.
 * - A slow frame under 50 ms outside the frame callback: Chrome writes a Long
 *   Animation Frame report only above 50 ms.
 */

import { acquirePerfSession, releasePerfSession, uniquePerfSessionId } from './perfRegistry';
import { PassGpuTimer } from './gpuTimer';
import { takeInventory, trianglesOf, type CameraLike, type InventoryInput } from './sceneInventory';
import { browserParts, type LoafLike } from './diagnose';
import {
  ZERO_COSTS,
  formatBytes,
  type FrameCosts,
  type GraphicsApi,
  type PassKind,
  type PassSample,
  type PerfSession,
  type RendererCounters,
  type SurfaceSize,
} from './perfSession';

/** How a surface names itself. Every field is optional. */
export interface InstrumentOptions {
  /** Stable id a capture rig asks `__araliaPerf` for. Defaults to one built from the label. */
  id?: string;
  /** What the panel calls the surface. Defaults to the id. */
  label?: string;
  /**
   * Measure GPU time per pass with `EXT_disjoint_timer_query_webgl2`. On by
   * default. Turn it off for a scene that issues its own timer or occlusion
   * queries: the extension allows ONE open query per context.
   */
  gpuTiming?: boolean;
}

/**
 * How long after the last animation-frame callback a call outside any
 * callback still joins that callback's frame. Long enough for an `await` chain
 * that resumes after a GPU readback; short enough that a timer loop running
 * with no animation frame at all is counted task by task.
 */
const RAF_ACTIVE_MS = 50;

/** How often to look for surfaces whose canvas left the page. */
const SWEEP_MS = 2000;

/** How often to walk the scenes for groups and the camera view. */
const INVENTORY_MS = 1000;

/** How long to keep a Long Animation Frame entry for a slow frame not yet recorded. */
const LOAF_KEEP_MS = 5000;

/** A heap fall of this many MB in one frame is named as a garbage collection. */
const GC_FALL_MB = 1;

// ── The slice of three this needs ────────────────────────────────────────────

interface RendererInfoLike {
  autoReset?: boolean;
  render?: Record<string, number>;
  compute?: Record<string, number>;
  memory?: Record<string, number>;
  programs?: unknown[] | null;
}

interface TargetLike {
  width?: number;
  height?: number;
  name?: string;
  userData?: Record<string, unknown>;
  texture?: { name?: string; userData?: Record<string, unknown>; generateMipmaps?: boolean };
}

interface ObjectLike {
  name?: string;
  type?: string;
  isScene?: boolean;
  userData?: Record<string, unknown>;
  children?: ObjectLike[];
  geometry?: { type?: string; parameters?: { width?: number; height?: number } };
}

interface RendererLike {
  isWebGLRenderer?: boolean;
  isWebGPURenderer?: boolean;
  backend?: { isWebGLBackend?: boolean; device?: GpuDeviceLike };
  info?: RendererInfoLike;
  domElement?: HTMLCanvasElement;
  getPixelRatio?: () => number;
  getContext?: () => unknown;
  getRenderTarget?: () => TargetLike | null;
  shadowMap?: { enabled?: boolean; autoUpdate?: boolean; needsUpdate?: boolean; render?: unknown };
}

interface GpuDeviceLike {
  queue?: Record<string, unknown>;
  [key: string]: unknown;
}

type CostKind = 'texture' | 'buffer' | 'compile' | 'readback';

interface Claim {
  id: string;
  label: string;
  gpuTiming: boolean;
}

interface DrawTally {
  drawCalls: number;
  triangles: number;
  lines: number;
  points: number;
}

/** A renderer call in progress. */
interface OpenCall {
  pass: number;
  method: string;
  kind: PassKind;
  arg0: unknown;
  arg1: unknown;
  start: number;
  pre: DrawTally;
  resetInside: boolean;
  childWall: number;
  childTally: DrawTally;
  /** Upload and compile ms inside this call and not inside a child. */
  innerCost: number;
}

/** Everything the probe knows about one renderer. */
interface Track {
  renderer: RendererLike;
  claim: Claim | null;
  session: PerfSession | null;
  sessionId: string | null;
  timer: PassGpuTimer | null;
  stack: OpenCall[];
  /** The key of the frame in progress, or null before the first call. */
  frameKey: number | null;
  /** The session's id for the frame in progress, which its GPU segments carry. */
  frameId: number;
  framesSeen: number;
  cpuStart: number;
  firstCallStart: number | null;
  lastCallEnd: number;
  /** End of the last animation-frame callback that made a call in this frame. */
  callbackEnd: number | null;
  callbackEndKey: number | null;
  tally: DrawTally;
  renderCalls: number;
  computeCalls: number;
  passes: PassSample[];
  passWall: number[];
  passNames: Map<string, number>;
  /** Letters for unnamed render targets, by first use in the frame. */
  frameTargets: Map<object, string>;
  /** How many passes each camera drew in the last second: the eye camera draws the most. */
  cameraUse: Map<object, number>;
  /** Script time between two top-level calls, before uploads are taken out. */
  betweenMs: number;
  preInner: number;
  betweenInner: number;
  sinceLastInner: number;
  costs: FrameCosts;
  /** Costs that happened in the NEXT frame's callback before its first call. */
  nextCosts: FrameCosts;
  nextPreInner: number;
  disposed: boolean;
  lastPrograms: number | null;
  lastHeapMB: number | null;
  /** Scenes drawn recently, with the camera of their largest pass, for the inventory. */
  scenes: Map<object, { sceneKey: number; label: string; cameras: Map<object, number>; lastAt: number }>;
  /** Recent frames' own CPU windows, so a browser report can leave this surface's own script out. */
  windows: { id: number; start: number; end: number }[];
  inventoryDue: number;
  apiWrapped: boolean;
}

// ── Module state ─────────────────────────────────────────────────────────────

const WRAPPED = Symbol.for('aralia.perf.wrapped');
type Wrappable = ((...args: unknown[]) => unknown) & { [WRAPPED]?: true };

const tracks = new WeakMap<object, Track>();
/** Tracks that hold a session. Strong references, so the sweep drops them. */
const measured = new Set<Track>();
const wrappedClasses = new WeakSet<object>();
/** Small stable ids for scenes, cameras and targets, for pass keys and names. */
const objectIds = new WeakMap<object, number>();
let nextObjectId = 1;

let installed = false;
let sweepTimer: ReturnType<typeof setInterval> | null = null;
let webGpuClassRequested = false;
/** Above zero while the probe draws for itself; its own calls are not measured. */
let internalDepth = 0;

/** The timestamp the browser gave the latest animation-frame batch. */
let lastRafTime = -1;
/** `performance.now()` when the latest animation-frame callback began. */
let lastRafAt = Number.NEGATIVE_INFINITY;
let rafCallbackStart = 0;
let rafDepth = 0;
/** Tracks that made a call in the animation-frame callback now running. */
const touchedInCallback = new Set<Track>();

/** Advances once per task, for frames drawn with no animation frame running. */
let taskToken = 0;
let boundaryPending = false;
let boundaryPort: MessagePort | null = null;

/** Recent Long Animation Frame entries, for a slow frame recorded after its report arrived. */
const loafBuffer: LoafLike[] = [];

const zeroTally = (): DrawTally => ({ drawCalls: 0, triangles: 0, lines: 0, points: 0 });
const scratch = zeroTally();

function idOf(o: object): number {
  let id = objectIds.get(o);
  if (!id) {
    id = nextObjectId++;
    objectIds.set(o, id);
  }
  return id;
}

// ── Frames ───────────────────────────────────────────────────────────────────

/**
 * Run `callback` as one animation-frame callback. The wrapped
 * `requestAnimationFrame` calls this; tests call it directly.
 */
function runAsAnimationFrame(time: number, callback: (time: number) => void): void {
  lastRafTime = time;
  rafCallbackStart = performance.now();
  lastRafAt = rafCallbackStart;
  rafDepth++;
  try {
    callback(time);
  } finally {
    rafDepth--;
    // The script after the last draw is part of the frame's CPU work. Only
    // the callback's end says where that work stopped.
    if (touchedInCallback.size) {
      const end = performance.now();
      for (const t of touchedInCallback) {
        t.callbackEnd = end;
        t.callbackEndKey = t.frameKey;
      }
      touchedInCallback.clear();
    }
  }
}

function postTaskBoundary(): void {
  if (!boundaryPort && typeof MessageChannel !== 'undefined') {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      taskToken++;
      boundaryPending = false;
    };
    boundaryPort = channel.port2;
  }
  if (boundaryPort) boundaryPort.postMessage(0);
  else
    setTimeout(() => {
      taskToken++;
      boundaryPending = false;
    }, 0);
}

/**
 * The key of the frame a call made now belongs to. Animation-frame keys are
 * timestamps (0 or more); task keys are negative, so the two never collide.
 */
function frameKeyAt(now: number): number {
  if (rafDepth > 0 || now - lastRafAt < RAF_ACTIVE_MS) return lastRafTime;
  if (!boundaryPending) {
    boundaryPending = true;
    postTaskBoundary();
  }
  return -1 - taskToken;
}

function trackFor(renderer: RendererLike): Track {
  let t = tracks.get(renderer);
  if (!t) {
    t = {
      renderer,
      claim: null,
      session: null,
      sessionId: null,
      timer: null,
      stack: [],
      frameKey: null,
      frameId: -1,
      framesSeen: 0,
      cpuStart: 0,
      firstCallStart: null,
      lastCallEnd: 0,
      callbackEnd: null,
      callbackEndKey: null,
      tally: zeroTally(),
      renderCalls: 0,
      computeCalls: 0,
      passes: [],
      passWall: [],
      passNames: new Map(),
      frameTargets: new Map(),
      cameraUse: new Map(),
      betweenMs: 0,
      preInner: 0,
      betweenInner: 0,
      sinceLastInner: 0,
      costs: { ...ZERO_COSTS },
      nextCosts: { ...ZERO_COSTS },
      nextPreInner: 0,
      disposed: false,
      lastPrograms: null,
      lastHeapMB: null,
      scenes: new Map(),
      windows: [],
      inventoryDue: 0,
      apiWrapped: false,
    };
    tracks.set(renderer, t);
    wrapGraphicsApi(t);
  }
  return t;
}

function readTally(r: RendererLike, out: DrawTally): DrawTally {
  const render = r.info?.render;
  // WebGPU counts draws as `drawCalls` and render PASSES as `calls`; WebGL has
  // only `calls`, which counts draws. Reading `calls` first would report
  // passes as draws on WebGPU.
  out.drawCalls = render?.drawCalls ?? render?.calls ?? 0;
  out.triangles = render?.triangles ?? 0;
  out.lines = render?.lines ?? 0;
  out.points = render?.points ?? 0;
  return out;
}

function apiOf(r: RendererLike): GraphicsApi {
  if (r.isWebGPURenderer) return r.backend?.isWebGLBackend ? 'webgl' : 'webgpu';
  if (r.isWebGLRenderer) return 'webgl';
  return 'unknown';
}

function surfaceOf(r: RendererLike): SurfaceSize {
  const el = r.domElement;
  return {
    width: el?.width ?? 0,
    height: el?.height ?? 0,
    dpr: r.getPixelRatio?.() ?? 1,
  };
}

function readHeapMB(): number | null {
  const mem = (performance as { memory?: { usedJSHeapSize?: number } }).memory;
  return typeof mem?.usedJSHeapSize === 'number' ? mem.usedJSHeapSize / (1024 * 1024) : null;
}

/** File the frame that just ended into the session: counters, passes, parts, then CPU. */
function finishFrame(t: Track): void {
  const s = t.session;
  if (t.timer && t.frameId >= 0) {
    t.timer.pause();
    t.timer.closeFrame(t.frameId);
  }
  if (!s) return;
  const r = t.renderer;
  const memory = r.info?.memory ?? {};
  const programs = Array.isArray(r.info?.programs) ? r.info!.programs!.length : null;
  const counters: RendererCounters = {
    ...t.tally,
    computeCalls: t.computeCalls,
    renderCalls: t.renderCalls,
    geometries: memory.geometries ?? 0,
    textures: memory.textures ?? 0,
    programs,
  };
  s.setRendererReading({ api: apiOf(r), counters, surface: surfaceOf(r) });
  s.recordPasses(t.frameId, t.passes);

  // ── Where the CPU went, in parts that add up ──
  const cbEnd = t.callbackEndKey === t.frameKey && t.callbackEnd !== null ? t.callbackEnd : t.lastCallEnd;
  const cpuEnd = Math.max(t.lastCallEnd, cbEnd);
  let spanMs = s.takeSpanFrameMs();
  const takeSpans = (ms: number) => {
    const used = Math.min(ms, spanMs);
    spanMs -= used;
    return ms - used;
  };
  const first = t.firstCallStart ?? t.cpuStart;
  const pre = takeSpans(Math.max(0, first - t.cpuStart - t.preInner));
  const between = takeSpans(Math.max(0, t.betweenMs - t.betweenInner));
  const after = takeSpans(Math.max(0, cpuEnd - t.lastCallEnd - t.sinceLastInner));
  const parts: { name: string; ms: number }[] = [
    { name: 'page script before the first draw', ms: pre },
    { name: 'page script between draws', ms: between },
    { name: 'page script after the last draw', ms: after },
    { name: 'texture upload', ms: t.costs.textureUploadMs },
    { name: 'buffer upload', ms: t.costs.bufferUploadMs },
    { name: 'shader compile', ms: t.costs.compileMs },
    { name: 'GPU readback (the CPU waits)', ms: t.costs.readbackMs },
  ];
  for (const p of t.passes) parts.push({ name: `draw: ${p.name}`, ms: p.cpuMs });

  // ── Causes with no time ──
  const notes: string[] = [];
  const costs = { ...t.costs };
  if (programs !== null && t.lastPrograms !== null && programs > t.lastPrograms) {
    costs.programsAdded = programs - t.lastPrograms;
    notes.push(`+${costs.programsAdded} shader program${costs.programsAdded === 1 ? '' : 's'}`);
  }
  if (programs !== null) t.lastPrograms = programs;
  if (costs.textureUploads > 0) {
    notes.push(`${costs.textureUploads} texture upload${costs.textureUploads === 1 ? '' : 's'}, ${formatBytes(costs.textureBytes)}`);
  }
  const heap = readHeapMB();
  if (heap !== null && t.lastHeapMB !== null && t.lastHeapMB - heap >= GC_FALL_MB && s.heapIsPrecise()) {
    notes.push(`heap fell ${(t.lastHeapMB - heap).toFixed(1)} MB (a garbage collection; its time is not reported)`);
  }
  t.lastHeapMB = heap;

  s.recordFrameParts(parts, costs, notes);
  s.recordCpuFrame(Math.max(0, cpuEnd - t.cpuStart));
  t.windows.push({ id: t.frameId, start: t.cpuStart, end: cpuEnd });
  if (t.windows.length > 30) t.windows.shift();
}

function startFrame(t: Track, key: number, now: number): void {
  if (t.frameKey !== null) finishFrame(t);
  t.frameKey = key;
  t.framesSeen++;
  // CPU time starts where the frame's work started: the top of the
  // animation-frame callback, which is before the scene's own updates.
  t.cpuStart = rafDepth > 0 ? rafCallbackStart : now;
  t.firstCallStart = null;
  t.tally = zeroTally();
  t.renderCalls = 0;
  t.computeCalls = 0;
  t.passes = [];
  t.passWall = [];
  t.passNames.clear();
  t.frameTargets.clear();
  t.betweenMs = 0;
  t.betweenInner = 0;
  t.sinceLastInner = 0;
  t.costs = t.nextCosts;
  t.preInner = t.nextPreInner;
  t.nextCosts = { ...ZERO_COSTS };
  t.nextPreInner = 0;

  ensureSession(t);
  const s = t.session;
  if (!s) {
    t.frameId = -1;
    return;
  }

  /* ORDER MATTERS HERE. `frame()` first judges the frame that just ended with
   * everything `finishFrame` filed for it. `currentFrame` then names the frame
   * starting now, and every GPU segment opened in it carries that id. */
  const rec = s.frame(t.cpuStart);
  if (rec) attachBufferedBrowserReports(t, s, rec);
  t.frameId = s.currentFrame;
  if (t.timer) for (const result of t.timer.collect()) s.recordPassGpu(result);
  maybeRunInventory(t, now);
}

// ── Passes ───────────────────────────────────────────────────────────────────

function tagOf(o: { userData?: Record<string, unknown> } | null | undefined): string | null {
  const v = o?.userData?.perfPass;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * A name for a scene nobody named. A scene of one object is named by that
 * object: its name, "fullscreen quad", or its kind, material and geometry
 * ("Mesh · ShaderMaterial · SphereGeometry" reads as a sky dome).
 */
export function sceneLabel(scene: ObjectLike): string {
  if (scene.name && scene.name.trim() && scene.name !== 'Scene') return scene.name.trim();
  const tag = scene.userData?.perfGroup;
  if (typeof tag === 'string' && tag.trim()) return tag.trim();
  const kids = scene.children ?? [];
  // three can draw one object with no scene around it (post-processing does,
  // with its fullscreen triangle): describe that object, not "0 objects".
  const drawnAlone = !scene.isScene && (scene as { isMesh?: boolean }).isMesh === true;
  if (kids.length === 1 || drawnAlone) {
    const only = (drawnAlone ? scene : kids[0]) as ObjectLike & { material?: { type?: string } | { type?: string }[] };
    const p = only.geometry?.parameters;
    const childTag = only.userData?.perfGroup;
    if (typeof childTag === 'string' && childTag.trim()) return childTag.trim();
    if (only.geometry?.type === 'PlaneGeometry' && p?.width === 2 && p?.height === 2) return 'fullscreen quad';
    if (only.name && only.name.trim()) return only.name.trim();
    // Short forms, so the name fits the panel: "Mesh · Shader · Sphere".
    const mat = Array.isArray(only.material) ? only.material[0] : only.material;
    const m = mat?.type?.replace(/Material$/, '').replace(/^Mesh(?=[A-Z])/, '');
    const g = only.geometry?.type?.replace(/Geometry$/, '');
    return [only.type ?? 'object', m, g].filter(Boolean).join(' · ');
  }
  return `${kids.length} objects`;
}

/** A target's width against the canvas, as a word: "full", "½", "¼", or its pixel size. */
function sizeClass(t: Track, target: TargetLike): string {
  const cw = t.renderer.domElement?.width ?? 0;
  const w = target.width ?? 0;
  if (cw > 0 && w > 0) {
    const r = w / cw;
    for (const [ratio, word] of [[1, 'full'], [0.5, '½'], [0.25, '¼'], [2, '2×']] as const) {
      if (Math.abs(r - ratio) <= 0.02 * ratio + 1 / cw) return word;
    }
  }
  return `${target.width ?? '?'}×${target.height ?? '?'}`;
}

/**
 * A target's name: its own name, else its size against the canvas ("½
 * target", "full target #2" for the second full-size target in the frame).
 *
 * Two names were tried first and failed on the river. An object id changed on
 * every resize, which replaces the targets, so a renamed pass read as a new
 * cost on the slow-frame log. A letter by first use in the frame (A, B, C)
 * shifted when a pass was switched off: with the reflection gone the opaque
 * target became "A", and compare set the opaque pass against the old mirror
 * pass. A size class holds through both.
 */
function targetLabel(t: Track, target: TargetLike | null): { name: string; detail: string } {
  if (!target) return { name: 'screen', detail: 'screen' };
  const size = `${target.width ?? '?'}×${target.height ?? '?'}${target.texture?.generateMipmaps ? ', mips' : ''}`;
  const named = target.texture?.name || target.name;
  if (named) return { name: named, detail: `${named} (${size})` };
  let label = t.frameTargets.get(target as object);
  if (!label) {
    const cls = sizeClass(t, target);
    const n = [...t.frameTargets.values()].filter((v) => v === `${cls} target` || v.startsWith(`${cls} target #`)).length + 1;
    label = n === 1 ? `${cls} target` : `${cls} target #${n}`;
    t.frameTargets.set(target as object, label);
  }
  return { name: label, detail: `${label} (${size})` };
}

/** Name a render call. Tags win; otherwise "scene → target". */
function describeRender(t: Track, scene: unknown, camera: unknown): { name: string; sceneKey: number | null; target: string } {
  const target = t.renderer.getRenderTarget?.() ?? null;
  const sc = scene && typeof scene === 'object' ? (scene as ObjectLike) : null;
  const cam = camera && typeof camera === 'object' ? (camera as { userData?: Record<string, unknown> }) : null;
  const tl = targetLabel(t, target);
  const tag =
    tagOf(sc) ?? tagOf(cam) ?? tagOf(target) ?? tagOf(target?.texture ?? null);
  const name = tag ?? `${sc ? sceneLabel(sc) : 'no scene'} → ${tl.name}`;
  return { name, sceneKey: sc ? idOf(sc) : null, target: tl.detail };
}

function describeCompute(nodes: unknown): string {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  const first = list[0] as { name?: unknown; userData?: Record<string, unknown> } | undefined;
  // Only a STRING name. A TSL node's `label` is a method, and printing it put
  // the function's source text into the ocean's pass name.
  const own = typeof first?.name === 'string' ? first.name.trim() : '';
  const label = tagOf(first) || own;
  if (list.length > 1) return `compute ×${list.length}${label ? ` (${label}, …)` : ''}`;
  return label ? `compute: ${label}` : 'compute';
}

function openPass(t: Track, kind: PassKind, method: string, args: unknown[]): OpenCall {
  let name: string;
  let sceneKey: number | null = null;
  let target = kind === 'compute' ? 'compute' : 'screen';
  if (kind === 'render') {
    const d = describeRender(t, args[0], args[1]);
    name = d.name;
    sceneKey = d.sceneKey;
    target = d.target;
  } else if (kind === 'shadow') {
    name = 'shadow map';
    target = 'shadow maps';
  } else {
    name = describeCompute(args[0]);
  }
  const depth = t.stack.length;
  // The same name twice in one frame gets a number, so each keeps its own row.
  const base = `${depth}|${name}`;
  const seen = (t.passNames.get(base) ?? 0) + 1;
  t.passNames.set(base, seen);
  const key = seen === 1 ? base : `${base}#${seen}`;
  const index = t.passes.length;
  t.passes.push({
    key,
    name: seen === 1 ? name : `${name} (${seen})`,
    kind,
    depth,
    sceneKey,
    target,
    cpuMs: 0,
    triangles: 0,
    drawCalls: 0,
    lines: 0,
    points: 0,
  });
  t.passWall.push(0);
  const call: OpenCall = {
    pass: index,
    method,
    kind,
    arg0: args[0],
    arg1: args[1],
    start: performance.now(),
    pre: readTally(t.renderer, zeroTally()),
    resetInside: kind === 'render' && t.renderer.isWebGLRenderer === true && t.renderer.info?.autoReset === true,
    childWall: 0,
    childTally: zeroTally(),
    innerCost: 0,
  };
  if (kind === 'render' && args[0] && typeof args[0] === 'object') {
    const scene = args[0] as ObjectLike;
    let entry = t.scenes.get(scene);
    if (!entry) {
      entry = { sceneKey: sceneKey ?? 0, label: sceneLabel(scene), cameras: new Map(), lastAt: call.start };
      t.scenes.set(scene, entry);
    }
    entry.lastAt = call.start;
    const cam = args[1];
    if (cam && typeof cam === 'object') t.cameraUse.set(cam, (t.cameraUse.get(cam) ?? 0) + 1);
  }
  return call;
}

function beforeCall(t: Track, kind: PassKind, method: string, args: unknown[]): void {
  const now = performance.now();
  if (t.stack.length === 0) {
    const key = frameKeyAt(now);
    if (t.frameKey !== key) startFrame(t, key, now);
    if (t.firstCallStart === null) {
      t.firstCallStart = now;
    } else {
      t.betweenMs += now - t.lastCallEnd;
      t.betweenInner += t.sinceLastInner;
    }
    t.sinceLastInner = 0;
    if (rafDepth > 0) touchedInCallback.add(t);
  }
  const call = openPass(t, kind, method, args);
  t.stack.push(call);
  if (t.timer && t.frameId >= 0) t.timer.begin(t.frameId, call.pass);
}

function afterCall(t: Track): void {
  const call = t.stack.pop();
  if (!call) return;
  const end = performance.now();
  const wall = end - call.start;
  const post = readTally(t.renderer, scratch);
  const add = (after: number, before: number) =>
    call.resetInside || after < before ? after : after - before;
  const delta: DrawTally = {
    drawCalls: add(post.drawCalls, call.pre.drawCalls),
    triangles: add(post.triangles, call.pre.triangles),
    lines: add(post.lines, call.pre.lines),
    points: add(post.points, call.pre.points),
  };
  const p = t.passes[call.pass];
  p.cpuMs = Math.max(0, wall - call.childWall - call.innerCost);
  p.drawCalls = Math.max(0, delta.drawCalls - call.childTally.drawCalls);
  p.triangles = Math.max(0, delta.triangles - call.childTally.triangles);
  p.lines = Math.max(0, delta.lines - call.childTally.lines);
  p.points = Math.max(0, delta.points - call.childTally.points);
  t.passWall[call.pass] = wall;

  // Which cameras drew this scene, and how much each drew; the inventory
  // judges the scene through the eye camera (see `inventoryInputs`).
  if (call.kind === 'render' && call.arg0 && typeof call.arg0 === 'object' && call.arg1 && typeof call.arg1 === 'object') {
    const entry = t.scenes.get(call.arg0 as object);
    if (entry) entry.cameras.set(call.arg1, Math.max(entry.cameras.get(call.arg1) ?? 0, delta.triangles));
  }

  const parent = t.stack[t.stack.length - 1];
  if (parent) {
    parent.childWall += wall;
    parent.childTally.drawCalls += delta.drawCalls;
    parent.childTally.triangles += delta.triangles;
    parent.childTally.lines += delta.lines;
    parent.childTally.points += delta.points;
    if (t.timer && t.frameId >= 0) t.timer.begin(t.frameId, parent.pass);
  } else {
    if (t.timer) t.timer.pause();
    t.tally.drawCalls += delta.drawCalls;
    t.tally.triangles += delta.triangles;
    t.tally.lines += delta.lines;
    t.tally.points += delta.points;
    if (call.kind === 'compute') t.computeCalls++;
    else t.renderCalls++;
    t.lastCallEnd = end;
  }
}

// ── Uploads and compiles ─────────────────────────────────────────────────────

function addCost(c: FrameCosts, kind: CostKind, ms: number, bytes: number): void {
  if (kind === 'texture') {
    c.textureUploadMs += ms;
    c.textureUploads++;
    c.textureBytes += bytes;
  } else if (kind === 'buffer') {
    c.bufferUploadMs += ms;
    c.bufferUploads++;
    c.bufferBytes += bytes;
  } else if (kind === 'readback') {
    c.readbackMs += ms;
    c.readbacks++;
  } else {
    c.compileMs += ms;
    c.compiles++;
  }
}

/**
 * File one upload or compile, and take its time out of whichever CPU part it
 * happened inside, so the parts still add up.
 */
function recordCost(t: Track, kind: CostKind, ms: number, bytes: number, count = true): void {
  if (internalDepth > 0) return;
  const top = t.stack[t.stack.length - 1];
  // Which frame's books, and which CPU part the time comes out of.
  let into = t.costs;
  if (top) {
    top.innerCost += ms;
  } else if (rafDepth > 0 && t.frameKey !== lastRafTime) {
    // A new frame's callback before its first call: it belongs to that frame.
    into = t.nextCosts;
    t.nextPreInner += ms;
  } else if (rafDepth > 0) {
    if (t.firstCallStart === null) t.preInner += ms;
    else t.sinceLastInner += ms;
  }
  // Outside any frame callback, the time is not in the CPU window at all; it
  // is named here and so comes out of "outside the measured frame" instead.
  if (count) addCost(into, kind, ms, bytes);
  else if (kind === 'compile') into.compileMs += ms;
}

function bytesOf(args: unknown[]): number {
  for (let i = args.length - 1; i >= 0; i--) {
    const a = args[i];
    if (a && typeof a === 'object') {
      if (ArrayBuffer.isView(a)) return (a as ArrayBufferView).byteLength;
      if (a instanceof ArrayBuffer) return a.byteLength;
      const src = a as { width?: number; height?: number; videoWidth?: number; videoHeight?: number };
      const w = src.videoWidth ?? src.width;
      const h = src.videoHeight ?? src.height;
      if (typeof w === 'number' && typeof h === 'number') return w * h * 4;
    }
  }
  return 0;
}

/** Bytes of an RGBA8 copy of a WebGPU extent, `[w, h]` or `{ width, height }`. */
function extentBytes(size: unknown): number {
  if (Array.isArray(size)) return (Number(size[0]) || 0) * (Number(size[1]) || 1) * 4;
  const s = size as { width?: number; height?: number } | null;
  return s && typeof s.width === 'number' ? s.width * (s.height ?? 1) * 4 : 0;
}

function wrapTimed(owner: Record<string, unknown>, name: string, onCost: (ms: number, args: unknown[]) => void): void {
  const original = owner[name] as Wrappable | undefined;
  if (typeof original !== 'function' || original[WRAPPED]) return;
  const wrapped: Wrappable = function (this: unknown, ...args: unknown[]) {
    const t0 = performance.now();
    try {
      return original.apply(this, args);
    } finally {
      try {
        onCost(performance.now() - t0, args);
      } catch {
        /* never let the probe break an upload */
      }
    }
  };
  wrapped[WRAPPED] = true;
  owner[name] = wrapped;
}

const GL_TEXTURE_CALLS = [
  'texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D', 'compressedTexImage2D',
  'compressedTexSubImage2D', 'compressedTexImage3D', 'compressedTexSubImage3D', 'texStorage2D', 'texStorage3D',
  'copyTexImage2D', 'copyTexSubImage2D',
];
const GL_BUFFER_CALLS = ['bufferData', 'bufferSubData'];
const GL_COMPILE_CALLS = ['compileShader', 'linkProgram', 'getProgramParameter', 'getShaderParameter'];
/** Calls where the CPU waits for the GPU to finish everything queued before them. */
const GL_READBACK_CALLS = ['readPixels', 'getBufferSubData', 'finish', 'clientWaitSync'];

/**
 * Wrap the graphics API calls that move data or compile shaders.
 *
 * WebGL: on the renderer's own context object, so no other canvas is
 * touched. A texture call's bytes come from its data argument, or from the
 * image's size (4 bytes a pixel); `texStorage*` allocates and counts no bytes.
 * `getProgramParameter` is in the compile set because it is where the main
 * thread waits for a link that the driver ran in parallel.
 *
 * WebGPU: on the device and its queue, once the backend has a device.
 */
function wrapGraphicsApi(t: Track): void {
  if (t.apiWrapped) return;
  const r = t.renderer;
  if (r.isWebGLRenderer) {
    const gl = r.getContext?.() as Record<string, unknown> | undefined;
    if (!gl || typeof gl !== 'object') return;
    t.apiWrapped = true;
    for (const n of GL_TEXTURE_CALLS) wrapTimed(gl, n, (ms, a) => recordCost(t, 'texture', ms, bytesOf(a)));
    for (const n of GL_BUFFER_CALLS) {
      wrapTimed(gl, n, (ms, a) => recordCost(t, 'buffer', ms, typeof a[1] === 'number' && n === 'bufferData' ? 0 : bytesOf(a)));
    }
    for (const n of GL_READBACK_CALLS) wrapTimed(gl, n, (ms) => recordCost(t, 'readback', ms, 0));
    for (const n of GL_COMPILE_CALLS) {
      // Every call adds its time; only `linkProgram` counts as one compile.
      wrapTimed(gl, n, (ms) => recordCost(t, 'compile', ms, 0, n === 'linkProgram'));
    }
    return;
  }
  const device = r.backend?.device;
  if (!device || typeof device !== 'object') return; // not ready yet; try again on the next call
  t.apiWrapped = true;
  const queue = device.queue;
  if (queue && typeof queue === 'object') {
    wrapTimed(queue, 'writeBuffer', (ms, a) => recordCost(t, 'buffer', ms, bytesOf(a.slice(2, 3))));
    wrapTimed(queue, 'writeTexture', (ms, a) => recordCost(t, 'texture', ms, bytesOf(a.slice(1, 2))));
    wrapTimed(queue, 'copyExternalImageToTexture', (ms, a) => recordCost(t, 'texture', ms, extentBytes(a[2])));
  }
  for (const n of ['createShaderModule', 'createRenderPipeline', 'createComputePipeline', 'createRenderPipelineAsync', 'createComputePipelineAsync']) {
    wrapTimed(device, n, (ms) => recordCost(t, 'compile', ms, 0));
  }
}

// ── Browser reports (Long Animation Frame) ───────────────────────────────────

function ownWindowFor(t: Track, start: number, end: number): [number, number] | null {
  for (let i = t.windows.length - 1; i >= 0; i--) {
    const w = t.windows[i];
    if (w.start < end && w.end > start) return [w.start, w.end];
  }
  return null;
}

function attachReport(t: Track, s: PerfSession, e: LoafLike): void {
  const end = e.startTime + e.duration;
  for (const rec of s.stallsOverlapping(e.startTime, end)) {
    s.attachBrowserParts(rec, browserParts(e, ownWindowFor(t, e.startTime, end)));
  }
}

function attachBufferedBrowserReports(t: Track, s: PerfSession, rec: { startMs: number; atMs: number }): void {
  for (const e of loafBuffer) {
    if (e.startTime < rec.atMs && e.startTime + e.duration > rec.startMs) attachReport(t, s, e);
  }
}

function observeLongFrames(): void {
  if (typeof PerformanceObserver === 'undefined') return;
  if (!PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')) return;
  try {
    const obs = new PerformanceObserver((list) => {
      const now = performance.now();
      for (const entry of list.getEntries()) {
        const e = entry as unknown as LoafLike;
        loafBuffer.push(e);
        for (const t of measured) if (t.session) attachReport(t, t.session, e);
      }
      while (loafBuffer.length && now - (loafBuffer[0].startTime + loafBuffer[0].duration) > LOAF_KEEP_MS) loafBuffer.shift();
    });
    obs.observe({ type: 'long-animation-frame', buffered: false });
  } catch {
    /* an older browser: the remainder keeps its honest name */
  }
}

// ── Scene inventory ──────────────────────────────────────────────────────────

/**
 * The scenes seen lately, each with the camera its view is judged by: the
 * EYE camera, which is the one that drew the most passes in the last second.
 * The river draws its scene twice, into the mirror and for the eye; the
 * mirror pass draws MORE triangles (2.07 M against 1.85 M on 2026-09-29), so
 * "the camera of the largest pass" chose the mirror. The eye camera also
 * draws the sky, the water and the edit handles, so it wins on use.
 */
function inventoryInputs(t: Track, now: number): InventoryInput[] {
  const out: InventoryInput[] = [];
  for (const [scene, e] of t.scenes) {
    if (now - e.lastAt > 3000) {
      t.scenes.delete(scene);
      continue;
    }
    let camera: object | null = null;
    let bestUse = -1;
    let bestTris = -1;
    for (const [cam, tris] of e.cameras) {
      const use = t.cameraUse.get(cam) ?? 0;
      if (use > bestUse || (use === bestUse && tris > bestTris)) {
        camera = cam;
        bestUse = use;
        bestTris = tris;
      }
    }
    // The label is read again each walk: a scene named after it first drew keeps no stale name.
    e.label = sceneLabel(scene as ObjectLike);
    out.push({ sceneKey: e.sceneKey, label: e.label, scene: scene as never, camera: camera as CameraLike | null });
  }
  return out;
}

/** Walk the scenes once a second, between frames, when the page is idle. */
function maybeRunInventory(t: Track, now: number): void {
  if (now < t.inventoryDue || !t.session) return;
  t.inventoryDue = now + INVENTORY_MS;
  const run = () => {
    const s = t.session;
    if (!s) return;
    try {
      s.setInventory(takeInventory(inventoryInputs(t, performance.now())));
    } catch {
      /* a scene mid-rebuild; the next walk will read it */
    }
    // Each second picks its cameras afresh, so a camera that stopped drawing cannot keep a scene.
    for (const e of t.scenes.values()) e.cameras.clear();
    t.cameraUse.clear();
  };
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === 'function') ric(run, { timeout: 500 });
  else setTimeout(run, 0);
}

// ── Sessions ─────────────────────────────────────────────────────────────────

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'surface';
}

/** A name set in markup: `data-perf-id` and `data-perf-label` on any ancestor. */
function markupClaim(canvas: HTMLCanvasElement | undefined): Claim | null {
  const host = canvas?.closest?.('[data-perf-id]');
  const id = host?.getAttribute('data-perf-id');
  if (!id) return null;
  return { id, label: host?.getAttribute('data-perf-label') || id, gpuTiming: true };
}

/**
 * What to call a surface nobody named.
 *
 * The Design Preview puts every step in a WindowFrame, and WindowFrame labels
 * its dialog with the window title. So a canvas in the "Water" window is
 * called "Water" — the same name the reader sees on the window.
 */
function autoLabel(canvas: HTMLCanvasElement): string {
  const labeled = canvas.closest('[data-perf-label]')?.getAttribute('data-perf-label');
  if (labeled) return labeled;
  const windowTitle = canvas.closest('[role="dialog"][aria-label]')?.getAttribute('aria-label');
  if (windowTitle) return windowTitle;
  const step = new URLSearchParams(window.location.search).get('step');
  if (step) return step;
  return document.title || '3D view';
}

function attach(t: Track, id: string, label: string, origin: 'named' | 'auto', gpuTiming: boolean): void {
  const s = acquirePerfSession(id, label);
  s.origin = origin;
  s.element = t.renderer.domElement ?? null;
  t.session = s;
  t.sessionId = id;
  measured.add(t);
  startSweep();

  if (!gpuTiming) {
    s.setGpuUnavailable('disabled');
    return;
  }
  const attempt = PassGpuTimer.forRenderer(t.renderer);
  t.timer = attempt.timer;
  s.setGpuUnavailable(attempt.reason);
}

function ensureSession(t: Track): void {
  if (t.session) return;
  if (t.claim) {
    attach(t, t.claim.id, t.claim.label, 'named', t.claim.gpuTiming);
    return;
  }
  const canvas = t.renderer.domElement;
  // One render is a bake, not a surface: a swatch, an impostor, a thumbnail.
  if (t.framesSeen < 2) return;
  // A canvas that is not on the page is an off-screen helper, not a surface.
  if (!canvas || !canvas.isConnected) return;
  const fromMarkup = markupClaim(canvas);
  if (fromMarkup) {
    attach(t, fromMarkup.id, fromMarkup.label, 'named', true);
    return;
  }
  const label = autoLabel(canvas);
  attach(t, uniquePerfSessionId(`auto:${slug(label)}`), label, 'auto', true);
}

function detach(t: Track): void {
  if (t.timer) {
    t.timer.dispose();
    t.timer = null;
  }
  if (t.session && t.sessionId) {
    releasePerfSession(t.sessionId);
  }
  t.session = null;
  t.sessionId = null;
  t.frameKey = null;
  t.frameId = -1;
  t.stack.length = 0;
  t.scenes.clear();
  t.cameraUse.clear();
  measured.delete(t);
}

function startSweep(): void {
  if (sweepTimer !== null || typeof setInterval === 'undefined') return;
  sweepTimer = setInterval(() => {
    for (const t of [...measured]) {
      const canvas = t.renderer.domElement;
      if (!canvas || !canvas.isConnected) detach(t);
    }
    if (measured.size === 0 && sweepTimer !== null) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  }, SWEEP_MS);
}

// ── Wrapping ─────────────────────────────────────────────────────────────────

const KIND_OF: Record<string, PassKind> = {
  render: 'render',
  renderAsync: 'render',
  compute: 'compute',
  computeAsync: 'compute',
};

function wrapMethod(owner: Record<string, unknown>, name: string, mode: 'call' | 'dispose'): void {
  const original = owner[name] as Wrappable | undefined;
  if (typeof original !== 'function' || original[WRAPPED]) return;

  let wrapped: Wrappable;
  if (mode === 'dispose') {
    wrapped = function (this: RendererLike, ...args: unknown[]) {
      const t = tracks.get(this);
      if (t) {
        detach(t);
        t.disposed = true;
      }
      return original.apply(this, args);
    };
  } else {
    const kind = KIND_OF[name] ?? 'render';
    wrapped = function (this: RendererLike, ...args: unknown[]) {
      /* The probe must never be the reason a frame fails to draw. Its own
       * bookkeeping is fenced off, and the original call always runs. */
      let t: Track | null = null;
      try {
        if (internalDepth === 0) {
          const candidate = trackFor(this);
          if (!candidate.disposed) {
            if (!candidate.apiWrapped) wrapGraphicsApi(candidate);
            const top = candidate.stack[candidate.stack.length - 1];
            // `computeAsync` calls `compute`, and an uninitialized `render`
            // calls `renderAsync`: the same work, so one pass, not two.
            const same = top && top.kind === kind && top.arg0 === args[0] && (top.method.endsWith('Async') || name.endsWith('Async'));
            if (!same) {
              beforeCall(candidate, kind, name, args);
              t = candidate;
            }
          }
        }
      } catch {
        t = null;
      }
      if (!t) return original.apply(this, args);
      try {
        return original.apply(this, args);
      } finally {
        try {
          afterCall(t);
        } catch {
          /* a counter read failed; the frame still drew */
        }
      }
    };
  }
  wrapped[WRAPPED] = true;
  owner[name] = wrapped;
}

/**
 * Wrap a WebGL renderer's shadow-map render as a pass of its own. It runs
 * inside the scene's `render`, so it becomes a child pass: its draws and its
 * GPU segment are taken out of the scene pass. A shadow map that is up to date
 * returns at once; that call is not recorded as a pass.
 */
function wrapShadowMap(r: RendererLike): void {
  const sm = r.shadowMap as Record<string, unknown> | undefined;
  if (!sm) return;
  const original = sm.render as Wrappable | undefined;
  if (typeof original !== 'function' || original[WRAPPED]) return;
  const wrapped: Wrappable = function (this: unknown, ...args: unknown[]) {
    let t: Track | null = null;
    try {
      const m = r.shadowMap!;
      const lights = args[0] as unknown[] | undefined;
      const willDraw = m.enabled !== false && (m.autoUpdate !== false || m.needsUpdate === true) && (lights?.length ?? 0) > 0;
      const candidate = tracks.get(r);
      if (willDraw && candidate && !candidate.disposed && internalDepth === 0 && candidate.stack.length > 0) {
        beforeCall(candidate, 'shadow', 'shadowMap.render', args);
        t = candidate;
      }
    } catch {
      t = null;
    }
    if (!t) return original.apply(this, args);
    try {
      return original.apply(this, args);
    } finally {
      try {
        afterCall(t);
      } catch {
        /* the frame still drew */
      }
    }
  };
  wrapped[WRAPPED] = true;
  sm.render = wrapped;
}

/** Wrap `render` and friends where the class defines them (WebGPU). */
function wrapClass(proto: object | null): void {
  let owner = proto;
  while (owner && !Object.prototype.hasOwnProperty.call(owner, 'render')) {
    owner = Object.getPrototypeOf(owner);
  }
  if (!owner || wrappedClasses.has(owner)) return;
  wrappedClasses.add(owner);
  const o = owner as Record<string, unknown>;
  wrapMethod(o, 'render', 'call');
  wrapMethod(o, 'renderAsync', 'call');
  wrapMethod(o, 'compute', 'call');
  wrapMethod(o, 'computeAsync', 'call');
  wrapMethod(o, 'dispose', 'dispose');
}

function wrapRenderer(r: RendererLike): void {
  if (r.isWebGPURenderer) {
    wrapClass(Object.getPrototypeOf(r));
    return;
  }
  // WebGLRenderer: the methods are own properties of the instance.
  const o = r as unknown as Record<string, unknown>;
  wrapMethod(o, 'render', 'call');
  wrapMethod(o, 'dispose', 'dispose');
  wrapShadowMap(r);
}

// ── Discovery ────────────────────────────────────────────────────────────────

function listenForWebGlRenderers(): void {
  const w = window as unknown as { __THREE_DEVTOOLS__?: EventTarget };
  // The three.js DevTools browser extension may already own this object. The
  // probe then listens beside it rather than replacing it.
  if (w.__THREE_DEVTOOLS__ === undefined) w.__THREE_DEVTOOLS__ = new EventTarget();
  const hook = w.__THREE_DEVTOOLS__;
  if (typeof hook?.addEventListener !== 'function') return;
  hook.addEventListener('observe', (event) => {
    const detail = (event as CustomEvent).detail as RendererLike | undefined;
    if (detail?.isWebGLRenderer) wrapRenderer(detail);
  });
}

function loadWebGpuClass(): void {
  if (webGpuClassRequested) return;
  webGpuClassRequested = true;
  import('three/webgpu')
    .then((mod) => {
      const ctor = (mod as { WebGPURenderer?: { prototype: object } }).WebGPURenderer;
      if (ctor) wrapClass(ctor.prototype);
    })
    .catch(() => {
      // Let a later context try again; the page still draws either way.
      webGpuClassRequested = false;
    });
}

function watchWebGpuContexts(): void {
  if (typeof HTMLCanvasElement === 'undefined') return;
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  const native = proto.getContext as Wrappable;
  if (typeof native !== 'function' || native[WRAPPED]) return;
  const wrapped: Wrappable = function (this: HTMLCanvasElement, ...args: unknown[]) {
    const ctx = native.apply(this, args);
    if (args[0] === 'webgpu' && ctx) loadWebGpuClass();
    return ctx;
  };
  wrapped[WRAPPED] = true;
  proto.getContext = wrapped;
}

function wrapAnimationFrames(): void {
  const native = window.requestAnimationFrame as unknown as Wrappable;
  if (typeof native !== 'function' || native[WRAPPED]) return;
  const wrapped = function (callback: FrameRequestCallback): number {
    return (native as unknown as typeof window.requestAnimationFrame).call(window, (time: number) =>
      runAsAnimationFrame(time, callback),
    );
  } as unknown as Wrappable;
  wrapped[WRAPPED] = true;
  window.requestAnimationFrame = wrapped as unknown as typeof window.requestAnimationFrame;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Start measuring every three.js renderer on this page. Safe to call more
 * than once; only the first call does anything.
 *
 * Call it at the top of a page entry, before any scene mounts. A renderer
 * built before this runs is missed until something hands it to
 * `instrumentRenderer`.
 */
export function installPerfAutoProbe(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  listenForWebGlRenderers();
  watchWebGpuContexts();
  wrapAnimationFrames();
  observeLongFrames();
  // For a capture rig: the browser's long-frame reports the probe holds.
  const api = (window as unknown as { __araliaPerf?: Record<string, unknown> }).__araliaPerf;
  // For a capture rig: the live scenes a surface drew lately, with the camera
  // each is judged by. A rig can read or tag them in the page (they are not
  // serializable, so use them inside `page.evaluate`).
  if (api) api.scenes = (id: string) => recentScenesFor(id)?.inputs ?? [];
  // The entries are browser objects whose fields are getters, so copy them by name.
  if (api) {
    api.longFrames = () =>
      loafBuffer.map((e) => ({
        startTime: e.startTime,
        duration: e.duration,
        renderStart: e.renderStart,
        styleAndLayoutStart: e.styleAndLayoutStart,
        scripts: (e.scripts ?? []).map((s) => ({
          invoker: s.invoker,
          invokerType: s.invokerType,
          sourceURL: s.sourceURL,
          sourceFunctionName: s.sourceFunctionName,
          duration: s.duration,
          executionStart: s.executionStart,
        })),
      }));
  }
}

/**
 * Measure this renderer under this name. Returns the release function.
 *
 * The probe measures a renderer without this call. The call adds a stable id
 * and label, and starts the measurement from the next frame instead of the
 * second one. `PerfProbe` is this call for an R3F canvas.
 *
 * It wraps THIS renderer only. It does not install the page-wide hooks
 * (`installPerfAutoProbe`), so a production build that mounts a `PerfProbe`
 * still measures that one canvas, as it always did, and nothing else. Without
 * the hooks, a frame is one task and CPU time starts at the first render call.
 */
export function instrumentRenderer(renderer: unknown, options: InstrumentOptions = {}): () => void {
  if (!renderer || typeof renderer !== 'object') return () => {};
  const r = renderer as RendererLike;
  wrapRenderer(r);
  const t = trackFor(r);
  t.disposed = false;
  const id = options.id ?? uniquePerfSessionId(slug(options.label ?? 'surface'));
  const claim: Claim = { id, label: options.label ?? id, gpuTiming: options.gpuTiming !== false };
  detach(t);
  t.claim = claim;
  return () => {
    if (t.claim !== claim) return;
    detach(t);
    t.claim = null;
  };
}

/** The session the probe feeds for this renderer, or undefined. */
export function perfSessionForRenderer(renderer: unknown): PerfSession | undefined {
  if (!renderer || typeof renderer !== 'object') return undefined;
  return tracks.get(renderer)?.session ?? undefined;
}

/**
 * Run `fn` without the probe measuring the renderer calls it makes. For the
 * probe's own drawing (see viewCoverage.ts).
 */
export function withoutProbe<T>(fn: () => T): T {
  internalDepth++;
  try {
    return fn();
  } finally {
    internalDepth--;
  }
}

/** The scenes and cameras the probe saw recently for this session's renderer. */
export function recentScenesFor(sessionId: string): { renderer: unknown; inputs: InventoryInput[] } | null {
  for (const t of measured) {
    if (t.sessionId === sessionId) return { renderer: t.renderer, inputs: inventoryInputs(t, performance.now()) };
  }
  return null;
}

/**
 * Test seams. Production code never calls these: the wrapped
 * `requestAnimationFrame` and three's own events drive the probe.
 */
export const rendererProbeInternals = {
  runAsAnimationFrame,
  wrapRenderer,
  wrapClass,
  trianglesOf,
  /** Run the scene walk for a renderer now, instead of at the next idle moment. */
  inventoryNow(renderer: unknown): void {
    const t = renderer && typeof renderer === 'object' ? tracks.get(renderer) : undefined;
    if (t?.session) t.session.setInventory(takeInventory(inventoryInputs(t, performance.now())));
  },
  /** The buffered Long Animation Frame entries, for a rig that checks the matching. */
  loafEntries(): LoafLike[] {
    return loafBuffer.slice();
  },
  /** Feed a Long Animation Frame entry, as the browser's observer would. */
  feedLongFrame(e: LoafLike): void {
    loafBuffer.push(e);
    for (const t of measured) if (t.session) attachReport(t, t.session, e);
  },
  /** Forget every track. Wrapped methods stay wrapped. */
  reset(): void {
    for (const t of [...measured]) detach(t);
    lastRafTime = -1;
    lastRafAt = Number.NEGATIVE_INFINITY;
    rafDepth = 0;
    taskToken = 0;
    boundaryPending = false;
    loafBuffer.length = 0;
    touchedInCallback.clear();
  },
};
