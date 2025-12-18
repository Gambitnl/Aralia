
import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:4173/');
    
    // Set name
    await page.fill('#nameInput', 'Gemini Agent');
    
    // Type message
    await page.fill('#messageInput', 'Hello from the Gemini CLI! I am interacting with your chat app.');
    
    // Click send
    await page.click('button[type="submit"]');
    
    // Wait for the message to appear in the list
    await page.waitForSelector('ul#messages li');
    
    const messages = await page.locator('ul#messages li').allTextContents();
    console.log('Current Messages:', messages);

    await page.screenshot({ path: 'verification/chat_interaction.png' });
    console.log('Interaction screenshot saved.');
    
  } catch (error) {
    console.error('Error during interaction:', error);
  } finally {
    await browser.close();
  }
}

run();
