/**
 * A8 proof capture â€” in-game region view after the WF-G4 fix.
 * Loads ?phase=worldforge, enables the demo overlay, clicks a land cell to
 * descend, waits for the region view, screenshots the full demo.
 * Run from .agent/a8/: node a8-region-ingame.mjs
 */
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
await page.goto('http://localhost:5174/Aralia/?phase=worldforge', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 12000));
await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('button, label')).find(e => /demo overlay/i.test(e.textContent || ''));
  el?.click();
});
await new Promise(r => setTimeout(r, 1500));
const canvas = await page.locator('canvas').first().boundingBox();
// Click the demo-marker anchor cell (#27 at FMG px [285.9, 63.43]; the atlas
// initial view is identity scale with zero offset, so canvas px = FMG px).
await page.mouse.click(canvas.x + canvas.width * 0.28, canvas.y + canvas.height * 0.38);
for (let i = 0; i < 25; i++) {
  await new Promise(r => setTimeout(r, 1000));
  const ascend = await page.getByRole('button', { name: /ascend/i }).count();
  if (ascend > 0) { console.log('region view confirmed at', i, 's'); break; }
  if (i === 24) console.log('NO region view after 25s');
}
await new Promise(r => setTimeout(r, 3000));
// Report the HUD's region-size line as a data check
const hud = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('div')).find(e => /Region Size:/i.test(e.textContent || '') && e.children.length <= 3);
  return el ? el.textContent : '(no HUD found)';
});
console.log('HUD:', hud);
await page.screenshot({ path: '../../docs/projects/worldforge/orchestration/proof/laneA8-region-river.png' });
console.log('saved; ascend-present:', await page.getByRole('button', { name: /ascend/i }).count());
await browser.close();

