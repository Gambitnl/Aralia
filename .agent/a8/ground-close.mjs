import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
await page.goto('http://localhost:5174/Aralia/?phase=world3d&ground=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 20000));
const c = await page.locator('canvas').boundingBox();
await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -400); await new Promise(r => setTimeout(r, 400)); }
await new Promise(r => setTimeout(r, 3000));
for (let a = 0; a < 4; a++) { try { await page.screenshot({ path: 'ground-close.png', timeout: 15000 }); console.log('saved ground-close.png'); break; } catch { await new Promise(r => setTimeout(r, 1500)); } }
await browser.close();
