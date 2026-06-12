// Control experiment: does the World3D engine render real terrain at the
// World3DDemo's known-good spawn in the same headless context? Separates
// "renderer broken" from "the resumed corner of the world is legitimately
// featureless" (task 2 follow-up).
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5174/Aralia/';
const STATE = path.join(__dirname, '..', '3d-visual-quality', 'captures', 'storageState.json');
const EVIDENCE = path.join(__dirname, 'evidence');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, storageState: STATE });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await sleep(3000);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /Continue Journey/i.test(x.innerText || ''));
  if (b) b.click();
});
await sleep(6000);

// Jump to the World3D demo phase (known-good spawn).
await page.evaluate(() => {
  history.pushState({}, '', location.pathname + '?phase=world3d');
  window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
});
await sleep(9000);
const state = await page.evaluate(() => window.__araliaState ?? null);
console.log('phase:', state?.phase, 'errors:', errors.length);
await page.screenshot({ path: path.join(EVIDENCE, 'world3d-control.png') });
console.log('shot', path.join(EVIDENCE, 'world3d-control.png'));
errors.slice(0, 8).forEach(e => console.log('  [err]', e));
await browser.close();
