import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function takeScreenshot(url, outPath) {
  console.log(`Starting Playwright for ${outPath}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

  // Wait for 3D scene to load chunks and render
  console.log('Waiting 10 seconds for 3D load...');
  await page.waitForTimeout(10000);

  // Dismiss modal if present
  try {
    const continueBtn = page.locator('text=Continue');
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch (err) {}

  console.log(`Taking screenshot: ${outPath}`);
  await page.screenshot({
    path: outPath,
    fullPage: false
  });
  console.log(`Saved ${outPath}`);
  await browser.close();
}

async function main() {
  const dir = '.agent';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await takeScreenshot(
    'http://127.0.0.1:3001/Aralia/?phase=world3d&groundMode=1',
    '.agent/forge-skin-1-baseline.png'
  );

  await takeScreenshot(
    'http://127.0.0.1:3001/Aralia/?phase=world3d&groundMode=1&stubForgeAssets=1',
    '.agent/forge-skin-1-textured.png'
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
