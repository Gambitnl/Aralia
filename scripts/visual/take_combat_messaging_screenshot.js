import { chromium } from '@playwright/test';
import path from 'path';

async function main() {
  console.log('Starting Playwright for Combat Messaging Demo...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3001/Aralia/...');
  await page.goto('http://localhost:3001/Aralia/', { waitUntil: 'networkidle', timeout: 25000 });

  // Wait for load/mount
  await page.waitForTimeout(3000);

  // Click Ollama Continue if visible
  try {
    const continueBtn = page.locator('text=Continue');
    if (await continueBtn.isVisible()) {
      console.log('Clicking "Continue" button on dependency modal...');
      await continueBtn.click();
      await page.waitForTimeout(2000);
    }
  } catch (err) {
    console.log('Continue button check skipped/error:', err.message);
  }

  // Click the "Dev Menu" button on the Main Menu
  console.log('Looking for "Dev Menu" button...');
  const devMenuBtn = page.locator('button:has-text("Dev Menu")');
  if (await devMenuBtn.isVisible()) {
    console.log('Clicking "Dev Menu" button...');
    await devMenuBtn.click();
    await page.waitForTimeout(2000);
  } else {
    console.log('Dev Menu button not visible on main menu, trying fallback options...');
    // Try system menu toggle if any
    const menuBtn = page.locator('button[aria-haspopup="menu"]');
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.waitForTimeout(1000);
      const devMenuItem = page.locator('[role="menuitem"]:has-text("Dev Menu")');
      if (await devMenuItem.isVisible()) {
        await devMenuItem.click();
        await page.waitForTimeout(2000);
      }
    }
  }

  // Check if Dev Mode needs to be enabled
  const enableDevBtn = page.locator('button:has-text("Enable Dev Mode")');
  if (await enableDevBtn.isVisible()) {
    console.log('Enabling Dev Mode...');
    await enableDevBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click Combat Messaging Demo button
  console.log('Looking for "Combat Messaging Demo" button...');
  const demoBtn = page.locator('button:has-text("Combat Messaging Demo")');
  if (await demoBtn.isVisible()) {
    console.log('Clicking "Combat Messaging Demo" button...');
    await demoBtn.click();
    
    // Wait for the demo events sequence to play out
    console.log('Waiting 12 seconds for the demo combat events sequence...');
    await page.waitForTimeout(12000);

    const screenshotPath = 'C:\\Users\\Gambit\\.gemini\\antigravity\\scratch\\combat_messaging_demo.png';
    console.log(`Taking screenshot: ${screenshotPath}`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: false
    });
    console.log('Screenshot captured successfully.');
  } else {
    throw new Error('Combat Messaging Demo button not found in Dev Menu!');
  }

  await browser.close();
}

main().catch(err => {
  console.error('Error running screenshot script:', err);
  process.exit(1);
});
