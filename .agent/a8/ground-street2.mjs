import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
await page.goto('http://localhost:5174/Aralia/?phase=world3d&ground=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 20000));
const c = await page.locator('canvas').boundingBox();
const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
// dolly in
await page.mouse.move(cx, cy);
for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -400); await new Promise(r => setTimeout(r, 300)); }
// left-drag up: lower the orbit toward the horizon
await page.mouse.down();
await page.mouse.move(cx, cy + 260, { steps: 20 });
await page.mouse.up();
await new Promise(r => setTimeout(r, 1000));
// slight orbit around for a wall-facing angle
await page.mouse.down();
await page.mouse.move(cx + 900, cy + 240, { steps: 20 });
await page.mouse.up();
await new Promise(r => setTimeout(r, 3000));
for (let a = 0; a < 4; a++) { try { await page.screenshot({ path: 'ground-street2.png', timeout: 15000 }); console.log('saved ground-street2.png'); break; } catch { await new Promise(r => setTimeout(r, 1500)); } }
await browser.close();
