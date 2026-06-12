import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
let printed = 0;
page.on('pageerror', e => { if (printed++ < 2) console.log('[stack]', (e.stack || String(e)).split('\n').slice(0, 6).join(' | ')); });
await page.goto('http://localhost:5174/Aralia/?phase=world3d&ground=1&gx=16&gy=4', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 15000));
console.log('done');
await browser.close();
