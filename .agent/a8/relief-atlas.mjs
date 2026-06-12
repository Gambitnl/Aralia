import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 950 } });
await page.goto('http://localhost:5174/Aralia/?phase=worldforge', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 16000));
await page.screenshot({ path: 'relief-atlas.png' });
console.log('saved relief-atlas.png');
await browser.close();
