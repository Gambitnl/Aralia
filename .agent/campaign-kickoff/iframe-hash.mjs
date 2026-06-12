import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto('http://localhost:5174/Aralia/vendor/azgaar/index.html?seed=123456789&options=default', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 15000));
const hash = await page.evaluate(() => {
  let h = 0x811c9dc5;
  const arr = window.grid.cells.h;
  for (let i = 0; i < arr.length; i++) { h ^= arr[i]; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
});
console.log('iframe fnv1a:', hash);
await browser.close();
