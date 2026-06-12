import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto('http://localhost:5174/Aralia/vendor/azgaar/index.html?seed=123456789&options=default', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 15000));
const info = await page.evaluate(() => {
  const w = window;
  return {
    seed: w.seed,
    hasGrid: !!w.grid, hasPack: !!w.pack,
    gridCells: w.grid?.cells?.h?.length,
    packCells: w.pack?.cells?.h?.length,
    heightsSum: w.grid?.cells?.h ? Array.from(w.grid.cells.h).reduce((a, b) => a + b, 0) : null,
    graphW: w.graphWidth, graphH: w.graphHeight,
    template: w.byId?.('templateInput')?.value ?? document.getElementById('templateInput')?.value,
    densityInput: document.getElementById('pointsInput')?.value,
    version: w.version,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
