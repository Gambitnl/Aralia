/**
 * @file PreviewDungeon.tsx
 * @description Design-preview surface for the procedural dungeon generator
 * (`src/systems/worldforge/dungeon/generateDungeon.ts`). Draws the plan as a
 * hand-inked map sheet: the plan is rendered to an offscreen canvas and blitted
 * onto warm parchment at a small seed-derived rotation, with a title
 * cartouche, legend, and a double-rule frame. Theme (crypt / cavern / frost /
 * sewer / fungal) drives the palette, the wall treatment (coursed block /
 * ragged rock / rime), the surrounding rock, and the décor glyphs.
 *
 * History-first additions (Task 7, matching the approved layout mocks in
 * .agent/scratch/dungeon-layout-mocks.html):
 * - per-cell event overlays (water / rubble / ice / bloom / scorch) painted
 *   UNDER the ink pass,
 * - doors by state (open gap / leaf / BRICKED red-brick patch / secret dash),
 * - loop-edge tunnels get a rough hand-cut outline (dug, not built),
 * - only event-touched rooms are numbered (keyed-map convention) with the
 *   keyed notes listed under the sheet, plus a History event-log panel,
 * - `asOfYearsAgo` scrubber: the dungeon as it was N years ago (older = fewer
 *   scars — the bought-in-town outdated map).
 *
 * Rendering principles (from the 2026-07-06 aesthetics critique wave):
 * one ink hand everywhere (jittered vertices, consistent weights), strong
 * value hierarchy (near-black walls, light floors, whispered detail), warm
 * paper for every theme (cold is an accent, not a wash), no radial vignette.
 * Rendering-only jitter comes from coordinate hashes — no Math.random feeds
 * anything that looks like data.
 *
 * Linework (WS4, 2026-07-07 aesthetics wave): the wall stroke is redrawn as a
 * hand-inked line, not a raster trace. ORGANIC rooms (ellipse/octagon/diamond)
 * have their cell staircase replaced by a Chaikin-smoothed closed curve (traced
 * via {@link traceContours} + {@link chaikin}), so a "circular" cavern reads as
 * one continuous inked cave wall; the dark wall band is recut to follow that
 * curve too, so the OUTER silhouette is a curve, not a chunky octagon. RECT
 * rooms + corridors keep crisp orthogonal walls, but every stroke now carries
 * hand-ink PRESSURE — weight swells on the SE (shadow) side and tapers on the
 * NW (lit) side under the sheet's single upper-left light — plus corner blots.
 * Corridors gain CRAFT: a centre runner reads main arteries wider than spurs,
 * every corridor→room mouth gets a JAMB (dark reveals narrowing the opening +
 * a threshold tick), tees get junction blots, and dug tunnels stay rougher.
 * One pen draws the whole sheet; only the vocabulary (curve vs orthogonal)
 * changes with the room shape.
 *
 * Eyeball surface (Aralia visual-inspection rule) — bitmap is 5 ft cells;
 * entity coordinates arrive in plot-local feet. Pin seeds with `?dseed=<n>`.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateDungeon } from '../../../systems/worldforge/dungeon/generateDungeon';
import { type DungeonTheme, type RoomType } from '../../../systems/worldforge/dungeon/types';
import { DEFAULT_OVERLAYS, TYPE_COLOR, type Overlays } from './previewDungeon/theme';
import { keyedRooms } from './previewDungeon/geometry';
import { renderSheet, SHEET_CSS_W, SHEET_CSS_H } from './previewDungeon/compositor';
import { Dungeon3DPreview } from '../../BattleMap/dungeon/Dungeon3DPreview';

// ── shared 2D / 3D inspection contract ───────────────────────────────────────
// The dungeon is generated once and can be inspected through two presentations.
// 3D is now the default design surface, while the parchment remains available as
// the diegetic player-facing map rather than being replaced or forked.

type DungeonViewMode = 'three-d' | 'parchment';

interface DungeonPreviewWindow extends Window {
  render_game_to_text?: () => string;
  advanceTime?: (milliseconds: number) => Promise<void>;
  __dungeon3dReady?: boolean;
  __dungeon3dViewState?: {
    preset: string;
    autoRotate: boolean;
    fullscreen: boolean;
    visibleProps: number;
    totalProps: number;
  };
}

// ── interactive zoom + pan viewport ─────────────────────────────────────────
// The sheet is composed ONCE ({@link renderSheet}) to a supersampled buffer;
// this is the cheap part that runs on every wheel tick / drag frame. It samples
// a zoom/pan window of that buffer onto the visible canvas with a single
// drawImage — no re-composition, no CSS upscale of rasterized pixels (which
// would blur the fine linework and defeat the whole point). Crispness comes from
// the buffer carrying real detail past 1×; smoothness comes from this being a
// lone blit.

/** The pan/zoom state. `zoom` ≥ 1 (1 = Fit, the exact full-sheet look). `cx`,
 * `cy` ∈ [0,1] are the sheet-normalized coordinates parked at the centre of the
 * visible canvas. */
interface View { zoom: number; cx: number; cy: number }

const FIT_VIEW: View = { zoom: 1, cx: 0.5, cy: 0.5 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

/** Clamp the view so the sampled window can never fall off the buffer: at zoom z
 * the half-window is `0.5/z` wide in normalized space, so the centre is penned
 * into `[0.5/z, 1 − 0.5/z]`. At z = 1 that pins the centre to 0.5 (whole sheet). */
function clampView(v: View): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom));
  const half = 0.5 / zoom;
  const lo = half;
  const hi = 1 - half;
  const clamp = (t: number): number => (lo > hi ? 0.5 : Math.min(hi, Math.max(lo, t)));
  return { zoom, cx: clamp(v.cx), cy: clamp(v.cy) };
}

/**
 * Blits the current viewport of the supersampled sheet `buffer` onto the visible
 * `canvas`. The canvas keeps its canonical 800×1131 CSS footprint (backing store
 * in device pixels for HiDPI sharpness); the source rectangle is the buffer
 * window `[cx±0.5/z, cy±0.5/z]`. High-quality smoothing keeps the downsample
 * clean at Fit and the magnified read crisp when zoomed.
 */
function blitViewport(canvas: HTMLCanvasElement, buffer: HTMLCanvasElement, view: View): void {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const cssW = SHEET_CSS_W;
  const cssH = SHEET_CSS_H;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  // Preserve the canonical desktop size while allowing the parchment to fit a narrow preview
  // pane. Pointer math already reads the rendered rectangle, so zoom and pan remain accurate.
  canvas.style.width = `min(100%, ${cssW}px)`;
  canvas.style.height = 'auto';
  canvas.style.aspectRatio = `${cssW} / ${cssH}`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const v = clampView(view);
  const bw = buffer.width;
  const bh = buffer.height;
  const sw = bw / v.zoom;
  const sh = bh / v.zoom;
  const sx = v.cx * bw - sw / 2;
  const sy = v.cy * bh - sh / 2;
  ctx.drawImage(buffer, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
}

const Toggle: React.FC<{ label: string; on: boolean; onClick: () => void; color?: string }> = ({ label, on, onClick, color }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={`dungeon-toggle-${label.toLowerCase().replace(/\s+/g, '-')}`}
    className={`h-7 rounded px-2 text-xs font-semibold transition-colors ${on ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
  >
    {color && <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />}
    {label}
  </button>
);

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }> = ({ label, value, min, max, step, onChange, fmt }) => (
  <label className="flex items-center gap-2 text-xs text-gray-300">
    <span className="w-24 flex-shrink-0">{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-32" />
    <span className="w-10 text-right tabular-nums text-gray-400">{fmt ? fmt(value) : value}</span>
  </label>
);

/** Initial seed: `?dseed=<n>` pins a reproducible render; otherwise random. */
function initialSeed(): number {
  const raw = new URLSearchParams(window.location.search).get('dseed');
  if (raw !== null) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return n;
  }
  return (Math.random() * 1e9) | 0;
}

const THEME_OPTIONS: DungeonTheme[] = ['crypt', 'cavern', 'frost', 'sewer', 'fungal'];

/** Optional `?dtheme=` pin makes cross-theme visual proof reproducible, just like dseed. */
function initialTheme(): DungeonTheme {
  const raw = new URLSearchParams(window.location.search).get('dtheme');
  return THEME_OPTIONS.includes(raw as DungeonTheme) ? raw as DungeonTheme : 'crypt';
}

export const PreviewDungeon: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The supersampled sheet buffer: composed once per plan/overlay change, then
  // sampled by the viewport blit on every zoom/pan without re-drawing the sheet.
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  // Live pan-drag bookkeeping (a ref, not state, so a drag frame never re-renders
  // React — only the imperative blit runs). `px/py` = pointer at grab; `cx/cy` =
  // the view centre at grab; `next` = the latest dragged view, committed on release.
  const dragRef = useRef<{ px: number; py: number; cx: number; cy: number; next?: View } | null>(null);
  const [view, setView] = useState<View>(FIT_VIEW);
  // Cursor feedback only (grab ↔ grabbing). Flips twice per drag, never per move.
  const [dragging, setDragging] = useState(false);
  const [seed, setSeed] = useState<number>(initialSeed);
  const [theme, setTheme] = useState<DungeonTheme>(initialTheme);
  const [roomCount, setRoomCount] = useState(42);
  const [loopChance, setLoopChance] = useState(0.25);
  const [decorDensity, setDecorDensity] = useState(0.6);
  // null = use the archetype's seeded default; a number pins the layout dial.
  const [sprawl, setSprawl] = useState<number | null>(null);
  const [asOfYearsAgo, setAsOfYearsAgo] = useState(0);
  const [overlays, setOverlays] = useState<Overlays>(DEFAULT_OVERLAYS);
  const [showHistory, setShowHistory] = useState(false);
  const [viewMode, setViewMode] = useState<DungeonViewMode>('three-d');
  // Desktop opens the full workbench, while phones begin with one compact tuning button so
  // the generated dungeon—not a wall of sliders—is the first meaningful viewport content.
  const [showTuning, setShowTuning] = useState(() => window.matchMedia('(min-width: 640px)').matches);

  // Generation can honestly fail after its bounded retries. Derive the plan and
  // error together so rendering stays pure; setting state inside useMemo caused
  // a React feedback risk in the earlier local-only workbench implementation.
  const { plan, error } = useMemo<{ plan: ReturnType<typeof generateDungeon> | null; error: string | null }>(() => {
    try {
      return {
        plan: generateDungeon({
          seed,
          params: {
            roomCount, loopChance, decorDensity, theme, asOfYearsAgo,
            ...(sprawl !== null ? { sprawl } : {}),
          },
        }),
        error: null,
      };
    } catch (e) {
      return { plan: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [seed, theme, roomCount, loopChance, decorDensity, asOfYearsAgo, sprawl]);

  // Compose the sheet buffer ONCE whenever the plan or overlays change, reset the
  // viewport to Fit (a fresh plan is a fresh sheet — the eye should start whole),
  // and blit. Heavy work stays here, off the zoom/pan hot path.
  useEffect(() => {
    // The canvas is absent while 3D is active, so a plan-only effect cannot paint
    // the fresh canvas created when the user returns to the parchment view.
    if (viewMode !== 'parchment') return;
    if (!plan) { bufferRef.current = null; return; }
    bufferRef.current = renderSheet(plan, overlays);
    setView(FIT_VIEW);
    if (canvasRef.current) blitViewport(canvasRef.current, bufferRef.current, FIT_VIEW);
  }, [plan, overlays, viewMode]);

  // Re-blit whenever the viewport moves (wheel zoom, +/−, Fit, or the end of a
  // pan). Cheap: one drawImage of the already-composed buffer.
  useEffect(() => {
    if (canvasRef.current && bufferRef.current) blitViewport(canvasRef.current, bufferRef.current, view);
  }, [view]);

  // Scroll-wheel zoom TOWARD the cursor: the sheet point under the pointer stays
  // pinned while the zoom changes (zoom-to-point), so inspecting a gallery means
  // pointing at it and scrolling. Smooth multiplicative steps; range clamped.
  //
  // Attached as a NON-PASSIVE native listener, NOT React's `onWheel`. React marks
  // wheel handlers passive, so `preventDefault()` is a silent no-op there — and
  // because the canvas lives inside an `overflow-auto` pane, the scroll would then
  // pan the PANE instead of (or on top of) zooming the map, which reads as "the
  // zoom doesn't work." A native `{ passive: false }` listener lets us cancel the
  // scroll so the wheel only ever zooms. Re-binds when the canvas mounts (`error`
  // toggles the canvas subtree in/out).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      if (!bufferRef.current) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      // pointer in [0,1] of the DISPLAYED sheet.
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      setView((prev) => {
        const cur = clampView(prev);
        const factor = Math.exp(-e.deltaY * 0.0015); // wheel-up = zoom in
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cur.zoom * factor));
        // sheet-space point currently under the cursor (before the zoom change).
        const half = 0.5 / cur.zoom;
        const sheetX = cur.cx + (px - 0.5) * 2 * half;
        const sheetY = cur.cy + (py - 0.5) * 2 * half;
        // choose a new centre so that same sheet point stays under the cursor.
        const nHalf = 0.5 / zoom;
        const cx = sheetX - (px - 0.5) * 2 * nHalf;
        const cy = sheetY - (py - 0.5) * 2 * nHalf;
        return clampView({ zoom, cx, cy });
      });
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [error]);

  // Click-drag pan (only meaningful when zoomed in). Uses pointer capture + a ref
  // for live tracking, blitting imperatively per move so the drag is smooth; the
  // final position is committed to state on release so the viewport effect + the
  // zoom readout stay in sync.
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!bufferRef.current || view.zoom <= MIN_ZOOM) return;
    const canvas = e.currentTarget;
    canvas.setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, cx: view.cx, cy: view.cy };
    setDragging(true);
  }, [view.zoom, view.cx, view.cy]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    const buffer = bufferRef.current;
    if (!drag || !canvas || !buffer) return;
    const rect = canvas.getBoundingClientRect();
    // a pixel dragged on screen moves the sheet-centre by that fraction of the
    // VISIBLE window (which is 1/zoom of the sheet), opposite the drag direction.
    const cur = clampView(view);
    const dxN = ((e.clientX - drag.px) / rect.width) / cur.zoom;
    const dyN = ((e.clientY - drag.py) / rect.height) / cur.zoom;
    const next = clampView({ zoom: cur.zoom, cx: drag.cx - dxN, cy: drag.cy - dyN });
    blitViewport(canvas, buffer, next); // imperative: smooth, no re-render mid-drag
    dragRef.current = { ...drag, next };
  }, [view]);

  const endDrag = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    if (drag && drag.next) setView(drag.next); // commit the final pan to state
  }, []);

  // Zoom buttons keep the sheet CENTRE fixed (a neutral in/out); Fit resets.
  const zoomBy = useCallback((factor: number) => {
    setView((prev) => clampView({ ...prev, zoom: prev.zoom * factor }));
  }, []);
  const fitView = useCallback(() => setView(FIT_VIEW), []);

  const reroll = useCallback(() => setSeed((Math.random() * 1e9) | 0), []);
  const toggle = useCallback((k: keyof Overlays) => setOverlays((o) => ({ ...o, [k]: !o[k] })), []);

  const keyed = useMemo(() => (plan ? keyedRooms(plan) : []), [plan]);

  // Publish the same concise state that is visible in the workbench. The browser
  // verification loop uses this to prove that the rendered 3D scene belongs to
  // the current seed and that control changes update the actual dungeon plan.
  useEffect(() => {
    const previewWindow = window as DungeonPreviewWindow;
    previewWindow.render_game_to_text = () => JSON.stringify({
      coordinateSystem: 'origin is dungeon center; +x east, +z south; one scene unit is one 5 ft cell',
      mode: viewMode,
      sceneReady: viewMode === 'three-d' ? previewWindow.__dungeon3dReady === true : Boolean(canvasRef.current),
      dungeon: plan ? {
        seed: plan.seed,
        name: plan.name,
        theme: plan.params.theme,
        archetype: plan.archetype,
        sizeCells: { width: plan.W, depth: plan.H },
        entranceRoomId: plan.entranceId,
        objectiveRoomId: plan.bossId,
        rooms: plan.stats.rooms,
        loops: plan.stats.loops,
        historyEvents: plan.stats.events,
        props: plan.stats.props,
        encounters: plan.stats.spawns,
      } : null,
      overlays,
      camera: previewWindow.__dungeon3dViewState ?? null,
    });

    // Outside the specialized test client, provide a small real-time stepping
    // hook so automated observers can wait for R3F damping and canvas paint.
    if (!previewWindow.advanceTime) {
      previewWindow.advanceTime = (milliseconds: number) => new Promise((resolve) => {
        const start = performance.now();
        const step = (now: number) => {
          if (now - start >= milliseconds) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }

    return () => {
      delete previewWindow.render_game_to_text;
    };
  }, [overlays, plan, viewMode]);


  return (
    <div className="flex h-full flex-col bg-gray-900 text-gray-200">
      {/* header controls */}
      <div className="max-h-[46vh] flex-shrink-0 space-y-2 overflow-y-auto border-b border-gray-700 bg-gray-800 px-3 py-2 shadow-md sm:max-h-none sm:overflow-visible sm:px-6 sm:py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold uppercase tracking-wider text-white">Dungeon</h2>
            <p className="text-xs text-gray-400">
              {plan ? <span className="italic text-amber-300">{plan.name}</span> : 'procedural dungeon generator'} &middot; each cell = 5&nbsp;ft &middot; deterministic by seed (pin with ?dseed=)
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex w-full rounded-lg border border-gray-600 bg-gray-900 p-1 sm:mr-2 sm:w-auto" aria-label="Dungeon presentation">
              <button
                type="button"
                onClick={() => setViewMode('three-d')}
                data-testid="dungeon-view-3d"
                className={`h-7 flex-1 rounded px-3 text-xs font-bold transition-colors sm:flex-none ${viewMode === 'three-d' ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
              >
                3D Expedition
              </button>
              <button
                type="button"
                onClick={() => setViewMode('parchment')}
                data-testid="dungeon-view-parchment"
                className={`h-7 flex-1 rounded px-3 text-xs font-bold transition-colors sm:flex-none ${viewMode === 'parchment' ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
              >
                Parchment
              </button>
            </div>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as DungeonTheme)}
              aria-label="Dungeon theme"
              className="h-9 rounded-md border border-gray-600 bg-gray-700 px-2 text-sm capitalize text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {THEME_OPTIONS.map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
              aria-label="Dungeon seed"
              className="h-9 min-w-0 flex-1 rounded-md border border-gray-600 bg-gray-700 px-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 sm:w-32 sm:flex-none"
            />
            <button type="button" onClick={reroll} data-testid="dungeon-reroll" className="h-9 rounded-md bg-sky-600 px-3 text-sm font-bold text-white hover:bg-sky-500 sm:px-4">
              Reroll 🎲
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowTuning((visible) => !visible)}
          className="flex h-8 w-full items-center justify-between rounded-md border border-gray-600 bg-gray-900 px-3 text-xs font-bold uppercase tracking-wide text-gray-300 sm:hidden"
          aria-expanded={showTuning}
        >
          Tuning &amp; overlays
          <span aria-hidden="true">{showTuning ? '−' : '+'}</span>
        </button>
        {showTuning && <>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Slider label="Rooms" value={roomCount} min={8} max={80} step={1} onChange={setRoomCount} />
          <Slider label="Loop chance" value={loopChance} min={0} max={0.6} step={0.01} onChange={setLoopChance} fmt={(v) => v.toFixed(2)} />
          <Slider label="Decor" value={decorDensity} min={0} max={1.5} step={0.05} onChange={setDecorDensity} fmt={(v) => v.toFixed(2)} />
          <label
            className="flex items-center gap-2 text-xs text-gray-300"
            title="Layout dial: 0 = tight room-through-room suites, 1 = sprawling rooms far apart with long corridors. Blank = the archetype's seeded default."
          >
            <span className="w-16 flex-shrink-0">Sprawl</span>
            <input
              type="range" min={0} max={1} step={0.05}
              value={sprawl ?? (plan ? plan.stats.sprawl : 0.3)}
              onChange={(e) => setSprawl(parseFloat(e.target.value))}
              className="w-32"
            />
            <span className="w-16 text-right tabular-nums text-gray-400">
              {sprawl !== null ? sprawl.toFixed(2) : plan ? `${plan.stats.sprawl.toFixed(2)}*` : '—'}
            </span>
            <button
              type="button"
              onClick={() => setSprawl(null)}
              disabled={sprawl === null}
              className="h-6 rounded px-1.5 text-[10px] font-semibold text-gray-400 enabled:hover:bg-gray-700 disabled:opacity-40"
            >
              default
            </button>
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-300" title="Replay cutoff: the dungeon as it was N years ago — only events at least this old have happened yet (older map = fewer scars)">
            <span className="flex-shrink-0">As of years ago</span>
            <input
              type="number"
              min={0}
              step={10}
              value={asOfYearsAgo}
              onChange={(e) => setAsOfYearsAgo(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="h-7 w-20 rounded-md border border-gray-600 bg-gray-700 px-2 text-xs text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {asOfYearsAgo > 0 && <span className="text-amber-400">outdated map</span>}
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs uppercase tracking-wide text-gray-500">Overlays</span>
          <Toggle label="Graph" on={overlays.graph} onClick={() => toggle('graph')} color="rgba(30,60,150,0.8)" />
          <Toggle label="Loops" on={overlays.loops} onClick={() => toggle('loops')} color="#0e93a3" />
          <Toggle label="Critical path" on={overlays.critical} onClick={() => toggle('critical')} color="#c22222" />
          <Toggle label="Difficulty heat" on={overlays.heatmap} onClick={() => toggle('heatmap')} />
          <span className="mx-1 text-gray-600">|</span>
          <Toggle label="Room types" on={overlays.rooms} onClick={() => toggle('rooms')} />
          <Toggle label="Props" on={overlays.props} onClick={() => toggle('props')} />
          <Toggle label="Spawns" on={overlays.spawns} onClick={() => toggle('spawns')} />
          <Toggle label="Secrets" on={overlays.secrets} onClick={() => toggle('secrets')} color="#7b2fa3" />
          <span className="mx-1 text-gray-600">|</span>
          <Toggle label="History" on={showHistory} onClick={() => setShowHistory((v) => !v)} color="#d8b33a" />
        </div>
        </>}
      </div>

      {/* canvas + keyed notes + history */}
      <div className="flex-grow overflow-auto bg-gray-950 p-2 sm:p-4">
        {error ? (
          <div className="mx-auto max-w-md rounded-md border border-red-700 bg-red-950/60 p-4 text-sm text-red-300">
            <strong className="block font-bold text-red-200">Generation failed (honest, no fallback)</strong>
            {error}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {viewMode === 'three-d' && plan ? (
              <Dungeon3DPreview plan={plan} overlays={overlays} />
            ) : (
              <div className="relative w-full max-w-[800px]">
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="touch-none select-none rounded border border-gray-800 shadow-2xl"
                style={{ cursor: view.zoom > MIN_ZOOM ? (dragging ? 'grabbing' : 'grab') : 'default' }}
              />
              {/* Zoom control cluster — unobtrusive, top-right, matches panel chrome. */}
              <div className="absolute right-2 top-2 flex select-none items-center gap-1 rounded-md border border-gray-700 bg-gray-800/85 px-1.5 py-1 shadow-lg backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => zoomBy(1 / 1.4)}
                  disabled={view.zoom <= MIN_ZOOM + 1e-3}
                  title="Zoom out"
                  className="flex h-6 w-6 items-center justify-center rounded text-base font-bold leading-none text-gray-200 enabled:hover:bg-gray-700 disabled:opacity-40"
                >
                  &minus;
                </button>
                <span className="w-11 text-center text-xs font-semibold tabular-nums text-gray-300">
                  {Math.round(view.zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => zoomBy(1.4)}
                  disabled={view.zoom >= MAX_ZOOM - 1e-3}
                  title="Zoom in"
                  className="flex h-6 w-6 items-center justify-center rounded text-base font-bold leading-none text-gray-200 enabled:hover:bg-gray-700 disabled:opacity-40"
                >
                  +
                </button>
                <span className="mx-0.5 h-4 w-px bg-gray-600" />
                <button
                  type="button"
                  onClick={fitView}
                  disabled={view.zoom <= MIN_ZOOM + 1e-3 && Math.abs(view.cx - 0.5) < 1e-3 && Math.abs(view.cy - 0.5) < 1e-3}
                  title="Reset to fit"
                  className="h-6 rounded px-2 text-xs font-semibold text-gray-200 enabled:hover:bg-gray-700 disabled:opacity-40"
                >
                  Fit
                </button>
              </div>
              </div>
            )}

            {plan && keyed.length > 0 && (
              <div className="w-full max-w-3xl rounded-md border border-gray-800 bg-gray-900/80 p-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Keyed notes</h3>
                <ol className="space-y-1.5 text-sm">
                  {keyed.map((r, i) => (
                    <li key={r.id} className="flex gap-2">
                      <span className="w-8 flex-shrink-0 text-right font-bold tabular-nums text-amber-300">
                        {r.type === 'boss' ? `★${i + 1}` : r.type === 'entrance' ? `▾${i + 1}` : i + 1}
                      </span>
                      <span className="text-gray-300">{r.note}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {plan && showHistory && (
              <div className="w-full max-w-3xl rounded-md border border-amber-900/50 bg-gray-900/80 p-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                  History — {plan.builderName}&apos;s {plan.archetype}
                  {plan.params.asOfYearsAgo ? ` · as of ${plan.params.asOfYearsAgo} years ago` : ''}
                </h3>
                {plan.history.length === 0 ? (
                  <p className="text-sm italic text-gray-500">No recorded events — the structure stands as built.</p>
                ) : (
                  <ol className="space-y-1.5 text-sm">
                    {plan.history.map((e) => (
                      <li key={e.id} className="flex gap-2">
                        <span className="w-32 flex-shrink-0 text-right tabular-nums text-gray-500">
                          {e.yearsAgo} years ago
                        </span>
                        <span className="text-gray-300">
                          {e.summary}
                          {e.failed && <span className="ml-1 italic text-gray-500">(failed)</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* footer stats + legend */}
      {plan && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-700 bg-gray-800 px-6 py-2 text-xs text-gray-400">
          <span>seed {plan.seed}</span>
          <span className="capitalize">{plan.params.theme}</span>
          <span className={plan.stats.rooms < plan.stats.roomsRequested ? 'text-amber-400' : ''}>
            {plan.stats.rooms}/{plan.stats.roomsRequested} rooms
          </span>
          <span>{plan.stats.edges} edges</span>
          <span>{plan.stats.loops} loops (cyclomatic {plan.stats.cyclomatic})</span>
          <span>crit path {plan.stats.criticalLength}</span>
          <span>{plan.stats.events} events</span>
          <span>{plan.doors.filter((d) => d.state === 'bricked').length} bricked</span>
          <span>{plan.secretDoorCells.length} secret</span>
          <span>{plan.traps.length} traps</span>
          <span>{plan.stats.props} props</span>
          <span>{plan.stats.spawns} spawns · {plan.stats.encounterXp} XP</span>
          <span className={plan.stats.genMs < 50 ? 'text-green-400' : 'text-amber-400'}>{plan.stats.genMs.toFixed(1)} ms</span>
          <span>{plan.stats.attempts > 1 ? `${plan.stats.attempts} attempts` : '1st try'}</span>
          <span className="ml-auto flex items-center gap-3">
            {(['entrance', 'combat', 'elite', 'treasure', 'shrine', 'boss'] as RoomType[]).map((t) => (
              <span key={t} className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[t] }} />
                {t}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
};
