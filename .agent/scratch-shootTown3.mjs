import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = 'F:/Repos/Aralia/.agent/3d-visual-quality/captures/town-harness';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)));
await page.goto('http://127.0.0.1:3000/Aralia/misc/design.html?step=town3d', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('[data-testid="preview-town"]', { timeout: 60000 });

async function settle(label) {
  for (let i = 0; i < 120; i++) {
    const s = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="preview-town"]')?.textContent ?? '';
      return { busy: t.includes('Baking the real 3D world') || t.includes('Forging world'), c: document.querySelectorAll('canvas').length };
    });
    if (!s.busy && s.c >= 2) break;
    await page.waitForTimeout(1000);
  }
  // Let chunks stream and the camera ease in.
  await page.waitForTimeout(14000);
  const diag = await page.evaluate(() => {
    const w = window;
    return {
      head: document.querySelector('[data-testid="preview-town"] h2')?.textContent,
      pose: w.__wf3dPose ? JSON.parse(JSON.stringify(w.__wf3dPose)) : null,
      canvases: [...document.querySelectorAll('canvas')].map((c) => `${c.width}x${c.height}`),
    };
  });
  console.log(label, JSON.stringify(diag));
  await page.screenshot({ path: `${OUT}/${label}.png` });
}

await settle('walled-town-hafting');
await page.getByRole('button', { name: /^Capital/ }).click();
await settle('capital-borieborum');
await page.getByRole('button', { name: /^Hamlet/ }).click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/hamlet-none-in-world.png` });
console.log('hamlet shot');
await browser.close();
