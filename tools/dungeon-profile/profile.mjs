/**
 * @file tools/dungeon-profile/profile.mjs
 * Repeatable frame profiler for the procedural 3D dungeon scene.
 *
 * Measures, for a defined "representative low-end" dungeon scenario:
 *   - live per-frame time p50 / p95 / p99 (vsync-bound cadence as the app runs),
 *   - true unthrottled render cost (ms/frame from a synchronous gl.render loop
 *     with a forced GPU finish() — vsync-independent, the number a budget is
 *     judged against),
 *   - draw calls, triangles, lines (three.js WebGLRenderer.info.render),
 *   - instanced-mesh count and total instance count (scene traversal),
 *   - geometries / textures in memory and the active WebGL backend.
 *
 * It drives the real Design Preview dungeon scene through the committed dev hook
 * window.__dungeonProfile (see src/components/BattleMap/dungeon/Dungeon3DPreview.tsx)
 * over a running dev server, so the numbers come from the actual renderer, not a
 * reconstruction.
 *
 * Usage (dev server must already be running on the base URL):
 *   node tools/dungeon-profile/profile.mjs
 *   node tools/dungeon-profile/profile.mjs --base http://127.0.0.1:3000/Aralia/misc/design.html
 *   node tools/dungeon-profile/profile.mjs --headed        # visible window, uses desktop GPU
 *   node tools/dungeon-profile/profile.mjs --out tools/dungeon-profile/results.json
 *
 * The scenario (seed, room count, theme, camera presets) is defined in SCENARIO
 * below and justified in tools/dungeon-profile/BUDGET.md. Writes a JSON results
 * artifact and prints a PASS/FAIL judgment against the committed budget.
 *
 * Exit code: 0 if every measured scenario meets the low-end (30fps) budget on
 * the true render-cost metric, 1 otherwise. Missing dev server / hook = throw.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Budget (justified in BUDGET.md). Two thresholds on the TRUE render-cost metric
// (benchRender ms/frame), which is display-refresh independent:
//   - target 60fps  => 16.7 ms/frame (smooth on a 60Hz low-end laptop),
//   - floor  30fps  => 33.3 ms/frame (playable low-end minimum; PASS/FAIL gate).
// ---------------------------------------------------------------------------
const BUDGET = {
  targetFps: 60,
  targetMs: 1000 / 60,
  floorFps: 30,
  floorMs: 1000 / 30,
};

// ---------------------------------------------------------------------------
// Representative low-end scenario. seed 42 is a large 42-room "mausoleum" crypt
// (144x158 cells, ~604 props). We ALSO push room count to the slider maximum (80)
// to profile the heavy tail a real dungeon can reach. Both the whole-level
// tactical camera and a close "objective" camera (which restores every prop) are
// measured, because frustum culling is disabled so instance submission is
// camera-independent while prop-visibility filtering is not.
// ---------------------------------------------------------------------------
const SCENARIO = {
  seed: 42,
  theme: 'crypt',
  liveCaptureMs: 5000, // sample ~5s of live frames for a stable cadence p50/p95
  benchIterations: 240, // synchronous render iterations for true render cost
  variants: [
    { id: 'default-tactical', rooms: null, preset: 'tactical' },
    { id: 'default-objective', rooms: null, preset: 'objective' },
    { id: 'stress80-tactical', rooms: 80, preset: 'tactical' },
    { id: 'stress80-objective', rooms: 80, preset: 'objective' },
  ],
};

function parseArgs(argv) {
  const opts = {
    base: 'http://127.0.0.1:3000/Aralia/misc/design.html',
    out: path.join(__dirname, 'results.json'),
    headed: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--base') opts.base = argv[++i];
    else if (a === '--out') opts.out = path.resolve(REPO_ROOT, argv[++i]);
    else if (a === '--headed') opts.headed = true;
    else if (a === '--software') opts.software = true;
    else if (a === '--help') { opts.help = true; }
  }
  return opts;
}

async function waitForReady(page, timeoutMs = 20000) {
  await page.waitForFunction(() => window.__dungeon3dReady === true && !!window.__dungeonProfile, null, {
    timeout: timeoutMs,
    polling: 100,
  });
}

async function setRooms(page, rooms) {
  if (rooms == null) return;
  // The Rooms slider is the only range input with min=8 max=80. Set its value via
  // the native setter and dispatch a React-visible input event, then wait for the
  // scene to rebuild and re-signal readiness.
  await page.evaluate(() => { window.__dungeon3dReady = false; });
  const set = await page.evaluate((target) => {
    const inputs = [...document.querySelectorAll('input[type="range"]')];
    const el = inputs.find((i) => i.min === '8' && i.max === '80');
    if (!el) return false;
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, String(target));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, rooms);
  if (!set) throw new Error('Could not locate the Rooms slider (min=8 max=80)');
  await waitForReady(page);
}

async function setPreset(page, preset) {
  const clicked = await page.evaluate((p) => {
    const btn = document.querySelector(`[data-testid="dungeon-camera-${p}"]`);
    if (!btn) return false;
    btn.click();
    return true;
  }, preset);
  if (!clicked) throw new Error(`Camera preset button not found: ${preset}`);
  // Let the camera settle (MapControls damping) before measuring.
  await page.waitForTimeout(600);
}

async function measure(page, liveMs, benchIters) {
  // Live cadence capture.
  await page.evaluate(() => window.__dungeonProfile.start());
  await page.waitForTimeout(liveMs);
  const live = await page.evaluate(() => window.__dungeonProfile.stop());
  // True render cost (unthrottled, GPU-synced).
  const bench = await page.evaluate((iters) => window.__dungeonProfile.benchRender(iters, 4000), benchIters);
  return { live, bench };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('Usage: node tools/dungeon-profile/profile.mjs [--base URL] [--out FILE] [--headed] [--software]');
    return;
  }
  // Keep the software (low-end floor) run in its own artifact so it never clobbers
  // the GPU baseline unless an explicit --out is given.
  if (opts.software && opts.out === path.join(__dirname, 'results.json')) {
    opts.out = path.join(__dirname, 'results-software.json');
  }

  // --software forces the SwiftShader CPU rasterizer: a genuine no-GPU / low-end
  // floor (an office laptop with a blocklisted or absent GPU falls back to exactly
  // this path). Default uses the machine's real GPU via ANGLE/D3D11.
  const gpuArgs = ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu'];
  const softwareArgs = ['--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu'];
  const browser = await chromium.launch({
    headless: !opts.headed,
    args: opts.software ? softwareArgs : gpuArgs,
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));

  const results = [];
  try {
    // Navigate ONCE. Re-navigating the busy R3F page stalls the load lifecycle, so
    // every variant is driven in-page by changing the Rooms slider and camera
    // preset. Variants are ordered defaults-first so room count only ever rises
    // (there is no need to return the slider to its 42-room default without a
    // reload). setRooms(null) is a no-op that keeps the current slider value.
    const url = `${opts.base}?step=dungeon&dseed=${SCENARIO.seed}&dtheme=${SCENARIO.theme}`;
    await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
    await waitForReady(page, 45000);

    for (const variant of SCENARIO.variants) {
      await setRooms(page, variant.rooms);
      await setPreset(page, variant.preset);

      const scene = await page.evaluate(() => JSON.parse(window.render_game_to_text()).dungeon);
      const { live, bench } = await measure(page, SCENARIO.liveCaptureMs, SCENARIO.benchIterations);

      const passFloor = bench.msPerFrame <= BUDGET.floorMs;
      const passTarget = bench.msPerFrame <= BUDGET.targetMs;
      results.push({
        id: variant.id,
        rooms: variant.rooms ?? 'default(42)',
        preset: variant.preset,
        scene: scene ? {
          seed: scene.seed, archetype: scene.archetype, theme: scene.theme,
          rooms: scene.rooms, sizeCells: scene.sizeCells, props: scene.props, encounters: scene.encounters,
        } : null,
        live: {
          frames: live.frames,
          p50Ms: round(live.p50), p95Ms: round(live.p95), p99Ms: round(live.p99),
          minMs: round(live.min), maxMs: round(live.max), meanMs: round(live.mean),
        },
        trueRenderCost: {
          msPerFrame: round(bench.msPerFrame),
          fps: round(1000 / bench.msPerFrame),
          iterations: bench.iterations,
        },
        drawCalls: live.render.calls,
        triangles: live.render.triangles,
        lines: live.render.lines,
        instancedMeshes: live.instances.instancedMeshes,
        totalInstances: live.instances.totalInstances,
        plainMeshes: live.instances.meshes,
        lineSegmentObjects: live.instances.lineSegments,
        programs: live.programs,
        geometries: live.memory.geometries,
        textures: live.memory.textures,
        verdict: {
          budgetFloorMs: round(BUDGET.floorMs),
          budgetTargetMs: round(BUDGET.targetMs),
          meetsFloor30fps: passFloor,
          meetsTarget60fps: passTarget,
        },
      });
      console.log(
        `[${variant.id}] rooms=${variant.rooms ?? 42} preset=${variant.preset} ` +
        `render=${round(bench.msPerFrame)}ms (${round(1000 / bench.msPerFrame)}fps) ` +
        `p50=${round(live.p50)}ms p95=${round(live.p95)}ms ` +
        `calls=${live.render.calls} tris=${live.render.triangles} instances=${live.instances.totalInstances} ` +
        `=> ${passFloor ? 'PASS' : 'FAIL'} floor, ${passTarget ? 'PASS' : 'FAIL'} target`,
      );
    }

    const backend = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="dungeon-3d-preview"] canvas');
      const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
      if (!gl) return { renderer: 'unknown', vendor: 'unknown' };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      };
    });

    const worstRender = Math.max(...results.map((r) => r.trueRenderCost.msPerFrame));
    const overallPassFloor = results.every((r) => r.verdict.meetsFloor30fps);
    const overallPassTarget = results.every((r) => r.verdict.meetsTarget60fps);

    const artifact = {
      generatedAt: new Date().toISOString(),
      tool: 'tools/dungeon-profile/profile.mjs',
      mode: opts.software ? 'software (SwiftShader, forced low-end floor)' : 'gpu (machine GPU via ANGLE/D3D11)',
      base: opts.base,
      webglBackend: backend,
      note: 'Numbers are from the machine that ran this harness. Re-run on the target device for device-specific verdicts. trueRenderCost is the budget-judged metric (vsync-independent); live p50/p95 is the display-refresh-bound cadence as the app actually runs.',
      budget: {
        rationale: 'See tools/dungeon-profile/BUDGET.md',
        targetFps: BUDGET.targetFps, targetMs: round(BUDGET.targetMs),
        floorFps: BUDGET.floorFps, floorMs: round(BUDGET.floorMs),
      },
      scenario: { seed: SCENARIO.seed, theme: SCENARIO.theme, liveCaptureMs: SCENARIO.liveCaptureMs, benchIterations: SCENARIO.benchIterations },
      summary: {
        worstCaseRenderMs: round(worstRender),
        worstCaseFps: round(1000 / worstRender),
        meetsFloor30fps: overallPassFloor,
        meetsTarget60fps: overallPassTarget,
      },
      variants: results,
    };

    mkdirSync(path.dirname(opts.out), { recursive: true });
    writeFileSync(opts.out, JSON.stringify(artifact, null, 2));
    console.log(`\nBackend: ${backend.vendor} / ${backend.renderer}`);
    console.log(`Worst-case true render cost: ${round(worstRender)}ms (${round(1000 / worstRender)}fps)`);
    console.log(`Overall: ${overallPassFloor ? 'PASS' : 'FAIL'} 30fps floor, ${overallPassTarget ? 'PASS' : 'FAIL'} 60fps target`);
    console.log(`Wrote ${path.relative(REPO_ROOT, opts.out)}`);

    process.exitCode = overallPassFloor ? 0 : 1;
  } finally {
    await browser.close();
  }
}

function round(n) {
  return n == null ? null : Math.round(n * 100) / 100;
}

main().catch((e) => { console.error(e); process.exit(1); });
