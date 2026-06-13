import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
await page.goto('http://localhost:5174/Aralia/?wf_ground=1&wf_seed=42&wf_town=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 4000));
const clickText = async (t) => {
  const ok = await page.evaluate((txt) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(txt) || x.getAttribute('aria-label') === txt);
    if (b) { b.click(); return true; } return false;
  }, t);
  console.log(ok ? `clicked: ${t}` : `NOT FOUND: ${t}`);
  await new Promise(r => setTimeout(r, 3000));
};
await clickText('Dev Menu');
await clickText('Quick Start');
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 3000));
  if (await page.evaluate(() => document.body.innerText.includes('Current Position'))) break;
}
await clickText('Enter 3D World');
await new Promise(r => setTimeout(r, 22000));
// pan the camera (MapControls left-drag) to trigger ground position dispatches
const c = await page.locator('canvas[data-engine]').boundingBox();
await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
await page.mouse.down();
await page.mouse.move(c.x + c.width / 2 + 200, c.y + c.height / 2 + 120, { steps: 25 });
await page.mouse.up();
await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('beforeunload')); }); await new Promise(r => setTimeout(r, 5000)); // flush paths
const saved = await page.evaluate(async () => {
  try {
    const svc = await import('/Aralia/src/services/saveLoadService.ts');
    const res = await svc.loadGame(svc.AUTO_SAVE_SLOT_KEY);
    const gs = res?.data;
    return { via: 'service', success: res?.success, playerGroundPos: gs?.playerGroundPos ?? null, hasField: gs ? 'playerGroundPos' in gs : false };
  } catch (e) { /* fall through */ }
  const raw = localStorage.getItem('aralia_rpg_autosave');
  if (!raw) return 'no autosave';
  const j = JSON.parse(raw);
  const gs = j.gameState ?? j.state ?? j;
  return { playerGroundPos: gs.playerGroundPos ?? null, hasWfDeltas: Array.isArray(gs.worldforgeDeltas) };
});
console.log('autosave:', JSON.stringify(saved));
await browser.close();
