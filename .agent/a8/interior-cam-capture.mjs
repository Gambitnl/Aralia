import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 850 } })).newPage();
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch { return null; } };
const click = (txt) => ev((s) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(s) || x.getAttribute('aria-label') === s); if (b) { b.click(); return true; } return false; }, txt);
await page.goto('http://localhost:5176/Aralia/?wf_ground=1&wf_seed=42&wf_town=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 5000));
for (let i = 0; i < 50; i++) {
  const s = await ev(() => { const t = document.body.innerText; if (t.includes('3D World View')) return '3d'; if (t.includes('Generating party')) return 'wait'; if (t.includes('Current Position')) return 'playing'; if (t.includes('Continue Journey')) return 'menu-save'; if (t.includes('Begin Legend')) return 'menu'; return 'wait'; });
  if (s === '3d') break;
  if (s === 'menu-save') await click('Continue Journey');
  else if (s === 'menu') { await click('Dev Menu'); await new Promise(r => setTimeout(r, 1500)); await click('Quick Start'); }
  else if (s === 'playing') await click('Enter 3D World');
  await new Promise(r => setTimeout(r, 4000));
}
await new Promise(r => setTimeout(r, 14000));
// village-center target from the live pose hook, then drop the camera onto it at eye height
const pose = await ev(() => window.__wf3dPose || null);
if (!pose) { console.log('no pose'); await browser.close(); process.exit(1); }
const t = pose.target;
// camera 0.5m off the target, eye height ~1.6m above the target's ground y
await ev((tt) => window.__wf3dSetPose && window.__wf3dSetPose([tt[0] + 0.6, tt[1] + 1.6, tt[2] + 0.6], [tt[0] + 6, tt[1] + 1.4, tt[2] + 6]), t);
await new Promise(r => setTimeout(r, 3500));
for (let a = 0; a < 4; a++) { try { await page.screenshot({ path: 'roofhide-interior.png', timeout: 15000 }); console.log('saved roofhide-interior.png at', JSON.stringify(t)); break; } catch { await new Promise(r => setTimeout(r, 1500)); } }
await browser.close();
