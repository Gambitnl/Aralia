import { chromium } from 'playwright';
import fs from 'fs';

const POSE_FILE = 'pose.json';
const race = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('watchdog')), ms))]);
let browser, page;

async function boot() {
  if (browser) { try { await browser.close(); } catch {} }
  browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const ev = async (fn, arg) => { try { return await race(page.evaluate(fn, arg), 10000); } catch { return null; } };
  await page.goto('http://localhost:5176/Aralia/?wf_ground=1&wf_seed=42&wf_town=1', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 5000));
  for (let i = 0; i < 60; i++) {
    const state = await ev(() => {
      const t = document.body.innerText;
      if (t.includes('3D World View')) return '3d';
      if (t.includes('Current Position')) return 'playing';
      if (t.includes('Continue Journey')) return 'menu-save';
      if (t.includes('Begin Legend')) return 'menu';
      if (t.includes('Generating party')) return 'generating';
      return 'unknown';
    });
    if (state === '3d') break;
    const click = (txt) => ev((s) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(s) || x.getAttribute('aria-label') === s); if (b) { b.click(); return true; } return false; }, txt);
    if (state === 'menu-save') await click('Continue Journey');
    else if (state === 'menu') { await click('Dev Menu'); await new Promise(r => setTimeout(r, 1500)); await click('Quick Start'); }
    else if (state === 'playing') await click('Enter 3D World');
    await new Promise(r => setTimeout(r, 4000));
  }
  await new Promise(r => setTimeout(r, 12000));
  console.log('BOOTED');
}

await boot();
fs.writeFileSync('daemon-ready.txt', String(Date.now()));
console.log('DAEMON2 READY');

let lastSeen = '';
let n = 0;
for (;;) {
  await new Promise(r => setTimeout(r, 1500));
  let raw; try { raw = fs.readFileSync(POSE_FILE, 'utf8'); } catch { continue; }
  if (raw === lastSeen) continue;
  let pose; try { pose = JSON.parse(raw); } catch { lastSeen = raw; continue; }
  if (!pose.cam || !pose.target) { lastSeen = raw; continue; }
  n++;
  let ok = false;
  for (let attempt = 0; attempt < 2 && !ok; attempt++) {
    try {
      await race(page.evaluate((p) => window.__wf3dSetPose && window.__wf3dSetPose(p.cam, p.target), pose), 10000);
      await new Promise(r => setTimeout(r, 2500));
      await page.screenshot({ path: `remy-shot-${n}.png`, timeout: 15000 });
      ok = true;
    } catch (e) {
      console.log(`attempt ${attempt} failed (${e.message.slice(0, 40)}) — rebooting page`);
      try { await boot(); } catch (e2) { console.log('reboot failed', e2.message.slice(0, 40)); }
    }
  }
  lastSeen = raw;
  if (ok) { console.log('saved', `remy-shot-${n}.png`); fs.writeFileSync('shot-done.txt', `remy-shot-${n}.png`); }
  else { console.log('SHOT FAILED after retries'); fs.writeFileSync('shot-done.txt', 'FAILED'); }
}
