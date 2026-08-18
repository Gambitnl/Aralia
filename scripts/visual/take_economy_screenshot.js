import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  console.log('Navigating to town...');
  await page.goto('http://localhost:3000/Aralia/?wf_ground=1&wf_seed=42&wf_town=1', { 
    waitUntil: 'networkidle',
    timeout: 60000 
  });
  
  console.log('Waiting for world to load...');
  await page.waitForTimeout(10000); // Wait for generation
  
  // Try to find a building label
  const labels = await page.evaluate(() => {
    return [...document.querySelectorAll('div')].map(d => d.innerText).filter(t => t.length > 3);
  });
  console.log('Labels found:', labels.slice(0, 10));

  await page.screenshot({ path: 'economy-wiring-proof.png', fullPage: true });
  console.log('Screenshot saved as economy-wiring-proof.png');
  
  await browser.close();
})();
