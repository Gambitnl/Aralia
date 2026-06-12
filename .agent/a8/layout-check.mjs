import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 950 } });
await page.goto('http://localhost:5174/Aralia/?phase=worldforge', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 12000));
await page.screenshot({ path: 'layout-check.png' });
console.log('saved layout-check.png');
// collapse the panel and shoot again
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /hide options/i.test(x.textContent || '')); b?.click(); });
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: 'layout-collapsed.png' });
console.log('saved layout-collapsed.png');
await browser.close();
