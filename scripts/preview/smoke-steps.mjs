/**
 * smoke-steps.mjs — open every Design Preview step and record what it logged.
 *
 * WHAT THIS ANSWERS, that `capture-catalog.mjs` beside it does not: the catalog
 * driver photographs a pane and calls it broken only when it fails to settle in
 * time. A pane can settle, look plausible in a PNG, and still be throwing on
 * every render. This rig opens each `?step=<id>` on its OWN page, keeps the
 * console and `pageerror` streams for that page alone, and checks the two
 * things a screenshot cannot show:
 *
 *   1. did the step ROUTE — the workbench breadcrumb reads
 *      "Workbench / <label>", so a step that silently fell back to Land (the
 *      registry's fallback) is caught by a NAME rather than by a reader
 *      recognizing the wrong picture;
 *   2. did it log an error while mounting.
 *
 * WHY A FRESH PAGE PER STEP. One page navigated 61 times accumulates errors
 * from every previous step, and React error boundaries from a dead pane survive
 * the next mount. A new page costs about a second and makes the per-step
 * attribution honest.
 *
 * NOISE. Some console errors are facts about the harness, not about the pane:
 * the dev server's HMR socket, Google Fonts blocked in headless, absent local
 * model/AI services. Those are recorded but classified `env`, so the summary
 * counts only errors a step actually owns. Nothing is dropped from the JSON.
 *
 * The dev server must ALREADY be running; nothing here starts one (AGENTS.md
 * forbids a second one). Reuses tools/entities3d/capture/captureLib.mjs for the
 * browser: it carries the headless-Chrome flags and the preserveDrawingBuffer
 * shim that keep 3D panes from rendering black. Never `page.screenshot()` on an
 * animating R3F scene — see convention 3 in that file's header.
 *
 *   node scripts/preview/smoke-steps.mjs                 # every step
 *   node scripts/preview/smoke-steps.mjs dungeon land     # only these
 *   node scripts/preview/smoke-steps.mjs --out <dir>      # report directory
 *   node scripts/preview/smoke-steps.mjs --shots          # + a PNG per step
 *
 * Report (JSON + a readable summary) lands under `.agent/scratch/` by default,
 * which is gitignored; keep it that way (AGENTS.md: throwaway proof only).
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { launchCaptureBrowser, newCapturePage, normalizeUrl, baseUrl, sleep } from '../../tools/entities3d/capture/captureLib.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '../..');

const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const OUT_DIR = outArg >= 0 ? path.resolve(args[outArg + 1]) : path.join(REPO, '.agent/scratch/viz4-preview-smoke');
const WANT_SHOTS = args.includes('--shots');
const only = args.filter((a, i) => !a.startsWith('--') && !(outArg >= 0 && i === outArg + 1));

/** Settle budget per pane. A 2D pane mounts in a second; a 3D pane builds a world. */
const SETTLE_2D_MS = 3_000;
const SETTLE_3D_MS = 9_000;
/** Hard wall-clock cap for one step, so a hung pane cannot stall the sweep. */
const STEP_TIMEOUT_MS = 90_000;

/**
 * Console errors that describe the HARNESS, not the pane.
 *
 * Each entry earned its place by appearing on many unrelated steps at once,
 * which is the signature of an environment fact rather than a pane defect:
 * headless Chrome has no network access to Google Fonts, the dev server's HMR
 * socket reconnects, and the local model/tts services are simply not running.
 */
const ENV_PATTERNS = [
  /fonts\.googleapis\.com|fonts\.gstatic\.com/i,
  /\[vite\] (?:connect|server connection lost|failed to connect)/i,
  /WebSocket connection to 'ws:\/\/[^']*(?:5174|__vite|hmr)/i,
  /net::ERR_(?:CONNECTION_REFUSED|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|BLOCKED_BY_CLIENT)/i,
  /127\.0\.0\.1:(?:11434|7860|5001|8188)/,          // ollama / a1111 / comfy, not running headless
  /Failed to load resource.*favicon/i,
];

const classify = (text) => (ENV_PATTERNS.some((re) => re.test(text)) ? 'env' : 'step');

/** Read the step list straight from the registry, so it can never drift. */
function readSteps() {
  const src = readFileSync(path.join(REPO, 'src/components/DesignPreview/DesignPreviewPage.tsx'), 'utf8');
  const block = src.slice(src.indexOf('export const steps: PreviewStep[] = ['));
  const out = [];
  const re = /\{\s*id:\s*'([^']+)',\s*label:\s*'([^']*)',\s*group:\s*'([^']+)'\s*\}/g;
  let m;
  while ((m = re.exec(block)) && out.length < 300) out.push({ id: m[1], label: m[2], group: m[3] });
  return out;
}

/**
 * Retired addresses and the step that absorbed each one.
 *
 * These are the other half of "navigation works": a saved link to `?step=volume`
 * must still land on Land. An alias that stops resolving does not error — it
 * falls through to the registry fallback, which IS Land, so three of these
 * would pass by accident. The check compares against the alias's own declared
 * target, so a chain that resolves one hop and lands nowhere is still caught.
 */
function readAliases() {
  const src = readFileSync(path.join(REPO, 'src/components/DesignPreview/DesignPreviewPage.tsx'), 'utf8');
  const block = src.slice(src.indexOf('export const MERGED_STEPS'));
  const body = block.slice(0, block.indexOf('};'));
  const out = [];
  const re = /^\s*'?([A-Za-z0-9_]+)'?:\s*'([^']+)',/gm;
  let m;
  while ((m = re.exec(body))) out.push({ from: m[1], to: m[2] });
  return out;
}

/** Which panes draw in 3D, so they get the longer settle. */
function read3dIds() {
  const src = readFileSync(path.join(REPO, 'src/components/DesignPreview/catalog/catalogEntries.ts'), 'utf8');
  const ids = new Set();
  const re = /\{\s*id:\s*'([^']+)',[^}]*kind:\s*'3D'/g;
  let m;
  while ((m = re.exec(src))) ids.add(m[1]);
  return ids;
}

/** Open one step on its own page and report what it did. */
async function visit(context, step, is3d) {
  const { page, errors } = await newCapturePage(context);
  // Chrome's console text for a failed subresource is only "Failed to load
  // resource: ... 404", with no URL — useless for a fix. Watch the response
  // stream too, so a 404 arrives with the address that produced it.
  const badResponses = [];
  page.on('response', (res) => {
    if (res.status() >= 400) badResponses.push(`HTTP ${res.status()} ${res.url()}`);
  });
  page.on('requestfailed', (req) => {
    badResponses.push(`REQUESTFAILED ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`);
  });
  const started = Date.now();
  const record = {
    id: step.id,
    label: step.label,
    group: step.group,
    kind: is3d ? '3D' : '2D',
    routed: null,
    breadcrumb: null,
    hasCanvas: false,
    ms: 0,
    fatal: null,
    errors: [],
    badResponses: [],
  };
  try {
    const url = normalizeUrl(`${baseUrl()}?step=${encodeURIComponent(step.id)}`);
    await page.goto(url, { waitUntil: 'commit', timeout: STEP_TIMEOUT_MS });
    // The workbench chrome is what proves the app mounted at all; the pane's
    // own content may legitimately still be loading behind a Suspense fallback.
    await page.waitForSelector('h1', { timeout: STEP_TIMEOUT_MS });
    await sleep(is3d ? SETTLE_3D_MS : SETTLE_2D_MS);

    record.breadcrumb = await page.evaluate(() => {
      // The breadcrumb is `Workbench / {label}` in JSX, which React renders as
      // TWO text nodes, so match on "no element children" rather than a node
      // count — an earlier count-of-1 test silently found nothing and reported
      // every step as misrouted.
      const el = Array.from(document.querySelectorAll('div'))
        .find((d) => d.children.length === 0 && /^Workbench \//.test((d.textContent || '').trim()));
      return el ? el.textContent.trim() : null;
    });
    // A step that fell back to Land keeps its requested address (the workbench
    // rewrites ?step= to what it ACTUALLY opened), so the breadcrumb label is
    // the only honest witness that routing worked.
    record.routed = record.breadcrumb === `Workbench / ${step.label}`;
    record.hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));

    if (WANT_SHOTS && !is3d) {
      // 2D only. A page screenshot of an animating R3F scene captures a stale
      // compositor surface (captureLib convention 3), so 3D panes are skipped
      // here rather than photographed dishonestly.
      const png = await page.screenshot({ fullPage: false });
      mkdirSync(path.join(OUT_DIR, 'shots'), { recursive: true });
      writeFileSync(path.join(OUT_DIR, 'shots', `${step.id}.png`), png);
    }
  } catch (e) {
    record.fatal = String(e && e.message ? e.message : e).slice(0, 400);
  } finally {
    record.ms = Date.now() - started;
    record.errors = errors.map((text) => ({ kind: classify(text), text }));
    record.badResponses = badResponses.map((text) => ({ kind: classify(text), text }));
    await page.close().catch(() => {});
  }
  return record;
}

async function main() {
  const all = readSteps();
  if (all.length === 0) throw new Error('No steps parsed from DesignPreviewPage.tsx — the registry shape changed.');
  const threeD = read3dIds();
  const steps = only.length ? all.filter((s) => only.includes(s.id)) : all;
  if (steps.length === 0) {
    console.error(`No matching step. Known ids: ${all.map((s) => s.id).join(', ')}`);
    process.exit(2);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const { browser, context } = await launchCaptureBrowser({ width: 1600, height: 1000 });
  const results = [];
  const aliasResults = [];
  try {
    for (const step of steps) {
      const rec = await visit(context, step, threeD.has(step.id));
      results.push(rec);
      const own = rec.errors.filter((e) => e.kind === 'step').length;
      const flag = rec.fatal ? 'FATAL' : (!rec.routed ? 'ROUTE' : (own ? 'ERR  ' : 'ok   '));
      console.log(`${flag} ${rec.id.padEnd(20)} ${String(Math.round(rec.ms / 1000)).padStart(3)}s  own=${own} env=${rec.errors.length - own}${rec.fatal ? '  ' + rec.fatal.slice(0, 120) : ''}`);
    }
    // Retired addresses, checked only on a full sweep — on a filtered run the
    // caller asked about specific steps, not about the alias table.
    if (!only.length) {
      for (const alias of readAliases()) {
        const target = all.find((s) => s.id === alias.to);
        const rec = await visit(context, { id: alias.from, label: target?.label ?? '?', group: target?.group ?? '?' }, threeD.has(alias.to));
        rec.alias = alias;
        aliasResults.push(rec);
        console.log(`${rec.routed ? 'ok   ' : 'ALIAS'} ${(alias.from + '→' + alias.to).padEnd(20)} ${String(Math.round(rec.ms / 1000)).padStart(3)}s  ${rec.breadcrumb ?? '(no breadcrumb)'}`);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const jsonPath = path.join(OUT_DIR, 'smoke-results.json');
  writeFileSync(jsonPath, JSON.stringify({ ranAt: new Date().toISOString(), base: baseUrl(), results, aliasResults }, null, 2));

  // A ranked summary: the same error text on many steps is one defect, not many.
  const byText = new Map();
  for (const r of results) {
    for (const e of r.errors) {
      if (e.kind !== 'step') continue;
      const key = e.text.replace(/\d+/g, '#').slice(0, 200);
      const hit = byText.get(key) || { count: 0, steps: new Set(), sample: e.text };
      hit.count += 1;
      hit.steps.add(r.id);
      byText.set(key, hit);
    }
  }
  const ranked = [...byText.values()].sort((a, b) => b.steps.size - a.steps.size);
  const lines = [
    `Design Preview step smoke — ${results.length} steps, ${new Date().toISOString()}`,
    `base: ${baseUrl()}`,
    '',
    `fatal: ${results.filter((r) => r.fatal).length}`,
    `misrouted: ${results.filter((r) => !r.fatal && !r.routed).map((r) => `${r.id}(${r.breadcrumb})`).join(', ') || 'none'}`,
    `steps with own errors: ${results.filter((r) => r.errors.some((e) => e.kind === 'step')).map((r) => r.id).join(', ') || 'none'}`,
    `broken aliases: ${aliasResults.filter((r) => !r.routed).map((r) => `${r.alias.from}->${r.alias.to} (${r.breadcrumb})`).join(', ') || (aliasResults.length ? 'none of ' + aliasResults.length : 'not checked')}`,
    `HTTP failures:`,
    ...[...new Set(results.concat(aliasResults).flatMap((r) => (r.badResponses || []).map((b) => b.text)))].map((t) => '  ' + t),
    '',
    'TOP ERRORS (by number of steps affected)',
    ...ranked.map((h) => `  [${h.steps.size} steps] ${h.sample.slice(0, 220)}\n      on: ${[...h.steps].join(', ')}`),
  ];
  const txtPath = path.join(OUT_DIR, 'smoke-summary.txt');
  writeFileSync(txtPath, lines.join('\n'));
  console.log(`\n${lines.slice(3).join('\n')}\nwrote ${jsonPath}\nwrote ${txtPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
