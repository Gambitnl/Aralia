import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:5174/Aralia/?phase=worldforge', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 12000)); // demo lazy chunk + auto-generate
// Find and enable the overlay toggle
const toggles = await page.evaluate(() => Array.from(document.querySelectorAll('button, input[type=checkbox], label')).map(e => (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 40)).filter(Boolean).slice(0, 40));
console.log('controls:', JSON.stringify(toggles));
const clicked = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('button, label'));
  const el = els.find(e => /demo overlay/i.test(e.textContent || ''));
  if (el) { el.click(); return (el.textContent || '').trim(); }
  return null;
});
console.log('overlay toggle clicked:', clicked);
await new Promise(r => setTimeout(r, 2500));
await page.screenshot({ path: '../../docs/projects/worldforge/orchestration/proof/laneA7-overlay-atlas.png' });
console.log('atlas overlay proof saved');
// Descend: find the map canvas and wheel-zoom in over land (center-left mass)
const canvas = await page.locator('canvas').first().boundingBox();
if (canvas) {
  const cx = canvas.x + canvas.width * 0.35, cy = canvas.y + canvas.height * 0.45;
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 18; i++) { await page.mouse.wheel(0, -300); await new Promise(r => setTimeout(r, 180)); }
  await new Promise(r => setTimeout(r, 9000)); // region generation overlay
  const text = await page.evaluate(() => document.body.innerText.slice(0, 150));
  console.log('after descend:', JSON.stringify(text));
  await page.screenshot({ path: '../../docs/projects/worldforge/orchestration/proof/laneA7-overlay-region.png' });
  console.log('region overlay proof saved');
}
await browser.close();
