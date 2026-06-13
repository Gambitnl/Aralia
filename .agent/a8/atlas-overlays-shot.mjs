import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
await page.goto('http://localhost:5174/Aralia/?phase=worldforge', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 25000)); // full world gen + first draw
for (const mode of ['political', 'culture', 'religion', 'province']) {
  const clicked = await page.evaluate((m) => {
    const inputs = [...document.querySelectorAll('input[type=radio], button, label')];
    const el = inputs.find(x => (x.textContent || x.value || '').toLowerCase().includes(m) || (x.getAttribute('aria-label') || '').toLowerCase().includes(m));
    if (el) { el.click(); return true; }
    return false;
  }, mode);
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: `atlas-${mode}.png` });
  console.log(`${mode}: clicked=${clicked}, saved atlas-${mode}.png`);
}
await browser.close();
