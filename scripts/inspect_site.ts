
import { chromium } from 'playwright';

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    console.log('Navigating to http://localhost:4173/ ...');
    const response = await page.goto('http://localhost:4173/');
    console.log('Status:', response?.status());
    
    console.log('Page Title:', await page.title());
    
    // Check for specific elements like "New Game"
    const btn = page.getByRole('button', { name: /New Game/i });
    if (await btn.isVisible()) {
        console.log('Found "New Game" button.');
    } else {
        console.log('"New Game" button not found.');
    }

    const bodyHTML = await page.locator('body').innerHTML();
    console.log('Body Content Preview:', bodyHTML.slice(0, 500));

    await page.screenshot({ path: 'verification/site_status.png' });
    console.log('Screenshot saved to verification/site_status.png');
    
  } catch (error) {
    console.error('Error during inspection:', error);
  } finally {
    await browser.close();
  }
}

run();
