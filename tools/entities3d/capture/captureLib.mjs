/**
 * captureLib.mjs — the shared headless-capture rig for entity 3D surfaces.
 *
 * WHY THIS FILE IS VERSIONED. The four rigs beside it (`aim-shot`, `url-shot`,
 * `partlab-shots`, `wave-gif`) caught every 3D regression of the 2026-08/09
 * campaign while living in `.agent/scratch/part-quality/` — a gitignored folder
 * that no clone, no new agent, and no CI ever saw. They are QA tools, not
 * proof exhaust, so they live in `tools/` and the conventions they depend on
 * are written down HERE rather than rediscovered once per agent.
 *
 * 10. BLACK FIRST FRAME AFTER HMR (WF-G135). Capture through `grabLitCanvasPng`,
 *    which retries across frames until `inkFraction` clears a floor and throws
 *    when it never does. `N8AO intensity={0}` renders black; it is not a control.
 *
 * ---------------------------------------------------------------------------
 * CONVENTIONS. Each one is a trap that produced a CONVINCING WRONG RESULT
 * (a black PNG, a stale frame, a silently reloaded page) rather than an error.
 * ---------------------------------------------------------------------------
 *
 * 1. HEADLESS CHROME, GPU ARGS REMOVED.
 *      chromium.launch({ channel: 'chrome', headless: true,
 *        ignoreDefaultArgs: ['--disable-gpu', '--disable-software-rasterizer'] })
 *    Playwright's own bundled Chromium and headed Chrome both fail here: headed
 *    Chrome hands back black frames under automation on this host, and letting
 *    Playwright keep `--disable-gpu` drops the page onto SwiftShader, which
 *    renders black for these scenes and offers no WebGPU adapter at all.
 *    Removing the two default args is what gets a real GL/WebGPU context.
 *
 * 2. preserveDrawingBuffer VIA addInitScript, NOT VIA THE SCENE COMPONENT.
 *    R3F creates its canvas without `preserveDrawingBuffer`, so the backbuffer
 *    is undefined after the compositor swaps: `canvas.toDataURL()` and
 *    Playwright's element screenshot both come back blank/black. The scene
 *    components are shared and frequently locked by other agents, so the flag
 *    is forced at `getContext` time by an init script instead of edited into
 *    the component. See `.agent/scratch/agora-783b/capture-ab.mjs` for the
 *    original A/B that proved this.
 *
 * 3. READ PIXELS WITH canvas.toDataURL() AFTER AN EXPLICIT renderer.render().
 *    NEVER `page.screenshot()` / `locator.screenshot()` on an animating R3F
 *    scene. The element screenshot path captures a compositor surface that may
 *    be a frame or more stale, and on an animating scene it regularly returns
 *    the clear color. Render on demand through the page's own renderer handle
 *    (`__partlab.gl.render(scene, camera)`), then read the canvas in the SAME
 *    task, before the next rAF swaps the buffer.
 *
 * 4. NAVIGATION: waitUntil: 'commit' + an explicit selector wait + 180 s.
 *    These pages pull large GLBs and lazily compile shaders; `load` and even
 *    `domcontentloaded` either time out or resolve long before anything is
 *    drawable. Commit as soon as the navigation is real, then wait on the
 *    thing you actually need (the canvas, then the page's hook object).
 *
 * 5. ASSERT LIVENESS BEFORE CAPTURING.
 *    The shared Vite dev server hot-reloads while a rig is running. An HMR
 *    reload tears down the hook, and the rig then photographs whatever it can
 *    still find — usually a half-mounted scene. Every capture stamps a nonce on
 *    `window` before the settle and re-checks it after; a missing nonce means
 *    the page reloaded underneath us, and the shot is retried rather than kept.
 *
 * 6. R3F 9 STILL KEEPS `__r3f` ON THREE OBJECTS.
 *    When a surface exposes only a THREE object (the world scene publishes
 *    `window.__wf3dScene`), the rest of the store is reachable through it:
 *      window.__wf3dScene.__r3f.root.getState()  // → { gl, camera, scene, ... }
 *    Prefer a purpose-built hook when the surface has one; use this when it
 *    does not, rather than editing a locked component to add one.
 *
 * 7. HOSTS AND QUERY FLAGS.
 *    - Use `127.0.0.1`, never `localhost`. On this host `localhost` resolves to
 *      ::1 first and Vite binds v4, so `localhost` intermittently costs a
 *      multi-second connect retry or fails outright.
 *    - Part Lab camera aiming needs `&turn=1`. The turntable component is what
 *      publishes `window.__partlab.controls`; without it the handle has a
 *      camera but no controls, and drei re-aims the camera at `controls.target`
 *      every frame, so a bare `camera.lookAt` is silently reverted.
 *    - World captures: `dcell=785` is a forest window; `gx=7&gy=8` is a town.
 *
 * 8. PROOF IMAGES ARE THROWAWAY. Write PNG/GIF output under `.agent/scratch/`
 *    (gitignored) unless the image is a tracked catalog asset. Confirm a new
 *    output path with `git check-ignore <path>` before writing there.
 *
 * ---------------------------------------------------------------------------
 * The dev server must ALREADY be running; nothing here starts one. Override the
 * origin with CAPTURE_BASE (full page URL) or CAPTURE_ORIGIN (scheme://host:port).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Repo-local default. This is the ONE line that legitimately differs between
 * the Aralia and Entity-Generator copies of this directory: Aralia serves the
 * design preview under /Aralia/misc/design.html on :5174, Entity Studio serves
 * the same steps from its root document on :5173.
 */
export const DEFAULT_ORIGIN = 'http://127.0.0.1:5174';
export const DEFAULT_PAGE = '/Aralia/misc/design.html';

/**
 * Contract version for `window.__partlab` (agora-8c1c). Must match
 * `PARTLAB_API_VERSION` in `src/components/DesignPreview/steps/PartLabScene.tsx`
 * and the version note in `docs/architecture/domains/part-lab-capture-api.md`.
 * `gotoScene` asserts it once the page's `__partlab` hook resolves truthy, so a
 * drifted contract fails loud (a rig reading a field that no longer exists) at
 * the capture step rather than downstream in a metric or a black PNG.
 */
export const PARTLAB_API_VERSION = '1.0.0';

/** System Chrome. Playwright's bundled Chromium lacks the GPU stack we need. */
export const CHROME = process.env.CAPTURE_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Base page URL, without a query string.
 * CAPTURE_BASE wins outright; otherwise CAPTURE_ORIGIN + the repo's page path.
 */
export function baseUrl() {
  if (process.env.CAPTURE_BASE) return process.env.CAPTURE_BASE.replace(/\?.*$/, '');
  const origin = (process.env.CAPTURE_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '');
  return origin + DEFAULT_PAGE;
}

/** `localhost` → `127.0.0.1` (convention 7). Applied to every URL a rig is handed. */
export function normalizeUrl(url) {
  return String(url).replace('://localhost', '://127.0.0.1');
}

/**
 * Launch headless system Chrome with the GPU args stripped (convention 1) and a
 * context whose canvases always preserve their drawing buffer (convention 2).
 * Returns { browser, context } — close the browser in a `finally`.
 */
export async function launchCaptureBrowser({ width = 1100, height = 900 } = {}) {
  const browser = await chromium.launch({
    channel: 'chrome',
    executablePath: CHROME,
    headless: true,
    // Convention 1: without this the page lands on SwiftShader and renders black.
    ignoreDefaultArgs: ['--disable-gpu', '--disable-software-rasterizer'],
  });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  // Convention 2: force preserveDrawingBuffer at getContext time, so we never
  // have to edit the (shared, often locked) R3F scene components to read pixels.
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patched(type, attrs) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') {
        attrs = Object.assign({}, attrs, { preserveDrawingBuffer: true });
      }
      return original.call(this, type, attrs);
    };
  });
  return { browser, context };
}

/**
 * Open a page and collect its errors. Console errors and pageerrors both land in
 * the returned array; a rig that captures a black frame should print them,
 * because a shader compile failure looks exactly like a framing bug in a PNG.
 */
export async function newCapturePage(context) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  return { page, errors };
}

/**
 * Navigate and wait for the surface to be REAL (convention 4). `waitFor` is the
 * selector that proves it (default `canvas`; pass `svg` or a data-testid for a
 * DOM step).
 * `hook` is a JS expression evaluated in the page; it must become truthy before
 * we consider the scene mounted (e.g. 'window.__partlab && window.__partlab.gl').
 */
export async function gotoScene(page, url, { hook = 'window.__partlab', settleMs = 2500, timeout = 180000, waitFor = 'canvas' } = {}) {
  await page.goto(normalizeUrl(url), { waitUntil: 'commit', timeout });
  // GG-221 (2026-09-09): a DOM/SVG design-preview step never mounts a canvas
  // (startselect is an SVG atlas), so `waitFor` names the selector that means
  // "the surface is real" for that step; the default keeps every 3D rig as is.
  await page.waitForSelector(waitFor, { timeout });
  if (hook) await page.waitForFunction(hook, null, { timeout });
  // Convention 9 (agora-8c1c): if the hook is (or includes) __partlab, assert
  // the page's contract version matches what this rig was written against —
  // a silent field drift should fail here, not as a mysterious black PNG or
  // a metric reading `undefined` three call stacks downstream.
  if (hook && String(hook).includes('__partlab')) await assertPartLabApiVersion(page);
  await sleep(settleMs);
  return stampLiveness(page);
}

/**
 * Throws if `window.__partlab.apiVersion` is missing or does not match
 * `PARTLAB_API_VERSION`. Skips silently when `__partlab` itself is absent
 * (some surfaces publish only `window.__wf3dScene`, convention 6).
 */
export async function assertPartLabApiVersion(page, expected = PARTLAB_API_VERSION) {
  const seen = await page.evaluate(() => window.__partlab?.apiVersion ?? null);
  if (seen === null) return;
  if (seen !== expected) {
    throw new Error(`__partlab.apiVersion mismatch: page has "${seen}", this rig expects "${expected}" — ` +
      'see docs/architecture/domains/part-lab-capture-api.md');
  }
}

/**
 * Convention 5. Stamp a nonce on `window`; `assertLive` fails if it is gone,
 * which is exactly what an HMR reload during the settle looks like.
 */
export async function stampLiveness(page) {
  const nonce = 'cap' + Math.random().toString(36).slice(2);
  await page.evaluate((n) => { window.__captureNonce = n; }, nonce);
  return nonce;
}

export async function assertLive(page, nonce) {
  const seen = await page.evaluate(() => window.__captureNonce ?? null);
  if (seen !== nonce) {
    throw new Error(`page reloaded mid-capture (HMR?): nonce ${seen ?? 'gone'} != ${nonce}`);
  }
}

/**
 * Convention 3. Render on demand through the page's own renderer, then read the
 * canvas back in the SAME task. Returns a PNG Buffer.
 *
 * `handle` names the window object carrying { gl, scene, camera }; the Part Lab
 * publishes `__partlab`. When a surface publishes only a THREE scene, pass
 * `handle: null` and `r3fFrom: 'window.__wf3dScene'` to go through `__r3f`
 * (convention 6).
 */
export async function grabCanvasPng(page, { handle = '__partlab', r3fFrom = null } = {}) {
  const dataUrl = await page.evaluate(([handleName, r3fExpr]) => {
    let state = handleName ? window[handleName] : null;
    if (!state && r3fExpr) {
      // Convention 6: R3F 9 keeps its store on the THREE object as `__r3f`.
      const obj = new Function('return ' + r3fExpr)();
      state = obj?.__r3f?.root?.getState?.() ?? null;
    }
    if (!state) throw new Error('no renderer handle (' + (handleName || r3fExpr) + ')');
    const { gl, scene, camera } = state;
    if (!gl || !scene || !camera) throw new Error('renderer handle is missing gl/scene/camera');
    gl.render(scene, camera);
    const canvas = gl.domElement ?? document.querySelector('canvas');
    // Same task as the render: the next rAF swaps this buffer away.
    return canvas.toDataURL('image/png');
  }, [handle, r3fFrom]);
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

/**
 * Convention 10 (WF-G135). The FIRST frame after a Vite HMR edit is often a
 * null canvas or an all-black buffer, and a rig that captures it reports a
 * rendering regression that does not exist (agora-75ed.1 nearly did, twice).
 * This wrapper measures ink first and captures only a lit frame, retrying
 * across animation frames; it throws, with the ink numbers, when the surface
 * stays dark, so a real black-frame regression is still an error and not a
 * silent retry loop. `minInk` is the `inkFraction` floor (default 0.2 %).
 * Note: `N8AO intensity={0}` renders the whole frame black and is NOT a valid
 * AO control for an A/B; compare against the pass removed instead.
 */
export async function grabLitCanvasPng(page, {
  handle = '__partlab', r3fFrom = null, minInk = 0.002, retries = 5, waitMs = 250,
} = {}) {
  const seen = [];
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ink = await inkFraction(page, { handle, r3fFrom });
    seen.push(Number(ink.toFixed(4)));
    if (ink >= minInk) return { png: await grabCanvasPng(page, { handle, r3fFrom }), ink, attempts: attempt + 1 };
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    await sleep(waitMs);
  }
  throw new Error(`canvas stayed dark after ${retries + 1} frames (ink ${seen.join(', ')} < ${minInk}); a black frame is a regression, not a capture artifact, once it persists`);
}

/** Write a PNG buffer, creating the directory. Keep outputs under .agent/scratch/. */
export function writePng(file, buffer) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, buffer);
  return file;
}

/**
 * Rough ink coverage: the fraction of sampled pixels that differ from the
 * top-left pixel (the studio background). A capture that renders nothing comes
 * back near 0, which is how a black-frame regression is caught by a NUMBER
 * instead of by somebody opening the PNG.
 */
export async function inkFraction(page, { handle = '__partlab', r3fFrom = null } = {}) {
  return page.evaluate(([handleName, r3fExpr]) => {
    let state = handleName ? window[handleName] : null;
    if (!state && r3fExpr) {
      const obj = new Function('return ' + r3fExpr)();
      state = obj?.__r3f?.root?.getState?.() ?? null;
    }
    const gl = state?.gl;
    if (gl && state.scene && state.camera) gl.render(state.scene, state.camera);
    const cv = gl?.domElement ?? document.querySelector('canvas');
    if (!cv) return 0;
    const off = document.createElement('canvas');
    off.width = cv.width; off.height = cv.height;
    const ctx = off.getContext('2d');
    ctx.drawImage(cv, 0, 0);
    const { data } = ctx.getImageData(0, 0, off.width, off.height);
    const bg = [data[0], data[1], data[2]];
    let ink = 0, n = 0;
    for (let y = 0; y < off.height; y += 2) {
      for (let x = 0; x < off.width; x += 2) {
        const i = (y * off.width + x) * 4;
        const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
        n++;
        if (d > 24) ink++;
      }
    }
    return n ? ink / n : 0;
  }, [handle, r3fFrom]);
}

/**
 * Aim the Part Lab camera. `target` is either three numbers or a BONE NAME
 * (e.g. 'handR' — see tools/entities3d/bipedBoneSpec.json), and `offset` is the
 * camera position relative to it. Requires `&turn=1` on the URL (convention 7):
 * the turntable is what publishes `__partlab.controls`, and drei re-aims the
 * camera at `controls.target` every frame, so setting the target is the only
 * aim that survives.
 */
export async function aimPartLab(page, target, offset) {
  return page.evaluate(([target, offset]) => {
    const lab = window.__partlab;
    if (!lab || !lab.controls || !lab.camera) {
      throw new Error('no __partlab.controls — add &turn=1 to the URL');
    }
    let t = { x: Number(target[0]), y: Number(target[1]), z: Number(target[2]) };
    let resolved = 'xyz';
    if (Number.isNaN(t.x)) {
      const name = String(target[0]);
      let bone = null;
      lab.scene.traverse((o) => { if (!bone && o.isBone && o.name === name) bone = o; });
      if (!bone) throw new Error('no bone named ' + name);
      const v = new bone.position.constructor();
      bone.getWorldPosition(v);
      t = { x: v.x, y: v.y, z: v.z };
      resolved = 'bone:' + name;
    }
    lab.controls.autoRotate = false;
    lab.controls.target.set(t.x, t.y, t.z);
    lab.camera.position.set(t.x + Number(offset[0]), t.y + Number(offset[1]), t.z + Number(offset[2]));
    lab.controls.update();
    return { resolved, target: t };
  }, [target, offset]);
}

/** Hide chrome so only the canvas is visible — for the element-screenshot fallback. */
export async function isolateCanvas(page) {
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.textContent = '*{visibility:hidden!important} canvas{visibility:visible!important}';
    document.head.appendChild(s);
  });
}
