/**
 * @file oceanExtras/skip.ts — throw stones at calm water and see whether they
 * skip (Remy, 2026-09-28: "i also want a modal where i can throw rocks into
 * the water, and see if it will or wont skip based on angle of the throw and
 * the type of rock").
 *
 * `?step=water&ocean=1&sea=lake&extras=skip` (the water page's "Skip stones"
 * button opens it). The physics is `src/systems/world3d/ocean/oceanSkipMath.ts`
 * (a rigid-body stone against the published skipping-stone experiments), run
 * in `oceanSkipWorker.ts`; the drawing is `oceanSkip.ts`. This file mounts
 * them in the ocean viewer, builds the panel a person throws with, and
 * publishes a probe a capture rig drives.
 *
 * THE PANEL shows to a person and never in a capture (`navigator.webdriver`,
 * as the viewer's nameplate; `&skippanel=1` forces it on for a proof shot).
 * Stone type, speed, the path's angle at the first touch, tilt, spin and
 * release height; the presets; Throw and Reset; a drag in the scene throws
 * toward the pointer (or looks around, by the panel's switch); the camera
 * follows the stone and comes back. The readout gives the skips, the
 * distance, each touch's path angle and speed, and why it ended.
 *
 * DETERMINISM. A run is a pure function of the throw and the sea; the view
 * draws it as a pure function of the sea time. The probe's `throw` takes
 * the release time, so a capture at a pinned time shows the same frame on
 * every run. The live page releases at the sea time of the click plus a
 * short wind-up; on the lake a run takes 0.3 to 4 s in the worker, and a run
 * that arrives after its release time plays from its start, so its waves
 * are those of the release time, not of the frame (a few millimeters of
 * height on this sea; the captures are exact).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 29/09/2026, 09:55:03
 * Dependents: None (Orphan)
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import {
  SKIP_PRESETS,
  SKIP_STONES,
  createSkipSeaWater,
  skipRingTable,
  skipStoneInertia,
  skipStoneMesh,
  type SkipRun,
  type SkipSeaWater,
  type SkipStoneId,
  type SkipThrow,
} from '@/systems/world3d/ocean/oceanSkipMath';
import { createSkipView, createSkipWorker } from '@/systems/world3d/ocean/oceanSkip';
import type { OceanExtra, OceanExtraContext } from '../oceanExtras';

export const enabledByDefault = false;

type ThrowParams = Omit<SkipThrow, 'headingRad' | 'originXM' | 'originZM' | 't0S'>;

/** Where the thrower stands, and the camera that looks over the shoulder. */
const THROWER = { xM: 0, zM: 0, headingRad: -Math.PI / 2 };
const THROWER_POSE = { pos: [0.45, 1.45, 1.7] as [number, number, number], look: [0, 0.05, -9] as [number, number, number], fov: 55 };
/** Seconds between a click and the release (the wind-up). */
const WIND_UP_S = 0.4;

const fmt = (x: number, d = 0) => x.toFixed(d);

export default async function mount(ctx: OceanExtraContext): Promise<OceanExtra> {
  const url = new URLSearchParams(window.location.search);
  const panelOn = url.get('skippanel') === '1' || (url.get('skippanel') !== '0' && navigator.webdriver !== true);

  /* --- the physics, off the main thread ----------------------------- */

  const worker = createSkipWorker();
  let workerReady: { label: string; modes: number; varianceKept: number } | null = null;
  let workerError: string | null = null;
  const pending = new Map<number, { resolve: (r: SkipRun) => void; reject: (e: Error) => void }>();
  let nextId = 1;
  const ready = new Promise<void>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'ready') { workerReady = m; resolve(); return; }
      if (m.type === 'run') { const p = pending.get(m.id); pending.delete(m.id); p?.resolve(m.run as SkipRun); return; }
      if (m.type === 'error') {
        const err = new Error(`[ocean] The skip worker failed: ${m.message}`);
        if (m.id < 0) { workerError = err.message; reject(err); return; }
        const p = pending.get(m.id); pending.delete(m.id); p?.reject(err);
      }
    };
    worker.onerror = (e) => { workerError = String(e.message); reject(new Error(`[ocean] The skip worker did not start: ${e.message}`)); };
  });
  // Plain copies of the cascades: a worker message carries data, not classes.
  worker.postMessage({ type: 'init', cascades: JSON.parse(JSON.stringify(ctx.field.cascades)), seed: ctx.seed, n: ctx.field.buffers.n });
  await ready;

  const runThrow = (t: SkipThrow): Promise<SkipRun> => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ type: 'throw', id, throw: t });
  });

  /* --- the view -------------------------------------------------------- */

  const view = createSkipView({ sky: ctx.sky, ringTable: skipRingTable(), debug: url.get('skipdebug') ?? undefined });
  ctx.scene.add(view.marks);
  ctx.scene.add(view.group);

  // The sea's height on the main thread, only for a floating stone riding
  // the waves after its run; built the first time one needs it.
  let mainWater: SkipSeaWater | null = null;
  const ws = { h: 0, sx: 0, sz: 0 };
  const waterAt = (x: number, z: number, seaTimeS: number) => {
    // 90% of the variance (about 5,000 modes, 0.4 ms a sample): one sample a
    // frame, for a stone that bobs, not for a contact.
    if (!mainWater) mainWater = createSkipSeaWater(ctx.field.cascades, ctx.seed, ctx.field.buffers.n, { keepVariance: 0.9 });
    return mainWater.sample(x, z, seaTimeS, ws).h;
  };

  /* --- state ----------------------------------------------------------- */

  let params: ThrowParams = { ...SKIP_PRESETS[0].throw };
  let heading = THROWER.headingRad;
  let run: SkipRun | null = null;
  let t0 = 0;
  let busy = false;
  let follow = navigator.webdriver !== true;
  let dragThrows = true;
  let lastSimTime = 0;
  let lastMsg = '';

  const setCamera = (pos: [number, number, number], look: [number, number, number], fov: number) => {
    ctx.camera.position.set(...pos);
    ctx.camera.lookAt(new THREE.Vector3(...look));
    ctx.camera.fov = fov;
    ctx.camera.updateProjectionMatrix();
  };
  // A person opens the page over the thrower's shoulder; a capture sets its
  // own pose after this.
  setCamera(THROWER_POSE.pos, THROWER_POSE.look, THROWER_POSE.fov);
  // THE NEAR PLANE. The viewer's camera clips at 0.5 m, which a sea seen from
  // a deck never reaches; a stone's splash is watched from a meter away and
  // 20 cm over the water, and there the water under the camera was cut off
  // into a dark band at the frame's foot. 5 cm while this piece is mounted;
  // put back when it goes.
  const nearWas = ctx.camera.near;
  ctx.camera.near = 0.05;
  ctx.camera.updateProjectionMatrix();

  const throwNow = async (p: Partial<ThrowParams> = {}, t0S?: number): Promise<SkipRun> => {
    if (workerError) throw new Error(workerError);
    const thr: SkipThrow = {
      ...params, ...p,
      headingRad: heading, originXM: THROWER.xM, originZM: THROWER.zM,
      t0S: t0S ?? lastSimTime + WIND_UP_S,
    };
    busy = true;
    render();
    try {
      const r = await runThrow(thr);
      run = r;
      // A run that arrives late plays from its release now (see DETERMINISM).
      t0 = t0S ?? Math.max(thr.t0S, lastSimTime);
      view.setRun(r, t0);
      lastMsg = '';
      return r;
    } catch (e) {
      lastMsg = String(e instanceof Error ? e.message : e);
      throw e;
    } finally {
      busy = false;
      render();
    }
  };

  /* --- the panel -------------------------------------------------------- */

  const host = ctx.renderer.domElement.parentElement ?? document.body;
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:absolute', 'top:10px', 'right:10px', 'z-index:30', 'width:360px', 'max-height:calc(100% - 24px)', 'overflow:auto',
    'background:rgba(8,20,28,0.84)', 'color:#e6f0f3', 'font:12px/1.35 system-ui,sans-serif', 'border-radius:8px',
    'padding:10px 12px', 'box-shadow:0 2px 10px rgba(0,0,0,0.4)', 'user-select:none',
  ].join(';');
  if (!panelOn) panel.style.display = 'none';
  host.appendChild(panel);
  // Clicks in the panel never reach the scene (no throw, no look).
  for (const ev of ['pointerdown', 'wheel', 'keydown']) panel.addEventListener(ev, (e) => e.stopPropagation());

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, css = '', text = ''): HTMLElementTagNameMap[K] => {
    const n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text) n.textContent = text;
    return n;
  };
  const btnCss = (on: boolean) => `margin:2px;padding:3px 7px;border-radius:5px;border:1px solid ${on ? '#38bdf8' : '#3b4b55'};background:${on ? 'rgba(2,132,199,0.55)' : 'rgba(15,30,40,0.8)'};color:#e6f0f3;font:12px system-ui;cursor:pointer`;

  // The head: the title and a switch that folds the controls away, so a
  // short window keeps the water in view and still shows the result.
  const head = el('div', 'display:flex;align-items:center;justify-content:space-between;margin-bottom:2px');
  const title = el('div', 'font-weight:600;font-size:14px', 'Skip stones');
  const foldBtn = el('button', 'padding:1px 7px;border-radius:5px;border:1px solid #3b4b55;background:rgba(15,30,40,0.8);color:#e6f0f3;font:11px system-ui;cursor:pointer', 'Hide controls');
  foldBtn.type = 'button';
  head.append(title, foldBtn);
  const body = el('div');
  let folded = false;
  foldBtn.onclick = () => { folded = !folded; body.style.display = folded ? 'none' : ''; foldBtn.textContent = folded ? 'Show controls' : 'Hide controls'; };
  const sub = el('div', 'color:#9fb3bd;font-size:11px;margin-bottom:6px',
    'Pick a stone, set the throw, press Throw or drag in the water toward where to throw.');
  // THE STONE (round 2): one list that always shows the chosen stone.
  // Round 1 drew a button per stone in two wrapped rows. In a short window
  // the panel scrolls to the pressed preset, the chosen stone's row went out
  // of view, and the row left in view named another stone over the chosen
  // one's text (the lead's p2-window-after.png: "Clay disc" over the flat
  // slate's text). A select shows its own choice wherever it scrolls to.
  const stoneRow = el('label', 'display:flex;align-items:center;gap:6px;margin:2px 0');
  const stoneInfo = el('div', 'color:#b9cbd3;font-size:11px;margin:2px 0 6px');
  const sliders = el('div', 'display:grid;grid-template-columns:1fr 1fr;column-gap:12px');
  const presetRow = el('div', 'display:flex;flex-wrap:wrap;margin:4px 0');
  const actRow = el('div', 'display:flex;flex-wrap:wrap;margin:4px 0');
  const readout = el('div', 'margin:4px 0 6px;border-bottom:1px solid #2c3b44;padding-bottom:6px');
  body.append(sub, stoneRow, stoneInfo, sliders, presetRow, actRow);
  panel.append(head, readout, body);

  const stoneSel = el('select', 'flex:1;padding:3px 5px;border-radius:5px;border:1px solid #38bdf8;background:rgba(15,30,40,0.9);color:#e6f0f3;font:12px system-ui;cursor:pointer');
  for (const st of Object.values(SKIP_STONES)) {
    const o = el('option', '', st.label);
    o.value = st.id;
    o.title = st.note;
    stoneSel.appendChild(o);
  }
  stoneSel.onchange = () => { params = { ...params, stone: stoneSel.value as SkipStoneId }; render(); };
  stoneRow.append(el('span', 'color:#9fb3bd', 'Stone'), stoneSel);

  interface SliderDef { key: keyof ThrowParams; label: string; min: number; max: number; step: number; unit: string; digits: number; help: string }
  const SLIDERS: SliderDef[] = [
    { key: 'speedMs', label: 'Throw speed', min: 1, max: 20, step: 0.5, unit: 'm/s', digits: 1, help: 'The stone’s speed as it leaves the hand.' },
    { key: 'flightAngleDeg', label: 'Flight angle', min: 0, max: 60, step: 1, unit: '°', digits: 0, help: 'The angle of the stone’s path to the water at the first touch (the incidence angle).' },
    { key: 'tiltDeg', label: 'Tilt', min: -10, max: 60, step: 1, unit: '°', digits: 0, help: 'The stone’s angle to the water, front edge up (its angle of attack). About 10 gives the most skips; about 20 still skips at the lowest speed.' },
    { key: 'spinRps', label: 'Spin', min: 0, max: 40, step: 1, unit: 'turns/s', digits: 0, help: 'Turns a second about the stone’s axis. Spin keeps the tilt steady.' },
    { key: 'releaseHeightM', label: 'Release height', min: 0.03, max: 1.5, step: 0.01, unit: 'm', digits: 2, help: 'The hand’s height over the water. From higher up, the path cannot be as flat.' },
  ];
  const sliderEls = new Map<string, { input: HTMLInputElement; value: HTMLSpanElement }>();
  for (const s of SLIDERS) {
    const row = el('label', 'display:block;margin:2px 0');
    row.title = s.help;
    const head = el('div', 'display:flex;justify-content:space-between');
    const name = el('span', '', s.label);
    const value = el('span', 'color:#7dd3fc;font-variant-numeric:tabular-nums');
    head.append(name, value);
    const input = el('input', 'width:100%');
    input.type = 'range';
    input.min = String(s.min); input.max = String(s.max); input.step = String(s.step);
    input.oninput = () => { params = { ...params, [s.key]: Number(input.value) }; render(); };
    row.append(head, input);
    sliders.appendChild(row);
    sliderEls.set(s.key, { input, value });
  }

  for (const p of SKIP_PRESETS) {
    const b = el('button', btnCss(false), p.label);
    b.type = 'button';
    b.onclick = () => { params = { ...p.throw }; heading = THROWER.headingRad; render(); void throwNow().catch(() => {}); };
    presetRow.appendChild(b);
  }
  const throwBtn = el('button', btnCss(true), 'Throw');
  throwBtn.type = 'button';
  throwBtn.onclick = () => { void throwNow().catch(() => {}); };
  const resetBtn = el('button', btnCss(false), 'Reset');
  resetBtn.type = 'button';
  resetBtn.onclick = () => {
    run = null; view.setRun(null, 0); heading = THROWER.headingRad;
    setCamera(THROWER_POSE.pos, THROWER_POSE.look, THROWER_POSE.fov);
    render();
  };
  const dragBtn = el('button', btnCss(true));
  dragBtn.type = 'button';
  dragBtn.onclick = () => { dragThrows = !dragThrows; render(); };
  const followBtn = el('button', btnCss(true));
  followBtn.type = 'button';
  followBtn.onclick = () => { follow = !follow; render(); };
  actRow.append(throwBtn, resetBtn, dragBtn, followBtn);

  function render() {
    stoneSel.value = params.stone;
    const st = SKIP_STONES[params.stone];
    const mass = skipStoneInertia(st, skipStoneMesh(st)).massKg;
    stoneInfo.textContent = `${st.label}: ${fmt(st.radiusM * 200, 1)} cm across, ${fmt(st.thicknessM * 1000, 0)} mm thick, `
      + `${fmt(st.densityKgM3 / 1000, 2)} g/cm³, ${fmt(mass * 1000, 0)} g. ${st.note}`;
    for (const s of SLIDERS) {
      const e = sliderEls.get(s.key)!;
      const v = params[s.key] as number;
      e.input.value = String(v);
      e.value.textContent = `${fmt(v, s.digits)} ${s.unit}`;
    }
    throwBtn.textContent = busy ? 'Throwing…' : 'Throw';
    throwBtn.disabled = busy;
    dragBtn.textContent = dragThrows ? 'Drag: throws' : 'Drag: looks around';
    dragBtn.style.cssText = btnCss(dragThrows);
    followBtn.textContent = follow ? 'Camera follows the stone' : 'Camera stays';
    followBtn.style.cssText = btnCss(follow);
    readout.replaceChildren();
    if (lastMsg) readout.appendChild(el('div', 'color:#fca5a5;white-space:pre-wrap', lastMsg));
    if (!run) {
      readout.appendChild(el('div', 'color:#9fb3bd', busy ? 'Working out the throw…' : 'No throw yet.'));
    } else {
      const r = run;
      readout.appendChild(el('div', 'font-size:14px;font-weight:600', `${r.skips} skip${r.skips === 1 ? '' : 's'} · ${fmt(r.distanceM, 1)} m`));
      readout.appendChild(el('div', 'margin:3px 0 5px;color:#fde68a', r.end.sentence));
      const tbl = el('table', 'width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:11px');
      const hdr = el('tr');
      for (const h of ['#', 'at', 'speed', 'path', 'tilt', 'bank', '']) hdr.appendChild(el('th', 'text-align:right;color:#9fb3bd;font-weight:500;padding:0 3px', h));
      tbl.appendChild(hdr);
      for (const tc of r.touches) {
        const tr = el('tr');
        const at = Math.hypot(tc.xM - r.throw.originXM, tc.zM - r.throw.originZM);
        for (const c of [String(tc.index + 1), `${fmt(at, 1)} m`, `${fmt(tc.speedInMs, 1)} m/s`, `${fmt(tc.flightInDeg, 1)}°`,
          `${fmt(tc.tiltInDeg)}°`, `${fmt(tc.bankInDeg)}°`, tc.rebound ? 'skip' : 'end']) {
          tr.appendChild(el('td', 'text-align:right;padding:0 3px', c));
        }
        tbl.appendChild(tr);
      }
      readout.appendChild(tbl);
      const l = r.launch;
      readout.appendChild(el('div', 'color:#9fb3bd;font-size:11px;margin-top:4px',
        l.flattest
          ? `From ${fmt(r.throw.releaseHeightM, 2)} m up at ${fmt(r.throw.speedMs, 1)} m/s the flattest path is ${fmt(l.flightAtTouchDeg, 1)}° (a level throw); lower the hand for a flatter one.`
          : `Thrown ${fmt(l.pitchDownDeg, 1)}° down to meet the water at ${fmt(l.flightAtTouchDeg, 1)}°.`));
      readout.appendChild(el('div', 'color:#6b8793;font-size:10px;margin-top:3px', `Water: ${r.water}. Stone mass ${fmt(r.massKg * 1000, 0)} g.`));
    }
  }
  render();

  /* --- drag in the scene to throw toward the pointer ------------------- */

  const canvas = ctx.renderer.domElement;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const aimGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const aimLine = new THREE.Line(aimGeom, new THREE.LineBasicNodeMaterial({ color: 0xfde68a }));
  aimLine.visible = false;
  aimLine.frustumCulled = false;
  ctx.scene.add(aimLine);
  let aiming: { id: number } | null = null;
  const pointOnWater = (e: PointerEvent): THREE.Vector3 | null => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    return ray.ray.intersectPlane(plane, hit) ? hit : null;
  };
  const aimAt = (p: THREE.Vector3) => {
    const a = aimGeom.getAttribute('position') as THREE.BufferAttribute;
    a.setXYZ(0, THROWER.xM, 0.02, THROWER.zM);
    a.setXYZ(1, p.x, 0.02, p.z);
    a.needsUpdate = true;
    aimLine.visible = true;
  };
  const onDown = (e: PointerEvent) => {
    if (!dragThrows || e.button !== 0) return;
    // Captured ahead of the viewer's free look, so a throw drag does not turn the view.
    e.stopImmediatePropagation();
    e.preventDefault();
    aiming = { id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    const p = pointOnWater(e);
    if (p) aimAt(p);
  };
  const onMove = (e: PointerEvent) => {
    if (!aiming || e.pointerId !== aiming.id) return;
    e.stopImmediatePropagation();
    const p = pointOnWater(e);
    if (p) aimAt(p);
  };
  const onUp = (e: PointerEvent) => {
    if (!aiming || e.pointerId !== aiming.id) return;
    e.stopImmediatePropagation();
    aiming = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    const p = pointOnWater(e);
    aimLine.visible = false;
    if (!p) return;
    const dx = p.x - THROWER.xM; const dz = p.z - THROWER.zM;
    if (Math.hypot(dx, dz) < 0.3) return;
    heading = Math.atan2(dz, dx);
    void throwNow().catch(() => {});
  };
  canvas.addEventListener('pointerdown', onDown, { capture: true });
  canvas.addEventListener('pointermove', onMove, { capture: true });
  canvas.addEventListener('pointerup', onUp, { capture: true });
  canvas.addEventListener('pointercancel', onUp, { capture: true });

  /* --- the camera that follows the stone ------------------------------- */

  const camGoal = new THREE.Vector3();
  const lookGoal = new THREE.Vector3();
  const lookNow = new THREE.Vector3(...THROWER_POSE.look);
  let returnHome = false;
  const followStep = (tau: number, dtS: number) => {
    if (!follow || !run || dtS <= 0) return;
    const endT = run.samples[run.samples.length - 8];
    const hx = Math.cos(heading); const hz = Math.sin(heading);
    if (tau >= 0 && tau < endT + 1.2) {
      // Behind the stone and a little to the right and up, as the ship pin
      // keeps a boat centered (SideBySideOcean.tsx, "Pin camera to ship").
      const p = view.stonePos;
      camGoal.set(p.x - 2.4 * hx - 0.6 * hz, Math.max(0.6, p.y + 0.7), p.z - 2.4 * hz + 0.6 * hx);
      lookGoal.set(p.x + 1.0 * hx, Math.max(p.y, 0), p.z + 1.0 * hz);
      returnHome = true;
    } else if (returnHome && tau >= endT + 1.2) {
      camGoal.set(...THROWER_POSE.pos);
      lookGoal.set(...THROWER_POSE.look);
      if (ctx.camera.position.distanceTo(camGoal) < 0.02) returnHome = false;
    } else return;
    const k = 1 - Math.exp(-dtS / 0.18);
    ctx.camera.position.lerp(camGoal, k);
    lookNow.lerp(lookGoal, k);
    ctx.camera.lookAt(lookNow);
  };

  /* --- the probe ------------------------------------------------------- */

  const touchPose = (name: string) => {
    if (!run || run.touches.length === 0) throw new Error('[ocean] No run with a touch to pose on. Throw first.');
    const tc = run.touches[0];
    const hx = Math.cos(tc.headingRad); const hz = Math.sin(tc.headingRad);
    const lx = -hz; const lz = hx;
    if (name === 'splash') {
      // THE JUDGED SPLASH POSE, matched to sk_017 to sk_020 of the reference
      // clip (see oceanSkip.ts). Measured on sk_018: the horizon 57% down the
      // frame (the camera pitched 3.4 degrees up at this field of view), the
      // crown's base about 8 degrees under the horizon and the crown a third
      // of the frame wide. This stone's crown is about 0.45 m across, so the
      // camera is 1.25 m back along the throw and 0.3 m aside, 0.2 m over
      // the water: lower than the brief's 0.5 m, which would put the crown
      // against water; the clip has the sky and the far shore behind it, so
      // its camera was under the crown's top.
      return {
        pos: [tc.xM - 1.25 * hx + 0.3 * lx, tc.yM + 0.2, tc.zM - 1.25 * hz + 0.3 * lz] as [number, number, number],
        look: [tc.xM + 2.5 * hx, tc.yM + 0.42, tc.zM + 2.5 * hz] as [number, number, number],
        fov: 44,
      };
    }
    if (name === 'side') {
      const last = run.touches[run.touches.length - 1];
      const mx = (tc.xM + last.xM) / 2; const mz = (tc.zM + last.zM) / 2;
      const span = Math.max(3, Math.hypot(last.xM - tc.xM, last.zM - tc.zM));
      return {
        pos: [mx + 0.95 * span * lx - 0.25 * span * hx, 1.0 + 0.1 * span, mz + 0.95 * span * lz - 0.25 * span * hz] as [number, number, number],
        look: [mx, 0.1, mz] as [number, number, number],
        fov: 50,
      };
    }
    if (name === 'thrower') return THROWER_POSE;
    if (name === 'chase') {
      // The follow camera's pose at the last frame: 2.4 m behind the stone,
      // 0.6 m to the right and 0.7 m over it, looking a meter ahead.
      const p = view.stonePos;
      const fx = Math.cos(heading); const fz = Math.sin(heading);
      return {
        pos: [p.x - 2.4 * fx - 0.6 * fz, Math.max(0.6, p.y + 0.7), p.z - 2.4 * fz + 0.6 * fx] as [number, number, number],
        look: [p.x + 1.0 * fx, Math.max(p.y, 0), p.z + 1.0 * fz] as [number, number, number],
        fov: 55,
      };
    }
    throw new Error(`[ocean] No skip pose "${name}". Poses: splash, side, chase, thrower.`);
  };

  const summary = () => (run ? {
    stone: run.stone.id, skips: run.skips, distanceM: run.distanceM, cause: run.end.cause, sentence: run.end.sentence,
    t0S: t0, water: run.water, launch: run.launch,
    touches: run.touches.map((tc) => ({
      i: tc.index, tS: t0 + tc.tStartS, endS: t0 + tc.tEndS, x: tc.xM, z: tc.zM, y: tc.yM, speed: tc.speedInMs,
      flight: tc.flightInDeg, tilt: tc.tiltInDeg, bank: tc.bankInDeg, rebound: tc.rebound, pushedM3: tc.pushedM3,
    })),
    endS: t0 + run.samples[run.samples.length - 8],
  } : null);

  const probe: Record<string, unknown> = {
    /** Which build answered (the working copies say so). */
    build: 'r2',
    presets: SKIP_PRESETS.map((p) => p.id),
    water: () => workerReady,
    /** Throw with the panel's values over `p`, released at sea time t0S. Resolves to the run's summary. */
    throw: async (p: Partial<ThrowParams> = {}, t0S?: number) => { await throwNow(p, t0S); return summary(); },
    /** Throw a preset, released at sea time t0S. */
    preset: async (id: string, t0S?: number) => {
      const p = SKIP_PRESETS.find((x) => x.id === id);
      if (!p) throw new Error(`[ocean] No skip preset "${id}". Presets: ${SKIP_PRESETS.map((x) => x.id).join(', ')}.`);
      params = { ...p.throw };
      heading = THROWER.headingRad;
      render();
      await throwNow({}, t0S);
      return summary();
    },
    run: summary,
    setParams: (p: Partial<ThrowParams>) => { params = { ...params, ...p }; render(); return params; },
    setHeading: (rad: number) => { heading = rad; },
    setFollow: (on: boolean) => { follow = on; render(); },
    setPanel: (on: boolean) => { panel.style.display = on ? '' : 'none'; },
    /** A camera pose on the current run: 'splash', 'side' or 'thrower'. */
    pose: touchPose,
    setPose: (name: string) => { const q = touchPose(name); setCamera(q.pos, q.look, q.fov); return q; },
    stats: () => ({ ...view.stats(), stoneShown: view.stoneShown, stone: view.stonePos.toArray() }),
  };

  return {
    update(simTime, dtS) {
      lastSimTime = simTime;
      view.update(simTime, ctx.camera, ctx.renderer.domElement.clientHeight || 900, run?.floats ? waterAt : undefined);
      followStep(simTime - t0, dtS);
    },
    dispose() {
      ctx.camera.near = nearWas;
      ctx.camera.updateProjectionMatrix();
      canvas.removeEventListener('pointerdown', onDown, { capture: true });
      canvas.removeEventListener('pointermove', onMove, { capture: true });
      canvas.removeEventListener('pointerup', onUp, { capture: true });
      canvas.removeEventListener('pointercancel', onUp, { capture: true });
      panel.remove();
      worker.terminate();
      ctx.scene.remove(view.group);
      ctx.scene.remove(view.marks);
      ctx.scene.remove(aimLine);
      aimGeom.dispose();
      (aimLine.material as THREE.Material).dispose();
      view.dispose();
    },
    probe,
  };
}
