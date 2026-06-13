import { chromium } from 'playwright';
import fs from 'fs';

const POSE_FILE = 'pose.json';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch { return null; } };
const clickText = (t) => ev((txt) => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(txt) || x.getAttribute('aria-label') === txt);
  if (b) { b.click(); return true; } return false;
}, t);

await page.goto('http://localhost:5176/Aralia/?wf_ground=1&wf_seed=42&wf_town=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 5000));
// Boot to the village, resilient to reloads: loop a state machine.
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
  if (state === 'menu-save') await clickText('Continue Journey');
  else if (state === 'menu') { await clickText('Dev Menu'); await new Promise(r => setTimeout(r, 1500)); await clickText('Quick Start'); }
  else if (state === 'playing') await clickText('Enter 3D World');
  await new Promise(r => setTimeout(r, 4000));
}
await new Promise(r => setTimeout(r, 15000));
console.log('DAEMON READY');
fs.writeFileSync('daemon-ready.txt', String(Date.now()));

let lastSeen = '';
let n = 0;
for (;;) {
  await new Promise(r => setTimeout(r, 1500));
  let raw; try { raw = fs.readFileSync(POSE_FILE, 'utf8'); } catch { continue; }
  if (raw === lastSeen) continue;
  lastSeen = raw;
  let pose; try { pose = JSON.parse(raw); } catch { continue; }
  if (!pose.cam || !pose.target) continue;
  n++;
  await ev((p) => window.__wf3dSetPose && window.__wf3dSetPose(p.cam, p.target), pose);
  await new Promise(r => setTimeout(r, 2500));
  const file = `remy-shot-${n}.png`;
  try { await page.screenshot({ path: file, timeout: 20000 }); console.log('saved', file); fs.writeFileSync('shot-done.txt', file); }
  catch (e) { console.log('shot failed', e.message.slice(0, 60)); }
}
