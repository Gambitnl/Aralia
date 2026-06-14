import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });

page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text()); });

await page.goto('http://localhost:3001/Aralia/?wf_ground=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 4000));

const clickText = async (t) => {
  const ok = await page.evaluate((txt) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(txt) || x.getAttribute('aria-label') === txt);
    if (b) { b.click(); return true; } return false;
  }, t);
  console.log(ok ? `clicked: ${t}` : `NOT FOUND: ${t}`);
  await new Promise(r => setTimeout(r, 3000));
  return ok;
};

await clickText('Dev Menu');
await clickText('Quick Start');

let inPlay = false;
for (let i = 0; i < 40 && !inPlay; i++) {
  await new Promise(r => setTimeout(r, 3000));
  inPlay = await page.evaluate(() => document.body.innerText.includes('Current Position'));
}
console.log('inPlay:', inPlay);

if (!await clickText('Enter 3D World')) {
  await clickText('Toggle Submap');
  await clickText('Enter 3D');
}

await new Promise(r => setTimeout(r, 8000));
console.log('in 3D, teleporting to hostile...');

// Teleport the camera to trigger handoff
await page.evaluate(() => {
    if (window.__wf3dSetPose) {
        window.__wf3dSetPose([15, 10, 15], [15, 0, 15]);
    }
});

// Wait for the encounter modal to show up and click Start
await new Promise(r => setTimeout(r, 5000));
console.log('Clicking Start Battle...');
await clickText('Start Battle');

// Wait for the battle map to fully render
await new Promise(r => setTimeout(r, 5000));

// Optional: take a screenshot to prove the combat handoff was successful
await page.screenshot({ path: '.agent/a8/handoff-proof.png', timeout: 15000 });
console.log('saved .agent/a8/handoff-proof.png');
await browser.close();