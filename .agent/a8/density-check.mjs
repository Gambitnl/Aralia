import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 950 } });
await page.goto('http://localhost:5174/Aralia/?phase=worldforge', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 16000));
await page.screenshot({ path: 'density-atlas.png' });
console.log('saved density-atlas.png');
// toggle political + military on for the full-dress shot
await page.evaluate(() => {
  for (const name of ['Display Political Overlay', 'Display Military']) {
    const rows = Array.from(document.querySelectorAll('div')).filter(d => (d.textContent || '').trim().startsWith(name) && (d.textContent || '').length < 130);
    let node = rows[rows.length - 1];
    for (let i = 0; i < 4 && node; i++) { const inp = node.querySelector('input[type=checkbox]'); if (inp) { inp.click(); break; } node = node.parentElement; }
  }
});
await new Promise(r => setTimeout(r, 6000));
await page.screenshot({ path: 'density-full.png' });
console.log('saved density-full.png');
await browser.close();
