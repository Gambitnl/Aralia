// tools/creatureGate/partSweep.mjs — solo-part captures for the part gate
// (part-quality campaign, 2026-08-19).
//
//   node tools/creatureGate/partSweep.mjs <outDir> <job> [job ...]
//   job = <label>:<queryParams>:<focus>
//   e.g. dwarf-hand:"race=hill_dwarf&class=fighter":handL
//        gnoll-head:"mode= n/a use planId=19f48ed2":head   (params verbatim)
//
// Each job loads Entity Debug with ?focus=<part> (the pin-follow solo camera),
// hides all DOM except the canvas, and captures one solid frame. The blind
// reader then names the part from these crops — a hand must read "hand".
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const [outDir, ...jobs] = process.argv.slice(2);
if (!outDir || jobs.length === 0) {
  console.error('usage: node tools/creatureGate/partSweep.mjs <outDir> <label>:<params>:<focus> ...');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  for (const job of jobs) {
    const [label, params, focus] = job.split(':');
    const url = `http://localhost:3000/Aralia/misc/design.html?step=entitydebug&${params}&focus=${focus}&wire=0`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(8000);
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = '*{visibility:hidden!important} canvas{visibility:visible!important}';
      document.head.appendChild(style);
    });
    await page.waitForTimeout(400);
    await page.locator('canvas').first().screenshot({ path: `${outDir}/${label}.png` });
    console.log(`part-shot ${label}`);
  }
} finally {
  try { await browser?.close(); } catch { /* gone */ }
}
