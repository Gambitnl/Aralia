import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 130)); });
await page.goto('http://localhost:5174/Aralia/?phase=world3d', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 20000)); // gen + chunk streaming + frames
const shot = async (p) => { for (let a = 0; a < 4; a++) { try { await page.screenshot({ path: p, timeout: 20000 }); return console.log('saved', p); } catch { await new Promise(r => setTimeout(r, 1500)); } } console.log('FAILED', p); };
await shot('continent-check.png');
await browser.close();
