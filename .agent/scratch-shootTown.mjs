import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.argv[2] || 'F:/Repos/Aralia/.agent/3d-visual-quality/captures/town-harness';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 400)));
await page.goto('http://127.0.0.1:3000/Aralia/misc/design.html?step=town3d', { waitUntil: 'domcontentloaded', timeout: 60000 });

await page.waitForSelector('[data-testid="preview-town"]', { timeout: 60000 });
// Wait for the burg name to appear in the 2D panel label and the real 3D to finish baking.
for (let i = 0; i < 90; i++) {
  const state = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="preview-town"]');
    const t = root?.textContent ?? '';
    return {
      baking: t.includes('Baking the real 3D world'),
      forging: t.includes('Forging world'),
      canvases: document.querySelectorAll('canvas').length,
      head: root?.querySelector('h2')?.textContent ?? '',
    };
  });
  if (!state.baking && !state.forging && state.canvases >= 2) { console.log('ready', JSON.stringify(state)); break; }
  if (i % 10 === 0) console.log('waiting', JSON.stringify(state));
  await page.waitForTimeout(1000);
}
await page.waitForTimeout(8000);
const info = await page.evaluate(() => {
  const root = document.querySelector('[data-testid="preview-town"]');
  return { head: root?.querySelector('h2')?.textContent, stats: root?.textContent?.slice(0, 1200), canvases: document.querySelectorAll('canvas').length };
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: `${OUT}/town-three-panels.png` });
console.log('wrote', `${OUT}/town-three-panels.png`);
await browser.close();
