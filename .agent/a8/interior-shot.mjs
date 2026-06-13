import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 800 } });
page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 140)); });
await page.goto('http://localhost:5174/Aralia/misc/worldforge_interior_debug.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__interiorDebugReady === true, { timeout: 20000 });
await page.screenshot({ path: 'interior-debug.png' });
console.log('saved interior-debug.png');
await browser.close();
