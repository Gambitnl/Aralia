import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
await page.goto('http://localhost:5174/Aralia/?phase=world3d&ground=1&wf_roofless=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 20000));
const c = await page.locator('canvas').boundingBox();
const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
await page.mouse.move(cx, cy);
// drag the orbit low first (toward horizon), then dolly deep into the village
await page.mouse.down();
await page.mouse.move(cx, cy + 140, { steps: 16 });
await page.mouse.up();
await new Promise(r => setTimeout(r, 800));
for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -400); await new Promise(r => setTimeout(r, 300)); }
await new Promise(r => setTimeout(r, 3000));
for (let a = 0; a < 4; a++) { try { await page.screenshot({ path: 'ground-roofless.png', timeout: 15000 }); console.log('saved ground-roofless.png'); break; } catch { await new Promise(r => setTimeout(r, 1500)); } }
await browser.close();
