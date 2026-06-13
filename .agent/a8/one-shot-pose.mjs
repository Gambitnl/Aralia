import { chromium } from 'playwright';
import fs from 'fs';
const pose = JSON.parse(fs.readFileSync('pose.json', 'utf8'));
const out = process.argv[2] || 'remy-shot.png';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch { return null; } };
const click = (txt) => ev((s) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(s) || x.getAttribute('aria-label') === s); if (b) { b.click(); return true; } return false; }, txt);
await page.goto('http://localhost:5176/Aralia/?wf_ground=1&wf_seed=42&wf_town=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 5000));
for (let i = 0; i < 50; i++) {
  const state = await ev(() => {
    const t = document.body.innerText;
    if (t.includes('3D World View')) return '3d';
    if (t.includes('Current Position')) return 'playing';
    if (t.includes('Generating party')) return 'wait';
    if (t.includes('Continue Journey')) return 'menu-save';
    if (t.includes('Begin Legend')) return 'menu';
    return 'wait';
  });
  if (state === '3d') break;
  if (state === 'menu-save') await click('Continue Journey');
  else if (state === 'menu') { await click('Dev Menu'); await new Promise(r => setTimeout(r, 1500)); await click('Quick Start'); }
  else if (state === 'playing') await click('Enter 3D World');
  await new Promise(r => setTimeout(r, 4000));
}
await new Promise(r => setTimeout(r, 12000)); // chunks
await ev((p) => window.__wf3dSetPose && window.__wf3dSetPose(p.cam, p.target), pose);
await new Promise(r => setTimeout(r, 3000));
for (let a = 0; a < 4; a++) { try { await page.screenshot({ path: out, timeout: 15000 }); console.log('saved', out); break; } catch { await new Promise(r => setTimeout(r, 1500)); } }
await browser.close();
