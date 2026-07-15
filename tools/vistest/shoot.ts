/**
 * @file tools/vistest/shoot.ts — the canonical visual-test capture runner.
 *
 *   npx tsx tools/vistest/shoot.ts                        # capture every scenario
 *   npx tsx tools/vistest/shoot.ts --only crowd-commute   # one (comma-list ok)
 *   npx tsx tools/vistest/shoot.ts --base http://localhost:5174/Aralia/ --out .agent/vistest/captures
 *
 * Interprets each scenario's declarative capture recipe from
 * src/devtools/vistest/scenarios.ts against a running dev server and writes
 * one PNG per scenario. Replaces the ad-hoc probe scripts that used to live
 * in .agent/scratch: `readback` uses the proven rAF framebuffer read (the
 * compositor screenshot starves under a busy R3F loop on SwiftShader), and
 * `screenshot` is a plain capture for pages where that works.
 *
 * Fails loudly: a failed step throws with the scenario id + step index, and
 * the process exits non-zero if any scenario failed.
 */
import { chromium, type Page } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SCENARIOS, validateScenarios, type CaptureStep, type VisScenario } from '../../src/devtools/vistest/scenarios';
import { outputPath, scenarioUrl } from '../../src/devtools/vistest/runnerCore';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  if (!v || v.startsWith('--')) {
    console.error(`vistest: missing value for --${name}`);
    process.exit(1);
  }
  return v;
}

const base = arg('base', 'http://localhost:5174/Aralia/');
const outDir = arg('out', '.agent/vistest/captures');
const only = arg('only', '');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runStep(page: Page, s: VisScenario, index: number, step: CaptureStep): Promise<void> {
  switch (step.kind) {
    case 'sleep':
      await sleep(step.ms);
      return;
    case 'waitHook': {
      const deadline = Date.now() + (step.timeoutMs ?? 60000);
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const ok = await page.evaluate(`!!(${step.expr})`);
        if (ok) return;
        if (Date.now() > deadline) {
          throw new Error(`waitHook timed out: ${step.expr}`);
        }
        await sleep(500);
      }
    }
    case 'eval': {
      const result = await page.evaluate(step.js);
      // Recipes return short status strings ('posed', 'clicked'); surface
      // obvious failures instead of capturing a wrong frame.
      if (typeof result === 'string' && /missing|no |MISSING/i.test(result)) {
        throw new Error(`eval reported "${result}"`);
      }
      return;
    }
    case 'readback': {
      const dataUrl = await page.evaluate(
        () =>
          new Promise<string>((res, rej) => {
            const canvas = [...document.querySelectorAll('canvas')].find((c) => {
              try {
                return !!(c.getContext('webgl2') || c.getContext('webgl'));
              } catch {
                return false;
              }
            });
            if (!canvas) return rej(new Error('no webgl canvas'));
            requestAnimationFrame(() => {
              try {
                res(canvas.toDataURL('image/png'));
              } catch (e) {
                rej(e as Error);
              }
            });
          }),
      );
      const b64 = String(dataUrl).split(',')[1] ?? '';
      if (b64.length < 10000) {
        throw new Error(`readback produced a suspiciously small frame (${b64.length} b64 chars)`);
      }
      writeFileSync(outputPath(outDir, s), Buffer.from(b64, 'base64'));
      return;
    }
    case 'screenshot': {
      await page.evaluate(() => document.fonts?.ready?.then(() => true).catch(() => true));
      await page.screenshot({ path: outputPath(outDir, s), timeout: 60000 });
      return;
    }
    default: {
      const never: never = step;
      throw new Error(`unknown step ${JSON.stringify(never)}`);
    }
  }
}

async function main(): Promise<void> {
  const problems = validateScenarios(SCENARIOS);
  if (problems.length > 0) {
    console.error('vistest: registry invalid:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
  const wanted = only
    ? SCENARIOS.filter((s) => only.split(',').includes(s.id))
    : SCENARIOS;
  if (only && wanted.length !== only.split(',').length) {
    const known = new Set(SCENARIOS.map((s) => s.id));
    const missing = only.split(',').filter((id) => !known.has(id));
    console.error(`vistest: unknown scenario id(s): ${missing.join(', ')}`);
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  let failed = 0;
  for (const s of wanted) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    try {
      await page.goto(scenarioUrl(base, s), { waitUntil: 'domcontentloaded', timeout: 30000 });
      for (const [i, step] of s.capture.entries()) {
        try {
          await runStep(page, s, i, step);
        } catch (e) {
          throw new Error(`scenario "${s.id}" step ${i} (${step.kind}): ${(e as Error).message}`);
        }
      }
      console.log(`shot ${outputPath(outDir, s)}`);
    } catch (e) {
      failed += 1;
      console.error(`FAILED ${(e as Error).message}`);
    } finally {
      await page.close();
    }
  }
  await browser.close();
  if (failed > 0) {
    console.error(`vistest: ${failed}/${wanted.length} scenario(s) failed`);
    process.exit(1);
  }
  console.log(`vistest: ${wanted.length} scenario(s) captured to ${outDir}`);
}

await main();
