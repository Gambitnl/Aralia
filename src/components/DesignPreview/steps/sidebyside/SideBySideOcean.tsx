/**
 * @file SideBySideOcean.tsx — the FFT sea, with NOTHING beside it.
 *
 * THERE IS NO SHIPPING OCEAN. The game has no open-water surface at all today,
 * so the left pane is empty and says so. That is the honest report.
 *
 * A sine-wave stand-in on the left would look like an ocean. It would move, it
 * would catch light, and it would pass a glance. It would also be wrong in
 * every way that matters, and putting it beside the real thing would invent a
 * comparison that does not exist. `oceanCapability.ts` states this rule for the
 * module; this page obeys the same rule for the picture.
 *
 * IT NEEDS WEBGPU. If WebGPU is missing, the right pane says why. It draws
 * nothing.
 *
 * THIS FILE IS A VIEWER. It builds `createOceanField`, mounts `createOceanSky`
 * as the background, and modifies nothing in `src/systems/world3d/ocean/`.
 *
 * IT IS ALSO THE ONLY GATE PAGE. The ocean used to carry a second, standalone
 * harness at `misc/ocean.html`, built when this steps directory was locked by
 * another agent. Two addresses for one surface is one address too many: the
 * harness drifted, and a look at one told you nothing about the other. The
 * harness is gone and everything it offered lives here — the four camera
 * presets, the five debug channels, the pinned simulation time, the saturating
 * GPU benchmark, the determinism hash and the GPU-versus-CPU cross-check.
 *
 * A capture script drives it all through `window.__OCEAN__`, exactly as before.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { createOceanField, type OceanField } from '@/systems/world3d/ocean/oceanField';
import { createOceanSky, createOceanSkyMesh } from '@/systems/world3d/ocean/oceanSky';
import { oceanSeaState } from '@/systems/world3d/ocean/oceanSeaStates';
import { rainSlopeVariance } from '@/systems/world3d/ocean/oceanRainMath';
import { OCEAN_FFT_N } from '@/systems/world3d/ocean/oceanConfig';
import { checkOceanCapability } from '@/systems/world3d/ocean/oceanCapability';
import { oceanFeetFromMeters } from '@/systems/world3d/ocean/oceanUnits';
import { buildCascadeSpectrum } from '@/systems/world3d/ocean/oceanSpectrum';
import { realizeCascade } from '@/systems/world3d/ocean/oceanFieldReference';
import { ComparePane, type PaneState } from './ComparePane';
import { mountOceanExtras, type OceanExtra } from './oceanExtras';
import { attachFreeLook, type FreeLook } from './oceanFreeLook';

/** The seed the whole gate runs on. Pinned so every capture is reproducible. */
const OCEAN_SEED = 0x0cea9;

/**
 * Camera presets. Each one answers a different question about the sea.
 *
 *   deck    — the shipping view: eye height of a deck, looking at the horizon.
 *   low     — WATER LEVEL, 1.6 m, where crests break the skyline. This is the
 *             hardest view and the one that drove the third cascade.
 *   high    — a masthead view, where tiling would be visible if it existed.
 *   overhead— a plan view, the harshest test of directional spreading.
 */
const CAMERA_PRESETS: Record<
  string,
  { pos: [number, number, number]; look: [number, number, number]; fov: number }
> = {
  deck: { pos: [0, 9, 0], look: [0, 2.5, -220], fov: 52 },
  low: { pos: [0, 1.6, 0], look: [0, 1.4, -90], fov: 55 },
  high: { pos: [0, 46, 60], look: [0, 0, -420], fov: 58 },
  overhead: { pos: [0, 340, 0], look: [0, 0, -1], fov: 46 },
};

/**
 * LIVE COMPARE (Remy, 2026-09-28, the Water and Land sheet, question 32: "let
 * me view both side by side in a 'live' view").
 *
 * WHY. Under the new test sun three narrow wins flipped although nothing in
 * them changed: the storm foam from high above, the wake from behind, and the
 * buoy. One blind judge per side order is a noisy test for a narrow view, so
 * Remy judges those views by eye, ours live beside the bar live.
 *
 * WHAT. Each entry is one judged view: the sea and the pieces it runs (`qs`,
 * read once at start, so a pick reloads the page), the camera pose the judges
 * saw (the capture rigs' own numbers), and the bar. The bar is the live Water
 * Pro demo where the judged reference came from the demo, and the reference
 * frames where it came from a video.
 *
 * WHAT DOES NOT CHANGE. The pane opens only with `&wp=1` or its button, and
 * only in the pane layout. `full=1`, which every capture uses, returns before
 * any of this, so no judged frame changes.
 *
 * UNCERTAIN. The Water Pro demo cannot be posed from here (it exposes no
 * camera API), so its pane says what to click, and Remy sets its camera.
 */
interface JudgedView {
  id: string;
  label: string;
  /** Why the view is in the list. */
  why: string;
  /** The URL parameters the view runs with. */
  qs: string;
  /** The judged camera pose; none when the view follows the ship. */
  pose?: { pos: [number, number, number]; look: [number, number, number]; fov: number };
  bar:
    | { kind: 'live'; how: string }
    | { kind: 'clip'; dir: string; how: string }
    // A real clip, played in a loop (the beach's draining bar, 2026-09-29).
    | { kind: 'video'; src: string; how: string };
}

const WATER_PRO_URL = 'https://www.threejswaterpro.com/';

/**
 * The reference frames live in the gauntlet's scratch folder, which exists on
 * the lead's machine only (it is gitignored). The clip player says so when
 * the index cannot be read, rather than show an empty frame.
 */
const GAUNTLET_REF = `${import.meta.env.BASE_URL}.agent/scratch/ocean-gauntlet/ref`;

const JUDGED_VIEWS: JudgedView[] = [
  {
    id: 'storm-foam-high',
    label: 'Storm foam from high above (flipped)',
    why: 'Won narrowly before the sun change, then lost both orders with the foam unchanged.',
    qs: 'sea=storm&extras=foam',
    pose: { pos: [-44.8, 138, 3.8], look: [0, 0, 0], fov: 50 },
    bar: { kind: 'live', how: 'In Water Pro, pick the Storm preset. Its own camera looks down from above, as the judges saw it.' },
  },
  {
    id: 'wake-behind',
    label: 'The wake from behind (flipped)',
    why: 'Split one to one under the new sun, with the wake unchanged.',
    qs: 'sea=waterpro&extras=wake&follow=1',
    bar: { kind: 'live', how: 'In Water Pro, press Boat, then click the sea and hold W to sail. Its camera follows from behind.' },
  },
  {
    id: 'buoy',
    label: 'The buoy (flipped)',
    why: 'Split one to one under the new sun, with the same motion as the strip that won.',
    qs: 'sea=choppy&extras=buoys',
    pose: { pos: [0, 7, 0], look: [0, -4.6, -100], fov: 50 },
    bar: {
      kind: 'clip',
      dir: `${GAUNTLET_REF}/video-buoy-choppy`,
      how: 'The judged reference is a Water Pro video, not the demo: its frames play here, 0.3 s apart. The demo has buoys too, but only small ones far off.',
    },
  },
  // THE BEACH (2026-09-29). The draining view has lost 22 versions (rounds 3
  // to 11, counted from keys.json) against the real Manly clip, while the judges'
  // stated reasons fail the lead's measures, so Remy looks himself. The poses
  // are the beach rig's judged ones (beach-seq and beach-top) as world poses.
  // The beach runs live here, so its swash is at any moment of its cycle,
  // where a judged frame pins one sea time (42 s and 138 s).
  {
    id: 'beach-drain',
    label: 'The beach draining, from straight above (losing)',
    why: '22 versions lost this view against real drone footage, and every recorded judge was sure; the judges keep calling our swash sheet an opaque slab.',
    qs: 'sea=shallow&extras=beach',
    pose: { pos: [-26.886, 137, -120.453], look: [-26.907, 117, -120.425], fov: 8.35 },
    bar: {
      kind: 'video',
      src: `${GAUNTLET_REF}/real/beach-manly-overhead.webm`,
      how: 'The bar is real drone footage of Manly Beach (MGA Photography, CC BY 3.0), played in a loop. Compare the thin water sheet that drains back, and the wet sand it leaves.',
    },
  },
  {
    id: 'beach-shore',
    label: 'The shore foam (round 8 wins it)',
    why: 'Round 8 won this view against Water Pro in both orders, and again with a fresh judge.',
    qs: 'sea=shallow&extras=beach',
    pose: { pos: [-48.583, 19, -131.552], look: [-43.128, 0.206, -127.425], fov: 50 },
    bar: {
      kind: 'clip',
      dir: `${GAUNTLET_REF}/live/wp-beach`,
      how: 'The bar is one still from the Water Pro v3 video, its Dynamic foam shot (the demo cannot be posed on a beach from here).',
    },
  },
  {
    id: 'open-sea',
    label: 'The open sea, waves (holds)',
    why: 'Held both orders under the new sun; a control to calibrate your eye.',
    qs: 'sea=waterpro',
    pose: { pos: [0, 12, 0], look: [0, -15.4, -200], fov: 52 },
    bar: { kind: 'live', how: 'Water Pro opens on its own open sea; drag it to look out toward the horizon.' },
  },
];

/**
 * Plays the reference frames of a video bar, at their own spacing. It reads
 * `<dir>/index.json` ({ frames, stepS }), which the lead writes next to the
 * frames. No index, no picture: the pane says why.
 */
const ClipPlayer: React.FC<{ dir: string }> = ({ dir }) => {
  const [index, setIndex] = useState<{ frames: string[]; stepS: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    let live = true;
    fetch(`${dir}/index.json`)
      .then((r) => {
        const type = r.headers.get('content-type') ?? '';
        // The dev server answers a missing file with the page itself (HTML),
        // so a 200 alone does not prove the index is there.
        if (!r.ok || !type.includes('json')) throw new Error(`no frame index at ${dir}/index.json`);
        return r.json();
      })
      .then((j) => { if (live) setIndex(j); })
      .catch((e: unknown) => { if (live) setError(String(e instanceof Error ? e.message : e)); });
    return () => { live = false; };
  }, [dir]);
  useEffect(() => {
    if (!index || !playing || index.frames.length < 2) return;
    const id = window.setInterval(() => setFrame((f) => (f + 1) % index.frames.length), index.stepS * 1000);
    return () => window.clearInterval(id);
  }, [index, playing]);
  if (error) {
    return (
      <p className="absolute inset-0 m-0 whitespace-pre-wrap p-6 text-xs text-rose-300">
        {'The reference frames are not on this machine, so there is nothing to play.\n\n' + error
          + '\n\nThey live in the ocean gauntlet\'s scratch folder, which git ignores.'}
      </p>
    );
  }
  if (!index) return <p className="absolute inset-0 m-0 p-6 text-xs text-sky-400">Reading the reference frames...</p>;
  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <img
        src={`${dir}/${index.frames[frame]}`}
        alt={`Water Pro reference, frame ${frame + 1} of ${index.frames.length}`}
        className="min-h-0 w-full flex-1 object-contain"
      />
      <div className="flex flex-shrink-0 items-center gap-2 border-t border-gray-800 px-2 py-1 text-[11px] text-gray-400">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="h-6 rounded border border-gray-700 px-2 text-gray-200 hover:bg-gray-800"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          min={0}
          max={index.frames.length - 1}
          value={frame}
          onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }}
          className="min-w-0 flex-1"
          aria-label="Reference frame"
        />
        <span className="font-mono">{frame + 1}/{index.frames.length}</span>
      </div>
    </div>
  );
};

/** The bar's pane: the live Water Pro demo, or the reference frames of a video bar. */
const WaterProPane: React.FC<{ view: JudgedView | null }> = ({ view }) => {
  const bar = view?.bar ?? { kind: 'live' as const, how: 'Pick a judged view above to open ours at the pose the judges saw.' };
  return (
    <ComparePane
      side="bar"
      title={bar.kind === 'live' ? 'Three.js Water Pro, live (the bar)' : bar.kind === 'video' ? 'Real footage (the bar)' : 'Three.js Water Pro video (the bar)'}
      caption={bar.how}
      state="ready"
      facts={[
        ['source', bar.kind === 'live' ? 'threejswaterpro.com' : bar.kind === 'video' ? 'video file' : 'video frames'],
        ['view', view ? view.label : 'none picked'],
      ]}
    >
      {bar.kind === 'live' ? (
        <iframe
          src={WATER_PRO_URL}
          title="Three.js Water Pro demo, live"
          allow="webgpu; fullscreen; autoplay"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : bar.kind === 'video' ? (
        <video
          src={bar.src}
          autoPlay
          loop
          muted
          playsInline
          controls
          className="absolute inset-0 h-full w-full bg-black object-contain"
        />
      ) : (
        <ClipPlayer dir={bar.dir} />
      )}
    </ComparePane>
  );
};

/**
 * Debug channels. Each isolates one term of the shading.
 *
 * These exist because the first look at the sea showed a white sheet in the
 * foreground and no way to tell whether it was foam, glitter or scattering.
 * Guessing at that costs more than a uniform.
 */
const DEBUG_CHANNELS = ['water', 'jacobian', 'foam', 'normal', 'height', 'specular'];

interface OceanReadout {
  significantWaveHeightFt: number;
  dispatchesPerFrame: number;
  cascades: number;
  /** One line per cascade: patch in feet, wind, heading. From the old HUD. */
  cascadeLines: string[];
  triangles: number;
  fps: number;
  gpuComputeMs: number | null;
  gpuDrawMs: number | null;
}

/** The capture surface. A headed-Chrome rig drives the gate through this. */
export interface OceanProbe {
  ready: boolean;
  error: string | null;
  frames: number;
  fps: number;
  msPerFrame: number;
  /**
   * CPU time per frame, ms: the main thread's own work inside one frame (the
   * sea's step, the pieces' updates and the render call that records and
   * submits the GPU work), rolling mean over 90 frames. The GPU numbers below
   * say nothing about this half, and a frame waits on whichever half is
   * slower. Added for the performance pass (2026-09-25).
   */
  cpuMsPerFrame: number;
  /** The same CPU time split into its three parts, ms (rolling means). */
  cpuSplitMs: { step: number; extras: number; render: number };
  gpuMsPerFrame: number | null;
  gpuDrawMsPerFrame: number | null;
  dispatchesPerFrame: number;
  cascadeCount: number;
  significantWaveHeightFt: number;
  triangles: number;
  n: number;
  time: number;
  timestampSupported: boolean;
  setTime(t: number | null): void;
  setCamera(preset: string): void;
  /**
   * Put the camera exactly where a reference frame had it, in meters.
   *
   * The four presets answer questions about this sea. A side-by-side against
   * another renderer needs the OTHER renderer's framing instead: the same
   * height above the water, the same horizon line, the same field of view.
   * A preset that is merely close would make the critic judge framing.
   */
  setPose(pos: [number, number, number], look: [number, number, number], fov: number): void;
  /** Read the camera's pose: position and unit view direction, meters. Read only. */
  cameraPose(): { pos: [number, number, number]; dir: [number, number, number]; fov: number };
  setDebug(mode: number): void;
  /** Turn one part of the frame off or on, for timing: 'sky', 'surface' or 'extras'. */
  ablate(part: string, on: boolean): void;
  /**
   * Set one of the surface's tuning uniforms (`OceanSurface.tune`) by name.
   * For lighting sweeps: a rig compares values in one page load. An unknown
   * name throws, so a typo cannot silently measure the default.
   */
  setTune(name: string, value: number): void;
  /** Every tuning uniform and its current value. */
  getTune(): Record<string, number>;
  /**
   * Set one of the sky's cloud tuning uniforms (`OceanSky.cloudTune`) and
   * bake the clouds again. An unknown name throws.
   */
  setSkyTune(values: Record<string, number>): Promise<void>;
  /** `OceanSurface.setContact`, for a rig that checks the contact foam (GG-274). */
  setContact(i: number, xM: number, zM: number, rM: number, s: number): void;
  bench(iters?: number): Promise<{
    computeMs: number; drawMs: number; totalMs: number; iters: number;
  }>;
  hashField(t: number): Promise<{
    hash: string; meanHeightM: number; peakHeightM: number;
  }>;
  crossCheck(t: number): Promise<Array<Record<string, number>>>;
  /** Each mounted plug-in piece's own probe, by piece name. See oceanExtras.ts. */
  extras: Record<string, Record<string, unknown>>;
}

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var __OCEAN__: OceanProbe | undefined;
}

/** Read a URL parameter once, without pulling in a router. */
function urlParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

export const SideBySideOcean: React.FC = () => {
  const [state, setState] = useState<PaneState>('working');
  const [reason, setReason] = useState<string | null>(null);
  const [preset, setPreset] = useState<string>(() => {
    const c = urlParam('cam');
    return c && c in CAMERA_PRESETS ? c : 'deck';
  });
  const [debug, setDebug] = useState<number>(() => Number(urlParam('dbg') ?? 0) || 0);
  const [readout, setReadout] = useState<OceanReadout | null>(null);
  // PIN THE CAMERA (2026-09-28). `&follow=1` starts pinned. The button shows
  // only when a mounted piece has something to follow (`followTarget`).
  const [follow, setFollow] = useState<boolean>(() => urlParam('follow') === '1');
  const [canFollow, setCanFollow] = useState(false);
  const followRef = useRef(follow);
  followRef.current = follow;
  // LIVE COMPARE (Remy, sheet q32). `&wp=1` opens the Water Pro pane, and
  // `&view=` names a judged view, whose pose goes on once the sea is ready.
  const [compare, setCompare] = useState<boolean>(() => urlParam('wp') === '1');
  const [viewId] = useState<string | null>(() => urlParam('view'));
  const judgedView = JUDGED_VIEWS.find((v) => v.id === viewId) ?? null;
  // True while a judged view's own pose is on, so no preset button claims it.
  const [judgedPoseOn, setJudgedPoseOn] = useState(false);
  useEffect(() => {
    if (state !== 'ready' || !judgedView?.pose) return;
    const p = judgedView.pose;
    globalThis.__OCEAN__?.setPose(p.pos, p.look, p.fov);
    setJudgedPoseOn(true);
  }, [state, judgedView]);
  const toggleCompare = () => {
    const next = !compare;
    const u = new URL(window.location.href);
    if (next) u.searchParams.set('wp', '1');
    else u.searchParams.delete('wp');
    window.history.replaceState(null, '', u.toString());
    setCompare(next);
  };
  // A judged view runs its own sea and pieces, which the page reads at start,
  // so opening one reloads the page with that view's parameters.
  const openView = (id: string) => {
    const v = JUDGED_VIEWS.find((j) => j.id === id);
    if (!v) return;
    const u = new URL(window.location.href);
    for (const k of ['sea', 'extras', 'follow', 'cam', 'view', 't']) u.searchParams.delete(k);
    for (const [k, val] of new URLSearchParams(v.qs)) u.searchParams.set(k, val);
    u.searchParams.set('wp', '1');
    u.searchParams.set('view', v.id);
    window.location.assign(u.toString());
  };

  const mountRef = useRef<HTMLDivElement | null>(null);
  const applyPresetRef = useRef<((name: string) => void) | null>(null);
  const applyDebugRef = useRef<((mode: number) => void) | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let raf = 0;
    let renderer: THREE.WebGPURenderer | null = null;
    let ocean: OceanField | null = null;
    let cleanupExtra: (() => void) | null = null;

    // `?t=` pins the simulation clock. A pinned clock makes a capture
    // reproducible; null lets the sea run.
    const tParam = urlParam('t');
    let pinnedTime: number | null = tParam === null ? null : Number(tParam);
    // True while `bench` runs: the live loop then submits nothing. With vsync
    // off the loop runs free, and its own frames queued on the GPU beside the
    // bench's made the bench time the page against itself (perf pass,
    // iteration 1: even the draw-only part doubled once the CPU stopped
    // holding the loop back).
    let loopPaused = false;

    // The probe is published IMMEDIATELY, before anything can fail, so a
    // capture script always has something to wait on. A rig that times out
    // because the object never appeared cannot tell you WHY the ocean failed.
    const probe: OceanProbe = {
      ready: false,
      error: null,
      frames: 0,
      fps: 0,
      msPerFrame: 0,
      cpuMsPerFrame: 0,
      cpuSplitMs: { step: 0, extras: 0, render: 0 },
      gpuMsPerFrame: null,
      gpuDrawMsPerFrame: null,
      dispatchesPerFrame: 0,
      cascadeCount: 0,
      significantWaveHeightFt: 0,
      triangles: 0,
      n: OCEAN_FFT_N,
      time: 0,
      timestampSupported: false,
      setTime() {},
      setCamera() {},
      setPose() {},
      cameraPose() { throw new Error('[ocean] not ready'); },
      setDebug() {},
      ablate() { throw new Error('[ocean] not ready'); },
      setTune() { throw new Error('[ocean] not ready'); },
      getTune() { return {}; },
      async setSkyTune() { throw new Error('[ocean] not ready'); },
      setContact() { throw new Error('[ocean] not ready'); },
      async bench() { throw new Error('[ocean] not ready'); },
      async hashField() { throw new Error('[ocean] not ready'); },
      async crossCheck() { throw new Error('[ocean] not ready'); },
      extras: {},
    };
    globalThis.__OCEAN__ = probe;

    const fail = (message: string) => {
      probe.error = message;
      if (disposed) return;
      setReason(message);
      setState('unavailable');
    };

    const start = async () => {
      const capability = await checkOceanCapability();
      if (!capability.ok) {
        fail(
          'WebGPU is not available in this browser.\n\n'
          + (capability.reason ?? 'No reason reported.')
          + '\n\nThe open-ocean surface is a WebGPU compute pipeline. Aralia does not '
          + 'substitute a sine-wave stand-in: a fake ocean that looks plausible hides '
          + 'the failure and gives wrong ship motion.',
        );
        return;
      }
      if (disposed) return;

      // `trackTimestamp` turns on the WebGPU timestamp-query path, which is
      // the only honest way to measure this: the frame is vsync-capped at
      // 16.67 ms, so wall-clock timing reports the display refresh rate and
      // nothing about the ocean.
      // The timestamp queries stay on (performance pass, iteration 7): off,
      // they saved 1.5-3% of frame time, under the pass's 5% bar, and three
      // piece probes (seabed, foam, wake) read them.
      renderer = new THREE.WebGPURenderer({ antialias: true, trackTimestamp: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      // Water is high dynamic range: a sun glint is genuinely hundreds of times
      // brighter than the water beside it. Without a tone map those values clip
      // to flat white patches that read as chrome, not as glitter.
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      mount.appendChild(renderer.domElement);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';

      try {
        await renderer.init();
      } catch (e) {
        fail(`The WebGPU renderer failed to initialize.\n\n${String(e)}`);
        return;
      }
      if (disposed) return;

      // Report whether the timestamp path actually engaged. `trackTimestamp`
      // is silently disabled when the adapter lacks the feature, and a silent
      // n/a is indistinguishable from a bug.
      // `hasFeature` is typed as void in three 0.172 but returns a boolean.
      probe.timestampSupported = (renderer as unknown as {
        hasFeature(n: string): boolean;
      }).hasFeature('timestamp-query') === true;

      const scene = new THREE.Scene();
      // THE SKY IS THE OCEAN MODULE'S. The water reflects `oceanSkyRadiance`
      // along each reflected ray, and the background draws the same function,
      // so what the sea returns is what is above it. This used to be one flat
      // color plus a scene fog, and the water reflected a different gradient:
      // the two never agreed, and the sea read as a painted sheet. The fog is
      // gone with it — the water shader hazes itself into the sky's horizon
      // color, and a second haze in a second color drew a hard bright line.
      // THE WEATHER FOLLOWS THE SEA. The storm sea state is judged against
      // dark storm references, and a storm sea under a sunny sky reflected
      // turquoise and glitter under a grey deck. `?sea=storm` closes the deck
      // over both sky and water; every other sea is fair weather, and with
      // overcast at 0 the open-sea look is the one the shading rounds judge.
      const seaName = urlParam('sea');
      const storm = seaName === 'storm';
      // `?sun=<elevation>,<azimuth>` in degrees, azimuth positive to the LEFT
      // of the view axis, puts the sun somewhere else for one capture. It is
      // a probe for the lighting sweep: the shipped sun is OCEAN_SUN_DIR in
      // oceanSky.ts, and a capture rig that wants to compare suns measures
      // each one here rather than editing the module between shots. A bad
      // value throws; a sun that silently fell back to the default would put
      // the wrong label on a measurement.
      const sunParam = urlParam('sun');
      let sunDir: THREE.Vector3 | undefined;
      if (sunParam !== null) {
        const [elDeg, azDeg] = sunParam.split(',').map(Number);
        if (!Number.isFinite(elDeg) || !Number.isFinite(azDeg)) {
          throw new Error(`[ocean] ?sun=${sunParam} is not <elevation>,<azimuth> in degrees.`);
        }
        const el = (elDeg * Math.PI) / 180;
        const az = (azDeg * Math.PI) / 180;
        sunDir = new THREE.Vector3(
          -Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el),
        );
      }
      // A/B SWITCHES for the performance pass (perf/perfAB.mjs): `?ab=a,b`
      // names code paths to restore for one page, so the rig times an old
      // path and a new one in the same minutes on a shared GPU. Read before
      // the sky and the field are built, because a module reads its switch at build time.
      // A switch lives only while its measurement runs; the page with no
      // `ab` parameter always runs the current code.
      (globalThis as { __OCEAN_AB__?: Set<string> }).__OCEAN_AB__ = new Set(
        (urlParam('ab') ?? '').split(',').filter((s) => s.length > 0),
      );

      const sky = createOceanSky({ overcast: storm ? 1 : 0, sunDir });
      // THE SKY DRAWS LAST, WHERE IT SHOWS (performance pass, iteration 6):
      // a depth-tested sphere after the opaque objects, not the background
      // three draws first under everything (see createOceanSkyMesh). Measured
      // A/B: every pinned frame bit-identical, the isolated GPU draw 1-12%
      // lower in every scene (0.88 -> 0.78 ms under the water); the overall
      // frame time moved less than its noise.
      const skyMesh = createOceanSkyMesh(sky.backgroundNode);
      scene.add(skyMesh);
      // The cumulus are marched once into a texture, before the first frame.
      // A failed bake fails the page: a sky that silently lost its clouds
      // would put a different sky under a capture's label.
      try {
        await sky.bake(renderer);
      } catch (e) {
        fail(`The sky's cloud bake failed.

${String(e)}`);
        return;
      }
      if (disposed) return;

      const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.5, 30000);
      // FREE LOOK (2026-09-25, Remy: "i can't look around?"). Drag to look,
      // W A S D to fly, E and Q up and down, Shift faster, the wheel forward
      // and back. It moves the camera only on input, so a pose a script or a
      // preset sets stays exactly as set, and pinned captures do not change.
      // Every pose setter below re-syncs it, so a drag starts from that pose.
      let freeLook: FreeLook | null = null;
      const applyPreset = (name: string) => {
        const p = CAMERA_PRESETS[name] ?? CAMERA_PRESETS.deck;
        camera.position.set(...p.pos);
        camera.lookAt(new THREE.Vector3(...p.look));
        camera.fov = p.fov;
        camera.updateProjectionMatrix();
        freeLook?.syncFromCamera();
      };
      applyPresetRef.current = applyPreset;
      applyPreset(preset);
      freeLook = attachFreeLook(camera, renderer.domElement);

      try {
        // The same sun the sky shows, so the glitter sits under it. `?sea=`
        // names a sea state from oceanSeaStates.ts; an unknown name throws
        // and is reported below, never silently replaced by the default.
        ocean = await createOceanField({
          seed: OCEAN_SEED,
          n: OCEAN_FFT_N,
          sunDir: sky.sunDir,
          cascades: oceanSeaState(seaName),
          // The sky's own node, so one value drives the deck and the water.
          overcast: sky.uOvercast,
          // 25 mm/h is the rain piece's shipped rate; `oceanRainMath.ts` owns
          // the number and the measurement behind it.
          rainSlopeVariance: uniform(storm ? rainSlopeVariance(25) : 0),
          // The blurred copy of the baked clouds, for the reflection.
          skyClouds: sky.cloudReflTexture,
        });
      } catch (e) {
        fail(`The wave field could not be built.\n\n${String(e)}`);
        return;
      }
      if (disposed || !ocean) return;
      const field = ocean;
      scene.add(field.surface.mesh);
      field.surface.setDebug(debug);
      applyDebugRef.current = (m: number) => field.surface.setDebug(m);

      /* --- the plug-in pieces --------------------------------------- */

      // Buoyancy, spray, the sea floor: each is one file under ./oceanExtras/
      // and never edits this viewer. `oceanExtras.ts` states the contract. A
      // piece that fails to mount fails the page, so a capture never shows a
      // sea that quietly lacks the piece under test.
      let extras: Map<string, OceanExtra>;
      try {
        extras = await mountOceanExtras(
          { renderer, scene, camera, field, sky, seed: OCEAN_SEED },
          urlParam('extras'),
        );
      } catch (e) {
        fail(String(e));
        return;
      }
      if (disposed) {
        for (const x of extras.values()) x.dispose();
        return;
      }
      for (const [name, x] of extras) {
        if (x.probe) probe.extras[name] = x.probe;
      }

      /* PIN THE CAMERA TO THE SHIP (Remy, 2026-09-28: "add a button that i
       * can 'pin the camera' to the ship. so that my camera keeps following
       * the ship and keeps the ship centered"). While the button is on, each
       * frame keeps the camera at its distance from the piece's follow target,
       * turns the view by the target's change of heading, and looks at the
       * target. Free look runs first, so a drag orbits the camera around the
       * ship, the wheel and W / S move nearer or farther, and A D E Q swing it
       * round. Off (the default, and always in a capture, where the button is
       * hidden), this does nothing, so no judged frame changes. */
      const followExtra = [...extras.values()].find((x) => typeof x.followTarget === 'function') ?? null;
      setCanFollow(followExtra !== null);
      let followState: { headingRad: number; last: THREE.Vector3 } | null = null;
      const followFwd = new THREE.Vector3();
      const followTgt = new THREE.Vector3();
      const Y_AXIS = new THREE.Vector3(0, 1, 0);
      /**
       * The lowest a pinned camera sits: 1 m over the tallest crests of this
       * sea (1.2 x the significant wave height), and never under 1.5 m.
       * (Remy, 2026-09-28: with a fixed 1.5 m floor, a level view on the
       * Water Pro sea, 2.4 m waves, put the camera INSIDE the swell; from
       * below, the surface is not drawn (it draws its front side only, which
       * the underwater piece relies on), so the frame went white with blue
       * "tears" where the backs of nearer crests showed. This sea's floor is
       * 3.9 m.)
       */
      const FOLLOW_MIN_Y_M = Math.max(1.5, 1.2 * field.significantWaveHeightM + 1.0);
      const followStep = () => {
        if (!followRef.current || !followExtra?.followTarget) {
          followState = null;
          return;
        }
        const t = followExtra.followTarget();
        if (!t) return;
        followTgt.set(t.xM, t.yM, t.zM);
        if (!followState) {
          // A camera far from the ship, or on top of it, starts from a chase
          // view 45 m behind and 18 m up; a near one keeps its own view. (The
          // first build kept any camera within 150 m, and from the default
          // view the ship was a speck at about 100 m.)
          const d0 = camera.position.distanceTo(followTgt);
          if (d0 > 60 || d0 < 4) {
            const hx = Math.cos(t.headingRad);
            const hz = Math.sin(t.headingRad);
            camera.position.set(t.xM - 45 * hx, 18, t.zM - 45 * hz);
            camera.lookAt(followTgt);
          }
          followState = { headingRad: t.headingRad, last: followTgt.clone() };
        }
        // The distance to where the ship WAS: the wheel and the fly keys
        // changed it this frame, and the ship has moved since.
        const dist = Math.max(4, camera.position.distanceTo(followState.last));
        camera.getWorldDirection(followFwd);
        let dh = t.headingRad - followState.headingRad;
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        // The heading runs from +X toward +Z, and a positive turn about
        // three's +Y runs the other way, so the view turns by -dh.
        followFwd.applyAxisAngle(Y_AXIS, -dh);
        camera.position.copy(followTgt).addScaledVector(followFwd, -dist);
        if (camera.position.y < FOLLOW_MIN_Y_M) camera.position.y = FOLLOW_MIN_Y_M;
        camera.lookAt(followTgt);
        followState.headingRad = t.headingRad;
        followState.last.copy(followTgt);
        // The next drag starts from this view, not from the one before it.
        freeLook?.syncFromCamera();
      };

      const triangles = field.surface.mesh.geometry.index
        ? field.surface.mesh.geometry.index.count / 3
        : 0;

      // Feet are canon in Worldforge, so the patch size crosses the boundary
      // in feet. The wind stays metric because it names an oceanographic
      // constant, and `oceanUnits.ts` owns the only conversion.
      const cascadeLines = field.cascades.map((c) => (
        `${c.name.padEnd(9)} patch ${oceanFeetFromMeters(c.patchM).toFixed(0).padStart(5)} ft`
        + `  band ${c.cutoffLowM}-${c.cutoffHighM} m`
        + `  wind ${c.windSpeedMs.toFixed(1)} m/s`
        + `  hdg ${((c.windDirRad * 180) / Math.PI).toFixed(0)} deg`
      ));

      /* --- the capture surface ------------------------------------- */

      // A fence that returns only when the GPU has drained the queue. Reading
      // the displacement buffer back forces the wait.
      const fence = async () => {
        await (renderer as unknown as {
          getArrayBufferAsync(a: unknown): Promise<ArrayBuffer>;
        }).getArrayBufferAsync(field.buffers.disp);
      };

      probe.dispatchesPerFrame = field.dispatchesPerFrame;
      probe.cascadeCount = field.cascades.length;
      probe.significantWaveHeightFt = field.significantWaveHeightFt;
      probe.triangles = triangles;
      probe.setCamera = applyPreset;
      probe.setPose = (pos, look, fov) => {
        camera.position.set(...pos);
        camera.lookAt(new THREE.Vector3(...look));
        camera.fov = fov;
        camera.updateProjectionMatrix();
        freeLook?.syncFromCamera();
      };
      // A read-only readout of the camera, so a test (or the free-look check)
      // can measure where the camera went instead of guessing from pixels.
      probe.cameraPose = () => {
        const d = camera.getWorldDirection(new THREE.Vector3());
        return { pos: [camera.position.x, camera.position.y, camera.position.z], dir: [d.x, d.y, d.z], fov: camera.fov };
      };
      probe.setDebug = (m: number) => field.surface.setDebug(m);
      /* SWITCH-OFF PROBE (performance pass): turn one part of the frame off,
       * so the isolated bench can time what is left. `sky` removes the
       * background, `surface` hides the sea mesh, `extras` hides every
       * object a plug-in piece added. For measurement only: a capture never
       * calls it. */
      const pieceObjects = () => scene.children.filter((o) => o !== field.surface.mesh && o !== skyMesh);
      probe.ablate = (part: string, on: boolean) => {
        if (part === 'sky') skyMesh.visible = on;
        else if (part === 'surface') field.surface.mesh.visible = on;
        else if (part === 'extras') for (const o of pieceObjects()) o.visible = on;
        else throw new Error(`[ocean] ablate: unknown part "${part}" (sky, surface, extras)`);
      };
      probe.setTune = (name: string, value: number) => {
        const u = field.surface.tune[name];
        if (!u) throw new Error(`[ocean] No tuning uniform named "${name}".`);
        u.value = value;
      };
      probe.setContact = (i, x, z, r, st) => field.surface.setContact(i, x, z, r, st);
      probe.setSkyTune = async (values: Record<string, number>) => {
        for (const [name, value] of Object.entries(values)) {
          const u = sky.cloudTune[name];
          if (!u) throw new Error(`[ocean] No sky tuning uniform named "${name}".`);
          u.value = value;
        }
        await sky.bake(renderer!);
      };
      probe.getTune = () => Object.fromEntries(
        Object.entries(field.surface.tune).map(([k, u]) => [k, u.value]),
      );
      probe.setTime = (t: number | null) => { pinnedTime = t; };

      /**
       * The benchmark.
       *
       * Wall-clock frame time is useless here: the page is vsync-capped, and a
       * background tab is throttled further. So the benchmark SATURATES
       * instead. It enqueues the whole dispatch chain `iters` times with no
       * render and no rAF between them, then awaits a single fence. With
       * enough iterations the CPU submission cost disappears into the GPU
       * queue and the measured time is GPU throughput.
       */
      probe.bench = async (iters = 300) => {
        // The mounted pieces step with the sea in the warm-up and in the
        // whole-frame loop, at a nominal frame, so `totalMs` is the frame the
        // speed bar reports and not the sea alone. `computeMs` and `drawMs`
        // stay the sea's own, so the shading and wave costs remain readable.
        const stepAll = (t: number) => {
          field.step(renderer!, t);
          for (const x of extras.values()) x.update(t, 1 / 60);
        };
        loopPaused = true;
        try {
          // Warm up: first-run shader compilation would otherwise land in the
          // measurement and inflate it several-fold. The first fence also
          // drains any frame the live loop queued before the pause.
          for (let i = 0; i < 20; i += 1) stepAll(i * 0.01);
          await fence();

          const c0 = performance.now();
          for (let i = 0; i < iters; i += 1) field.step(renderer!, 100 + i * 0.016);
          await fence();
          const computeMs = (performance.now() - c0) / iters;

          const d0 = performance.now();
          for (let i = 0; i < iters; i += 1) renderer!.render(scene, camera);
          await fence();
          const drawMs = (performance.now() - d0) / iters;

          const b0 = performance.now();
          for (let i = 0; i < iters; i += 1) {
            stepAll(200 + i * 0.016);
            renderer!.render(scene, camera);
          }
          await fence();
          const totalMs = (performance.now() - b0) / iters;
          return { computeMs, drawMs, totalMs, iters };
        } finally {
          loopPaused = false;
        }
      };

      /**
       * The determinism gate. It deliberately does NOT compare screenshots:
       * two runs at the same simulated time produce different pixels because
       * the readout carries live frame timings. The claim under test is that
       * the same (seed, time) produces the same SURFACE, so the surface is
       * what gets compared.
       */
      probe.hashField = async (t: number) => {
        field.step(renderer!, t);
        const raw = await (renderer as unknown as {
          getArrayBufferAsync(a: unknown): Promise<ArrayBuffer>;
        }).getArrayBufferAsync(field.buffers.disp);
        const f32 = new Float32Array(raw);
        // FNV-1a over the raw bits. Cheap, and sensitive to one flipped bit.
        let h = 0x811c9dc5;
        const bytes = new Uint8Array(
          f32.buffer, f32.byteOffset, Math.min(f32.byteLength, 1 << 22),
        );
        for (let i = 0; i < bytes.length; i += 1) {
          h ^= bytes[i];
          h = Math.imul(h, 0x01000193) >>> 0;
        }
        let sum = 0;
        let peak = 0;
        for (let i = 1; i < f32.length; i += 4) {
          sum += f32[i];
          peak = Math.max(peak, Math.abs(f32[i]));
        }
        return { hash: h.toString(16), meanHeightM: sum / (f32.length / 4), peakHeightM: peak };
      };

      /**
       * Run the whole pipeline on the CPU and compare it, cell by cell, to
       * what the GPU produced.
       *
       * THIS IS THE GATE THAT PROVES THE TSL KERNEL, and nothing else in the
       * project can. The unit tests prove the CPU reference against a naive
       * DFT and against published spectral identities. The screenshots prove
       * the result looks like the sea. Neither proves that the WGSL the TSL
       * compiler emitted computes the same thing as the reference it mirrors —
       * a transposed axis, an off-by-one twiddle, or a sign on the wrong half
       * of a butterfly all still render moving water.
       *
       * The tolerance is set by float32: the GPU carries the transform in
       * float32 and the reference in float64.
       */
      probe.crossCheck = async (t: number) => {
        field.step(renderer!, t);
        const raw = await (renderer as unknown as {
          getArrayBufferAsync(a: unknown): Promise<ArrayBuffer>;
        }).getArrayBufferAsync(field.buffers.disp);
        const gpu = new Float32Array(raw);

        const n = field.buffers.n;
        const cells = n * n;
        const out: Array<Record<string, number>> = [];

        for (let ci = 0; ci < field.cascades.length; ci += 1) {
          const spec = buildCascadeSpectrum(
            field.cascades[ci], n, (OCEAN_SEED ^ (ci * 0x9e3779b9)) >>> 0,
          );
          const cpu = realizeCascade(spec, t);

          let maxAbsErr = 0;
          let sumSq = 0;
          let refSq = 0;
          for (let i = 0; i < cells; i += 1) {
            const g = (ci * cells + i) * 4;
            const pairs: Array<[number, number]> = [
              [gpu[g + 0], cpu.dispX[i]],
              [gpu[g + 1], cpu.height[i]],
              [gpu[g + 2], cpu.dispZ[i]],
            ];
            for (const [a, b] of pairs) {
              const d = a - b;
              maxAbsErr = Math.max(maxAbsErr, Math.abs(d));
              sumSq += d * d;
              refSq += b * b;
            }
          }
          out.push({ cascade: ci, maxAbsErrM: maxAbsErr, relRms: Math.sqrt(sumSq / refSq) });
        }
        return out;
      };

      const resize = () => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (w === 0 || h === 0 || !renderer) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(mount);

      setState('ready');

      const t0 = performance.now();
      let last = t0;
      let frames = 0;
      // Rolling windows, not lifetime averages: the first frames include
      // shader compilation and would flatter every later measurement.
      const wallWindow: number[] = [];
      const gpuWindow: number[] = [];
      const drawWindow: number[] = [];
      const cpuWindow: number[] = [];
      const cpuStepWindow: number[] = [];
      const cpuExtrasWindow: number[] = [];
      const cpuRenderWindow: number[] = [];
      const roll = (w: number[], v: number) => {
        w.push(v);
        if (w.length > 90) w.shift();
        return w.reduce((s, x) => s + x, 0) / w.length;
      };

      const frame = () => {
        if (disposed || !renderer) return;
        if (loopPaused) {
          raf = requestAnimationFrame(frame);
          return;
        }
        const now = performance.now();
        const dt = now - last;
        last = now;
        // A pinned time makes a screenshot reproducible, which is the point of
        // the determinism gate.
        const simTime = pinnedTime ?? (now - t0) / 1000;
        probe.time = simTime;
        // THE DENSE CENTER FOLLOWS THE CAMERA (2026-09-25). The sea's mesh is
        // a warped grid, 0.24 m between vertices at its center and 15 m at
        // 500 m, and the sampler rolls the ripple and chop cascades off with
        // distance from that center (`cascadeLod`), as the near glints and the
        // far slope gain do. Nothing moved the center, so after a free-look
        // flight the detail stayed in a round patch at the world origin
        // (Remy saw it from 1.6 km up). It is set here, before the step and
        // the pieces' updates, so every piece that copies `surface.center`
        // reads this frame's value. Each pose setter already placed the
        // camera; a camera at x = z = 0 (the judged poses) keeps it at 0.
        field.surface.setCenter(camera.position.x, camera.position.z);
        field.step(renderer, simTime);
        const tStep = performance.now();
        // A pinned clock hands the pieces a zero step, so a floating body
        // holds still in a pinned capture.
        const dtS = pinnedTime === null ? dt / 1000 : 0;
        for (const x of extras.values()) x.update(simTime, dtS);
        // Held flight keys move the camera by real time, even when the sea's
        // clock is pinned; with no key held this does nothing.
        freeLook?.update(dt / 1000);
        followStep();
        const tExtras = performance.now();
        renderer.render(scene, camera);
        const tRender = performance.now();
        // CPU TIME PER FRAME (performance pass). `now` was read at the top of
        // this frame, so the three parts sum to the main thread's own work.
        if (frames > 20) {
          probe.cpuMsPerFrame = roll(cpuWindow, tRender - now);
          probe.cpuSplitMs = {
            step: roll(cpuStepWindow, tStep - now),
            extras: roll(cpuExtrasWindow, tExtras - tStep),
            render: roll(cpuRenderWindow, tRender - tExtras),
          };
        }

        // GPU timestamps land a frame or two late; reading them every frame is
        // still the freshest number available.
        const computeMs = renderer.info.compute.timestamp;
        const renderMs = renderer.info.render.timestamp;
        if (computeMs > 0) probe.gpuMsPerFrame = roll(gpuWindow, computeMs);
        if (renderMs > 0) probe.gpuDrawMsPerFrame = roll(drawWindow, renderMs);

        frames += 1;
        probe.frames = frames;
        if (frames > 20) {
          probe.msPerFrame = roll(wallWindow, dt);
          probe.fps = 1000 / probe.msPerFrame;
        }
        if (frames === 45) probe.ready = true;

        if (frames % 30 === 0 && wallWindow.length > 0) {
          setReadout({
            significantWaveHeightFt: field.significantWaveHeightFt,
            dispatchesPerFrame: field.dispatchesPerFrame,
            cascades: field.cascades.length,
            cascadeLines,
            triangles,
            fps: probe.fps,
            gpuComputeMs: probe.gpuMsPerFrame,
            gpuDrawMs: probe.gpuDrawMsPerFrame,
          });
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      cleanupExtra = () => {
        observer.disconnect();
        for (const x of extras.values()) x.dispose();
        freeLook?.dispose();
      };
    };

    start().catch((e) => fail(String(e)));

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanupExtra?.();
      applyPresetRef.current = null;
      applyDebugRef.current = null;
      if (globalThis.__OCEAN__ === probe) globalThis.__OCEAN__ = undefined;
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
    // The camera preset is applied through a ref, so changing it must not
    // rebuild the whole GPU pipeline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choosePreset = useCallback((name: string) => {
    setPreset(name);
    setJudgedPoseOn(false);
    // A preset is a fixed view, so it lets go of the ship.
    setFollow(false);
    applyPresetRef.current?.(name);
  }, []);

  const chooseDebug = useCallback((mode: number) => {
    setDebug(mode);
    applyDebugRef.current?.(mode);
  }, []);

  /* FULL FRAME, for a like-for-like comparison with another renderer.
   *
   * The pane layout halves the canvas, so a frame from here and a frame from a
   * full-window demo differ in resolution before they differ in water. With
   * `full=1` the canvas takes the whole window and nothing is drawn over it.
   * It is the same component and the same pipeline: one address, one surface. */
  if (urlParam('full') === '1') {
    /* THE NAMEPLATE (Remy, 2026-09-25: "so i know which is which"). The
     * top-left corner names the view, with the sea state, the mounted pieces
     * and the camera preset read from the same address. The name is `&name=`
     * when a link passes one (the progress page's links do); otherwise it
     * comes from the mounted pieces, or from the sea state when none is
     * mounted. It draws on every page a PERSON opens, and never in a capture:
     * every capture rig drives the browser through Playwright, which sets
     * `navigator.webdriver`, so every judged frame keeps its pixels. `&plate=1`
     * forces it on (a proof shot) and `&plate=0` forces it off. It takes no
     * pointer events, so drag-to-look works through it. */
    const plateForce = urlParam('plate');
    const plateOn = plateForce === '1' || (plateForce !== '0' && navigator.webdriver !== true);
    const PIECE_NAMES: Record<string, string> = {
      wake: 'Wake', buoys: 'Buoyancy', seabed: 'Caustics and shallows', underwater: 'Underwater',
      foam: 'Foam', rain: 'Rain', spray: 'Spray',
      // 2026-09-29: the two newest pieces, so their nameplates read as words.
      beach: 'Beach and swash', skip: 'Skip stones',
    };
    const plateExtras = (urlParam('extras') ?? '').split(',').map((e) => e.trim()).filter((e) => e && e !== 'none');
    const plateSea = urlParam('sea');
    const plateName = !plateOn ? null
      : urlParam('name')
        ?? (plateExtras.length > 0
          ? plateExtras.map((e) => PIECE_NAMES[e] ?? e).join(' + ')
          : plateSea === 'storm' ? 'Storm sea' : plateSea === 'shallow' ? 'Shallow sea' : 'Open sea');
    const plateFacts = [
      `sea: ${urlParam('sea') ?? 'default'}`,
      `pieces: ${urlParam('extras') ?? 'none'}`,
      urlParam('cam') ? `camera: ${urlParam('cam')}` : null,
    ].filter(Boolean).join(' · ');
    /* A PORTAL, not just `fixed`. The Design Preview window sits inside a
     * transformed ancestor, and `position: fixed` inside one is fixed to that
     * ancestor, not to the page: the first full-frame capture had the page
     * header drawn over the top of the sea. Mounting on <body> escapes it. */
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-black">
        <div ref={mountRef} className="absolute inset-0" />
        {plateName && (
          <div
            className="pointer-events-none absolute left-3 top-3 select-none rounded-md px-3 py-2 text-white"
            style={{ background: 'rgba(8, 20, 28, 0.62)', boxShadow: '0 1px 6px rgba(0, 0, 0, 0.35)' }}
          >
            <div className="text-[15px] font-semibold leading-tight tracking-wide">{plateName}</div>
            <div className="mt-0.5 text-[11px] leading-tight" style={{ color: 'rgba(214, 233, 240, 0.85)' }}>{plateFacts}</div>
          </div>
        )}
        {canFollow && navigator.webdriver !== true && (
          <button
            type="button"
            onClick={() => setFollow((f) => !f)}
            className="absolute right-3 top-3 select-none rounded-md px-3 py-2 text-[13px] font-semibold text-white"
            style={{
              background: follow ? 'rgba(2, 132, 199, 0.9)' : 'rgba(8, 20, 28, 0.62)',
              boxShadow: '0 1px 6px rgba(0, 0, 0, 0.35)',
            }}
            title={follow
              ? 'The camera follows the ship and keeps it centered. Drag to orbit, the wheel to move nearer or farther. Press to let go.'
              : 'Keep the camera on the ship as it sails, with the ship in the middle of the view.'}
          >
            {follow ? 'Camera pinned to ship' : 'Pin camera to ship'}
          </button>
        )}
        {state === 'unavailable' && (
          <pre className="absolute inset-0 m-0 whitespace-pre-wrap p-6 text-sm text-red-300">{reason}</pre>
        )}
      </div>,
      document.body,
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2">
        <span className="text-xs text-gray-400">Camera</span>
        <div className="flex gap-1 rounded-md border border-gray-700 bg-gray-900 p-0.5">
          {Object.keys(CAMERA_PRESETS).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => choosePreset(name)}
              disabled={state !== 'ready'}
              className={`h-7 rounded px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:text-gray-700 ${
                preset === name && !judgedPoseOn ? 'bg-sky-600 text-white' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        {canFollow && (
          <button
            type="button"
            onClick={() => setFollow((f) => !f)}
            disabled={state !== 'ready'}
            title="Keep the camera on the ship as it sails, with the ship in the middle of the view. Drag to orbit, the wheel to move nearer or farther."
            className={`h-7 rounded px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:text-gray-700 ${
              follow ? 'bg-sky-600 text-white' : 'border border-gray-700 text-gray-300 hover:bg-gray-800'
            }`}
          >
            {follow ? 'Camera pinned to ship' : 'Pin camera to ship'}
          </button>
        )}
        <button
          type="button"
          onClick={toggleCompare}
          title="Show the bar beside our sea, both live: the Three.js Water Pro demo, or its video frames where the judges' reference was a video."
          className={`h-7 rounded px-2 text-xs font-medium transition-colors ${
            compare ? 'bg-emerald-700 text-white' : 'border border-gray-700 text-gray-300 hover:bg-gray-800'
          }`}
        >
          {compare ? 'Hide Water Pro' : 'Compare live with Water Pro'}
        </button>
        {compare && (
          <select
            value={judgedView?.id ?? ''}
            onChange={(e) => openView(e.target.value)}
            title="Open ours at the sea, pieces and camera the judges saw. The page reloads."
            className="h-7 rounded border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200"
          >
            <option value="">Pick a judged view...</option>
            {JUDGED_VIEWS.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        )}
        <span className="text-xs text-gray-400">Channel</span>
        <div className="flex gap-1 rounded-md border border-gray-700 bg-gray-900 p-0.5">
          {DEBUG_CHANNELS.map((label, mode) => (
            <button
              key={label}
              type="button"
              onClick={() => chooseDebug(mode)}
              disabled={state !== 'ready'}
              className={`h-7 rounded px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:text-gray-700 ${
                debug === mode ? 'bg-amber-600 text-white' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-500">
          JONSWAP with a TMA depth correction, {readout?.cascades ?? 3} cascades (each listed
          below with its patch size; the lake sea has two), {OCEAN_FFT_N}x{OCEAN_FFT_N} FFT on the GPU. Seed 0x0cea9. The URL
          carries <code>cam</code>, <code>dbg</code> and <code>t</code>.
        </p>
        {readout && (
          <pre className="w-full whitespace-pre font-mono text-[10px] leading-relaxed text-gray-500">
            {readout.cascadeLines.join('\n')}
          </pre>
        )}
      </div>

      {/* ONE PANE, THE WHOLE WINDOW (Remy, 2026-09-28: "add the design preview
       * menu and window modal to the different views"). The left pane was an
       * empty "No shipping ocean" frame that took half the window, so the sea
       * got the other half, and the links on the progress page had to open
       * full-screen (`full=1`) to show it at a useful size. The reason that
       * pane was empty still stands, so it moves into this one line, with the
       * full text on hover; the sea now fills the window. `full=1` is
       * unchanged, and every capture still uses it. */}
      <p
        className="flex-shrink-0 text-[11px] text-gray-500"
        title={
          'Aralia ships nothing to compare the FFT sea against.\n\n'
          + 'The volumetric water in src/systems/worldforge/terrain/ answers a different '
          + 'question: what a finite body of water DOES when disturbed. It is not an open '
          + 'sea, and drawing it here would invent a comparison that does not exist.\n\n'
          + 'A sine-wave stand-in would be worse. It would look like an ocean and be wrong '
          + 'in every measurable way.'
        }
      >
        No shipping ocean to compare against: the game has no open-water surface today, so this
        sea is judged on its own here, and against Three.js Water Pro in the ocean gauntlet.
      </p>
      <div className="flex min-h-0 flex-1 gap-3">
        <ComparePane
          side="newly-built"
          title="createOceanField — FFT open-ocean surface"
          caption="New capability with no counterpart in the game. Judge it on its own."
          state={state}
          reason={reason ?? undefined}
          progress="Starting WebGPU and building the wave field..."
          facts={readout ? [
            ['sig wave height', `${readout.significantWaveHeightFt.toFixed(1)} ft`],
            ['cascades', String(readout.cascades)],
            ['dispatches/frame', String(readout.dispatchesPerFrame)],
            ['triangles', readout.triangles.toLocaleString()],
            ['gpu compute', readout.gpuComputeMs === null ? 'pending' : `${readout.gpuComputeMs.toFixed(3)} ms`],
            ['gpu draw', readout.gpuDrawMs === null ? 'pending' : `${readout.gpuDrawMs.toFixed(3)} ms`],
            ['frame', `${readout.fps.toFixed(0)} fps (vsync capped)`],
          ] : undefined}
        >
          <div ref={mountRef} className="absolute inset-0" />
        </ComparePane>
        {compare && <WaterProPane view={judgedView} />}
      </div>
      {compare && judgedView && (
        <p className="flex-shrink-0 text-[11px] text-emerald-300">
          {judgedView.label}: {judgedView.why} {judgedView.bar.how}
        </p>
      )}
    </div>
  );
};

export default SideBySideOcean;
