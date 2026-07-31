import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = 'F:/Repos/Aralia/.agent/3d-visual-quality/captures/town-harness';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 400)));
await page.goto('http://127.0.0.1:3000/Aralia/misc/design.html?step=town3d', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('[data-testid="preview-town"]', { timeout: 60000 });

async function settle(label) {
  for (let i = 0; i < 90; i++) {
    const s = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="preview-town"]')?.textContent ?? '';
      return { busy: t.includes('Baking the real 3D world') || t.includes('Forging world'), c: document.querySelectorAll('canvas').length };
    });
    if (!s.busy && s.c >= 2) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(9000);
  const head = await page.evaluate(() => document.querySelector('[data-testid="preview-town"] h2')?.textContent);
  console.log(label, '->', head);
  await page.screenshot({ path: `${OUT}/${label}.png` });
}

await settle('walled-town-hafting');
await page.getByRole('button', { name: /^Capital/ }).click();
await settle('capital-borieborum');
await page.getByRole('button', { name: /^Village/ }).click();
await settle('village-sarprak');
await browser.close();
