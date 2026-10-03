/**
 * capture-catalog.mjs — photograph every Design Preview pane.
 *
 * Writes PNGs and a manifest to `public/preview-catalog/`, which git ignores.
 * The catalog overlay reads that manifest; with no manifest it simply shows
 * rows without pictures, which is the honest state before a first run.
 *
 * WHY THIS DRIVES CHROME DIRECTLY, rather than using `--screenshot`:
 * a plain headless screenshot needs `--virtual-time-budget` to wait for the
 * page. That budget counts PAGE time, and a 3D scene animates forever, so it
 * never runs out. One capture ran 41 minutes before it was killed. Driving the
 * DevTools protocol lets this script use a real wall-clock deadline, ask the
 * page whether it settled, and give up honestly when it did not.
 *
 *   node scripts/preview/capture-catalog.mjs              # every pane
 *   node scripts/preview/capture-catalog.mjs land water   # only these
 *   node scripts/preview/capture-catalog.mjs --port 3000
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const WebSocket = require('ws');

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const OUT_DIR = path.resolve('public/preview-catalog');
const PROFILE_DIR = path.join(os.tmpdir(), 'aralia-catalog-capture-profile');
const DEBUG_PORT = 9335;
const SHOT_W = 1280;
const SHOT_H = 860;

// How long to give one pane before calling it a failure. A 2D pane settles in
// a second or two; a 3D scene builds a world first.
// Measured across a full 52-pane run. A warm pane settles in 2-3 seconds, but
// the dev server compiles each pane's chunk on first request, and under a long
// run that compile alone passed 20 seconds. Twelve seconds failed 20 panes that
// were perfectly healthy, so these are deliberately generous: a slow capture
// costs minutes, while a wrong "broken" label costs trust in the whole catalog.
// 60s, not 45: the first capture after a dev-server restart compiles the pane
// from cold and measured 50.8s, which the shorter limit reported as broken.
const DEADLINE_2D_MS = 60_000;
const DEADLINE_3D_MS = 90_000;

const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = portArg >= 0 ? Number(args[portArg + 1]) : 3000;
const deadlineArg = args.indexOf('--deadline');
/** Seconds to give a 3D pane before calling it a failure. */
const DEADLINE_3D_OVERRIDE = deadlineArg >= 0 ? Number(args[deadlineArg + 1]) * 1000 : null;
const only = args.filter((a, i) => (
  !a.startsWith('--')
  && a !== String(PORT)
  && !(deadlineArg >= 0 && i === deadlineArg + 1)
));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chromePath() {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error('Chrome not found. Edit CHROME_CANDIDATES.');
  return found;
}

/** Read the step list straight from the registry, so it can never drift. */
function readSteps() {
  const src = readFileSync('src/components/DesignPreview/DesignPreviewPage.tsx', 'utf8');
  const block = src.slice(src.indexOf('const steps: PreviewStep[] = ['));
  const out = [];
  const re = /\{\s*id:\s*'([^']+)',\s*label:\s*'([^']*)',\s*group:\s*'([^']+)'\s*\}/g;
  let m;
  while ((m = re.exec(block))) {
    out.push({ id: m[1], label: m[2], group: m[3] });
    if (out.length > 200) break;
  }
  return out;
}

/** Which panes draw in 3D, so they get the longer deadline. */
function read3dIds() {
  const src = readFileSync('src/components/DesignPreview/catalog/catalogEntries.ts', 'utf8');
  const ids = new Set();
  const re = /\{\s*id:\s*'([^']+)',[^}]*kind:\s*'3D'/g;
  let m;
  while ((m = re.exec(src))) ids.add(m[1]);
  return ids;
}

async function connect() {
  const chrome = spawn(chromePath(), [
    // GPU stays ON. The Land and Water panes draw through WebGPU, and
    // --disable-gpu leaves their canvas blank forever, which used to look like
    // an application fault rather than a capture setting.
    '--headless=new', '--hide-scrollbars',
    '--enable-unsafe-webgpu', '--use-angle=default',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--window-size=${SHOT_W},${SHOT_H}`,
    // The profile MUST live outside the repo. It first sat in OUT_DIR, which is
    // inside public/ — a folder the dev server watches. Chrome writes to its
    // profile constantly, so every write triggered a reload and the page never
    // reached "complete". Twenty healthy panes were reported broken by this.
    `--user-data-dir=${PROFILE_DIR}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      wsUrl = tabs.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    if (!wsUrl) await sleep(250);
  }
  if (!wsUrl) { chrome.kill(); throw new Error('Chrome never opened its debug port'); }

  const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

  let id = 0;
  const waiting = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  const send = (method, params = {}) => {
    const n = ++id;
    ws.send(JSON.stringify({ id: n, method, params }));
    return new Promise((res, rej) => waiting.set(n, { resolve: res, reject: rej }));
  };
  return { chrome, ws, send };
}

/**
 * Wait until the pane looks finished, or the deadline passes.
 *
 * "Finished" means the document is complete AND, for a 3D pane, a canvas has
 * appeared and has actually painted something. A canvas that exists but is one
 * flat color is the blank-scene failure, so it is reported rather than saved.
 */
/**
 * What the page looks like right now: is it loaded, and where is its biggest
 * canvas?
 *
 * Reading pixels straight off the canvas does NOT work for a 3D pane: a WebGL
 * or WebGPU canvas refuses a 2D context, so any check through `getContext`
 * either fails or has to assume the scene painted. That assumption produced a
 * saved picture of a flat blue rectangle. So this only reports the geometry,
 * and the emptiness test happens on the captured image instead.
 */
const SETTLE_PROBE = `(() => {
  let best = null;
  for (const c of document.querySelectorAll('canvas')) {
    const r = c.getBoundingClientRect();
    const area = r.width * r.height;
    if (r.width > 40 && r.height > 40 && (!best || area > best.area)) {
      best = { x: Math.round(r.x), y: Math.round(r.y),
               w: Math.round(r.width), h: Math.round(r.height), area };
    }
  }
  // A pane that parks itself marks the control that starts it. Reading the
  // marker beats matching button text, which changes without warning.
  const wake = document.querySelector('[data-catalog-wake]');
  return JSON.stringify({
    ready: document.readyState === 'complete',
    canvas: best,
    parked: Boolean(wake),
    text: document.body ? document.body.innerText.length : 0,
  });
})()`;

/** Press the pane's own start control, once. */
const WAKE_CLICK = `(() => {
  const b = document.querySelector('[data-catalog-wake]');
  if (!b) return false;
  b.click();
  return true;
})()`;

/**
 * Is a captured region effectively one flat colour?
 *
 * A PNG of a single colour compresses to almost nothing, while a real scene
 * carries detail. Bytes per pixel separates the two cleanly and needs no image
 * library. Measured on this project: a blank canvas lands near 0.001 and the
 * thinnest real scene near 0.05.
 */
// Measured on this project, sampling the middle of each canvas as PNG:
//   Land, showing an empty blue field ....... 0.019 bytes per pixel
//   Dungeon, showing a real 3D dungeon ...... 0.431 bytes per pixel
// 0.08 sits far from both. When in doubt this errs toward calling a pane
// blank, which shows an honest placeholder instead of a misleading picture.
const FLAT_BYTES_PER_PIXEL = 0.08;

/**
 * The middle of a canvas, which is where a scene shows and where the panes'
 * own overlay panels do not sit.
 *
 * Clipping the WHOLE canvas fooled this check once: the Land pane floats a
 * water-ledger panel over its bottom-left corner, and that panel's text alone
 * carried enough detail to make an entirely blank world look painted.
 */
function centreOf(canvas, viewH = SHOT_H, viewW = SHOT_W) {
  // Clamp to the window. The Combat Scenarios board hangs past the bottom of
  // the window: its canvas ran from y 514 to y 898 inside a 706-tall page. The
  // middle of that canvas is therefore OFF SCREEN, and photographing it
  // returned plain black — so a pane whose board may well be drawing was
  // reported as a blank canvas. Only the part on screen can be judged.
  const top = Math.max(0, canvas.y);
  const bottom = Math.min(viewH, canvas.y + canvas.h);
  const left = Math.max(0, canvas.x);
  const right = Math.min(viewW, canvas.x + canvas.w);
  const visH = bottom - top;
  const visW = right - left;
  if (visH < 40 || visW < 40) return null;   // too little on screen to judge

  const w = Math.max(40, Math.round(visW * 0.5));
  const h = Math.max(40, Math.round(visH * 0.5));
  return {
    x: Math.round(left + (visW - w) / 2),
    y: Math.round(top + (visH - h) / 2),
    width: w,
    height: h,
    scale: 1,
  };
}

function looksBlank(base64, area) {
  if (!area) return false;
  return (base64.length * 0.75) / area < FLAT_BYTES_PER_PIXEL;
}

async function capture({ send }, step, is3d) {
  const url = `http://localhost:${PORT}/Aralia/misc/design.html?step=${step.id}`;
  await send('Page.navigate', { url });

  // `is3d` sets how long to wait, and nothing else.
  //
  // It used to also DEMAND a canvas, which was wrong. A pane can be about 3D
  // and still open on a flat screen: Town opens on its 2D map, Start Point on
  // the world map, Biome on its editor. All three render perfectly, and all
  // three were reported as "no 3D view appeared" while looking fine on screen.
  // What a pane is ABOUT and what it DRAWS ON ARRIVAL are different questions,
  // so the canvas check now follows what the page actually shows.
  const budget = is3d ? (DEADLINE_3D_OVERRIDE ?? DEADLINE_3D_MS) : DEADLINE_2D_MS;
  const deadline = Date.now() + budget;
  let last = null;
  let probeError = null;
  let woke = false;
  let settledFor = 0;
  while (Date.now() < deadline) {
    await sleep(1000);
    try {
      const r = await send('Runtime.evaluate', { expression: SETTLE_PROBE, returnByValue: true });
      last = JSON.parse(r.result.value);
      probeError = null;
    } catch (err) {
      // Keep the reason. A probe that fails EVERY time means the page never
      // gave this script a context to ask in, which is a different fault from
      // a page that loads slowly — and it used to be reported as the latter.
      probeError = String(err.message ?? err).slice(0, 80);
    }
    if (!last || !last.ready || last.text < 40) continue;

    // A parked pane draws nothing until asked. Press its own start control
    // once, then keep waiting for the scene it builds.
    if (last.parked && !woke) {
      try {
        await send('Runtime.evaluate', { expression: WAKE_CLICK, returnByValue: true });
        woke = true;
        continue;
      } catch { /* fall through and photograph what is there */ }
    }

    if (!last.canvas) {
      // No drawing surface. Either the pane is a flat screen, or a scene is
      // still mounting. Give a 3D-titled pane a few more seconds to prove it
      // is the second case before accepting the flat screen as the answer.
      settledFor += 1;
      if (is3d && settledFor < 5) continue;
      break;
    }

    // A canvas on a 2D pane is incidental — a small chart, a decorative
    // surface — and must not decide the pane's fate. Judging every canvas
    // failed Worldforge and the Judge queue, two panes that render perfectly.
    if (!is3d) break;

    // A 3D pane lives or dies by its scene. Photograph the middle of the
    // canvas and see whether anything is actually drawn.
    const box = centreOf(last.canvas);
    if (!box) break;   // barely on screen; judge the whole pane instead
    const probe = await send('Page.captureScreenshot', { format: 'png', clip: box });
    if (!looksBlank(probe.data, box.width * box.height)) break;
  }

  if (!last) return { failed: probeError ? `could not read the page (${probeError})` : 'never answered' };
  if (!last.ready) return { failed: 'never finished loading' };

  if (is3d && last.canvas) {
    const box = centreOf(last.canvas);
    if (box) {
      const probe = await send('Page.captureScreenshot', { format: 'png', clip: box });
      if (looksBlank(probe.data, box.width * box.height)) return { failed: 'blank canvas' };
    }
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = `${step.id}.png`;
  writeFileSync(path.join(OUT_DIR, file), Buffer.from(shot.data, 'base64'));
  return { file, width: SHOT_W, height: SHOT_H };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const steps = readSteps().filter((s) => (only.length ? only.includes(s.id) : true));
  if (steps.length === 0) {
    console.error('No matching step. Ids come from the registry in DesignPreviewPage.tsx.');
    process.exit(1);
  }
  const threeD = read3dIds();

  // Keep what an earlier run captured, so capturing one pane does not wipe the
  // rest of the manifest.
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  const previous = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8')).shots ?? []
    : [];
  const kept = new Map(previous.map((s) => [s.id, s]));

  const conn = await connect();
  await conn.send('Page.enable');
  await conn.send('Runtime.enable');

  let ok = 0;
  let bad = 0;
  for (const step of steps) {
    const is3d = threeD.has(step.id);
    const started = Date.now();
    let result;
    try {
      result = await capture(conn, step, is3d);
    } catch (err) {
      result = { failed: String(err.message ?? err).slice(0, 60) };
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    kept.set(step.id, { id: step.id, capturedAt: new Date().toISOString(), ...result });
    if (result.failed) {
      bad += 1;
      console.log(`FAIL  ${step.id.padEnd(20)} ${seconds}s  ${result.failed}`);
    } else {
      ok += 1;
      console.log(`ok    ${step.id.padEnd(20)} ${seconds}s`);
    }
  }

  writeFileSync(manifestPath, JSON.stringify({
    ranAt: new Date().toISOString(),
    shots: [...kept.values()],
  }, null, 2));

  conn.ws.close();
  conn.chrome.kill();
  console.log(`\n${ok} captured, ${bad} failed. Manifest: ${manifestPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
