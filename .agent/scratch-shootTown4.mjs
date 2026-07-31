import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = 'F:/Repos/Aralia/.agent/3d-visual-quality/captures/town-harness';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)));
await page.goto('http://127.0.0.1:3000/Aralia/misc/design.html?step=town3d', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('[data-testid="preview-town"]', { timeout: 60000 });

const pressed = () => page.evaluate(() => {
  const out = {};
  for (const b of document.querySelectorAll('[data-testid="preview-town"] button[aria-pressed]')) {
    out[b.textContent.trim()] = b.getAttribute('aria-pressed');
  }
  const panes = [...document.querySelectorAll('[data-testid="preview-town"] span')]
    .filter((s) => /^(2D town map|3D minimap|Real 3D town)/.test(s.textContent))
    .map((s) => ({ label: s.textContent.trim(), w: Math.round(s.closest('div').getBoundingClientRect().width) }));
  return { pressed: out, panes };
});

async function settle(ms = 14000) {
  for (let i = 0; i < 120; i++) {
    const busy = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="preview-town"]')?.textContent ?? '';
      return t.includes('Baking the real 3D world') || t.includes('Forging world');
    });
    if (!busy) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(ms);
}
async function shot(label) {
  console.log(label, JSON.stringify(await pressed()));
  await page.screenshot({ path: `${OUT}/${label}.png` });
}
const click = (name) => page.getByRole('button', { name, exact: true }).click();

await settle();
await shot('a-all-three-hafting');

// all three -> click "3D minimap" isolates it
await click('3D minimap'); await page.waitForTimeout(1200);
// add Real 3D -> {3d, world}
await click('Real 3D'); await settle(9000);
await shot('b-minimap-plus-real3d');

// add 2D map -> back to all three
await click('2D map'); await page.waitForTimeout(1500);
await shot('c-back-to-all-three');

// all three -> isolate 2D
await click('2D map'); await page.waitForTimeout(1500);
await shot('d-2d-only');

// clicking the only visible view is a no-op
await click('2D map'); await page.waitForTimeout(800);
console.log('noop-check', JSON.stringify(await pressed()));

// All three reset, then the capital for a second framing proof
await click('All three'); await page.waitForTimeout(1200);
await page.getByRole('button', { name: /^Capital/ }).click();
await settle();
await shot('e-all-three-borieborum');
await browser.close();
