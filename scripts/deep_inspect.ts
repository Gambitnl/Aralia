
import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  // Capture network requests
  page.on('request', request => console.log('REQUEST:', request.method(), request.url()));
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('RESPONSE ERROR:', response.status(), response.url());
    }
  });

  try {
    console.log('--- Navigating to http://localhost:4173/ ---');
    await page.goto('http://localhost:4173/');
    
    // Perform some interaction to trigger network/logs
    await page.fill('#nameInput', 'Inspector');
    await page.fill('#messageInput', 'Checking for network activity and console logs.');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(2000); // Wait for potential async activity
    
    console.log('--- Inspection Complete ---');
  } catch (error) {
    console.error('Error during deep inspection:', error);
  } finally {
    await browser.close();
  }
}

run();
